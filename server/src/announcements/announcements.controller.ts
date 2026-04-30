import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { AnnouncementsRepo } from '../db/repositories/announcements.repo';

function normalizeLimit(value: string | undefined, max = 50, fallback = 20) {
  const limit = Number(value || fallback);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(limit)));
}

@Controller('api/announcements')
@UseGuards(AuthGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsRepo: AnnouncementsRepo) {}

  @Get('active')
  listActive(@Req() req: RequestWithUser, @Query('limit') limitValue?: string) {
    const limit = normalizeLimit(limitValue, 50, 20);
    const announcements = this.announcementsRepo.listActiveForUser({
      userId: req.user.id,
      limit,
    });
    return { announcements };
  }

  @Post(':id/read')
  markRead(@Req() req: RequestWithUser, @Param('id') id: string) {
    const result = this.announcementsRepo.markRead({
      userId: req.user.id,
      announcementId: id,
    });
    return { read: result };
  }
}

