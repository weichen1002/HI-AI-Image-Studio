import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { HiapiService } from '../hiapi/hiapi.service';
import { CreditsRepo } from '../credits/credits.repo';
import { costFor } from '../credits/pricing';
import * as crypto from 'crypto';

function normalizePrompt(value: any) {
  const prompt = String(value || '').trim();
  if (!prompt) {
    throw new HttpException('请输入提示词', HttpStatus.BAD_REQUEST);
  }
  if (prompt.length > 4000) {
    throw new HttpException('提示词不能超过 4000 字符', HttpStatus.BAD_REQUEST);
  }
  return prompt;
}

@Controller('api/prompts')
@UseGuards(AuthGuard)
export class PromptsController {
  constructor(
    private readonly hiapiService: HiapiService,
    private readonly creditsRepo: CreditsRepo,
  ) {}

  @Post('enhance')
  async enhance(@Req() req: RequestWithUser, @Body() body: any) {
    const prompt = normalizePrompt(body?.prompt);
    const enhanced = await this.hiapiService.enhancePrompt(prompt);

    const cost = costFor(
      req.user.plan === 'pro' ? 'pro' : 'free',
      'prompt_enhance',
    );
    const refId = crypto.randomUUID();
    this.creditsRepo.charge({
      userId: req.user.id,
      cost,
      reason: 'prompt_enhance',
      refType: 'prompt',
      refId,
    });

    return { prompt: enhanced };
  }
}
