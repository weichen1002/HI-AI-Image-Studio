import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { config } from '../config';
import { UsersRepo } from '../db/repositories/users.repo';

@Controller('api/admin')
export class AdminBootstrapController {
  constructor(private readonly usersRepo: UsersRepo) {}

  @Post('bootstrap-superadmin')
  bootstrap(@Req() req: Request, @Body() body: any) {
    const token = String(req.headers['x-admin-token'] || '');
    if (!config.ADMIN_TOKEN || token !== config.ADMIN_TOKEN) {
      throw new HttpException('无权限访问', HttpStatus.UNAUTHORIZED);
    }

    const userId = String(body?.userId || '').trim();
    if (!userId) {
      throw new HttpException('userId 不能为空', HttpStatus.BAD_REQUEST);
    }

    const user = this.usersRepo.findById(userId);
    if (!user) {
      throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    }

    this.usersRepo.updateRole(userId, 'superadmin');
    const next = this.usersRepo.findById(userId);
    return { user: next };
  }
}
