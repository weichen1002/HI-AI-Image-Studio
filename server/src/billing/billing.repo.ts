import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../db/sqlite.service';

export type BillingOrderStatus = 'pending' | 'paid' | 'refunded' | 'cancelled' | 'failed';

export type BillingPackage = {
  id: string;
  name: string;
  description: string;
  creditsAmount: number;
  priceCents: number;
  currency: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type BillingOrder = {
  id: string;
  userId: string;
  packageId: string;
  packageName: string;
  creditsAmount: number;
  amountCents: number;
  currency: string;
  status: BillingOrderStatus;
  paymentChannel: string;
  paymentRef: string;
  ledgerEntryId: string;
  refundLedgerEntryId: string;
  refundReason: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string;
  refundedAt: string;
};

function toPackage(row: any): BillingPackage | null {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    description: String(row.description || ''),
    creditsAmount: Number(row.credits_amount || 0),
    priceCents: Number(row.price_cents || 0),
    currency: String(row.currency || 'CNY'),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order || 0),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function toOrder(row: any): BillingOrder | null {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    packageId: String(row.package_id || ''),
    packageName: String(row.package_name || ''),
    creditsAmount: Number(row.credits_amount || 0),
    amountCents: Number(row.amount_cents || 0),
    currency: String(row.currency || 'CNY'),
    status: String(row.status || 'pending') as BillingOrderStatus,
    paymentChannel: String(row.payment_channel || ''),
    paymentRef: String(row.payment_ref || ''),
    ledgerEntryId: String(row.ledger_entry_id || ''),
    refundLedgerEntryId: String(row.refund_ledger_entry_id || ''),
    refundReason: String(row.refund_reason || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    paidAt: String(row.paid_at || ''),
    refundedAt: String(row.refunded_at || ''),
  };
}

@Injectable()
export class BillingRepo {
  constructor(private readonly sqlite: SqliteService) {}

  listActivePackages() {
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM billing_packages
         WHERE active = 1
         ORDER BY sort_order ASC, price_cents ASC`,
      )
      .all();
    return rows.map(toPackage).filter(Boolean) as BillingPackage[];
  }

  findPackageById(id: string) {
    const row = this.sqlite.connection
      .prepare('SELECT * FROM billing_packages WHERE id = ?')
      .get(id);
    return toPackage(row);
  }

  findOrderById(id: string) {
    const row = this.sqlite.connection
      .prepare('SELECT * FROM billing_orders WHERE id = ?')
      .get(id);
    return toOrder(row);
  }

  createPendingOrder(params: {
    userId: string;
    pkg: BillingPackage;
    paymentChannel?: string;
  }) {
    const now = new Date().toISOString();
    const order: BillingOrder = {
      id: crypto.randomUUID(),
      userId: params.userId,
      packageId: params.pkg.id,
      packageName: params.pkg.name,
      creditsAmount: params.pkg.creditsAmount,
      amountCents: params.pkg.priceCents,
      currency: params.pkg.currency,
      status: 'pending',
      paymentChannel: String(params.paymentChannel || ''),
      paymentRef: '',
      ledgerEntryId: '',
      refundLedgerEntryId: '',
      refundReason: '',
      createdAt: now,
      updatedAt: now,
      paidAt: '',
      refundedAt: '',
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO billing_orders(
          id, user_id, package_id, package_name, credits_amount, amount_cents, currency,
          status, payment_channel, payment_ref, ledger_entry_id, refund_ledger_entry_id, refund_reason, created_at, updated_at, paid_at, refunded_at
        ) VALUES(
          @id, @user_id, @package_id, @package_name, @credits_amount, @amount_cents, @currency,
          @status, @payment_channel, @payment_ref, @ledger_entry_id, @refund_ledger_entry_id, @refund_reason, @created_at, @updated_at, @paid_at, @refunded_at
        )`,
      )
      .run({
        id: order.id,
        user_id: order.userId,
        package_id: order.packageId,
        package_name: order.packageName,
        credits_amount: order.creditsAmount,
        amount_cents: order.amountCents,
        currency: order.currency,
        status: order.status,
        payment_channel: order.paymentChannel || null,
        payment_ref: null,
        ledger_entry_id: null,
        refund_ledger_entry_id: null,
        refund_reason: null,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
        paid_at: null,
        refunded_at: null,
      });

    return order;
  }

  listOrdersPaged(params: {
    userId?: string;
    status?: BillingOrderStatus;
    limit: number;
    offset: number;
  }) {
    const limit = Math.max(1, Math.min(100, Math.floor(params.limit)));
    const offset = Math.max(0, Math.floor(params.offset));
    const where: string[] = [];
    const values: any[] = [];

    if (params.userId) {
      where.push('user_id = ?');
      values.push(params.userId);
    }
    if (params.status) {
      where.push('status = ?');
      values.push(params.status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRow = this.sqlite.connection
      .prepare(`SELECT COUNT(1) AS c FROM billing_orders ${whereSql}`)
      .get(...values) as any;
    const total = Number(totalRow?.c || 0);
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM billing_orders ${whereSql}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...values, limit, offset);

    return {
      orders: rows.map(toOrder).filter(Boolean) as BillingOrder[],
      total,
    };
  }

  markOrderPaidInTx(params: {
    orderId: string;
    ledgerEntryId: string;
    paymentRef?: string;
    paidAt?: string;
  }) {
    const paidAt = params.paidAt || new Date().toISOString();
    const result = this.sqlite.connection
      .prepare(
        `UPDATE billing_orders
         SET status = 'paid',
             payment_ref = ?,
             ledger_entry_id = ?,
             paid_at = ?,
             updated_at = ?
         WHERE id = ? AND status = 'pending' AND ledger_entry_id IS NULL`,
      )
      .run(
        String(params.paymentRef || ''),
        params.ledgerEntryId,
        paidAt,
        paidAt,
        params.orderId,
      );

    return Number(result?.changes || 0) === 1 ? this.findOrderById(params.orderId) : null;
  }

  markOrderRefundedInTx(params: {
    orderId: string;
    refundLedgerEntryId: string;
    refundReason: string;
    refundedAt?: string;
  }) {
    const refundedAt = params.refundedAt || new Date().toISOString();
    const result = this.sqlite.connection
      .prepare(
        `UPDATE billing_orders
         SET status = 'refunded',
             refund_ledger_entry_id = ?,
             refund_reason = ?,
             refunded_at = ?,
             updated_at = ?
         WHERE id = ? AND status = 'paid' AND refund_ledger_entry_id IS NULL`,
      )
      .run(
        params.refundLedgerEntryId,
        String(params.refundReason || ''),
        refundedAt,
        refundedAt,
        params.orderId,
      );

    return Number(result?.changes || 0) === 1 ? this.findOrderById(params.orderId) : null;
  }
}
