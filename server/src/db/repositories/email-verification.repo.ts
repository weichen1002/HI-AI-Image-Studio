import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../sqlite.service';

export type EmailVerificationToken = {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string;
  createdAt: string;
};

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function toToken(row: any): EmailVerificationToken | null {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    email: String(row.email || ''),
    tokenHash: String(row.token_hash || ''),
    expiresAt: String(row.expires_at || ''),
    usedAt: String(row.used_at || ''),
    createdAt: String(row.created_at || ''),
  };
}

@Injectable()
export class EmailVerificationRepo {
  constructor(private readonly sqlite: SqliteService) {}

  create(params: { userId: string; email: string; ttlMinutes?: number }) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + Math.max(5, Math.floor(params.ttlMinutes || 30)) * 60 * 1000,
    ).toISOString();
    const entity = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      email: params.email,
      token_hash: sha256(rawToken),
      expires_at: expiresAt,
      used_at: null,
      created_at: now.toISOString(),
    };

    this.sqlite.connection
      .prepare('DELETE FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL')
      .run(params.userId);

    this.sqlite.connection
      .prepare(
        `INSERT INTO email_verification_tokens(
          id, user_id, email, token_hash, expires_at, used_at, created_at
        ) VALUES(
          @id, @user_id, @email, @token_hash, @expires_at, @used_at, @created_at
        )`,
      )
      .run(entity);

    return {
      token: rawToken,
      expiresAt,
    };
  }

  findValidByToken(token: string) {
    const row = this.sqlite.connection
      .prepare(
        `SELECT * FROM email_verification_tokens
         WHERE token_hash = ? AND used_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(sha256(String(token || '')));
    const entity = toToken(row);
    if (!entity) return null;
    if (new Date(entity.expiresAt).getTime() <= Date.now()) return null;
    return entity;
  }

  markUsed(id: string) {
    this.sqlite.connection
      .prepare('UPDATE email_verification_tokens SET used_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
  }
}
