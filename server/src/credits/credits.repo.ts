import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../db/sqlite.service';

export type LedgerType = 'grant' | 'charge' | 'refund' | 'adjust';

export type CreditLedgerEntry = {
  id: string;
  userId: string;
  amount: number;
  type: LedgerType;
  reason: string;
  refType?: string | null;
  refId?: string | null;
  createdAt: string;
};

function toEntry(row: any): CreditLedgerEntry | null {
  if (!row) return null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    amount: Number(row.amount),
    type: String(row.type) as LedgerType,
    reason: String(row.reason || ''),
    refType: row.ref_type ? String(row.ref_type) : null,
    refId: row.ref_id ? String(row.ref_id) : null,
    createdAt: String(row.created_at),
  };
}

@Injectable()
export class CreditsRepo {
  constructor(private readonly sqlite: SqliteService) {}

  getBalance(userId: string): number {
    const row = this.sqlite.connection
      .prepare('SELECT credit_balance AS b FROM users WHERE id = ?')
      .get(userId);
    return Number(row?.b || 0);
  }

  chargeInTx(params: {
    userId: string;
    cost: number;
    reason: string;
    refType?: string;
    refId?: string;
  }) {
    return this.chargeOrThrow(params);
  }

  charge(params: {
    userId: string;
    cost: number;
    reason: string;
    refType?: string;
    refId?: string;
  }) {
    return this.sqlite.transaction(() => {
      return this.chargeOrThrow(params);
    });
  }

  adjustInTx(params: {
    userId: string;
    amount: number;
    reason: string;
    refType?: string;
    refId?: string;
  }) {
    return this.adjustOrThrow(params);
  }

  adjust(params: {
    userId: string;
    amount: number;
    reason: string;
    refType?: string;
    refId?: string;
  }) {
    return this.sqlite.transaction(() => {
      return this.adjustOrThrow(params);
    });
  }

  listByUser(params: { userId: string; limit: number }) {
    const limit = Math.max(1, Math.min(200, Math.floor(params.limit)));
    const rows = this.sqlite.connection
      .prepare(
        'SELECT * FROM credit_ledgers WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(params.userId, limit);
    return rows.map(toEntry).filter(Boolean) as CreditLedgerEntry[];
  }

  private chargeOrThrow(params: {
    userId: string;
    cost: number;
    reason: string;
    refType?: string;
    refId?: string;
  }) {
    const cost = Math.max(0, Math.floor(params.cost));
    if (cost === 0) {
      return { balance: this.getBalance(params.userId), entry: null };
    }

    const row = this.sqlite.connection
      .prepare('SELECT credit_balance AS b FROM users WHERE id = ?')
      .get(params.userId);
    const balance = Number(row?.b || 0);

    if (balance < cost) {
      throw new HttpException(
        { code: 'INSUFFICIENT_CREDITS', message: '余额不足' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const next = balance - cost;
    this.sqlite.connection
      .prepare('UPDATE users SET credit_balance = ? WHERE id = ?')
      .run(next, params.userId);

    const entry: CreditLedgerEntry = {
      id: crypto.randomUUID(),
      userId: params.userId,
      amount: -cost,
      type: 'charge',
      reason: params.reason,
      refType: params.refType || null,
      refId: params.refId || null,
      createdAt: new Date().toISOString(),
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO credit_ledgers(id, user_id, amount, type, reason, ref_type, ref_id, created_at)
         VALUES(@id, @user_id, @amount, @type, @reason, @ref_type, @ref_id, @created_at)`,
      )
      .run({
        id: entry.id,
        user_id: entry.userId,
        amount: entry.amount,
        type: entry.type,
        reason: entry.reason,
        ref_type: entry.refType,
        ref_id: entry.refId,
        created_at: entry.createdAt,
      });

    return { balance: next, entry };
  }

  private adjustOrThrow(params: {
    userId: string;
    amount: number;
    reason: string;
    refType?: string;
    refId?: string;
  }) {
    const delta = Math.trunc(Number(params.amount));
    if (!Number.isFinite(delta) || delta === 0) {
      throw new HttpException('amount 必须是非 0 整数', HttpStatus.BAD_REQUEST);
    }

    const row = this.sqlite.connection
      .prepare('SELECT credit_balance AS b FROM users WHERE id = ?')
      .get(params.userId);
    const balance = Number(row?.b || 0);
    const next = balance + delta;

    if (next < 0) {
      throw new HttpException(
        '余额不足，无法扣减到负数',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.sqlite.connection
      .prepare('UPDATE users SET credit_balance = ? WHERE id = ?')
      .run(next, params.userId);

    const entry: CreditLedgerEntry = {
      id: crypto.randomUUID(),
      userId: params.userId,
      amount: delta,
      type: 'adjust',
      reason: params.reason,
      refType: params.refType || null,
      refId: params.refId || null,
      createdAt: new Date().toISOString(),
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO credit_ledgers(id, user_id, amount, type, reason, ref_type, ref_id, created_at)
         VALUES(@id, @user_id, @amount, @type, @reason, @ref_type, @ref_id, @created_at)`,
      )
      .run({
        id: entry.id,
        user_id: entry.userId,
        amount: entry.amount,
        type: entry.type,
        reason: entry.reason,
        ref_type: entry.refType,
        ref_id: entry.refId,
        created_at: entry.createdAt,
      });

    return { balance: next, entry };
  }
}
