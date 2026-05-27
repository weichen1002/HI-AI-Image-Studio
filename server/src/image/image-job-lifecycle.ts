import { CreditsRepo } from '../credits/credits.repo';
import { logError, toErrorDetails } from '../logging/logger';

type TrackedAsset = {
  filePath: string;
  created?: boolean;
};

type ImageJobLifecycleParams = {
  creditsRepo: Pick<CreditsRepo, 'charge' | 'refund'>;
  userId: string;
  cost: number;
  chargeReason: string;
  refundReason: string;
  refId: string;
  refundFailureMessage: string;
  refundFailureMeta?: Record<string, unknown>;
  removeFile: (filePath: string) => Promise<void>;
};

export function createImageJobLifecycle(params: ImageJobLifecycleParams) {
  let charged = false;
  const resultAssets: TrackedAsset[] = [];
  const temporaryFiles: string[] = [];

  return {
    charge() {
      params.creditsRepo.charge({
        userId: params.userId,
        cost: params.cost,
        reason: params.chargeReason,
        refType: 'image_job',
        refId: params.refId,
      });
      charged = params.cost > 0;
    },

    trackResultAssets(assets: TrackedAsset[]) {
      resultAssets.push(...assets);
    },

    trackTemporaryFile(filePath: string | undefined) {
      if (filePath) temporaryFiles.push(filePath);
    },

    async cleanupFailure() {
      for (const item of resultAssets) {
        if (!item.created) continue;
        await params.removeFile(item.filePath);
      }
      for (const filePath of temporaryFiles) {
        await params.removeFile(filePath);
      }
      if (!charged) return;

      try {
        params.creditsRepo.refund({
          userId: params.userId,
          amount: params.cost,
          reason: params.refundReason,
          refType: 'image_job',
          refId: params.refId,
        });
      } catch (refundError) {
        logError('ImageController', params.refundFailureMessage, {
          userId: params.userId,
          refId: params.refId,
          cost: params.cost,
          ...(params.refundFailureMeta || {}),
          error: toErrorDetails(refundError),
        });
      }
    },
  };
}
