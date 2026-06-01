import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('TemplateFavoritesRepo', () => {
  let sqliteFile = '';
  let sqlite: any;
  let repo: any;

  beforeEach(() => {
    sqliteFile = path.join(os.tmpdir(), `hi-image-template-favorites-${Date.now()}-${Math.random()}.db`);
    process.env.SQLITE_FILE = sqliteFile;
    jest.resetModules();
    const { SqliteService } = require('../sqlite.service');
    const { TemplateFavoritesRepo } = require('./template-favorites.repo');
    sqlite = new SqliteService();
    sqlite.onModuleInit();
    repo = new TemplateFavoritesRepo(sqlite);
  });

  afterEach(() => {
    sqlite.connection.close();
    for (const filePath of [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`]) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('stores template favorites per user', () => {
    expect(repo.importFavorites({ userId: 'user-1', templateIds: ['tpl-1', 'tpl-2', 'tpl-1'] })).toBe(2);
    repo.setFavorite({ userId: 'user-2', templateId: 'tpl-1', favorite: true });

    expect(repo.listByUser({ userId: 'user-1' }).sort()).toEqual(['tpl-1', 'tpl-2']);
    expect(repo.listByUser({ userId: 'user-2' })).toEqual(['tpl-1']);

    expect(repo.setFavorite({ userId: 'user-1', templateId: 'tpl-1', favorite: false })).toBe(1);
    expect(repo.listByUser({ userId: 'user-1' })).toEqual(['tpl-2']);
  });
});
