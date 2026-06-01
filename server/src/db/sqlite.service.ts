import { Injectable, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { runSqliteMigrations } from './migrations/sqlite-migration-runner';

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
    runSqliteMigrations(this.db);
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
        `INSERT INTO images(id, user_id, mode, operation_type, prompt, aspect_ratio, generation_params, content, image_urls, input_image_urls, preview_image_urls, folder, tags, favorite_at, source_image_id, continuation_chain_id, created_at)
         VALUES(@id, @user_id, @mode, @operation_type, @prompt, @aspect_ratio, @generation_params, @content, @image_urls, @input_image_urls, @preview_image_urls, @folder, @tags, @favorite_at, @source_image_id, @continuation_chain_id, @created_at)`,
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
          generation_params: JSON.stringify(
            im.generationParams || im.generation_params || {},
          ),
          content: String(im.content || ''),
          image_urls: JSON.stringify(imageUrls),
          input_image_urls: inputImageUrls.length
            ? JSON.stringify(inputImageUrls)
            : null,
          preview_image_urls: Array.isArray(im.previewImageUrls || im.preview_image_urls)
            ? JSON.stringify(im.previewImageUrls || im.preview_image_urls)
            : null,
          folder: String(im.folder || ''),
          tags: JSON.stringify(Array.isArray(im.tags) ? im.tags : []),
          favorite_at: im.favoriteAt || im.favorite_at ? String(im.favoriteAt || im.favorite_at) : null,
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
