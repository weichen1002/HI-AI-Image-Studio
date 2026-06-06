import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import type { Express } from 'express';
import type { RequestWithUser } from '../auth/auth.guard';
import { CreditsRepo } from '../credits/credits.repo';
import { costFor } from '../credits/pricing';
import { DialogueRepo } from '../db/repositories/dialogue.repo';
import { ImagesRepo } from '../db/repositories/images.repo';
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
  filePathToDataUrl,
  mimeForFileName,
  persistImageAssetsSafely,
  removeUploadedFile,
  saveUploadedBuffer,
  urlToInputImage,
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

function toPublicDialogueMessage(message: any) {
  return {
    id: String(message?.id || ''),
    imageId: String(message?.imageId || ''),
    prompt: String(message?.prompt || ''),
    createdAt: String(message?.createdAt || ''),
  };
}

@Injectable()
export class DialogueImageWorkflow {
  constructor(
    private readonly imagesRepo: ImagesRepo,
    private readonly dialogueRepo: DialogueRepo,
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
    qualityTier: '1k' | '2k' | '4k';
    count: number;
    outputFormat: SupportedOutputFormat;
    outputCompression: number;
    background: SupportedBackground;
    moderation: SupportedModeration;
    chainIdValue: string;
    sourceImageId: string;
    referenceFile?: Express.Multer.File;
    jobId?: string;
  }) {
    const pricing = this.settingsRepo.getPricingSettings();
    const userId = params.user.id;
    const sourceImage = params.sourceImageId
      ? this.imagesRepo.findById({ id: params.sourceImageId, userId })
      : null;
    if (params.sourceImageId && !sourceImage) {
      throw new HttpException('来源图片不存在', HttpStatus.NOT_FOUND);
    }

    const candidateChainId =
      params.chainIdValue || String(sourceImage?.continuationChainId || '').trim();
    const historyTurns = candidateChainId
      ? this.dialogueRepo.listByChainAsc({
          chainId: candidateChainId,
          userId,
          limit: 20,
        })
      : [];
    const latestMessage = historyTurns.length
      ? historyTurns[historyTurns.length - 1]
      : null;
    const latestImage = latestMessage?.imageId
      ? this.imagesRepo.findById({ id: latestMessage.imageId, userId })
      : null;
    const chainId = historyTurns.length && candidateChainId
      ? candidateChainId
      : this.dialogueRepo.createChainId();
    const usesImageContext = Boolean(
      historyTurns.length || params.referenceFile || sourceImage?.imageUrls?.[0],
    );
    const operationType = usesImageContext ? 'image_to_image' : 'generate';
    const cost =
      costFor(
        params.user.plan === 'pro' ? 'pro' : 'free',
        usesImageContext ? 'image_to_image' : 'text_to_image',
        pricing,
      ) * params.count;
    const job = this.imageJobStatus.start({
      userId,
      mode: 'dialogue',
      operationType,
      prompt: params.prompt,
      jobId: params.jobId,
    });
    let uploadedReference:
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
      chargeReason: usesImageContext ? 'image_to_image' : 'text_to_image',
      refundReason: 'dialogue_refund',
      refId: job.id,
      refundFailureMessage: 'Refund failed after dialogue error',
      removeFile: removeUploadedFile,
    });

    try {
      lifecycle.charge();

      if (params.referenceFile) {
        uploadedReference = await saveUploadedBuffer(params.referenceFile);
        lifecycle.trackTemporaryFile(uploadedReference.filePath);
      }

      const bootstrapImageInputs = historyTurns.length
        ? []
        : [
            ...(uploadedReference
              ? [
                  await filePathToDataUrl(
                    uploadedReference.filePath,
                    params.referenceFile?.mimetype,
                  ),
                ]
              : []),
            ...(!uploadedReference && sourceImage?.imageUrls?.[0]
              ? [await urlToInputImage(sourceImage.imageUrls[0])]
              : []),
          ].filter(Boolean);
      const continuationImageInputs =
        historyTurns.length && latestImage?.imageUrls?.[0]
          ? [await urlToInputImage(latestImage.imageUrls[0])].filter(Boolean)
          : bootstrapImageInputs;
      const storedInputImageUrls = uploadedReference
        ? [uploadedReference.url]
        : historyTurns.length && latestImage?.imageUrls?.[0]
          ? [latestImage.imageUrls[0]]
          : sourceImage?.imageUrls?.[0]
            ? [sourceImage.imageUrls[0]]
            : [];

      const result = await this.hiapiService.createDialogueImage({
        prompt: params.prompt,
        userId,
        inputImageUrls: bootstrapImageInputs,
        fallbackInputImageUrls: continuationImageInputs,
        historyTurns: historyTurns.map((item) => ({
          prompt: item.prompt,
          inputImageUrls: [],
          outputItems: [],
        })),
        previousResponseId: latestMessage?.responseId || '',
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
      if (persistedResults.degraded || persistedResults.urls.length === 0) {
        throw new HttpException('保存生成图片失败，请稍后重试', HttpStatus.BAD_GATEWAY);
      }
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

      const saved = this.sqlite.transaction(() => {
        const created = this.imagesRepo.create({
          userId,
          mode: 'dialogue',
          operationType,
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
          inputImageUrls: storedInputImageUrls,
          sourceImageId: sourceImage?.id || latestMessage?.imageId || '',
          continuationChainId: chainId,
        });
        this.dialogueRepo.createMessage({
          chainId,
          userId,
          imageId: created.id,
          parentImageId: sourceImage?.id || latestMessage?.imageId || '',
          responseId: result.responseId,
          previousResponseId: latestMessage?.responseId || '',
          inputImageUrls: storedInputImageUrls,
          outputItems: result.outputItems || [],
          prompt: params.prompt,
        });
        return created;
      });
      this.imageJobStatus.succeed({ jobId: job.id, imageId: saved.id });

      return {
        image: saved,
        chainId,
        messages: this.dialogueRepo
          .listRecentByChain({
            chainId,
            userId,
            limit: 5,
          })
          .map(toPublicDialogueMessage),
      };
    } catch (error: any) {
      await lifecycle.cleanupFailure();
      this.imageJobStatus.fail({ jobId: job.id, error });
      logError('DialogueImageWorkflow', 'Dialogue image generation failed', {
        userId,
        refId: job.id,
        chainId,
        error: toErrorDetails(error),
      });
      const status = error.getStatus
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(error.message || '对话创作失败', status);
    }
  }
}
