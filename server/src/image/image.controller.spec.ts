import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HttpException } from '@nestjs/common';
import { ImageController } from './image.controller';
import { TextToImageWorkflow } from './text-to-image-workflow';
import { ImageToImageWorkflow } from './image-to-image-workflow';
import { ImageEditWorkflow } from './image-edit-workflow';
import { DialogueImageWorkflow } from './dialogue-image-workflow';
import { config } from '../config';
import {
  DEFAULT_PRICING_SETTINGS,
  DEFAULT_UPLOAD_SETTINGS,
} from '../db/repositories/system-settings.repo';

describe('ImageController generation workflows', () => {
  const originalApiKey = config.HIAPI_API_KEY;
  const originalDataDir = config.DATA_DIR;
  let dataDir = '';
  let imagesRepo: any;
  let imageJobsRepo: any;
  let dialogueRepo: any;
  let imageFeedbackRepo: any;
  let hiapiService: any;
  let creditsRepo: any;
  let sqlite: any;
  let settingsRepo: any;
  let imageJobStatus: any;
  let textToImageWorkflow: TextToImageWorkflow;
  let imageToImageWorkflow: ImageToImageWorkflow;
  let imageEditWorkflow: ImageEditWorkflow;
  let dialogueImageWorkflow: DialogueImageWorkflow;
  let imageJobQueue: any;
  let controller: ImageController;

  const req = {
    user: {
      id: 'user-1',
      plan: 'free',
    },
  } as any;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-image-controller-'));
    config.HIAPI_API_KEY = 'test-api-key';
    config.DATA_DIR = dataDir;

    imagesRepo = {
      create: jest.fn((params) => ({
        id: 'image-1',
        folder: '',
        tags: [],
        createdAt: '2026-05-27T00:00:00.000Z',
        ...params,
      })),
      findById: jest.fn(),
    };
    imageJobsRepo = {
      create: jest.fn((params) => ({
        id: 'job-1',
        imageId: '',
        errorMessage: '',
        createdAt: '2026-05-27T00:00:00.000Z',
        updatedAt: '2026-05-27T00:00:00.000Z',
        ...params,
      })),
      findByIdForUser: jest.fn(),
      listByUserPaged: jest.fn(() => ({ jobs: [], total: 0 })),
      deleteCompletedByUser: jest.fn(() => 0),
      getStatsByUser: jest.fn(() => ({
        queued: 0,
        running: 0,
        succeeded: 0,
        failed: 0,
        cancelled: 0,
        total: 0,
        failureRate: 0,
      })),
      cancelQueued: jest.fn(),
      requeueFailed: jest.fn(),
    };
    dialogueRepo = {};
    imageFeedbackRepo = {
      findByImage: jest.fn(() => null),
      upsert: jest.fn((params) => ({
        ...params,
        createdAt: '2026-05-27T00:00:00.000Z',
        updatedAt: '2026-05-27T00:00:00.000Z',
      })),
      deleteByImage: jest.fn(() => 1),
      deleteAllByUser: jest.fn(() => 1),
    };
    hiapiService = {
      generateImage: jest.fn(),
      editImageFromFiles: jest.fn(),
      createDialogueImage: jest.fn(),
    };
    creditsRepo = {
      charge: jest.fn(),
      refund: jest.fn(),
    };
    sqlite = {
      transaction: jest.fn((fn) => fn()),
    };
    settingsRepo = {
      getPricingSettings: jest.fn(() => DEFAULT_PRICING_SETTINGS),
      getUploadSettings: jest.fn(() => DEFAULT_UPLOAD_SETTINGS),
      getModelSettings: jest.fn(() => ({
        cutoutModel: '',
        imageModel: 'gpt-image-2',
        textModel: 'gpt-4.1-mini',
        responseFormat: 'b64_json',
        sizeFormat: 'pixel',
      })),
    };
    imageJobStatus = {
      start: jest.fn(() => ({ id: 'job-1', status: 'running' })),
      succeed: jest.fn(),
      fail: jest.fn(),
    };
    imageJobQueue = {
      enqueue: jest.fn(),
      cancelQueued: jest.fn(() => true),
      getStats: jest.fn(() => ({ queued: 0, running: 0, concurrency: 2 })),
    };
    textToImageWorkflow = new TextToImageWorkflow(
      imagesRepo,
      hiapiService,
      creditsRepo,
      sqlite,
      settingsRepo,
      imageJobStatus,
    );
    imageToImageWorkflow = new ImageToImageWorkflow(
      imagesRepo,
      hiapiService,
      creditsRepo,
      sqlite,
      settingsRepo,
      imageJobStatus,
    );
    imageEditWorkflow = new ImageEditWorkflow(
      imagesRepo,
      hiapiService,
      creditsRepo,
      sqlite,
      settingsRepo,
      imageJobStatus,
    );
    dialogueImageWorkflow = new DialogueImageWorkflow(
      imagesRepo,
      dialogueRepo,
      hiapiService,
      creditsRepo,
      sqlite,
      settingsRepo,
      imageJobStatus,
    );
    controller = new ImageController(
      imagesRepo,
      imageJobsRepo,
      dialogueRepo,
      imageFeedbackRepo,
      sqlite,
      settingsRepo,
      textToImageWorkflow,
      imageToImageWorkflow,
      imageEditWorkflow,
      dialogueImageWorkflow,
      imageJobQueue,
    );
  });

  afterEach(() => {
    config.HIAPI_API_KEY = originalApiKey;
    config.DATA_DIR = originalDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  async function runQueuedJob() {
    const task = imageJobQueue.enqueue.mock.calls.at(-1)?.[0];
    expect(task).toEqual(expect.objectContaining({ jobId: 'job-1' }));
    return task.run();
  }

  it('clears completed jobs for the current user', () => {
    imageJobsRepo.deleteCompletedByUser.mockReturnValue(3);

    expect(controller.clearCompletedJobs(req)).toEqual({ deleted: 3 });
    expect(imageJobsRepo.deleteCompletedByUser).toHaveBeenCalledWith({
      userId: 'user-1',
    });
  });

  it('returns job stats with queue stats', () => {
    imageJobsRepo.getStatsByUser.mockReturnValue({
      queued: 1,
      running: 2,
      succeeded: 3,
      failed: 1,
      cancelled: 0,
      total: 7,
      failureRate: 0.25,
    });
    imageJobQueue.getStats.mockReturnValue({ queued: 4, running: 2, concurrency: 2 });

    expect(controller.getJobStats(req)).toEqual({
      stats: expect.objectContaining({ failureRate: 0.25 }),
      queue: { queued: 4, running: 2, concurrency: 2 },
    });
  });

  it('updates feedback only after the image belongs to the current user', () => {
    imagesRepo.findById.mockReturnValue({
      id: 'image-1',
      userId: 'user-1',
      imageUrls: [],
      inputImageUrls: [],
      previewImageUrls: [],
    });

    const result = controller.updateImageFeedback(req, 'image-1', {
      rating: 'dislike',
      issueType: 'bad_quality',
      note: '画面糊了',
    });

    expect(imageFeedbackRepo.upsert).toHaveBeenCalledWith({
      imageId: 'image-1',
      userId: 'user-1',
      rating: 'dislike',
      issueType: 'bad_quality',
      note: '画面糊了',
    });
    expect(result.feedback).toEqual(expect.objectContaining({ rating: 'dislike' }));
  });

  it('rejects feedback writes for images outside the current user', () => {
    imagesRepo.findById.mockReturnValue(null);

    expect(() =>
      controller.updateImageFeedback(req, 'image-2', { rating: 'like' }),
    ).toThrow(HttpException);
    expect(imageFeedbackRepo.upsert).not.toHaveBeenCalled();
  });

  it('cancels queued jobs without charging', async () => {
    const queuedJob = {
      id: 'job-1',
      userId: 'user-1',
      mode: 'text',
      operationType: 'generate',
      status: 'queued',
      prompt: 'Cancel me',
      imageId: '',
      errorMessage: '',
      payload: {},
      attempts: 0,
      createdAt: '2026-05-27T00:00:00.000Z',
      updatedAt: '2026-05-27T00:00:00.000Z',
    };
    imageJobsRepo.findByIdForUser.mockReturnValue(queuedJob);
    imageJobsRepo.cancelQueued.mockReturnValue({ ...queuedJob, status: 'cancelled' });

    const result = await controller.cancelJob(req, 'job-1');

    expect(result.job).toEqual(expect.objectContaining({ status: 'cancelled' }));
    expect(imageJobsRepo.cancelQueued).toHaveBeenCalledWith({
      id: 'job-1',
      userId: 'user-1',
    });
    expect(imageJobQueue.cancelQueued).toHaveBeenCalledWith('job-1');
    expect(creditsRepo.charge).not.toHaveBeenCalled();
  });

  it('requeues retryable failed jobs without immediate duplicate charge', async () => {
    const failedJob = {
      id: 'job-1',
      userId: 'user-1',
      mode: 'text',
      operationType: 'generate',
      status: 'failed',
      prompt: 'Retry me',
      imageId: '',
      errorMessage: 'temporary failure',
      payload: { kind: 'text-to-image', retryable: true },
      attempts: 1,
      createdAt: '2026-05-27T00:00:00.000Z',
      updatedAt: '2026-05-27T00:00:00.000Z',
    };
    imageJobsRepo.findByIdForUser.mockReturnValue(failedJob);
    imageJobsRepo.requeueFailed.mockReturnValue({ ...failedJob, status: 'queued', errorMessage: '' });

    const result = await controller.retryJob(req, 'job-1');

    expect(result.job).toEqual(expect.objectContaining({ status: 'queued' }));
    expect(imageJobsRepo.requeueFailed).toHaveBeenCalledWith({
      id: 'job-1',
      userId: 'user-1',
    });
    expect(imageJobQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1' }),
    );
    expect(creditsRepo.charge).not.toHaveBeenCalled();
  });

  it('charges, calls HiAPI, and persists text-to-image results', async () => {
    hiapiService.generateImage.mockResolvedValue({
      content: 'created image',
      imageUrls: ['/uploads/generated.png'],
    });

    const result = await controller.createImages(req, {
      prompt: 'A product photo',
      aspectRatio: '1:1',
      qualityTier: '2k',
      count: 2,
      outputFormat: 'webp',
      outputCompression: 80,
      background: 'opaque',
      moderation: 'low',
    });

    expect(result.job).toEqual(
      expect.objectContaining({
        id: 'job-1',
        userId: 'user-1',
        mode: 'text',
        operationType: 'generate',
        status: 'queued',
        prompt: 'A product photo',
      }),
    );
    expect(imageJobQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1' }),
    );
    await runQueuedJob();

    expect(creditsRepo.charge).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        cost: DEFAULT_PRICING_SETTINGS.free.textToImage * 2,
        reason: 'text_to_image',
        refType: 'image_job',
        refId: 'job-1',
      }),
    );
    expect(imageJobStatus.start).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        mode: 'text',
        operationType: 'generate',
        prompt: 'A product photo',
      }),
    );
    expect(hiapiService.generateImage).toHaveBeenCalledWith(
      'A product photo',
      '1:1',
      expect.objectContaining({
        qualityTier: '2k',
        count: 2,
        outputFormat: 'webp',
        outputCompression: 80,
        background: 'opaque',
        moderation: 'low',
      }),
    );
    expect(imagesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        mode: 'text',
        prompt: 'A product photo',
        aspectRatio: '1:1',
        content: 'created image',
        imageUrls: ['/uploads/generated.png'],
        previewImageUrls: [expect.stringMatching(/^\/uploads\/.+\.svg$/)],
        generationParams: expect.objectContaining({
          qualityTier: '2k',
          count: 2,
          outputFormat: 'webp',
          outputCompression: 80,
          background: 'opaque',
          moderation: 'low',
        }),
      }),
    );
    expect(imageJobStatus.succeed).toHaveBeenCalledWith({
      jobId: 'job-1',
      imageId: 'image-1',
    });
    expect(creditsRepo.refund).not.toHaveBeenCalled();
  });

  it('refunds charged credits when text-to-image fails after charging', async () => {
    hiapiService.generateImage.mockRejectedValue(new Error('upstream failed'));

    const result = await controller.createImages(req, {
      prompt: 'A product photo',
      count: 1,
    });

    expect(result.job).toEqual(
      expect.objectContaining({
        id: 'job-1',
        status: 'queued',
        prompt: 'A product photo',
      }),
    );
    await expect(runQueuedJob()).rejects.toBeInstanceOf(HttpException);

    expect(creditsRepo.charge).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        cost: DEFAULT_PRICING_SETTINGS.free.textToImage,
        reason: 'text_to_image',
        refId: 'job-1',
      }),
    );
    expect(creditsRepo.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: DEFAULT_PRICING_SETTINGS.free.textToImage,
        reason: 'text_to_image_refund',
        refType: 'image_job',
        refId: 'job-1',
      }),
    );
    expect(imageJobStatus.fail).toHaveBeenCalledWith({
      jobId: 'job-1',
      error: expect.any(Error),
    });
    expect(imagesRepo.create).not.toHaveBeenCalled();
  });

  it('charges and persists uploaded references for image-to-image results', async () => {
    hiapiService.editImageFromFiles.mockResolvedValue({
      content: 'edited image',
      imageUrls: ['/uploads/generated.png'],
    });

    const file = {
      buffer: Buffer.from('reference image'),
      mimetype: 'image/png',
      originalname: 'reference.png',
      size: 15,
    } as any;

    const result = await controller.createImagesFromImage(
      req,
      { images: [file] },
      {
        prompt: 'Make it cinematic',
        aspectRatio: '16:9',
        qualityTier: '1k',
        count: 1,
      },
    );

    expect(result.job).toEqual(
      expect.objectContaining({
        id: 'job-1',
        userId: 'user-1',
        mode: 'image',
        operationType: 'image_to_image',
        status: 'queued',
        prompt: 'Make it cinematic',
      }),
    );
    await runQueuedJob();

    expect(creditsRepo.charge).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        cost: DEFAULT_PRICING_SETTINGS.free.imageToImage,
        reason: 'image_to_image',
        refId: 'job-1',
      }),
    );
    expect(imageJobStatus.start).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        mode: 'image',
        operationType: 'image_to_image',
        prompt: 'Make it cinematic',
      }),
    );
    expect(hiapiService.editImageFromFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Make it cinematic',
        aspectRatio: '16:9',
        imageFiles: [
          expect.objectContaining({
            fileType: 'image/png',
            fileName: expect.stringMatching(/\.png$/),
          }),
        ],
      }),
    );
    expect(imagesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        mode: 'image',
        operationType: 'image_to_image',
        prompt: 'Make it cinematic',
        aspectRatio: '16:9',
        imageUrls: ['/uploads/generated.png'],
        inputImageUrls: [expect.stringMatching(/^\/uploads\/.+\.png$/)],
        previewImageUrls: [expect.stringMatching(/^\/uploads\/.+\.svg$/)],
      }),
    );
    expect(imageJobStatus.succeed).toHaveBeenCalledWith({
      jobId: 'job-1',
      imageId: 'image-1',
    });
    expect(creditsRepo.refund).not.toHaveBeenCalled();
  });

  it('persists dialogue images and messages for new text-only dialogue chains', async () => {
    dialogueRepo.listByChainAsc = jest.fn(() => []);
    dialogueRepo.createChainId = jest.fn(() => 'chain-1');
    dialogueRepo.createMessage = jest.fn();
    dialogueRepo.listRecentByChain = jest.fn(() => [
      {
        id: 'message-1',
        imageId: 'image-1',
        prompt: 'Make a clean poster',
        createdAt: '2026-05-27T00:00:00.000Z',
      },
    ]);
    hiapiService.createDialogueImage.mockResolvedValue({
      content: 'dialogue image',
      imageUrls: ['/uploads/dialogue.png'],
      responseId: 'response-1',
      outputItems: [{ type: 'image' }],
    });

    const result = await controller.createDialogueImage(
      req,
      undefined,
      {
        prompt: 'Make a clean poster',
        aspectRatio: '4:3',
        count: 1,
      },
    );

    expect(result.job).toEqual(
      expect.objectContaining({
        id: 'job-1',
        userId: 'user-1',
        mode: 'dialogue',
        operationType: 'generate',
        status: 'queued',
        prompt: 'Make a clean poster',
      }),
    );
    await runQueuedJob();

    expect(creditsRepo.charge).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        cost: DEFAULT_PRICING_SETTINGS.free.textToImage,
        reason: 'text_to_image',
        refId: 'job-1',
      }),
    );
    expect(imageJobStatus.start).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        mode: 'dialogue',
        operationType: 'generate',
        prompt: 'Make a clean poster',
      }),
    );
    expect(hiapiService.createDialogueImage).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Make a clean poster',
        userId: 'user-1',
        inputImageUrls: [],
        fallbackInputImageUrls: [],
        historyTurns: [],
        aspectRatio: '4:3',
        count: 1,
      }),
    );
    expect(imagesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        mode: 'dialogue',
        operationType: 'generate',
        prompt: 'Make a clean poster',
        aspectRatio: '4:3',
        imageUrls: ['/uploads/dialogue.png'],
        previewImageUrls: [expect.stringMatching(/^\/uploads\/.+\.svg$/)],
        continuationChainId: 'chain-1',
      }),
    );
    expect(dialogueRepo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 'chain-1',
        userId: 'user-1',
        imageId: 'image-1',
        responseId: 'response-1',
        prompt: 'Make a clean poster',
      }),
    );
    expect(imageJobStatus.succeed).toHaveBeenCalledWith({
      jobId: 'job-1',
      imageId: 'image-1',
    });
  });

  it('refunds and removes temporary uploads when edit tools fail', async () => {
    hiapiService.editImageFromFiles.mockRejectedValue(new Error('edit failed'));

    const imageFile = {
      buffer: Buffer.from('source image'),
      mimetype: 'image/png',
      originalname: 'source.png',
      size: 12,
    } as any;

    const result = await controller.editImage(
      req,
      { image: [imageFile] },
      {
        prompt: 'Remove the background',
        operationType: 'cutout',
        aspectRatio: '1:1',
      },
    );

    expect(result.job).toEqual(
      expect.objectContaining({
        id: 'job-1',
        userId: 'user-1',
        mode: 'tools',
        operationType: 'cutout',
        status: 'queued',
        prompt: 'Remove the background',
      }),
    );
    await expect(runQueuedJob()).rejects.toBeInstanceOf(HttpException);

    expect(creditsRepo.charge).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        cost: DEFAULT_PRICING_SETTINGS.free.imageToImage,
        reason: 'cutout',
        refId: 'job-1',
      }),
    );
    expect(creditsRepo.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: DEFAULT_PRICING_SETTINGS.free.imageToImage,
        reason: 'cutout_refund',
        refType: 'image_job',
        refId: 'job-1',
      }),
    );
    expect(imageJobStatus.fail).toHaveBeenCalledWith({
      jobId: 'job-1',
      error: expect.any(Error),
    });
    expect(imagesRepo.create).not.toHaveBeenCalled();

    const uploadDir = path.join(dataDir, 'uploads');
    expect(fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : []).toEqual([]);
  });
});
