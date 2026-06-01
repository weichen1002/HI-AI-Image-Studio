import { HttpException, HttpStatus } from '@nestjs/common';
import type { ModelSettings } from '../db/repositories/system-settings.repo';

export const MODEL_CAPABILITY_OPTIONS = {
  aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
  qualityTiers: ['1k', '2k', '4k'],
  counts: [1, 2, 4],
  outputFormats: ['png', 'jpeg', 'webp'],
  backgrounds: ['auto', 'transparent', 'opaque'],
  moderationLevels: ['auto', 'low'],
  editSizes: ['auto', '1024x1024', '1536x1024', '1024x1536'],
  editQualities: ['auto', 'low', 'medium', 'high'],
} as const;

export type ModelCapabilityMode = 'text' | 'image' | 'dialogue' | 'tools';

export type ModelCapabilities = {
  model: {
    imageModel: string;
    cutoutModel: string;
    textModel: string;
    sizeFormat: ModelSettings['sizeFormat'];
    responseFormat: ModelSettings['responseFormat'];
  };
  generation: {
    aspectRatios: string[];
    qualityTiers: string[];
    counts: number[];
    outputFormats: string[];
    backgrounds: string[];
    moderationLevels: string[];
  };
  edit: {
    sizes: string[];
    qualities: string[];
    operations: string[];
  };
  features: {
    textToImage: boolean;
    imageToImage: boolean;
    dialogue: boolean;
    describe: boolean;
    promptEnhance: boolean;
    cutout: boolean;
    transparentBackground: boolean;
  };
};

function hasValue(value: string) {
  return Boolean(String(value || '').trim());
}

export function getModelCapabilities(settings: ModelSettings): ModelCapabilities {
  const hasImageModel = hasValue(settings.imageModel);
  const hasTextModel = hasValue(settings.textModel);
  const hasCutoutModel = hasValue(settings.cutoutModel) || hasImageModel;

  return {
    model: {
      imageModel: settings.imageModel,
      cutoutModel: settings.cutoutModel,
      textModel: settings.textModel,
      sizeFormat: settings.sizeFormat,
      responseFormat: settings.responseFormat,
    },
    generation: {
      aspectRatios: [...MODEL_CAPABILITY_OPTIONS.aspectRatios],
      qualityTiers: [...MODEL_CAPABILITY_OPTIONS.qualityTiers],
      counts: [...MODEL_CAPABILITY_OPTIONS.counts],
      outputFormats: [...MODEL_CAPABILITY_OPTIONS.outputFormats],
      backgrounds: [...MODEL_CAPABILITY_OPTIONS.backgrounds],
      moderationLevels: [...MODEL_CAPABILITY_OPTIONS.moderationLevels],
    },
    edit: {
      sizes: [...MODEL_CAPABILITY_OPTIONS.editSizes],
      qualities: [...MODEL_CAPABILITY_OPTIONS.editQualities],
      operations: ['inpaint', 'outpaint', 'cutout', 'upscale'],
    },
    features: {
      textToImage: hasImageModel,
      imageToImage: hasImageModel,
      dialogue: hasTextModel,
      describe: hasTextModel,
      promptEnhance: hasTextModel,
      cutout: hasCutoutModel,
      transparentBackground: hasImageModel,
    },
  };
}

function assertSupported<T>(
  value: T,
  allowed: readonly T[] | T[],
  message: string,
) {
  if (!allowed.includes(value)) {
    throw new HttpException(message, HttpStatus.BAD_REQUEST);
  }
}

export function assertGenerationRequestSupported(
  capabilities: ModelCapabilities,
  params: {
    mode: ModelCapabilityMode;
    aspectRatio: string;
    qualityTier: string;
    count: number;
    outputFormat: string;
    background: string;
    moderation: string;
  },
) {
  if (params.mode === 'dialogue' && !capabilities.features.dialogue) {
    throw new HttpException('当前文本模型未配置，暂不支持对话创作', HttpStatus.BAD_REQUEST);
  }
  if (params.mode !== 'dialogue' && !capabilities.features.textToImage) {
    throw new HttpException('当前图片模型未配置，暂不支持生成图片', HttpStatus.BAD_REQUEST);
  }

  assertSupported(params.aspectRatio, capabilities.generation.aspectRatios, '当前模型不支持该画面比例');
  assertSupported(params.qualityTier, capabilities.generation.qualityTiers, '当前模型不支持该质量档位');
  assertSupported(params.count, capabilities.generation.counts, '当前模型不支持该生成数量');
  assertSupported(params.outputFormat, capabilities.generation.outputFormats, '当前模型不支持该输出格式');
  assertSupported(params.background, capabilities.generation.backgrounds, '当前模型不支持该背景策略');
  assertSupported(params.moderation, capabilities.generation.moderationLevels, '当前模型不支持该审核等级');

  if (params.background === 'transparent' && params.outputFormat === 'jpeg') {
    throw new HttpException('透明背景仅支持 PNG 或 WEBP 输出', HttpStatus.BAD_REQUEST);
  }
}

export function assertEditRequestSupported(
  capabilities: ModelCapabilities,
  params: {
    operationType: string;
    size: string;
    quality: string;
  },
) {
  if (!capabilities.features.imageToImage) {
    throw new HttpException('当前图片模型未配置，暂不支持图片编辑', HttpStatus.BAD_REQUEST);
  }
  assertSupported(params.operationType, capabilities.edit.operations, '当前模型不支持该编辑类型');
  assertSupported(params.size, capabilities.edit.sizes, '当前模型不支持该输出尺寸');
  assertSupported(params.quality, capabilities.edit.qualities, '当前模型不支持该生成质量');
  if (params.operationType === 'cutout' && !capabilities.features.cutout) {
    throw new HttpException('当前模型未配置抠图能力', HttpStatus.BAD_REQUEST);
  }
}
