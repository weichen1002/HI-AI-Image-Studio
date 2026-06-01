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
import { AdminRoleGuard } from '../admin/role.guard';
import {
  RedeemCodesRepo,
  RedeemCodeType,
} from '../db/repositories/redeem-codes.repo';
import { AuditLogsRepo } from '../db/repositories/audit-logs.repo';

function normalizeLimit(value: string | undefined, max = 100, fallback = 20) {
  const limit = Number(value || fallback);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(limit)));
}

function normalizePage(value: string | undefined, fallback = 1) {
  const page = Number(value || fallback);
  if (!Number.isFinite(page)) return fallback;
  return Math.max(1, Math.floor(page));
}

function normalizeBoolean(value: any, fallback = true) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function normalizeCodeType(value: any): RedeemCodeType {
  return String(value || '').trim() === 'campaign' ? 'campaign' : 'single';
}

function normalizeOptionalIso(value: any) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new HttpException('结束时间格式不正确', HttpStatus.BAD_REQUEST);
  }
  return date.toISOString();
}

function normalizePositiveInt(value: any, fieldName: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new HttpException(
      `${fieldName} 必须是正整数`,
      HttpStatus.BAD_REQUEST,
    );
  }
  return Math.floor(numberValue);
}

@Controller('api/admin/redeem-codes')
@UseGuards(AuthGuard, AdminRoleGuard)
export class AdminRedeemCodesController {
  constructor(
    private readonly redeemCodesRepo: RedeemCodesRepo,
    private readonly auditLogsRepo: AuditLogsRepo,
  ) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    const limit = normalizeLimit(limitValue, 100, 20);
    const page = normalizePage(pageValue, 1);
    const offset = (page - 1) * limit;
    const result = this.redeemCodesRepo.listAdminPaged({
      q,
      type,
      status,
      limit,
      offset,
    });
    return {
      codes: result.codes,
      total: result.total,
    };
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() body: any) {
    const title = String(body?.title || '').trim();
    if (!title) {
      throw new HttpException('标题不能为空', HttpStatus.BAD_REQUEST);
    }

    const type = normalizeCodeType(body?.type);
    const creditsAmount = normalizePositiveInt(body?.creditsAmount, '兑换余额');
    const totalLimit =
      type === 'single'
        ? 1
        : normalizePositiveInt(body?.totalLimit, '总次数');
    if (type === 'campaign' && totalLimit < 2) {
      throw new HttpException('活动码总次数至少为 2', HttpStatus.BAD_REQUEST);
    }
    const expiresAt = normalizeOptionalIso(body?.expiresAt);
    if (expiresAt && expiresAt <= new Date().toISOString()) {
      throw new HttpException('结束时间必须晚于当前时间', HttpStatus.BAD_REQUEST);
    }

    const code = this.redeemCodesRepo.create({
      title,
      type,
      creditsAmount,
      totalLimit,
      expiresAt,
      enabled: normalizeBoolean(body?.enabled, true),
      createdBy: req.user.id,
    });
    return { code };
  }

  @Put(':id')
  update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const current = this.redeemCodesRepo.findById(id);
    if (!current) {
      throw new HttpException('兑换码不存在', HttpStatus.NOT_FOUND);
    }

    const title =
      body?.title === undefined ? undefined : String(body?.title || '').trim();
    if (title !== undefined && !title) {
      throw new HttpException('标题不能为空', HttpStatus.BAD_REQUEST);
    }

    const creditsAmount =
      body?.creditsAmount === undefined
        ? undefined
        : normalizePositiveInt(body?.creditsAmount, '兑换余额');
    const expiresAt =
      body?.expiresAt === undefined ? undefined : normalizeOptionalIso(body?.expiresAt);
    if (expiresAt && expiresAt <= new Date().toISOString()) {
      throw new HttpException('结束时间必须晚于当前时间', HttpStatus.BAD_REQUEST);
    }

    let totalLimit: number | undefined;
    if (body?.totalLimit !== undefined) {
      if (current.type !== 'campaign') {
        throw new HttpException('单次码不支持修改总次数', HttpStatus.BAD_REQUEST);
      }
      totalLimit = normalizePositiveInt(body?.totalLimit, '总次数');
      if (totalLimit < 2) {
        throw new HttpException('活动码总次数至少为 2', HttpStatus.BAD_REQUEST);
      }
      if (totalLimit < current.redeemedCount) {
        throw new HttpException(
          '总次数不能小于已兑换次数',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const next = this.redeemCodesRepo.update(id, {
      title,
      creditsAmount,
      totalLimit,
      expiresAt,
      enabled:
        body?.enabled === undefined
          ? undefined
          : normalizeBoolean(body?.enabled, current.enabled),
      updatedBy: req.user.id,
    });
    if (!next) {
      throw new HttpException('兑换码不存在', HttpStatus.NOT_FOUND);
    }
    this.auditLogsRepo.create({
      actorUserId: req.user.id,
      targetUserId: id,
      category: 'admin',
      action: 'redeem_code_updated',
      status: 'success',
      detail: {
        title: current.title,
        codeMask: current.codeMask,
        before: {
          title: current.title,
          creditsAmount: current.creditsAmount,
          totalLimit: current.totalLimit,
          expiresAt: current.expiresAt,
          enabled: current.enabled,
        },
        after: {
          title: next.title,
          creditsAmount: next.creditsAmount,
          totalLimit: next.totalLimit,
          expiresAt: next.expiresAt,
          enabled: next.enabled,
        },
      },
    });
    return { code: next };
  }

  @Get(':id/claims')
  listClaims(
    @Param('id') id: string,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    const current = this.redeemCodesRepo.findById(id);
    if (!current) {
      throw new HttpException('兑换码不存在', HttpStatus.NOT_FOUND);
    }
    const limit = normalizeLimit(limitValue, 100, 20);
    const page = normalizePage(pageValue, 1);
    const offset = (page - 1) * limit;
    const result = this.redeemCodesRepo.listClaimsPaged({ codeId: id, limit, offset });
    return {
      claims: result.claims,
      total: result.total,
    };
  }

  @Get(':id/plain-code')
  getPlainCode(@Param('id') id: string) {
    const current = this.redeemCodesRepo.findById(id);
    if (!current) {
      throw new HttpException('兑换码不存在', HttpStatus.NOT_FOUND);
    }
    return {
      id,
      plainCode: this.redeemCodesRepo.getPlainCodeForAdmin(id),
    };
  }

  @Post(':id/enable')
  enable(@Req() req: RequestWithUser, @Param('id') id: string) {
    const current = this.redeemCodesRepo.findById(id);
    const next = this.redeemCodesRepo.setEnabled(id, true, req.user.id);
    if (!next) {
      throw new HttpException('兑换码不存在', HttpStatus.NOT_FOUND);
    }
    this.auditLogsRepo.create({
      actorUserId: req.user.id,
      targetUserId: id,
      category: 'admin',
      action: 'redeem_code_enabled',
      status: 'success',
      detail: {
        title: current?.title || next.title,
        codeMask: next.codeMask,
        before: { enabled: current?.enabled ?? false, status: current ? undefined : null },
        after: { enabled: true },
      },
    });
    return { code: next };
  }

  @Post(':id/disable')
  disable(@Req() req: RequestWithUser, @Param('id') id: string) {
    const current = this.redeemCodesRepo.findById(id);
    const next = this.redeemCodesRepo.setEnabled(id, false, req.user.id);
    if (!next) {
      throw new HttpException('兑换码不存在', HttpStatus.NOT_FOUND);
    }
    this.auditLogsRepo.create({
      actorUserId: req.user.id,
      targetUserId: id,
      category: 'admin',
      action: 'redeem_code_disabled',
      status: 'success',
      detail: {
        title: current?.title || next.title,
        codeMask: next.codeMask,
        before: { enabled: current?.enabled ?? true },
        after: { enabled: false },
      },
    });
    return { code: next };
  }
}
