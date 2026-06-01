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

  it('persists preview image URLs and keeps older records compatible', () => {
    const withPreview = repo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'product photo',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['/uploads/original.png'],
      previewImageUrls: ['/uploads/preview.svg'],
    });
    const withoutPreview = repo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'legacy product photo',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['/uploads/legacy.png'],
    });

    expect(repo.findById({ id: withPreview.id, userId: 'user-1' })).toEqual(
      expect.objectContaining({
        imageUrls: ['/uploads/original.png'],
        previewImageUrls: ['/uploads/preview.svg'],
      }),
    );
    expect(repo.findById({ id: withoutPreview.id, userId: 'user-1' })).toEqual(
      expect.objectContaining({
        imageUrls: ['/uploads/legacy.png'],
        previewImageUrls: [],
      }),
    );

    repo.updateSources({
      id: withPreview.id,
      userId: 'user-1',
      imageUrls: ['/uploads/materialized.png'],
      inputImageUrls: [],
    });

    expect(repo.findById({ id: withPreview.id, userId: 'user-1' })).toEqual(
      expect.objectContaining({
        imageUrls: ['/uploads/materialized.png'],
        previewImageUrls: ['/uploads/preview.svg'],
      }),
    );
    expect(repo.listAssetUrlsByUser({ userId: 'user-1' })).toEqual(
      expect.arrayContaining([
        '/uploads/materialized.png',
        '/uploads/preview.svg',
        '/uploads/legacy.png',
      ]),
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

  it('filters paged images by server-side favorites for the current user only', () => {
    const first = repo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'first favorite',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/first.png'],
    });
    const second = repo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'not favorite',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/second.png'],
    });
    const third = repo.create({
      userId: 'user-1',
      mode: 'image',
      prompt: 'third favorite',
      aspectRatio: '16:9',
      content: '',
      imageUrls: ['https://example.com/third.png'],
    });
    const otherUser = repo.create({
      userId: 'user-2',
      mode: 'text',
      prompt: 'other favorite',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/other.png'],
    });

    expect(repo.updateFavorite({ id: first.id, userId: 'user-1', favorite: true })).toBe(1);
    expect(repo.updateFavorite({ id: third.id, userId: 'user-1', favorite: true })).toBe(1);
    expect(repo.updateFavorite({ id: otherUser.id, userId: 'user-2', favorite: true })).toBe(1);

    const favoritePage = repo.listByUserPaged({
      userId: 'user-1',
      limit: 10,
      offset: 0,
      favorite: true,
    });
    expect(favoritePage.total).toBe(2);
    expect(favoritePage.items.map((item) => item.id).sort()).toEqual([first.id, third.id].sort());
    expect(favoritePage.items.every((item) => item.isFavorite)).toBe(true);

    const pagedFavorite = repo.listByUserPaged({
      userId: 'user-1',
      limit: 1,
      offset: 1,
      favorite: true,
    });
    expect(pagedFavorite.total).toBe(2);
    expect(pagedFavorite.items).toHaveLength(1);
    expect(pagedFavorite.items[0].id).not.toBe(second.id);

    expect(repo.updateFavorite({ id: first.id, userId: 'user-1', favorite: false })).toBe(1);
    expect(repo.findById({ id: first.id, userId: 'user-1' })).toEqual(
      expect.objectContaining({
        favoriteAt: '',
        isFavorite: false,
      }),
    );
  });

  it('filters paged images by generation metadata, references, style boards, and dates', () => {
    const oldPoster = repo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'old poster',
      aspectRatio: '1:1',
      generationParams: { qualityTier: '1k' },
      content: '',
      imageUrls: ['https://example.com/old.png'],
    });
    const referencePoster = repo.create({
      userId: 'user-1',
      mode: 'image',
      prompt: 'reference poster',
      aspectRatio: '16:9',
      generationParams: { qualityTier: '2k' },
      content: '',
      imageUrls: ['https://example.com/reference.png'],
      inputImageUrls: ['https://example.com/input.png'],
    });
    const stylePoster = repo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'style board poster',
      aspectRatio: '16:9',
      generationParams: { qualityTier: '4k' },
      content: '',
      imageUrls: ['https://example.com/style.png'],
    });
    const otherUserStylePoster = repo.create({
      userId: 'user-2',
      mode: 'text',
      prompt: 'private style poster',
      aspectRatio: '16:9',
      generationParams: { qualityTier: '4k' },
      content: '',
      imageUrls: ['https://example.com/private-style.png'],
    });

    sqlite.connection
      .prepare(`UPDATE images SET created_at = ? WHERE id = ?`)
      .run('2026-01-10T00:00:00.000Z', oldPoster.id);
    sqlite.connection
      .prepare(`UPDATE images SET created_at = ? WHERE id = ?`)
      .run('2026-02-15T12:00:00.000Z', referencePoster.id);
    sqlite.connection
      .prepare(`UPDATE images SET created_at = ? WHERE id = ?`)
      .run('2026-03-20T23:00:00.000Z', stylePoster.id);

    const { StyleBoardsRepo } = require('./style-boards.repo');
    const styleBoardsRepo = new StyleBoardsRepo(sqlite);
    const board = styleBoardsRepo.create({
      userId: 'user-1',
      name: 'Campaign style',
      description: '',
    });
    styleBoardsRepo.addRef({
      boardId: board.id,
      userId: 'user-1',
      imageId: stylePoster.id,
      imageUrl: stylePoster.imageUrls[0],
    });
    const otherBoard = styleBoardsRepo.create({
      userId: 'user-2',
      name: 'Private style',
      description: '',
    });
    styleBoardsRepo.addRef({
      boardId: otherBoard.id,
      userId: 'user-2',
      imageId: otherUserStylePoster.id,
      imageUrl: otherUserStylePoster.imageUrls[0],
    });

    expect(repo.listByUserPaged({
      userId: 'user-1',
      limit: 10,
      offset: 0,
      aspectRatio: '16:9',
    }).items.map((item) => item.id).sort()).toEqual([referencePoster.id, stylePoster.id].sort());

    expect(repo.listByUserPaged({
      userId: 'user-1',
      limit: 10,
      offset: 0,
      qualityTier: '4k',
    }).items.map((item) => item.id)).toEqual([stylePoster.id]);

    expect(repo.listByUserPaged({
      userId: 'user-1',
      limit: 10,
      offset: 0,
      hasReference: true,
    }).items.map((item) => item.id)).toEqual([referencePoster.id]);

    expect(repo.listByUserPaged({
      userId: 'user-1',
      limit: 10,
      offset: 0,
      inStyleBoard: true,
    }).items.map((item) => item.id)).toEqual([stylePoster.id]);

    const datedPage = repo.listByUserPaged({
      userId: 'user-1',
      limit: 10,
      offset: 0,
      dateFrom: '2026-02-01T00:00:00.000Z',
      dateTo: '2026-02-28T23:59:59.999Z',
    });
    expect(datedPage.total).toBe(1);
    expect(datedPage.items.map((item) => item.id)).toEqual([referencePoster.id]);
  });

  it('lists variants derived from a source image for the current user only', () => {
    const source = repo.create({
      userId: 'user-1',
      mode: 'text',
      prompt: 'source poster',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/source.png'],
    });
    const firstVariant = repo.create({
      userId: 'user-1',
      mode: 'image',
      prompt: 'first variant',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/first.png'],
      sourceImageId: source.id,
    });
    const secondVariant = repo.create({
      userId: 'user-1',
      mode: 'image',
      prompt: 'second variant',
      aspectRatio: '16:9',
      content: '',
      imageUrls: ['https://example.com/second.png'],
      sourceImageId: source.id,
    });
    repo.create({
      userId: 'user-2',
      mode: 'image',
      prompt: 'private variant',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/private.png'],
      sourceImageId: source.id,
    });

    const variants = repo.listVariantsForImage({
      id: source.id,
      userId: 'user-1',
      limit: 10,
    });
    expect(variants.map((item) => item.id).sort()).toEqual([firstVariant.id, secondVariant.id].sort());
    expect(repo.listVariantsForImage({ id: source.id, userId: 'user-2', limit: 10 })).toHaveLength(1);
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

  it('aggregates dialogue chains with first image, latest image, and round count', () => {
    const first = repo.create({
      userId: 'user-1',
      mode: 'dialogue',
      prompt: 'first round',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/first.png'],
      continuationChainId: 'chain-1',
    });
    const second = repo.create({
      userId: 'user-1',
      mode: 'dialogue',
      prompt: 'second round',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/second.png'],
      continuationChainId: 'chain-1',
    });
    const otherChain = repo.create({
      userId: 'user-1',
      mode: 'dialogue',
      prompt: 'solo round',
      aspectRatio: '16:9',
      content: '',
      imageUrls: ['https://example.com/solo.png'],
      continuationChainId: 'chain-2',
    });
    repo.create({
      userId: 'user-2',
      mode: 'dialogue',
      prompt: 'private round',
      aspectRatio: '1:1',
      content: '',
      imageUrls: ['https://example.com/private.png'],
      continuationChainId: 'chain-1',
    });

    const chains = repo.listDialogueChains({ userId: 'user-1', limit: 10 });
    expect(chains.map((item) => item.chainId).sort()).toEqual(['chain-1', 'chain-2']);
    expect(chains.find((item) => item.chainId === 'chain-1')).toEqual(
      expect.objectContaining({
        firstImage: expect.objectContaining({ id: first.id }),
        lastImage: expect.objectContaining({ id: second.id }),
        roundCount: 2,
      }),
    );
    expect(chains.find((item) => item.chainId === 'chain-2')).toEqual(
      expect.objectContaining({
        firstImage: expect.objectContaining({ id: otherChain.id }),
        lastImage: expect.objectContaining({ id: otherChain.id }),
        roundCount: 1,
      }),
    );
  });
});
