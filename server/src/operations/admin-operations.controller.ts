import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { AdminRoleGuard } from '../admin/role.guard';
import {
  OperationCampaignAudience,
  OperationCampaignChannel,
  OperationCampaignsRepo,
} from '../db/repositories/operation-campaigns.repo';
import { SqliteService } from '../db/sqlite.service';

function normalizeLimit(value: string | undefined, max = 200, fallback = 80) {
  const limit = Number(value || fallback);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(limit)));
}

function normalizeOptionalIso(value: any) {
  const v = String(value || '').trim();
  return v ? v : null;
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

function normalizeAudience(value: any): OperationCampaignAudience {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const statuses = Array.isArray(value.statuses)
    ? value.statuses
        .map((item: any) => String(item || '').trim())
        .filter((item: string) => ['active', 'banned', 'pending_verification'].includes(item))
    : [];
  const roles = Array.isArray(value.roles)
    ? value.roles
        .map((item: any) => String(item || '').trim())
        .filter((item: string) => ['user', 'admin', 'superadmin'].includes(item))
    : [];

  const audience: OperationCampaignAudience = {};
  if (statuses.length) audience.statuses = Array.from(new Set(statuses));
  if (roles.length) audience.roles = Array.from(new Set(roles));

  const createdAfter = normalizeOptionalIso(value.createdAfter);
  const createdBefore = normalizeOptionalIso(value.createdBefore);
  if (createdAfter) audience.createdAfter = createdAfter;
  if (createdBefore) audience.createdBefore = createdBefore;
  if (value.paidOnly === true) audience.paidOnly = true;
  return audience;
}

function normalizeOptionalText(value: any) {
  const text = String(value || '').trim();
  return text ? text : null;
}

function addAudienceWhere(
  audience: OperationCampaignAudience,
  where: string[],
  values: any[],
  tableAlias = 'u',
) {
  if (audience.statuses?.length) {
    where.push(`${tableAlias}.status IN (${audience.statuses.map(() => '?').join(', ')})`);
    values.push(...audience.statuses);
  }
  if (audience.roles?.length) {
    where.push(`${tableAlias}.role IN (${audience.roles.map(() => '?').join(', ')})`);
    values.push(...audience.roles);
  }
  if (audience.createdAfter) {
    where.push(`${tableAlias}.created_at >= ?`);
    values.push(audience.createdAfter);
  }
  if (audience.createdBefore) {
    where.push(`${tableAlias}.created_at <= ?`);
    values.push(audience.createdBefore);
  }
  if (audience.paidOnly) {
    where.push(`EXISTS (
      SELECT 1 FROM billing_orders bo
      WHERE bo.user_id = ${tableAlias}.id AND bo.status = 'paid'
    )`);
  }
}

function startIsoForPreset(preset: string) {
  const now = new Date();
  if (preset === 'new_7d') now.setDate(now.getDate() - 7);
  else if (preset === 'silent_14d') now.setDate(now.getDate() - 14);
  else if (preset === 'active_7d') now.setDate(now.getDate() - 7);
  else return '';
  return now.toISOString();
}

@Controller('api/admin/operations/campaigns')
@UseGuards(AuthGuard, AdminRoleGuard)
export class AdminOperationsController {
  constructor(
    private readonly campaignsRepo: OperationCampaignsRepo,
    private readonly sqlite: SqliteService,
  ) {}

  @Get('summary')
  summary() {
    const db = this.sqlite.connection;
    const now = new Date().toISOString();
    const campaigns = db
      .prepare(
        `SELECT
           COUNT(1) AS total,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
           SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived
         FROM operation_campaigns`,
      )
      .get() as any;
    const announcements = db
      .prepare(
        `SELECT
           COUNT(1) AS total,
           SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
           SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
           SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived
         FROM announcements`,
      )
      .get() as any;
    const redeemCodes = db
      .prepare(
        `SELECT
           COUNT(1) AS total,
           SUM(CASE
             WHEN enabled = 1
              AND (expires_at IS NULL OR expires_at > ?)
              AND redeemed_count < total_limit
             THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) AS disabled,
           SUM(CASE WHEN redeemed_count >= total_limit THEN 1 ELSE 0 END) AS exhausted
         FROM redeem_codes`,
      )
      .get(now) as any;
    const feedback = db
      .prepare(
        `SELECT
           COUNT(1) AS total,
           SUM(CASE
             WHEN rating = 'dislike' OR TRIM(issue_type) != '' OR TRIM(note) != ''
             THEN 1 ELSE 0 END) AS needsReview
         FROM image_feedbacks`,
      )
      .get() as any;

    return {
      campaigns: {
        total: Number(campaigns?.total || 0),
        active: Number(campaigns?.active || 0),
        draft: Number(campaigns?.draft || 0),
        archived: Number(campaigns?.archived || 0),
      },
      announcements: {
        total: Number(announcements?.total || 0),
        published: Number(announcements?.published || 0),
        draft: Number(announcements?.draft || 0),
        archived: Number(announcements?.archived || 0),
      },
      redeemCodes: {
        total: Number(redeemCodes?.total || 0),
        active: Number(redeemCodes?.active || 0),
        disabled: Number(redeemCodes?.disabled || 0),
        exhausted: Number(redeemCodes?.exhausted || 0),
      },
      feedback: {
        total: Number(feedback?.total || 0),
        needsReview: Number(feedback?.needsReview || 0),
      },
      touch: this.getTouchStats(),
    };
  }

  @Get('touch-stats')
  touchStats() {
    return this.getTouchStats();
  }

  @Get('segments')
  segments() {
    const segments = [
      {
        key: 'new_7d',
        name: '近 7 天新用户',
        desc: '适合新手引导、注册福利、首张图激励。',
        audience: { statuses: ['active'], roles: ['user'], createdAfter: startIsoForPreset('new_7d') },
      },
      {
        key: 'silent_14d',
        name: '14 天未活跃用户',
        desc: '适合召回提醒、限时兑换码、功能更新通知。',
        audience: { statuses: ['active'], roles: ['user'] },
      },
      {
        key: 'paid_users',
        name: '已付费用户',
        desc: '适合高级功能通知、续费关怀、质量反馈收集。',
        audience: { statuses: ['active'], roles: ['user'], paidOnly: true },
      },
      {
        key: 'active_7d',
        name: '近 7 天活跃用户',
        desc: '适合新模型试用、创作活动、反馈征集。',
        audience: { statuses: ['active'], roles: ['user'] },
      },
    ];

    return {
      segments: segments.map((segment) => ({
        ...segment,
        matchedUsers: this.countSegmentUsers(segment.key, segment.audience),
      })),
    };
  }

  @Get(':id/review')
  review(@Param('id') id: string) {
    const campaign = this.campaignsRepo.findById(id);
    if (!campaign) throw new HttpException('运营活动不存在', HttpStatus.NOT_FOUND);

    const db = this.sqlite.connection;
    const matchedUsers = this.countAudienceUsers(campaign.audience);
    const linked = this.getLinkedObject(campaign.linkedRefType, campaign.linkedRefId);
    const windowWhere: string[] = [];
    const windowValues: any[] = [];
    if (campaign.startAt) {
      windowWhere.push('created_at >= ?');
      windowValues.push(campaign.startAt);
    }
    if (campaign.endAt) {
      windowWhere.push('created_at <= ?');
      windowValues.push(campaign.endAt);
    }
    const windowSql = windowWhere.length ? `WHERE ${windowWhere.join(' AND ')}` : '';
    const jobs = db
      .prepare(
        `SELECT
           COUNT(1) AS total,
           SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
         FROM image_jobs ${windowSql}`,
      )
      .get(...windowValues) as any;

    const feedbackWhere = [...windowWhere];
    const feedbackValues = [...windowValues];
    const feedbackSql = feedbackWhere.length
      ? `WHERE ${feedbackWhere.join(' AND ')}`
      : '';
    const feedback = db
      .prepare(
        `SELECT
           COUNT(1) AS total,
           SUM(CASE
             WHEN rating = 'dislike' OR TRIM(issue_type) != '' OR TRIM(note) != ''
             THEN 1 ELSE 0 END) AS needsReview
         FROM image_feedbacks ${feedbackSql.replaceAll('created_at', 'updated_at')}`,
      )
      .get(...feedbackValues) as any;

    return {
      campaign,
      matchedUsers,
      linked,
      metrics: {
        generatedJobs: Number(jobs?.total || 0),
        succeededJobs: Number(jobs?.succeeded || 0),
        failedJobs: Number(jobs?.failed || 0),
        feedbackTotal: Number(feedback?.total || 0),
        feedbackNeedsReview: Number(feedback?.needsReview || 0),
      },
      notes: [
        '当前复盘基于活动时间窗口和关联对象做轻量统计。',
        '公告展示、点击、关闭等精确触达事件需要后续增加埋点表。',
      ],
    };
  }

  @Get()
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('limit') limitValue?: string,
  ) {
    const limit = normalizeLimit(limitValue);
    const campaigns = this.campaignsRepo.listAdmin({
      q,
      status,
      channel,
      limit,
    });
    return { campaigns };
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() body: any) {
    const name = String(body?.name || '').trim();
    if (!name) throw new HttpException('活动名称不能为空', HttpStatus.BAD_REQUEST);

    const campaign = this.campaignsRepo.create({
      name,
      channel: normalizeChannel(body?.channel),
      goal: String(body?.goal || '').trim(),
      startAt: normalizeOptionalIso(body?.startAt),
      endAt: normalizeOptionalIso(body?.endAt),
      linkedRefType: normalizeOptionalText(body?.linkedRefType),
      linkedRefId: normalizeOptionalText(body?.linkedRefId),
      audience: normalizeAudience(body?.audience),
      createdBy: req.user.id,
    });
    return { campaign };
  }

  @Put(':id')
  update(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: any) {
    const current = this.campaignsRepo.findById(id);
    if (!current) throw new HttpException('运营活动不存在', HttpStatus.NOT_FOUND);

    const name = body?.name === undefined ? undefined : String(body?.name || '').trim();
    if (name !== undefined && !name) {
      throw new HttpException('活动名称不能为空', HttpStatus.BAD_REQUEST);
    }

    const next = this.campaignsRepo.update(id, {
      name,
      channel: body?.channel === undefined ? undefined : normalizeChannel(body?.channel),
      goal: body?.goal === undefined ? undefined : String(body?.goal || '').trim(),
      startAt: body?.startAt === undefined ? undefined : normalizeOptionalIso(body?.startAt),
      endAt: body?.endAt === undefined ? undefined : normalizeOptionalIso(body?.endAt),
      linkedRefType:
        body?.linkedRefType === undefined ? undefined : normalizeOptionalText(body?.linkedRefType),
      linkedRefId:
        body?.linkedRefId === undefined ? undefined : normalizeOptionalText(body?.linkedRefId),
      audience: body?.audience === undefined ? undefined : normalizeAudience(body?.audience),
      updatedBy: req.user.id,
    });

    return { campaign: next };
  }

  @Post(':id/activate')
  activate(@Req() req: RequestWithUser, @Param('id') id: string) {
    const current = this.campaignsRepo.findById(id);
    if (!current) throw new HttpException('运营活动不存在', HttpStatus.NOT_FOUND);
    const next = this.campaignsRepo.setStatus(id, 'active', req.user.id);
    return { campaign: next };
  }

  @Post(':id/archive')
  archive(@Req() req: RequestWithUser, @Param('id') id: string) {
    const current = this.campaignsRepo.findById(id);
    if (!current) throw new HttpException('运营活动不存在', HttpStatus.NOT_FOUND);
    const next = this.campaignsRepo.setStatus(id, 'archived', req.user.id);
    return { campaign: next };
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    const current = this.campaignsRepo.findById(id);
    if (!current) throw new HttpException('运营活动不存在', HttpStatus.NOT_FOUND);
    if (current.status === 'active') {
      throw new HttpException('进行中的活动请先归档再删除', HttpStatus.BAD_REQUEST);
    }
    const changes = this.campaignsRepo.deleteById(id);
    return { deleted: changes > 0 };
  }

  private countAudienceUsers(audience: OperationCampaignAudience) {
    const where: string[] = [];
    const values: any[] = [];
    addAudienceWhere(audience || {}, where, values, 'u');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const row = this.sqlite.connection
      .prepare(`SELECT COUNT(1) AS total FROM users u ${whereSql}`)
      .get(...values) as any;
    return Number(row?.total || 0);
  }

  private countSegmentUsers(key: string, audience: OperationCampaignAudience) {
    const where: string[] = [];
    const values: any[] = [];
    addAudienceWhere(audience || {}, where, values, 'u');
    if (key === 'silent_14d') {
      const since = startIsoForPreset('silent_14d');
      where.push(`(u.last_used_at IS NULL OR u.last_used_at = '' OR u.last_used_at < ?)`);
      values.push(since);
    }
    if (key === 'active_7d') {
      const since = startIsoForPreset('active_7d');
      where.push(`u.last_used_at >= ?`);
      values.push(since);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const row = this.sqlite.connection
      .prepare(`SELECT COUNT(1) AS total FROM users u ${whereSql}`)
      .get(...values) as any;
    return Number(row?.total || 0);
  }

  private getLinkedObject(type: string | null, id: string | null) {
    if (!type || !id) return null;
    const db = this.sqlite.connection;
    if (type === 'announcement') {
      const row = db
        .prepare('SELECT id, title, status, notify_mode, repeat_mode, start_at, end_at FROM announcements WHERE id = ?')
        .get(id) as any;
      return row
        ? {
            type,
            id: String(row.id),
            title: String(row.title || ''),
            status: String(row.status || ''),
            meta: `${String(row.notify_mode || '')} / ${String(row.repeat_mode || '')}`,
            startAt: row.start_at ? String(row.start_at) : null,
            endAt: row.end_at ? String(row.end_at) : null,
          }
        : null;
    }
    if (type === 'redeem_code') {
      const row = db
        .prepare('SELECT id, title, type, credits_amount, total_limit, redeemed_count, enabled, expires_at FROM redeem_codes WHERE id = ?')
        .get(id) as any;
      return row
        ? {
            type,
            id: String(row.id),
            title: String(row.title || ''),
            status: row.enabled ? 'enabled' : 'disabled',
            meta: `${Number(row.redeemed_count || 0)} / ${Number(row.total_limit || 0)} 次兑换`,
            creditsAmount: Number(row.credits_amount || 0),
            endAt: row.expires_at ? String(row.expires_at) : null,
          }
        : null;
    }
    if (type === 'feedback_sample') {
      const row = db
        .prepare('SELECT image_id, rating, issue_type, note, updated_at FROM image_feedbacks WHERE image_id = ? ORDER BY updated_at DESC LIMIT 1')
        .get(id) as any;
      return row
        ? {
            type,
            id: String(row.image_id),
            title: String(row.issue_type || row.rating || '反馈样本'),
            status: String(row.rating || ''),
            meta: String(row.note || ''),
            updatedAt: String(row.updated_at || ''),
          }
        : null;
    }
    return { type, id, title: id, status: 'manual', meta: '手动关联对象' };
  }

  private getTouchStats() {
    const db = this.sqlite.connection;
    const now = new Date().toISOString();
    const announcements = db
      .prepare(
        `SELECT
           COUNT(1) AS total,
           SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
           SUM(CASE WHEN status = 'published' AND notify_mode = 'modal' THEN 1 ELSE 0 END) AS modal,
           SUM(CASE WHEN status = 'published' AND (start_at IS NULL OR start_at <= ?) AND (end_at IS NULL OR end_at >= ?) THEN 1 ELSE 0 END) AS currentlyVisible
         FROM announcements`,
      )
      .get(now, now) as any;
    const reads = db
      .prepare('SELECT COUNT(1) AS total FROM announcement_reads')
      .get() as any;
    const redeem = db
      .prepare(
        `SELECT
           COUNT(1) AS totalCodes,
           COALESCE(SUM(redeemed_count), 0) AS redeemed,
           COALESCE(SUM(total_limit), 0) AS totalLimit
         FROM redeem_codes`,
      )
      .get() as any;
    const generated = db
      .prepare(
        `SELECT
           COUNT(1) AS total,
           SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded
         FROM image_jobs`,
      )
      .get() as any;

    return {
      announcements: {
        total: Number(announcements?.total || 0),
        published: Number(announcements?.published || 0),
        modal: Number(announcements?.modal || 0),
        currentlyVisible: Number(announcements?.currentlyVisible || 0),
        reads: Number(reads?.total || 0),
      },
      redeemCodes: {
        totalCodes: Number(redeem?.totalCodes || 0),
        redeemed: Number(redeem?.redeemed || 0),
        totalLimit: Number(redeem?.totalLimit || 0),
      },
      generation: {
        totalJobs: Number(generated?.total || 0),
        succeededJobs: Number(generated?.succeeded || 0),
      },
      caveat: '当前是基于已有业务数据的轻量统计；曝光、点击、关闭需要增加前端埋点后才能精确统计。',
    };
  }
}
