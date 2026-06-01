import { Injectable } from '@nestjs/common';
import { SqliteService } from '../sqlite.service';

export type ImageFeedbackRating = 'like' | 'dislike' | 'none';

export type ImageFeedbackEntity = {
  imageId: string;
  userId: string;
  rating: ImageFeedbackRating;
  issueType: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type ImageFeedbackSample = ImageFeedbackEntity & {
  prompt: string;
  mode: string;
  operationType: string;
  imageUrls: string[];
  previewImageUrls: string[];
  createdImageAt: string;
};

function toFeedback(row: any): ImageFeedbackEntity | null {
  if (!row) return null;
  const rating = String(row.rating || 'none');
  return {
    imageId: String(row.image_id || ''),
    userId: String(row.user_id || ''),
    rating: rating === 'like' || rating === 'dislike' ? rating : 'none',
    issueType: String(row.issue_type || ''),
    note: String(row.note || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function parseJsonList(value: any) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

function toFeedbackSample(row: any): ImageFeedbackSample | null {
  const feedback = toFeedback(row);
  if (!feedback) return null;
  return {
    ...feedback,
    prompt: String(row.prompt || ''),
    mode: String(row.mode || ''),
    operationType: String(row.operation_type || ''),
    imageUrls: parseJsonList(row.image_urls),
    previewImageUrls: parseJsonList(row.preview_image_urls),
    createdImageAt: String(row.image_created_at || ''),
  };
}

@Injectable()
export class ImageFeedbackRepo {
  constructor(private readonly sqlite: SqliteService) {}

  findByImage(params: { imageId: string; userId: string }) {
    const row = this.sqlite.connection
      .prepare('SELECT * FROM image_feedbacks WHERE image_id = ? AND user_id = ?')
      .get(params.imageId, params.userId);
    return toFeedback(row);
  }

  upsert(params: {
    imageId: string;
    userId: string;
    rating: ImageFeedbackRating;
    issueType?: string;
    note?: string;
  }) {
    const now = new Date().toISOString();
    this.sqlite.connection
      .prepare(
        `INSERT INTO image_feedbacks(
          image_id, user_id, rating, issue_type, note, created_at, updated_at
        ) VALUES(
          @image_id, @user_id, @rating, @issue_type, @note, @now, @now
        )
        ON CONFLICT(image_id, user_id) DO UPDATE SET
          rating = excluded.rating,
          issue_type = excluded.issue_type,
          note = excluded.note,
          updated_at = excluded.updated_at`,
      )
      .run({
        image_id: params.imageId,
        user_id: params.userId,
        rating: params.rating,
        issue_type: String(params.issueType || '').trim(),
        note: String(params.note || '').trim(),
        now,
      });
    return this.findByImage({ imageId: params.imageId, userId: params.userId });
  }

  deleteByImage(params: { imageId: string; userId: string }) {
    const result = this.sqlite.connection
      .prepare('DELETE FROM image_feedbacks WHERE image_id = ? AND user_id = ?')
      .run(params.imageId, params.userId);
    return Number(result?.changes || 0);
  }

  deleteAllByUser(params: { userId: string }) {
    const result = this.sqlite.connection
      .prepare('DELETE FROM image_feedbacks WHERE user_id = ?')
      .run(params.userId);
    return Number(result?.changes || 0);
  }

  listSamples(params: {
    limit: number;
    offset?: number;
    rating?: ImageFeedbackRating | 'all';
    issueType?: string;
    lowOnly?: boolean;
  }) {
    const limit = Math.max(1, Math.min(100, Math.floor(params.limit)));
    const offset = Math.max(0, Math.floor(params.offset || 0));
    const where: string[] = [];
    const values: any[] = [];

    if (params.lowOnly) {
      where.push(
        "(image_feedbacks.rating = 'dislike' OR TRIM(image_feedbacks.issue_type) != '' OR TRIM(image_feedbacks.note) != '')",
      );
    }

    if (params.rating && params.rating !== 'all') {
      where.push('image_feedbacks.rating = ?');
      values.push(params.rating);
    }

    const issueType = String(params.issueType || '').trim();
    if (issueType && issueType !== 'all') {
      where.push('image_feedbacks.issue_type = ?');
      values.push(issueType);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRow = this.sqlite.connection
      .prepare(`SELECT COUNT(*) as total FROM image_feedbacks ${whereSql}`)
      .get(...values) as { total?: number } | undefined;
    const rows = this.sqlite.connection
      .prepare(
        `SELECT
           image_feedbacks.*,
           images.prompt,
           images.mode,
           images.operation_type,
           images.image_urls,
           images.preview_image_urls,
           images.created_at AS image_created_at
         FROM image_feedbacks
         LEFT JOIN images ON images.id = image_feedbacks.image_id
         ${whereSql}
         ORDER BY image_feedbacks.updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...values, limit, offset);

    return {
      items: rows.map(toFeedbackSample).filter(Boolean) as ImageFeedbackSample[],
      total: Number(totalRow?.total || 0),
    };
  }
}
