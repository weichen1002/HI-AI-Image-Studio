import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminBootstrapController } from './bootstrap.controller';
import { AdminRoleGuard, SuperAdminRoleGuard } from './role.guard';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [AdminController, AdminBootstrapController],
  providers: [AdminRoleGuard, SuperAdminRoleGuard],
})
export class AdminModule {}
