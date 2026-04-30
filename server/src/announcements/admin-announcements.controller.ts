import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { AdminRoleGuard } from '../admin/role.guard';
import {
  AnnouncementsRepo,
  AnnouncementNotifyMode,
  AnnouncementRepeatMode,
  AnnouncementStatus,
} from '../db/repositories/announcements.repo';

function normalizeLimit(value: string | undefined, max = 200, fallback = 50) {
  const limit = Number(value || fallback);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(limit)));
}

function normalizeNotifyMode(value: any): AnnouncementNotifyMode {
  const v = String(value || '').trim();
  if (v === 'silent' || v === 'modal') return v;
  return 'silent';
}

function normalizeRepeatMode(value: any): AnnouncementRepeatMode {
  const v = String(value || '').trim();
  if (v === 'once' || v === 'always') return v;
  return 'once';
}

function normalizeStatus(value: any): AnnouncementStatus {
  const v = String(value || '').trim();
  if (v === 'draft' || v === 'published' || v === 'archived') return v;
  return 'draft';
}

function normalizeOptionalIso(value: any) {
  const v = String(value || '').trim();
  return v ? v : null;
}

@Controller('api/admin/announcements')
@UseGuards(AuthGuard, AdminRoleGuard)
export class AdminAnnouncementsController {
  constructor(private readonly announcementsRepo: AnnouncementsRepo) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('notifyMode') notifyMode?: string,
    @Query('limit') limitValue?: string,
  ) {
    const limit = normalizeLimit(limitValue);
    const announcements = this.announcementsRepo.listAdmin({
      q,
      status,
      notifyMode,
      limit,
    });
    return { announcements };
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() body: any) {
    const title = String(body?.title || '').trim();
    const contentMd = String(body?.contentMd || '').trim();
    if (!title) throw new HttpException('标题不能为空', HttpStatus.BAD_REQUEST);
    if (!contentMd) throw new HttpException('内容不能为空', HttpStatus.BAD_REQUEST);

    const notifyMode = normalizeNotifyMode(body?.notifyMode);
    const repeatMode = normalizeRepeatMode(body?.repeatMode);
    const startAt = normalizeOptionalIso(body?.startAt);
    const endAt = normalizeOptionalIso(body?.endAt);

    const announcement = this.announcementsRepo.create({
      title,
      contentMd,
      notifyMode,
      repeatMode,
      startAt,
      endAt,
      createdBy: req.user.id,
    });
    return { announcement };
  }

  @Put(':id')
  update(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: any) {
    const current = this.announcementsRepo.findById(id);
    if (!current) throw new HttpException('公告不存在', HttpStatus.NOT_FOUND);

    const title = body?.title === undefined ? undefined : String(body?.title || '').trim();
    const contentMd =
      body?.contentMd === undefined ? undefined : String(body?.contentMd || '').trim();

    if (title !== undefined && !title) {
      throw new HttpException('标题不能为空', HttpStatus.BAD_REQUEST);
    }
    if (contentMd !== undefined && !contentMd) {
      throw new HttpException('内容不能为空', HttpStatus.BAD_REQUEST);
    }

    const next = this.announcementsRepo.update(id, {
      title,
      contentMd,
      notifyMode: body?.notifyMode === undefined ? undefined : normalizeNotifyMode(body?.notifyMode),
      repeatMode: body?.repeatMode === undefined ? undefined : normalizeRepeatMode(body?.repeatMode),
      startAt: body?.startAt === undefined ? undefined : normalizeOptionalIso(body?.startAt),
      endAt: body?.endAt === undefined ? undefined : normalizeOptionalIso(body?.endAt),
      updatedBy: req.user.id,
    });

    return { announcement: next };
  }

  @Post(':id/publish')
  publish(@Req() req: RequestWithUser, @Param('id') id: string) {
    const current = this.announcementsRepo.findById(id);
    if (!current) throw new HttpException('公告不存在', HttpStatus.NOT_FOUND);
    const next = this.announcementsRepo.setStatus(id, 'published', req.user.id);
    return { announcement: next };
  }

  @Post(':id/archive')
  archive(@Req() req: RequestWithUser, @Param('id') id: string) {
    const current = this.announcementsRepo.findById(id);
    if (!current) throw new HttpException('公告不存在', HttpStatus.NOT_FOUND);
    const next = this.announcementsRepo.setStatus(id, 'archived', req.user.id);
    return { announcement: next };
  }

  @Delete(':id')
  delete(@Req() req: RequestWithUser, @Param('id') id: string) {
    const current = this.announcementsRepo.findById(id);
    if (!current) throw new HttpException('公告不存在', HttpStatus.NOT_FOUND);
    if (current.status === 'published') {
      throw new HttpException('已发布公告请先下线再删除', HttpStatus.BAD_REQUEST);
    }
    const changes = this.announcementsRepo.deleteById(id);
    return { deleted: changes > 0 };
  }
}

