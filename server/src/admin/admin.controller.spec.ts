import { HttpException } from '@nestjs/common';
import { AdminController } from './admin.controller';

describe('AdminController audit coverage', () => {
  let controller: any;
  let auditLogsRepo: any;
  let imageFeedbackRepo: any;

  beforeEach(() => {
    auditLogsRepo = { create: jest.fn() };
    imageFeedbackRepo = {
      deleteAllByUser: jest.fn(),
      listSamples: jest.fn(() => ({ items: [], total: 0 })),
    };
    controller = new AdminController(
      {
        findById: jest.fn(),
        listPaged: jest.fn(),
        updateRole: jest.fn(),
        updateStatus: jest.fn(),
        updatePasswordHash: jest.fn(),
        deleteById: jest.fn(),
      } as any,
      {
        adjust: jest.fn(),
        listByUserPaged: jest.fn(),
      } as any,
      { getPricingSettings: jest.fn(), getUploadSettings: jest.fn(), getModelSettings: jest.fn() } as any,
      {
        transaction: jest.fn((fn: any) => fn()),
        connection: { prepare: jest.fn(() => ({ run: jest.fn(), get: jest.fn(), all: jest.fn() })) },
      } as any,
      { listAssetUrlsByUser: jest.fn(() => []), deleteAllByUser: jest.fn() } as any,
      { deleteAllByUser: jest.fn() } as any,
      auditLogsRepo,
      imageFeedbackRepo,
    );
  });

  it('writes audit details for credits adjustment, role update, status update, and delete', async () => {
    const user = {
      id: 'user-1',
      username: 'alice',
      role: 'user',
      status: 'active',
      plan: 'free',
      creditBalance: 100,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    controller.usersRepo.findById.mockReturnValue(user);
    controller.creditsRepo.adjust.mockReturnValue({
      balance: 80,
      entry: { id: 'ledger-1', amount: -20, reason: 'manual_adjust' },
    });
    controller.usersRepo.updateRole.mockReturnValue(undefined);
    controller.usersRepo.updateStatus.mockReturnValue(undefined);
    controller.usersRepo.deleteById.mockReturnValue(undefined);
    controller.imagesRepo.listAssetUrlsByUser.mockReturnValue(['/uploads/a.png']);

    await controller.adjustCredits('user-1', { amount: -20, reason: 'manual_adjust' }, {
      user: { id: 'admin-1' },
      headers: { 'x-forwarded-for': '127.0.0.1', 'user-agent': 'jest' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any);
    controller.updateRole('user-1', { role: 'admin' }, {
      user: { id: 'admin-1' },
      headers: { 'x-forwarded-for': '127.0.0.1', 'user-agent': 'jest' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any);
    controller.updateStatus('user-1', { status: 'banned' }, {
      user: { id: 'admin-1' },
      headers: { 'x-forwarded-for': '127.0.0.1', 'user-agent': 'jest' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any);
    await controller.deleteUser('user-1', {
      user: { id: 'admin-1' },
      headers: { 'x-forwarded-for': '127.0.0.1', 'user-agent': 'jest' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any);

    expect(auditLogsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user_credits_adjusted',
        detail: expect.objectContaining({
          before: { creditBalance: 100 },
          after: { creditBalance: 80 },
          amount: -20,
          reason: 'manual_adjust',
        }),
      }),
    );
    expect(auditLogsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user_role_updated',
        detail: expect.objectContaining({
          before: { role: 'user' },
          after: { role: 'admin' },
        }),
      }),
    );
    expect(auditLogsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user_banned',
        detail: expect.objectContaining({
          before: { status: 'active' },
          after: { status: 'banned' },
        }),
      }),
    );
    expect(auditLogsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user_deleted',
        detail: expect.objectContaining({
          before: expect.objectContaining({
            username: 'alice',
            role: 'user',
          }),
          deletedAssets: 1,
        }),
      }),
    );
    expect(imageFeedbackRepo.deleteAllByUser).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('lists low score feedback samples with normalized filters', () => {
    imageFeedbackRepo.listSamples.mockReturnValue({
      items: [{ imageId: 'image-1', rating: 'dislike', issueType: 'bad_quality' }],
      total: 1,
    });

    expect(
      controller.listImageFeedback('dislike', 'bad_quality', '1', '2', '10'),
    ).toEqual({
      samples: [{ imageId: 'image-1', rating: 'dislike', issueType: 'bad_quality' }],
      total: 1,
      page: 2,
      limit: 10,
    });
    expect(imageFeedbackRepo.listSamples).toHaveBeenCalledWith({
      rating: 'dislike',
      issueType: 'bad_quality',
      lowOnly: true,
      limit: 10,
      offset: 10,
    });
  });

  it('returns dashboard metrics for a bounded time range', () => {
    const prepared: any[] = [
      { get: jest.fn(() => ({ totalUsers: 10, activeUsers: 8, newUsers: 2, activeInRange: 4 })) },
      { get: jest.fn(() => ({ totalJobs: 20, succeededJobs: 15, failedJobs: 5, activeJobs: 1 })) },
      { get: jest.fn(() => ({ consumed: 30, credited: 100, ledgerCount: 6 })) },
      { get: jest.fn(() => ({ totalOrders: 5, paidOrders: 3, pendingOrders: 1, refundedOrders: 1, revenueCents: 12900 })) },
      { all: jest.fn(() => [{ reason: 'upstream timeout', count: 2 }]) },
      { all: jest.fn(() => [{ reason: 'bad_quality', count: 3 }]) },
    ];
    let index = 0;
    controller.sqlite.connection.prepare.mockImplementation(() => prepared[index++]);

    expect(controller.getDashboard('7d')).toEqual(
      expect.objectContaining({
        range: '7d',
        users: { total: 10, active: 8, newInRange: 2, activeInRange: 4 },
        jobs: expect.objectContaining({ total: 20, succeeded: 15, failed: 5, successRate: 75 }),
        credits: { consumed: 30, credited: 100, ledgerCount: 6 },
        orders: expect.objectContaining({ total: 5, paid: 3, revenueCents: 12900, payRate: 60 }),
        failureReasons: [{ reason: 'upstream timeout', count: 2 }],
        feedbackReasons: [{ reason: 'bad_quality', count: 3 }],
      }),
    );
    expect(prepared[0].get.mock.calls[0]).toHaveLength(2);
    expect(prepared[1].get.mock.calls[0]).toHaveLength(1);
  });

  it('exports filtered users as masked CSV with row limit metadata', () => {
    controller.usersRepo.listPaged.mockReturnValue({
      users: [{
        id: 'user-abcdefghijklmnopqrstuvwxyz',
        username: '=alice',
        plan: 'pro',
        role: 'admin',
        status: 'active',
        creditBalance: 20,
        createdAt: '2026-01-01T00:00:00.000Z',
        lastUsedAt: '2026-01-02T00:00:00.000Z',
      }],
      total: 1500,
    });

    const csv = controller.exportUsers('ali', 'pro', 'admin', 'active', '1', '30', '0');

    expect(controller.usersRepo.listPaged).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'ali',
        plan: 'pro',
        role: 'admin',
        status: 'active',
        minBalance: 1,
        maxBalance: 30,
        lowBalanceOnly: false,
        limit: 1000,
        offset: 0,
      }),
    );
    expect(csv).toContain('# maxRows=1000');
    expect(csv).toContain('# totalMatched=1500');
    expect(csv).toContain('"user-a...wxyz"');
    expect(csv).toContain('"\'=alice"');
    expect(csv).not.toContain('password');
  });

  it('exports audit logs without full user-agent values', () => {
    auditLogsRepo.listPaged = jest.fn(() => ({
      entries: [{
        id: 'audit-abcdefghijklmnopqrstuvwxyz',
        actorUserId: 'actor-abcdefghijklmnopqrstuvwxyz',
        targetUserId: 'target-abcdefghijklmnopqrstuvwxyz',
        category: 'admin',
        action: 'user_deleted',
        status: 'success',
        ip: '127.0.0.1',
        userAgent: 'very sensitive browser details',
        detail: { username: 'alice' },
        createdAt: '2026-01-01T00:00:00.000Z',
      }],
      total: 1,
    }));

    const csv = controller.exportAuditLogs('admin', 'user_deleted', 'success', 'target-1');

    expect(auditLogsRepo.listPaged).toHaveBeenCalledWith({
      category: 'admin',
      action: 'user_deleted',
      status: 'success',
      userId: 'target-1',
      limit: 1000,
      offset: 0,
    });
    expect(csv).toContain('"audit-...wxyz"');
    expect(csv).toContain('"{""username"":""alice""}"');
    expect(csv).not.toContain('very sensitive browser details');
  });

  it('requires a user id for ledger export', () => {
    expect(() => controller.exportLedger('', '')).toThrow(HttpException);
  });

  it('rejects invalid role changes before audit writes', () => {
    controller.usersRepo.findById.mockReturnValue({
      role: 'user',
      username: 'alice',
    });

    expect(() =>
      controller.updateRole('user-1', { role: 'superadmin' }, { user: { id: 'admin-1' } } as any),
    ).toThrow(HttpException);
    expect(auditLogsRepo.create).not.toHaveBeenCalled();
  });
});
