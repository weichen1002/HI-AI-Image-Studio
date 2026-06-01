import { config } from '../config';
import { ImageJobQueueService } from './image-job-queue.service';

describe('ImageJobQueueService', () => {
  const originalConcurrency = config.IMAGE_JOB_CONCURRENCY;

  afterEach(() => {
    config.IMAGE_JOB_CONCURRENCY = originalConcurrency;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('respects the configured concurrency limit', async () => {
    config.IMAGE_JOB_CONCURRENCY = 2;
    const service = new ImageJobQueueService();
    let running = 0;
    let maxRunning = 0;
    const releases: Array<() => void> = [];

    const makeTask = (jobId: string) => ({
      jobId,
      run: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            running += 1;
            maxRunning = Math.max(maxRunning, running);
            releases.push(() => {
              running -= 1;
              resolve();
            });
          }),
      ),
    });

    const tasks = [makeTask('job-1'), makeTask('job-2'), makeTask('job-3')];
    tasks.forEach((task) => service.enqueue(task));
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(tasks[0].run).toHaveBeenCalledTimes(1);
    expect(tasks[1].run).toHaveBeenCalledTimes(1);
    expect(tasks[2].run).not.toHaveBeenCalled();
    expect(maxRunning).toBe(2);
    expect(service.getStats()).toEqual({ queued: 1, running: 2, concurrency: 2 });

    releases.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(tasks[2].run).toHaveBeenCalledTimes(1);

    while (releases.length) releases.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(service.getStats()).toEqual({ queued: 0, running: 0, concurrency: 2 });
  });

  it('deduplicates queued jobs and can cancel queued work', async () => {
    config.IMAGE_JOB_CONCURRENCY = 1;
    const service = new ImageJobQueueService();
    let releaseFirst: (() => void) | null = null;
    const first = {
      jobId: 'job-1',
      run: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseFirst = resolve;
          }),
      ),
    };
    const second = { jobId: 'job-2', run: jest.fn(() => Promise.resolve()) };

    service.enqueue(first);
    service.enqueue(second);
    service.enqueue(second);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(first.run).toHaveBeenCalledTimes(1);
    expect(second.run).not.toHaveBeenCalled();
    expect(service.cancelQueued('job-2')).toBe(true);
    expect(service.cancelQueued('job-2')).toBe(false);

    releaseFirst?.();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(second.run).not.toHaveBeenCalled();
  });

  it('logs structured queue lifecycle metadata', async () => {
    config.IMAGE_JOB_CONCURRENCY = 1;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = new ImageJobQueueService();
    const task = { jobId: 'job-log-1', run: jest.fn(() => Promise.resolve()) };

    service.enqueue(task);
    service.enqueue(task);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const combinedLogs = [
      ...logSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...errorSpy.mock.calls.flat(),
    ].join('\n');
    expect(combinedLogs).toContain('Image job enqueued');
    expect(combinedLogs).toContain('Duplicate queued image job enqueue ignored');
    expect(combinedLogs).toContain('Queued image job started');
    expect(combinedLogs).toContain('Queued image job finished');
    expect(combinedLogs).toContain('"correlationId": "job:job-log-1"');
    expect(combinedLogs).toContain('"jobId": "job-log-1"');
  });
});
