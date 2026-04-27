import { Module } from '@nestjs/common';
import { ImageController } from './image.controller';
import { DbService } from '../db/db.service';
import { HiapiService } from '../hiapi/hiapi.service';

@Module({
  controllers: [ImageController],
  providers: [DbService, HiapiService],
})
export class ImageModule {}
