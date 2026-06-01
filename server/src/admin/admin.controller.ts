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
  Header,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { hashPassword } from '../utils';
import { SystemSettingsRepo } from '../db/repositories/system-settings.repo';
import {
  UsersRepo,
  UserPlan,
  UserRole,
  UserStatus,
} from '../db/repositories/users.repo';
import { CreditsRepo } from '../credits/credits.repo';
import type { LedgerType } from '../credits/credits.repo';
import { AdminRoleGuard, SuperAdminRoleGuard } from './role.guard';
import { SqliteService } from '../db/sqlite.service';
import { ImagesRepo } from '../db/repositories/images.repo';
import { DialogueRepo } from '../db/repositories/dialogue.repo';
import { AuditLogsRepo } from '../db/repositories/audit-logs.repo';
import {
  ImageFeedbackRepo,
  type ImageFeedbackRating,
} from '../db/repositories/image-feedback.repo';
import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config';

function normalizeLimit(value: string | undefined, max = 100, fallback = 50) {
  const limit = Number(value || fallback);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(limit)));
}

function normalizePage(value: string | undefined, fallback = 1) {
  const page = Number(value || fallback);
  if (!Number.isFinite(page)) return fallback;
  return Math.max(1, Math.floor(page));
}

function normalizeBoolean(value: string | undefined) {
  const v = String(value || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function normalizeOptionalNumber(value: string | undefined) {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function normalizeFeedbackRating(value: string | undefined): ImageFeedbackRating | 'all' {
  const rating = String(value || 'all').trim();
  if (rating === 'like' || rating === 'dislike' || rating === 'none') return rating;
  return 'all';
}

function normalizeFeedbackIssueType(value: string | undefined) {
  const issueType = String(value || '').trim();
  if (
    issueType === 'bad_quality' ||
    issueType === 'wrong_subject' ||
    issueType === 'bad_text' ||
    issueType === 'composition' ||
    issueType === 'unsafe' ||
    issueType === 'other'
  ) {
    return issueType;
  }
  return '';
}

function normalizeDashboardRange(value: string | undefined) {
  const range = String(value || '7d').trim();
  if (range === '24h' || range === '7d' || range === '30d') return range;
  return '7d';
}

function startDateForRange(range: '24h' | '7d' | '30d') {
  const date = new Date();
  if (range === '24h') date.setHours(date.getHours() - 24);
  if (range === '7d') date.setDate(date.getDate() - 7);
  if (range === '30d') date.setDate(date.getDate() - 30);
  return date.toISOString();
}

function percent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 100;
}

const EXPORT_LIMIT = 1000;

function csvValue(value: unknown) {
  const raw = value === undefined || value === null ? '' : String(value);
  const guarded = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: unknown[][]) {
  return [
    headers.map(csvValue).join(','),
    ...rows.map((row) => row.map(csvValue).join(',')),
  ].join('\n');
}

function maskId(value: unknown) {
  const text = String(value || '').trim();
  if (text.length <= 10) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function safeJson(value: unknown) {
  if (!value) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function csvResponse(name: string, csv: string, total: number) {
  return [
    `# export=${name}`,
    `# maxRows=${EXPORT_LIMIT}`,
    `# exportedRows=${Math.min(total, EXPORT_LIMIT)}`,
    `# totalMatched=${total}`,
    csv,
  ].join('\n');
}

function normalizeNonNegativeInt(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function normalizeUserStatus(value: unknown): UserStatus {
  const next = String(value || '').trim();
  if (next === 'banned') return 'banned';
  if (next === 'pending_verification') return 'pending_verification';
  return 'active';
}

function toUploadFilePath(url: string) {
  const val = String(url || '');
  if (!val.startsWith('/uploads/')) return '';
  const fileName = path.basename(val);
  if (!fileName) return '';
  return path.join(config.DATA_DIR, 'uploads', fileName);
}

async function removeUploadedFile(filePath: string) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    void 0;
  }
}

function requestIp(req: RequestWithUser) {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return String(forwarded[0] || '').trim();
  if (typeof forwarded === 'string') return String(forwarded.split(',')[0] || '').trim();
  return String(req.ip || req.socket?.remoteAddress || '').trim();
}

function requestUserAgent(req: RequestWithUser) {
  return String(req.headers['user-agent'] || '').slice(0, 500);
}

@Controller('api/admin')
@UseGuards(AuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(
    private readonly usersRepo: UsersRepo,
    private readonly creditsRepo: CreditsRepo,
    private readonly settingsRepo: SystemSettingsRepo,
    private readonly sqlite: SqliteService,
    private readonly imagesRepo: ImagesRepo,
    private readonly dialogueRepo: DialogueRepo,
    private readonly auditLogsRepo: AuditLogsRepo,
    private readonly imageFeedbackRepo: ImageFeedbackRepo,
  ) {}

  @Get('users')
  listUsers(
    @Query('search') search?: string,
    @Query('plan') plan?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('minBalance') minBalanceValue?: string,
    @Query('maxBalance') maxBalanceValue?: string,
    @Query('lowBalanceOnly') lowBalanceOnlyValue?: string,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    const limit = normalizeLimit(limitValue, 100, 20);
    const page = normalizePage(pageValue, 1);
    const offset = (page - 1) * limit;

    const planValue =
      plan === 'free' || plan === 'pro' ? (plan as UserPlan) : undefined;
    const roleValue =
      role === 'user' || role === 'admin' || role === 'superadmin'
        ? (role as UserRole)
        : undefined;
    const statusValue =
      status === 'active' || status === 'banned' || status === 'pending_verification'
        ? (status as UserStatus)
        : undefined;

    const minBalance = normalizeOptionalNumber(minBalanceValue);
    const maxBalance = normalizeOptionalNumber(maxBalanceValue);
    const lowBalanceOnly = normalizeBoolean(lowBalanceOnlyValue);

    const result = this.usersRepo.listPaged({
      q: search,
      plan: planValue,
      role: roleValue,
      status: statusValue,
      minBalance,
      maxBalance,
      lowBalanceOnly,
      limit,
      offset,
    });

    const users = result.users;
    return {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        plan: u.plan,
        role: u.role,
        status: u.status,
        creditBalance: u.creditBalance,
        createdAt: u.createdAt,
        lastUsedAt: u.lastUsedAt,
      })),
      total: result.total,
    };
  }

  @Get('dashboard')
  getDashboard(@Query('range') rangeValue?: string) {
    const range = normalizeDashboardRange(rangeValue);
    const since = startDateForRange(range);
    const db = this.sqlite.connection;

    const usersRow = db
      .prepare(
        `SELECT
           COUNT(1) AS totalUsers,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeUsers,
           SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS newUsers,
           COUNT(DISTINCT CASE WHEN last_used_at >= ? THEN id ELSE NULL END) AS activeInRange
         FROM users`,
      )
      .get(since, since) as any;

    const jobsRow = db
      .prepare(
        `SELECT
           COUNT(1) AS totalJobs,
           SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeededJobs,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedJobs,
           SUM(CASE WHEN status IN ('queued', 'running') THEN 1 ELSE 0 END) AS activeJobs
         FROM image_jobs
         WHERE created_at >= ?`,
      )
      .get(since) as any;

    const creditRow = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS consumed,
           COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS credited,
           COUNT(1) AS ledgerCount
         FROM credit_ledgers
         WHERE created_at >= ?`,
      )
      .get(since) as any;

    const ordersRow = db
      .prepare(
        `SELECT
           COUNT(1) AS totalOrders,
           SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paidOrders,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingOrders,
           SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refundedOrders,
           COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_cents ELSE 0 END), 0) AS revenueCents
         FROM billing_orders
         WHERE created_at >= ?`,
      )
      .get(since) as any;

    const failureReasons = db
      .prepare(
        `SELECT
           CASE
             WHEN error_message IS NULL OR TRIM(error_message) = '' THEN 'unknown'
             ELSE SUBSTR(TRIM(error_message), 1, 80)
           END AS reason,
           COUNT(1) AS count
         FROM image_jobs
         WHERE created_at >= ?
           AND status = 'failed'
         GROUP BY reason
         ORDER BY count DESC, reason ASC
         LIMIT 8`,
      )
      .all(since) as Array<{ reason?: string; count?: number }>;

    const feedbackReasons = db
      .prepare(
        `SELECT
           CASE
             WHEN TRIM(issue_type) != '' THEN issue_type
             WHEN rating = 'dislike' THEN 'dislike'
             WHEN TRIM(note) != '' THEN 'note'
             ELSE 'other'
           END AS reason,
           COUNT(1) AS count
         FROM image_feedbacks
         WHERE updated_at >= ?
           AND (rating = 'dislike' OR TRIM(issue_type) != '' OR TRIM(note) != '')
         GROUP BY reason
         ORDER BY count DESC, reason ASC
         LIMIT 8`,
      )
      .all(since) as Array<{ reason?: string; count?: number }>;

    const jobTotal = Number(jobsRow?.totalJobs || 0);
    const jobCompleted = Number(jobsRow?.succeededJobs || 0) + Number(jobsRow?.failedJobs || 0);
    const paidOrders = Number(ordersRow?.paidOrders || 0);
    const totalOrders = Number(ordersRow?.totalOrders || 0);

    return {
      range,
      since,
      users: {
        total: Number(usersRow?.totalUsers || 0),
        active: Number(usersRow?.activeUsers || 0),
        newInRange: Number(usersRow?.newUsers || 0),
        activeInRange: Number(usersRow?.activeInRange || 0),
      },
      jobs: {
        total: jobTotal,
        succeeded: Number(jobsRow?.succeededJobs || 0),
        failed: Number(jobsRow?.failedJobs || 0),
        active: Number(jobsRow?.activeJobs || 0),
        successRate: jobCompleted > 0
          ? percent(Number(jobsRow?.succeededJobs || 0) / jobCompleted)
          : 0,
      },
      credits: {
        consumed: Number(creditRow?.consumed || 0),
        credited: Number(creditRow?.credited || 0),
        ledgerCount: Number(creditRow?.ledgerCount || 0),
      },
      orders: {
        total: totalOrders,
        paid: paidOrders,
        pending: Number(ordersRow?.pendingOrders || 0),
        refunded: Number(ordersRow?.refundedOrders || 0),
        revenueCents: Number(ordersRow?.revenueCents || 0),
        payRate: totalOrders > 0 ? percent(paidOrders / totalOrders) : 0,
      },
      failureReasons: failureReasons.map((item) => ({
        reason: String(item.reason || 'unknown'),
        count: Number(item.count || 0),
      })),
      feedbackReasons: feedbackReasons.map((item) => ({
        reason: String(item.reason || 'other'),
        count: Number(item.count || 0),
      })),
    };
  }

  @Get('settings/signup-bonus')
  getSignupBonusSettings() {
    const rules = this.settingsRepo.getSignupBonusRules();
    return {
      enabled: rules.enabled,
      usernameBonus: normalizeNonNegativeInt(rules.bySource.username, 5),
    };
  }

  @Put('settings/signup-bonus')
  updateSignupBonusSettings(@Body() body: any, @Req() req: RequestWithUser) {
    const enabled = body?.enabled !== false;
    const usernameBonus = normalizeNonNegativeInt(body?.usernameBonus, 5);

    const rules = this.settingsRepo.saveSignupBonusRules(
      { enabled, usernameBonus },
      req.user.id,
    );

    return {
      enabled: rules.enabled,
      usernameBonus: normalizeNonNegativeInt(rules.bySource.username, 5),
    };
  }

  @Get('settings/bootstrap')
  getSettingsBootstrap() {
    const bootstrap = this.settingsRepo.getAdminSettingsBootstrap();
    return {
      general: bootstrap.general,
      signupBonus: {
        enabled: bootstrap.signupBonus.enabled,
        usernameBonus: normalizeNonNegativeInt(
          bootstrap.signupBonus.bySource.username,
          5,
        ),
      },
      pricing: bootstrap.pricing,
      model: bootstrap.model,
      modelCapabilities: bootstrap.modelCapabilities,
      upload: bootstrap.upload,
    };
  }

  @Put('settings/general')
  updateGeneralSettings(@Body() body: any, @Req() req: RequestWithUser) {
    return this.settingsRepo.saveGeneralSettings(
      {
        siteName: body?.siteName,
        siteSubtitle: body?.siteSubtitle,
        supportContact: body?.supportContact,
        allowRegistration: body?.allowRegistration,
        requireEmailVerification: body?.requireEmailVerification,
        mailFrom: body?.mailFrom,
        mailProvider: body?.mailProvider,
        mailApiUrl: body?.mailApiUrl,
        mailApiKey: body?.mailApiKey,
        mailSubject: body?.mailSubject,
        appBaseUrl: body?.appBaseUrl,
        footerCopyright: body?.footerCopyright,
      },
      req.user.id,
    );
  }

  @Put('settings/pricing')
  updatePricingSettings(@Body() body: any, @Req() req: RequestWithUser) {
    return this.settingsRepo.savePricingSettings(
      {
        free: {
          promptEnhance: body?.free?.promptEnhance,
          textToImage: body?.free?.textToImage,
          imageToImage: body?.free?.imageToImage,
        },
        pro: {
          promptEnhance: body?.pro?.promptEnhance,
          textToImage: body?.pro?.textToImage,
          imageToImage: body?.pro?.imageToImage,
        },
      },
      req.user.id,
    );
  }

  @Put('settings/model')
  updateModelSettings(@Body() body: any, @Req() req: RequestWithUser) {
    return this.settingsRepo.saveModelSettings(
      {
        baseUrl: body?.baseUrl,
        imageModel: body?.imageModel,
        cutoutModel: body?.cutoutModel,
        textModel: body?.textModel,
        timeoutMs: body?.timeoutMs,
        responseFormat: body?.responseFormat,
        sizeFormat: body?.sizeFormat,
      },
      req.user.id,
    );
  }

  @Put('settings/upload')
  updateUploadSettings(@Body() body: any, @Req() req: RequestWithUser) {
    return this.settingsRepo.saveUploadSettings(
      {
        maxFileSizeMb: body?.maxFileSizeMb,
        allowedMimeTypes: body?.allowedMimeTypes,
      },
      req.user.id,
    );
  }

  @Post('users/:id/plan')
  updatePlan(@Param('id') id: string, @Body() body: any) {
    const plan = String(body?.plan || '');
    if (plan !== 'free' && plan !== 'pro') {
      throw new HttpException(
        'plan 只能是 free 或 pro',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = this.usersRepo.findById(id);
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);

    this.usersRepo.updatePlan(id, plan);
    const next = this.usersRepo.findById(id);
    return { user: next };
  }

  @Post('users/:id/credits/adjust')
  adjustCredits(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    const user = this.usersRepo.findById(id);
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);

    const amount = Number(body?.amount);
    const reason = String(body?.reason || 'manual_adjust');
    const result = this.creditsRepo.adjust({
      userId: id,
      amount,
      reason,
      refType: 'admin',
      refId: req.user.id,
    });
    this.auditLogsRepo.create({
      actorUserId: req.user.id,
      targetUserId: id,
      category: 'admin',
      action: 'user_credits_adjusted',
      status: 'success',
      ip: requestIp(req),
      userAgent: requestUserAgent(req),
      detail: {
        username: user.username,
        amount: result.entry.amount,
        reason: result.entry.reason,
        ledgerEntryId: result.entry.id,
        before: { creditBalance: user.creditBalance },
        after: { creditBalance: result.balance },
      },
    });
    return result;
  }

  @Get('users/:id/credits/ledger')
  getLedger(
    @Param('id') id: string,
    @Query('type') type?: string,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    const user = this.usersRepo.findById(id);
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    const limit = normalizeLimit(limitValue, 200, 20);
    const page = normalizePage(pageValue, 1);
    const offset = (page - 1) * limit;

    const allowed = ['grant', 'charge', 'refund', 'adjust'];
    const typeValue = type ? String(type) : '';
    if (typeValue && !allowed.includes(typeValue)) {
      throw new HttpException('type 不合法', HttpStatus.BAD_REQUEST);
    }

    const result = this.creditsRepo.listByUserPaged({
      userId: id,
      type: typeValue ? (typeValue as LedgerType) : undefined,
      limit,
      offset,
    });
    return { entries: result.entries, total: result.total };
  }

  @Post('users/:id/role')
  @UseGuards(SuperAdminRoleGuard)
  updateRole(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    const role = String(body?.role || '');
    if (role !== 'user' && role !== 'admin') {
      throw new HttpException(
        'role 只能是 user 或 admin',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = this.usersRepo.findById(id);
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);

    if (user.role === 'superadmin') {
      throw new HttpException('不能修改超级管理员角色', HttpStatus.BAD_REQUEST);
    }

    this.usersRepo.updateRole(id, role);
    const next = this.usersRepo.findById(id);
    this.auditLogsRepo.create({
      actorUserId: req.user.id,
      targetUserId: id,
      category: 'admin',
      action: 'user_role_updated',
      status: 'success',
      ip: requestIp(req),
      userAgent: requestUserAgent(req),
      detail: {
        username: user.username,
        before: { role: user.role },
        after: { role },
      },
    });
    return { user: next };
  }

  @Post('users/:id/status')
  @UseGuards(SuperAdminRoleGuard)
  updateStatus(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    const status = normalizeUserStatus(body?.status);
    const user = this.usersRepo.findById(id);
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    if (user.role === 'superadmin') {
      throw new HttpException('不能封禁超级管理员', HttpStatus.BAD_REQUEST);
    }
    if (req.user.id === id && status === 'banned') {
      throw new HttpException('不能封禁当前登录账号', HttpStatus.BAD_REQUEST);
    }

    this.usersRepo.updateStatus(id, status);
    this.auditLogsRepo.create({
      actorUserId: req.user.id,
      targetUserId: id,
      category: 'admin',
      action:
        status === 'banned'
          ? 'user_banned'
          : status === 'pending_verification'
            ? 'user_marked_pending_verification'
            : 'user_unbanned',
      status: 'success',
      ip: requestIp(req),
      userAgent: requestUserAgent(req),
      detail: {
        username: user.username,
        before: { status: user.status },
        after: { status },
      },
    });
    return { user: this.usersRepo.findById(id) };
  }

  @Post('users/:id/password')
  @UseGuards(SuperAdminRoleGuard)
  updatePassword(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    const password = String(body?.password || '');
    if (password.length < 6) {
      throw new HttpException('密码至少 6 位', HttpStatus.BAD_REQUEST);
    }

    const user = this.usersRepo.findById(id);
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);

    this.usersRepo.updatePasswordHash(id, hashPassword(password));
    this.auditLogsRepo.create({
      actorUserId: req.user.id,
      targetUserId: id,
      category: 'admin',
      action: 'user_password_updated',
      status: 'success',
      ip: requestIp(req),
      userAgent: requestUserAgent(req),
      detail: { username: user.username },
    });
    return { ok: true };
  }

  @Delete('users/:id')
  @UseGuards(SuperAdminRoleGuard)
  async deleteUser(@Param('id') id: string, @Req() req: RequestWithUser) {
    const user = this.usersRepo.findById(id);
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    if (user.role === 'superadmin') {
      throw new HttpException('不能删除超级管理员', HttpStatus.BAD_REQUEST);
    }
    if (req.user.id === id) {
      throw new HttpException('不能删除当前登录账号', HttpStatus.BAD_REQUEST);
    }

    const assetUrls = this.imagesRepo.listAssetUrlsByUser({ userId: id });
    const deletedUserSnapshot = {
      username: user.username,
      plan: user.plan,
      role: user.role,
      status: user.status,
      creditBalance: user.creditBalance,
      createdAt: user.createdAt,
    };

    this.sqlite.transaction(() => {
      this.dialogueRepo.deleteAllByUser({ userId: id });
      this.imagesRepo.deleteAllByUser({ userId: id });
      this.imageFeedbackRepo.deleteAllByUser({ userId: id });
      this.sqlite.connection
        .prepare('DELETE FROM credit_ledgers WHERE user_id = ?')
        .run(id);
      this.sqlite.connection
        .prepare('DELETE FROM redeem_code_claims WHERE user_id = ?')
        .run(id);
      this.sqlite.connection
        .prepare('DELETE FROM announcement_reads WHERE user_id = ?')
        .run(id);
      this.usersRepo.deleteById(id);
    });

    for (const url of assetUrls) {
      await removeUploadedFile(toUploadFilePath(url));
    }

    this.auditLogsRepo.create({
      actorUserId: req.user.id,
      targetUserId: id,
      category: 'admin',
      action: 'user_deleted',
      status: 'success',
      ip: requestIp(req),
      userAgent: requestUserAgent(req),
      detail: {
        username: user.username,
        before: deletedUserSnapshot,
        deletedAssets: assetUrls.length,
      },
    });

    return { ok: true };
  }

  @Get('audit-logs')
  listAuditLogs(
    @Query('category') category?: string,
    @Query('action') action?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    const limit = normalizeLimit(limitValue, 200, 50);
    const page = normalizePage(pageValue, 1);
    const offset = (page - 1) * limit;
    const categoryValue =
      category === 'auth' || category === 'admin' || category === 'security'
        ? category
        : undefined;
    const statusValue =
      status === 'success' || status === 'failure' ? status : undefined;

    return this.auditLogsRepo.listPaged({
      category: categoryValue,
      action: String(action || '').trim() || undefined,
      status: statusValue,
      userId: String(userId || '').trim() || undefined,
      limit,
      offset,
    });
  }

  @Get('exports/users')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="users.csv"')
  exportUsers(
    @Query('search') search?: string,
    @Query('plan') plan?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('minBalance') minBalanceValue?: string,
    @Query('maxBalance') maxBalanceValue?: string,
    @Query('lowBalanceOnly') lowBalanceOnlyValue?: string,
  ) {
    const planValue =
      plan === 'free' || plan === 'pro' ? (plan as UserPlan) : undefined;
    const roleValue =
      role === 'user' || role === 'admin' || role === 'superadmin'
        ? (role as UserRole)
        : undefined;
    const statusValue =
      status === 'active' || status === 'banned' || status === 'pending_verification'
        ? (status as UserStatus)
        : undefined;
    const result = this.usersRepo.listPaged({
      q: search,
      plan: planValue,
      role: roleValue,
      status: statusValue,
      minBalance: normalizeOptionalNumber(minBalanceValue),
      maxBalance: normalizeOptionalNumber(maxBalanceValue),
      lowBalanceOnly: normalizeBoolean(lowBalanceOnlyValue),
      limit: EXPORT_LIMIT,
      offset: 0,
    });
    const csv = toCsv(
      ['id', 'username', 'plan', 'role', 'status', 'creditBalance', 'createdAt', 'lastUsedAt'],
      result.users.map((user) => [
        maskId(user.id),
        user.username,
        user.plan,
        user.role,
        user.status,
        user.creditBalance,
        user.createdAt,
        user.lastUsedAt,
      ]),
    );
    return csvResponse('users', csv, result.total);
  }

  @Get('exports/orders')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="billing-orders.csv"')
  exportOrders(
    @Query('userId') userId?: string,
    @Query('status') status?: string,
  ) {
    const statusValue =
      status === 'pending' ||
      status === 'paid' ||
      status === 'refunded' ||
      status === 'cancelled' ||
      status === 'failed'
        ? status
        : undefined;
    const where: string[] = [];
    const values: any[] = [];
    const id = String(userId || '').trim();
    if (id) {
      where.push('user_id = ?');
      values.push(id);
    }
    if (statusValue) {
      where.push('status = ?');
      values.push(statusValue);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRow = this.sqlite.connection
      .prepare(`SELECT COUNT(1) AS c FROM billing_orders ${whereSql}`)
      .get(...values) as any;
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM billing_orders ${whereSql}
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(...values, EXPORT_LIMIT) as any[];
    const csv = toCsv(
      [
        'id',
        'userId',
        'packageName',
        'creditsAmount',
        'amountCents',
        'currency',
        'status',
        'paymentChannel',
        'paymentRef',
        'createdAt',
        'paidAt',
        'refundedAt',
      ],
      rows.map((row) => [
        maskId(row.id),
        maskId(row.user_id),
        row.package_name,
        row.credits_amount,
        row.amount_cents,
        row.currency,
        row.status,
        row.payment_channel || 'manual',
        maskId(row.payment_ref),
        row.created_at,
        row.paid_at,
        row.refunded_at,
      ]),
    );
    return csvResponse('billing-orders', csv, Number(totalRow?.c || 0));
  }

  @Get('exports/ledger')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="credit-ledger.csv"')
  exportLedger(
    @Query('userId') userId?: string,
    @Query('type') type?: string,
  ) {
    const id = String(userId || '').trim();
    if (!id) {
      throw new HttpException('导出流水需要 userId', HttpStatus.BAD_REQUEST);
    }
    const allowed = ['grant', 'charge', 'refund', 'adjust'];
    const typeValue = type ? String(type) : '';
    if (typeValue && !allowed.includes(typeValue)) {
      throw new HttpException('type 不合法', HttpStatus.BAD_REQUEST);
    }
    const result = this.creditsRepo.listByUserPaged({
      userId: id,
      type: typeValue ? (typeValue as LedgerType) : undefined,
      limit: EXPORT_LIMIT,
      offset: 0,
    });
    const csv = toCsv(
      ['id', 'userId', 'type', 'amount', 'reason', 'refType', 'refId', 'createdAt'],
      result.entries.map((entry) => [
        maskId(entry.id),
        maskId(entry.userId),
        entry.type,
        entry.amount,
        entry.reason,
        entry.refType || '',
        maskId(entry.refId),
        entry.createdAt,
      ]),
    );
    return csvResponse('credit-ledger', csv, result.total);
  }

  @Get('exports/audit-logs')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
  exportAuditLogs(
    @Query('category') category?: string,
    @Query('action') action?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    const categoryValue =
      category === 'auth' || category === 'admin' || category === 'security'
        ? category
        : undefined;
    const statusValue =
      status === 'success' || status === 'failure' ? status : undefined;
    const result = this.auditLogsRepo.listPaged({
      category: categoryValue,
      action: String(action || '').trim() || undefined,
      status: statusValue,
      userId: String(userId || '').trim() || undefined,
      limit: EXPORT_LIMIT,
      offset: 0,
    });
    const csv = toCsv(
      ['id', 'actorUserId', 'targetUserId', 'category', 'action', 'status', 'ip', 'detail', 'createdAt'],
      result.entries.map((entry) => [
        maskId(entry.id),
        maskId(entry.actorUserId),
        maskId(entry.targetUserId),
        entry.category,
        entry.action,
        entry.status,
        entry.ip,
        safeJson(entry.detail),
        entry.createdAt,
      ]),
    );
    return csvResponse('audit-logs', csv, result.total);
  }

  @Get('image-feedback')
  listImageFeedback(
    @Query('rating') ratingValue?: string,
    @Query('issueType') issueTypeValue?: string,
    @Query('lowOnly') lowOnlyValue?: string,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    const limit = normalizeLimit(limitValue, 100, 20);
    const page = normalizePage(pageValue, 1);
    const offset = (page - 1) * limit;
    const result = this.imageFeedbackRepo.listSamples({
      rating: normalizeFeedbackRating(ratingValue),
      issueType: normalizeFeedbackIssueType(issueTypeValue),
      lowOnly: normalizeBoolean(lowOnlyValue),
      limit,
      offset,
    });
    return {
      samples: result.items,
      total: result.total,
      page,
      limit,
    };
  }
}
