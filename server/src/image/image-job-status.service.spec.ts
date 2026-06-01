import { ImageJobStatusService } from './image-job-status.service';

describe('ImageJobStatusService', () => {
  let repo: any;
  let service: ImageJobStatusService;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    repo = {
      create: jest.fn((params) => ({
        id: 'job-1',
        userId: params.userId,
        mode: params.mode,
        operationType: params.operationType,
        status: params.status,
        prompt: params.prompt,
      })),
      markRunning: jest.fn((id) => ({
        id,
        userId: 'user-1',
        mode: 'text',
        operationType: 'generate',
        status: 'running',
      })),
      markSucceeded: jest.fn(({ id, imageId }) => ({
        id,
        userId: 'user-1',
        mode: 'text',
        operationType: 'generate',
        status: 'succeeded',
        imageId,
      })),
      markFailed: jest.fn(({ id, errorMessage }) => ({
        id,
        userId: 'user-1',
        mode: 'text',
        operationType: 'generate',
        status: 'failed',
        errorMessage,
      })),
    };
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = new ImageJobStatusService(repo);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs created, running, succeeded, and failed status transitions with correlation id', () => {
    const job = service.start({
      userId: 'user-1',
      mode: 'text',
      operationType: 'generate',
      prompt: 'product photo',
    });

    service.succeed({ jobId: job.id, imageId: 'image-1' });
    service.fail({ jobId: job.id, error: new Error('upstream failed') });

    const infoLogs = logSpy.mock.calls.flat().join('\n');
    const errorLogs = errorSpy.mock.calls.flat().join('\n');
    expect(infoLogs).toContain('Image job created');
    expect(infoLogs).toContain('Image job marked running');
    expect(infoLogs).toContain('Image job marked succeeded');
    expect(infoLogs).toContain('"correlationId": "job:job-1"');
    expect(infoLogs).toContain('"userId": "user-1"');
    expect(infoLogs).toContain('"imageId": "image-1"');
    expect(errorLogs).toContain('Image job marked failed');
    expect(errorLogs).toContain('"correlationId": "job:job-1"');
    expect(errorLogs).toContain('"message": "upstream failed"');
  });

  it('logs existing queued jobs when they are marked running', () => {
    service.start({
      userId: 'ignored-user',
      mode: 'dialogue',
      operationType: 'image_to_image',
      prompt: 'retry',
      jobId: 'job-existing',
    });

    const logs = logSpy.mock.calls.flat().join('\n');
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.markRunning).toHaveBeenCalledWith('job-existing');
    expect(logs).toContain('Image job marked running');
    expect(logs).toContain('"correlationId": "job:job-existing"');
  });
});
