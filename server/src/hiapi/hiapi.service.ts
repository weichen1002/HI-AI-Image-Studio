import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { config } from '../config';
import * as fs from 'fs/promises';
import { SystemSettingsRepo } from '../db/repositories/system-settings.repo';

export type SupportedImageSize =
  | 'auto'
  | '1024x1024'
  | '1536x1024'
  | '1024x1536';
export type SupportedImageQuality = 'auto' | 'low' | 'medium' | 'high';
export type SupportedOutputFormat = 'png' | 'jpeg' | 'webp';
export type SupportedBackground = 'auto' | 'transparent' | 'opaque';
export type SupportedModeration = 'auto' | 'low';

export function sizeForSub2api(aspectRatio: string, sizeFormat: string) {
  if (sizeFormat === 'ratio') return aspectRatio;
  return (
    {
      '1:1': '1024x1024',
      '16:9': '1536x1024',
      '9:16': '1024x1536',
      '4:3': '1536x1024',
      '3:4': '1024x1536',
      auto: '1024x1024',
    }[aspectRatio] || '1024x1024'
  );
}

function resolveRequestedSize(
  aspectRatio: string,
  sizeFormat: string,
  requestedSize?: SupportedImageSize,
) {
  if (requestedSize && requestedSize !== 'auto') {
    return requestedSize;
  }
  return sizeForSub2api(aspectRatio, sizeFormat);
}

function sizeForQualityTier(
  aspectRatio: string,
  qualityTier: '1k' | '2k' | '4k',
) {
  const map = {
    '1:1': {
      '1k': '1024x1024',
      '2k': '2048x2048',
      '4k': '2880x2880',
    },
    '16:9': {
      '1k': '1536x1024',
      '2k': '2048x1152',
      '4k': '3584x2016',
    },
    '9:16': {
      '1k': '1024x1536',
      '2k': '1152x2048',
      '4k': '2016x3584',
    },
    '4:3': {
      '1k': '1536x1024',
      '2k': '2048x1536',
      '4k': '3072x2304',
    },
    '3:4': {
      '1k': '1024x1536',
      '2k': '1536x2048',
      '4k': '2304x3072',
    },
    auto: {
      '1k': '1024x1024',
      '2k': '2048x2048',
      '4k': '2880x2880',
    },
  } as const;
  return map[aspectRatio as keyof typeof map]?.[qualityTier] || '1024x1024';
}

function qualityForTier(qualityTier: '1k' | '2k' | '4k') {
  return (
    {
      '1k': 'low',
      '2k': 'medium',
      '4k': 'high',
    }[qualityTier] || 'medium'
  ) as SupportedImageQuality;
}

function mimeTypeForOutputFormat(outputFormat: SupportedOutputFormat) {
  return (
    {
      png: 'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    }[outputFormat] || 'image/png'
  );
}

function isGptImageModel(model: string) {
  const normalizedModel = String(model || '').trim().toLowerCase();
  return (
    normalizedModel.startsWith('gpt-image') ||
    normalizedModel === 'chatgpt-image-latest'
  );
}

function normalizeResponseFormat(
  model: string,
  responseFormat: 'url' | 'b64_json',
) {
  // GPT Image 官方固定返回 base64，这里不再向上游传 `response_format`。
  if (isGptImageModel(model)) return '';
  return responseFormat === 'b64_json' ? 'b64_json' : 'url';
}

export function imageSourceFromResult(
  item: any,
  fallbackMimeType: string = 'image/png',
): string {
  if (item?.url) return item.url;
  const mimeType =
    typeof item?.mime_type === 'string' && item.mime_type
      ? item.mime_type
      : fallbackMimeType;
  if (item?.b64_json) return `data:${mimeType};base64,${item.b64_json}`;
  return '';
}

function readJsonSafely(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function normalizeHiapiError(error: any) {
  const message =
    error?.name === 'AbortError'
      ? 'HiAPI 请求超时，请稍后重试'
      : `HiAPI 网络请求失败：${error?.cause?.code || error?.message || 'unknown'}`;
  return new HttpException(message, HttpStatus.BAD_GATEWAY);
}

function collectMessageText(output: any[]) {
  const texts: string[] = [];
  for (const item of output) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      const text = String(
        content?.text || content?.output_text || content?.value || '',
      ).trim();
      if (text) texts.push(text);
    }
  }
  return texts.join('\n').trim();
}

function collectResponseImages(output: any[], fallbackMimeType: string) {
  const imageUrls: string[] = [];
  for (const item of output) {
    if (item?.type !== 'image_generation_call') continue;
    const results = Array.isArray(item.result) ? item.result : [item.result];
    for (const result of results) {
      if (typeof result === 'string' && result.trim()) {
        imageUrls.push(`data:${fallbackMimeType};base64,${result}`);
        continue;
      }
      if (result?.b64_json) {
        imageUrls.push(`data:${fallbackMimeType};base64,${result.b64_json}`);
      }
      if (result?.image_url) {
        imageUrls.push(String(result.image_url));
      }
    }
  }
  return imageUrls.filter(Boolean);
}

function shouldFallbackToReplay(error: any) {
  const status = Number(error?.getStatus?.() || error?.status || 0);
  const message = String(error?.message || '').toLowerCase();
  return (
    [400, 404, 409, 422, 500, 502].includes(status) ||
    message.includes('previous_response_id') ||
    message.includes('previous response') ||
    message.includes('response_id') ||
    message.includes('unsupported') ||
    message.includes('upstream request failed') ||
    message.includes('未返回图片结果')
  );
}

async function parseHiapiResponse(
  response: Response,
  fallbackMimeType: string = 'image/png',
) {
  const text = await response.text();
  const data = readJsonSafely(text);

  if (!response.ok) {
    const message =
      data?.error?.message || data?.message || text || '生图请求失败';
    throw new HttpException(message, response.status);
  }

  if (data?.error) {
    const message = data.error.message || data.error || '生图请求失败';
    throw new HttpException(message, HttpStatus.BAD_GATEWAY);
  }

  const items = Array.isArray(data?.data) ? data.data : [];
  const imageUrls = items
    .map((item: any) => imageSourceFromResult(item, fallbackMimeType))
    .filter(Boolean);
  const content = items
    .map((item: any) => item.revised_prompt || item.prompt || '')
    .filter(Boolean)
    .join('\n');

  if (imageUrls.length === 0) {
    throw new HttpException('HiAPI 返回结果为空', HttpStatus.BAD_GATEWAY);
  }

  return { content, imageUrls };
}

async function parseChatResponse(response: Response) {
  const text = await response.text();
  const data = readJsonSafely(text);

  if (!response.ok) {
    const message = data?.error?.message || data?.message || text || '请求失败';
    throw new HttpException(message, response.status);
  }

  if (data?.error) {
    const message = data.error.message || data.error || '请求失败';
    throw new HttpException(message, HttpStatus.BAD_GATEWAY);
  }

  const content =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.output_text ||
    '';

  if (!String(content || '').trim()) {
    throw new HttpException('HiAPI 返回结果为空', HttpStatus.BAD_GATEWAY);
  }

  return String(content).trim();
}

async function parseResponsesImageResponse(
  response: Response,
  fallbackMimeType: string = 'image/png',
) {
  const text = await response.text();
  const data = readJsonSafely(text);

  if (!response.ok) {
    const message = data?.error?.message || data?.message || text || '请求失败';
    throw new HttpException(message, response.status);
  }

  if (data?.error) {
    const message = data.error.message || data.error || '请求失败';
    throw new HttpException(message, HttpStatus.BAD_GATEWAY);
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  const imageUrls = collectResponseImages(output, fallbackMimeType);
  const content =
    String(data?.output_text || '').trim() || collectMessageText(output);
  const responseId = String(data?.id || '').trim();

  if (!responseId) {
    throw new HttpException('Responses API 未返回 response_id', HttpStatus.BAD_GATEWAY);
  }
  if (!imageUrls.length) {
    throw new HttpException('Responses API 未返回图片结果', HttpStatus.BAD_GATEWAY);
  }

  return {
    responseId,
    content,
    imageUrls,
    outputItems: output,
  };
}

@Injectable()
export class HiapiService {
  constructor(private readonly settingsRepo: SystemSettingsRepo) {}

  private async generateSingleImage(params: {
    prompt: string;
    size: string;
    quality: SupportedImageQuality;
    outputFormat: SupportedOutputFormat;
    outputCompression?: number;
    background?: SupportedBackground;
    moderation?: SupportedModeration;
  }) {
    const modelSettings = this.settingsRepo.getModelSettings();
    const imageModel = String(modelSettings.imageModel || '').trim();
    const responseFormat = normalizeResponseFormat(
      imageModel,
      modelSettings.responseFormat,
    );
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      modelSettings.timeoutMs,
    );
    let response: Response;

    try {
      response = await fetch(`${modelSettings.baseUrl}/images/generations`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.HIAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: imageModel,
          prompt: params.prompt,
          n: 1,
          size: params.size,
          quality: params.quality,
          output_format: params.outputFormat,
          ...(params.outputFormat !== 'png' &&
          Number.isFinite(params.outputCompression)
            ? { output_compression: params.outputCompression }
            : {}),
          background: params.background || 'auto',
          moderation: params.moderation || 'auto',
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
      });
    } catch (error: any) {
      throw normalizeHiapiError(error);
    } finally {
      clearTimeout(timeout);
    }

    return parseHiapiResponse(
      response,
      mimeTypeForOutputFormat(params.outputFormat),
    );
  }

  async generateImage(
    prompt: string,
    aspectRatio: string,
    options?: {
      size?: SupportedImageSize;
      quality?: SupportedImageQuality;
      qualityTier?: '1k' | '2k' | '4k';
      count?: number;
      outputFormat?: SupportedOutputFormat;
      outputCompression?: number;
      background?: SupportedBackground;
      moderation?: SupportedModeration;
    },
  ) {
    const modelSettings = this.settingsRepo.getModelSettings();
    const qualityTier = options?.qualityTier || '1k';
    const requestedSize = resolveRequestedSize(
      aspectRatio,
      modelSettings.sizeFormat,
      options?.size,
    );
    const size =
      options?.size && options.size !== 'auto'
        ? requestedSize
        : sizeForQualityTier(aspectRatio, qualityTier);
    const quality = options?.quality || qualityForTier(qualityTier);
    const count = Math.max(1, Math.min(4, Math.floor(options?.count || 1)));
    const outputFormat = options?.outputFormat || 'png';
    const outputCompression = Number.isFinite(options?.outputCompression)
      ? Math.max(0, Math.min(100, Math.floor(options?.outputCompression || 0)))
      : 100;
    const background = options?.background || 'auto';
    const moderation = options?.moderation || 'auto';

    const results = await Promise.all(
      Array.from({ length: count }, () =>
        this.generateSingleImage({
          prompt,
          size,
          quality,
          outputFormat,
          outputCompression,
          background,
          moderation,
        }),
      ),
    );

    return {
      content: results.map((item) => item.content).filter(Boolean).join('\n'),
      imageUrls: results.flatMap((item) => item.imageUrls),
    };
  }

  async editImageFromFiles(params: {
    imageFiles: Array<{
      filePath: string;
      fileType: string;
      fileName: string;
    }>;
    prompt: string;
    aspectRatio: string;
    size?: SupportedImageSize;
    quality?: SupportedImageQuality;
    qualityTier?: '1k' | '2k' | '4k';
    count?: number;
    outputFormat?: SupportedOutputFormat;
    outputCompression?: number;
    background?: SupportedBackground;
    moderation?: SupportedModeration;
    modelOverride?: string;
    maskFilePath?: string;
    maskFileType?: string;
    maskFileName?: string;
  }) {
    const modelSettings = this.settingsRepo.getModelSettings();
    const requestedSize = resolveRequestedSize(
      params.aspectRatio,
      modelSettings.sizeFormat,
      params.size,
    );
    const qualityTier = params.qualityTier || '1k';
    const size =
      params.size && params.size !== 'auto'
        ? requestedSize
        : sizeForQualityTier(params.aspectRatio, qualityTier);
    const quality = params.quality || qualityForTier(qualityTier);
    const outputFormat = params.outputFormat || 'png';
    const count = Math.max(1, Math.min(4, Math.floor(params.count || 1)));
    const outputCompression = Number.isFinite(params.outputCompression)
      ? Math.max(0, Math.min(100, Math.floor(params.outputCompression || 0)))
      : 100;
    const background = params.background || 'auto';
    const moderation = params.moderation || 'auto';
    const effectiveModel = String(
      params.modelOverride || modelSettings.imageModel || '',
    ).trim();
    const responseFormat = normalizeResponseFormat(
      effectiveModel,
      modelSettings.responseFormat,
    );
    const results = await Promise.all(
      Array.from({ length: count }, async () => {
        const currentModelSettings = this.settingsRepo.getModelSettings();
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          currentModelSettings.timeoutMs,
        );
        let response: Response;

        try {
          const form = new FormData();
          form.set('model', effectiveModel || currentModelSettings.imageModel);
          form.set('prompt', params.prompt);
          form.set('n', '1');
          form.set('size', size);
          form.set('quality', quality);
          form.set('output_format', outputFormat);
          if (outputFormat !== 'png') {
            form.set('output_compression', String(outputCompression));
          }
          form.set('background', background);
          form.set('moderation', moderation);
          if (responseFormat) {
            form.set('response_format', responseFormat);
          }
          // 多参考图时按顺序逐个 append，第一张作为主参考图。
          for (const imageFile of params.imageFiles) {
            const buffer = await fs.readFile(imageFile.filePath);
            form.append(
              'image',
              new Blob([buffer], { type: imageFile.fileType }),
              imageFile.fileName,
            );
          }
          if (params.maskFilePath) {
            const maskBuffer = await fs.readFile(params.maskFilePath);
            form.set(
              'mask',
              new Blob([maskBuffer], { type: params.maskFileType || 'image/png' }),
              params.maskFileName || 'mask.png',
            );
          }

          response = await fetch(`${currentModelSettings.baseUrl}/images/edits`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${config.HIAPI_API_KEY}`,
            },
            body: form as any,
          });
        } catch (error: any) {
          throw normalizeHiapiError(error);
        } finally {
          clearTimeout(timeout);
        }

        return parseHiapiResponse(
          response,
          mimeTypeForOutputFormat(outputFormat),
        );
      }),
    );

    return {
      content: results.map((item) => item.content).filter(Boolean).join('\n'),
      imageUrls: results.flatMap((item) => item.imageUrls),
    };
  }

  async editImageFromFile(params: {
    filePath: string;
    fileType: string;
    fileName: string;
    prompt: string;
    aspectRatio: string;
    size?: SupportedImageSize;
    quality?: SupportedImageQuality;
    qualityTier?: '1k' | '2k' | '4k';
    count?: number;
    outputFormat?: SupportedOutputFormat;
    outputCompression?: number;
    background?: SupportedBackground;
    moderation?: SupportedModeration;
  }) {
    return this.editImageFromFiles({
      imageFiles: [
        {
          filePath: params.filePath,
          fileType: params.fileType,
          fileName: params.fileName,
        },
      ],
      prompt: params.prompt,
      aspectRatio: params.aspectRatio,
      size: params.size,
      quality: params.quality,
      qualityTier: params.qualityTier,
      count: params.count,
      outputFormat: params.outputFormat,
      outputCompression: params.outputCompression,
      background: params.background,
      moderation: params.moderation,
    });
  }

  async createDialogueImage(params: {
    prompt: string;
    userId?: string;
    inputImageUrls?: string[];
    fallbackInputImageUrls?: string[];
    historyTurns?: Array<{
      prompt: string;
      inputImageUrls?: string[];
      outputItems?: any[];
    }>;
    previousResponseId?: string;
    aspectRatio: string;
    qualityTier?: '1k' | '2k' | '4k';
    background?: SupportedBackground;
  }) {
    const modelSettings = this.settingsRepo.getModelSettings();
    if (!modelSettings.textModel) {
      throw new HttpException(
        '请先在 .env 中配置 HIAPI_TEXT_MODEL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      modelSettings.timeoutMs,
    );
    const toolBackground =
      params.background === 'transparent' ? 'auto' : params.background || 'auto';
    const toolSize = sizeForSub2api(params.aspectRatio, modelSettings.sizeFormat);
    const toolQuality = qualityForTier(params.qualityTier || '1k');
    const createUserTurn = (prompt: string, inputImageUrls: string[] = []) => {
      const content: Array<Record<string, string>> = [
        {
          type: 'input_text',
          text: String(prompt || '').trim(),
        },
      ];
      for (const imageUrl of inputImageUrls || []) {
        const value = String(imageUrl || '').trim();
        if (!value) continue;
        content.push({
          type: 'input_image',
          image_url: value,
        });
      }
      return {
        role: 'user',
        content,
      };
    };

    const createRequest = async (request: {
      input: any[];
      action: 'auto' | 'generate' | 'edit';
      previousResponseId?: string;
    }) => {
      let response: Response;
      try {
        response = await fetch(`${modelSettings.baseUrl}/responses`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${config.HIAPI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelSettings.textModel,
            store: true,
            ...(params.userId ? { user: params.userId } : {}),
            ...(request.previousResponseId
              ? { previous_response_id: request.previousResponseId }
              : {}),
            input: request.input,
            tool_choice: { type: 'image_generation' },
            tools: [
              {
                type: 'image_generation',
                action: request.action,
                size: toolSize,
                quality: toolQuality,
                background: toolBackground,
              },
            ],
          }),
        });
      } catch (error: any) {
        throw normalizeHiapiError(error);
      }
      return parseResponsesImageResponse(response);
    };

    try {
      try {
        if (params.previousResponseId) {
          const responseChainInput = [
            createUserTurn(params.prompt, params.inputImageUrls || []),
          ];
          const hasEditContext =
            Boolean(params.previousResponseId) ||
            Boolean((params.inputImageUrls || []).length);
          return await createRequest({
            input: responseChainInput,
            action: hasEditContext ? 'edit' : 'generate',
            previousResponseId: params.previousResponseId,
          });
        }
      } catch (error: any) {
        if (!shouldFallbackToReplay(error)) {
          throw error;
        }
      }

      const replayInput: any[] = [];
      for (const turn of params.historyTurns || []) {
        const prompt = String(turn.prompt || '').trim();
        if (!prompt) continue;
        replayInput.push(createUserTurn(prompt));
      }
      const replayImages =
        params.fallbackInputImageUrls || params.inputImageUrls || [];
      replayInput.push(createUserTurn(params.prompt, replayImages));

      return await createRequest({
        input: replayInput,
        action: replayImages.length ? 'edit' : 'generate',
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async enhancePrompt(input: string, direction: string = 'ecommerce') {
    const modelSettings = this.settingsRepo.getModelSettings();
    if (!modelSettings.textModel) {
      throw new HttpException(
        '请先在 .env 中配置 HIAPI_TEXT_MODEL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const systemPrompt =
      {
        ecommerce:
          '你是提示词工程师。把用户的描述润色成适合 gpt-image-2 的高质量中文提示词，用于电商主图/商品展示：突出核心卖点与质感（材质/工艺/细节/场景），主体清晰、背景干净，光影高级，构图利于转化；明确“不要文字/水印/Logo”，并建议可留白区域但不要生成文字。输出仅包含最终提示词，不要加解释，不要加编号，不要用代码块。',
        xiaohongshu:
          '你是提示词工程师。把用户的描述润色成适合 gpt-image-2 的高质量中文提示词，用于小红书封面：清新、有氛围感，强调生活方式与情绪价值；构图要有明显留白与版式感（留出可放标题/卖点的区域，但不要生成文字）；明确“不要文字/水印/Logo”。输出仅包含最终提示词，不要加解释，不要加编号，不要用代码块。',
        poster:
          '你是提示词工程师。把用户的描述润色成适合 gpt-image-2 的高质量中文提示词，用于海报排版：强调强主题与清晰层次、干净背景、明确主视觉区域与大块留白（用于后期放文案但不要生成文字），构图更设计感（网格、对称或黄金分割任选其一并写清）。明确“不要文字/水印/Logo”。输出仅包含最终提示词，不要加解释，不要加编号，不要用代码块。',
        wallpaper:
          '你是提示词工程师。把用户的描述润色成适合 gpt-image-2 的高质量中文提示词，用于手机壁纸/头像：画面干净耐看、主体适合裁切，背景简洁有层次，高分辨率细节；明确“不要文字/水印/Logo”。输出仅包含最终提示词，不要加解释，不要加编号，不要用代码块。',
        concise:
          '你是提示词工程师。把用户的描述润色成适合 gpt-image-2 的高质量中文提示词。要求更简洁，信息密度高，避免冗余。输出仅包含最终提示词，不要加解释，不要加编号，不要用代码块。',
        commercial:
          '你是提示词工程师。把用户的简短描述润色成适合 gpt-image-2 的高质量中文提示词。风格更商业、更有转化导向（更清晰卖点、更高级、更有质感）。输出仅包含最终提示词，不要加解释，不要加编号，不要用代码块。',
        english:
          'You are a prompt engineer. Rewrite the user input into a high-quality English prompt that can be used directly for gpt-image-2. Output ONLY the final prompt. No explanations, no numbering, no code blocks.',
      }[direction] ||
      '你是提示词工程师。把用户的简短描述润色成 gpt-image-2 可直接使用的高质量中文提示词。输出仅包含最终提示词，不要加解释，不要加编号，不要用代码块。';

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      modelSettings.timeoutMs,
    );
    let response: Response;

    try {
      response = await fetch(`${modelSettings.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.HIAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelSettings.textModel,
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: String(input || '').trim(),
            },
          ],
        }),
      });
    } catch (error: any) {
      throw normalizeHiapiError(error);
    } finally {
      clearTimeout(timeout);
    }

    return parseChatResponse(response);
  }
}
