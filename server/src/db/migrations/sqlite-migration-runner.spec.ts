import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runSqliteMigrations } from './sqlite-migration-runner';

describe('runSqliteMigrations', () => {
  let sqliteFile = '';
  let db: any;

  beforeEach(() => {
    sqliteFile = path.join(
      os.tmpdir(),
      `hi-image-sqlite-migrations-${Date.now()}-${Math.random()}.db`,
    );
    db = new Database(sqliteFile);
  });

  afterEach(() => {
    db.close();
    for (const filePath of [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`]) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  function tableNames() {
    return new Set(
      db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
        )
        .all()
        .map((row: { name: string }) => row.name),
    );
  }

  function columnNames(tableName: string) {
    return new Set(
      (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map(
        (column) => column.name,
      ),
    );
  }

  it('initializes an empty database with current tables and indexes', () => {
    runSqliteMigrations(db);

    expect(tableNames()).toEqual(
      new Set([
        'schema_migrations',
        'users',
        'images',
        'image_jobs',
        'dialogue_messages',
        'credit_ledgers',
        'announcements',
        'system_settings',
        'audit_logs',
        'redeem_codes',
        'redeem_code_claims',
        'announcement_reads',
        'template_favorites',
        'user_prompt_templates',
        'email_verification_tokens',
        'billing_packages',
        'billing_orders',
        'style_boards',
        'style_board_refs',
        'image_feedbacks',
      ]),
    );
    expect([...columnNames('images')]).toEqual(
      expect.arrayContaining([
        'operation_type',
        'generation_params',
        'preview_image_urls',
        'folder',
        'tags',
        'favorite_at',
      ]),
    );
    expect([...columnNames('image_jobs')]).toEqual(
      expect.arrayContaining(['payload_json', 'attempts']),
    );
    expect(
      db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_images_user_favorite'`,
        )
        .get(),
    ).toEqual(expect.objectContaining({ name: 'idx_images_user_favorite' }));
    expect([...columnNames('billing_orders')]).toEqual(
      expect.arrayContaining([
        'status',
        'payment_channel',
        'payment_ref',
        'ledger_entry_id',
        'refund_ledger_entry_id',
        'refund_reason',
        'paid_at',
        'refunded_at',
      ]),
    );
    expect(
      db.prepare('SELECT COUNT(1) AS c FROM billing_packages WHERE active = 1').get(),
    ).toEqual({ c: 3 });
    expect([...columnNames('image_feedbacks')]).toEqual(
      expect.arrayContaining([
        'image_id',
        'user_id',
        'rating',
        'issue_type',
        'note',
        'created_at',
        'updated_at',
      ]),
    );
    expect([...columnNames('announcements')]).toEqual(
      expect.arrayContaining(['audience_json']),
    );
  });

  it('backfills columns expected by current repositories on legacy tables', () => {
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        plan TEXT NOT NULL,
        role TEXT NOT NULL,
        credit_balance INTEGER NOT NULL
      );
      INSERT INTO users(id, username, password_hash, created_at, plan, role, credit_balance)
      VALUES('user-1', 'alice', 'hash', '2026-01-01T00:00:00.000Z', 'free', 'user', 0);

      CREATE TABLE images (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        prompt TEXT NOT NULL,
        aspect_ratio TEXT NOT NULL,
        content TEXT NOT NULL,
        image_urls TEXT NOT NULL,
        input_image_urls TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO images(id, user_id, mode, prompt, aspect_ratio, content, image_urls, created_at)
      VALUES('image-1', 'user-1', 'image', 'legacy', '1:1', '', '[]', '2026-01-01T00:00:00.000Z');

      CREATE TABLE redeem_codes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        code_hash TEXT NOT NULL UNIQUE,
        code_mask TEXT NOT NULL,
        type TEXT NOT NULL,
        credits_amount INTEGER NOT NULL,
        total_limit INTEGER NOT NULL,
        redeemed_count INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE dialogue_messages (
        id TEXT PRIMARY KEY,
        chain_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        image_id TEXT NOT NULL,
        parent_image_id TEXT,
        prompt TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content_md TEXT NOT NULL,
        status TEXT NOT NULL,
        notify_mode TEXT NOT NULL,
        repeat_mode TEXT NOT NULL,
        start_at TEXT,
        end_at TEXT,
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    runSqliteMigrations(db);

    expect([...columnNames('users')]).toEqual(
      expect.arrayContaining(['last_used_at', 'status']),
    );
    expect(db.prepare('SELECT status FROM users WHERE id = ?').get('user-1')).toEqual({
      status: 'active',
    });
    expect([...columnNames('images')]).toEqual(
      expect.arrayContaining([
        'operation_type',
        'source_image_id',
        'continuation_chain_id',
        'folder',
        'tags',
        'generation_params',
        'favorite_at',
        'preview_image_urls',
      ]),
    );
    expect(db.prepare('SELECT folder, tags, generation_params FROM images').get()).toEqual({
      folder: '',
      tags: '[]',
      generation_params: '{}',
    });
    expect([...columnNames('redeem_codes')]).toEqual(
      expect.arrayContaining(['code_ciphertext']),
    );
    expect([...columnNames('dialogue_messages')]).toEqual(
      expect.arrayContaining([
        'response_id',
        'previous_response_id',
        'input_image_urls_json',
        'output_items_json',
      ]),
    );
    expect([...columnNames('announcements')]).toEqual(
      expect.arrayContaining(['audience_json']),
    );
  });

  it('records all applied migration versions idempotently', () => {
    runSqliteMigrations(db);
    runSqliteMigrations(db);

    const versions = db
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all()
      .map((row: { version: number }) => row.version);

    expect(versions).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    ]);
  });
});
