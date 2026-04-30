import { Module } from '@nestjs/common';
import { SqliteService } from './sqlite.service';
import { UsersRepo } from './repositories/users.repo';
import { ImagesRepo } from './repositories/images.repo';
import { AnnouncementsRepo } from './repositories/announcements.repo';
import { CreditsRepo } from '../credits/credits.repo';

@Module({
  providers: [SqliteService, UsersRepo, ImagesRepo, AnnouncementsRepo, CreditsRepo],
  exports: [SqliteService, UsersRepo, ImagesRepo, AnnouncementsRepo, CreditsRepo],
})
export class DbModule {}
