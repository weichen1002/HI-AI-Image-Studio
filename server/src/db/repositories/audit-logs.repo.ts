import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../sqlite.service';

export type AuditCategory = 'auth' | 'admin' | 'security';
export type AuditStatus = 'success' | 'failure';

export type AuditLogEntity = {
  id: string;
  actorUserId: string;
  targetUserId: string;
  category: AuditCategory;
  action: string;
  status: AuditStatus;
  ip: string;
  userAgent: string;
  detail: Record<string, any>;
  createdAt: string;
};

function parseJsonObject(value: any) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function toAuditLog(row: any): AuditLogEntity | null {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    actorUserId: String(row.actor_user_id || ''),
    targetUserId: String(row.target_user_id || ''),
    category: String(row.category || 'security') as AuditCategory,
    action: String(row.action || ''),
    status: String(row.status || 'success') as AuditStatus,
    ip: String(row.ip || ''),
    userAgent: String(row.user_agent || ''),
    detail: parseJsonObject(row.detail_json),
    createdAt: String(row.created_at || ''),
  };
}

@Injectable()
export class AuditLogsRepo {
  constructor(private readonly sqlite: SqliteService) {}

  create(params: {
    actorUserId?: string;
    targetUserId?: string;
    category: AuditCategory;
    action: string;
    status: AuditStatus;
    ip?: string;
    userAgent?: string;
    detail?: Record<string, any>;
  }) {
    const entry: AuditLogEntity = {
      id: crypto.randomUUID(),
      actorUserId: String(params.actorUserId || ''),
      targetUserId: String(params.targetUserId || ''),
      category: params.category,
      action: String(params.action || '').trim(),
      status: params.status,
      ip: String(params.ip || ''),
      userAgent: String(params.userAgent || ''),
      detail:
        params.detail && typeof params.detail === 'object' ? params.detail : {},
      createdAt: new Date().toISOString(),
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO audit_logs(
          id, actor_user_id, target_user_id, category, action, status, ip, user_agent, detail_json, created_at
        ) VALUES(
          @id, @actor_user_id, @target_user_id, @category, @action, @status, @ip, @user_agent, @detail_json, @created_at
        )`,
      )
      .run({
        id: entry.id,
        actor_user_id: entry.actorUserId || null,
        target_user_id: entry.targetUserId || null,
        category: entry.category,
        action: entry.action,
        status: entry.status,
        ip: entry.ip || null,
        user_agent: entry.userAgent || null,
        detail_json: Object.keys(entry.detail).length
          ? JSON.stringify(entry.detail)
          : null,
        created_at: entry.createdAt,
      });

    return entry;
  }

  listPaged(params: {
    category?: AuditCategory;
    action?: string;
    status?: AuditStatus;
    userId?: string;
    limit: number;
    offset: number;
  }) {
    const limit = Math.max(1, Math.min(200, Math.floor(params.limit)));
    const offset = Math.max(0, Math.floor(params.offset));
    const where: string[] = [];
    const values: any[] = [];

    if (params.category) {
      where.push('category = ?');
      values.push(params.category);
    }
    if (params.action) {
      where.push('action = ?');
      values.push(params.action);
    }
    if (params.status) {
      where.push('status = ?');
      values.push(params.status);
    }
    if (params.userId) {
      where.push('(actor_user_id = ? OR target_user_id = ?)');
      values.push(params.userId, params.userId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRow = this.sqlite.connection
      .prepare(`SELECT COUNT(1) AS c FROM audit_logs ${whereSql}`)
      .get(...values) as any;
    const total = Number(totalRow?.c || 0);

    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...values, limit, offset);

    return {
      entries: rows.map(toAuditLog).filter(Boolean) as AuditLogEntity[],
      total,
    };
  }
}
