import { Module } from '@nestjs/common';
import { ImageController } from './image.controller';
import { DbModule } from '../db/db.module';
import { HiapiService } from '../hiapi/hiapi.service';
import { AuthModule } from '../auth/auth.module';
import { ImageJobStatusService } from './image-job-status.service';
import { TextToImageWorkflow } from './text-to-image-workflow';
import { ImageToImageWorkflow } from './image-to-image-workflow';
import { ImageEditWorkflow } from './image-edit-workflow';
import { DialogueImageWorkflow } from './dialogue-image-workflow';
import { ImageJobQueueService } from './image-job-queue.service';

@Module({
  controllers: [ImageController],
  imports: [DbModule, AuthModule],
  providers: [
    HiapiService,
    ImageJobStatusService,
    TextToImageWorkflow,
    ImageToImageWorkflow,
    ImageEditWorkflow,
    DialogueImageWorkflow,
    ImageJobQueueService,
  ],
})
export class ImageModule {}
