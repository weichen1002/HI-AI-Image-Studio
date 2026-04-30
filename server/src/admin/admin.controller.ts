import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { UsersRepo, UserPlan, UserRole } from '../db/repositories/users.repo';
import { CreditsRepo } from '../credits/credits.repo';
import { AdminRoleGuard, SuperAdminRoleGuard } from './role.guard';

function normalizeLimit(value: string | undefined, max = 100, fallback = 50) {
  const limit = Number(value || fallback);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(limit)));
}

@Controller('api/admin')
@UseGuards(AuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(
    private readonly usersRepo: UsersRepo,
    private readonly creditsRepo: CreditsRepo,
  ) {}

  @Get('users')
  listUsers(
    @Query('search') search?: string,
    @Query('limit') limitValue?: string,
  ) {
    const limit = normalizeLimit(limitValue);
    const users = this.usersRepo.search({ q: search, limit });
    return {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        plan: u.plan,
        role: u.role,
        creditBalance: u.creditBalance,
        createdAt: u.createdAt,
      })),
    };
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
  getLedger(@Param('id') id: string, @Query('limit') limitValue?: string) {
    const user = this.usersRepo.findById(id);
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    const limit = normalizeLimit(limitValue, 200, 50);
    const entries = this.creditsRepo.listByUser({ userId: id, limit });
    return { entries };
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
