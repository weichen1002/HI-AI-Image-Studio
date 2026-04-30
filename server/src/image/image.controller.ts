import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Req,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Param,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { HiapiService } from '../hiapi/hiapi.service';
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

function normalizeLimit(value: string | undefined) {
  const limit = Number(value || 12);
  if (!Number.isFinite(limit)) return 12;
  return Math.max(1, Math.min(50, Math.floor(limit)));
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

function toListImage(image: any) {
  return {
    ...image,
    mode: image.mode || 'text',
    imageUrls: (image.imageUrls || []).filter(Boolean).slice(0, 1),
    inputImageUrls: (image.inputImageUrls || []).filter(Boolean).slice(0, 1),
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

function toUploadFilePath(url: string) {
  const val = String(url || '');
  if (!val.startsWith('/uploads/')) return '';
  const fileName = path.basename(val);
  if (!fileName) return '';
  return path.join(uploadDir(), fileName);
}

@Controller('api/images')
@UseGuards(AuthGuard)
export class ImageController {
  constructor(
    private readonly imagesRepo: ImagesRepo,
    private readonly hiapiService: HiapiService,
    private readonly creditsRepo: CreditsRepo,
    private readonly sqlite: SqliteService,
  ) {}

  @Get()
  getImages(@Req() req: RequestWithUser, @Query('limit') limitValue?: string) {
    const limit = normalizeLimit(limitValue);
    const images = this.imagesRepo
      .listByUser({ userId: req.user.id, limit })
      .map(toListImage);
    return { images };
  }

  @Get(':id')
  getImage(@Req() req: RequestWithUser, @Param('id') id: string) {
    const image = this.imagesRepo.findById({ id, userId: req.user.id });
    if (!image) {
      throw new HttpException('记录不存在', HttpStatus.NOT_FOUND);
    }
    return { image: { ...image, mode: image.mode || 'text' } };
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

    const urls = Array.isArray(image.inputImageUrls)
      ? image.inputImageUrls
      : [];
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
    const urls = this.imagesRepo.listInputImageUrlsByUser({
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

    try {
      const result = await this.hiapiService.generateImage(prompt, aspectRatio);
      const cost = costFor(
        req.user.plan === 'pro' ? 'pro' : 'free',
        'text_to_image',
      );
      const image = this.sqlite.transaction(() => {
        const created = this.imagesRepo.create({
          userId: req.user.id,
          mode: 'text',
          prompt,
          aspectRatio,
          content: result.content,
          imageUrls: result.imageUrls,
        });
        this.creditsRepo.chargeInTx({
          userId: req.user.id,
          cost,
          reason: 'text_to_image',
          refType: 'image',
          refId: created.id,
        });
        return created;
      });
      return { image };
    } catch (error: any) {
      console.error(error);
      const status = error.getStatus
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(error.message || '生图请求失败', status);
    }
  }

  @Post('from-image')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        cb(null, true);
      },
    }),
  )
  async createImagesFromImage(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File | undefined,
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

    if (!file) {
      throw new HttpException('请上传参考图', HttpStatus.BAD_REQUEST);
    }

    const ext = extForMime(file.mimetype);
    if (!ext) {
      throw new HttpException('不支持的图片格式', HttpStatus.BAD_REQUEST);
    }

    const fileName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadDir(), fileName);
    const inputUrl = `/uploads/${fileName}`;

    try {
      await fsp.writeFile(filePath, file.buffer);

      const result = await this.hiapiService.editImageFromFile({
        filePath,
        fileType: file.mimetype,
        fileName,
        prompt,
        aspectRatio,
      });

      const image = {
        userId: req.user.id,
        mode: 'image' as const,
        prompt,
        aspectRatio,
        content: result.content,
        imageUrls: result.imageUrls,
        inputImageUrls: [inputUrl],
      };
      const cost = costFor(
        req.user.plan === 'pro' ? 'pro' : 'free',
        'image_to_image',
      );
      const saved = this.sqlite.transaction(() => {
        const created = this.imagesRepo.create(image);
        this.creditsRepo.chargeInTx({
          userId: req.user.id,
          cost,
          reason: 'image_to_image',
          refType: 'image',
          refId: created.id,
        });
        return created;
      });
      return { image: saved };
    } catch (error: any) {
      try {
        await fsp.unlink(filePath);
      } catch {
        void 0;
      }
      console.error(error);
      const status = error.getStatus
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(error.message || '生图请求失败', status);
    }
  }
}
