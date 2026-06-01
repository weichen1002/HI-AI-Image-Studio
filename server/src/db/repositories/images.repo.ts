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
  previewImageUrls: string[];
  folder: string;
  tags: string[];
  favoriteAt: string;
  isFavorite: boolean;
  sourceImageId?: string;
  continuationChainId?: string;
  createdAt: string;
};

export type DialogueChainSummary = {
  chainId: string;
  title: string;
  firstImage: ImageEntity;
  lastImage: ImageEntity;
  roundCount: number;
  updatedAt: string;
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

function hasJsonArrayItemsExpression(columnName: string) {
  return `json_array_length(CASE WHEN json_valid(${columnName}) THEN ${columnName} ELSE '[]' END) > 0`;
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
  const previewImageUrls = (() => {
    if (!row.preview_image_urls) return [];
    try {
      return JSON.parse(String(row.preview_image_urls || '[]'));
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
    previewImageUrls: Array.isArray(previewImageUrls) ? previewImageUrls : [],
    folder: String(row.folder || ''),
    tags: parseJsonList(row.tags),
    favoriteAt: row.favorite_at ? String(row.favorite_at) : '',
    isFavorite: Boolean(row.favorite_at),
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
    favorite?: boolean;
    aspectRatio?: string;
    qualityTier?: string;
    hasReference?: boolean;
    inStyleBoard?: boolean;
    dateFrom?: string;
    dateTo?: string;
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

    if (params.favorite) {
      where.push("favorite_at IS NOT NULL AND TRIM(favorite_at) != ''");
    }

    const aspectRatio = String(params.aspectRatio || '').trim();
    if (aspectRatio && aspectRatio !== 'all') {
      where.push('aspect_ratio = ?');
      values.push(aspectRatio);
    }

    const qualityTier = String(params.qualityTier || '').trim();
    if (qualityTier && qualityTier !== 'all') {
      where.push("json_extract(CASE WHEN json_valid(generation_params) THEN generation_params ELSE '{}' END, '$.qualityTier') = ?");
      values.push(qualityTier);
    }

    if (params.hasReference) {
      where.push(`(${hasJsonArrayItemsExpression('input_image_urls')} OR source_image_id IS NOT NULL AND TRIM(source_image_id) != '')`);
    }

    if (params.inStyleBoard) {
      where.push(
        `EXISTS (
          SELECT 1 FROM style_board_refs
          WHERE style_board_refs.user_id = images.user_id
            AND style_board_refs.image_id = images.id
        )`,
      );
    }

    const dateFrom = String(params.dateFrom || '').trim();
    if (dateFrom) {
      where.push('created_at >= ?');
      values.push(dateFrom);
    }

    const dateTo = String(params.dateTo || '').trim();
    if (dateTo) {
      where.push('created_at <= ?');
      values.push(dateTo);
    }

    const whereSql = where.join(' AND ');
    const totalRow = this.sqlite.connection
      .prepare(`SELECT COUNT(*) as total FROM images WHERE ${whereSql}`)
      .get(...values) as { total?: number } | undefined;
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM images
         WHERE ${whereSql}
         ORDER BY ${params.favorite ? 'favorite_at DESC, ' : ''}created_at DESC
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

  listVariantsForImage(params: { id: string; userId: string; limit?: number }) {
    const limit = Math.max(1, Math.min(20, Math.floor(params.limit || 8)));
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM images
         WHERE source_image_id = ? AND user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(params.id, params.userId, limit);
    return rows.map(toImage).filter(Boolean) as ImageEntity[];
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

  listDialogueChains(params: { userId: string; limit?: number }) {
    const limit = Math.max(1, Math.min(200, Math.floor(params.limit || 100)));
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM images
         WHERE user_id = ?
           AND continuation_chain_id IS NOT NULL
           AND TRIM(continuation_chain_id) != ''
           AND (mode = 'dialogue' OR mode = 'continuous')
         ORDER BY continuation_chain_id ASC, created_at ASC`,
      )
      .all(params.userId);
    const groups = new Map<string, ImageEntity[]>();
    for (const row of rows) {
      const image = toImage(row);
      if (!image?.continuationChainId) continue;
      const list = groups.get(image.continuationChainId) || [];
      list.push(image);
      groups.set(image.continuationChainId, list);
    }

    return Array.from(groups.entries())
      .map(([chainId, images]) => {
        const firstImage = images[0];
        const lastImage = images[images.length - 1];
        return {
          chainId,
          title: lastImage?.prompt ? String(lastImage.prompt).slice(0, 60) : '对话创作',
          firstImage,
          lastImage,
          roundCount: images.length,
          updatedAt: lastImage?.createdAt || firstImage?.createdAt || '',
        };
      })
      .filter((item) => item.firstImage && item.lastImage)
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      .slice(0, limit) as DialogueChainSummary[];
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
        `SELECT image_urls, input_image_urls, preview_image_urls
         FROM images
         WHERE user_id = ?`,
      )
      .all(params.userId) as any[];
    const urls: string[] = [];
    for (const row of rows) {
      for (const key of ['image_urls', 'input_image_urls', 'preview_image_urls']) {
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
        `SELECT image_urls, input_image_urls, preview_image_urls
         FROM images
         WHERE user_id = ? AND continuation_chain_id = ?`,
      )
      .all(params.userId, params.chainId) as any[];
    const urls: string[] = [];
    for (const row of rows) {
      for (const key of ['image_urls', 'input_image_urls', 'preview_image_urls']) {
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

  updateFavorite(params: { id: string; userId: string; favorite: boolean }) {
    const favoriteAt = params.favorite ? new Date().toISOString() : null;
    const result = this.sqlite.connection
      .prepare(
        `UPDATE images
         SET favorite_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(favoriteAt, params.id, params.userId);
    return Number(result?.changes || 0);
  }

  markFavorites(params: { ids: string[]; userId: string; favorite?: boolean }) {
    const ids = Array.from(
      new Set((params.ids || []).map((id) => String(id || '').trim()).filter(Boolean)),
    );
    if (!ids.length) return 0;
    const placeholders = ids.map(() => '?').join(', ');
    const favoriteAt = params.favorite === false ? null : new Date().toISOString();
    const result = this.sqlite.connection
      .prepare(
        `UPDATE images
         SET favorite_at = ?
         WHERE user_id = ? AND id IN (${placeholders})`,
      )
      .run(favoriteAt, params.userId, ...ids);
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
    previewImageUrls?: string[];
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
      previewImageUrls: params.previewImageUrls || [],
      folder: '',
      tags: [],
      favoriteAt: '',
      isFavorite: false,
      sourceImageId: params.sourceImageId || '',
      continuationChainId: params.continuationChainId || '',
      createdAt: new Date().toISOString(),
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO images(id, user_id, mode, operation_type, prompt, aspect_ratio, generation_params, content, image_urls, input_image_urls, preview_image_urls, favorite_at, source_image_id, continuation_chain_id, created_at)
         VALUES(@id, @user_id, @mode, @operation_type, @prompt, @aspect_ratio, @generation_params, @content, @image_urls, @input_image_urls, @preview_image_urls, @favorite_at, @source_image_id, @continuation_chain_id, @created_at)`,
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
        preview_image_urls: (image.previewImageUrls || []).length
          ? JSON.stringify(image.previewImageUrls || [])
          : null,
        favorite_at: null,
        source_image_id: image.sourceImageId || null,
        continuation_chain_id: image.continuationChainId || null,
        created_at: image.createdAt,
      });

    return image;
  }
}
