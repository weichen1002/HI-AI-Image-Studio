import { Module } from '@nestjs/common';
import { ImageController } from './image.controller';
import { DbModule } from '../db/db.module';
import { HiapiService } from '../hiapi/hiapi.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [ImageController],
  imports: [DbModule, AuthModule],
  providers: [HiapiService],
})
export class ImageModule {}
