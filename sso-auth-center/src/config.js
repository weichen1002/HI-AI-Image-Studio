import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function resolveFromRoot(value) {
  if (!value) return value;
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function booleanValue(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || String(value).toLowerCase() === 'true';
}

export function loadConfig(overrides = {}) {
  loadDotEnv(path.join(rootDir, '.env'));
  const issuer = trimSlash(overrides.issuer || process.env.ISSUER || 'http://localhost:4100');
  const dataDir = overrides.dataDir || process.env.DATA_DIR || path.join(rootDir, 'data');
  const seedDemoClient =
    overrides.seedDemoClient ??
    (process.env.SEED_DEMO_CLIENT
      ? process.env.SEED_DEMO_CLIENT === 'true'
      : process.env.NODE_ENV !== 'production');

  return {
    rootDir,
    dataDir: resolveFromRoot(dataDir),
    dbFile: resolveFromRoot(overrides.dbFile || process.env.DB_FILE || path.join(dataDir, 'auth.db')),
    keyFile: resolveFromRoot(overrides.keyFile || process.env.KEY_FILE || path.join(dataDir, 'jwt-keypair.json')),
    issuer,
    port: Number(overrides.port || process.env.PORT || 4100),
    host: overrides.host || process.env.HOST || '127.0.0.1',
    sessionCookieName: overrides.sessionCookieName || 'sso_session',
    sessionTtlSeconds: Number(overrides.sessionTtlSeconds || process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 7),
    authCodeTtlSeconds: Number(overrides.authCodeTtlSeconds || process.env.AUTH_CODE_TTL_SECONDS || 300),
    accessTokenTtlSeconds: Number(overrides.accessTokenTtlSeconds || process.env.ACCESS_TOKEN_TTL_SECONDS || 900),
    idTokenTtlSeconds: Number(overrides.idTokenTtlSeconds || process.env.ID_TOKEN_TTL_SECONDS || 900),
    refreshTokenTtlSeconds: Number(overrides.refreshTokenTtlSeconds || process.env.REFRESH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30),
    emailVerificationTtlSeconds: Number(overrides.emailVerificationTtlSeconds || process.env.EMAIL_VERIFICATION_TTL_SECONDS || 60 * 60 * 24),
    passwordResetTtlSeconds: Number(overrides.passwordResetTtlSeconds || process.env.PASSWORD_RESET_TTL_SECONDS || 60 * 30),
    authRateLimitWindowSeconds: Number(overrides.authRateLimitWindowSeconds || process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS || 60),
    authRateLimitMax: Number(overrides.authRateLimitMax || process.env.AUTH_RATE_LIMIT_MAX || 20),
    authRateLimitMaxBuckets: Number(overrides.authRateLimitMaxBuckets || process.env.AUTH_RATE_LIMIT_MAX_BUCKETS || 5000),
    secureCookies: booleanValue(overrides.secureCookies ?? process.env.SECURE_COOKIES),
    trustProxy: booleanValue(overrides.trustProxy ?? process.env.TRUST_PROXY),
    seedDemoClient,
  };
}
