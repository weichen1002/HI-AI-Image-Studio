import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../sqlite.service';
import type { ImageMode, ImageOperationType } from './images.repo';

export type ImageJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type ImageJobEntity = {
  id: string;
  userId: string;
  mode: ImageMode;
  operationType: ImageOperationType;
  status: ImageJobStatus;
  prompt: string;
  imageId: string;
  errorMessage: string;
  payload: Record<string, any>;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

function parsePayload(value: any) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toImageJob(row: any): ImageJobEntity | null {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    mode: String(row.mode || 'text') as ImageMode,
    operationType: String(row.operation_type || 'generate') as ImageOperationType,
    status: String(row.status || 'queued') as ImageJobStatus,
    prompt: String(row.prompt || ''),
    imageId: String(row.image_id || ''),
    errorMessage: String(row.error_message || ''),
    payload: parsePayload(row.payload_json),
    attempts: Math.max(0, Math.floor(Number(row.attempts || 0))),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

@Injectable()
export class ImageJobsRepo {
  constructor(private readonly sqlite: SqliteService) {}

  create(params: {
    userId: string;
    mode: ImageMode;
    operationType: ImageOperationType;
    prompt: string;
    status?: ImageJobStatus;
    payload?: Record<string, any>;
  }) {
    const now = new Date().toISOString();
    const job: ImageJobEntity = {
      id: crypto.randomUUID(),
      userId: params.userId,
      mode: params.mode,
      operationType: params.operationType,
      status: params.status || 'queued',
      prompt: params.prompt,
      imageId: '',
      errorMessage: '',
      payload: params.payload || {},
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO image_jobs(id, user_id, mode, operation_type, status, prompt, image_id, error_message, payload_json, attempts, created_at, updated_at)
         VALUES(@id, @user_id, @mode, @operation_type, @status, @prompt, @image_id, @error_message, @payload_json, @attempts, @created_at, @updated_at)`,
      )
      .run({
        id: job.id,
        user_id: job.userId,
        mode: job.mode,
        operation_type: job.operationType,
        status: job.status,
        prompt: job.prompt,
        image_id: job.imageId || null,
        error_message: job.errorMessage || null,
        payload_json: JSON.stringify(job.payload || {}),
        attempts: job.attempts,
        created_at: job.createdAt,
        updated_at: job.updatedAt,
      });

    return job;
  }

  findById(id: string) {
    const row = this.sqlite.connection
      .prepare('SELECT * FROM image_jobs WHERE id = ?')
      .get(id);
    return toImageJob(row);
  }

  findByIdForUser(params: { id: string; userId: string }) {
    const row = this.sqlite.connection
      .prepare('SELECT * FROM image_jobs WHERE id = ? AND user_id = ?')
      .get(params.id, params.userId);
    return toImageJob(row);
  }

  listByUserPaged(params: {
    userId: string;
    statuses?: ImageJobStatus[];
    limit: number;
    offset: number;
  }) {
    const limit = Math.max(1, Math.min(100, Math.floor(params.limit)));
    const offset = Math.max(0, Math.floor(params.offset));
    const statuses = Array.isArray(params.statuses)
      ? params.statuses.filter(Boolean)
      : [];
    const where: string[] = ['user_id = ?'];
    const values: any[] = [params.userId];

    if (statuses.length) {
      where.push(`status IN (${statuses.map(() => '?').join(', ')})`);
      values.push(...statuses);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const totalRow = this.sqlite.connection
      .prepare(`SELECT COUNT(1) AS c FROM image_jobs ${whereSql}`)
      .get(...values) as any;
    const total = Number(totalRow?.c || 0);
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM image_jobs ${whereSql}
         ORDER BY updated_at DESC, created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...values, limit, offset);

    return {
      jobs: rows.map(toImageJob).filter(Boolean) as ImageJobEntity[],
      total,
    };
  }

  deleteCompletedByUser(params: { userId: string }) {
    const result = this.sqlite.connection
      .prepare(
        `DELETE FROM image_jobs
         WHERE user_id = ?
           AND status IN ('succeeded', 'failed', 'cancelled')`,
      )
      .run(params.userId);
    return Number(result.changes || 0);
  }

  getStatsByUser(params: { userId: string }) {
    const rows = this.sqlite.connection
      .prepare(
        `SELECT status, COUNT(1) AS count
         FROM image_jobs
         WHERE user_id = ?
         GROUP BY status`,
      )
      .all(params.userId) as Array<{ status?: string; count?: number }>;
    const counts = {
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
      total: 0,
      failureRate: 0,
    };
    for (const row of rows) {
      const status = String(row.status || '') as ImageJobStatus;
      const count = Number(row.count || 0);
      if (status in counts) {
        (counts as any)[status] = count;
        counts.total += count;
      }
    }
    const completed = counts.succeeded + counts.failed;
    counts.failureRate = completed > 0 ? counts.failed / completed : 0;
    return counts;
  }

  markRunning(id: string) {
    const now = new Date().toISOString();
    const result = this.sqlite.connection
      .prepare(
        `UPDATE image_jobs
         SET status = 'running', attempts = attempts + 1, updated_at = ?
         WHERE id = ? AND status = 'queued'`,
      )
      .run(now, id);
    if (result.changes !== 1) return null;
    return this.findById(id);
  }

  markSucceeded(params: { id: string; imageId: string }) {
    return this.updateStatus({
      id: params.id,
      status: 'succeeded',
      imageId: params.imageId,
      errorMessage: '',
    });
  }

  markFailed(params: { id: string; errorMessage: string }) {
    return this.updateStatus({
      id: params.id,
      status: 'failed',
      errorMessage: params.errorMessage,
    });
  }

  cancelQueued(params: { id: string; userId: string }) {
    const now = new Date().toISOString();
    const result = this.sqlite.connection
      .prepare(
        `UPDATE image_jobs
         SET status = 'cancelled', error_message = '', updated_at = ?
         WHERE id = ? AND user_id = ? AND status = 'queued'`,
      )
      .run(now, params.id, params.userId);
    if (result.changes !== 1) return null;
    return this.findById(params.id);
  }

  requeueFailed(params: { id: string; userId: string }) {
    const now = new Date().toISOString();
    const result = this.sqlite.connection
      .prepare(
        `UPDATE image_jobs
         SET status = 'queued', image_id = NULL, error_message = '', updated_at = ?
         WHERE id = ? AND user_id = ? AND status = 'failed'`,
      )
      .run(now, params.id, params.userId);
    if (result.changes !== 1) return null;
    return this.findById(params.id);
  }

  private updateStatus(params: {
    id: string;
    status: ImageJobStatus;
    imageId?: string;
    errorMessage?: string;
  }) {
    const current = this.findById(params.id);
    if (!current) return null;

    const next: ImageJobEntity = {
      ...current,
      status: params.status,
      imageId:
        params.imageId !== undefined ? String(params.imageId || '') : current.imageId,
      errorMessage:
        params.errorMessage !== undefined
          ? String(params.errorMessage || '').slice(0, 500)
          : current.errorMessage,
      updatedAt: new Date().toISOString(),
    };

    this.sqlite.connection
      .prepare(
        `UPDATE image_jobs
         SET status = ?, image_id = ?, error_message = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        next.status,
        next.imageId || null,
        next.errorMessage || null,
        next.updatedAt,
        next.id,
      );

    return next;
  }
}
