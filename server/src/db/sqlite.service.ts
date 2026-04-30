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
        plan TEXT NOT NULL,
        role TEXT NOT NULL,
        credit_balance INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

      CREATE TABLE IF NOT EXISTS images (
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
      CREATE INDEX IF NOT EXISTS idx_images_user_created ON images(user_id, created_at DESC);

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

      CREATE TABLE IF NOT EXISTS announcement_reads (
        announcement_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        read_at TEXT NOT NULL,
        PRIMARY KEY (announcement_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id, read_at DESC);
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
        `INSERT INTO users(id, username, password_hash, created_at, plan, role, credit_balance)
         VALUES(@id, @username, @password_hash, @created_at, @plan, @role, @credit_balance)`,
      );
      for (const u of users) {
        insertUser.run({
          id: String(u.id),
          username: String(u.username),
          password_hash: String(u.passwordHash || u.password_hash || ''),
          created_at: String(u.createdAt || u.created_at || isoNow()),
          plan: String(u.plan || 'free'),
          role: String(u.role || 'user'),
          credit_balance: Number.isFinite(Number(u.creditBalance))
            ? Number(u.creditBalance)
            : 0,
        });
      }

      const insertImage = this.db.prepare(
        `INSERT INTO images(id, user_id, mode, prompt, aspect_ratio, content, image_urls, input_image_urls, created_at)
         VALUES(@id, @user_id, @mode, @prompt, @aspect_ratio, @content, @image_urls, @input_image_urls, @created_at)`,
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
          prompt: String(im.prompt || ''),
          aspect_ratio: String(im.aspectRatio || im.aspect_ratio || '1:1'),
          content: String(im.content || ''),
          image_urls: JSON.stringify(imageUrls),
          input_image_urls: inputImageUrls.length
            ? JSON.stringify(inputImageUrls)
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
