import {
  Injectable,
  CanActivate,
  ExecutionContext,
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

    request.user = user;
    return true;
  }
}
