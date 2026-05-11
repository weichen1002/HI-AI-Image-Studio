import { Injectable, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

type JsonDb = {
  users?: any[];
  images?: any[];
};

function isoNow() {
  return new Date().toISOString();
}

function ensureDataDir() {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
}

function ensureSqliteDir() {
  fs.mkdirSync(path.dirname(config.SQLITE_FILE), { recursive: true });
}

function parseJsonFile(filePath: string): JsonDb | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

@Injectable()
export class SqliteService implements OnModuleInit {
  private db!: any;

  onModuleInit() {
    ensureDataDir();
    ensureSqliteDir();
    this.db = new Database(config.SQLITE_FILE);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.ensureSchema();
    this.autoImportJsonIfNeeded();
  }

  get connection() {
    return this.db;
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  private ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        plan TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        credit_balance INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        operation_type TEXT NOT NULL DEFAULT 'generate',
        prompt TEXT NOT NULL,
        aspect_ratio TEXT NOT NULL,
        content TEXT NOT NULL,
        image_urls TEXT NOT NULL,
        input_image_urls TEXT,
        source_image_id TEXT,
        continuation_chain_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_images_user_created ON images(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS dialogue_messages (
        id TEXT PRIMARY KEY,
        chain_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        image_id TEXT NOT NULL,
        parent_image_id TEXT,
        response_id TEXT,
        previous_response_id TEXT,
        input_image_urls_json TEXT,
        output_items_json TEXT,
        prompt TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_dialogue_chain_created ON dialogue_messages(chain_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_dialogue_user_created ON dialogue_messages(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS credit_ledgers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL,
        reason TEXT NOT NULL,
        ref_type TEXT,
        ref_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ledgers_user_created ON credit_ledgers(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS announcements (
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
      CREATE INDEX IF NOT EXISTS idx_announcements_status_created ON announcements(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_announcements_status_time ON announcements(status, start_at, end_at);

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT,
        target_user_id TEXT,
        category TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        detail_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_target_created ON audit_logs(target_user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS redeem_codes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        code_hash TEXT NOT NULL UNIQUE,
        code_mask TEXT NOT NULL,
        code_ciphertext TEXT,
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
      CREATE INDEX IF NOT EXISTS idx_redeem_codes_created ON redeem_codes(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_redeem_codes_type ON redeem_codes(type, created_at DESC);

      CREATE TABLE IF NOT EXISTS redeem_code_claims (
        id TEXT PRIMARY KEY,
        code_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        credits_amount INTEGER NOT NULL,
        claimed_at TEXT NOT NULL,
        ledger_entry_id TEXT,
        UNIQUE(code_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_redeem_claims_user_time ON redeem_code_claims(user_id, claimed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_redeem_claims_code_time ON redeem_code_claims(code_id, claimed_at DESC);

      CREATE TABLE IF NOT EXISTS announcement_reads (
        announcement_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        read_at TEXT NOT NULL,
        PRIMARY KEY (announcement_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id, read_at DESC);

      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_email_verification_user_created ON email_verification_tokens(user_id, created_at DESC);
    `);

    const hasV1 = this.db
      .prepare('SELECT 1 FROM schema_migrations WHERE version = 1')
      .get();
    if (!hasV1) {
      this.db
        .prepare(
          'INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)',
        )
        .run(1, isoNow());
    }

    const hasV2 = this.db
      .prepare('SELECT 1 FROM schema_migrations WHERE version = 2')
      .get();
    if (!hasV2) {
      this.db
        .prepare(
          'INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)',
        )
        .run(2, isoNow());
    }

    const hasV3 = this.db
      .prepare('SELECT 1 FROM schema_migrations WHERE version = 3')
      .get();
    if (!hasV3) {
      this.db
        .prepare(
          'INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)',
        )
        .run(3, isoNow());
    }

    const redeemCodeColumns = this.db
      .prepare(`PRAGMA table_info(redeem_codes)`)
      .all() as Array<{ name: string }>;
    if (!redeemCodeColumns.some((column) => column.name === 'code_ciphertext')) {
      this.db.prepare('ALTER TABLE redeem_codes ADD COLUMN code_ciphertext TEXT').run();
    }

    const hasV4 = this.db
      .prepare('SELECT 1 FROM schema_migrations WHERE version = 4')
      .get();
    if (!hasV4) {
      this.db
        .prepare(
          'INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)',
        )
        .run(4, isoNow());
    }

    const imageColumns = this.db
      .prepare(`PRAGMA table_info(images)`)
      .all() as Array<{ name: string }>;
    if (!imageColumns.some((column) => column.name === 'operation_type')) {
      this.db
        .prepare(
          `ALTER TABLE images ADD COLUMN operation_type TEXT NOT NULL DEFAULT 'generate'`,
        )
        .run();
      this.db
        .prepare(
          `UPDATE images SET operation_type = CASE WHEN mode = 'image' THEN 'image_to_image' ELSE 'generate' END WHERE operation_type IS NULL OR operation_type = ''`,
        )
        .run();
    }
    if (!imageColumns.some((column) => column.name === 'source_image_id')) {
      this.db.prepare('ALTER TABLE images ADD COLUMN source_image_id TEXT').run();
    }
    if (
      !imageColumns.some((column) => column.name === 'continuation_chain_id')
    ) {
      this.db
        .prepare('ALTER TABLE images ADD COLUMN continuation_chain_id TEXT')
        .run();
    }

    const hasV5 = this.db
      .prepare('SELECT 1 FROM schema_migrations WHERE version = 5')
      .get();
    if (!hasV5) {
      this.db
        .prepare(
          'INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)',
        )
        .run(5, isoNow());
    }

    const hasV6 = this.db
      .prepare('SELECT 1 FROM schema_migrations WHERE version = 6')
      .get();
    if (!hasV6) {
      this.db
        .prepare(
          'INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)',
        )
        .run(6, isoNow());
    }

    const dialogueColumns = this.db
      .prepare(`PRAGMA table_info(dialogue_messages)`)
      .all() as Array<{ name: string }>;
    if (!dialogueColumns.some((column) => column.name === 'response_id')) {
      this.db
        .prepare('ALTER TABLE dialogue_messages ADD COLUMN response_id TEXT')
        .run();
    }
    if (
      !dialogueColumns.some((column) => column.name === 'previous_response_id')
    ) {
      this.db
        .prepare(
          'ALTER TABLE dialogue_messages ADD COLUMN previous_response_id TEXT',
        )
        .run();
    }
    if (
      !dialogueColumns.some((column) => column.name === 'input_image_urls_json')
    ) {
      this.db
        .prepare(
          'ALTER TABLE dialogue_messages ADD COLUMN input_image_urls_json TEXT',
        )
        .run();
    }
    if (!dialogueColumns.some((column) => column.name === 'output_items_json')) {
      this.db
        .prepare(
          'ALTER TABLE dialogue_messages ADD COLUMN output_items_json TEXT',
        )
        .run();
    }

    const hasV7 = this.db
      .prepare('SELECT 1 FROM schema_migrations WHERE version = 7')
      .get();
    if (!hasV7) {
      this.db
        .prepare(
          'INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)',
        )
        .run(7, isoNow());
    }

    const userColumns = this.db
      .prepare(`PRAGMA table_info(users)`)
      .all() as Array<{ name: string }>;
    if (!userColumns.some((column) => column.name === 'last_used_at')) {
      this.db.prepare('ALTER TABLE users ADD COLUMN last_used_at TEXT').run();
    }
    if (!userColumns.some((column) => column.name === 'status')) {
      this.db
        .prepare(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`)
        .run();
    }
    this.db
      .prepare(`UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''`)
      .run();

    const hasV8 = this.db
      .prepare('SELECT 1 FROM schema_migrations WHERE version = 8')
      .get();
    if (!hasV8) {
      this.db
        .prepare(
          'INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)',
        )
        .run(8, isoNow());
    }

    const hasV9 = this.db
      .prepare('SELECT 1 FROM schema_migrations WHERE version = 9')
      .get();
    if (!hasV9) {
      this.db
        .prepare(
          'INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)',
        )
        .run(9, isoNow());
    }

    const hasV10 = this.db
      .prepare('SELECT 1 FROM schema_migrations WHERE version = 10')
      .get();
    if (!hasV10) {
      this.db
        .prepare(
          'INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)',
        )
        .run(10, isoNow());
    }
  }

  private isEmptyDb() {
    const usersCount = this.db.prepare('SELECT COUNT(1) AS c FROM users').get();
    const imagesCount = this.db
      .prepare('SELECT COUNT(1) AS c FROM images')
      .get();
    return (
      Number(usersCount?.c || 0) === 0 && Number(imagesCount?.c || 0) === 0
    );
  }

  private autoImportJsonIfNeeded() {
    if (!this.isEmptyDb()) return;

    const json = parseJsonFile(config.DB_FILE);
    if (!json) return;

    const users = Array.isArray(json.users) ? json.users : [];
    const images = Array.isArray(json.images) ? json.images : [];
    if (users.length === 0 && images.length === 0) return;

    this.transaction(() => {
      const insertUser = this.db.prepare(
        `INSERT INTO users(id, username, password_hash, created_at, last_used_at, plan, role, status, credit_balance)
         VALUES(@id, @username, @password_hash, @created_at, @last_used_at, @plan, @role, @status, @credit_balance)`,
      );
      for (const u of users) {
        insertUser.run({
          id: String(u.id),
          username: String(u.username),
          password_hash: String(u.passwordHash || u.password_hash || ''),
          created_at: String(u.createdAt || u.created_at || isoNow()),
          last_used_at: String(u.lastUsedAt || u.last_used_at || ''),
          plan: String(u.plan || 'free'),
          role: String(u.role || 'user'),
          status: String(u.status || 'active'),
          credit_balance: Number.isFinite(Number(u.creditBalance))
            ? Number(u.creditBalance)
            : 0,
        });
      }

      const insertImage = this.db.prepare(
        `INSERT INTO images(id, user_id, mode, operation_type, prompt, aspect_ratio, content, image_urls, input_image_urls, source_image_id, continuation_chain_id, created_at)
         VALUES(@id, @user_id, @mode, @operation_type, @prompt, @aspect_ratio, @content, @image_urls, @input_image_urls, @source_image_id, @continuation_chain_id, @created_at)`,
      );
      for (const im of images) {
        const mode = String(im.mode || 'text');
        const imageUrls = Array.isArray(im.imageUrls) ? im.imageUrls : [];
        const inputImageUrls = Array.isArray(im.inputImageUrls)
          ? im.inputImageUrls
          : [];
        insertImage.run({
          id: String(im.id),
          user_id: String(im.userId || im.user_id),
          mode,
          operation_type: mode === 'image' ? 'image_to_image' : 'generate',
          prompt: String(im.prompt || ''),
          aspect_ratio: String(im.aspectRatio || im.aspect_ratio || '1:1'),
          content: String(im.content || ''),
          image_urls: JSON.stringify(imageUrls),
          input_image_urls: inputImageUrls.length
            ? JSON.stringify(inputImageUrls)
            : null,
          source_image_id: im.sourceImageId ? String(im.sourceImageId) : null,
          continuation_chain_id: im.continuationChainId
            ? String(im.continuationChainId)
            : null,
          created_at: String(im.createdAt || im.created_at || isoNow()),
        });
      }
    });

    try {
      const backup = path.join(config.DATA_DIR, 'db.json.bak');
      fs.renameSync(config.DB_FILE, backup);
    } catch {
      void 0;
    }
  }
}
