import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('RedeemCodesRepo', () => {
  let sqliteFile = '';
  let sqlite: any;
  let repo: any;

  beforeEach(() => {
    sqliteFile = path.join(
      os.tmpdir(),
      `hi-image-redeem-codes-repo-${Date.now()}-${Math.random()}.db`,
    );
    process.env.SQLITE_FILE = sqliteFile;
    jest.resetModules();
    const { SqliteService } = require('../sqlite.service');
    const { CreditsRepo } = require('../../credits/credits.repo');
    const { RedeemCodesRepo } = require('./redeem-codes.repo');
    sqlite = new SqliteService();
    sqlite.onModuleInit();
    repo = new RedeemCodesRepo(sqlite, new CreditsRepo(sqlite));
  });

  afterEach(() => {
    sqlite.connection.close();
    for (const filePath of [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`]) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  function insertCode(params: {
    id: string;
    title: string;
    type?: 'single' | 'campaign';
    totalLimit?: number;
    redeemedCount?: number;
    expiresAt?: string | null;
    enabled?: boolean;
    createdAt: string;
  }) {
    sqlite.connection
      .prepare(
        `INSERT INTO redeem_codes(
          id, title, code_hash, code_mask, code_ciphertext, type, credits_amount,
          total_limit, redeemed_count, expires_at, enabled,
          created_by, updated_by, created_at, updated_at
        ) VALUES(
          @id, @title, @code_hash, @code_mask, @code_ciphertext, @type, @credits_amount,
          @total_limit, @redeemed_count, @expires_at, @enabled,
          @created_by, @updated_by, @created_at, @updated_at
        )`,
      )
      .run({
        id: params.id,
        title: params.title,
        code_hash: `hash-${params.id}`,
        code_mask: `MASK-${params.id}`,
        code_ciphertext: null,
        type: params.type || 'single',
        credits_amount: 10,
        total_limit: params.totalLimit ?? 1,
        redeemed_count: params.redeemedCount ?? 0,
        expires_at: params.expiresAt ?? null,
        enabled: params.enabled === false ? 0 : 1,
        created_by: 'admin-1',
        updated_by: 'admin-1',
        created_at: params.createdAt,
        updated_at: params.createdAt,
      });
  }

  it('counts and paginates admin codes with SQL limit and offset', () => {
    insertCode({
      id: 'oldest',
      title: 'Oldest',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    insertCode({
      id: 'middle',
      title: 'Middle',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    insertCode({
      id: 'newest',
      title: 'Newest',
      createdAt: '2026-01-03T00:00:00.000Z',
    });

    const result = repo.listAdminPaged({ limit: 1, offset: 1 });

    expect(result.total).toBe(3);
    expect(result.codes.map((code) => code.id)).toEqual(['middle']);
  });

  it('filters admin codes by status with matching totals', () => {
    insertCode({
      id: 'active',
      title: 'Active code',
      totalLimit: 2,
      redeemedCount: 1,
      createdAt: '2026-01-04T00:00:00.000Z',
    });
    insertCode({
      id: 'disabled',
      title: 'Disabled code',
      enabled: false,
      expiresAt: '2020-01-01T00:00:00.000Z',
      totalLimit: 1,
      redeemedCount: 1,
      createdAt: '2026-01-03T00:00:00.000Z',
    });
    insertCode({
      id: 'expired',
      title: 'Expired code',
      expiresAt: '2020-01-01T00:00:00.000Z',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    insertCode({
      id: 'exhausted',
      title: 'Exhausted code',
      totalLimit: 1,
      redeemedCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const active = repo.listAdminPaged({ status: 'active', limit: 10, offset: 0 });
    const disabled = repo.listAdminPaged({
      status: 'disabled',
      limit: 10,
      offset: 0,
    });
    const expired = repo.listAdminPaged({ status: 'expired', limit: 10, offset: 0 });
    const exhausted = repo.listAdminPaged({
      status: 'exhausted',
      limit: 10,
      offset: 0,
    });

    expect(active.total).toBe(1);
    expect(active.codes).toEqual([
      expect.objectContaining({ id: 'active', status: 'active' }),
    ]);
    expect(disabled.total).toBe(1);
    expect(disabled.codes).toEqual([
      expect.objectContaining({ id: 'disabled', status: 'disabled' }),
    ]);
    expect(expired.total).toBe(1);
    expect(expired.codes).toEqual([
      expect.objectContaining({ id: 'expired', status: 'expired' }),
    ]);
    expect(exhausted.total).toBe(1);
    expect(exhausted.codes).toEqual([
      expect.objectContaining({ id: 'exhausted', status: 'exhausted' }),
    ]);
  });

  it('returns no admin codes for unknown status values', () => {
    insertCode({
      id: 'active',
      title: 'Active code',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const result = repo.listAdminPaged({
      status: 'archived',
      limit: 10,
      offset: 0,
    });

    expect(result.total).toBe(0);
    expect(result.codes).toEqual([]);
  });
});
