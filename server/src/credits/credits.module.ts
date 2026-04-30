import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { CreditsController } from './credits.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [CreditsController],
})
export class CreditsModule {}
