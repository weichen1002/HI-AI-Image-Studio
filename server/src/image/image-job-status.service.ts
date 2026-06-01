import { Injectable } from '@nestjs/common';
import type { ImageMode, ImageOperationType } from '../db/repositories/images.repo';
import { ImageJobsRepo } from '../db/repositories/image-jobs.repo';
import { logError, logInfo, toErrorDetails } from '../logging/logger';

@Injectable()
export class ImageJobStatusService {
  constructor(private readonly imageJobsRepo: ImageJobsRepo) {}

  start(params: {
    userId: string;
    mode: ImageMode;
    operationType: ImageOperationType;
    prompt: string;
    jobId?: string;
  }) {
    if (params.jobId) {
      const job = this.imageJobsRepo.markRunning(params.jobId);
      if (!job) {
        throw new Error('image job is not queued');
      }
      logInfo('ImageJobStatusService', 'Image job marked running', this.jobMeta({
        jobId: job.id,
        userId: job.userId,
        mode: job.mode,
        operationType: job.operationType,
      }));
      return job;
    }

    const job = this.imageJobsRepo.create({
      userId: params.userId,
      mode: params.mode,
      operationType: params.operationType,
      prompt: params.prompt,
      status: 'queued',
    });
    logInfo('ImageJobStatusService', 'Image job created', this.jobMeta({
      jobId: job.id,
      userId: job.userId,
      mode: job.mode,
      operationType: job.operationType,
    }));
    const runningJob = this.imageJobsRepo.markRunning(job.id) || job;
    logInfo('ImageJobStatusService', 'Image job marked running', this.jobMeta({
      jobId: runningJob.id,
      userId: runningJob.userId,
      mode: runningJob.mode,
      operationType: runningJob.operationType,
    }));
    return runningJob;
  }

  succeed(params: { jobId: string; imageId: string }) {
    const job = this.imageJobsRepo.markSucceeded({
      id: params.jobId,
      imageId: params.imageId,
    });
    logInfo('ImageJobStatusService', 'Image job marked succeeded', {
      ...this.jobMeta({
        jobId: params.jobId,
        userId: job?.userId,
        mode: job?.mode,
        operationType: job?.operationType,
      }),
      imageId: params.imageId,
      statusChanged: Boolean(job),
    });
    return job;
  }

  fail(params: { jobId: string; error: unknown }) {
    const errorMessage = this.toErrorMessage(params.error);
    const job = this.imageJobsRepo.markFailed({
      id: params.jobId,
      errorMessage,
    });
    logError('ImageJobStatusService', 'Image job marked failed', {
      ...this.jobMeta({
        jobId: params.jobId,
        userId: job?.userId,
        mode: job?.mode,
        operationType: job?.operationType,
      }),
      errorMessage,
      error: toErrorDetails(params.error),
      statusChanged: Boolean(job),
    });
    return job;
  }

  private toErrorMessage(error: unknown) {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message || '')
        : String(error || '');
    return message.trim() || 'image job failed';
  }

  private jobMeta(params: {
    jobId: string;
    userId?: string;
    mode?: ImageMode;
    operationType?: ImageOperationType;
  }) {
    return {
      correlationId: `job:${params.jobId}`,
      jobId: params.jobId,
      userId: params.userId,
      mode: params.mode,
      operationType: params.operationType,
    };
  }
}
