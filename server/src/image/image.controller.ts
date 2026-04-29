import {
  Controller,
  Get,
  Post,
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
import { DbService } from '../db/db.service';
import { HiapiService } from '../hiapi/hiapi.service';
import { normalizeAspectRatio } from '../utils';
import { config } from '../config';
import * as crypto from 'crypto';
import type { Express } from 'express';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

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
    imageUrls: image.imageUrls.filter(Boolean).slice(0, 1),
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

@Controller('api/images')
@UseGuards(AuthGuard)
export class ImageController {
  constructor(
    private readonly dbService: DbService,
    private readonly hiapiService: HiapiService,
  ) {}

  @Get()
  getImages(@Req() req: RequestWithUser, @Query('limit') limitValue?: string) {
    const limit = normalizeLimit(limitValue);
    const db = this.dbService.readDb();
    const images = db.images
      .filter((image) => image.userId === req.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(toListImage);
    return { images };
  }

  @Get(':id')
  getImage(@Req() req: RequestWithUser, @Param('id') id: string) {
    const db = this.dbService.readDb();
    const image = db.images.find(
      (item) => item.id === id && item.userId === req.user.id,
    );
    if (!image) {
      throw new HttpException('记录不存在', HttpStatus.NOT_FOUND);
    }
    return { image: { ...image, mode: image.mode || 'text' } };
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
      const image = {
        id: crypto.randomUUID(),
        userId: req.user.id,
        mode: 'text' as const,
        prompt,
        aspectRatio,
        content: result.content,
        imageUrls: result.imageUrls,
        createdAt: new Date().toISOString(),
      };

      const db = this.dbService.readDb();
      db.images.push(image);
      this.dbService.writeDb(db);
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
        id: crypto.randomUUID(),
        userId: req.user.id,
        mode: 'image' as const,
        prompt,
        aspectRatio,
        content: result.content,
        imageUrls: result.imageUrls,
        inputImageUrls: [inputUrl],
        createdAt: new Date().toISOString(),
      };

      const db = this.dbService.readDb();
      db.images.push(image);
      this.dbService.writeDb(db);
      return { image };
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

