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

  it('filters paged images by asset folder and tags for the current user only', () => {
    const red = repo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'red product poster',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/red.png'],
    });
    const blue = repo.create({
      userId: 'user-1',
      mode: 'image',
      prompt: 'blue hero banner',
      aspectRatio: '16:9',
      content: '',
      imageUrls: ['https://example.com/blue.png'],
    });
    const unfiled = repo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'draft concept',
      aspectRatio: '4:3',
      content: '',
      imageUrls: ['https://example.com/draft.png'],
    });
    const otherUser = repo.create({
      userId: 'user-2',
      mode: 'text',
      prompt: 'private campaign',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/private.png'],
    });

    repo.updateAssetMeta({
      id: red.id,
      userId: 'user-1',
      folder: '电商海报',
      tags: ['主图', '夏季'],
    });
    repo.updateAssetMeta({
      id: blue.id,
      userId: 'user-1',
      folder: '社媒海报',
      tags: ['社媒'],
    });
    repo.updateAssetMeta({
      id: otherUser.id,
      userId: 'user-2',
      folder: '电商海报',
      tags: ['主图'],
    });

    const folderPage = repo.listByUserPaged({
      userId: 'user-1',
      limit: 10,
      offset: 0,
      folder: '电商海报',
    });
    expect(folderPage.total).toBe(1);
    expect(folderPage.items.map((item) => item.id)).toEqual([red.id]);

    const unfiledPage = repo.listByUserPaged({
      userId: 'user-1',
      limit: 10,
      offset: 0,
      folder: 'unfiled',
    });
    expect(unfiledPage.total).toBe(1);
    expect(unfiledPage.items.map((item) => item.id)).toEqual([unfiled.id]);

    const tagPage = repo.listByUserPaged({
      userId: 'user-1',
      limit: 10,
      offset: 0,
      tag: '主图',
    });
    expect(tagPage.total).toBe(1);
    expect(tagPage.items.map((item) => item.id)).toEqual([red.id]);

    const untaggedPage = repo.listByUserPaged({
      userId: 'user-1',
      limit: 10,
      offset: 0,
      tag: 'untagged',
    });
    expect(untaggedPage.total).toBe(1);
    expect(untaggedPage.items.map((item) => item.id)).toEqual([unfiled.id]);
  });

  it('counts dialogue rounds by chain for the current user only', () => {
    for (const prompt of ['round 1', 'round 2', 'round 3']) {
      repo.create({
        userId: 'user-1',
        mode: 'dialogue',
        prompt,
        aspectRatio: '1:1',
        content: '',
        imageUrls: [`https://example.com/${prompt}.png`],
        continuationChainId: 'chain-1',
      });
    }
    repo.create({
      userId: 'user-2',
      mode: 'dialogue',
      prompt: 'other user round',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/other.png'],
      continuationChainId: 'chain-1',
    });

    expect(repo.countByChains({ userId: 'user-1', chainIds: ['chain-1'] })).toEqual({
      'chain-1': 3,
    });
    expect(repo.countByChains({ userId: 'user-2', chainIds: ['chain-1'] })).toEqual({
      'chain-1': 1,
    });
  });
});
