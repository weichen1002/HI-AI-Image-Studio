import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('ImageJobsRepo', () => {
  let sqliteFile = '';
  let sqlite: any;
  let repo: any;

  beforeEach(() => {
    sqliteFile = path.join(os.tmpdir(), `hi-image-jobs-repo-${Date.now()}-${Math.random()}.db`);
    process.env.SQLITE_FILE = sqliteFile;
    jest.resetModules();
    const { SqliteService } = require('../sqlite.service');
    const { ImageJobsRepo } = require('./image-jobs.repo');
    sqlite = new SqliteService();
    sqlite.onModuleInit();
    repo = new ImageJobsRepo(sqlite);
  });

  afterEach(() => {
    sqlite.connection.close();
    for (const filePath of [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`]) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('records image job status transitions', () => {
    const job = repo.create({
      userId: 'user-1',
      mode: 'text',
      operationType: 'generate',
      prompt: 'product photo',
    });

    expect(job).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        mode: 'text',
        operationType: 'generate',
        status: 'queued',
        prompt: 'product photo',
        imageId: '',
        errorMessage: '',
      }),
    );

    expect(repo.markRunning(job.id)).toEqual(
      expect.objectContaining({
        id: job.id,
        status: 'running',
      }),
    );

    expect(repo.markSucceeded({ id: job.id, imageId: 'image-1' })).toEqual(
      expect.objectContaining({
        id: job.id,
        status: 'succeeded',
        imageId: 'image-1',
        errorMessage: '',
      }),
    );
    expect(repo.findById(job.id)).toEqual(
      expect.objectContaining({
        status: 'succeeded',
        imageId: 'image-1',
      }),
    );
  });

  it('stores a bounded failure message', () => {
    const job = repo.create({
      userId: 'user-1',
      mode: 'image',
      operationType: 'image_to_image',
      prompt: 'reference image',
    });

    const longMessage = 'x'.repeat(600);
    repo.markFailed({ id: job.id, errorMessage: longMessage });

    const failed = repo.findById(job.id);
    expect(failed).toEqual(
      expect.objectContaining({
        status: 'failed',
      }),
    );
    expect(failed.errorMessage).toHaveLength(500);
  });

  it('stores retry payload and tracks attempts when starting jobs', () => {
    const job = repo.create({
      userId: 'user-1',
      mode: 'text',
      operationType: 'generate',
      prompt: 'retryable product photo',
      payload: {
        kind: 'text-to-image',
        retryable: true,
        count: 2,
      },
    });

    expect(repo.findById(job.id)).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          kind: 'text-to-image',
          retryable: true,
          count: 2,
        }),
        attempts: 0,
      }),
    );

    expect(repo.markRunning(job.id)).toEqual(
      expect.objectContaining({
        status: 'running',
        attempts: 1,
      }),
    );
    expect(repo.markRunning(job.id)).toBeNull();
  });

  it('cancels only queued jobs and requeues only failed jobs', () => {
    const queued = repo.create({
      userId: 'user-1',
      mode: 'text',
      operationType: 'generate',
      prompt: 'cancel me',
    });
    const running = repo.create({
      userId: 'user-1',
      mode: 'text',
      operationType: 'generate',
      prompt: 'running',
    });
    repo.markRunning(running.id);
    const failed = repo.create({
      userId: 'user-1',
      mode: 'text',
      operationType: 'generate',
      prompt: 'retry me',
    });
    repo.markFailed({ id: failed.id, errorMessage: 'temporary failure' });

    expect(repo.cancelQueued({ id: queued.id, userId: 'user-1' })).toEqual(
      expect.objectContaining({ status: 'cancelled' }),
    );
    expect(repo.cancelQueued({ id: running.id, userId: 'user-1' })).toBeNull();
    expect(repo.requeueFailed({ id: failed.id, userId: 'user-1' })).toEqual(
      expect.objectContaining({
        status: 'queued',
        errorMessage: '',
      }),
    );
    expect(repo.requeueFailed({ id: failed.id, userId: 'user-1' })).toBeNull();
  });

  it('returns status counts and failure rate', () => {
    const succeeded = repo.create({
      userId: 'user-1',
      mode: 'text',
      operationType: 'generate',
      prompt: 'done',
    });
    repo.markSucceeded({ id: succeeded.id, imageId: 'image-1' });
    const failed = repo.create({
      userId: 'user-1',
      mode: 'text',
      operationType: 'generate',
      prompt: 'failed',
    });
    repo.markFailed({ id: failed.id, errorMessage: 'bad upstream' });
    repo.create({
      userId: 'user-1',
      mode: 'text',
      operationType: 'generate',
      prompt: 'queued',
    });
    repo.create({
      userId: 'user-2',
      mode: 'text',
      operationType: 'generate',
      prompt: 'other user queued',
    });

    expect(repo.getStatsByUser({ userId: 'user-1' })).toEqual(
      expect.objectContaining({
        queued: 1,
        succeeded: 1,
        failed: 1,
        total: 3,
        failureRate: 0.5,
      }),
    );
  });

  it('deletes only completed jobs for one user', () => {
    const completed = repo.create({
      userId: 'user-1',
      mode: 'text',
      operationType: 'generate',
      prompt: 'done',
    });
    repo.markSucceeded({ id: completed.id, imageId: 'image-1' });

    const failed = repo.create({
      userId: 'user-1',
      mode: 'image',
      operationType: 'image_to_image',
      prompt: 'failed',
    });
    repo.markFailed({ id: failed.id, errorMessage: 'bad upstream' });

    const running = repo.create({
      userId: 'user-1',
      mode: 'dialogue',
      operationType: 'generate',
      prompt: 'still running',
    });
    repo.markRunning(running.id);

    const otherUserCompleted = repo.create({
      userId: 'user-2',
      mode: 'text',
      operationType: 'generate',
      prompt: 'other done',
    });
    repo.markSucceeded({ id: otherUserCompleted.id, imageId: 'image-2' });

    expect(repo.deleteCompletedByUser({ userId: 'user-1' })).toBe(2);
    expect(repo.findById(completed.id)).toBeNull();
    expect(repo.findById(failed.id)).toBeNull();
    expect(repo.findById(running.id)).toEqual(
      expect.objectContaining({ status: 'running' }),
    );
    expect(repo.findById(otherUserCompleted.id)).toEqual(
      expect.objectContaining({ status: 'succeeded' }),
    );
  });
});
