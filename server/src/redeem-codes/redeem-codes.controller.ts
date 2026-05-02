import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { RedeemCodesRepo } from '../db/repositories/redeem-codes.repo';

@Controller('api/redeem-codes')
@UseGuards(AuthGuard)
export class RedeemCodesController {
  constructor(private readonly redeemCodesRepo: RedeemCodesRepo) {}

  @Post('claim')
  claim(@Req() req: RequestWithUser, @Body() body: any) {
    const result = this.redeemCodesRepo.claim({
      userId: req.user.id,
      code: body?.code,
    });
    return {
      amount: result.amount,
      balance: result.balance,
      code: result.code,
    };
  }
}
