import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../sqlite.service';

export type OperationCampaignStatus = 'draft' | 'active' | 'archived';
export type OperationCampaignChannel =
  | 'announcement'
  | 'redeem_code'
  | 'feedback'
  | 'manual';

export type OperationCampaignAudience = {
  statuses?: string[];
  roles?: string[];
  createdAfter?: string;
  createdBefore?: string;
  paidOnly?: boolean;
};

export type OperationCampaignEntity = {
  id: string;
  name: string;
  channel: OperationCampaignChannel;
  status: OperationCampaignStatus;
  goal: string;
  audience: OperationCampaignAudience;
  startAt: string | null;
  endAt: string | null;
  linkedRefType: string | null;
  linkedRefId: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeAudience(value: any): OperationCampaignAudience {
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

  const audience: OperationCampaignAudience = {};
  if (statuses.length) audience.statuses = Array.from(new Set(statuses));
  if (roles.length) audience.roles = Array.from(new Set(roles));

  const createdAfter = String(parsed.createdAfter || '').trim();
  const createdBefore = String(parsed.createdBefore || '').trim();
  if (createdAfter) audience.createdAfter = createdAfter;
  if (createdBefore) audience.createdBefore = createdBefore;
  if (parsed.paidOnly === true) audience.paidOnly = true;
  return audience;
}

function normalizeChannel(value: any): OperationCampaignChannel {
  const channel = String(value || '').trim();
  if (
    channel === 'announcement' ||
    channel === 'redeem_code' ||
    channel === 'feedback' ||
    channel === 'manual'
  ) {
    return channel;
  }
  return 'manual';
}

function normalizeStatus(value: any): OperationCampaignStatus {
  const status = String(value || '').trim();
  if (status === 'draft' || status === 'active' || status === 'archived') return status;
  return 'draft';
}

function toCampaign(row: any): OperationCampaignEntity | null {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    channel: normalizeChannel(row.channel),
    status: normalizeStatus(row.status),
    goal: String(row.goal || ''),
    audience: normalizeAudience(row.audience_json),
    startAt: row.start_at ? String(row.start_at) : null,
    endAt: row.end_at ? String(row.end_at) : null,
    linkedRefType: row.linked_ref_type ? String(row.linked_ref_type) : null,
    linkedRefId: row.linked_ref_id ? String(row.linked_ref_id) : null,
    createdBy: String(row.created_by || ''),
    updatedBy: String(row.updated_by || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

@Injectable()
export class OperationCampaignsRepo {
  constructor(private readonly sqlite: SqliteService) {}

  listAdmin(params: {
    q?: string;
    status?: string;
    channel?: string;
    limit: number;
  }) {
    const limit = Math.max(1, Math.min(200, Math.floor(params.limit)));
    const q = String(params.q || '').trim().toLowerCase();
    const status = String(params.status || '').trim();
    const channel = String(params.channel || '').trim();
    const where: string[] = [];
    const args: any[] = [];

    if (q) {
      where.push('(lower(name) LIKE ? OR lower(goal) LIKE ? OR lower(linked_ref_id) LIKE ?)');
      args.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status) {
      where.push('status = ?');
      args.push(status);
    }
    if (channel) {
      where.push('channel = ?');
      args.push(channel);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = this.sqlite.connection
      .prepare(`SELECT * FROM operation_campaigns ${whereSql} ORDER BY created_at DESC LIMIT ?`)
      .all(...args, limit);
    return rows.map(toCampaign).filter(Boolean) as OperationCampaignEntity[];
  }

  findById(id: string) {
    const row = this.sqlite.connection
      .prepare('SELECT * FROM operation_campaigns WHERE id = ?')
      .get(id);
    return toCampaign(row);
  }

  create(params: {
    name: string;
    channel: OperationCampaignChannel;
    goal?: string;
    audience?: OperationCampaignAudience;
    startAt?: string | null;
    endAt?: string | null;
    linkedRefType?: string | null;
    linkedRefId?: string | null;
    createdBy: string;
  }) {
    const now = new Date().toISOString();
    const campaign: OperationCampaignEntity = {
      id: crypto.randomUUID(),
      name: params.name,
      channel: params.channel,
      status: 'draft',
      goal: String(params.goal || '').trim(),
      audience: normalizeAudience(params.audience),
      startAt: params.startAt || null,
      endAt: params.endAt || null,
      linkedRefType: params.linkedRefType || null,
      linkedRefId: params.linkedRefId || null,
      createdBy: params.createdBy,
      updatedBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO operation_campaigns(
          id, name, channel, status, goal, audience_json, start_at, end_at,
          linked_ref_type, linked_ref_id, created_by, updated_by, created_at, updated_at
        ) VALUES(
          @id, @name, @channel, @status, @goal, @audience_json, @start_at, @end_at,
          @linked_ref_type, @linked_ref_id, @created_by, @updated_by, @created_at, @updated_at
        )`,
      )
      .run({
        id: campaign.id,
        name: campaign.name,
        channel: campaign.channel,
        status: campaign.status,
        goal: campaign.goal,
        audience_json: JSON.stringify(campaign.audience || {}),
        start_at: campaign.startAt,
        end_at: campaign.endAt,
        linked_ref_type: campaign.linkedRefType,
        linked_ref_id: campaign.linkedRefId,
        created_by: campaign.createdBy,
        updated_by: campaign.updatedBy,
        created_at: campaign.createdAt,
        updated_at: campaign.updatedAt,
      });

    return campaign;
  }

  update(
    id: string,
    params: {
      name?: string;
      channel?: OperationCampaignChannel;
      goal?: string;
      audience?: OperationCampaignAudience;
      startAt?: string | null;
      endAt?: string | null;
      linkedRefType?: string | null;
      linkedRefId?: string | null;
      updatedBy: string;
    },
  ) {
    const current = this.findById(id);
    if (!current) return null;

    const next: OperationCampaignEntity = {
      ...current,
      name: params.name ?? current.name,
      channel: params.channel ?? current.channel,
      goal: params.goal ?? current.goal,
      audience:
        params.audience === undefined ? current.audience : normalizeAudience(params.audience),
      startAt:
        params.startAt === undefined ? current.startAt : (params.startAt ?? null),
      endAt: params.endAt === undefined ? current.endAt : (params.endAt ?? null),
      linkedRefType:
        params.linkedRefType === undefined
          ? current.linkedRefType
          : (params.linkedRefType ?? null),
      linkedRefId:
        params.linkedRefId === undefined ? current.linkedRefId : (params.linkedRefId ?? null),
      updatedBy: params.updatedBy,
      updatedAt: new Date().toISOString(),
    };

    this.sqlite.connection
      .prepare(
        `UPDATE operation_campaigns SET
          name = @name,
          channel = @channel,
          goal = @goal,
          audience_json = @audience_json,
          start_at = @start_at,
          end_at = @end_at,
          linked_ref_type = @linked_ref_type,
          linked_ref_id = @linked_ref_id,
          updated_by = @updated_by,
          updated_at = @updated_at
        WHERE id = @id`,
      )
      .run({
        id: next.id,
        name: next.name,
        channel: next.channel,
        goal: next.goal,
        audience_json: JSON.stringify(next.audience || {}),
        start_at: next.startAt,
        end_at: next.endAt,
        linked_ref_type: next.linkedRefType,
        linked_ref_id: next.linkedRefId,
        updated_by: next.updatedBy,
        updated_at: next.updatedAt,
      });

    return next;
  }

  setStatus(id: string, status: OperationCampaignStatus, updatedBy: string) {
    const current = this.findById(id);
    if (!current) return null;
    const updatedAt = new Date().toISOString();
    this.sqlite.connection
      .prepare(
        `UPDATE operation_campaigns SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
      )
      .run(status, updatedBy, updatedAt, id);
    return this.findById(id);
  }

  deleteById(id: string) {
    const result = this.sqlite.connection
      .prepare('DELETE FROM operation_campaigns WHERE id = ?')
      .run(id);
    return Number(result?.changes || 0);
  }
}
