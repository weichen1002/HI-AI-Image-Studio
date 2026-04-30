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
import { UsersRepo } from '../db/repositories/users.repo';

@Controller('api')
export class AuthController {
  constructor(private readonly usersRepo: UsersRepo) {}

  private readonly captchaTtlMs = 2 * 60 * 1000;
  private readonly captchas = new Map<string, { answer: string; expiresAt: number }>();

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
    return { user: publicUser(user) };
  }

  @Post('register')
  register(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const captchaId = String(body.captchaId || '');
    const captcha = String(body.captcha || '');
    if (!captchaId || !captcha || !this.verifyCaptcha(captchaId, captcha)) {
      throw new HttpException(
        { msg: '验证码错误或已过期' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const username = cleanUsername(body.username);
    const password = String(body.password || '');

    if (!username || password.length < 6) {
      throw new HttpException(
        { msg: '用户名不能为空，密码至少 6 位' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = this.usersRepo.findByUsername(username);
    if (existing) {
      throw new HttpException(
        { msg: '用户名已存在' },
        HttpStatus.CONFLICT,
      );
    }

    const user = this.usersRepo.create({
      username,
      passwordHash: hashPassword(password),
      plan: 'free',
      role: 'user',
      creditBalance: 0,
    });

    this.setSession(res, user.id);
    res.status(HttpStatus.CREATED);
    return { user: publicUser(user) };
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

    this.setSession(res, user.id);
    return { user: publicUser(user) };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.clearSession(res);
    return { ok: true };
  }
}
