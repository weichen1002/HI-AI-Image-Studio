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

  @Get('me')
  getMe(@Req() req: Request, @Res() res: Response) {
    const token = req.cookies.session;
    const userId = verifySession(token);
    if (!userId) return res.json({ user: null });

    const user = this.usersRepo.findById(userId);
    return res.json({ user: publicUser(user) });
  }

  @Post('register')
  register(@Body() body: any, @Res() res: Response) {
    const username = cleanUsername(body.username);
    const password = String(body.password || '');

    if (!username || password.length < 6) {
      throw new HttpException(
        '用户名不能为空，密码至少 6 位',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = this.usersRepo.findByUsername(username);
    if (existing) {
      throw new HttpException('用户名已存在', HttpStatus.CONFLICT);
    }

    const user = this.usersRepo.create({
      username,
      passwordHash: hashPassword(password),
      plan: 'free',
      role: 'user',
      creditBalance: 0,
    });

    this.setSession(res, user.id);
    return res.status(HttpStatus.CREATED).json({ user: publicUser(user) });
  }

  @Post('login')
  login(@Body() body: any, @Res() res: Response) {
    const username = cleanUsername(body.username);
    const password = String(body.password || '');
    const user = this.usersRepo.findByUsername(username);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new HttpException('用户名或密码不正确', HttpStatus.UNAUTHORIZED);
    }

    this.setSession(res, user.id);
    return res.json({ user: publicUser(user) });
  }

  @Post('logout')
  logout(@Res() res: Response) {
    this.clearSession(res);
    return res.json({ ok: true });
  }
}
