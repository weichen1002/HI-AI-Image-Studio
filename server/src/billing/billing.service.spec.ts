import { HttpException } from '@nestjs/common';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  let repo: any;
  let creditsRepo: any;
  let sqlite: any;
  let usersRepo: any;
  let service: BillingService;

  beforeEach(() => {
    repo = {
      listActivePackages: jest.fn(),
      findPackageById: jest.fn(),
      createPendingOrder: jest.fn(),
      listOrdersPaged: jest.fn(),
      findOrderById: jest.fn(),
      markOrderPaidInTx: jest.fn(),
      markOrderRefundedInTx: jest.fn(),
    };
    creditsRepo = {
      getBalance: jest.fn(() => 120),
      grantInTx: jest.fn(),
      adjustInTx: jest.fn(),
    };
    sqlite = {
      transaction: jest.fn((fn) => fn()),
    };
    usersRepo = {
      findById: jest.fn(() => ({ id: 'user-1' })),
    };
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = new BillingService(repo, creditsRepo, sqlite, usersRepo);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates pending orders from active packages', () => {
    const pkg = {
      id: 'starter-credits',
      name: '入门包',
      creditsAmount: 100,
      priceCents: 990,
      currency: 'CNY',
      active: true,
    };
    const order = { id: 'order-1', status: 'pending', packageId: pkg.id };
    repo.findPackageById.mockReturnValue(pkg);
    repo.createPendingOrder.mockReturnValue(order);

    expect(
      service.createPendingOrder({
        userId: 'user-1',
        packageId: 'starter-credits',
        paymentChannel: 'mock',
      }),
    ).toBe(order);
    expect(repo.createPendingOrder).toHaveBeenCalledWith({
      userId: 'user-1',
      pkg,
      paymentChannel: 'mock',
    });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Billing order created'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('"correlationId": "billing:order-1"'),
    );
  });

  it('rejects missing or inactive packages', () => {
    repo.findPackageById.mockReturnValue(null);

    expect(() =>
      service.createPendingOrder({ userId: 'user-1', packageId: 'missing' }),
    ).toThrow(HttpException);
  });

  it('manually completes pending orders by granting credits once', () => {
    const order = {
      id: 'order-1',
      userId: 'user-1',
      packageId: 'creator-credits',
      packageName: '创作者包',
      creditsAmount: 600,
      amountCents: 4990,
      currency: 'CNY',
      status: 'pending',
      paymentRef: '',
      ledgerEntryId: '',
    };
    const paidOrder = {
      ...order,
      status: 'paid',
      paymentRef: 'manual:receipt-1',
      ledgerEntryId: 'ledger-1',
    };
    const ledgerEntry = { id: 'ledger-1', amount: 600 };
    repo.findOrderById.mockReturnValue(order);
    creditsRepo.grantInTx.mockReturnValue({ balance: 700, entry: ledgerEntry });
    repo.markOrderPaidInTx.mockReturnValue(paidOrder);

    const result = service.completeManualOrder({
      orderId: 'order-1',
      paymentRef: 'manual:receipt-1',
    });

    expect(result).toEqual({
      order: paidOrder,
      balance: 700,
      ledgerEntry,
      idempotent: false,
    });
    expect(sqlite.transaction).toHaveBeenCalled();
    expect(creditsRepo.grantInTx).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: 600,
      reason: 'billing_order_manual_complete',
      refType: 'billing_order',
      refId: 'order-1',
    });
    expect(repo.markOrderPaidInTx).toHaveBeenCalledWith({
      orderId: 'order-1',
      ledgerEntryId: 'ledger-1',
      paymentRef: 'manual:receipt-1',
    });
    const logs = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(logs).toContain('Billing paid completion started');
    expect(logs).toContain('Billing paid completion succeeded');
    expect(logs).toContain('"correlationId": "billing:order-1"');
    expect(logs).toContain('"ledgerEntryId": "ledger-1"');
  });

  it('returns paid orders idempotently without granting credits again', () => {
    const order = {
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
    };
    repo.findOrderById.mockReturnValue(order);
    creditsRepo.getBalance.mockReturnValue(700);

    const result = service.completeManualOrder({ orderId: 'order-1' });

    expect(result).toEqual({ order, balance: 700, idempotent: true });
    expect(creditsRepo.grantInTx).not.toHaveBeenCalled();
    expect(repo.markOrderPaidInTx).not.toHaveBeenCalled();
    const logs = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(logs).toContain('Billing paid completion idempotent');
    expect(logs).toContain('"idempotent": true');
  });

  it('completes paid webhook orders with channel, amount, and currency checks', () => {
    const order = {
      id: 'order-1',
      userId: 'user-1',
      packageId: 'starter-credits',
      packageName: '入门包',
      creditsAmount: 100,
      amountCents: 990,
      currency: 'CNY',
      status: 'pending',
      paymentChannel: 'mock',
      paymentRef: '',
      ledgerEntryId: '',
    };
    const ledgerEntry = { id: 'ledger-1', amount: 100 };
    const paidOrder = {
      ...order,
      status: 'paid',
      paymentRef: 'mock:pay-1',
      ledgerEntryId: 'ledger-1',
    };
    repo.findOrderById.mockReturnValue(order);
    creditsRepo.grantInTx.mockReturnValue({ balance: 120, entry: ledgerEntry });
    repo.markOrderPaidInTx.mockReturnValue(paidOrder);

    const result = service.completePaidOrder({
      orderId: 'order-1',
      paymentChannel: 'mock',
      paymentRef: 'mock:pay-1',
      amountCents: 990,
      currency: 'CNY',
      grantReason: 'billing_order_mock_webhook_paid',
    });

    expect(result).toEqual({
      order: paidOrder,
      balance: 120,
      ledgerEntry,
      idempotent: false,
    });
    expect(creditsRepo.grantInTx).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: 100,
      reason: 'billing_order_mock_webhook_paid',
      refType: 'billing_order',
      refId: 'order-1',
    });
  });

  it('rejects webhook completion when amount does not match', () => {
    repo.findOrderById.mockReturnValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'pending',
      paymentChannel: 'mock',
      amountCents: 990,
      currency: 'CNY',
      creditsAmount: 100,
      ledgerEntryId: '',
    });

    expect(() =>
      service.completePaidOrder({
        orderId: 'order-1',
        paymentChannel: 'mock',
        paymentRef: 'mock:pay-1',
        amountCents: 1,
        currency: 'CNY',
      }),
    ).toThrow(HttpException);
    expect(creditsRepo.grantInTx).not.toHaveBeenCalled();
    expect(repo.markOrderPaidInTx).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Billing paid completion rejected'),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('"status": 400'),
    );
  });

  it('treats repeated webhook with the same payment ref as idempotent only', () => {
    const order = {
      id: 'order-1',
      userId: 'user-1',
      status: 'paid',
      paymentChannel: 'mock',
      paymentRef: 'mock:pay-1',
      ledgerEntryId: 'ledger-1',
      amountCents: 990,
      currency: 'CNY',
    };
    repo.findOrderById.mockReturnValue(order);
    creditsRepo.getBalance.mockReturnValue(120);

    expect(
      service.completePaidOrder({
        orderId: 'order-1',
        paymentChannel: 'mock',
        paymentRef: 'mock:pay-1',
        amountCents: 990,
        currency: 'CNY',
      }),
    ).toEqual({ order, balance: 120, idempotent: true });

    expect(() =>
      service.completePaidOrder({
        orderId: 'order-1',
        paymentChannel: 'mock',
        paymentRef: 'mock:pay-2',
        amountCents: 990,
        currency: 'CNY',
      }),
    ).toThrow(HttpException);
    expect(creditsRepo.grantInTx).not.toHaveBeenCalled();
  });

  it('rejects manual completion when the order user no longer exists', () => {
    const order = {
      id: 'order-1',
      userId: 'missing-user',
      packageId: 'creator-credits',
      packageName: '创作者包',
      creditsAmount: 600,
      amountCents: 4990,
      currency: 'CNY',
      status: 'pending',
      paymentRef: '',
      ledgerEntryId: '',
    };
    repo.findOrderById.mockReturnValue(order);
    usersRepo.findById.mockReturnValue(null);

    expect(() => service.completeManualOrder({ orderId: 'order-1' })).toThrow(HttpException);
    expect(creditsRepo.grantInTx).not.toHaveBeenCalled();
    expect(repo.markOrderPaidInTx).not.toHaveBeenCalled();
  });

  it('refunds paid orders by reversing granted credits once', () => {
    const order = {
      id: 'order-1',
      userId: 'user-1',
      packageId: 'creator-credits',
      packageName: '创作者包',
      creditsAmount: 600,
      amountCents: 4990,
      currency: 'CNY',
      status: 'paid',
      paymentChannel: 'manual',
      paymentRef: 'manual:receipt-1',
      ledgerEntryId: 'ledger-1',
      refundLedgerEntryId: '',
      refundReason: '',
    };
    const refundEntry = { id: 'ledger-refund-1', amount: -600 };
    const refundedOrder = {
      ...order,
      status: 'refunded',
      refundLedgerEntryId: refundEntry.id,
      refundReason: 'customer_refund',
    };
    repo.findOrderById.mockReturnValue(order);
    creditsRepo.getBalance.mockReturnValue(700);
    creditsRepo.adjustInTx.mockReturnValue({ balance: 100, entry: refundEntry });
    repo.markOrderRefundedInTx = jest.fn(() => refundedOrder);

    const result = service.refundPaidOrder({
      orderId: 'order-1',
      reason: 'customer_refund',
    });

    expect(result).toEqual({
      order: refundedOrder,
      balance: 100,
      refundLedgerEntry: refundEntry,
      idempotent: false,
    });
    expect(creditsRepo.adjustInTx).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: -600,
      reason: 'customer_refund',
      refType: 'billing_order_refund',
      refId: 'order-1',
    });
    expect(repo.markOrderRefundedInTx).toHaveBeenCalledWith({
      orderId: 'order-1',
      refundLedgerEntryId: 'ledger-refund-1',
      refundReason: 'customer_refund',
    });
  });

  it('returns refunded orders idempotently without reversing credits again', () => {
    const order = {
      id: 'order-1',
      userId: 'user-1',
      status: 'refunded',
      paymentChannel: 'manual',
      paymentRef: 'manual:receipt-1',
      amountCents: 4990,
      currency: 'CNY',
      creditsAmount: 600,
      ledgerEntryId: 'ledger-1',
      refundLedgerEntryId: 'ledger-refund-1',
      refundReason: 'customer_refund',
    };
    repo.findOrderById.mockReturnValue(order);
    creditsRepo.getBalance.mockReturnValue(100);
    repo.markOrderRefundedInTx = jest.fn();

    expect(service.refundPaidOrder({ orderId: 'order-1' })).toEqual({
      order,
      balance: 100,
      refundLedgerEntry: null,
      idempotent: true,
    });
    expect(creditsRepo.adjustInTx).not.toHaveBeenCalled();
    expect(repo.markOrderRefundedInTx).not.toHaveBeenCalled();
  });

  it('rejects refunds when the user has spent the granted credits', () => {
    repo.findOrderById.mockReturnValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'paid',
      paymentChannel: 'manual',
      paymentRef: 'manual:receipt-1',
      amountCents: 4990,
      currency: 'CNY',
      creditsAmount: 600,
      ledgerEntryId: 'ledger-1',
      refundLedgerEntryId: '',
    });
    creditsRepo.getBalance.mockReturnValue(200);
    repo.markOrderRefundedInTx = jest.fn();

    expect(() => service.refundPaidOrder({ orderId: 'order-1' })).toThrow(
      '用户余额不足，无法扣回本订单积分',
    );
    expect(creditsRepo.adjustInTx).not.toHaveBeenCalled();
    expect(repo.markOrderRefundedInTx).not.toHaveBeenCalled();
  });
});
