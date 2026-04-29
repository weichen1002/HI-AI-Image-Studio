import { Controller, Get, Post, Body, Req, Query, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { DbService } from '../db/db.service';
import { HiapiService } from '../hiapi/hiapi.service';
import { normalizeAspectRatio } from '../utils';
import { config } from '../config';
import * as crypto from 'crypto';

function normalizeLimit(value: string | undefined) {
  const limit = Number(value || 24);
  if (!Number.isFinite(limit)) return 24;
  return Math.max(1, Math.min(50, Math.floor(limit)));
}

function toListImage(image: any) {
  return {
    ...image,
    imageUrls: image.imageUrls
      .filter((url: string) => url && !url.startsWith('data:'))
      .slice(0, 1),
  };
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

  @Post()
  async createImages(@Req() req: RequestWithUser, @Body() body: any) {
    if (!config.HIAPI_API_KEY) {
      throw new HttpException('请先在 .env 中配置 HIAPI_API_KEY', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const prompt = String(body.prompt || '').trim();
    const aspectRatio = normalizeAspectRatio(body.aspectRatio);

    if (!prompt) {
      throw new HttpException('请输入提示词', HttpStatus.BAD_REQUEST);
    }
    if (prompt.length > 4000) {
      throw new HttpException('提示词不能超过 4000 字符', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.hiapiService.generateImage(prompt, aspectRatio);
      const image = {
        id: crypto.randomUUID(),
        userId: req.user.id,
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
      const status = error.getStatus ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(error.message || '生图请求失败', status);
    }
  }
}
