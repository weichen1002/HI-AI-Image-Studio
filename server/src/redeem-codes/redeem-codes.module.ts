import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { AdminRoleGuard } from '../admin/role.guard';
import { RedeemCodesController } from './redeem-codes.controller';
import { AdminRedeemCodesController } from './admin-redeem-codes.controller';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [RedeemCodesController, AdminRedeemCodesController],
  providers: [AdminRoleGuard],
})
export class RedeemCodesModule {}
