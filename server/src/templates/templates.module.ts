import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminRoleGuard } from '../admin/role.guard';
import { DbModule } from '../db/db.module';
import { TemplatesController } from './templates.controller';

@Module({
  imports: [AuthModule, DbModule],
  controllers: [TemplatesController],
  providers: [AdminRoleGuard],
})
export class TemplatesModule {}
