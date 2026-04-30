import { Module } from '@nestjs/common';
import { SqliteService } from './sqlite.service';
import { UsersRepo } from './repositories/users.repo';
import { ImagesRepo } from './repositories/images.repo';
import { CreditsRepo } from '../credits/credits.repo';

@Module({
  providers: [SqliteService, UsersRepo, ImagesRepo, CreditsRepo],
  exports: [SqliteService, UsersRepo, ImagesRepo, CreditsRepo],
})
export class DbModule {}
