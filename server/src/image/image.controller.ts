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
import { ImageJobsRepo, type ImageJobEntity, type ImageJobStatus } from '../db/repositories/image-jobs.repo';
import { SqliteService } from '../db/sqlite.service';
import { SystemSettingsRepo } from '../db/repositories/system-settings.repo';
import { DialogueRepo } from '../db/repositories/dialogue.repo';
import { ImageFeedbackRepo, type ImageFeedbackRating } from '../db/repositories/image-feedback.repo';
import type { ImageMode, ImageOperationType } from '../db/repositories/images.repo';
import { logError, logInfo, toErrorDetails } from '../logging/logger';
import { TextToImageWorkflow } from './text-to-image-workflow';
import { ImageToImageWorkflow } from './image-to-image-workflow';
import { ImageEditWorkflow } from './image-edit-workflow';
import { DialogueImageWorkflow } from './dialogue-image-workflow';
import { ImageJobQueueService } from './image-job-queue.service';
import {
  assertEditRequestSupported,
  assertGenerationRequestSupported,
  getModelCapabilities,
} from '../hiapi/model-capabilities';

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

function normalizeJobStatuses(value: string | undefined): ImageJobStatus[] {
  const allowed = new Set(['queued', 'running', 'succeeded', 'failed', 'cancelled']);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is ImageJobStatus => allowed.has(item));
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

function normalizeDateFilterValue(value: string | undefined, endOfDay = false) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

function normalizeBooleanQuery(value: string | undefined) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
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

function normalizeImageIds(value: any) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)))
    : [];
}

function normalizeFeedbackRating(value: any): ImageFeedbackRating {
  const rating = String(value || 'none').trim();
  if (rating === 'like' || rating === 'dislike') return rating;
  return 'none';
}

function normalizeFeedbackIssueType(value: any) {
  const issueType = String(value || '').trim();
  if (
    issueType === 'bad_quality' ||
    issueType === 'wrong_subject' ||
    issueType === 'bad_text' ||
    issueType === 'composition' ||
    issueType === 'unsafe' ||
    issueType === 'other'
  ) {
    return issueType;
  }
  return '';
}

function normalizeFeedbackNote(value: any) {
  return String(value || '').trim().slice(0, 500);
}

function toListImage(image: any) {
  return {
    ...image,
    mode: image.mode || 'text',
    imageUrls: (image.imageUrls || []).filter(Boolean),
    inputImageUrls: (image.inputImageUrls || []).filter(Boolean),
    previewImageUrls: (image.previewImageUrls || []).filter(Boolean),
    generationParams:
      image.generationParams && typeof image.generationParams === 'object'
        ? image.generationParams
        : {},
    folder: String(image.folder || ''),
    tags: Array.isArray(image.tags) ? image.tags.filter(Boolean) : [],
    favoriteAt: String(image.favoriteAt || ''),
    isFavorite: Boolean(image.isFavorite || image.favoriteAt),
    continuationChainId: image.continuationChainId || '',
  };
}

function toPublicDialogueMessage(message: any) {
  return {
    id: String(message?.id || ''),
    imageId: String(message?.imageId || ''),
    prompt: String(message?.prompt || ''),
    createdAt: String(message?.createdAt || ''),
  };
}

function toPublicDialogueChain(chain: any) {
  const firstImage = toListImage(chain?.firstImage || {});
  const lastImage = toListImage(chain?.lastImage || {});
  return {
    chainId: String(chain?.chainId || ''),
    title: String(chain?.title || lastImage.prompt || '对话创作'),
    firstImage,
    lastImage,
    roundCount: Math.max(1, Math.floor(Number(chain?.roundCount || 1))),
    updatedAt: String(chain?.updatedAt || lastImage.createdAt || firstImage.createdAt || ''),
    coverUrl:
      lastImage.imageUrls?.[0] ||
      lastImage.previewImageUrls?.[0] ||
      firstImage.imageUrls?.[0] ||
      firstImage.previewImageUrls?.[0] ||
      '',
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

@Controller('api/images')
@UseGuards(AuthGuard)
export class ImageController {
  constructor(
    private readonly imagesRepo: ImagesRepo,
    private readonly imageJobsRepo: ImageJobsRepo,
    private readonly dialogueRepo: DialogueRepo,
    private readonly imageFeedbackRepo: ImageFeedbackRepo,
    private readonly sqlite: SqliteService,
    private readonly settingsRepo: SystemSettingsRepo,
    private readonly textToImageWorkflow: TextToImageWorkflow,
    private readonly imageToImageWorkflow: ImageToImageWorkflow,
    private readonly imageEditWorkflow: ImageEditWorkflow,
    private readonly dialogueImageWorkflow: DialogueImageWorkflow,
    private readonly imageJobQueue: ImageJobQueueService,
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

  private createQueuedJob(params: {
    userId: string;
    mode: ImageMode;
    operationType: ImageOperationType;
    prompt: string;
    payload?: Record<string, any>;
  }) {
    return this.imageJobsRepo.create({
      userId: params.userId,
      mode: params.mode,
      operationType: params.operationType,
      prompt: params.prompt,
      status: 'queued',
      payload: params.payload,
    });
  }

  private enqueueJob(job: { id: string }, run?: () => Promise<unknown>) {
    this.imageJobQueue.enqueue({
      jobId: job.id,
      run: run || (() => this.runPersistedJob(job.id)),
    });
    return { job };
  }

  private async runPersistedJob(jobId: string) {
    const job = this.imageJobsRepo.findById(jobId);
    if (!job) throw new Error('image job not found');
    const payload = job.payload || {};
    const user = {
      id: job.userId,
      plan: payload.userPlan === 'pro' ? 'pro' : 'free',
      role: 'user',
    } as RequestWithUser['user'];

    if (payload.kind === 'text-to-image') {
      return this.textToImageWorkflow.run({
        user,
        prompt: job.prompt,
        aspectRatio: payload.aspectRatio || '1:1',
        mode: job.mode,
        qualityTier: payload.qualityTier || '1k',
        count: payload.count || 1,
        outputFormat: payload.outputFormat || 'png',
        outputCompression: payload.outputCompression ?? 100,
        background: payload.background || 'auto',
        moderation: payload.moderation || 'auto',
        jobId: job.id,
      });
    }

    throw new HttpException(
      '该任务缺少可重放参数，请回到工作台重新提交',
      HttpStatus.BAD_REQUEST,
    );
  }

  private enqueueRetryJob(job: ImageJobEntity) {
    return this.enqueueJob(job);
  }

  private async toPublicJob(job: any, userId: string) {
    const image = job?.imageId
      ? await this.getImageForJob(job.imageId, userId)
      : null;
    const dialogueMessages = image?.continuationChainId
      ? this.dialogueRepo.listRecentByChain({
          chainId: image.continuationChainId,
          userId,
          limit: 5,
        }).map(toPublicDialogueMessage)
      : [];
    return {
      job,
      image,
      chainId: image?.continuationChainId || '',
      dialogueMessages,
    };
  }

  private async getImageForJob(imageId: string, userId: string) {
    const image = this.imagesRepo.findById({ id: imageId, userId });
    if (!image) return null;
    return this.materializeImageAssets(image, userId);
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
    @Query('favorite') favoriteValue?: string,
    @Query('ratio') ratioValue?: string,
    @Query('quality') qualityValue?: string,
    @Query('hasReference') hasReferenceValue?: string,
    @Query('inStyleBoard') inStyleBoardValue?: string,
    @Query('dateFrom') dateFromValue?: string,
    @Query('dateTo') dateToValue?: string,
  ) {
    const limit = normalizeLimit(limitValue);
    const offset = normalizeOffset(offsetValue);
    const mode = normalizeImageModeFilter(modeValue);
    const q = normalizeSearchQuery(qValue);
    const folder = normalizeAssetFilterValue(folderValue);
    const tag = normalizeAssetFilterValue(tagValue);
    const favorite = normalizeBooleanQuery(favoriteValue);
    const aspectRatio = normalizeAssetFilterValue(ratioValue);
    const qualityTier = normalizeAssetFilterValue(qualityValue);
    const hasReference = normalizeBooleanQuery(hasReferenceValue);
    const inStyleBoard = normalizeBooleanQuery(inStyleBoardValue);
    const dateFrom = normalizeDateFilterValue(dateFromValue);
    const dateTo = normalizeDateFilterValue(dateToValue, true);
    const page = this.imagesRepo.listByUserPaged({
      userId: req.user.id,
      limit,
      offset,
      mode,
      q,
      folder,
      tag,
      favorite,
      aspectRatio,
      qualityTier,
      hasReference,
      inStyleBoard,
      dateFrom,
      dateTo,
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

  @Get('dialogue/chains')
  getDialogueChains(
    @Req() req: RequestWithUser,
    @Query('limit') limitValue?: string,
  ) {
    const limit = normalizeLimit(limitValue);
    return {
      chains: this.imagesRepo
        .listDialogueChains({ userId: req.user.id, limit })
        .map(toPublicDialogueChain),
      limit,
    };
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

  @Get('jobs')
  async listJobs(
    @Req() req: RequestWithUser,
    @Query('status') statusValue?: string,
    @Query('limit') limitValue?: string,
    @Query('offset') offsetValue?: string,
  ) {
    const page = this.imageJobsRepo.listByUserPaged({
      userId: req.user.id,
      statuses: normalizeJobStatuses(statusValue),
      limit: normalizeLimit(limitValue),
      offset: normalizeOffset(offsetValue),
    });
    return {
      jobs: await Promise.all(
        page.jobs.map((job) => this.toPublicJob(job, req.user.id)),
      ),
      total: page.total,
      stats: this.imageJobsRepo.getStatsByUser({ userId: req.user.id }),
      queue: this.imageJobQueue.getStats(),
    };
  }

  @Get('jobs/stats')
  getJobStats(@Req() req: RequestWithUser) {
    return {
      stats: this.imageJobsRepo.getStatsByUser({ userId: req.user.id }),
      queue: this.imageJobQueue.getStats(),
    };
  }

  @Get('jobs/:id')
  async getJob(@Req() req: RequestWithUser, @Param('id') id: string) {
    const job = this.imageJobsRepo.findByIdForUser({
      id: String(id || '').trim(),
      userId: req.user.id,
    });
    if (!job) {
      throw new HttpException('任务不存在', HttpStatus.NOT_FOUND);
    }
    return this.toPublicJob(job, req.user.id);
  }

  @Post('jobs/:id/cancel')
  async cancelJob(@Req() req: RequestWithUser, @Param('id') id: string) {
    const normalizedId = String(id || '').trim();
    const existing = this.imageJobsRepo.findByIdForUser({
      id: normalizedId,
      userId: req.user.id,
    });
    if (!existing) {
      throw new HttpException('任务不存在', HttpStatus.NOT_FOUND);
    }
    if (existing.status !== 'queued') {
      throw new HttpException('只能取消排队中的任务', HttpStatus.BAD_REQUEST);
    }
    const job = this.imageJobsRepo.cancelQueued({
      id: normalizedId,
      userId: req.user.id,
    });
    if (!job) {
      throw new HttpException('任务状态已变化，请刷新后重试', HttpStatus.CONFLICT);
    }
    this.imageJobQueue.cancelQueued(job.id);
    logInfo('ImageController', 'Image job cancellation accepted', {
      correlationId: `job:${job.id}`,
      jobId: job.id,
      userId: req.user.id,
      mode: job.mode,
      operationType: job.operationType,
    });
    return this.toPublicJob(job, req.user.id);
  }

  @Post('jobs/:id/retry')
  async retryJob(@Req() req: RequestWithUser, @Param('id') id: string) {
    const normalizedId = String(id || '').trim();
    const existing = this.imageJobsRepo.findByIdForUser({
      id: normalizedId,
      userId: req.user.id,
    });
    if (!existing) {
      throw new HttpException('任务不存在', HttpStatus.NOT_FOUND);
    }
    if (existing.status !== 'failed') {
      throw new HttpException('只能重试失败任务', HttpStatus.BAD_REQUEST);
    }
    if (existing.payload?.retryable !== true) {
      throw new HttpException(
        '该任务缺少可重放参数，请回到工作台重新提交',
        HttpStatus.BAD_REQUEST,
      );
    }
    const job = this.imageJobsRepo.requeueFailed({
      id: normalizedId,
      userId: req.user.id,
    });
    if (!job) {
      throw new HttpException('任务状态已变化，请刷新后重试', HttpStatus.CONFLICT);
    }
    logInfo('ImageController', 'Image job retry queued', {
      correlationId: `job:${job.id}`,
      jobId: job.id,
      userId: req.user.id,
      mode: job.mode,
      operationType: job.operationType,
    });
    this.enqueueRetryJob(job);
    return this.toPublicJob(job, req.user.id);
  }

  @Delete('jobs/completed')
  clearCompletedJobs(@Req() req: RequestWithUser) {
    const deleted = this.imageJobsRepo.deleteCompletedByUser({
      userId: req.user.id,
    });
    return { deleted };
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

  @Put(':id/favorite')
  updateImageFavorite(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const image = this.imagesRepo.findById({ id, userId: req.user.id });
    if (!image) {
      throw new HttpException('记录不存在', HttpStatus.NOT_FOUND);
    }

    const favorite = Boolean(body?.favorite);
    this.imagesRepo.updateFavorite({
      id,
      userId: req.user.id,
      favorite,
    });
    const nextImage = this.imagesRepo.findById({ id, userId: req.user.id });
    return {
      image: toListImage(nextImage || image),
    };
  }

  @Post('favorites/import')
  importImageFavorites(@Req() req: RequestWithUser, @Body() body: any) {
    const ids = normalizeImageIds(body?.imageIds || body?.ids);
    const imported = this.imagesRepo.markFavorites({
      ids,
      userId: req.user.id,
      favorite: true,
    });
    return { imported };
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
    const uploadSettings = this.settingsRepo.getUploadSettings();
    const capabilities = getModelCapabilities(this.settingsRepo.getModelSettings());

    assertGenerationRequestSupported(capabilities, {
      mode: 'dialogue',
      aspectRatio,
      qualityTier,
      count,
      outputFormat,
      background,
      moderation,
    });

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

    const job = this.createQueuedJob({
      userId: req.user.id,
      mode: 'dialogue',
      operationType:
        chainIdValue || sourceImageId || referenceFile ? 'image_to_image' : 'generate',
      prompt,
    });
    return this.enqueueJob(job, () =>
      this.dialogueImageWorkflow.run({
        user: req.user,
        prompt,
        aspectRatio,
        qualityTier,
        count,
        outputFormat,
        outputCompression,
        background,
        moderation,
        chainIdValue,
        sourceImageId,
        referenceFile,
        jobId: job.id,
      }),
    );
  }

  @Get(':id')
  async getImage(@Req() req: RequestWithUser, @Param('id') id: string) {
    const image = this.imagesRepo.findById({ id, userId: req.user.id });
    if (!image) {
      throw new HttpException('记录不存在', HttpStatus.NOT_FOUND);
    }
    const nextImage = await this.materializeImageAssets(image, req.user.id);
    const sourceImage = nextImage.sourceImageId
      ? this.imagesRepo.findById({ id: nextImage.sourceImageId, userId: req.user.id })
      : null;
    const variants = await Promise.all(
      this.imagesRepo
        .listVariantsForImage({ id: nextImage.id, userId: req.user.id, limit: 8 })
        .map((item) => this.materializeImageAssets(item, req.user.id)),
    );
    const dialogueMessages = nextImage.continuationChainId
      ? this.dialogueRepo.listRecentByChain({
          chainId: nextImage.continuationChainId,
          userId: req.user.id,
          limit: 5,
        })
      : [];
    return {
      image: {
        ...nextImage,
        feedback: this.imageFeedbackRepo.findByImage({
          imageId: nextImage.id,
          userId: req.user.id,
        }),
      },
      sourceImage: sourceImage ? await this.materializeImageAssets(sourceImage, req.user.id) : null,
      variants,
      dialogueMessages: dialogueMessages.map(toPublicDialogueMessage),
    };
  }

  @Put(':id/feedback')
  updateImageFeedback(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const image = this.imagesRepo.findById({ id, userId: req.user.id });
    if (!image) {
      throw new HttpException('记录不存在', HttpStatus.NOT_FOUND);
    }

    const rating = normalizeFeedbackRating(body?.rating);
    const issueType = normalizeFeedbackIssueType(body?.issueType);
    const note = normalizeFeedbackNote(body?.note);

    if (rating === 'none' && !issueType && !note) {
      this.imageFeedbackRepo.deleteByImage({
        imageId: image.id,
        userId: req.user.id,
      });
      return { feedback: null };
    }

    return {
      feedback: this.imageFeedbackRepo.upsert({
        imageId: image.id,
        userId: req.user.id,
        rating,
        issueType,
        note,
      }),
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
      this.imageFeedbackRepo.deleteByImage({ imageId: id, userId: req.user.id });
    });

    const urls = [
      ...(Array.isArray(image.imageUrls) ? image.imageUrls : []),
      ...(Array.isArray(image.inputImageUrls) ? image.inputImageUrls : []),
      ...(Array.isArray(image.previewImageUrls) ? image.previewImageUrls : []),
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
      const changes = this.imagesRepo.deleteAllByUser({ userId: req.user.id });
      this.imageFeedbackRepo.deleteAllByUser({ userId: req.user.id });
      return changes;
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
    const capabilities = getModelCapabilities(this.settingsRepo.getModelSettings());

    assertGenerationRequestSupported(capabilities, {
      mode: 'text',
      aspectRatio,
      qualityTier,
      count,
      outputFormat,
      background,
      moderation,
    });

    const job = this.createQueuedJob({
      userId: req.user.id,
      mode,
      operationType: 'generate',
      prompt,
      payload: {
        kind: 'text-to-image',
        retryable: true,
        userPlan: req.user.plan === 'pro' ? 'pro' : 'free',
        aspectRatio,
        qualityTier,
        count,
        outputFormat,
        outputCompression,
        background,
        moderation,
      },
    });
    return this.enqueueJob(job, () =>
      this.textToImageWorkflow.run({
        user: req.user,
        prompt,
        aspectRatio,
        mode,
        qualityTier,
        count,
        outputFormat,
        outputCompression,
        background,
        moderation,
        jobId: job.id,
      }),
    );
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
    const uploadSettings = this.settingsRepo.getUploadSettings();
    const referenceFiles = [
      ...(files?.images || []),
      ...(files?.image || []),
    ].slice(0, 4);
    const capabilities = getModelCapabilities(this.settingsRepo.getModelSettings());

    if (!referenceFiles.length) {
      throw new HttpException('请上传参考图', HttpStatus.BAD_REQUEST);
    }

    assertGenerationRequestSupported(capabilities, {
      mode: 'image',
      aspectRatio,
      qualityTier,
      count,
      outputFormat,
      background,
      moderation,
    });

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

    const job = this.createQueuedJob({
      userId: req.user.id,
      mode,
      operationType: 'image_to_image',
      prompt,
    });
    return this.enqueueJob(job, () =>
      this.imageToImageWorkflow.run({
        user: req.user,
        referenceFiles,
        prompt,
        aspectRatio,
        mode,
        qualityTier,
        count,
        outputFormat,
        outputCompression,
        background,
        moderation,
        jobId: job.id,
      }),
    );
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
    const uploadSettings = this.settingsRepo.getUploadSettings();
    const capabilities = getModelCapabilities(this.settingsRepo.getModelSettings());

    assertEditRequestSupported(capabilities, {
      operationType,
      size,
      quality,
    });

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

    const mode = modeForOperationType(operationType);

    const job = this.createQueuedJob({
      userId: req.user.id,
      mode,
      operationType,
      prompt,
    });
    return this.enqueueJob(job, () =>
      this.imageEditWorkflow.run({
        user: req.user,
        imageFile,
        maskFile,
        prompt,
        finalPrompt,
        aspectRatio,
        size,
        quality,
        mode,
        operationType,
        sourceImage,
        sourceImageUrl,
        jobId: job.id,
      }),
    );
  }
}
