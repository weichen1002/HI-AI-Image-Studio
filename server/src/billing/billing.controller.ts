import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { AdminRoleGuard } from '../admin/role.guard';
import { AuditLogsRepo } from '../db/repositories/audit-logs.repo';
import { BillingService } from './billing.service';
import { logInfo, logWarn, toErrorDetails } from '../logging/logger';
import { PaymentProvidersService } from './payment-providers.service';

function normalizeLimit(value: string | undefined, max = 100, fallback = 20) {
  const limit = Number(value || fallback);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(limit)));
}

function normalizePage(value: string | undefined, fallback = 1) {
  const page = Number(value || fallback);
  if (!Number.isFinite(page)) return fallback;
  return Math.max(1, Math.floor(page));
}

function requestIp(req: RequestWithUser) {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return String(forwarded[0] || '').trim();
  if (typeof forwarded === 'string') return String(forwarded.split(',')[0] || '').trim();
  return String(req.ip || req.socket?.remoteAddress || '').trim();
}

function requestUserAgent(req: RequestWithUser) {
  return String(req.headers['user-agent'] || '').slice(0, 500);
}

function billingWebhookMeta(body: any) {
  const orderId = String(body?.orderId || '').trim();
  return {
    correlationId: `billing:${orderId || 'unknown'}`,
    orderId,
    paymentChannel: 'mock',
    paymentRef: String(body?.paymentRef || '').trim(),
    amountCents: Number(body?.amountCents || 0),
    currency: String(body?.currency || 'CNY').trim().toUpperCase(),
  };
}

@Controller('api/billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('packages')
  listPackages() {
    return { packages: this.billingService.listPackages() };
  }

  @Post('orders')
  createOrder(@Req() req: RequestWithUser, @Body() body: any) {
    const order = this.billingService.createPendingOrder({
      userId: req.user.id,
      packageId: body?.packageId,
      paymentChannel: body?.paymentChannel,
    });
    return { order };
  }

  @Get('orders')
  listMyOrders(
    @Req() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    const limit = normalizeLimit(limitValue, 100, 20);
    const page = normalizePage(pageValue, 1);
    return this.billingService.listUserOrders({
      userId: req.user.id,
      status,
      limit,
      offset: (page - 1) * limit,
    });
  }
}

@Controller('api/billing/webhooks')
export class BillingWebhookController {
  constructor(
    private readonly billingService: BillingService,
    private readonly paymentProviders: PaymentProvidersService,
  ) {}

  @Post('mock')
  handleMockPaid(
    @Body() body: any,
    @Headers('x-billing-signature') signature?: string,
  ) {
    const meta = billingWebhookMeta(body);
    let completion;
    try {
      completion = this.paymentProviders.parsePaidWebhook('mock', body, { signature });
    } catch (error) {
      logWarn('BillingWebhookController', 'Mock billing webhook signature rejected', {
        ...meta,
        error: toErrorDetails(error, { includeStack: false }),
      });
      throw error;
    }
    logInfo('BillingWebhookController', 'Mock billing webhook accepted', {
      ...meta,
      orderId: completion.orderId,
      paymentChannel: completion.paymentChannel,
      paymentRef: completion.paymentRef,
      amountCents: completion.amountCents,
      currency: completion.currency,
    });
    const result = this.billingService.completePaidOrder(completion);
    logInfo('BillingWebhookController', 'Mock billing webhook completed', {
      ...meta,
      orderId: completion.orderId,
      paymentChannel: completion.paymentChannel,
      paymentRef: completion.paymentRef,
      amountCents: completion.amountCents,
      currency: completion.currency,
      ledgerEntryId: result.order.ledgerEntryId,
      idempotent: result.idempotent,
    });
    return {
      ok: true,
      order: result.order,
      idempotent: result.idempotent,
    };
  }
}

@Controller('api/admin/billing')
@UseGuards(AuthGuard, AdminRoleGuard)
export class AdminBillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly auditLogsRepo: AuditLogsRepo,
  ) {}

  @Get('orders')
  listOrders(
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    const limit = normalizeLimit(limitValue, 100, 20);
    const page = normalizePage(pageValue, 1);
    return this.billingService.listAdminOrders({
      userId,
      status,
      limit,
      offset: (page - 1) * limit,
    });
  }

  @Post('orders/:id/manual-complete')
  completeManualOrder(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    const result = this.billingService.completeManualOrder({
      orderId: id,
      paymentRef: body?.paymentRef,
    });
    this.auditLogsRepo.create({
      actorUserId: req.user.id,
      targetUserId: result.order.userId,
      category: 'admin',
      action: 'billing_order_manual_completed',
      status: 'success',
      ip: requestIp(req),
      userAgent: requestUserAgent(req),
      detail: {
        orderId: result.order.id,
        packageId: result.order.packageId,
        packageName: result.order.packageName,
        creditsAmount: result.order.creditsAmount,
        amountCents: result.order.amountCents,
        currency: result.order.currency,
        ledgerEntryId: result.order.ledgerEntryId,
        paymentRef: result.order.paymentRef,
        idempotent: result.idempotent,
      },
    });
    return result;
  }

  @Post('orders/:id/refund')
  refundOrder(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    const reason = String(body?.reason || 'billing_order_admin_refund').trim();
    try {
      const result = this.billingService.refundPaidOrder({
        orderId: id,
        reason,
      });
      this.auditLogsRepo.create({
        actorUserId: req.user.id,
        targetUserId: result.order.userId,
        category: 'admin',
        action: 'billing_order_refunded',
        status: 'success',
        ip: requestIp(req),
        userAgent: requestUserAgent(req),
        detail: {
          orderId: result.order.id,
          packageId: result.order.packageId,
          packageName: result.order.packageName,
          creditsAmount: result.order.creditsAmount,
          amountCents: result.order.amountCents,
          currency: result.order.currency,
          ledgerEntryId: result.order.ledgerEntryId,
          refundLedgerEntryId: result.order.refundLedgerEntryId,
          refundReason: result.order.refundReason || reason,
          idempotent: result.idempotent,
        },
      });
      return result;
    } catch (error) {
      this.auditLogsRepo.create({
        actorUserId: req.user.id,
        targetUserId: undefined,
        category: 'admin',
        action: 'billing_order_refund_failed',
        status: 'failure',
        ip: requestIp(req),
        userAgent: requestUserAgent(req),
        detail: {
          orderId: id,
          refundReason: reason,
          error: String((error as any)?.message || error || '退款失败'),
        },
      });
      throw error;
    }
  }
}
