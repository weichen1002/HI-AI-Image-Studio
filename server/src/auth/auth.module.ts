import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { DbModule } from '../db/db.module';
import { AuthGuard } from './auth.guard';
import { EmailService } from './email.service';

@Module({
  controllers: [AuthController],
  imports: [DbModule],
  providers: [AuthGuard, EmailService],
  exports: [AuthGuard],
})
export class AuthModule {}
