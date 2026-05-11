import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../sqlite.service';

export type UserPlan = 'free' | 'pro';
export type UserRole = 'user' | 'admin' | 'superadmin';
export type UserStatus = 'active' | 'banned' | 'pending_verification';

export type UserRow = {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  lastUsedAt: string;
  plan: UserPlan;
  role: UserRole;
  status: UserStatus;
  creditBalance: number;
};

function toUser(row: any): UserRow | null {
  if (!row) return null;
  return {
    id: String(row.id),
    username: String(row.username),
    passwordHash: String(row.password_hash),
    createdAt: String(row.created_at),
    lastUsedAt: String(row.last_used_at || ''),
    plan: (row.plan || 'free') as UserPlan,
    role: (row.role || 'user') as UserRole,
    status: (row.status || 'active') as UserStatus,
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

  listPaged(params: {
    q?: string;
    plan?: UserPlan;
    role?: UserRole;
    status?: UserStatus;
    minBalance?: number;
    maxBalance?: number;
    lowBalanceOnly?: boolean;
    limit: number;
    offset: number;
  }) {
    const q = String(params.q || '').trim();
    const limit = Math.max(1, Math.min(100, Math.floor(params.limit)));
    const offset = Math.max(0, Math.floor(params.offset));

    const where: string[] = [];
    const values: any[] = [];

    if (q) {
      where.push('lower(username) LIKE ?');
      values.push(`%${q.toLowerCase()}%`);
    }
    if (params.plan) {
      where.push('plan = ?');
      values.push(params.plan);
    }
    if (params.role) {
      where.push('role = ?');
      values.push(params.role);
    }
    if (params.status) {
      where.push('status = ?');
      values.push(params.status);
    }
    if (Number.isFinite(params.minBalance as number)) {
      where.push('credit_balance >= ?');
      values.push(Number(params.minBalance));
    }
    if (Number.isFinite(params.maxBalance as number)) {
      where.push('credit_balance <= ?');
      values.push(Number(params.maxBalance));
    }
    if (params.lowBalanceOnly) {
      where.push('credit_balance <= 0');
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = this.sqlite.connection
      .prepare(`SELECT COUNT(1) AS c FROM users ${whereSql}`)
      .get(...values) as any;
    const total = Number(totalRow?.c || 0);

    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...values, limit, offset);
    const users = rows.map(toUser).filter(Boolean) as UserRow[];

    return { users, total };
  }

  create(params: {
    username: string;
    passwordHash: string;
    plan?: UserPlan;
    role?: UserRole;
    status?: UserStatus;
    creditBalance?: number;
  }) {
    const user: UserRow = {
      id: crypto.randomUUID(),
      username: params.username,
      passwordHash: params.passwordHash,
      createdAt: new Date().toISOString(),
      lastUsedAt: '',
      plan: params.plan || 'free',
      role: params.role || 'user',
      status: params.status || 'active',
      creditBalance: Number.isFinite(Number(params.creditBalance))
        ? Number(params.creditBalance)
        : 0,
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO users(id, username, password_hash, created_at, plan, role, status, credit_balance)
         VALUES(@id, @username, @password_hash, @created_at, @plan, @role, @status, @credit_balance)`,
      )
      .run({
        id: user.id,
        username: user.username,
        password_hash: user.passwordHash,
        created_at: user.createdAt,
        plan: user.plan,
        role: user.role,
        status: user.status,
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

  updateStatus(userId: string, status: UserStatus) {
    this.sqlite.connection
      .prepare('UPDATE users SET status = ? WHERE id = ?')
      .run(status, userId);
  }

  updatePasswordHash(userId: string, passwordHash: string) {
    this.sqlite.connection
      .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(passwordHash, userId);
  }

  updateCreditBalance(userId: string, creditBalance: number) {
    this.sqlite.connection
      .prepare('UPDATE users SET credit_balance = ? WHERE id = ?')
      .run(creditBalance, userId);
  }

  touchLastUsed(userId: string, lastUsedAt = new Date().toISOString()) {
    this.sqlite.connection
      .prepare('UPDATE users SET last_used_at = ? WHERE id = ?')
      .run(lastUsedAt, userId);
  }

  deleteById(userId: string) {
    const result = this.sqlite.connection
      .prepare('DELETE FROM users WHERE id = ?')
      .run(userId);
    return Number(result?.changes || 0);
  }
}
