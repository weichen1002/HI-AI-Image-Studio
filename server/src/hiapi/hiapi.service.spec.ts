import { HttpStatus } from '@nestjs/common';
import { config } from '../config';
import { HiapiService } from './hiapi.service';

describe('HiapiService describeImage', () => {
  const originalFetch = global.fetch;
  const originalApiKey = config.HIAPI_API_KEY;
  let settingsRepo: any;
  let service: HiapiService;

  beforeEach(() => {
    config.HIAPI_API_KEY = 'test-key';
    settingsRepo = {
      getModelSettings: jest.fn(() => ({
        baseUrl: 'https://hiapi.test/v1',
        textModel: 'gpt-4.1-mini',
        timeoutMs: 1000,
      })),
    };
    service = new HiapiService(settingsRepo);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    config.HIAPI_API_KEY = originalApiKey;
  });

  it('sends image input to Responses API and returns prompt text', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          output_text: '高级商业摄影提示词',
          output: [],
        }),
      ),
    });

    const result = await service.describeImage({
      imageUrl: 'https://example.com/result.png',
      sourcePrompt: '原始提示词',
    });

    expect(result).toBe('高级商业摄影提示词');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://hiapi.test/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
      }),
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.model).toBe('gpt-4.1-mini');
    expect(body.input[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'input_text',
          text: expect.stringContaining('原始提示词'),
        }),
        {
          type: 'input_image',
          image_url: 'https://example.com/result.png',
        },
      ]),
    );
  });

  it('fails clearly when text model is not configured', async () => {
    settingsRepo.getModelSettings.mockReturnValue({
      baseUrl: 'https://hiapi.test/v1',
      textModel: '',
      timeoutMs: 1000,
    });

    await expect(
      service.describeImage({ imageUrl: 'https://example.com/result.png' }),
    ).rejects.toMatchObject({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '请先在 .env 中配置 HIAPI_TEXT_MODEL',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
