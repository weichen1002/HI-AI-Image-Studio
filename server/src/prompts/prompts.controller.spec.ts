import { HttpException, HttpStatus } from '@nestjs/common';
import { PromptsController } from './prompts.controller';
import { DEFAULT_PRICING_SETTINGS } from '../db/repositories/system-settings.repo';

describe('PromptsController describe', () => {
  let hiapiService: any;
  let creditsRepo: any;
  let settingsRepo: any;
  let controller: PromptsController;
  const req = {
    user: {
      id: 'user-1',
      plan: 'free',
    },
  } as any;

  beforeEach(() => {
    hiapiService = {
      enhancePrompt: jest.fn(),
      describeImage: jest.fn(),
    };
    creditsRepo = {
      charge: jest.fn(),
      refund: jest.fn(),
    };
    settingsRepo = {
      getPricingSettings: jest.fn(() => DEFAULT_PRICING_SETTINGS),
    };
    controller = new PromptsController(hiapiService, creditsRepo, settingsRepo);
  });

  it('charges prompt tool credits and returns an editable prompt draft', async () => {
    hiapiService.describeImage.mockResolvedValue('商业摄影，白色背景，高级光影');

    const result = await controller.describe(req, {
      imageUrl: 'https://example.com/image.png',
      sourcePrompt: '旧提示词',
    });

    expect(result).toEqual({
      prompt: '商业摄影，白色背景，高级光影',
      cost: 1,
      billingReason: 'prompt_describe',
      billingPolicy: '按提示词工具价格计费；上游失败自动退回点数',
    });
    expect(creditsRepo.charge).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        cost: 1,
        reason: 'prompt_describe',
        refType: 'prompt',
      }),
    );
    expect(hiapiService.describeImage).toHaveBeenCalledWith({
      imageUrl: 'https://example.com/image.png',
      sourcePrompt: '旧提示词',
    });
  });

  it('checks prompt quality without charging or calling upstream', () => {
    const result = controller.check({ prompt: '咖啡' });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        billingPolicy: expect.stringContaining('免费规则检查'),
        improvedPrompt: expect.stringContaining('不要文字'),
      }),
    );
    expect(creditsRepo.charge).not.toHaveBeenCalled();
    expect(hiapiService.enhancePrompt).not.toHaveBeenCalled();
    expect(hiapiService.describeImage).not.toHaveBeenCalled();
  });

  it('rejects empty image input before charging', async () => {
    await expect(controller.describe(req, { imageUrl: '' })).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      message: '请先选择要反推的图片',
    });
    expect(creditsRepo.charge).not.toHaveBeenCalled();
    expect(hiapiService.describeImage).not.toHaveBeenCalled();
  });

  it('refunds charged credits when upstream describe fails', async () => {
    hiapiService.describeImage.mockRejectedValue(
      new HttpException('上游失败', HttpStatus.BAD_GATEWAY),
    );

    await expect(
      controller.describe(req, { imageUrl: 'data:image/png;base64,abc' }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_GATEWAY,
      message: '上游失败',
    });

    expect(creditsRepo.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: 1,
        reason: 'prompt_describe_refund',
        refType: 'prompt',
      }),
    );
  });
});
