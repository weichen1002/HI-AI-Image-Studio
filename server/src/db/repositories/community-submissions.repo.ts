import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../sqlite.service';

export type CommunitySubmissionStatus = 'pending' | 'approved' | 'rejected';

export type CommunitySubmissionEntity = {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  prompt: string;
  coverImageUrl: string;
  aspectRatio: string;
  sourceType: string;
  sourceId: string;
  status: CommunitySubmissionStatus;
  reviewNote: string;
  reviewedBy: string;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateCommunitySubmissionParams = {
  userId: string;
  title: string;
  description?: string;
  category?: string;
  prompt: string;
  coverImageUrl?: string;
  aspectRatio?: string;
  sourceType?: string;
  sourceId?: string;
};

function toSubmission(row: any): CommunitySubmissionEntity | null {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    category: String(row.category || ''),
    prompt: String(row.prompt || ''),
    coverImageUrl: String(row.cover_image_url || ''),
    aspectRatio: String(row.aspect_ratio || ''),
    sourceType: String(row.source_type || ''),
    sourceId: String(row.source_id || ''),
    status: String(row.status || 'pending') as CommunitySubmissionStatus,
    reviewNote: String(row.review_note || ''),
    reviewedBy: String(row.reviewed_by || ''),
    reviewedAt: String(row.reviewed_at || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

@Injectable()
export class CommunitySubmissionsRepo {
  constructor(private readonly sqlite: SqliteService) {}

  listByUser(params: { userId: string }) {
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM community_submissions
         WHERE user_id = ?
         ORDER BY created_at DESC`,
      )
      .all(params.userId);
    return rows.map(toSubmission).filter(Boolean) as CommunitySubmissionEntity[];
  }

  listPublic(params: { limit?: number } = {}) {
    const limit = Math.min(Math.max(Number(params.limit || 80), 1), 120);
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM community_submissions
         WHERE status = 'approved'
         ORDER BY reviewed_at DESC, created_at DESC
         LIMIT ?`,
      )
      .all(limit);
    return rows.map(toSubmission).filter(Boolean) as CommunitySubmissionEntity[];
  }

  listAdmin(params: { status?: string; limit?: number } = {}) {
    const status = String(params.status || '').trim();
    const limit = Math.min(Math.max(Number(params.limit || 80), 1), 120);
    const rows = status
      ? this.sqlite.connection
          .prepare(
            `SELECT * FROM community_submissions
             WHERE status = ?
             ORDER BY created_at DESC
             LIMIT ?`,
          )
          .all(status, limit)
      : this.sqlite.connection
          .prepare(
            `SELECT * FROM community_submissions
             ORDER BY created_at DESC
             LIMIT ?`,
          )
          .all(limit);
    return rows.map(toSubmission).filter(Boolean) as CommunitySubmissionEntity[];
  }

  create(params: CreateCommunitySubmissionParams) {
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      title: params.title,
      description: params.description || '',
      category: params.category || '',
      prompt: params.prompt,
      cover_image_url: params.coverImageUrl || '',
      aspect_ratio: params.aspectRatio || '',
      source_type: params.sourceType || '',
      source_id: params.sourceId || '',
      status: 'pending',
      review_note: '',
      reviewed_by: '',
      reviewed_at: '',
      created_at: now,
      updated_at: now,
    };
    this.sqlite.connection
      .prepare(
        `INSERT INTO community_submissions(
          id, user_id, title, description, category, prompt, cover_image_url, aspect_ratio,
          source_type, source_id, status, review_note, reviewed_by, reviewed_at, created_at, updated_at
        ) VALUES(
          @id, @user_id, @title, @description, @category, @prompt, @cover_image_url, @aspect_ratio,
          @source_type, @source_id, @status, @review_note, @reviewed_by, @reviewed_at, @created_at, @updated_at
        )`,
      )
      .run(row);
    return toSubmission(row) as CommunitySubmissionEntity;
  }

  review(params: {
    id: string;
    reviewerId: string;
    status: Exclude<CommunitySubmissionStatus, 'pending'>;
    reviewNote?: string;
  }) {
    const now = new Date().toISOString();
    const result = this.sqlite.connection
      .prepare(
        `UPDATE community_submissions
         SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        params.status,
        params.reviewNote || '',
        params.reviewerId,
        now,
        now,
        params.id,
      );
    if (Number(result?.changes || 0) <= 0) return null;
    return this.findById(params.id);
  }

  findById(id: string) {
    const row = this.sqlite.connection
      .prepare(`SELECT * FROM community_submissions WHERE id = ?`)
      .get(id);
    return toSubmission(row);
  }
}
