import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { config } from '../config';
import * as fs from 'fs/promises';

export function sizeForSub2api(aspectRatio: string): string {
  if (config.HIAPI_SIZE_FORMAT === 'ratio') return aspectRatio;
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

export function imageSourceFromResult(item: any): string {
  if (item?.url) return item.url;
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
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

async function parseHiapiResponse(response: Response) {
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
    .map((item: any) => imageSourceFromResult(item))
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

@Injectable()
export class HiapiService {
  async generateImage(prompt: string, aspectRatio: string) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.HIAPI_TIMEOUT_MS,
    );
    let response: Response;

    try {
      response = await fetch(`${config.HIAPI_BASE_URL}/images/generations`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.HIAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.HIAPI_MODEL,
          prompt,
          n: 1,
          size: sizeForSub2api(aspectRatio),
          response_format: config.HIAPI_RESPONSE_FORMAT,
        }),
      });
    } catch (error: any) {
      throw normalizeHiapiError(error);
    } finally {
      clearTimeout(timeout);
    }

    return parseHiapiResponse(response);
  }

  async editImageFromFile(params: {
    filePath: string;
    fileType: string;
    fileName: string;
    prompt: string;
    aspectRatio: string;
  }) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.HIAPI_TIMEOUT_MS,
    );
    let response: Response;

    try {
      const buffer = await fs.readFile(params.filePath);
      const form = new FormData();
      form.set('model', config.HIAPI_MODEL);
      form.set('prompt', params.prompt);
      form.set('n', '1');
      form.set('size', sizeForSub2api(params.aspectRatio));
      form.set('response_format', config.HIAPI_RESPONSE_FORMAT);
      form.set(
        'image',
        new Blob([buffer], { type: params.fileType }),
        params.fileName,
      );

      response = await fetch(`${config.HIAPI_BASE_URL}/images/edits`, {
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

    return parseHiapiResponse(response);
  }
}
