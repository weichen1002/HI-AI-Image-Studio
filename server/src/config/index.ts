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
  BILLING_WEBHOOK_SECRET: process.env.BILLING_WEBHOOK_SECRET || '',
  HIAPI_TEXT_MODEL: process.env.HIAPI_TEXT_MODEL || '',
  HIAPI_BASE_URL: trimSlash(
    process.env.HIAPI_BASE_URL || 'https://hiapis.cloud/v1',
  ),
  HIAPI_MODEL: process.env.HIAPI_MODEL || 'gpt-image-2',
  HIAPI_API_KEY: process.env.HIAPI_API_KEY || '',
  HIAPI_RESPONSE_FORMAT: process.env.HIAPI_RESPONSE_FORMAT || 'b64_json',
  HIAPI_SIZE_FORMAT: process.env.HIAPI_SIZE_FORMAT || 'pixel',
  HIAPI_TIMEOUT_MS: Number(process.env.HIAPI_TIMEOUT_MS || 60000),
  IMAGE_JOB_CONCURRENCY: Math.max(1, Number(process.env.IMAGE_JOB_CONCURRENCY || 2)),
};

type RuntimeConfig = typeof config;

export function validateStartupConfig(
  runtimeConfig: RuntimeConfig = config,
  env: string = process.env.NODE_ENV || 'development',
) {
  const issues: string[] = [];
  const warnings: string[] = [];
  const isProduction = env === 'production';

  if (!Number.isFinite(runtimeConfig.PORT) || runtimeConfig.PORT <= 0) {
    issues.push('PORT must be a positive number');
  }
  if (!runtimeConfig.SQLITE_FILE) {
    issues.push('SQLITE_FILE is required');
  }
  if (!runtimeConfig.DATA_DIR) {
    issues.push('DATA_DIR is required');
  }
  if (!runtimeConfig.HIAPI_BASE_URL) {
    issues.push('HIAPI_BASE_URL is required');
  }
  if (!runtimeConfig.HIAPI_MODEL) {
    issues.push('HIAPI_MODEL is required');
  }

  const requiredProductionSecrets = [
    ['SESSION_SECRET', runtimeConfig.SESSION_SECRET],
    ['ADMIN_TOKEN', runtimeConfig.ADMIN_TOKEN],
    ['BILLING_WEBHOOK_SECRET', runtimeConfig.BILLING_WEBHOOK_SECRET],
    ['HIAPI_API_KEY', runtimeConfig.HIAPI_API_KEY],
  ] as const;

  for (const [key, value] of requiredProductionSecrets) {
    if (!String(value || '').trim()) {
      if (isProduction) issues.push(`${key} is required in production`);
      else warnings.push(`${key} is not configured`);
    }
  }

  if (
    isProduction &&
    runtimeConfig.SESSION_SECRET &&
    runtimeConfig.SESSION_SECRET.length < 32
  ) {
    issues.push('SESSION_SECRET must be at least 32 characters in production');
  }

  return {
    ok: issues.length === 0,
    env,
    issues,
    warnings,
  };
}

export function assertStartupConfig(
  runtimeConfig: RuntimeConfig = config,
  env: string = process.env.NODE_ENV || 'development',
) {
  const result = validateStartupConfig(runtimeConfig, env);
  if (!result.ok) {
    throw new Error(`Invalid startup configuration: ${result.issues.join('; ')}`);
  }
  return result;
}
