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
import { SystemSettingsRepo } from '../db/repositories/system-settings.repo';
import { logError, toErrorDetails } from '../logging/logger';
import { checkPromptQuality } from './prompt-quality';

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

function normalizeDirection(value: any) {
  const v = String(value || '').trim();
  const normalized =
    {
      commercial: 'ecommerce',
      concise: 'concise',
    }[v] || v;
  const allowed = [
    'ecommerce',
    'xiaohongshu',
    'poster',
    'wallpaper',
    'english',
    'concise',
  ];
  if (!normalized) return 'ecommerce';
  if (!allowed.includes(normalized)) {
    throw new HttpException('不支持的润色方向', HttpStatus.BAD_REQUEST);
  }
  return normalized;
}

function normalizeImageUrl(value: any) {
  const imageUrl = String(value || '').trim();
  if (!imageUrl) {
    throw new HttpException('请先选择要反推的图片', HttpStatus.BAD_REQUEST);
  }
  if (imageUrl.length > 2_000_000) {
    throw new HttpException('图片地址过长', HttpStatus.BAD_REQUEST);
  }
  if (!/^https?:\/\//i.test(imageUrl) && !/^data:image\//i.test(imageUrl)) {
    throw new HttpException(
      '仅支持在线图片地址或 data:image 图片',
      HttpStatus.BAD_REQUEST,
    );
  }
  return imageUrl;
}

function normalizeOptionalPrompt(value: any) {
  const prompt = String(value || '').trim();
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
    private readonly settingsRepo: SystemSettingsRepo,
  ) {}

  @Post('check')
  check(@Body() body: any) {
    const prompt = normalizeOptionalPrompt(body?.prompt);
    return checkPromptQuality(prompt);
  }

  @Post('enhance')
  async enhance(@Req() req: RequestWithUser, @Body() body: any) {
    const prompt = normalizePrompt(body?.prompt);
    const direction = normalizeDirection(body?.direction);
    const pricing = this.settingsRepo.getPricingSettings();
    const cost = costFor(
      req.user.plan === 'pro' ? 'pro' : 'free',
      'prompt_enhance',
      pricing,
    );
    const refId = crypto.randomUUID();
    const userId = req.user.id;
    let charged = false;

    try {
      this.creditsRepo.charge({
        userId,
        cost,
        reason: 'prompt_enhance',
        refType: 'prompt',
        refId,
      });
      charged = cost > 0;

      const enhanced = await this.hiapiService.enhancePrompt(prompt, direction);
      return { prompt: enhanced };
    } catch (error) {
      if (charged) {
        try {
          this.creditsRepo.refund({
            userId,
            amount: cost,
            reason: 'prompt_enhance_refund',
            refType: 'prompt',
            refId,
          });
        } catch (refundError) {
          logError('PromptsController', 'Refund failed after prompt enhance error', {
            userId,
            refId,
            cost,
            error: toErrorDetails(refundError),
          });
        }
      }
      throw error;
    }
  }

  @Post('describe')
  async describe(@Req() req: RequestWithUser, @Body() body: any) {
    const imageUrl = normalizeImageUrl(body?.imageUrl);
    const sourcePrompt = normalizeOptionalPrompt(body?.sourcePrompt);
    const pricing = this.settingsRepo.getPricingSettings();
    const cost = costFor(
      req.user.plan === 'pro' ? 'pro' : 'free',
      'prompt_enhance',
      pricing,
    );
    const refId = crypto.randomUUID();
    const userId = req.user.id;
    let charged = false;

    try {
      this.creditsRepo.charge({
        userId,
        cost,
        reason: 'prompt_describe',
        refType: 'prompt',
        refId,
      });
      charged = cost > 0;

      const prompt = await this.hiapiService.describeImage({
        imageUrl,
        sourcePrompt,
      });
      return {
        prompt,
        cost,
        billingReason: 'prompt_describe',
        billingPolicy: '按提示词工具价格计费；上游失败自动退回点数',
      };
    } catch (error) {
      if (charged) {
        try {
          this.creditsRepo.refund({
            userId,
            amount: cost,
            reason: 'prompt_describe_refund',
            refType: 'prompt',
            refId,
          });
        } catch (refundError) {
          logError('PromptsController', 'Refund failed after prompt describe error', {
            userId,
            refId,
            cost,
            error: toErrorDetails(refundError),
          });
        }
      }
      throw error;
    }
  }
}
