import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { AdminRoleGuard } from '../admin/role.guard';
import { AnnouncementsController } from './announcements.controller';
import { AdminAnnouncementsController } from './admin-announcements.controller';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [AnnouncementsController, AdminAnnouncementsController],
  providers: [AdminRoleGuard],
})
export class AnnouncementsModule {}
