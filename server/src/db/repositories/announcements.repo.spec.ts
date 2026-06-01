import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('AnnouncementsRepo', () => {
  let sqliteFile = '';
  let sqlite: any;
  let repo: any;
  let usersRepo: any;

  beforeEach(() => {
    sqliteFile = path.join(os.tmpdir(), `hi-image-announcements-repo-${Date.now()}-${Math.random()}.db`);
    process.env.SQLITE_FILE = sqliteFile;
    jest.resetModules();
    const { SqliteService } = require('../sqlite.service');
    const { AnnouncementsRepo } = require('./announcements.repo');
    const { UsersRepo } = require('./users.repo');
    sqlite = new SqliteService();
    sqlite.onModuleInit();
    repo = new AnnouncementsRepo(sqlite);
    usersRepo = new UsersRepo(sqlite);
  });

  afterEach(() => {
    sqlite.connection.close();
    for (const filePath of [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`]) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  function createUser(params: {
    id: string;
    username: string;
    status?: string;
    role?: string;
    createdAt?: string;
  }) {
    const user = usersRepo.create({
      username: params.username,
      passwordHash: 'hash',
      status: params.status || 'active',
      role: params.role || 'user',
    });
    sqlite.connection
      .prepare('UPDATE users SET id = ?, created_at = ? WHERE id = ?')
      .run(params.id, params.createdAt || '2026-01-10T00:00:00.000Z', user.id);
    return usersRepo.findById(params.id);
  }

  function createPublished(title: string, audience?: any) {
    const announcement = repo.create({
      title,
      contentMd: `${title} content`,
      notifyMode: 'silent',
      repeatMode: 'once',
      audience,
      createdBy: 'admin-1',
    });
    return repo.setStatus(announcement.id, 'published', 'admin-1');
  }

  function addPaidOrder(userId: string) {
    sqlite.connection
      .prepare(
        `INSERT INTO billing_orders(
          id, user_id, package_id, package_name, credits_amount, amount_cents, currency,
          status, created_at, updated_at, paid_at
        ) VALUES(?, ?, 'starter-credits', '入门包', 100, 990, 'CNY', 'paid', ?, ?, ?)`,
      )
      .run(
        `order-${userId}`,
        userId,
        '2026-02-01T00:00:00.000Z',
        '2026-02-01T00:00:00.000Z',
        '2026-02-01T00:00:00.000Z',
      );
  }

  it('keeps empty audience announcements visible to all users', () => {
    createUser({ id: 'user-1', username: 'alice' });
    createPublished('全量公告');

    const active = repo.listActiveForUser({ userId: 'user-1', limit: 10 });

    expect(active.map((item: any) => item.title)).toEqual(['全量公告']);
    expect(active[0].audience).toEqual({});
  });

  it('filters active announcements by status, role, created time, and paid state', () => {
    createUser({
      id: 'user-paid',
      username: 'paid',
      status: 'active',
      role: 'user',
      createdAt: '2026-03-10T00:00:00.000Z',
    });
    createUser({
      id: 'user-old',
      username: 'old',
      status: 'active',
      role: 'user',
      createdAt: '2025-12-20T00:00:00.000Z',
    });
    createUser({
      id: 'admin-1',
      username: 'admin',
      status: 'active',
      role: 'admin',
      createdAt: '2026-03-10T00:00:00.000Z',
    });
    createUser({
      id: 'user-banned',
      username: 'banned',
      status: 'banned',
      role: 'user',
      createdAt: '2026-03-10T00:00:00.000Z',
    });
    addPaidOrder('user-paid');

    createPublished('默认公告');
    createPublished('活跃用户公告', { statuses: ['active'] });
    createPublished('普通用户公告', { roles: ['user'] });
    createPublished('新用户公告', { createdAfter: '2026-01-01T00:00:00.000Z' });
    createPublished('付费用户公告', { paidOnly: true });
    createPublished('管理员公告', { roles: ['admin'] });
    createPublished('封禁用户公告', { statuses: ['banned'] });

    expect(repo.listActiveForUser({ userId: 'user-paid', limit: 20 }).map((item: any) => item.title)).toEqual(
      expect.arrayContaining(['默认公告', '活跃用户公告', '普通用户公告', '新用户公告', '付费用户公告']),
    );
    expect(repo.listActiveForUser({ userId: 'user-paid', limit: 20 }).map((item: any) => item.title)).not.toEqual(
      expect.arrayContaining(['管理员公告', '封禁用户公告']),
    );
    expect(repo.listActiveForUser({ userId: 'user-old', limit: 20 }).map((item: any) => item.title)).not.toEqual(
      expect.arrayContaining(['新用户公告', '付费用户公告']),
    );
    expect(repo.listActiveForUser({ userId: 'admin-1', limit: 20 }).map((item: any) => item.title)).toEqual(
      expect.arrayContaining(['管理员公告']),
    );
    expect(repo.listActiveForUser({ userId: 'user-banned', limit: 20 }).map((item: any) => item.title)).toEqual(
      expect.arrayContaining(['封禁用户公告']),
    );
  });

  it('previews matched users with normalized audience rules', () => {
    createUser({ id: 'user-paid', username: 'paid', role: 'user', createdAt: '2026-03-10T00:00:00.000Z' });
    createUser({ id: 'user-free', username: 'free', role: 'user', createdAt: '2026-03-10T00:00:00.000Z' });
    createUser({ id: 'admin-1', username: 'admin', role: 'admin', createdAt: '2026-03-10T00:00:00.000Z' });
    addPaidOrder('user-paid');

    expect(
      repo.previewAudience({
        audience: {
          roles: ['user', 'unknown'],
          createdAfter: '2026-01-01T00:00:00.000Z',
          paidOnly: true,
        },
      }),
    ).toEqual({
      audience: {
        roles: ['user'],
        createdAfter: '2026-01-01T00:00:00.000Z',
        paidOnly: true,
      },
      matchedUsers: 1,
    });
  });
});
