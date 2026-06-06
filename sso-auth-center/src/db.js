import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { hashSecret, randomToken } from './crypto-utils.js';

function nowIso() {
  return new Date().toISOString();
}

function secondsFromNow(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function openDatabase(config) {
  fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
  const db = new Database(config.dbFile);
  db.pragma('journal_mode = WAL');
  migrate(db);
  if (config.seedDemoClient) seedDevClient(db, config);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      secret_hash TEXT,
      redirect_uris_json TEXT NOT NULL,
      allowed_scopes TEXT NOT NULL,
      trusted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS auth_codes (
      code_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      scope TEXT NOT NULL,
      nonce TEXT,
      code_challenge TEXT NOT NULL,
      code_challenge_method TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      replaced_by_hash TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      client_id TEXT,
      category TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      detail_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);
  `);
}

function seedDevClient(db, config) {
  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get('demo-web');
  if (existing) return;

  db.prepare(
    `INSERT INTO clients(
      id, name, type, secret_hash, redirect_uris_json, allowed_scopes, trusted, created_at
    ) VALUES(@id, @name, @type, @secret_hash, @redirect_uris_json, @allowed_scopes, @trusted, @created_at)`,
  ).run({
    id: 'demo-web',
    name: 'Demo Web Client',
    type: 'confidential',
    secret_hash: hashSecret('demo-secret'),
    redirect_uris_json: JSON.stringify([`${config.issuer}/demo/callback`]),
    allowed_scopes: 'openid profile email offline_access',
    trusted: 1,
    created_at: nowIso(),
  });
}

export class AuthRepository {
  constructor(db, config) {
    this.db = db;
    this.config = config;
  }

  createUser({ email, passwordHash, name = '' }) {
    const id = `usr_${nanoid(18)}`;
    const timestamp = nowIso();
    this.db.prepare(
      `INSERT INTO users(id, email, password_hash, name, status, email_verified, created_at, updated_at)
       VALUES(@id, @email, @password_hash, @name, 'active', 0, @created_at, @updated_at)`,
    ).run({
      id,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name,
      created_at: timestamp,
      updated_at: timestamp,
    });
    return this.findUserById(id);
  }

  findUserByEmail(email) {
    return this.db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email);
  }

  findUserById(id) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  markLogin(userId) {
    this.db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(
      nowIso(),
      nowIso(),
      userId,
    );
  }

  markEmailVerified(userId) {
    this.db.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?').run(
      nowIso(),
      userId,
    );
  }

  updatePasswordHash(userId, passwordHash) {
    this.db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      passwordHash,
      nowIso(),
      userId,
    );
  }

  createSession(userId) {
    const session = {
      id: `ses_${nanoid(32)}`,
      user_id: userId,
      expires_at: secondsFromNow(this.config.sessionTtlSeconds),
      created_at: nowIso(),
      last_used_at: nowIso(),
    };
    this.db.prepare(
      `INSERT INTO sessions(id, user_id, expires_at, created_at, last_used_at)
       VALUES(@id, @user_id, @expires_at, @created_at, @last_used_at)`,
    ).run(session);
    return session;
  }

  findSession(id) {
    const session = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    if (!session) return null;
    if (new Date(session.expires_at).getTime() <= Date.now()) return null;
    this.db.prepare('UPDATE sessions SET last_used_at = ? WHERE id = ?').run(nowIso(), id);
    return session;
  }

  deleteSession(id) {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  deleteUserSessions(userId) {
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }

  findClient(clientId) {
    const client = this.db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
    if (!client) return null;
    return {
      ...client,
      redirectUris: JSON.parse(client.redirect_uris_json),
      allowedScopes: String(client.allowed_scopes || '').split(/\s+/).filter(Boolean),
      trusted: Boolean(client.trusted),
    };
  }

  createClient({
    id,
    name,
    type = 'public',
    secret = '',
    redirectUris,
    allowedScopes = 'openid profile email',
    trusted = false,
  }) {
    const clientType = type === 'confidential' ? 'confidential' : 'public';
    const uris = Array.isArray(redirectUris) ? redirectUris : [];
    if (!id || !name || uris.length === 0) {
      throw new Error('client id, name, and at least one redirect URI are required');
    }
    if (clientType === 'confidential' && !secret) {
      throw new Error('confidential clients require a secret');
    }

    this.db.prepare(
      `INSERT INTO clients(
        id, name, type, secret_hash, redirect_uris_json, allowed_scopes, trusted, created_at
      ) VALUES(@id, @name, @type, @secret_hash, @redirect_uris_json, @allowed_scopes, @trusted, @created_at)`,
    ).run({
      id,
      name,
      type: clientType,
      secret_hash: clientType === 'confidential' ? hashSecret(secret) : null,
      redirect_uris_json: JSON.stringify(uris),
      allowed_scopes: allowedScopes,
      trusted: trusted ? 1 : 0,
      created_at: nowIso(),
    });

    return this.findClient(id);
  }

  createAuthCode(params) {
    const code = `cod_${nanoid(42)}`;
    this.db.prepare(
      `INSERT INTO auth_codes(
        code_hash, client_id, user_id, redirect_uri, scope, nonce,
        code_challenge, code_challenge_method, expires_at, created_at
      ) VALUES(
        @code_hash, @client_id, @user_id, @redirect_uri, @scope, @nonce,
        @code_challenge, @code_challenge_method, @expires_at, @created_at
      )`,
    ).run({
      code_hash: hashSecret(code),
      client_id: params.clientId,
      user_id: params.userId,
      redirect_uri: params.redirectUri,
      scope: params.scope,
      nonce: params.nonce || null,
      code_challenge: params.codeChallenge,
      code_challenge_method: params.codeChallengeMethod,
      expires_at: secondsFromNow(this.config.authCodeTtlSeconds),
      created_at: nowIso(),
    });
    return code;
  }

  findAuthCode(code) {
    const codeHash = hashSecret(code);
    const record = this.db.prepare('SELECT * FROM auth_codes WHERE code_hash = ?').get(codeHash);
    if (!record) return null;
    if (record.consumed_at) return null;
    if (new Date(record.expires_at).getTime() <= Date.now()) return null;
    return { ...record, codeHash };
  }

  consumeAuthCodeHash(codeHash) {
    const result = this.db.prepare(
      'UPDATE auth_codes SET consumed_at = ? WHERE code_hash = ? AND consumed_at IS NULL',
    ).run(
      nowIso(),
      codeHash,
    );
    return result.changes === 1;
  }

  createRefreshToken({ clientId, userId, scope }) {
    const token = `rfr_${nanoid(54)}`;
    this.db.prepare(
      `INSERT INTO refresh_tokens(
        token_hash, client_id, user_id, scope, expires_at, created_at
      ) VALUES(@token_hash, @client_id, @user_id, @scope, @expires_at, @created_at)`,
    ).run({
      token_hash: hashSecret(token),
      client_id: clientId,
      user_id: userId,
      scope,
      expires_at: secondsFromNow(this.config.refreshTokenTtlSeconds),
      created_at: nowIso(),
    });
    return token;
  }

  createEmailVerificationToken({ userId, email }) {
    const token = `evf_${randomToken(42)}`;
    this.db.prepare(
      `INSERT INTO email_verification_tokens(
        token_hash, user_id, email, expires_at, created_at
      ) VALUES(@token_hash, @user_id, @email, @expires_at, @created_at)`,
    ).run({
      token_hash: hashSecret(token),
      user_id: userId,
      email,
      expires_at: secondsFromNow(this.config.emailVerificationTtlSeconds),
      created_at: nowIso(),
    });
    return token;
  }

  consumeEmailVerificationToken(token) {
    const tokenHash = hashSecret(token);
    const consume = this.db.transaction(() => {
      const record = this.db
        .prepare('SELECT * FROM email_verification_tokens WHERE token_hash = ?')
        .get(tokenHash);
      if (!record || record.consumed_at || new Date(record.expires_at).getTime() <= Date.now()) {
        return null;
      }
      const result = this.db.prepare(
        'UPDATE email_verification_tokens SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL',
      ).run(nowIso(), tokenHash);
      if (result.changes !== 1) return null;
      this.markEmailVerified(record.user_id);
      return record;
    });
    return consume();
  }

  createPasswordResetToken({ userId, email }) {
    const token = `rst_${randomToken(42)}`;
    this.db.prepare(
      `INSERT INTO password_reset_tokens(
        token_hash, user_id, email, expires_at, created_at
      ) VALUES(@token_hash, @user_id, @email, @expires_at, @created_at)`,
    ).run({
      token_hash: hashSecret(token),
      user_id: userId,
      email,
      expires_at: secondsFromNow(this.config.passwordResetTtlSeconds),
      created_at: nowIso(),
    });
    return token;
  }

  findPasswordResetToken(token) {
    const tokenHash = hashSecret(token);
    const record = this.db
      .prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?')
      .get(tokenHash);
    if (!record) return null;
    if (record.consumed_at) return null;
    if (new Date(record.expires_at).getTime() <= Date.now()) return null;
    return { ...record, tokenHash };
  }

  consumePasswordResetToken(tokenHash, passwordHash) {
    const consume = this.db.transaction(() => {
      const record = this.db
        .prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?')
        .get(tokenHash);
      if (!record || record.consumed_at || new Date(record.expires_at).getTime() <= Date.now()) {
        return null;
      }
      const result = this.db.prepare(
        'UPDATE password_reset_tokens SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL',
      ).run(nowIso(), tokenHash);
      if (result.changes !== 1) return null;
      this.updatePasswordHash(record.user_id, passwordHash);
      this.deleteUserSessions(record.user_id);
      this.revokeUserRefreshTokens(record.user_id);
      return record;
    });
    return consume();
  }

  revokeUserRefreshTokens(userId) {
    this.db.prepare(
      'UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
    ).run(nowIso(), userId);
  }

  rotateRefreshToken(token, clientId) {
    const tokenHash = hashSecret(token);
    const rotate = this.db.transaction(() => {
      const record = this.db
        .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? AND client_id = ?')
        .get(tokenHash, clientId);
      if (!record || record.revoked_at || new Date(record.expires_at).getTime() <= Date.now()) {
        return null;
      }

      const replacement = `rfr_${randomToken(54)}`;
      const replacementHash = hashSecret(replacement);
      const result = this.db.prepare(
        `UPDATE refresh_tokens
         SET revoked_at = ?, replaced_by_hash = ?
         WHERE token_hash = ? AND client_id = ? AND revoked_at IS NULL`,
      ).run(nowIso(), replacementHash, tokenHash, clientId);
      if (result.changes !== 1) return null;

      this.db.prepare(
        `INSERT INTO refresh_tokens(
          token_hash, client_id, user_id, scope, expires_at, created_at
        ) VALUES(@token_hash, @client_id, @user_id, @scope, @expires_at, @created_at)`,
      ).run({
        token_hash: replacementHash,
        client_id: record.client_id,
        user_id: record.user_id,
        scope: record.scope,
        expires_at: secondsFromNow(this.config.refreshTokenTtlSeconds),
        created_at: nowIso(),
      });

      return { record, replacement };
    });
    return rotate();
  }

  writeAudit(event) {
    this.db.prepare(
      `INSERT INTO audit_events(
        id, actor_user_id, client_id, category, action, status, ip, user_agent, detail_json, created_at
      ) VALUES(
        @id, @actor_user_id, @client_id, @category, @action, @status, @ip, @user_agent, @detail_json, @created_at
      )`,
    ).run({
      id: `aud_${nanoid(18)}`,
      actor_user_id: event.actorUserId || null,
      client_id: event.clientId || null,
      category: event.category,
      action: event.action,
      status: event.status,
      ip: event.ip || '',
      user_agent: event.userAgent || '',
      detail_json: JSON.stringify(event.detail || {}),
      created_at: nowIso(),
    });
  }
}
