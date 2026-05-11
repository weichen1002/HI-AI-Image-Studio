import * as crypto from 'crypto';
import { config } from '../config';

export function signSession(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySession(token: string): string | null {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = crypto
    .createHmac('sha256', config.SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
    return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).userId;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 120000, 32, 'sha256')
    .toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const actual = crypto
    .pbkdf2Sync(password, salt, 120000, 32, 'sha256')
    .toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(hash));
}

export function publicUser(user: any) {
  return user
    ? {
        id: user.id,
        username: user.username,
        plan: user.plan,
        role: user.role,
        status: user.status || 'active',
        creditBalance: user.creditBalance,
      }
    : null;
}

export function cleanUsername(value: string | undefined | null): string {
  return String(value || '')
    .trim()
    .slice(0, 254);
}

export function normalizeAspectRatio(value: string): string {
  const allowed = new Set(['auto', '1:1', '16:9', '9:16', '4:3', '3:4']);
  return allowed.has(value) ? value : '1:1';
}
