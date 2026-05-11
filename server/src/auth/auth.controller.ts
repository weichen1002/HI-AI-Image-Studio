import {
  Controller,
  Get,
  Post,
  Body,
  Query,
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
import { AuditLogsRepo } from '../db/repositories/audit-logs.repo';
import { EmailVerificationRepo } from '../db/repositories/email-verification.repo';
import { EmailService } from './email.service';

function requestIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return String(forwarded[0] || '').trim();
  if (typeof forwarded === 'string') return String(forwarded.split(',')[0] || '').trim();
  return String(req.ip || req.socket?.remoteAddress || '').trim();
}

function requestUserAgent(req: Request) {
  return String(req.headers['user-agent'] || '').slice(0, 500);
}

@Controller('api')
export class AuthController {
  constructor(
    private readonly usersRepo: UsersRepo,
    private readonly creditsRepo: CreditsRepo,
    private readonly redeemCodesRepo: RedeemCodesRepo,
    private readonly settingsRepo: SystemSettingsRepo,
    private readonly sqlite: SqliteService,
    private readonly auditLogsRepo: AuditLogsRepo,
    private readonly emailVerificationRepo: EmailVerificationRepo,
    private readonly emailService: EmailService,
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
    if (user?.status === 'banned') return { user: null };
    if (user?.status === 'pending_verification') return { user: null };
    if (user) this.usersRepo.touchLastUsed(user.id);
    return { user: publicUser(user) };
  }

  @Get('settings/public')
  getPublicSettings() {
    return this.settingsRepo.getPublicSiteSettings();
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    const value = String(token || '').trim();
    if (!value) {
      return res.redirect('/login?verify=invalid');
    }

    const record = this.emailVerificationRepo.findValidByToken(value);
    if (!record) {
      return res.redirect('/login?verify=invalid');
    }

    const user = this.usersRepo.findById(record.userId);
    if (!user) {
      return res.redirect('/login?verify=invalid');
    }

    this.usersRepo.updateStatus(user.id, 'active');
    this.emailVerificationRepo.markUsed(record.id);
    this.auditLogsRepo.create({
      actorUserId: user.id,
      targetUserId: user.id,
      category: 'auth',
      action: 'email_verified',
      status: 'success',
      detail: { username: user.username },
    });

    return res.redirect('/login?verify=success');
  }

  @Post('register')
  async register(
    @Body() body: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const generalSettings = this.settingsRepo.getGeneralSettings();
    if (!generalSettings.allowRegistration) {
      this.auditLogsRepo.create({
        category: 'auth',
        action: 'register_blocked',
        status: 'failure',
        ip: requestIp(req),
        userAgent: requestUserAgent(req),
        detail: { reason: 'registration_closed', username: this.cleanEmail(body.username) },
      });
      throw new HttpException(
        { msg: '当前已关闭新用户注册，如需开通请联系客服' },
        HttpStatus.FORBIDDEN,
      );
    }

    const username = this.cleanEmail(body.username);
    const password = String(body.password || '');
    const redeemCode = String(body.redeemCode || '');

    if (!username || username.length > 254 || !this.isEmail(username)) {
      this.auditLogsRepo.create({
        category: 'auth',
        action: 'register_failed',
        status: 'failure',
        ip: requestIp(req),
        userAgent: requestUserAgent(req),
        detail: { reason: 'invalid_email', username },
      });
      throw new HttpException(
        { msg: '请输入有效邮箱' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (password.length < 6) {
      this.auditLogsRepo.create({
        category: 'auth',
        action: 'register_failed',
        status: 'failure',
        ip: requestIp(req),
        userAgent: requestUserAgent(req),
        detail: { reason: 'weak_password', username },
      });
      throw new HttpException(
        { msg: '密码至少 6 位' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const captchaId = String(body.captchaId || '');
    const captcha = String(body.captcha || '');
    if (!captchaId || !captcha || !this.verifyCaptcha(captchaId, captcha)) {
      this.auditLogsRepo.create({
        category: 'security',
        action: 'captcha_failed',
        status: 'failure',
        ip: requestIp(req),
        userAgent: requestUserAgent(req),
        detail: { flow: 'register', username },
      });
      throw new HttpException(
        { msg: '验证码错误或已过期' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = this.usersRepo.findByUsername(username);
    if (existing) {
      this.auditLogsRepo.create({
        category: 'auth',
        action: 'register_failed',
        status: 'failure',
        ip: requestIp(req),
        userAgent: requestUserAgent(req),
        detail: { reason: 'username_exists', username },
      });
      throw new HttpException(
        { msg: '邮箱已注册' },
        HttpStatus.CONFLICT,
      );
    }

    const rules = this.settingsRepo.getSignupBonusRules();
    const signupBonus = rules.enabled ? Number(rules.bySource.username || 0) : 0;
    const requireEmailVerification = generalSettings.requireEmailVerification;

    const user = this.sqlite.transaction(() => {
      const created = this.usersRepo.create({
        username,
        passwordHash: hashPassword(password),
        plan: 'free',
        role: 'user',
        status: requireEmailVerification ? 'pending_verification' : 'active',
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
    let claimedRedeemCodeId = '';

    if (redeemCode.trim()) {
      redeemCodeResult.attempted = true;
      try {
        const result = this.redeemCodesRepo.claim({
          userId: user.id,
          code: redeemCode,
        });
        claimedRedeemCodeId = String(result?.code?.id || '');
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

    if (requireEmailVerification) {
      const finalUser = this.usersRepo.findById(user.id) || user;
      try {
        const verification = this.emailVerificationRepo.create({
          userId: finalUser.id,
          email: finalUser.username,
        });
        const appBaseUrl = generalSettings.appBaseUrl.replace(/\/+$/, '');
        const verifyUrl = `${appBaseUrl}/api/verify-email?token=${encodeURIComponent(verification.token)}`;
        await this.emailService.sendVerificationEmail({
          to: finalUser.username,
          verifyUrl,
        });
        this.auditLogsRepo.create({
          actorUserId: finalUser.id,
          targetUserId: finalUser.id,
          category: 'auth',
          action: 'register_pending_verification',
          status: 'success',
          ip: requestIp(req),
          userAgent: requestUserAgent(req),
          detail: { username: finalUser.username },
        });
        res.status(HttpStatus.CREATED);
        return {
          user: null,
          pendingVerification: true,
          email: finalUser.username,
          redeemCodeResult,
        };
      } catch (error) {
        this.sqlite.transaction(() => {
          if (claimedRedeemCodeId) {
            this.sqlite.connection
              .prepare(
                `UPDATE redeem_codes
                 SET redeemed_count = CASE
                   WHEN redeemed_count > 0 THEN redeemed_count - 1
                   ELSE 0
                 END
                 WHERE id = ?`,
              )
              .run(claimedRedeemCodeId);
          }
          this.sqlite.connection
            .prepare('DELETE FROM email_verification_tokens WHERE user_id = ?')
            .run(finalUser.id);
          this.sqlite.connection
            .prepare('DELETE FROM redeem_code_claims WHERE user_id = ?')
            .run(finalUser.id);
          this.sqlite.connection
            .prepare('DELETE FROM credit_ledgers WHERE user_id = ?')
            .run(finalUser.id);
          this.usersRepo.deleteById(finalUser.id);
        });
        this.auditLogsRepo.create({
          category: 'auth',
          action: 'register_failed',
          status: 'failure',
          ip: requestIp(req),
          userAgent: requestUserAgent(req),
          detail: {
            reason: 'verification_email_send_failed',
            username: finalUser.username,
          },
        });
        throw error;
      }
    }

    const finalUser = this.usersRepo.findById(user.id) || user;
    this.usersRepo.touchLastUsed(finalUser.id);
    this.setSession(res, finalUser.id);
    this.auditLogsRepo.create({
      actorUserId: finalUser.id,
      targetUserId: finalUser.id,
      category: 'auth',
      action: 'register_success',
      status: 'success',
      ip: requestIp(req),
      userAgent: requestUserAgent(req),
      detail: { username: finalUser.username },
    });
    res.status(HttpStatus.CREATED);
    return { user: publicUser(finalUser), redeemCodeResult };
  }

  @Post('login')
  login(
    @Body() body: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const username = cleanUsername(body.username);
    const password = String(body.password || '');
    const user = this.usersRepo.findByUsername(username);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      this.auditLogsRepo.create({
        category: 'auth',
        action: 'login_failed',
        status: 'failure',
        ip: requestIp(req),
        userAgent: requestUserAgent(req),
        detail: { reason: 'invalid_credentials', username },
      });
      throw new HttpException(
        { msg: '用户名或密码不正确' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (user.status === 'banned') {
      this.auditLogsRepo.create({
        actorUserId: user.id,
        targetUserId: user.id,
        category: 'security',
        action: 'login_blocked',
        status: 'failure',
        ip: requestIp(req),
        userAgent: requestUserAgent(req),
        detail: { reason: 'banned_user', username: user.username },
      });
      throw new HttpException(
        { msg: '该账号已被封禁，请联系管理员' },
        HttpStatus.FORBIDDEN,
      );
    }
    if (user.status === 'pending_verification') {
      this.auditLogsRepo.create({
        actorUserId: user.id,
        targetUserId: user.id,
        category: 'security',
        action: 'login_blocked',
        status: 'failure',
        ip: requestIp(req),
        userAgent: requestUserAgent(req),
        detail: { reason: 'pending_verification', username: user.username },
      });
      throw new HttpException(
        { msg: '请先完成邮箱验证后再登录' },
        HttpStatus.FORBIDDEN,
      );
    }

    this.usersRepo.touchLastUsed(user.id);
    this.setSession(res, user.id);
    this.auditLogsRepo.create({
      actorUserId: user.id,
      targetUserId: user.id,
      category: 'auth',
      action: 'login_success',
      status: 'success',
      ip: requestIp(req),
      userAgent: requestUserAgent(req),
      detail: { username: user.username },
    });
    return { user: publicUser(this.usersRepo.findById(user.id) || user) };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.clearSession(res);
    return { ok: true };
  }
}
