import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestWithUser } from '../auth/auth.guard';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const role = req.user?.role;
    if (role === 'admin' || role === 'superadmin') return true;
    throw new ForbiddenException('无权限访问');
  }
}

@Injectable()
export class SuperAdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const role = req.user?.role;
    if (role === 'superadmin') return true;
    throw new ForbiddenException('仅超级管理员可访问');
  }
}
