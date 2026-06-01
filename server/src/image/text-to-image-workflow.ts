import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
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
export class TextToImageWorkflow {
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
        'text_to_image',
        pricing,
      ) * params.count;
    const userId = params.user.id;
    const job = this.imageJobStatus.start({
      userId,
      mode: params.mode,
      operationType: 'generate',
      prompt: params.prompt,
      jobId: params.jobId,
    });
    const lifecycle = createImageJobLifecycle({
      creditsRepo: this.creditsRepo,
      userId,
      cost,
      chargeReason: 'text_to_image',
      refundReason: 'text_to_image_refund',
      refId: job.id,
      refundFailureMessage: 'Refund failed after text-to-image error',
      removeFile: removeUploadedFile,
    });

    try {
      lifecycle.charge();

      const result = await this.hiapiService.generateImage(
        params.prompt,
        params.aspectRatio,
        {
          qualityTier: params.qualityTier,
          count: params.count,
          outputFormat: params.outputFormat,
          outputCompression: params.outputCompression,
          background: params.background,
          moderation: params.moderation,
        },
      );
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
      const image = this.sqlite.transaction(() => {
        return this.imagesRepo.create({
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
        });
      });
      this.imageJobStatus.succeed({ jobId: job.id, imageId: image.id });
      return { image };
    } catch (error: any) {
      await lifecycle.cleanupFailure();
      this.imageJobStatus.fail({ jobId: job.id, error });
      logError('TextToImageWorkflow', 'Text-to-image failed', {
        userId,
        refId: job.id,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        mode: params.mode,
        error: toErrorDetails(error),
      });
      const status = error.getStatus
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(error.message || '生图请求失败', status);
    }
  }
}
