import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import * as svgCaptcha from 'svg-captcha';
import {
  signSession,
  verifySession,
  hashPassword,
  verifyPassword,
  publicUser,
  cleanUsername,
} from '../utils';
import { CreditsRepo } from '../credits/credits.repo';
import { RedeemCodesRepo } from '../db/repositories/redeem-codes.repo';
import { UsersRepo } from '../db/repositories/users.repo';
import { SystemSettingsRepo } from '../db/repositories/system-settings.repo';
import { SqliteService } from '../db/sqlite.service';

@Controller('api')
export class AuthController {
  constructor(
    private readonly usersRepo: UsersRepo,
    private readonly creditsRepo: CreditsRepo,
    private readonly redeemCodesRepo: RedeemCodesRepo,
    private readonly settingsRepo: SystemSettingsRepo,
    private readonly sqlite: SqliteService,
  ) {}

  private readonly captchaTtlMs = 2 * 60 * 1000;
  private readonly captchas = new Map<string, { answer: string; expiresAt: number }>();
  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private setSession(res: Response, userId: string) {
    const token = signSession(userId);
    res.cookie('session', token, {
      maxAge: 60 * 60 * 24 * 7 * 1000,
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  private clearSession(res: Response) {
    res.clearCookie('session');
  }

  private cleanupCaptchas(now = Date.now()) {
    for (const [id, item] of this.captchas.entries()) {
      if (item.expiresAt <= now) this.captchas.delete(id);
    }
  }

  private verifyCaptcha(captchaId: string, input: string) {
    this.cleanupCaptchas();
    const record = this.captchas.get(captchaId);
    if (!record) return false;
    this.captchas.delete(captchaId);
    const normalized = String(input || '').trim().toLowerCase();
    return normalized && normalized === record.answer;
  }

  private cleanEmail(value: string | undefined | null) {
    return String(value || '').trim().toLowerCase();
  }

  private isEmail(value: string) {
    return this.emailPattern.test(value);
  }

  @Get('captcha')
  getCaptcha(@Res({ passthrough: true }) res: Response) {
    this.cleanupCaptchas();
    const { text, data } = svgCaptcha.create({
      size: 4,
      ignoreChars: '0o1il',
      noise: 2,
      color: true,
      background: '#f8fafc',
    });

    const captchaId = randomUUID();
    this.captchas.set(captchaId, {
      answer: String(text || '').trim().toLowerCase(),
      expiresAt: Date.now() + this.captchaTtlMs,
    });

    res.setHeader('Cache-Control', 'no-store');
    return { captchaId, svg: data };
  }

  @Get('me')
  getMe(@Req() req: Request) {
    const token = req.cookies.session;
    const userId = verifySession(token);
    if (!userId) return { user: null };

    const user = this.usersRepo.findById(userId);
    if (user) this.usersRepo.touchLastUsed(user.id);
    return { user: publicUser(user) };
  }

  @Get('settings/public')
  getPublicSettings() {
    return this.settingsRepo.getPublicSiteSettings();
  }

  @Post('register')
  register(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const generalSettings = this.settingsRepo.getGeneralSettings();
    if (!generalSettings.allowRegistration) {
      throw new HttpException(
        { msg: '当前已关闭新用户注册，如需开通请联系客服' },
        HttpStatus.FORBIDDEN,
      );
    }

    const username = this.cleanEmail(body.username);
    const password = String(body.password || '');
    const redeemCode = String(body.redeemCode || '');

    if (!username || username.length > 254 || !this.isEmail(username)) {
      throw new HttpException(
        { msg: '请输入有效邮箱' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (password.length < 6) {
      throw new HttpException(
        { msg: '密码至少 6 位' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const captchaId = String(body.captchaId || '');
    const captcha = String(body.captcha || '');
    if (!captchaId || !captcha || !this.verifyCaptcha(captchaId, captcha)) {
      throw new HttpException(
        { msg: '验证码错误或已过期' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = this.usersRepo.findByUsername(username);
    if (existing) {
      throw new HttpException(
        { msg: '邮箱已注册' },
        HttpStatus.CONFLICT,
      );
    }

    const rules = this.settingsRepo.getSignupBonusRules();
    const signupBonus = rules.enabled ? Number(rules.bySource.username || 0) : 0;

    const user = this.sqlite.transaction(() => {
      const created = this.usersRepo.create({
        username,
        passwordHash: hashPassword(password),
        plan: 'free',
        role: 'user',
        creditBalance: 0,
      });

      if (signupBonus > 0) {
        // 注册赠送走独立流水，方便后续在后台追踪与审计。
        this.creditsRepo.grantInTx({
          userId: created.id,
          amount: signupBonus,
          reason: 'signup_bonus',
          refType: 'system',
          refId: 'username',
        });
      }

      return this.usersRepo.findById(created.id) || created;
    });

    let redeemCodeResult = {
      attempted: false,
      success: false,
      amount: 0,
      message: '',
    };

    if (redeemCode.trim()) {
      redeemCodeResult.attempted = true;
      try {
        const result = this.redeemCodesRepo.claim({
          userId: user.id,
          code: redeemCode,
        });
        redeemCodeResult = {
          attempted: true,
          success: true,
          amount: result.amount,
          message: '',
        };
      } catch (error: any) {
        const responsePayload =
          error instanceof HttpException ? error.getResponse() : null;
        const responseMessage =
          responsePayload && typeof responsePayload === 'object'
            ? (responsePayload as { msg?: string }).msg
            : '';
        const message =
          error instanceof HttpException
            ? String(responseMessage || error.message || '兑换失败')
            : '兑换失败';
        redeemCodeResult = {
          attempted: true,
          success: false,
          amount: 0,
          message,
        };
      }
    }

    const finalUser = this.usersRepo.findById(user.id) || user;

    this.usersRepo.touchLastUsed(finalUser.id);
    this.setSession(res, finalUser.id);
    res.status(HttpStatus.CREATED);
    return { user: publicUser(finalUser), redeemCodeResult };
  }

  @Post('login')
  login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const username = cleanUsername(body.username);
    const password = String(body.password || '');
    const user = this.usersRepo.findByUsername(username);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new HttpException(
        { msg: '用户名或密码不正确' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.usersRepo.touchLastUsed(user.id);
    this.setSession(res, user.id);
    return { user: publicUser(this.usersRepo.findById(user.id) || user) };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.clearSession(res);
    return { ok: true };
  }
}
