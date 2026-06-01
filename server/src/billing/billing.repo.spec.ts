import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('BillingRepo', () => {
  let sqliteFile = '';
  let sqlite: any;
  let repo: any;

  beforeEach(() => {
    sqliteFile = path.join(
      os.tmpdir(),
      `hi-image-billing-repo-${Date.now()}-${Math.random()}.db`,
    );
    process.env.SQLITE_FILE = sqliteFile;
    jest.resetModules();
    const { SqliteService } = require('../db/sqlite.service');
    const { BillingRepo } = require('./billing.repo');
    sqlite = new SqliteService();
    sqlite.onModuleInit();
    repo = new BillingRepo(sqlite);
  });

  afterEach(() => {
    sqlite.connection.close();
    for (const filePath of [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`]) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('seeds active billing packages', () => {
    const packages = repo.listActivePackages();

    expect(packages.length).toBeGreaterThanOrEqual(3);
    expect(packages[0]).toEqual(
      expect.objectContaining({
        id: 'starter-credits',
        creditsAmount: 100,
        priceCents: 990,
        active: true,
      }),
    );
  });

  it('creates pending orders without granting credits', () => {
    const pkg = repo.findPackageById('creator-credits');

    const order = repo.createPendingOrder({
      userId: 'user-1',
      pkg,
      paymentChannel: 'mock',
    });
    const result = repo.listOrdersPaged({ userId: 'user-1', limit: 10, offset: 0 });
    const ledgerCount = sqlite.connection
      .prepare('SELECT COUNT(1) AS c FROM credit_ledgers')
      .get();

    expect(order).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        packageId: 'creator-credits',
        status: 'pending',
        paymentChannel: 'mock',
        ledgerEntryId: '',
      }),
    );
    expect(result.total).toBe(1);
    expect(result.orders[0]).toEqual(expect.objectContaining({ id: order.id }));
    expect(ledgerCount).toEqual({ c: 0 });
  });

  it('marks pending orders paid once with ledger reference', () => {
    const pkg = repo.findPackageById('starter-credits');
    const order = repo.createPendingOrder({
      userId: 'user-1',
      pkg,
      paymentChannel: 'manual',
    });

    const paid = repo.markOrderPaidInTx({
      orderId: order.id,
      ledgerEntryId: 'ledger-1',
      paymentRef: 'manual:receipt-1',
      paidAt: '2026-05-29T00:00:00.000Z',
    });
    const second = repo.markOrderPaidInTx({
      orderId: order.id,
      ledgerEntryId: 'ledger-2',
      paymentRef: 'manual:receipt-2',
      paidAt: '2026-05-29T00:01:00.000Z',
    });

    expect(paid).toEqual(
      expect.objectContaining({
        id: order.id,
        status: 'paid',
        ledgerEntryId: 'ledger-1',
        paymentRef: 'manual:receipt-1',
        paidAt: '2026-05-29T00:00:00.000Z',
      }),
    );
    expect(second).toBeNull();
    expect(repo.findOrderById(order.id)).toEqual(
      expect.objectContaining({
        status: 'paid',
        ledgerEntryId: 'ledger-1',
        paymentRef: 'manual:receipt-1',
      }),
    );
  });

  it('marks paid orders refunded once with reversal ledger reference', () => {
    const pkg = repo.findPackageById('starter-credits');
    const order = repo.createPendingOrder({
      userId: 'user-1',
      pkg,
      paymentChannel: 'manual',
    });
    repo.markOrderPaidInTx({
      orderId: order.id,
      ledgerEntryId: 'ledger-1',
      paymentRef: 'manual:receipt-1',
      paidAt: '2026-05-29T00:00:00.000Z',
    });

    const refunded = repo.markOrderRefundedInTx({
      orderId: order.id,
      refundLedgerEntryId: 'ledger-refund-1',
      refundReason: 'customer_refund',
      refundedAt: '2026-05-29T00:10:00.000Z',
    });
    const second = repo.markOrderRefundedInTx({
      orderId: order.id,
      refundLedgerEntryId: 'ledger-refund-2',
      refundReason: 'duplicate_refund',
      refundedAt: '2026-05-29T00:11:00.000Z',
    });

    expect(refunded).toEqual(
      expect.objectContaining({
        id: order.id,
        status: 'refunded',
        ledgerEntryId: 'ledger-1',
        refundLedgerEntryId: 'ledger-refund-1',
        refundReason: 'customer_refund',
        refundedAt: '2026-05-29T00:10:00.000Z',
      }),
    );
    expect(second).toBeNull();
    expect(repo.findOrderById(order.id)).toEqual(
      expect.objectContaining({
        status: 'refunded',
        refundLedgerEntryId: 'ledger-refund-1',
        refundReason: 'customer_refund',
      }),
    );
  });
});
