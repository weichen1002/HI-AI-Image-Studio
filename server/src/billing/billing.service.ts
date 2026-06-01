import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { BillingRepo, BillingOrderStatus } from './billing.repo';
import { CreditsRepo } from '../credits/credits.repo';
import { SqliteService } from '../db/sqlite.service';
import { UsersRepo } from '../db/repositories/users.repo';
import { logError, logInfo, logWarn, toErrorDetails } from '../logging/logger';

const ALLOWED_PAYMENT_CHANNELS = new Set(['manual', 'mock', 'wechat', 'alipay', 'stripe']);

function normalizePaymentChannel(value: unknown) {
  const channel = String(value || 'manual').trim().toLowerCase();
  if (!channel) return 'manual';
  return ALLOWED_PAYMENT_CHANNELS.has(channel) ? channel : 'manual';
}

function normalizeOrderStatus(value: unknown): BillingOrderStatus | undefined {
  const status = String(value || '').trim();
  if (
    status === 'pending' ||
    status === 'paid' ||
    status === 'refunded' ||
    status === 'cancelled' ||
    status === 'failed'
  ) {
    return status;
  }
  return undefined;
}

function normalizeRefundReason(value: unknown) {
  return String(value || 'billing_order_refund')
    .trim()
    .slice(0, 200) || 'billing_order_refund';
}

@Injectable()
export class BillingService {
  constructor(
    private readonly billingRepo: BillingRepo,
    private readonly creditsRepo: CreditsRepo,
    private readonly sqlite: SqliteService,
    private readonly usersRepo: UsersRepo,
  ) {}

  listPackages() {
    return this.billingRepo.listActivePackages();
  }

  createPendingOrder(params: {
    userId: string;
    packageId: string;
    paymentChannel?: string;
  }) {
    const packageId = String(params.packageId || '').trim();
    if (!packageId) {
      throw new HttpException('请选择套餐', HttpStatus.BAD_REQUEST);
    }

    const pkg = this.billingRepo.findPackageById(packageId);
    if (!pkg || !pkg.active) {
      throw new HttpException('套餐不存在或已下架', HttpStatus.NOT_FOUND);
    }

    const order = this.billingRepo.createPendingOrder({
      userId: params.userId,
      pkg,
      paymentChannel: normalizePaymentChannel(params.paymentChannel),
    });
    logInfo('BillingService', 'Billing order created', this.orderMeta({
      orderId: order.id,
      userId: order.userId,
      paymentChannel: order.paymentChannel,
      amountCents: order.amountCents,
      currency: order.currency,
    }));
    return order;
  }

  listUserOrders(params: {
    userId: string;
    status?: string;
    limit: number;
    offset: number;
  }) {
    return this.billingRepo.listOrdersPaged({
      userId: params.userId,
      status: normalizeOrderStatus(params.status),
      limit: params.limit,
      offset: params.offset,
    });
  }

  listAdminOrders(params: {
    userId?: string;
    status?: string;
    limit: number;
    offset: number;
  }) {
    return this.billingRepo.listOrdersPaged({
      userId: String(params.userId || '').trim() || undefined,
      status: normalizeOrderStatus(params.status),
      limit: params.limit,
      offset: params.offset,
    });
  }

  completeManualOrder(params: { orderId: string; paymentRef?: string }) {
    return this.completePaidOrder({
      orderId: params.orderId,
      paymentChannel: 'manual',
      paymentRef: String(params.paymentRef || '').trim() || `manual:${String(params.orderId || '').trim()}`,
      grantReason: 'billing_order_manual_complete',
      enforcePaymentChannel: false,
      enforcePaymentRef: false,
    });
  }

  completePaidOrder(params: {
    orderId: string;
    paymentChannel: string;
    paymentRef: string;
    amountCents?: number;
    currency?: string;
    grantReason?: string;
    enforcePaymentChannel?: boolean;
    enforcePaymentRef?: boolean;
  }) {
    const orderId = String(params.orderId || '').trim();
    if (!orderId) {
      throw new HttpException('订单不存在', HttpStatus.NOT_FOUND);
    }
    const paymentChannel = normalizePaymentChannel(params.paymentChannel);
    const paymentRef = String(params.paymentRef || '').trim();
    if (!paymentRef) {
      throw new HttpException('缺少支付流水号', HttpStatus.BAD_REQUEST);
    }

    const baseMeta = this.orderMeta({
      orderId,
      paymentChannel,
      paymentRef,
      amountCents: params.amountCents,
      currency: params.currency,
    });
    logInfo('BillingService', 'Billing paid completion started', baseMeta);

    try {
      const result = this.sqlite.transaction(() => {
        const order = this.billingRepo.findOrderById(orderId);
        if (!order) {
          throw new HttpException('订单不存在', HttpStatus.NOT_FOUND);
        }
        const currentMeta = this.orderMeta({
          orderId: order.id,
          userId: order.userId,
          paymentChannel,
          paymentRef,
          amountCents: order.amountCents,
          currency: order.currency,
        });
        if (order.status === 'paid') {
          if (params.enforcePaymentChannel !== false && order.paymentChannel && order.paymentChannel !== paymentChannel) {
            throw new HttpException('支付渠道与订单不匹配', HttpStatus.BAD_REQUEST);
          }
          if (params.enforcePaymentRef !== false && order.paymentRef && order.paymentRef !== paymentRef) {
            throw new HttpException('支付流水与订单不匹配', HttpStatus.BAD_REQUEST);
          }
          if (params.amountCents !== undefined && Number(params.amountCents) !== order.amountCents) {
            throw new HttpException('支付金额与订单不匹配', HttpStatus.BAD_REQUEST);
          }
          if (params.currency && String(params.currency).toUpperCase() !== order.currency) {
            throw new HttpException('支付币种与订单不匹配', HttpStatus.BAD_REQUEST);
          }
          logInfo('BillingService', 'Billing paid completion idempotent', {
            ...currentMeta,
            ledgerEntryId: order.ledgerEntryId,
            idempotent: true,
          });
          return { order, balance: this.creditsRepo.getBalance(order.userId), idempotent: true };
        }
        if (order.status !== 'pending') {
          throw new HttpException('订单状态不可补单', HttpStatus.BAD_REQUEST);
        }
        if (order.ledgerEntryId) {
          throw new HttpException('订单账务状态异常', HttpStatus.CONFLICT);
        }
        if (params.enforcePaymentChannel !== false && order.paymentChannel && order.paymentChannel !== paymentChannel) {
          throw new HttpException('支付渠道与订单不匹配', HttpStatus.BAD_REQUEST);
        }
        if (params.amountCents !== undefined && Number(params.amountCents) !== order.amountCents) {
          throw new HttpException('支付金额与订单不匹配', HttpStatus.BAD_REQUEST);
        }
        if (params.currency && String(params.currency).toUpperCase() !== order.currency) {
          throw new HttpException('支付币种与订单不匹配', HttpStatus.BAD_REQUEST);
        }
        const user = this.usersRepo.findById(order.userId);
        if (!user) {
          throw new HttpException('订单用户不存在', HttpStatus.NOT_FOUND);
        }

        const grant = this.creditsRepo.grantInTx({
          userId: order.userId,
          amount: order.creditsAmount,
          reason: params.grantReason || `billing_order_${paymentChannel}_paid`,
          refType: 'billing_order',
          refId: order.id,
        });
        if (!grant.entry) {
          throw new HttpException('入账失败', HttpStatus.BAD_REQUEST);
        }

        const paidOrder = this.billingRepo.markOrderPaidInTx({
          orderId: order.id,
          ledgerEntryId: grant.entry.id,
          paymentRef,
        });
        if (!paidOrder) {
          throw new HttpException('订单状态已变化，请刷新后重试', HttpStatus.CONFLICT);
        }

        return { order: paidOrder, balance: grant.balance, ledgerEntry: grant.entry, idempotent: false };
      });
      logInfo('BillingService', 'Billing paid completion succeeded', {
        ...this.orderMeta({
          orderId: result.order.id,
          userId: result.order.userId,
          paymentChannel,
          paymentRef: result.order.paymentRef || paymentRef,
          amountCents: result.order.amountCents,
          currency: result.order.currency,
        }),
        ledgerEntryId: result.order.ledgerEntryId || (result as any).ledgerEntry?.id,
        idempotent: result.idempotent,
      });
      return result;
    } catch (error) {
      const status =
        Number((error as any)?.getStatus?.()) ||
        Number((error as any)?.status) ||
        Number((error as any)?.statusCode) ||
        500;
      const logger = status >= 500 ? logError : logWarn;
      logger('BillingService', 'Billing paid completion rejected', {
        ...baseMeta,
        status,
        error: toErrorDetails(error, { includeStack: status >= 500 }),
      });
      throw error;
    }
  }

  refundPaidOrder(params: { orderId: string; reason?: string }) {
    const orderId = String(params.orderId || '').trim();
    if (!orderId) {
      throw new HttpException('订单不存在', HttpStatus.NOT_FOUND);
    }
    const refundReason = normalizeRefundReason(params.reason);
    const baseMeta = this.orderMeta({ orderId });
    logInfo('BillingService', 'Billing refund started', {
      ...baseMeta,
      refundReason,
    });

    try {
      const result = this.sqlite.transaction(() => {
        const order = this.billingRepo.findOrderById(orderId);
        if (!order) {
          throw new HttpException('订单不存在', HttpStatus.NOT_FOUND);
        }
        const currentMeta = this.orderMeta({
          orderId: order.id,
          userId: order.userId,
          paymentChannel: order.paymentChannel,
          paymentRef: order.paymentRef,
          amountCents: order.amountCents,
          currency: order.currency,
        });

        if (order.status === 'refunded') {
          logInfo('BillingService', 'Billing refund idempotent', {
            ...currentMeta,
            refundLedgerEntryId: order.refundLedgerEntryId,
            idempotent: true,
          });
          return {
            order,
            balance: this.creditsRepo.getBalance(order.userId),
            refundLedgerEntry: null,
            idempotent: true,
          };
        }

        if (order.status !== 'paid') {
          throw new HttpException('只有已支付订单可以退款', HttpStatus.BAD_REQUEST);
        }
        if (!order.ledgerEntryId) {
          throw new HttpException('订单缺少原始入账流水，无法退款', HttpStatus.CONFLICT);
        }
        const user = this.usersRepo.findById(order.userId);
        if (!user) {
          throw new HttpException('订单用户不存在', HttpStatus.NOT_FOUND);
        }
        const balance = this.creditsRepo.getBalance(order.userId);
        if (balance < order.creditsAmount) {
          throw new HttpException('用户余额不足，无法扣回本订单积分', HttpStatus.BAD_REQUEST);
        }

        const reversal = this.creditsRepo.adjustInTx({
          userId: order.userId,
          amount: -order.creditsAmount,
          reason: refundReason,
          refType: 'billing_order_refund',
          refId: order.id,
        });
        if (!reversal.entry) {
          throw new HttpException('退款冲正失败', HttpStatus.BAD_REQUEST);
        }

        const refundedOrder = this.billingRepo.markOrderRefundedInTx({
          orderId: order.id,
          refundLedgerEntryId: reversal.entry.id,
          refundReason,
        });
        if (!refundedOrder) {
          throw new HttpException('订单状态已变化，请刷新后重试', HttpStatus.CONFLICT);
        }

        return {
          order: refundedOrder,
          balance: reversal.balance,
          refundLedgerEntry: reversal.entry,
          idempotent: false,
        };
      });

      logInfo('BillingService', 'Billing refund succeeded', {
        ...this.orderMeta({
          orderId: result.order.id,
          userId: result.order.userId,
          paymentChannel: result.order.paymentChannel,
          paymentRef: result.order.paymentRef,
          amountCents: result.order.amountCents,
          currency: result.order.currency,
        }),
        refundLedgerEntryId:
          result.order.refundLedgerEntryId || result.refundLedgerEntry?.id,
        refundReason,
        idempotent: result.idempotent,
      });
      return result;
    } catch (error) {
      const status =
        Number((error as any)?.getStatus?.()) ||
        Number((error as any)?.status) ||
        Number((error as any)?.statusCode) ||
        500;
      const logger = status >= 500 ? logError : logWarn;
      logger('BillingService', 'Billing refund rejected', {
        ...baseMeta,
        refundReason,
        status,
        error: toErrorDetails(error, { includeStack: status >= 500 }),
      });
      throw error;
    }
  }

  private orderMeta(params: {
    orderId: string;
    userId?: string;
    paymentChannel?: string;
    paymentRef?: string;
    amountCents?: number;
    currency?: string;
  }) {
    return {
      correlationId: `billing:${params.orderId}`,
      orderId: params.orderId,
      userId: params.userId,
      paymentChannel: params.paymentChannel,
      paymentRef: params.paymentRef,
      amountCents: params.amountCents,
      currency: params.currency ? String(params.currency).toUpperCase() : undefined,
    };
  }
}
