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
  | 'cutout'
  | 'upscale';

export type ImageEntity = {
  id: string;
  userId: string;
  mode: ImageMode;
  operationType: ImageOperationType;
  prompt: string;
  aspectRatio: string;
  generationParams: Record<string, any>;
  content: string;
  imageUrls: string[];
  inputImageUrls?: string[];
  folder: string;
  tags: string[];
  sourceImageId?: string;
  continuationChainId?: string;
  createdAt: string;
};

function parseJsonList(value: any) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: any) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

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
    generationParams: parseJsonObject(row.generation_params),
    content: String(row.content || ''),
    imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
    inputImageUrls: Array.isArray(inputImageUrls) ? inputImageUrls : [],
    folder: String(row.folder || ''),
    tags: parseJsonList(row.tags),
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

  listByUserPaged(params: {
    userId: string;
    limit: number;
    offset?: number;
    mode?: ImageMode | 'all';
    q?: string;
    folder?: string;
    tag?: string;
  }) {
    const limit = Math.max(1, Math.min(100, Math.floor(params.limit)));
    const offset = Math.max(0, Math.floor(params.offset || 0));
    const where = ['user_id = ?'];
    const values: any[] = [params.userId];

    if (params.mode && params.mode !== 'all') {
      if (params.mode === 'dialogue') {
        where.push('(mode = ? OR mode = ?)');
        values.push('dialogue', 'continuous');
      } else {
        where.push('mode = ?');
        values.push(params.mode);
      }
    }

    const keyword = String(params.q || '').trim();
    if (keyword) {
      where.push('(prompt LIKE ? OR content LIKE ? OR aspect_ratio LIKE ? OR operation_type LIKE ? OR folder LIKE ? OR tags LIKE ?)');
      const likeValue = `%${keyword}%`;
      values.push(likeValue, likeValue, likeValue, likeValue, likeValue, likeValue);
    }

    const folder = String(params.folder || '').trim();
    if (folder && folder !== 'all') {
      if (folder === 'unfiled') {
        where.push("(folder IS NULL OR TRIM(folder) = '')");
      } else {
        where.push('folder = ?');
        values.push(folder);
      }
    }

    const tag = String(params.tag || '').trim();
    if (tag && tag !== 'all') {
      if (tag === 'untagged') {
        where.push("(tags IS NULL OR TRIM(tags) = '' OR tags = '[]' OR NOT json_valid(tags))");
      } else {
        where.push("EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(images.tags) THEN images.tags ELSE '[]' END) WHERE json_each.value = ?)");
        values.push(tag);
      }
    }

    const whereSql = where.join(' AND ');
    const totalRow = this.sqlite.connection
      .prepare(`SELECT COUNT(*) as total FROM images WHERE ${whereSql}`)
      .get(...values) as { total?: number } | undefined;
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM images
         WHERE ${whereSql}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...values, limit, offset);

    return {
      items: rows.map(toImage).filter(Boolean) as ImageEntity[],
      total: Number(totalRow?.total || 0),
    };
  }

  findById(params: { id: string; userId: string }) {
    const row = this.sqlite.connection
      .prepare('SELECT * FROM images WHERE id = ? AND user_id = ?')
      .get(params.id, params.userId);
    return toImage(row);
  }

  listByChain(params: { chainId: string; userId: string }) {
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM images
         WHERE continuation_chain_id = ? AND user_id = ?
         ORDER BY created_at ASC`,
      )
      .all(params.chainId, params.userId);
    return rows.map(toImage).filter(Boolean) as ImageEntity[];
  }

  countByChains(params: { chainIds: string[]; userId: string }) {
    const chainIds = Array.from(new Set((params.chainIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
    if (!chainIds.length) return {};
    const placeholders = chainIds.map(() => '?').join(', ');
    const rows = this.sqlite.connection
      .prepare(
        `SELECT continuation_chain_id as chain_id, COUNT(*) as count
         FROM images
         WHERE user_id = ? AND continuation_chain_id IN (${placeholders})
         GROUP BY continuation_chain_id`,
      )
      .all(params.userId, ...chainIds) as Array<{ chain_id?: string; count?: number }>;
    return Object.fromEntries(
      rows
        .map((row) => [String(row.chain_id || ''), Number(row.count || 0)])
        .filter(([chainId]) => chainId),
    );
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

  listAssetUrlsByChain(params: { userId: string; chainId: string }) {
    const rows = this.sqlite.connection
      .prepare(
        `SELECT image_urls, input_image_urls
         FROM images
         WHERE user_id = ? AND continuation_chain_id = ?`,
      )
      .all(params.userId, params.chainId) as any[];
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

  deleteByChain(params: { chainId: string; userId: string }) {
    const result = this.sqlite.connection
      .prepare('DELETE FROM images WHERE continuation_chain_id = ? AND user_id = ?')
      .run(params.chainId, params.userId);
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

  updateAssetMeta(params: {
    id: string;
    userId: string;
    folder?: string;
    tags?: string[];
  }) {
    const updates: string[] = [];
    const values: any[] = [];
    if (Object.prototype.hasOwnProperty.call(params, 'folder')) {
      updates.push('folder = ?');
      values.push(String(params.folder || '').trim());
    }
    if (Object.prototype.hasOwnProperty.call(params, 'tags')) {
      updates.push('tags = ?');
      values.push(JSON.stringify(Array.isArray(params.tags) ? params.tags : []));
    }
    if (!updates.length) return 0;

    const result = this.sqlite.connection
      .prepare(
        `UPDATE images
         SET ${updates.join(', ')}
         WHERE id = ? AND user_id = ?`,
      )
      .run(...values, params.id, params.userId);
    return Number(result?.changes || 0);
  }

  create(params: {
    userId: string;
    mode: ImageMode;
    operationType?: ImageOperationType;
    prompt: string;
    aspectRatio: string;
    generationParams?: Record<string, any>;
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
      generationParams: params.generationParams || {},
      content: params.content,
      imageUrls: params.imageUrls,
      inputImageUrls: params.inputImageUrls || [],
      folder: '',
      tags: [],
      sourceImageId: params.sourceImageId || '',
      continuationChainId: params.continuationChainId || '',
      createdAt: new Date().toISOString(),
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO images(id, user_id, mode, operation_type, prompt, aspect_ratio, generation_params, content, image_urls, input_image_urls, source_image_id, continuation_chain_id, created_at)
         VALUES(@id, @user_id, @mode, @operation_type, @prompt, @aspect_ratio, @generation_params, @content, @image_urls, @input_image_urls, @source_image_id, @continuation_chain_id, @created_at)`,
      )
      .run({
        id: image.id,
        user_id: image.userId,
        mode: image.mode,
        operation_type: image.operationType,
        prompt: image.prompt,
        aspect_ratio: image.aspectRatio,
        generation_params: JSON.stringify(image.generationParams || {}),
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
