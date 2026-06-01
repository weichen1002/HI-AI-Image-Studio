import { HiapiController } from './hiapi.controller';

describe('HiapiController', () => {
  it('returns current model capabilities from settings', () => {
    const controller = new HiapiController({
      getModelSettings: jest.fn(() => ({
        baseUrl: 'https://hiapi.test/v1',
        imageModel: 'gpt-image-1',
        cutoutModel: '',
        textModel: 'gpt-4.1-mini',
        timeoutMs: 60000,
        responseFormat: 'b64_json',
        sizeFormat: 'pixel',
      })),
    } as any);

    expect(controller.getCapabilities()).toEqual({
      capabilities: expect.objectContaining({
        generation: expect.objectContaining({
          aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
          outputFormats: ['png', 'jpeg', 'webp'],
        }),
        features: expect.objectContaining({
          textToImage: true,
          imageToImage: true,
          dialogue: true,
          describe: true,
        }),
      }),
    });
  });
});
