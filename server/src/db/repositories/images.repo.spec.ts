import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('ImagesRepo', () => {
  let sqliteFile = '';
  let sqlite: any;
  let repo: any;

  beforeEach(() => {
    sqliteFile = path.join(os.tmpdir(), `hi-image-images-repo-${Date.now()}-${Math.random()}.db`);
    process.env.SQLITE_FILE = sqliteFile;
    jest.resetModules();
    const { SqliteService } = require('../sqlite.service');
    const { ImagesRepo } = require('./images.repo');
    sqlite = new SqliteService();
    sqlite.onModuleInit();
    repo = new ImagesRepo(sqlite);
  });

  afterEach(() => {
    sqlite.connection.close();
    for (const filePath of [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`]) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('persists asset folder and tags on images', () => {
    const image = repo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'product photo',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/image.png'],
    });

    repo.updateAssetMeta({
      id: image.id,
      userId: 'user-1',
      folder: '电商海报',
      tags: ['主图', '夏季'],
    });

    expect(repo.findById({ id: image.id, userId: 'user-1' })).toEqual(
      expect.objectContaining({
        folder: '电商海报',
        tags: ['主图', '夏季'],
      }),
    );
    expect(repo.listByUser({ userId: 'user-1', limit: 10 })[0]).toEqual(
      expect.objectContaining({
        folder: '电商海报',
        tags: ['主图', '夏季'],
      }),
    );
  });

  it('paginates and searches user images', () => {
    repo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'red product poster',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/red.png'],
    });
    repo.create({
      userId: 'user-1',
      mode: 'image',
      prompt: 'blue hero banner',
      aspectRatio: '16:9',
      content: '',
      imageUrls: ['https://example.com/blue.png'],
    });
    repo.create({
      userId: 'user-2',
      mode: 'text',
      prompt: 'red private poster',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/private.png'],
    });

    const searched = repo.listByUserPaged({
      userId: 'user-1',
      limit: 10,
      offset: 0,
      q: 'red',
    });
    expect(searched.total).toBe(1);
    expect(searched.items[0]).toEqual(expect.objectContaining({ prompt: 'red product poster' }));

    const paged = repo.listByUserPaged({
      userId: 'user-1',
      limit: 1,
      offset: 1,
    });
    expect(paged.total).toBe(2);
    expect(paged.items).toHaveLength(1);
  });
});
