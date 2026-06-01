import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { HiapiController } from './hiapi.controller';

@Module({
  imports: [DbModule],
  controllers: [HiapiController],
})
export class HiapiModule {}
