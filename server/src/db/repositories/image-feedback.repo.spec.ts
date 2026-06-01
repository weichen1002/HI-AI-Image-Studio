import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('ImageFeedbackRepo', () => {
  let sqliteFile = '';
  let sqlite: any;
  let imagesRepo: any;
  let repo: any;

  beforeEach(() => {
    sqliteFile = path.join(os.tmpdir(), `hi-image-feedback-repo-${Date.now()}-${Math.random()}.db`);
    process.env.SQLITE_FILE = sqliteFile;
    jest.resetModules();
    const { SqliteService } = require('../sqlite.service');
    const { ImagesRepo } = require('./images.repo');
    const { ImageFeedbackRepo } = require('./image-feedback.repo');
    sqlite = new SqliteService();
    sqlite.onModuleInit();
    imagesRepo = new ImagesRepo(sqlite);
    repo = new ImageFeedbackRepo(sqlite);
  });

  afterEach(() => {
    sqlite.connection.close();
    for (const filePath of [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`]) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('keeps feedback scoped by image and user', () => {
    const image = imagesRepo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'clean product photo',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['/uploads/a.png'],
    });

    repo.upsert({
      imageId: image.id,
      userId: 'user-1',
      rating: 'dislike',
      issueType: 'bad_quality',
      note: '主体边缘有毛边',
    });

    expect(repo.findByImage({ imageId: image.id, userId: 'user-1' })).toEqual(
      expect.objectContaining({
        imageId: image.id,
        userId: 'user-1',
        rating: 'dislike',
        issueType: 'bad_quality',
        note: '主体边缘有毛边',
      }),
    );
    expect(repo.findByImage({ imageId: image.id, userId: 'user-2' })).toBeNull();
  });

  it('lists low-score samples with image context', () => {
    const disliked = imagesRepo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'bad render',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['/uploads/bad.png'],
    });
    const liked = imagesRepo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'good render',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['/uploads/good.png'],
    });

    repo.upsert({
      imageId: disliked.id,
      userId: 'user-1',
      rating: 'dislike',
      issueType: 'wrong_subject',
    });
    repo.upsert({
      imageId: liked.id,
      userId: 'user-1',
      rating: 'like',
    });

    const page = repo.listSamples({ lowOnly: true, limit: 10, offset: 0 });

    expect(page.total).toBe(1);
    expect(page.items[0]).toEqual(
      expect.objectContaining({
        imageId: disliked.id,
        prompt: 'bad render',
        imageUrls: ['/uploads/bad.png'],
        rating: 'dislike',
        issueType: 'wrong_subject',
      }),
    );
  });
});
