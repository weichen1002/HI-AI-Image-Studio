import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Req,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Param,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import {
  HiapiService,
  type SupportedBackground,
  type SupportedModeration,
  type SupportedImageQuality,
  type SupportedImageSize,
  type SupportedOutputFormat,
} from '../hiapi/hiapi.service';
import { normalizeAspectRatio } from '../utils';
import { config } from '../config';
import * as crypto from 'crypto';
import type { Express } from 'express';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { ImagesRepo } from '../db/repositories/images.repo';
import { CreditsRepo } from '../credits/credits.repo';
import { costFor } from '../credits/pricing';
import { SqliteService } from '../db/sqlite.service';
import { SystemSettingsRepo } from '../db/repositories/system-settings.repo';
import { DialogueRepo } from '../db/repositories/dialogue.repo';
import type { ImageMode, ImageOperationType } from '../db/repositories/images.repo';
import { logError, toErrorDetails } from '../logging/logger';
import { createImageJobLifecycle } from './image-job-lifecycle';

function normalizeLimit(value: string | undefined) {
  const limit = Number(value || 12);
  if (!Number.isFinite(limit)) return 12;
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

function normalizeOffset(value: string | undefined) {
  const offset = Number(value || 0);
  if (!Number.isFinite(offset)) return 0;
  return Math.max(0, Math.floor(offset));
}

function normalizeImageModeFilter(value: string | undefined): ImageMode | 'all' {
  const mode = String(value || 'all').trim();
  if (
    mode === 'all' ||
    mode === 'text' ||
    mode === 'image' ||
    mode === 'dialogue' ||
    mode === 'continuous' ||
    mode === 'tools'
  ) {
    return mode;
  }
  return 'all';
}

function normalizeSearchQuery(value: string | undefined) {
  return String(value || '').trim().slice(0, 120);
}

function normalizeAssetFilterValue(value: string | undefined) {
  return String(value || '').trim().slice(0, 80);
}

function normalizePrompt(value: any) {
  const prompt = String(value || '').trim();
  if (!prompt) {
    throw new HttpException('请输入提示词', HttpStatus.BAD_REQUEST);
  }
  if (prompt.length > 4000) {
    throw new HttpException('提示词不能超过 4000 字符', HttpStatus.BAD_REQUEST);
  }
  return prompt;
}

function normalizeSourceImageUrl(value: any) {
  const sourceImageUrl = String(value || '').trim();
  if (!sourceImageUrl) return '';
  if (sourceImageUrl.startsWith('data:') || sourceImageUrl.startsWith('blob:')) {
    return '';
  }

  try {
    const parsed = new URL(sourceImageUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function normalizeOperationType(value: any): ImageOperationType {
  const operationType = String(value || '').trim();
  if (
    operationType === 'inpaint' ||
    operationType === 'outpaint' ||
    operationType === 'cutout' ||
    operationType === 'upscale'
  ) {
    return operationType;
  }
  throw new HttpException('不支持的编辑类型', HttpStatus.BAD_REQUEST);
}

function modeForOperationType(operationType: ImageOperationType) {
  if (operationType === 'cutout' || operationType === 'upscale') return 'tools' as const;
  return 'image' as const;
}

function normalizeCreateMode(value: any, fallback: 'text' | 'image'): ImageMode {
  void value;
  return fallback;
}

function normalizeDialogueLimit(value: string | undefined) {
  const limit = Number(value || 5);
  if (!Number.isFinite(limit)) return 5;
  return Math.max(1, Math.min(10, Math.floor(limit)));
}

function promptForOperation(operationType: ImageOperationType, prompt: string) {
  if (operationType === 'cutout') {
    const extra = String(prompt || '').trim();
    const promptParts = [
      '请保留主体完整轮廓，去除背景，输出干净的透明背景 PNG。',
      '要求边缘自然干净，不要阴影、地面、倒影、额外物体、文字或水印。',
    ];
    if (extra) {
      promptParts.push(`额外要求：${extra}`);
    }
    return promptParts.join(' ');
  }
  if (operationType === 'upscale') {
    const extra = String(prompt || '').trim();
    const promptParts = [
      '请对这张图片进行高清增强和细节重建，提升清晰度、边缘质量、纹理细节和整体观感。',
      '保持原始主体、构图、色彩关系和风格一致，不要新增文字、水印、Logo 或无关物体。',
    ];
    if (extra) {
      promptParts.push(`额外要求：${extra}`);
    }
    return promptParts.join(' ');
  }
  return prompt;
}

function normalizeImageSize(value: any): SupportedImageSize {
  const size = String(value || 'auto').trim();
  if (
    size === 'auto' ||
    size === '1024x1024' ||
    size === '1536x1024' ||
    size === '1024x1536'
  ) {
    return size;
  }
  throw new HttpException('不支持的输出尺寸', HttpStatus.BAD_REQUEST);
}

function normalizeImageQuality(value: any): SupportedImageQuality {
  const quality = String(value || 'auto').trim();
  if (
    quality === 'auto' ||
    quality === 'low' ||
    quality === 'medium' ||
    quality === 'high'
  ) {
    return quality;
  }
  throw new HttpException('不支持的生成质量', HttpStatus.BAD_REQUEST);
}

function normalizeQualityTier(value: any): '1k' | '2k' | '4k' {
  const tier = String(value || '1k').trim().toLowerCase();
  if (tier === '1k' || tier === '2k' || tier === '4k') {
    return tier;
  }
  throw new HttpException('不支持的质量档位', HttpStatus.BAD_REQUEST);
}

function normalizeOutputFormat(value: any): SupportedOutputFormat {
  const format = String(value || 'png').trim().toLowerCase();
  if (format === 'png' || format === 'jpeg' || format === 'webp') {
    return format;
  }
  throw new HttpException('不支持的输出格式', HttpStatus.BAD_REQUEST);
}

function normalizeOutputCompression(value: any) {
  const compression = Number(value ?? 100);
  if (!Number.isFinite(compression)) {
    throw new HttpException('压缩率不正确', HttpStatus.BAD_REQUEST);
  }
  return Math.max(0, Math.min(100, Math.floor(compression)));
}

function normalizeBackground(value: any): SupportedBackground {
  const background = String(value || 'auto').trim().toLowerCase();
  if (
    background === 'auto' ||
    background === 'transparent' ||
    background === 'opaque'
  ) {
    return background;
  }
  throw new HttpException('不支持的背景策略', HttpStatus.BAD_REQUEST);
}

function normalizeModeration(value: any): SupportedModeration {
  const moderation = String(value || 'auto').trim().toLowerCase();
  if (moderation === 'auto' || moderation === 'low') {
    return moderation;
  }
  throw new HttpException('不支持的审核等级', HttpStatus.BAD_REQUEST);
}

function normalizeImageCount(value: any) {
  const count = Number(value || 1);
  if (!Number.isFinite(count)) {
    throw new HttpException('生成张数不正确', HttpStatus.BAD_REQUEST);
  }
  const normalizedCount = Math.floor(count);
  if (![1, 2, 4].includes(normalizedCount)) {
    throw new HttpException('当前仅支持一次生成 1、2、4 张', HttpStatus.BAD_REQUEST);
  }
  return normalizedCount;
}

function normalizeAssetFolder(value: any) {
  const folder = String(value || '').trim();
  if (folder.length > 60) {
    throw new HttpException('文件夹名称不能超过 60 字符', HttpStatus.BAD_REQUEST);
  }
  return folder;
}

function normalizeAssetTags(value: any) {
  const source = Array.isArray(value) ? value : [];
  const tags = Array.from(
    new Set(source.map((item) => String(item || '').trim()).filter(Boolean)),
  );
  if (tags.some((tag) => tag.length > 30)) {
    throw new HttpException('标签不能超过 30 字符', HttpStatus.BAD_REQUEST);
  }
  if (tags.length > 20) {
    throw new HttpException('标签最多 20 个', HttpStatus.BAD_REQUEST);
  }
  return tags;
}

function toListImage(image: any) {
  return {
    ...image,
    mode: image.mode || 'text',
    imageUrls: (image.imageUrls || []).filter(Boolean),
    inputImageUrls: (image.inputImageUrls || []).filter(Boolean),
    generationParams:
      image.generationParams && typeof image.generationParams === 'object'
        ? image.generationParams
        : {},
    folder: String(image.folder || ''),
    tags: Array.isArray(image.tags) ? image.tags.filter(Boolean) : [],
    continuationChainId: image.continuationChainId || '',
  };
}

function createGenerationParams(params: {
  qualityTier?: string;
  count?: number;
  outputFormat?: string;
  outputCompression?: number;
  background?: string;
  moderation?: string;
  size?: string;
  quality?: string;
  operationType?: string;
}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  );
}

function toPublicDialogueMessage(message: any) {
  return {
    id: String(message?.id || ''),
    imageId: String(message?.imageId || ''),
    prompt: String(message?.prompt || ''),
    createdAt: String(message?.createdAt || ''),
  };
}

function uploadDir() {
  const dir = path.join(config.DATA_DIR, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function extForMime(mime: string) {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/webp') return '.webp';
  return '';
}

function mimeForFileName(fileName: string) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

function toUploadFilePath(url: string) {
  const val = String(url || '');
  if (!val.startsWith('/uploads/')) return '';
  const fileName = path.basename(val);
  if (!fileName) return '';
  return path.join(uploadDir(), fileName);
}

async function removeUploadedFile(filePath: string) {
  if (!filePath) return;
  try {
    await fsp.unlink(filePath);
  } catch {
    void 0;
  }
}

async function filePathToDataUrl(filePath: string, mimeType?: string) {
  const buffer = await fsp.readFile(filePath);
  return `data:${mimeType || mimeForFileName(filePath)};base64,${buffer.toString('base64')}`;
}

async function urlToInputImage(url: string) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.startsWith('data:')) return value;
  if (value.startsWith('/uploads/')) {
    const filePath = toUploadFilePath(value);
    if (!filePath) return '';
    return filePathToDataUrl(filePath);
  }
  return value;
}

async function saveUploadedBuffer(file: Express.Multer.File) {
  const ext = extForMime(file.mimetype);
  if (!ext) {
    throw new HttpException('不支持的图片格式', HttpStatus.BAD_REQUEST);
  }
  const fileName = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(uploadDir(), fileName);
  await fsp.writeFile(filePath, file.buffer);
  return {
    fileName,
    filePath,
    url: `/uploads/${fileName}`,
  };
}

function parseDataUrl(value: string, fallbackMimeType: string = 'image/png') {
  const normalizedValue = String(value || '').trim();
  const commaIndex = normalizedValue.indexOf(',');
  const meta = commaIndex >= 0 ? normalizedValue.slice(0, commaIndex) : '';
  const body = commaIndex >= 0 ? normalizedValue.slice(commaIndex + 1) : '';
  const mimeMatch = /^data:([^;]+);base64$/i.exec(meta);
  const mimeType = mimeMatch?.[1] || fallbackMimeType;
  if (!meta || !body) {
    throw new HttpException('上游返回了无效的图片数据', HttpStatus.BAD_GATEWAY);
  }
  return {
    mimeType,
    buffer: Buffer.from(body, 'base64'),
  };
}

async function saveImageBuffer(buffer: Buffer, mimeType: string) {
  const ext = extForMime(mimeType);
  if (!ext) {
    throw new HttpException('上游返回了不支持的图片格式', HttpStatus.BAD_GATEWAY);
  }
  const fileName = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(uploadDir(), fileName);
  await fsp.writeFile(filePath, buffer);
  return {
    fileName,
    filePath,
    url: `/uploads/${fileName}`,
    created: true,
  };
}

async function persistImageAsset(url: string, fallbackMimeType: string = 'image/png') {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return null;
  if (normalizedUrl.startsWith('/uploads/')) {
    return {
      fileName: path.basename(normalizedUrl),
      filePath: toUploadFilePath(normalizedUrl),
      url: normalizedUrl,
      created: false,
    };
  }
  if (normalizedUrl.startsWith('data:')) {
    const { mimeType, buffer } = parseDataUrl(normalizedUrl, fallbackMimeType);
    return saveImageBuffer(buffer, mimeType);
  }
  try {
    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      throw new HttpException('下载上游图片失败', HttpStatus.BAD_GATEWAY);
    }
    const arrayBuffer = await response.arrayBuffer();
    const mimeType =
      response.headers.get('content-type')?.split(';')[0]?.trim() ||
      fallbackMimeType;
    return saveImageBuffer(Buffer.from(arrayBuffer), mimeType);
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new HttpException('保存上游图片失败', HttpStatus.BAD_GATEWAY);
  }
}

async function persistImageAssets(urls: string[], fallbackMimeType: string = 'image/png') {
  const persisted = await Promise.all(
    (Array.isArray(urls) ? urls : []).filter(Boolean).map((item) =>
      persistImageAsset(String(item || ''), fallbackMimeType),
    ),
  );
  return persisted.filter(Boolean) as Array<{
    fileName: string;
    filePath: string;
    url: string;
    created: boolean;
  }>;
}

async function persistImageAssetsSafely(
  urls: string[],
  fallbackMimeType: string = 'image/png',
) {
  try {
    const persisted = await persistImageAssets(urls, fallbackMimeType);
    return {
      urls: persisted.map((item) => item.url),
      persisted,
      degraded: false,
    };
  } catch (error) {
    logError('ImageController', 'Persisting generated assets failed, fallback to source URLs', {
      error: toErrorDetails(error),
    });
    // 结果落地失败时回退到原始地址，避免把本来成功的生成请求变成失败。
    return {
      urls: (Array.isArray(urls) ? urls : []).filter(Boolean).map((item) => String(item)),
      persisted: [] as Array<{
        fileName: string;
        filePath: string;
        url: string;
        created: boolean;
      }>,
      degraded: true,
    };
  }
}

@Controller('api/images')
@UseGuards(AuthGuard)
export class ImageController {
  constructor(
    private readonly imagesRepo: ImagesRepo,
    private readonly dialogueRepo: DialogueRepo,
    private readonly hiapiService: HiapiService,
    private readonly creditsRepo: CreditsRepo,
    private readonly sqlite: SqliteService,
    private readonly settingsRepo: SystemSettingsRepo,
  ) {}

  private async materializeImageAssets(image: any, userId: string) {
    const nextImage = toListImage(image);
    try {
      const resultAssets = await persistImageAssets(nextImage.imageUrls, 'image/png');
      const inputAssets = await persistImageAssets(nextImage.inputImageUrls, 'image/png');
      const imageUrls = resultAssets.map((item) => item.url);
      const inputImageUrls = inputAssets.map((item) => item.url);
      if (
        imageUrls.join('|') !== nextImage.imageUrls.join('|') ||
        inputImageUrls.join('|') !== nextImage.inputImageUrls.join('|')
      ) {
        this.imagesRepo.updateSources({
          id: nextImage.id,
          userId,
          imageUrls,
          inputImageUrls,
        });
      }
      return {
        ...nextImage,
        imageUrls,
        inputImageUrls,
      };
    } catch (error) {
      logError('ImageController', 'Materializing stored image assets failed', {
        imageId: nextImage.id,
        userId,
        error: toErrorDetails(error),
      });
      return nextImage;
    }
  }

  @Get()
  async getImages(
    @Req() req: RequestWithUser,
    @Query('limit') limitValue?: string,
    @Query('offset') offsetValue?: string,
    @Query('mode') modeValue?: string,
    @Query('q') qValue?: string,
    @Query('folder') folderValue?: string,
    @Query('tag') tagValue?: string,
  ) {
    const limit = normalizeLimit(limitValue);
    const offset = normalizeOffset(offsetValue);
    const mode = normalizeImageModeFilter(modeValue);
    const q = normalizeSearchQuery(qValue);
    const folder = normalizeAssetFilterValue(folderValue);
    const tag = normalizeAssetFilterValue(tagValue);
    const page = this.imagesRepo.listByUserPaged({
      userId: req.user.id,
      limit,
      offset,
      mode,
      q,
      folder,
      tag,
    });
    const images = await Promise.all(
      page.items
        .map((item) => this.materializeImageAssets(item, req.user.id)),
    );
    const chainCounts = this.imagesRepo.countByChains({
      userId: req.user.id,
      chainIds: images.map((image) => image.continuationChainId).filter(Boolean),
    });
    return {
      images: images.map((image) => ({
        ...image,
        chainRoundCount: image.continuationChainId
          ? chainCounts[image.continuationChainId] || 1
          : undefined,
      })),
      total: page.total,
      limit,
      offset,
    };
  }

  @Get('dialogue/history')
  getDialogueHistory(
    @Req() req: RequestWithUser,
    @Query('chainId') chainIdValue?: string,
    @Query('imageId') imageId?: string,
    @Query('limit') limitValue?: string,
  ) {
    let chainId = String(chainIdValue || '').trim();
    if (!chainId && imageId) {
      const image = this.imagesRepo.findById({ id: imageId, userId: req.user.id });
      if (!image) {
        throw new HttpException('记录不存在', HttpStatus.NOT_FOUND);
      }
      chainId = String(image.continuationChainId || '').trim();
    }
    if (!chainId) {
      return { chainId: '', messages: [] };
    }

    const messages = this.dialogueRepo.listRecentByChain({
      chainId,
      userId: req.user.id,
      limit: normalizeDialogueLimit(limitValue),
    });
    return { chainId, messages: messages.map(toPublicDialogueMessage) };
  }

  @Get('dialogue/chain')
  async getDialogueChain(
    @Req() req: RequestWithUser,
    @Query('chainId') chainIdValue?: string,
    @Query('imageId') imageId?: string,
  ) {
    let chainId = String(chainIdValue || '').trim();
    if (!chainId && imageId) {
      const image = this.imagesRepo.findById({ id: imageId, userId: req.user.id });
      if (!image) {
        throw new HttpException('记录不存在', HttpStatus.NOT_FOUND);
      }
      chainId = String(image.continuationChainId || '').trim();
    }
    if (!chainId) {
      return { chainId: '', images: [], messages: [] };
    }

    const images = await Promise.all(
      this.imagesRepo
        .listByChain({ chainId, userId: req.user.id })
        .map((item) => this.materializeImageAssets(item, req.user.id)),
    );
    const messages = this.dialogueRepo.listByChainAsc({
      chainId,
      userId: req.user.id,
      limit: 30,
    });

    return {
      chainId,
      images,
      messages: messages.map(toPublicDialogueMessage),
    };
  }

  @Put(':id/meta')
  updateImageMeta(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const image = this.imagesRepo.findById({ id, userId: req.user.id });
    if (!image) {
      throw new HttpException('记录不存在', HttpStatus.NOT_FOUND);
    }

    const next: { folder?: string; tags?: string[] } = {};
    if (Object.prototype.hasOwnProperty.call(body || {}, 'folder')) {
      next.folder = normalizeAssetFolder(body.folder);
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'tags')) {
      next.tags = normalizeAssetTags(body.tags);
    }
    if (!Object.keys(next).length) {
      return { image: toListImage(image) };
    }

    this.imagesRepo.updateAssetMeta({
      id,
      userId: req.user.id,
      ...next,
    });
    return {
      image: toListImage({
        ...image,
        ...next,
      }),
    };
  }

  @Delete('dialogue/chain/:chainId')
  async deleteDialogueChain(
    @Req() req: RequestWithUser,
    @Param('chainId') chainId: string,
  ) {
    const normalizedChainId = String(chainId || '').trim();
    if (!normalizedChainId) {
      throw new HttpException('对话链不存在', HttpStatus.NOT_FOUND);
    }

    const urls = this.imagesRepo.listAssetUrlsByChain({
      userId: req.user.id,
      chainId: normalizedChainId,
    });
    const deleted = this.sqlite.transaction(() => {
      const changes = this.imagesRepo.deleteByChain({
        chainId: normalizedChainId,
        userId: req.user.id,
      });
      this.dialogueRepo.deleteByChain({
        chainId: normalizedChainId,
        userId: req.user.id,
      });
      return changes;
    });

    if (deleted <= 0) {
      throw new HttpException('对话链不存在', HttpStatus.NOT_FOUND);
    }

    for (const u of urls) {
      const filePath = toUploadFilePath(u);
      if (!filePath) continue;
      try {
        await fsp.unlink(filePath);
      } catch {
        void 0;
      }
    }

    return { ok: true };
  }

  @Post('dialogue')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'image', maxCount: 1 }], {
      limits: { fileSize: config.UPLOAD_MAX_FILE_SIZE },
    }),
  )
  async createDialogueImage(
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files:
      | {
          image?: Express.Multer.File[];
        }
      | undefined,
    @Body() body: any,
  ) {
    if (!config.HIAPI_API_KEY) {
      throw new HttpException(
        '请先在 .env 中配置 HIAPI_API_KEY',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const prompt = normalizePrompt(body.prompt);
    const aspectRatio = normalizeAspectRatio(body.aspectRatio);
    const qualityTier = normalizeQualityTier(body.qualityTier);
    const outputFormat = normalizeOutputFormat(body.outputFormat);
    const outputCompression = normalizeOutputCompression(body.outputCompression);
    const background = normalizeBackground(body.background);
    const moderation = normalizeModeration(body.moderation);
    const count = normalizeImageCount(body.count);
    const chainIdValue = String(body.chainId || '').trim();
    const sourceImageId = String(body.sourceImageId || '').trim();
    const referenceFile = files?.image?.[0];
    const pricing = this.settingsRepo.getPricingSettings();
    const uploadSettings = this.settingsRepo.getUploadSettings();
    const userId = req.user.id;

    if (referenceFile) {
      const maxBytes = uploadSettings.maxFileSizeMb * 1024 * 1024;
      if (!uploadSettings.allowedMimeTypes.includes(referenceFile.mimetype)) {
        throw new HttpException('参考图格式不支持', HttpStatus.BAD_REQUEST);
      }
      if (referenceFile.size > maxBytes) {
        throw new HttpException(
          `参考图超过 ${uploadSettings.maxFileSizeMb}MB 限制`,
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
    }

    if (background === 'transparent' && outputFormat === 'jpeg') {
      throw new HttpException(
        '透明背景仅支持 PNG 或 WEBP 输出',
        HttpStatus.BAD_REQUEST,
      );
    }

    const sourceImage = sourceImageId
      ? this.imagesRepo.findById({ id: sourceImageId, userId })
      : null;
    if (sourceImageId && !sourceImage) {
      throw new HttpException('来源图片不存在', HttpStatus.NOT_FOUND);
    }

    const candidateChainId =
      chainIdValue || String(sourceImage?.continuationChainId || '').trim();
    const historyTurns = candidateChainId
      ? this.dialogueRepo.listByChainAsc({
          chainId: candidateChainId,
          userId,
          limit: 20,
        })
      : [];
    const latestMessage = historyTurns.length
      ? historyTurns[historyTurns.length - 1]
      : null;
    const latestImage = latestMessage?.imageId
      ? this.imagesRepo.findById({ id: latestMessage.imageId, userId })
      : null;
    const chainId = historyTurns.length && candidateChainId
      ? candidateChainId
      : this.dialogueRepo.createChainId();

    const usesImageContext = Boolean(
      historyTurns.length || referenceFile || sourceImage?.imageUrls?.[0],
    );
    const cost =
      costFor(
        req.user.plan === 'pro' ? 'pro' : 'free',
        usesImageContext ? 'image_to_image' : 'text_to_image',
        pricing,
      ) * count;
    const refId = crypto.randomUUID();
    let uploadedReference:
      | {
          fileName: string;
          filePath: string;
          url: string;
        }
      | undefined;
    const lifecycle = createImageJobLifecycle({
      creditsRepo: this.creditsRepo,
      userId,
      cost,
      chargeReason: usesImageContext ? 'image_to_image' : 'text_to_image',
      refundReason: 'dialogue_refund',
      refId,
      refundFailureMessage: 'Refund failed after dialogue error',
      removeFile: removeUploadedFile,
    });

    try {
      lifecycle.charge();

      if (referenceFile) {
        uploadedReference = await saveUploadedBuffer(referenceFile);
        lifecycle.trackTemporaryFile(uploadedReference.filePath);
      }

      const bootstrapImageInputs = historyTurns.length
        ? []
        : [
            ...(uploadedReference
              ? [
                  await filePathToDataUrl(
                    uploadedReference.filePath,
                    referenceFile?.mimetype,
                  ),
                ]
              : []),
            ...(!uploadedReference && sourceImage?.imageUrls?.[0]
              ? [await urlToInputImage(sourceImage.imageUrls[0])]
              : []),
          ].filter(Boolean);
      const continuationImageInputs =
        historyTurns.length && latestImage?.imageUrls?.[0]
          ? [await urlToInputImage(latestImage.imageUrls[0])].filter(Boolean)
          : bootstrapImageInputs;
      const storedInputImageUrls = uploadedReference
        ? [uploadedReference.url]
        : historyTurns.length && latestImage?.imageUrls?.[0]
          ? [latestImage.imageUrls[0]]
          : sourceImage?.imageUrls?.[0]
            ? [sourceImage.imageUrls[0]]
            : [];

      const result = await this.hiapiService.createDialogueImage({
        prompt,
        userId,
        inputImageUrls: bootstrapImageInputs,
        fallbackInputImageUrls: continuationImageInputs,
        historyTurns: historyTurns.map((item) => ({
          prompt: item.prompt,
          inputImageUrls: [],
          outputItems: [],
        })),
        previousResponseId: latestMessage?.responseId || '',
        aspectRatio,
        qualityTier,
        count,
        outputFormat,
        outputCompression,
        background,
        moderation,
      });
      const persistedResults = await persistImageAssetsSafely(
        result.imageUrls,
        mimeForFileName(`result.${outputFormat}`),
      );
      lifecycle.trackResultAssets(
        persistedResults.persisted.map((item) => ({
          filePath: item.filePath,
          created: item.created,
        })),
      );

      const saved = this.sqlite.transaction(() => {
        const created = this.imagesRepo.create({
          userId,
          mode: 'dialogue',
          operationType: usesImageContext ? 'image_to_image' : 'generate',
          prompt,
          aspectRatio,
          generationParams: createGenerationParams({
            qualityTier,
            count,
            outputFormat,
            outputCompression,
            background,
            moderation,
          }),
          content: result.content,
          imageUrls: persistedResults.urls,
          inputImageUrls: storedInputImageUrls,
          sourceImageId: sourceImage?.id || latestMessage?.imageId || '',
          continuationChainId: chainId,
        });
        this.dialogueRepo.createMessage({
          chainId,
          userId,
          imageId: created.id,
          parentImageId: sourceImage?.id || latestMessage?.imageId || '',
          responseId: result.responseId,
          previousResponseId: latestMessage?.responseId || '',
          inputImageUrls: storedInputImageUrls,
          outputItems: result.outputItems || [],
          prompt,
        });
        return created;
      });

      return {
        image: saved,
        chainId,
        messages: this.dialogueRepo
          .listRecentByChain({
            chainId,
            userId,
            limit: 5,
          })
          .map(toPublicDialogueMessage),
      };
    } catch (error: any) {
      await lifecycle.cleanupFailure();
      logError('ImageController', 'Dialogue image generation failed', {
        userId,
        refId,
        chainId,
        error: toErrorDetails(error),
      });
      const status = error.getStatus
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(error.message || '对话创作失败', status);
    }
  }

  @Get(':id')
  async getImage(@Req() req: RequestWithUser, @Param('id') id: string) {
    const image = this.imagesRepo.findById({ id, userId: req.user.id });
    if (!image) {
      throw new HttpException('记录不存在', HttpStatus.NOT_FOUND);
    }
    const nextImage = await this.materializeImageAssets(image, req.user.id);
    const dialogueMessages = nextImage.continuationChainId
      ? this.dialogueRepo.listRecentByChain({
          chainId: nextImage.continuationChainId,
          userId: req.user.id,
          limit: 5,
        })
      : [];
    return {
      image: nextImage,
      dialogueMessages: dialogueMessages.map(toPublicDialogueMessage),
    };
  }

  @Delete(':id')
  async deleteImage(@Req() req: RequestWithUser, @Param('id') id: string) {
    const image = this.imagesRepo.findById({ id, userId: req.user.id });
    if (!image) {
      throw new HttpException('记录不存在', HttpStatus.NOT_FOUND);
    }

    this.sqlite.transaction(() => {
      const changes = this.imagesRepo.deleteById({ id, userId: req.user.id });
      if (changes <= 0) {
        throw new HttpException('记录不存在', HttpStatus.NOT_FOUND);
      }
    });

    const urls = [
      ...(Array.isArray(image.imageUrls) ? image.imageUrls : []),
      ...(Array.isArray(image.inputImageUrls) ? image.inputImageUrls : []),
    ];
    for (const u of urls) {
      const filePath = toUploadFilePath(u);
      if (!filePath) continue;
      try {
        await fsp.unlink(filePath);
      } catch {
        void 0;
      }
    }

    return { ok: true };
  }

  @Delete()
  async clearImages(@Req() req: RequestWithUser) {
    const urls = this.imagesRepo.listAssetUrlsByUser({
      userId: req.user.id,
    });
    const deleted = this.sqlite.transaction(() => {
      return this.imagesRepo.deleteAllByUser({ userId: req.user.id });
    });

    for (const u of urls) {
      const filePath = toUploadFilePath(u);
      if (!filePath) continue;
      try {
        await fsp.unlink(filePath);
      } catch {
        void 0;
      }
    }

    return { ok: true, deleted };
  }

  @Post()
  async createImages(@Req() req: RequestWithUser, @Body() body: any) {
    if (!config.HIAPI_API_KEY) {
      throw new HttpException(
        '请先在 .env 中配置 HIAPI_API_KEY',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const prompt = normalizePrompt(body.prompt);
    const aspectRatio = normalizeAspectRatio(body.aspectRatio);
    const qualityTier = normalizeQualityTier(body.qualityTier);
    const outputFormat = normalizeOutputFormat(body.outputFormat);
    const outputCompression = normalizeOutputCompression(body.outputCompression);
    const background = normalizeBackground(body.background);
    const moderation = normalizeModeration(body.moderation);
    const count = normalizeImageCount(body.count);
    const mode = normalizeCreateMode(body.mode, 'text');
    const pricing = this.settingsRepo.getPricingSettings();

    if (background === 'transparent' && outputFormat === 'jpeg') {
      throw new HttpException(
        '透明背景仅支持 PNG 或 WEBP 输出',
        HttpStatus.BAD_REQUEST,
      );
    }

    const cost =
      costFor(
        req.user.plan === 'pro' ? 'pro' : 'free',
        'text_to_image',
        pricing,
      ) * count;
    const userId = req.user.id;
    const refId = crypto.randomUUID();
    const lifecycle = createImageJobLifecycle({
      creditsRepo: this.creditsRepo,
      userId,
      cost,
      chargeReason: 'text_to_image',
      refundReason: 'text_to_image_refund',
      refId,
      refundFailureMessage: 'Refund failed after text-to-image error',
      removeFile: removeUploadedFile,
    });

    try {
      lifecycle.charge();

      const result = await this.hiapiService.generateImage(prompt, aspectRatio, {
        qualityTier,
        count,
        outputFormat,
        outputCompression,
        background,
        moderation,
      });
      const persistedResults = await persistImageAssetsSafely(
        result.imageUrls,
        mimeForFileName(`result.${outputFormat}`),
      );
      lifecycle.trackResultAssets(
        persistedResults.persisted.map((item) => ({
          filePath: item.filePath,
          created: item.created,
        })),
      );
      const image = this.sqlite.transaction(() => {
        return this.imagesRepo.create({
          userId,
          mode,
          prompt,
          aspectRatio,
          generationParams: createGenerationParams({
            qualityTier,
            count,
            outputFormat,
            outputCompression,
            background,
            moderation,
          }),
          content: result.content,
          imageUrls: persistedResults.urls,
        });
      });
      return { image };
    } catch (error: any) {
      await lifecycle.cleanupFailure();
      logError('ImageController', 'Text-to-image failed', {
        userId,
        refId,
        prompt,
        aspectRatio,
        mode,
        error: toErrorDetails(error),
      });
      const status = error.getStatus
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(error.message || '生图请求失败', status);
    }
  }

  @Post('from-image')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 4 },
        { name: 'image', maxCount: 1 },
      ],
      {
        limits: { fileSize: config.UPLOAD_MAX_FILE_SIZE },
      },
    ),
  )
  async createImagesFromImage(
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files:
      | {
          images?: Express.Multer.File[];
          image?: Express.Multer.File[];
        }
      | undefined,
    @Body() body: any,
  ) {
    if (!config.HIAPI_API_KEY) {
      throw new HttpException(
        '请先在 .env 中配置 HIAPI_API_KEY',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const prompt = normalizePrompt(body.prompt);
    const aspectRatio = normalizeAspectRatio(body.aspectRatio);
    const qualityTier = normalizeQualityTier(body.qualityTier);
    const outputFormat = normalizeOutputFormat(body.outputFormat);
    const outputCompression = normalizeOutputCompression(body.outputCompression);
    const background = normalizeBackground(body.background);
    const moderation = normalizeModeration(body.moderation);
    const count = normalizeImageCount(body.count);
    const mode = normalizeCreateMode(body.mode, 'image');
    const pricing = this.settingsRepo.getPricingSettings();
    const uploadSettings = this.settingsRepo.getUploadSettings();
    const referenceFiles = [
      ...(files?.images || []),
      ...(files?.image || []),
    ].slice(0, 4);

    if (!referenceFiles.length) {
      throw new HttpException('请上传参考图', HttpStatus.BAD_REQUEST);
    }

    if (background === 'transparent' && outputFormat === 'jpeg') {
      throw new HttpException(
        '透明背景仅支持 PNG 或 WEBP 输出',
        HttpStatus.BAD_REQUEST,
      );
    }

    const maxBytes = uploadSettings.maxFileSizeMb * 1024 * 1024;
    for (const [index, file] of referenceFiles.entries()) {
      if (!uploadSettings.allowedMimeTypes.includes(file.mimetype)) {
        throw new HttpException(
          `第 ${index + 1} 张参考图格式不支持`,
          HttpStatus.BAD_REQUEST,
        );
      }
      if (file.size > maxBytes) {
        throw new HttpException(
          `第 ${index + 1} 张参考图超过 ${uploadSettings.maxFileSizeMb}MB 限制`,
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
    }

    const cost =
      costFor(
        req.user.plan === 'pro' ? 'pro' : 'free',
        'image_to_image',
        pricing,
      ) * count;
    const userId = req.user.id;
    const refId = crypto.randomUUID();
    const uploaded: Array<{
      fileName: string;
      filePath: string;
      url: string;
      fileType: string;
    }> = [];
    const lifecycle = createImageJobLifecycle({
      creditsRepo: this.creditsRepo,
      userId,
      cost,
      chargeReason: 'image_to_image',
      refundReason: 'image_to_image_refund',
      refId,
      refundFailureMessage: 'Refund failed after image-to-image error',
      removeFile: removeUploadedFile,
    });

    try {
      lifecycle.charge();

      for (const file of referenceFiles) {
        const saved = await saveUploadedBuffer(file);
        uploaded.push({
          ...saved,
          fileType: file.mimetype,
        });
        lifecycle.trackTemporaryFile(saved.filePath);
      }

      const result = await this.hiapiService.editImageFromFiles({
        imageFiles: uploaded.map((item) => ({
          filePath: item.filePath,
          fileType: item.fileType,
          fileName: item.fileName,
        })),
        prompt,
        aspectRatio,
        qualityTier,
        count,
        outputFormat,
        outputCompression,
        background,
        moderation,
      });
      const persistedResults = await persistImageAssetsSafely(
        result.imageUrls,
        mimeForFileName(`result.${outputFormat}`),
      );
      lifecycle.trackResultAssets(
        persistedResults.persisted.map((item) => ({
          filePath: item.filePath,
          created: item.created,
        })),
      );

      const image = {
        userId,
        mode,
        prompt,
        aspectRatio,
        generationParams: createGenerationParams({
          qualityTier,
          count,
          outputFormat,
          outputCompression,
          background,
          moderation,
        }),
        content: result.content,
        imageUrls: persistedResults.urls,
        inputImageUrls: uploaded.map((item) => item.url),
        operationType: 'image_to_image' as const,
      };
      const saved = this.sqlite.transaction(() => {
        return this.imagesRepo.create(image);
      });
      return { image: saved };
    } catch (error: any) {
      await lifecycle.cleanupFailure();
      logError('ImageController', 'Image-to-image failed', {
        userId,
        refId,
        prompt,
        aspectRatio,
        imageCount: uploaded.length,
        error: toErrorDetails(error),
      });
      const status = error.getStatus
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(error.message || '生图请求失败', status);
    }
  }

  @Post('edit')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'mask', maxCount: 1 },
      ],
      {
        limits: { fileSize: config.UPLOAD_MAX_FILE_SIZE },
      },
    ),
  )
  async editImage(
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files:
      | {
          image?: Express.Multer.File[];
          mask?: Express.Multer.File[];
        }
      | undefined,
    @Body() body: any,
  ) {
    if (!config.HIAPI_API_KEY) {
      throw new HttpException(
        '请先在 .env 中配置 HIAPI_API_KEY',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const imageFile = files?.image?.[0];
    const maskFile = files?.mask?.[0];
    const prompt = normalizePrompt(body.prompt);
    const aspectRatio = normalizeAspectRatio(body.aspectRatio);
    const size = normalizeImageSize(body.size);
    const quality = normalizeImageQuality(body.quality);
    const operationType = normalizeOperationType(body.operationType);
    const sourceImageId = String(body.sourceImageId || '').trim();
    const sourceImageUrl = normalizeSourceImageUrl(body.sourceImageUrl);
    const pricing = this.settingsRepo.getPricingSettings();
    const uploadSettings = this.settingsRepo.getUploadSettings();
    const modelSettings = this.settingsRepo.getModelSettings();

    if (!imageFile) {
      throw new HttpException('请上传待编辑图片', HttpStatus.BAD_REQUEST);
    }
    if (operationType === 'inpaint' && !maskFile) {
      throw new HttpException('请上传蒙版', HttpStatus.BAD_REQUEST);
    }

    for (const current of [imageFile, maskFile].filter(Boolean) as Express.Multer.File[]) {
      if (!uploadSettings.allowedMimeTypes.includes(current.mimetype)) {
        throw new HttpException('不支持的图片格式', HttpStatus.BAD_REQUEST);
      }
      const maxBytes = uploadSettings.maxFileSizeMb * 1024 * 1024;
      if (current.size > maxBytes) {
        throw new HttpException(
          `上传内容过大，请控制在 ${uploadSettings.maxFileSizeMb}MB 以内`,
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
    }

    const finalPrompt = promptForOperation(operationType, prompt);

    let sourceImage: any = null;
    if (sourceImageId) {
      sourceImage = this.imagesRepo.findById({ id: sourceImageId, userId: req.user.id });
      if (!sourceImage) {
        throw new HttpException('来源图片不存在', HttpStatus.NOT_FOUND);
      }
    }

    const cost = costFor(
      req.user.plan === 'pro' ? 'pro' : 'free',
      'image_to_image',
      pricing,
    );
    const userId = req.user.id;
    const refId = crypto.randomUUID();
    let uploadedImage:
      | {
          fileName: string;
          filePath: string;
          url: string;
        }
      | undefined;
    let uploadedMask:
      | {
          fileName: string;
          filePath: string;
          url: string;
        }
      | undefined;
    const lifecycle = createImageJobLifecycle({
      creditsRepo: this.creditsRepo,
      userId,
      cost,
      chargeReason: operationType,
      refundReason: `${operationType}_refund`,
      refId,
      refundFailureMessage: 'Refund failed after image edit error',
      refundFailureMeta: { operationType },
      removeFile: removeUploadedFile,
    });

    try {
      lifecycle.charge();

      uploadedImage = await saveUploadedBuffer(imageFile);
      lifecycle.trackTemporaryFile(uploadedImage.filePath);
      if (maskFile) {
        uploadedMask = await saveUploadedBuffer(maskFile);
        lifecycle.trackTemporaryFile(uploadedMask.filePath);
      }

      const result = await this.hiapiService.editImageFromFiles({
        imageFiles: [
          {
            filePath: uploadedImage.filePath,
            fileType: imageFile.mimetype,
            fileName: uploadedImage.fileName,
          },
        ],
        maskFilePath: uploadedMask?.filePath,
        maskFileType: maskFile?.mimetype,
        maskFileName: uploadedMask?.fileName,
        prompt: finalPrompt,
        aspectRatio,
        size,
        quality,
        ...(operationType === 'cutout'
          ? {
              modelOverride:
                modelSettings.cutoutModel || modelSettings.imageModel,
              outputFormat: 'png' as const,
              background: 'transparent' as const,
            }
          : operationType === 'upscale'
            ? {
                qualityTier: '4k' as const,
                quality: 'high' as const,
              }
          : {}),
      });
      const persistedResults = await persistImageAssetsSafely(
        result.imageUrls,
        mimeForFileName('result.png'),
      );
      lifecycle.trackResultAssets(
        persistedResults.persisted.map((item) => ({
          filePath: item.filePath,
          created: item.created,
        })),
      );

      const inputUrl =
        sourceImage?.imageUrls?.[0] ||
        sourceImageUrl ||
        uploadedImage.url;
      const keepUploadedSource = !sourceImage?.imageUrls?.[0] && !sourceImageUrl;

      const saved = this.sqlite.transaction(() => {
        const mode = modeForOperationType(operationType);
        return this.imagesRepo.create({
          userId,
          mode,
          operationType,
          prompt,
          aspectRatio,
          generationParams: createGenerationParams({
            qualityTier: operationType === 'upscale' ? '4k' : undefined,
            size,
            quality: operationType === 'upscale' ? 'high' : quality,
            operationType,
            outputFormat: operationType === 'cutout' ? 'png' : undefined,
            background: operationType === 'cutout' ? 'transparent' : undefined,
          }),
          content: result.content,
          imageUrls: persistedResults.urls,
          inputImageUrls: inputUrl ? [inputUrl] : [],
          sourceImageId: sourceImage?.id || '',
        });
      });
      if (!keepUploadedSource) {
        await removeUploadedFile(uploadedImage.filePath);
      }
      await removeUploadedFile(uploadedMask?.filePath || '');
      return { image: saved };
    } catch (error: any) {
      await lifecycle.cleanupFailure();
      logError('ImageController', 'Image edit failed', {
        userId,
        refId,
        operationType,
        prompt,
        error: toErrorDetails(error),
      });
      const message = String(error?.message || '').trim();
      if (
        operationType === 'cutout' &&
        (
          message.includes('transparent') ||
          message.includes('背景') ||
          message.includes('Upstream request failed')
        )
      ) {
        throw new HttpException(
          '当前抠图模型不支持透明背景编辑，或上游未开通该模型。请在后台模型设置中单独配置 `cutoutModel`，并填写支持透明背景编辑的模型后重试。',
          HttpStatus.BAD_REQUEST,
        );
      }
      const status = error.getStatus
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(message || '编辑失败', status);
    }
  }
}
