import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('UserPromptTemplatesRepo', () => {
  let sqliteFile = '';
  let sqlite: any;
  let repo: any;

  beforeEach(() => {
    sqliteFile = path.join(os.tmpdir(), `hi-image-user-templates-${Date.now()}-${Math.random()}.db`);
    process.env.SQLITE_FILE = sqliteFile;
    jest.resetModules();
    const { SqliteService } = require('../sqlite.service');
    const { UserPromptTemplatesRepo } = require('./user-prompt-templates.repo');
    sqlite = new SqliteService();
    sqlite.onModuleInit();
    repo = new UserPromptTemplatesRepo(sqlite);
  });

  afterEach(() => {
    sqlite.connection.close();
    for (const filePath of [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`]) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('stores user templates with arguments per user', () => {
    const created = repo.create({
      userId: 'user-1',
      title: '角色海报',
      description: '带变量的提示词',
      category: '角色',
      prompt: '生成 {argument name="subject" default="少女"} 海报',
      aspectRatio: '9:16',
      arguments: [
        { key: 'subject', label: '主体', defaultValue: '少女', example: '骑士' },
        { key: 'subject', label: '重复主体', defaultValue: '猫', example: '' },
      ],
    });
    repo.create({
      userId: 'user-2',
      title: '隔离模板',
      prompt: 'private',
      arguments: [],
    });

    expect(created.id).toBeTruthy();
    expect(repo.listByUser({ userId: 'user-1' })).toMatchObject([
      {
        id: created.id,
        userId: 'user-1',
        title: '角色海报',
        description: '带变量的提示词',
        category: '角色',
        prompt: '生成 {argument name="subject" default="少女"} 海报',
        aspectRatio: '9:16',
        arguments: [{ key: 'subject', label: '主体', defaultValue: '少女', example: '骑士' }],
      },
    ]);
    expect(repo.findById({ id: created.id, userId: 'user-2' })).toBeNull();
  });

  it('updates and deletes only the owner template', () => {
    const created = repo.create({
      userId: 'user-1',
      title: '旧模板',
      prompt: 'old',
      arguments: [],
    });

    expect(
      repo.update({
        id: created.id,
        userId: 'user-2',
        title: '越权',
        prompt: 'bad',
        arguments: [],
      }),
    ).toBeNull();

    const updated = repo.update({
      id: created.id,
      userId: 'user-1',
      title: '新模板',
      description: 'updated',
      category: '我的模板',
      prompt: 'new',
      arguments: [{ key: 'style', label: '风格', defaultValue: '电影感', example: '' }],
    });
    expect(updated).toMatchObject({
      id: created.id,
      userId: 'user-1',
      title: '新模板',
      prompt: 'new',
      arguments: [{ key: 'style', label: '风格', defaultValue: '电影感', example: '' }],
    });

    expect(repo.delete({ id: created.id, userId: 'user-2' })).toBe(0);
    expect(repo.delete({ id: created.id, userId: 'user-1' })).toBe(1);
    expect(repo.findById({ id: created.id, userId: 'user-1' })).toBeNull();
  });
});
