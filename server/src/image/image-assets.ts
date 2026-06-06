import { HttpException, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import type { Express } from 'express';
import { config } from '../config';
import { logError, toErrorDetails } from '../logging/logger';

function uploadDir() {
  const dir = path.join(config.DATA_DIR, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function extForMime(mime: string) {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/svg+xml') return '.svg';
  return '';
}

function sniffMimeType(buffer: Buffer) {
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  const head = buffer
    .subarray(0, 256)
    .toString('utf8')
    .trimStart()
    .toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) {
    return 'image/svg+xml';
  }
  return '';
}

function resolveImageMimeType(
  headerMimeType: string,
  buffer: Buffer,
  fallbackMimeType: string,
) {
  if (extForMime(headerMimeType)) return headerMimeType;
  const sniffed = sniffMimeType(buffer);
  if (sniffed) return sniffed;
  if (extForMime(fallbackMimeType)) return fallbackMimeType;
  return '';
}

export function mimeForFileName(fileName: string) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/png';
}

export function toUploadFilePath(url: string) {
  const val = String(url || '');
  if (!val.startsWith('/uploads/')) return '';
  const fileName = path.basename(val);
  if (!fileName) return '';
  return path.join(uploadDir(), fileName);
}

export async function removeUploadedFile(filePath: string) {
  if (!filePath) return;
  try {
    await fsp.unlink(filePath);
  } catch {
    void 0;
  }
}

function parseDataUrl(value: string, fallbackMimeType: string = 'image/png') {
  const normalizedValue = String(value || '').trim();
  const commaIndex = normalizedValue.indexOf(',');
  const meta = commaIndex >= 0 ? normalizedValue.slice(0, commaIndex) : '';
  const body = commaIndex >= 0 ? normalizedValue.slice(commaIndex + 1) : '';
  const mimeMatch = /^data:([^;]+);base64$/i.exec(meta);
  const mimeType = mimeMatch?.[1] || fallbackMimeType;
  if (!meta || !body) {
    throw new HttpException('上游返回了无效的图片数据', HttpStatus.BAD_GATEWAY);
  }
  return {
    mimeType,
    buffer: Buffer.from(body, 'base64'),
  };
}

async function saveImageBuffer(buffer: Buffer, mimeType: string) {
  if (!buffer.length) {
    throw new HttpException('上游返回了空图片数据', HttpStatus.BAD_GATEWAY);
  }
  const ext = extForMime(mimeType);
  if (!ext) {
    throw new HttpException('上游返回了不支持的图片格式', HttpStatus.BAD_GATEWAY);
  }
  const fileName = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(uploadDir(), fileName);
  await fsp.writeFile(filePath, buffer);
  return {
    fileName,
    filePath,
    url: `/uploads/${fileName}`,
    created: true,
  };
}

export async function saveUploadedBuffer(file: Express.Multer.File) {
  const ext = extForMime(file.mimetype);
  if (!ext) {
    throw new HttpException('不支持的图片格式', HttpStatus.BAD_REQUEST);
  }
  const fileName = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(uploadDir(), fileName);
  await fsp.writeFile(filePath, file.buffer);
  return {
    fileName,
    filePath,
    url: `/uploads/${fileName}`,
  };
}

function escapeSvgText(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function createPreviewAssets(params: {
  imageUrls: string[];
  prompt?: string;
  aspectRatio?: string;
}) {
  const urls = Array.isArray(params.imageUrls) ? params.imageUrls.filter(Boolean) : [];
  if (!urls.length) return [];

  const prompt = escapeSvgText(String(params.prompt || 'AI image preview').slice(0, 80));
  const ratio = String(params.aspectRatio || '1:1');
  const [rawWidth, rawHeight] = ratio.split(':').map((item) => Number(item));
  const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 1;
  const height = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 1;
  const viewWidth = 320;
  const viewHeight = Math.max(180, Math.round((viewWidth * height) / width));

  const previews: string[] = [];
  for (const [index] of urls.entries()) {
    const fileName = `${crypto.randomUUID()}.svg`;
    const filePath = path.join(uploadDir(), fileName);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-label="${prompt}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#eef2ff"/>
      <stop offset="0.52" stop-color="#f8fafc"/>
      <stop offset="1" stop-color="#ecfeff"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" rx="18" fill="url(#bg)"/>
  <rect x="20" y="20" width="${viewWidth - 40}" height="${viewHeight - 40}" rx="14" fill="rgba(255,255,255,0.62)" stroke="rgba(99,102,241,0.18)"/>
  <circle cx="${viewWidth - 70}" cy="66" r="28" fill="rgba(99,102,241,0.22)"/>
  <path d="M44 ${viewHeight - 54} L112 ${Math.max(72, viewHeight - 132)} L172 ${viewHeight - 78} L218 ${Math.max(86, viewHeight - 118)} L276 ${viewHeight - 54} Z" fill="rgba(14,165,233,0.18)" stroke="rgba(14,165,233,0.22)"/>
  <text x="28" y="${viewHeight - 25}" fill="#64748b" font-family="Arial, sans-serif" font-size="14" font-weight="700">Preview ${index + 1}</text>
</svg>`;
    await fsp.writeFile(filePath, svg, 'utf8');
    previews.push(`/uploads/${fileName}`);
  }
  return previews;
}

export async function filePathToDataUrl(filePath: string, mimeType?: string) {
  const buffer = await fsp.readFile(filePath);
  return `data:${mimeType || mimeForFileName(filePath)};base64,${buffer.toString('base64')}`;
}

export async function urlToInputImage(url: string) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.startsWith('data:')) return value;
  if (value.startsWith('/uploads/')) {
    const filePath = toUploadFilePath(value);
    if (!filePath) return '';
    return filePathToDataUrl(filePath);
  }
  return value;
}

async function persistImageAsset(url: string, fallbackMimeType: string = 'image/png') {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return null;
  if (normalizedUrl.startsWith('/uploads/')) {
    return {
      fileName: path.basename(normalizedUrl),
      filePath: toUploadFilePath(normalizedUrl),
      url: normalizedUrl,
      created: false,
    };
  }
  if (normalizedUrl.startsWith('data:')) {
    const { mimeType, buffer } = parseDataUrl(normalizedUrl, fallbackMimeType);
    return saveImageBuffer(buffer, mimeType);
  }
  try {
    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      throw new HttpException('下载上游图片失败', HttpStatus.BAD_GATEWAY);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = resolveImageMimeType(
      response.headers.get('content-type')?.split(';')[0]?.trim() || '',
      buffer,
      fallbackMimeType,
    );
    return saveImageBuffer(buffer, mimeType);
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new HttpException('保存上游图片失败', HttpStatus.BAD_GATEWAY);
  }
}

async function persistImageAssets(urls: string[], fallbackMimeType: string = 'image/png') {
  const persisted = await Promise.all(
    (Array.isArray(urls) ? urls : []).filter(Boolean).map((item) =>
      persistImageAsset(String(item || ''), fallbackMimeType),
    ),
  );
  return persisted.filter(Boolean) as Array<{
    fileName: string;
    filePath: string;
    url: string;
    created: boolean;
  }>;
}

export async function persistImageAssetsSafely(
  urls: string[],
  fallbackMimeType: string = 'image/png',
) {
  try {
    const persisted = await persistImageAssets(urls, fallbackMimeType);
    if (
      !persisted.length &&
      (Array.isArray(urls) ? urls.filter(Boolean).length : 0) > 0
    ) {
      throw new HttpException('保存上游图片失败', HttpStatus.BAD_GATEWAY);
    }
    return {
      urls: persisted.map((item) => item.url),
      persisted,
      degraded: false,
    };
  } catch (error) {
    logError('ImageAssets', 'Persisting generated assets failed, fallback to source URLs', {
      error: toErrorDetails(error),
    });
    return {
      urls: (Array.isArray(urls) ? urls : []).filter(Boolean).map((item) => String(item)),
      persisted: [] as Array<{
        fileName: string;
        filePath: string;
        url: string;
        created: boolean;
      }>,
      degraded: true,
    };
  }
}
