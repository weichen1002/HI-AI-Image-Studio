import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../sqlite.service';

export type ImageMode = 'text' | 'image' | 'dialogue' | 'continuous' | 'tools';
export type ImageOperationType =
  | 'generate'
  | 'image_to_image'
  | 'inpaint'
  | 'outpaint'
  | 'continuous'
  | 'cutout';

export type ImageEntity = {
  id: string;
  userId: string;
  mode: ImageMode;
  operationType: ImageOperationType;
  prompt: string;
  aspectRatio: string;
  content: string;
  imageUrls: string[];
  inputImageUrls?: string[];
  sourceImageId?: string;
  continuationChainId?: string;
  createdAt: string;
};

function toImage(row: any): ImageEntity | null {
  if (!row) return null;
  const imageUrls = (() => {
    try {
      return JSON.parse(String(row.image_urls || '[]'));
    } catch {
      return [];
    }
  })();
  const inputImageUrls = (() => {
    if (!row.input_image_urls) return [];
    try {
      return JSON.parse(String(row.input_image_urls || '[]'));
    } catch {
      return [];
    }
  })();
  return {
    id: String(row.id),
    userId: String(row.user_id),
    mode: (row.mode || 'text') as ImageMode,
    operationType: String(
      row.operation_type || (row.mode === 'image' ? 'image_to_image' : 'generate'),
    ) as ImageOperationType,
    prompt: String(row.prompt || ''),
    aspectRatio: String(row.aspect_ratio || '1:1'),
    content: String(row.content || ''),
    imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
    inputImageUrls: Array.isArray(inputImageUrls) ? inputImageUrls : [],
    sourceImageId: row.source_image_id ? String(row.source_image_id) : '',
    continuationChainId: row.continuation_chain_id
      ? String(row.continuation_chain_id)
      : '',
    createdAt: String(row.created_at || ''),
  };
}

@Injectable()
export class ImagesRepo {
  constructor(private readonly sqlite: SqliteService) {}

  listByUser(params: { userId: string; limit: number }) {
    const limit = Math.max(1, Math.min(50, Math.floor(params.limit)));
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM images WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(params.userId, limit);
    return rows.map(toImage).filter(Boolean) as ImageEntity[];
  }

  findById(params: { id: string; userId: string }) {
    const row = this.sqlite.connection
      .prepare('SELECT * FROM images WHERE id = ? AND user_id = ?')
      .get(params.id, params.userId);
    return toImage(row);
  }

  listInputImageUrlsByUser(params: { userId: string }) {
    const rows = this.sqlite.connection
      .prepare(
        `SELECT input_image_urls FROM images WHERE user_id = ? AND input_image_urls IS NOT NULL`,
      )
      .all(params.userId) as any[];
    const urls: string[] = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(String(row?.input_image_urls || '[]'));
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item) urls.push(String(item));
          }
        }
      } catch {
        void 0;
      }
    }
    return urls;
  }

  listAssetUrlsByUser(params: { userId: string }) {
    const rows = this.sqlite.connection
      .prepare(
        `SELECT image_urls, input_image_urls
         FROM images
         WHERE user_id = ?`,
      )
      .all(params.userId) as any[];
    const urls: string[] = [];
    for (const row of rows) {
      for (const key of ['image_urls', 'input_image_urls']) {
        try {
          const parsed = JSON.parse(String(row?.[key] || '[]'));
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item) urls.push(String(item));
            }
          }
        } catch {
          void 0;
        }
      }
    }
    return urls;
  }

  deleteById(params: { id: string; userId: string }) {
    const result = this.sqlite.connection
      .prepare('DELETE FROM images WHERE id = ? AND user_id = ?')
      .run(params.id, params.userId);
    return Number(result?.changes || 0);
  }

  deleteAllByUser(params: { userId: string }) {
    const result = this.sqlite.connection
      .prepare('DELETE FROM images WHERE user_id = ?')
      .run(params.userId);
    return Number(result?.changes || 0);
  }

  updateSources(params: {
    id: string;
    userId: string;
    imageUrls: string[];
    inputImageUrls?: string[];
  }) {
    const result = this.sqlite.connection
      .prepare(
        `UPDATE images
         SET image_urls = ?, input_image_urls = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(
        JSON.stringify(params.imageUrls || []),
        (params.inputImageUrls || []).length
          ? JSON.stringify(params.inputImageUrls || [])
          : null,
        params.id,
        params.userId,
      );
    return Number(result?.changes || 0);
  }

  create(params: {
    userId: string;
    mode: ImageMode;
    operationType?: ImageOperationType;
    prompt: string;
    aspectRatio: string;
    content: string;
    imageUrls: string[];
    inputImageUrls?: string[];
    sourceImageId?: string;
    continuationChainId?: string;
  }) {
    const image: ImageEntity = {
      id: crypto.randomUUID(),
      userId: params.userId,
      mode: params.mode,
      operationType:
        params.operationType ||
        (params.mode === 'image' ? 'image_to_image' : 'generate'),
      prompt: params.prompt,
      aspectRatio: params.aspectRatio,
      content: params.content,
      imageUrls: params.imageUrls,
      inputImageUrls: params.inputImageUrls || [],
      sourceImageId: params.sourceImageId || '',
      continuationChainId: params.continuationChainId || '',
      createdAt: new Date().toISOString(),
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO images(id, user_id, mode, operation_type, prompt, aspect_ratio, content, image_urls, input_image_urls, source_image_id, continuation_chain_id, created_at)
         VALUES(@id, @user_id, @mode, @operation_type, @prompt, @aspect_ratio, @content, @image_urls, @input_image_urls, @source_image_id, @continuation_chain_id, @created_at)`,
      )
      .run({
        id: image.id,
        user_id: image.userId,
        mode: image.mode,
        operation_type: image.operationType,
        prompt: image.prompt,
        aspect_ratio: image.aspectRatio,
        content: image.content,
        image_urls: JSON.stringify(image.imageUrls || []),
        input_image_urls: (image.inputImageUrls || []).length
          ? JSON.stringify(image.inputImageUrls || [])
          : null,
        source_image_id: image.sourceImageId || null,
        continuation_chain_id: image.continuationChainId || null,
        created_at: image.createdAt,
      });

    return image;
  }
}
