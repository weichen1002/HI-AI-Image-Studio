import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { TemplatesController } from './templates.controller';

@Module({
  imports: [AuthModule, DbModule],
  controllers: [TemplatesController],
})
export class TemplatesModule {}
