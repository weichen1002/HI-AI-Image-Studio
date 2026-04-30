import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../sqlite.service';

export type UserPlan = 'free' | 'pro';
export type UserRole = 'user' | 'admin' | 'superadmin';

export type UserRow = {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  plan: UserPlan;
  role: UserRole;
  creditBalance: number;
};

function toUser(row: any): UserRow | null {
  if (!row) return null;
  return {
    id: String(row.id),
    username: String(row.username),
    passwordHash: String(row.password_hash),
    createdAt: String(row.created_at),
    plan: (row.plan || 'free') as UserPlan,
    role: (row.role || 'user') as UserRole,
    creditBalance: Number(row.credit_balance || 0),
  };
}

@Injectable()
export class UsersRepo {
  constructor(private readonly sqlite: SqliteService) {}

  findById(id: string) {
    const row = this.sqlite.connection
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id);
    return toUser(row);
  }

  findByUsername(username: string) {
    const row = this.sqlite.connection
      .prepare('SELECT * FROM users WHERE lower(username) = lower(?)')
      .get(username);
    return toUser(row);
  }

  search(params: { q?: string; limit: number }) {
    const q = String(params.q || '').trim();
    const limit = Math.max(1, Math.min(100, Math.floor(params.limit)));
    if (!q) {
      const rows = this.sqlite.connection
        .prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ?')
        .all(limit);
      return rows.map(toUser).filter(Boolean) as UserRow[];
    }
    const like = `%${q.toLowerCase()}%`;
    const rows = this.sqlite.connection
      .prepare(
        'SELECT * FROM users WHERE lower(username) LIKE ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(like, limit);
    return rows.map(toUser).filter(Boolean) as UserRow[];
  }

  create(params: {
    username: string;
    passwordHash: string;
    plan?: UserPlan;
    role?: UserRole;
    creditBalance?: number;
  }) {
    const user: UserRow = {
      id: crypto.randomUUID(),
      username: params.username,
      passwordHash: params.passwordHash,
      createdAt: new Date().toISOString(),
      plan: params.plan || 'free',
      role: params.role || 'user',
      creditBalance: Number.isFinite(Number(params.creditBalance))
        ? Number(params.creditBalance)
        : 0,
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO users(id, username, password_hash, created_at, plan, role, credit_balance)
         VALUES(@id, @username, @password_hash, @created_at, @plan, @role, @credit_balance)`,
      )
      .run({
        id: user.id,
        username: user.username,
        password_hash: user.passwordHash,
        created_at: user.createdAt,
        plan: user.plan,
        role: user.role,
        credit_balance: user.creditBalance,
      });

    return user;
  }

  updatePlan(userId: string, plan: UserPlan) {
    this.sqlite.connection
      .prepare('UPDATE users SET plan = ? WHERE id = ?')
      .run(plan, userId);
  }

  updateRole(userId: string, role: UserRole) {
    this.sqlite.connection
      .prepare('UPDATE users SET role = ? WHERE id = ?')
      .run(role, userId);
  }

  updateCreditBalance(userId: string, creditBalance: number) {
    this.sqlite.connection
      .prepare('UPDATE users SET credit_balance = ? WHERE id = ?')
      .run(creditBalance, userId);
  }
}
