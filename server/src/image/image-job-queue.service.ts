import { Injectable } from '@nestjs/common';
import { config } from '../config';
import { logError, logInfo, logWarn, toErrorDetails } from '../logging/logger';

export type ImageJobTask = {
  jobId: string;
  run: () => Promise<unknown>;
};

@Injectable()
export class ImageJobQueueService {
  private readonly queue: ImageJobTask[] = [];
  private readonly runningJobIds = new Set<string>();
  private draining = false;
  private runningCount = 0;

  enqueue(task: ImageJobTask) {
    if (this.runningJobIds.has(task.jobId)) {
      logWarn('ImageJobQueueService', 'Duplicate running image job enqueue ignored', {
        ...this.jobMeta(task.jobId),
        reason: 'already_running',
      });
      return;
    }
    if (this.queue.some((item) => item.jobId === task.jobId)) {
      logWarn('ImageJobQueueService', 'Duplicate queued image job enqueue ignored', {
        ...this.jobMeta(task.jobId),
        reason: 'already_queued',
      });
      return;
    }
    this.queue.push(task);
    logInfo('ImageJobQueueService', 'Image job enqueued', this.jobMeta(task.jobId));
    void this.drainSoon();
  }

  cancelQueued(jobId: string) {
    const index = this.queue.findIndex((task) => task.jobId === jobId);
    if (index < 0) {
      logWarn('ImageJobQueueService', 'Queued image job cancellation ignored', {
        ...this.jobMeta(jobId),
        reason: 'not_queued',
      });
      return false;
    }
    this.queue.splice(index, 1);
    logInfo('ImageJobQueueService', 'Queued image job cancelled', this.jobMeta(jobId));
    return true;
  }

  getStats() {
    return {
      queued: this.queue.length,
      running: this.runningCount,
      concurrency: config.IMAGE_JOB_CONCURRENCY,
    };
  }

  private async drainSoon() {
    if (this.draining) return;
    this.draining = true;
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      while (this.queue.length && this.runningCount < config.IMAGE_JOB_CONCURRENCY) {
        const task = this.queue.shift();
        if (!task) continue;
        this.runTask(task);
      }
    } finally {
      this.draining = false;
      if (this.queue.length && this.runningCount < config.IMAGE_JOB_CONCURRENCY) {
        void this.drainSoon();
      }
    }
  }

  private runTask(task: ImageJobTask) {
    this.runningCount += 1;
    this.runningJobIds.add(task.jobId);
    logInfo('ImageJobQueueService', 'Queued image job started', this.jobMeta(task.jobId));
    void task.run()
      .then(() => {
        logInfo('ImageJobQueueService', 'Queued image job finished', this.jobMeta(task.jobId));
      })
      .catch((error) => {
        logError('ImageJobQueueService', 'Queued image job failed', {
          ...this.jobMeta(task.jobId),
          jobId: task.jobId,
          error: toErrorDetails(error),
        });
      })
      .finally(() => {
        this.runningCount = Math.max(0, this.runningCount - 1);
        this.runningJobIds.delete(task.jobId);
        if (this.queue.length) void this.drainSoon();
      });
  }

  private jobMeta(jobId: string) {
    return {
      correlationId: `job:${jobId}`,
      jobId,
      queued: this.queue.length,
      running: this.runningCount,
      concurrency: config.IMAGE_JOB_CONCURRENCY,
    };
  }
}
