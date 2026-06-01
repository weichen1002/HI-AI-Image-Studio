import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import type { Express } from 'express';
import type { RequestWithUser } from '../auth/auth.guard';
import { costFor } from '../credits/pricing';
import { CreditsRepo } from '../credits/credits.repo';
import {
  ImagesRepo,
  type ImageOperationType,
  type ImageMode,
} from '../db/repositories/images.repo';
import { SystemSettingsRepo } from '../db/repositories/system-settings.repo';
import { SqliteService } from '../db/sqlite.service';
import {
  HiapiService,
  type SupportedImageQuality,
  type SupportedImageSize,
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
  size?: string;
  quality?: string;
  operationType?: string;
  outputFormat?: string;
  background?: string;
}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  );
}

@Injectable()
export class ImageEditWorkflow {
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
    imageFile: Express.Multer.File;
    maskFile?: Express.Multer.File;
    prompt: string;
    finalPrompt: string;
    aspectRatio: string;
    size: SupportedImageSize;
    quality: SupportedImageQuality;
    operationType: ImageOperationType;
    mode: ImageMode;
    sourceImage: any;
    sourceImageUrl: string;
    jobId?: string;
  }) {
    const pricing = this.settingsRepo.getPricingSettings();
    const modelSettings = this.settingsRepo.getModelSettings();
    const cost = costFor(
      params.user.plan === 'pro' ? 'pro' : 'free',
      'image_to_image',
      pricing,
    );
    const userId = params.user.id;
    const job = this.imageJobStatus.start({
      userId,
      mode: params.mode,
      operationType: params.operationType,
      prompt: params.prompt,
      jobId: params.jobId,
    });
    let uploadedImage:
      | {
          fileName: string;
          filePath: string;
          url: string;
        }
      | undefined;
    let uploadedMask:
      | {
          fileName: string;
          filePath: string;
          url: string;
        }
      | undefined;
    const lifecycle = createImageJobLifecycle({
      creditsRepo: this.creditsRepo,
      userId,
      cost,
      chargeReason: params.operationType,
      refundReason: `${params.operationType}_refund`,
      refId: job.id,
      refundFailureMessage: 'Refund failed after image edit error',
      refundFailureMeta: { operationType: params.operationType },
      removeFile: removeUploadedFile,
    });

    try {
      lifecycle.charge();

      uploadedImage = await saveUploadedBuffer(params.imageFile);
      lifecycle.trackTemporaryFile(uploadedImage.filePath);
      if (params.maskFile) {
        uploadedMask = await saveUploadedBuffer(params.maskFile);
        lifecycle.trackTemporaryFile(uploadedMask.filePath);
      }

      const result = await this.hiapiService.editImageFromFiles({
        imageFiles: [
          {
            filePath: uploadedImage.filePath,
            fileType: params.imageFile.mimetype,
            fileName: uploadedImage.fileName,
          },
        ],
        maskFilePath: uploadedMask?.filePath,
        maskFileType: params.maskFile?.mimetype,
        maskFileName: uploadedMask?.fileName,
        prompt: params.finalPrompt,
        aspectRatio: params.aspectRatio,
        size: params.size,
        quality: params.quality,
        ...(params.operationType === 'cutout'
          ? {
              modelOverride:
                modelSettings.cutoutModel || modelSettings.imageModel,
              outputFormat: 'png' as const,
              background: 'transparent' as const,
            }
          : params.operationType === 'upscale'
            ? {
                qualityTier: '4k' as const,
                quality: 'high' as const,
              }
          : {}),
      });
      const persistedResults = await persistImageAssetsSafely(
        result.imageUrls,
        mimeForFileName('result.png'),
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

      const inputUrl =
        params.sourceImage?.imageUrls?.[0] ||
        params.sourceImageUrl ||
        uploadedImage.url;
      const keepUploadedSource =
        !params.sourceImage?.imageUrls?.[0] && !params.sourceImageUrl;

      const saved = this.sqlite.transaction(() => {
        return this.imagesRepo.create({
          userId,
          mode: params.mode,
          operationType: params.operationType,
          prompt: params.prompt,
          aspectRatio: params.aspectRatio,
          generationParams: createGenerationParams({
            qualityTier: params.operationType === 'upscale' ? '4k' : undefined,
            size: params.size,
            quality: params.operationType === 'upscale' ? 'high' : params.quality,
            operationType: params.operationType,
            outputFormat: params.operationType === 'cutout' ? 'png' : undefined,
            background:
              params.operationType === 'cutout' ? 'transparent' : undefined,
          }),
          content: result.content,
          imageUrls: persistedResults.urls,
          previewImageUrls,
          inputImageUrls: inputUrl ? [inputUrl] : [],
          sourceImageId: params.sourceImage?.id || '',
        });
      });
      if (!keepUploadedSource) {
        await removeUploadedFile(uploadedImage.filePath);
      }
      await removeUploadedFile(uploadedMask?.filePath || '');
      this.imageJobStatus.succeed({ jobId: job.id, imageId: saved.id });
      return { image: saved };
    } catch (error: any) {
      await lifecycle.cleanupFailure();
      this.imageJobStatus.fail({ jobId: job.id, error });
      logError('ImageEditWorkflow', 'Image edit failed', {
        userId,
        refId: job.id,
        operationType: params.operationType,
        prompt: params.prompt,
        error: toErrorDetails(error),
      });
      const message = String(error?.message || '').trim();
      if (
        params.operationType === 'cutout' &&
        (
          message.includes('transparent') ||
          message.includes('背景') ||
          message.includes('Upstream request failed')
        )
      ) {
        throw new HttpException(
          '当前抠图模型不支持透明背景编辑，或上游未开通该模型。请在后台模型设置中单独配置 `cutoutModel`，并填写支持透明背景编辑的模型后重试。',
          HttpStatus.BAD_REQUEST,
        );
      }
      const status = error.getStatus
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(message || '编辑失败', status);
    }
  }
}
