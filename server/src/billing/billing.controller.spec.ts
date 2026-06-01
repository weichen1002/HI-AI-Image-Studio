import { BillingController, AdminBillingController, BillingWebhookController } from './billing.controller';
import { config } from '../config';
import * as crypto from 'crypto';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('BillingController', () => {
  let service: any;
  let paymentProviders: any;
  let auditLogsRepo: any;
  let controller: BillingController;
  let adminController: AdminBillingController;
  let webhookController: BillingWebhookController;
  const originalWebhookSecret = config.BILLING_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = {
      listPackages: jest.fn(() => [{ id: 'starter-credits' }]),
      createPendingOrder: jest.fn(() => ({ id: 'order-1', status: 'pending' })),
      listUserOrders: jest.fn(() => ({ orders: [], total: 0 })),
      listAdminOrders: jest.fn(() => ({ orders: [], total: 0 })),
      completeManualOrder: jest.fn(() => ({
        order: {
          id: 'order-1',
          userId: 'user-1',
          packageId: 'creator-credits',
          packageName: '创作者包',
          creditsAmount: 600,
          amountCents: 4990,
          currency: 'CNY',
          status: 'paid',
          paymentRef: 'manual:receipt-1',
          ledgerEntryId: 'ledger-1',
        },
        balance: 700,
        ledgerEntry: { id: 'ledger-1', amount: 600 },
        idempotent: false,
      })),
      completePaidOrder: jest.fn(() => ({
        order: {
          id: 'order-1',
          userId: 'user-1',
          packageId: 'starter-credits',
          packageName: '入门包',
          creditsAmount: 100,
          amountCents: 990,
          currency: 'CNY',
          status: 'paid',
          paymentChannel: 'mock',
          paymentRef: 'mock:pay-1',
          ledgerEntryId: 'ledger-1',
        },
        balance: 120,
        ledgerEntry: { id: 'ledger-1', amount: 100 },
        idempotent: false,
      })),
      refundPaidOrder: jest.fn(() => ({
        order: {
          id: 'order-1',
          userId: 'user-1',
          packageId: 'creator-credits',
          packageName: '创作者包',
          creditsAmount: 600,
          amountCents: 4990,
          currency: 'CNY',
          status: 'refunded',
          paymentChannel: 'manual',
          paymentRef: 'manual:receipt-1',
          ledgerEntryId: 'ledger-1',
          refundLedgerEntryId: 'ledger-refund-1',
          refundReason: 'customer_refund',
        },
        balance: 100,
        refundLedgerEntry: { id: 'ledger-refund-1', amount: -600 },
        idempotent: false,
      })),
    };
    paymentProviders = {
      parsePaidWebhook: jest.fn((channel, body) => ({
        orderId: String(body?.orderId || '').trim(),
        paymentChannel: channel,
        paymentRef: String(body?.paymentRef || '').trim(),
        amountCents: Number(body?.amountCents),
        currency: String(body?.currency || 'CNY').trim().toUpperCase(),
        grantReason: 'billing_order_mock_webhook_paid',
        enforcePaymentChannel: true,
      })),
    };
    auditLogsRepo = { create: jest.fn() };
    controller = new BillingController(service);
    adminController = new AdminBillingController(service, auditLogsRepo);
    webhookController = new BillingWebhookController(service, paymentProviders);
    config.BILLING_WEBHOOK_SECRET = 'webhook-secret';
  });

  afterEach(() => {
    config.BILLING_WEBHOOK_SECRET = originalWebhookSecret;
    jest.restoreAllMocks();
  });

  it('creates pending orders for the current user', () => {
    const result = controller.createOrder(
      { user: { id: 'user-1' } } as any,
      { packageId: 'starter-credits', paymentChannel: 'mock' },
    );

    expect(result).toEqual({ order: { id: 'order-1', status: 'pending' } });
    expect(service.createPendingOrder).toHaveBeenCalledWith({
      userId: 'user-1',
      packageId: 'starter-credits',
      paymentChannel: 'mock',
    });
  });

  it('lists user and admin orders with pagination', () => {
    controller.listMyOrders({ user: { id: 'user-1' } } as any, 'pending', '2', '10');
    adminController.listOrders('user-1', 'pending', '3', '20');

    expect(service.listUserOrders).toHaveBeenCalledWith({
      userId: 'user-1',
      status: 'pending',
      limit: 10,
      offset: 10,
    });
    expect(service.listAdminOrders).toHaveBeenCalledWith({
      userId: 'user-1',
      status: 'pending',
      limit: 20,
      offset: 40,
    });
  });

  it('manually completes orders and writes admin audit details', () => {
    const req = {
      user: { id: 'admin-1' },
      headers: { 'user-agent': 'jest', 'x-forwarded-for': '127.0.0.1' },
    } as any;

    const result = adminController.completeManualOrder(
      'order-1',
      { paymentRef: 'manual:receipt-1' },
      req,
    );

    expect(result.order.status).toBe('paid');
    expect(service.completeManualOrder).toHaveBeenCalledWith({
      orderId: 'order-1',
      paymentRef: 'manual:receipt-1',
    });
    expect(auditLogsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        targetUserId: 'user-1',
        category: 'admin',
        action: 'billing_order_manual_completed',
        status: 'success',
        detail: expect.objectContaining({
          orderId: 'order-1',
          packageId: 'creator-credits',
          creditsAmount: 600,
          ledgerEntryId: 'ledger-1',
          paymentRef: 'manual:receipt-1',
          idempotent: false,
        }),
      }),
    );
  });

  it('refunds paid orders and writes admin audit details', () => {
    const req = {
      user: { id: 'admin-1' },
      headers: { 'user-agent': 'jest', 'x-forwarded-for': '127.0.0.1' },
    } as any;

    const result = adminController.refundOrder(
      'order-1',
      { reason: 'customer_refund' },
      req,
    );

    expect(result.order.status).toBe('refunded');
    expect(service.refundPaidOrder).toHaveBeenCalledWith({
      orderId: 'order-1',
      reason: 'customer_refund',
    });
    expect(auditLogsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        targetUserId: 'user-1',
        category: 'admin',
        action: 'billing_order_refunded',
        status: 'success',
        detail: expect.objectContaining({
          orderId: 'order-1',
          creditsAmount: 600,
          ledgerEntryId: 'ledger-1',
          refundLedgerEntryId: 'ledger-refund-1',
          refundReason: 'customer_refund',
          idempotent: false,
        }),
      }),
    );
  });

  it('writes failed refund audit details before rethrowing', () => {
    service.refundPaidOrder.mockImplementation(() => {
      throw new HttpException('用户余额不足，无法扣回本订单积分', HttpStatus.BAD_REQUEST);
    });

    expect(() =>
      adminController.refundOrder(
        'order-1',
        { reason: 'customer_refund' },
        {
          user: { id: 'admin-1' },
          headers: { 'user-agent': 'jest', 'x-forwarded-for': '127.0.0.1' },
        } as any,
      ),
    ).toThrow('用户余额不足，无法扣回本订单积分');
    expect(auditLogsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        category: 'admin',
        action: 'billing_order_refund_failed',
        status: 'failure',
        detail: expect.objectContaining({
          orderId: 'order-1',
          refundReason: 'customer_refund',
          error: '用户余额不足，无法扣回本订单积分',
        }),
      }),
    );
  });

  it('accepts signed mock payment webhooks and completes orders', () => {
    const body = {
      orderId: 'order-1',
      paymentRef: 'mock:pay-1',
      amountCents: 990,
      currency: 'CNY',
    };
    const signature = crypto
      .createHmac('sha256', config.BILLING_WEBHOOK_SECRET)
      .update('order-1.mock:pay-1.990.CNY')
      .digest('hex');

    const result = webhookController.handleMockPaid(body, signature);

    expect(result).toEqual({
      ok: true,
      order: expect.objectContaining({
        id: 'order-1',
        status: 'paid',
      }),
      idempotent: false,
    });
    expect(service.completePaidOrder).toHaveBeenCalledWith({
      orderId: 'order-1',
      paymentChannel: 'mock',
      paymentRef: 'mock:pay-1',
      amountCents: 990,
      currency: 'CNY',
      grantReason: 'billing_order_mock_webhook_paid',
      enforcePaymentChannel: true,
    });
    expect(paymentProviders.parsePaidWebhook).toHaveBeenCalledWith('mock', body, {
      signature,
    });
    const logs = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(logs).toContain('Mock billing webhook accepted');
    expect(logs).toContain('Mock billing webhook completed');
    expect(logs).toContain('"correlationId": "billing:order-1"');
    expect(logs).toContain('"idempotent": false');
  });

  it('rejects unsigned mock payment webhooks before completing orders', () => {
    paymentProviders.parsePaidWebhook.mockImplementation(() => {
      throw new HttpException('支付回调验签失败', HttpStatus.UNAUTHORIZED);
    });

    expect(() =>
      webhookController.handleMockPaid(
        {
          orderId: 'order-1',
          paymentRef: 'mock:pay-1',
          amountCents: 990,
          currency: 'CNY',
        },
        'bad-signature',
      ),
    ).toThrow('支付回调验签失败');
    expect(service.completePaidOrder).not.toHaveBeenCalled();
    const warnings = (console.warn as jest.Mock).mock.calls.flat().join('\n');
    expect(warnings).toContain('Mock billing webhook signature rejected');
    expect(warnings).toContain('"correlationId": "billing:order-1"');
    expect(warnings).toContain('"status": 401');
  });
});
