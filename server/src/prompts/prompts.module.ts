import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PromptsController } from './prompts.controller';
import { HiapiService } from '../hiapi/hiapi.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [PromptsController],
  providers: [HiapiService],
})
export class PromptsModule {}
