import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { verifySession } from '../utils';
import { UsersRepo } from '../db/repositories/users.repo';

export interface RequestWithUser extends Request {
  user: any;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly lastTouchByUser = new Map<string, number>();
  private readonly touchIntervalMs = 60 * 1000;

  constructor(private readonly usersRepo: UsersRepo) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = request.cookies?.session;
    const userId = verifySession(token);

    if (!userId) {
      throw new UnauthorizedException('请先登录');
    }

    const user = this.usersRepo.findById(userId);

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    if (user.status === 'banned') {
      throw new ForbiddenException('该账号已被封禁，请联系管理员');
    }

    request.user = user;
    this.touchLastUsed(user.id);
    return true;
  }

  private touchLastUsed(userId: string) {
    const now = Date.now();
    const last = this.lastTouchByUser.get(userId) || 0;
    if (now - last < this.touchIntervalMs) return;

    this.lastTouchByUser.set(userId, now);
    this.usersRepo.touchLastUsed(userId, new Date(now).toISOString());
  }
}
