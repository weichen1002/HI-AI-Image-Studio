import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { DbModule } from '../db/db.module';
import { AuthGuard } from './auth.guard';

@Module({
  controllers: [AuthController],
  imports: [DbModule],
  providers: [AuthGuard],
  exports: [AuthGuard],
})
export class AuthModule {}
