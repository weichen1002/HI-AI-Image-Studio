import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

const ROOT = path.join(__dirname, '../../..');
const PUBLIC_DIR = fs.existsSync(path.join(ROOT, 'dist'))
  ? path.join(ROOT, 'dist')
  : path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SQLITE_FILE = path.join(DATA_DIR, 'app.db');

function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.join(ROOT, '.env'));

function trimSlash(value: string | undefined): string {
  return String(value || '').replace(/\/+$/, '');
}

function resolvePath(value: string) {
  if (!value) return value;
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

export const config = {
  ROOT,
  PUBLIC_DIR,
  DATA_DIR,
  DB_FILE,
  SQLITE_FILE: resolvePath(process.env.SQLITE_FILE || SQLITE_FILE),
  PORT: Number(process.env.PORT || 3000),
  HOST: process.env.HOST || '0.0.0.0',
  BODY_LIMIT: process.env.BODY_LIMIT || '25mb',
  UPLOAD_MAX_FILE_SIZE: Number(
    process.env.UPLOAD_MAX_FILE_SIZE || 25 * 1024 * 1024,
  ),
  SESSION_SECRET:
    process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  REDEEM_CODE_SECRET:
    process.env.REDEEM_CODE_SECRET ||
    process.env.SESSION_SECRET ||
    crypto
      .createHash('sha256')
      .update(`${resolvePath(process.env.SQLITE_FILE || SQLITE_FILE)}:redeem-codes`)
      .digest('hex'),
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
  HIAPI_TEXT_MODEL: process.env.HIAPI_TEXT_MODEL || '',
  HIAPI_BASE_URL: trimSlash(
    process.env.HIAPI_BASE_URL || 'https://hiapis.cloud/v1',
  ),
  HIAPI_MODEL: process.env.HIAPI_MODEL || 'gpt-image-2',
  HIAPI_API_KEY: process.env.HIAPI_API_KEY || '',
  HIAPI_RESPONSE_FORMAT: process.env.HIAPI_RESPONSE_FORMAT || 'b64_json',
  HIAPI_SIZE_FORMAT: process.env.HIAPI_SIZE_FORMAT || 'pixel',
  HIAPI_TIMEOUT_MS: Number(process.env.HIAPI_TIMEOUT_MS || 60000),
};
