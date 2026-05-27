import { createImageJobLifecycle } from './image-job-lifecycle';

describe('createImageJobLifecycle', () => {
  const baseParams = () => ({
    creditsRepo: {
      charge: jest.fn(),
      refund: jest.fn(),
    },
    userId: 'user-1',
    cost: 3,
    chargeReason: 'text_to_image',
    refundReason: 'text_to_image_refund',
    refId: 'job-1',
    refundFailureMessage: 'Refund failed',
    removeFile: jest.fn().mockResolvedValue(undefined),
  });

  it('charges and refunds when a charged job fails', async () => {
    const params = baseParams();
    const lifecycle = createImageJobLifecycle(params);

    lifecycle.charge();
    await lifecycle.cleanupFailure();

    expect(params.creditsRepo.charge).toHaveBeenCalledWith({
      userId: 'user-1',
      cost: 3,
      reason: 'text_to_image',
      refType: 'image_job',
      refId: 'job-1',
    });
    expect(params.creditsRepo.refund).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: 3,
      reason: 'text_to_image_refund',
      refType: 'image_job',
      refId: 'job-1',
    });
  });

  it('does not refund zero-cost jobs', async () => {
    const params = { ...baseParams(), cost: 0 };
    const lifecycle = createImageJobLifecycle(params);

    lifecycle.charge();
    await lifecycle.cleanupFailure();

    expect(params.creditsRepo.charge).toHaveBeenCalled();
    expect(params.creditsRepo.refund).not.toHaveBeenCalled();
  });

  it('cleans only created result assets and all tracked temporary files', async () => {
    const params = baseParams();
    const lifecycle = createImageJobLifecycle(params);

    lifecycle.trackResultAssets([
      { filePath: '/tmp/created.png', created: true },
      { filePath: '/tmp/existing.png', created: false },
    ]);
    lifecycle.trackTemporaryFile('/tmp/upload.png');
    lifecycle.trackTemporaryFile('');
    await lifecycle.cleanupFailure();

    expect(params.removeFile).toHaveBeenCalledTimes(2);
    expect(params.removeFile).toHaveBeenCalledWith('/tmp/created.png');
    expect(params.removeFile).toHaveBeenCalledWith('/tmp/upload.png');
    expect(params.removeFile).not.toHaveBeenCalledWith('/tmp/existing.png');
  });
});
