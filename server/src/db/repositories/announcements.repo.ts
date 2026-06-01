import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../sqlite.service';

export type AnnouncementStatus = 'draft' | 'published' | 'archived';
export type AnnouncementNotifyMode = 'silent' | 'modal';
export type AnnouncementRepeatMode = 'once' | 'always';
export type AnnouncementAudience = {
  statuses?: string[];
  roles?: string[];
  createdAfter?: string;
  createdBefore?: string;
  paidOnly?: boolean;
};

export type AnnouncementEntity = {
  id: string;
  title: string;
  contentMd: string;
  status: AnnouncementStatus;
  notifyMode: AnnouncementNotifyMode;
  repeatMode: AnnouncementRepeatMode;
  audience: AnnouncementAudience;
  startAt: string | null;
  endAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementWithRead = AnnouncementEntity & {
  readAt: string | null;
};

function toAnnouncement(row: any): AnnouncementEntity | null {
  if (!row) return null;
  return {
    id: String(row.id),
    title: String(row.title || ''),
    contentMd: String(row.content_md || ''),
    status: (row.status || 'draft') as AnnouncementStatus,
    notifyMode: (row.notify_mode || 'silent') as AnnouncementNotifyMode,
    repeatMode: (row.repeat_mode || 'once') as AnnouncementRepeatMode,
    audience: normalizeAudience(row.audience_json),
    startAt: row.start_at ? String(row.start_at) : null,
    endAt: row.end_at ? String(row.end_at) : null,
    createdBy: String(row.created_by || ''),
    updatedBy: String(row.updated_by || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function normalizeAudience(value: any): AnnouncementAudience {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value || '{}');
    } catch {
      parsed = {};
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const statuses = Array.isArray(parsed.statuses)
    ? parsed.statuses
        .map((item: any) => String(item || '').trim())
        .filter((item: string) => ['active', 'banned', 'pending_verification'].includes(item))
    : [];
  const roles = Array.isArray(parsed.roles)
    ? parsed.roles
        .map((item: any) => String(item || '').trim())
        .filter((item: string) => ['user', 'admin', 'superadmin'].includes(item))
    : [];
  const audience: AnnouncementAudience = {};
  if (statuses.length) audience.statuses = Array.from(new Set(statuses));
  if (roles.length) audience.roles = Array.from(new Set(roles));
  const createdAfter = String(parsed.createdAfter || '').trim();
  const createdBefore = String(parsed.createdBefore || '').trim();
  if (createdAfter) audience.createdAfter = createdAfter;
  if (createdBefore) audience.createdBefore = createdBefore;
  if (parsed.paidOnly === true) audience.paidOnly = true;
  return audience;
}

function audienceMatchesUser(audience: AnnouncementAudience, user: any) {
  if (!user) return false;
  const normalized = normalizeAudience(audience);
  if (normalized.statuses?.length && !normalized.statuses.includes(String(user?.status || 'active'))) {
    return false;
  }
  if (normalized.roles?.length && !normalized.roles.includes(String(user?.role || 'user'))) {
    return false;
  }
  if (normalized.createdAfter && String(user?.created_at || '') < normalized.createdAfter) {
    return false;
  }
  if (normalized.createdBefore && String(user?.created_at || '') > normalized.createdBefore) {
    return false;
  }
  if (normalized.paidOnly && Number(user?.paid_order_count || 0) <= 0) {
    return false;
  }
  return true;
}

function toAnnouncementWithRead(row: any): AnnouncementWithRead | null {
  const base = toAnnouncement(row);
  if (!base) return null;
  return {
    ...base,
    readAt: row.read_at ? String(row.read_at) : null,
  };
}

@Injectable()
export class AnnouncementsRepo {
  constructor(private readonly sqlite: SqliteService) {}

  listAdmin(params: {
    q?: string;
    status?: string;
    notifyMode?: string;
    limit: number;
  }) {
    const limit = Math.max(1, Math.min(200, Math.floor(params.limit)));
    const q = String(params.q || '').trim().toLowerCase();
    const status = String(params.status || '').trim();
    const notifyMode = String(params.notifyMode || '').trim();

    const where: string[] = [];
    const args: any[] = [];

    if (q) {
      where.push('lower(title) LIKE ?');
      args.push(`%${q}%`);
    }
    if (status) {
      where.push('status = ?');
      args.push(status);
    }
    if (notifyMode) {
      where.push('notify_mode = ?');
      args.push(notifyMode);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM announcements ${whereSql} ORDER BY created_at DESC LIMIT ?`,
      )
      .all(...args, limit);
    return rows.map(toAnnouncement).filter(Boolean) as AnnouncementEntity[];
  }

  findById(id: string) {
    const row = this.sqlite.connection
      .prepare('SELECT * FROM announcements WHERE id = ?')
      .get(id);
    return toAnnouncement(row);
  }

  create(params: {
    title: string;
    contentMd: string;
    notifyMode: AnnouncementNotifyMode;
    repeatMode: AnnouncementRepeatMode;
    startAt?: string | null;
    endAt?: string | null;
    audience?: AnnouncementAudience;
    createdBy: string;
  }) {
    const now = new Date().toISOString();
    const announcement: AnnouncementEntity = {
      id: crypto.randomUUID(),
      title: params.title,
      contentMd: params.contentMd,
      status: 'draft',
      notifyMode: params.notifyMode,
      repeatMode: params.repeatMode,
      audience: normalizeAudience(params.audience),
      startAt: params.startAt || null,
      endAt: params.endAt || null,
      createdBy: params.createdBy,
      updatedBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO announcements(
          id, title, content_md, status, notify_mode, repeat_mode, start_at, end_at,
          audience_json, created_by, updated_by, created_at, updated_at
        ) VALUES(
          @id, @title, @content_md, @status, @notify_mode, @repeat_mode, @start_at, @end_at,
          @audience_json, @created_by, @updated_by, @created_at, @updated_at
        )`,
      )
      .run({
        id: announcement.id,
        title: announcement.title,
        content_md: announcement.contentMd,
        status: announcement.status,
        notify_mode: announcement.notifyMode,
        repeat_mode: announcement.repeatMode,
        audience_json: JSON.stringify(announcement.audience || {}),
        start_at: announcement.startAt,
        end_at: announcement.endAt,
        created_by: announcement.createdBy,
        updated_by: announcement.updatedBy,
        created_at: announcement.createdAt,
        updated_at: announcement.updatedAt,
      });

    return announcement;
  }

  update(
    id: string,
    params: {
      title?: string;
      contentMd?: string;
      notifyMode?: AnnouncementNotifyMode;
      repeatMode?: AnnouncementRepeatMode;
      startAt?: string | null;
      endAt?: string | null;
      audience?: AnnouncementAudience;
      updatedBy: string;
    },
  ) {
    const current = this.findById(id);
    if (!current) return null;

    const next: AnnouncementEntity = {
      ...current,
      title: params.title ?? current.title,
      contentMd: params.contentMd ?? current.contentMd,
      notifyMode: params.notifyMode ?? current.notifyMode,
      repeatMode: params.repeatMode ?? current.repeatMode,
      audience:
        params.audience === undefined ? current.audience : normalizeAudience(params.audience),
      startAt:
        params.startAt === undefined ? current.startAt : (params.startAt ?? null),
      endAt: params.endAt === undefined ? current.endAt : (params.endAt ?? null),
      updatedBy: params.updatedBy,
      updatedAt: new Date().toISOString(),
    };

    this.sqlite.connection
      .prepare(
        `UPDATE announcements SET
          title = @title,
          content_md = @content_md,
          notify_mode = @notify_mode,
          repeat_mode = @repeat_mode,
          audience_json = @audience_json,
          start_at = @start_at,
          end_at = @end_at,
          updated_by = @updated_by,
          updated_at = @updated_at
        WHERE id = @id`,
      )
      .run({
        id: next.id,
        title: next.title,
        content_md: next.contentMd,
        notify_mode: next.notifyMode,
        repeat_mode: next.repeatMode,
        audience_json: JSON.stringify(next.audience || {}),
        start_at: next.startAt,
        end_at: next.endAt,
        updated_by: next.updatedBy,
        updated_at: next.updatedAt,
      });

    return next;
  }

  setStatus(id: string, status: AnnouncementStatus, updatedBy: string) {
    const current = this.findById(id);
    if (!current) return null;
    const updatedAt = new Date().toISOString();
    this.sqlite.connection
      .prepare(
        `UPDATE announcements SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
      )
      .run(status, updatedBy, updatedAt, id);
    return this.findById(id);
  }

  deleteById(id: string) {
    const result = this.sqlite.connection
      .prepare('DELETE FROM announcements WHERE id = ?')
      .run(id);
    return Number(result?.changes || 0);
  }

  listActiveForUser(params: { userId: string; limit: number }) {
    const limit = Math.max(1, Math.min(50, Math.floor(params.limit)));
    const fetchLimit = Math.max(limit, Math.min(200, limit * 4));
    const now = new Date().toISOString();
    const user = this.sqlite.connection
      .prepare(
        `SELECT u.*, COUNT(o.id) AS paid_order_count
         FROM users u
         LEFT JOIN billing_orders o
           ON o.user_id = u.id AND o.status = 'paid'
         WHERE u.id = ?
         GROUP BY u.id`,
      )
      .get(params.userId);
    const rows = this.sqlite.connection
      .prepare(
        `SELECT a.*, r.read_at
         FROM announcements a
         LEFT JOIN announcement_reads r
           ON r.announcement_id = a.id AND r.user_id = ?
         WHERE a.status = 'published'
           AND (a.start_at IS NULL OR a.start_at <= ?)
           AND (a.end_at IS NULL OR a.end_at >= ?)
         ORDER BY COALESCE(a.start_at, a.created_at) DESC
         LIMIT ?`,
      )
      .all(params.userId, now, now, fetchLimit);
    return rows
      .map(toAnnouncementWithRead)
      .filter(Boolean)
      .filter((item: AnnouncementWithRead) => audienceMatchesUser(item.audience || {}, user))
      .slice(0, limit) as AnnouncementWithRead[];
  }

  previewAudience(params: { audience?: AnnouncementAudience }) {
    const audience = normalizeAudience(params.audience);
    const where: string[] = [];
    const values: any[] = [];
    if (audience.statuses?.length) {
      where.push(`u.status IN (${audience.statuses.map(() => '?').join(', ')})`);
      values.push(...audience.statuses);
    }
    if (audience.roles?.length) {
      where.push(`u.role IN (${audience.roles.map(() => '?').join(', ')})`);
      values.push(...audience.roles);
    }
    if (audience.createdAfter) {
      where.push('u.created_at >= ?');
      values.push(audience.createdAfter);
    }
    if (audience.createdBefore) {
      where.push('u.created_at <= ?');
      values.push(audience.createdBefore);
    }
    if (audience.paidOnly) {
      where.push(
        `EXISTS (
          SELECT 1 FROM billing_orders
          WHERE billing_orders.user_id = u.id AND billing_orders.status = 'paid'
        )`,
      );
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const row = this.sqlite.connection
      .prepare(`SELECT COUNT(1) AS total FROM users u ${whereSql}`)
      .get(...values) as { total?: number } | undefined;
    return {
      audience,
      matchedUsers: Number(row?.total || 0),
    };
  }

  markRead(params: { announcementId: string; userId: string }) {
    const now = new Date().toISOString();
    this.sqlite.connection
      .prepare(
        `INSERT INTO announcement_reads(announcement_id, user_id, read_at)
         VALUES(?, ?, ?)
         ON CONFLICT(announcement_id, user_id)
         DO UPDATE SET read_at = excluded.read_at`,
      )
      .run(params.announcementId, params.userId, now);
    return { announcementId: params.announcementId, userId: params.userId, readAt: now };
  }
}
