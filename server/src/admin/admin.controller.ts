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
  updateRole(@Param('id') id: string, @Body() body: any) {
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
      detail: { username: user.username },
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

    this.sqlite.transaction(() => {
      this.dialogueRepo.deleteAllByUser({ userId: id });
      this.imagesRepo.deleteAllByUser({ userId: id });
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
      detail: { username: user.username },
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
}
