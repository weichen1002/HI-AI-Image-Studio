import {
  Body,
  Controller,
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
import { SystemSettingsRepo } from '../db/repositories/system-settings.repo';
import { UsersRepo, UserPlan, UserRole } from '../db/repositories/users.repo';
import { CreditsRepo } from '../credits/credits.repo';
import type { LedgerType } from '../credits/credits.repo';
import { AdminRoleGuard, SuperAdminRoleGuard } from './role.guard';

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

@Controller('api/admin')
@UseGuards(AuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(
    private readonly usersRepo: UsersRepo,
    private readonly creditsRepo: CreditsRepo,
    private readonly settingsRepo: SystemSettingsRepo,
  ) {}

  @Get('users')
  listUsers(
    @Query('search') search?: string,
    @Query('plan') plan?: string,
    @Query('role') role?: string,
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

    const minBalance = normalizeOptionalNumber(minBalanceValue);
    const maxBalance = normalizeOptionalNumber(maxBalanceValue);
    const lowBalanceOnly = normalizeBoolean(lowBalanceOnlyValue);

    const result = this.usersRepo.listPaged({
      q: search,
      plan: planValue,
      role: roleValue,
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
}
