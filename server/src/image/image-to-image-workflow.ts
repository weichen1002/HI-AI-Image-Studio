import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import type { Express } from 'express';
import type { RequestWithUser } from '../auth/auth.guard';
import { costFor } from '../credits/pricing';
import { CreditsRepo } from '../credits/credits.repo';
import { ImagesRepo, type ImageMode } from '../db/repositories/images.repo';
import { SystemSettingsRepo } from '../db/repositories/system-settings.repo';
import { SqliteService } from '../db/sqlite.service';
import {
  HiapiService,
  type SupportedBackground,
  type SupportedModeration,
  type SupportedOutputFormat,
} from '../hiapi/hiapi.service';
import { logError, toErrorDetails } from '../logging/logger';
import { createImageJobLifecycle } from './image-job-lifecycle';
import { ImageJobStatusService } from './image-job-status.service';
import {
  createPreviewAssets,
  mimeForFileName,
  persistImageAssetsSafely,
  removeUploadedFile,
  saveUploadedBuffer,
} from './image-assets';

function createGenerationParams(params: {
  qualityTier?: string;
  count?: number;
  outputFormat?: string;
  outputCompression?: number;
  background?: string;
  moderation?: string;
}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  );
}

@Injectable()
export class ImageToImageWorkflow {
  constructor(
    private readonly imagesRepo: ImagesRepo,
    private readonly hiapiService: HiapiService,
    private readonly creditsRepo: CreditsRepo,
    private readonly sqlite: SqliteService,
    private readonly settingsRepo: SystemSettingsRepo,
    private readonly imageJobStatus: ImageJobStatusService,
  ) {}

  async run(params: {
    user: RequestWithUser['user'];
    referenceFiles: Express.Multer.File[];
    prompt: string;
    aspectRatio: string;
    mode: ImageMode;
    qualityTier: '1k' | '2k' | '4k';
    count: number;
    outputFormat: SupportedOutputFormat;
    outputCompression: number;
    background: SupportedBackground;
    moderation: SupportedModeration;
    jobId?: string;
  }) {
    const pricing = this.settingsRepo.getPricingSettings();
    const cost =
      costFor(
        params.user.plan === 'pro' ? 'pro' : 'free',
        'image_to_image',
        pricing,
      ) * params.count;
    const userId = params.user.id;
    const job = this.imageJobStatus.start({
      userId,
      mode: params.mode,
      operationType: 'image_to_image',
      prompt: params.prompt,
      jobId: params.jobId,
    });
    const uploaded: Array<{
      fileName: string;
      filePath: string;
      url: string;
      fileType: string;
    }> = [];
    const lifecycle = createImageJobLifecycle({
      creditsRepo: this.creditsRepo,
      userId,
      cost,
      chargeReason: 'image_to_image',
      refundReason: 'image_to_image_refund',
      refId: job.id,
      refundFailureMessage: 'Refund failed after image-to-image error',
      removeFile: removeUploadedFile,
    });

    try {
      lifecycle.charge();

      for (const file of params.referenceFiles) {
        const saved = await saveUploadedBuffer(file);
        uploaded.push({
          ...saved,
          fileType: file.mimetype,
        });
        lifecycle.trackTemporaryFile(saved.filePath);
      }

      const result = await this.hiapiService.editImageFromFiles({
        imageFiles: uploaded.map((item) => ({
          filePath: item.filePath,
          fileType: item.fileType,
          fileName: item.fileName,
        })),
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        qualityTier: params.qualityTier,
        count: params.count,
        outputFormat: params.outputFormat,
        outputCompression: params.outputCompression,
        background: params.background,
        moderation: params.moderation,
      });
      const persistedResults = await persistImageAssetsSafely(
        result.imageUrls,
        mimeForFileName(`result.${params.outputFormat}`),
      );
      lifecycle.trackResultAssets(
        persistedResults.persisted.map((item) => ({
          filePath: item.filePath,
          created: item.created,
        })),
      );
      const previewImageUrls = await createPreviewAssets({
        imageUrls: persistedResults.urls,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
      });

      const image = {
        userId,
        mode: params.mode,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        generationParams: createGenerationParams({
          qualityTier: params.qualityTier,
          count: params.count,
          outputFormat: params.outputFormat,
          outputCompression: params.outputCompression,
          background: params.background,
          moderation: params.moderation,
        }),
        content: result.content,
        imageUrls: persistedResults.urls,
        previewImageUrls,
        inputImageUrls: uploaded.map((item) => item.url),
        operationType: 'image_to_image' as const,
      };
      const saved = this.sqlite.transaction(() => {
        return this.imagesRepo.create(image);
      });
      this.imageJobStatus.succeed({ jobId: job.id, imageId: saved.id });
      return { image: saved };
    } catch (error: any) {
      await lifecycle.cleanupFailure();
      this.imageJobStatus.fail({ jobId: job.id, error });
      logError('ImageToImageWorkflow', 'Image-to-image failed', {
        userId,
        refId: job.id,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        imageCount: uploaded.length,
        error: toErrorDetails(error),
      });
      const status = error.getStatus
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(error.message || '生图请求失败', status);
    }
  }
}
