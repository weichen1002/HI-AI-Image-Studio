import { HttpException } from '@nestjs/common';
import { AdminRedeemCodesController } from './admin-redeem-codes.controller';

describe('AdminRedeemCodesController audit coverage', () => {
  let controller: any;
  let auditLogsRepo: any;

  beforeEach(() => {
    auditLogsRepo = { create: jest.fn() };
    controller = new AdminRedeemCodesController(
      {
        findById: jest.fn(),
        update: jest.fn(),
        setEnabled: jest.fn(),
        create: jest.fn(),
        listAdminPaged: jest.fn(),
        listClaimsPaged: jest.fn(),
        getPlainCodeForAdmin: jest.fn(),
      } as any,
      auditLogsRepo,
    );
  });

  it('writes audit details for redeem code update and enable/disable', () => {
    const current = {
      id: 'code-1',
      title: 'Spring Code',
      codeMask: 'SPRI****2026',
      creditsAmount: 10,
      totalLimit: 5,
      expiresAt: null,
      enabled: true,
      type: 'campaign',
      redeemedCount: 1,
      plainCode: 'SPRING-2026',
    };
    const next = { ...current, title: 'Updated Code', creditsAmount: 20, enabled: false };
    controller.redeemCodesRepo.findById
      .mockReturnValueOnce(current)
      .mockReturnValueOnce(current)
      .mockReturnValueOnce(current);
    controller.redeemCodesRepo.update.mockReturnValue(next);
    controller.redeemCodesRepo.setEnabled.mockReturnValue(next);

    controller.update(
      { user: { id: 'admin-1' } },
      'code-1',
      { title: 'Updated Code', creditsAmount: 20, enabled: false },
    );
    controller.enable({ user: { id: 'admin-1' } }, 'code-1');
    controller.disable({ user: { id: 'admin-1' } }, 'code-1');

    expect(auditLogsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'redeem_code_updated',
        detail: expect.objectContaining({
          before: expect.objectContaining({
            title: 'Spring Code',
            creditsAmount: 10,
          }),
          after: expect.objectContaining({
            title: 'Updated Code',
            creditsAmount: 20,
          }),
        }),
      }),
    );
    expect(auditLogsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'redeem_code_enabled',
      }),
    );
    expect(auditLogsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'redeem_code_disabled',
      }),
    );
  });

  it('rejects bad redeem code updates before audit writes', () => {
    controller.redeemCodesRepo.findById.mockReturnValue({
      id: 'code-1',
      title: 'Spring Code',
      type: 'single',
      redeemedCount: 0,
    });

    expect(() =>
      controller.update(
        { user: { id: 'admin-1' } },
        'code-1',
        { totalLimit: 3 },
      ),
    ).toThrow(HttpException);
    expect(auditLogsRepo.create).not.toHaveBeenCalled();
  });
});
