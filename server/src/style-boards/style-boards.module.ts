import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { StyleBoardsController } from './style-boards.controller';

@Module({
  imports: [AuthModule, DbModule],
  controllers: [StyleBoardsController],
})
export class StyleBoardsModule {}
