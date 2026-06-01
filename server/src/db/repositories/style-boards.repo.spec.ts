import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('StyleBoardsRepo', () => {
  let sqliteFile = '';
  let sqlite: any;
  let repo: any;

  beforeEach(() => {
    sqliteFile = path.join(os.tmpdir(), `hi-image-style-boards-${Date.now()}-${Math.random()}.db`);
    process.env.SQLITE_FILE = sqliteFile;
    jest.resetModules();
    const { SqliteService } = require('../sqlite.service');
    const { StyleBoardsRepo } = require('./style-boards.repo');
    sqlite = new SqliteService();
    sqlite.onModuleInit();
    repo = new StyleBoardsRepo(sqlite);
  });

  afterEach(() => {
    sqlite.connection.close();
    for (const filePath of [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`]) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('stores boards and references per user', () => {
    const board = repo.create({
      userId: 'user-1',
      name: '电商冷白光',
      description: '干净背景，高级金属质感',
    });
    repo.create({
      userId: 'user-2',
      name: '其他用户',
      description: '',
    });

    const ref = repo.addRef({
      boardId: board.id,
      userId: 'user-1',
      imageId: 'image-1',
      imageUrl: '/uploads/a.png',
      note: '主视觉参考',
    });

    expect(repo.listByUser({ userId: 'user-1' })).toEqual([
      expect.objectContaining({
        id: board.id,
        name: '电商冷白光',
        refs: [
          expect.objectContaining({
            id: ref.id,
            imageId: 'image-1',
            imageUrl: '/uploads/a.png',
          }),
        ],
      }),
    ]);
    expect(repo.listByUser({ userId: 'user-2' })).toHaveLength(1);
    expect(repo.findById({ id: board.id, userId: 'user-2' })).toBeNull();
  });

  it('updates boards and deletes refs with board cleanup', () => {
    const board = repo.create({
      userId: 'user-1',
      name: '旧名称',
      description: '',
    });
    const ref = repo.addRef({
      boardId: board.id,
      userId: 'user-1',
      imageUrl: '/uploads/a.png',
    });

    expect(repo.update({
      id: board.id,
      userId: 'user-1',
      name: '新名称',
      description: '新描述',
    })).toEqual(
      expect.objectContaining({
        name: '新名称',
        description: '新描述',
      }),
    );

    expect(repo.deleteRef({ id: ref.id, boardId: board.id, userId: 'user-1' })).toBe(1);
    expect(repo.findById({ id: board.id, userId: 'user-1' }).refs).toEqual([]);
    expect(repo.delete({ id: board.id, userId: 'user-1' })).toBe(1);
    expect(repo.findById({ id: board.id, userId: 'user-1' })).toBeNull();
  });
});
