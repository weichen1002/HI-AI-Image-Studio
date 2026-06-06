import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { AdminRoleGuard } from '../admin/role.guard';
import { AdminOperationsController } from './admin-operations.controller';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [AdminOperationsController],
  providers: [AdminRoleGuard],
})
export class OperationsModule {}
