import { HttpStatus } from '@nestjs/common';
import {
  assertEditRequestSupported,
  assertGenerationRequestSupported,
  getModelCapabilities,
} from './model-capabilities';
import type { ModelSettings } from '../db/repositories/system-settings.repo';

const baseSettings: ModelSettings = {
  baseUrl: 'https://hiapi.test/v1',
  imageModel: 'gpt-image-1',
  cutoutModel: '',
  textModel: 'gpt-4.1-mini',
  timeoutMs: 60000,
  responseFormat: 'b64_json',
  sizeFormat: 'pixel',
};

describe('model capabilities', () => {
  it('derives generation and feature capabilities from model settings', () => {
    const capabilities = getModelCapabilities(baseSettings);

    expect(capabilities.generation.aspectRatios).toEqual(['1:1', '16:9', '9:16', '4:3', '3:4']);
    expect(capabilities.generation.qualityTiers).toEqual(['1k', '2k', '4k']);
    expect(capabilities.generation.outputFormats).toEqual(['png', 'jpeg', 'webp']);
    expect(capabilities.features).toMatchObject({
      textToImage: true,
      imageToImage: true,
      dialogue: true,
      describe: true,
      promptEnhance: true,
      transparentBackground: true,
    });
  });

  it('rejects unsupported generation parameters before hitting upstream', () => {
    const capabilities = getModelCapabilities(baseSettings);

    expect(() =>
      assertGenerationRequestSupported(capabilities, {
        mode: 'text',
        aspectRatio: '21:9',
        qualityTier: '1k',
        count: 1,
        outputFormat: 'png',
        background: 'auto',
        moderation: 'auto',
      }),
    ).toThrow(expect.objectContaining({
      status: HttpStatus.BAD_REQUEST,
      message: '当前模型不支持该画面比例',
    }));
  });

  it('rejects transparent jpeg combinations centrally', () => {
    const capabilities = getModelCapabilities(baseSettings);

    expect(() =>
      assertGenerationRequestSupported(capabilities, {
        mode: 'text',
        aspectRatio: '1:1',
        qualityTier: '1k',
        count: 1,
        outputFormat: 'jpeg',
        background: 'transparent',
        moderation: 'auto',
      }),
    ).toThrow(expect.objectContaining({
      status: HttpStatus.BAD_REQUEST,
      message: '透明背景仅支持 PNG 或 WEBP 输出',
    }));
  });

  it('rejects dialogue when text model is missing', () => {
    const capabilities = getModelCapabilities({
      ...baseSettings,
      textModel: '',
    });

    expect(capabilities.features.dialogue).toBe(false);
    expect(() =>
      assertGenerationRequestSupported(capabilities, {
        mode: 'dialogue',
        aspectRatio: '1:1',
        qualityTier: '1k',
        count: 1,
        outputFormat: 'png',
        background: 'auto',
        moderation: 'auto',
      }),
    ).toThrow(expect.objectContaining({
      status: HttpStatus.BAD_REQUEST,
      message: '当前文本模型未配置，暂不支持对话创作',
    }));
  });

  it('validates edit operations and sizes', () => {
    const capabilities = getModelCapabilities(baseSettings);

    expect(() =>
      assertEditRequestSupported(capabilities, {
        operationType: 'inpaint',
        size: '512x512',
        quality: 'auto',
      }),
    ).toThrow(expect.objectContaining({
      status: HttpStatus.BAD_REQUEST,
      message: '当前模型不支持该输出尺寸',
    }));
  });
});
