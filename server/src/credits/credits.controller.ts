import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { CreditsRepo } from './credits.repo';

@Controller('api/credits')
@UseGuards(AuthGuard)
export class CreditsController {
  constructor(private readonly creditsRepo: CreditsRepo) {}

  @Get('me')
  getMe(@Req() req: RequestWithUser) {
    return {
      balance: this.creditsRepo.getBalance(req.user.id),
      plan: req.user.plan,
      role: req.user.role,
    };
  }

  @Get('ledger')
  getLedger(@Req() req: RequestWithUser, @Query('limit') limitValue?: string) {
    const limit = Math.max(
      1,
      Math.min(200, Math.floor(Number(limitValue || 50) || 50)),
    );
    const entries = this.creditsRepo.listByUser({ userId: req.user.id, limit });
    return { entries };
  }
}
