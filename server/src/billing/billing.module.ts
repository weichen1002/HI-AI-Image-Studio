import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { AdminRoleGuard } from '../admin/role.guard';
import { BillingController, AdminBillingController, BillingWebhookController } from './billing.controller';
import { BillingRepo } from './billing.repo';
import { BillingService } from './billing.service';
import { MockPaymentProviderAdapter, PaymentProvidersService } from './payment-providers.service';

@Module({
  imports: [AuthModule, DbModule],
  controllers: [BillingController, AdminBillingController, BillingWebhookController],
  providers: [
    BillingRepo,
    BillingService,
    AdminRoleGuard,
    MockPaymentProviderAdapter,
    PaymentProvidersService,
  ],
  exports: [BillingRepo, BillingService],
})
export class BillingModule {}
