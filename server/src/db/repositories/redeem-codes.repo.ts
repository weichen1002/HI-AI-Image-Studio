import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { config } from '../../config';
import { CreditsRepo } from '../../credits/credits.repo';
import { SqliteService } from '../sqlite.service';

export type RedeemCodeType = 'single' | 'campaign';
export type RedeemCodeStatus = 'active' | 'disabled' | 'expired' | 'exhausted';

export type RedeemCodeEntity = {
  id: string;
  title: string;
  codeMask: string;
  type: RedeemCodeType;
  creditsAmount: number;
  totalLimit: number;
  redeemedCount: number;
  expiresAt: string | null;
  enabled: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type RedeemCodeAdminItem = RedeemCodeEntity & {
  status: RedeemCodeStatus;
  plainCode?: string | null;
};

export type RedeemCodeClaimEntity = {
  id: string;
  codeId: string;
  userId: string;
  creditsAmount: number;
  claimedAt: string;
  ledgerEntryId: string | null;
};

export type RedeemCodeClaimAdminItem = RedeemCodeClaimEntity & {
  username: string;
};

function toRedeemCode(row: any): RedeemCodeEntity | null {
  if (!row) return null;
  return {
    id: String(row.id),
    title: String(row.title || ''),
    codeMask: String(row.code_mask || ''),
    type: (row.type || 'single') as RedeemCodeType,
    creditsAmount: Number(row.credits_amount || 0),
    totalLimit: Number(row.total_limit || 0),
    redeemedCount: Number(row.redeemed_count || 0),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    enabled: Boolean(row.enabled),
    createdBy: String(row.created_by || ''),
    updatedBy: String(row.updated_by || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function toRedeemCodeClaim(row: any): RedeemCodeClaimAdminItem | null {
  if (!row) return null;
  return {
    id: String(row.id),
    codeId: String(row.code_id || ''),
    userId: String(row.user_id || ''),
    username: String(row.username || ''),
    creditsAmount: Number(row.credits_amount || 0),
    claimedAt: String(row.claimed_at || ''),
    ledgerEntryId: row.ledger_entry_id ? String(row.ledger_entry_id) : null,
  };
}

export function normalizeRedeemCode(value: any) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function isValidRedeemCode(value: string) {
  return /^[A-Z0-9_-]{4,32}$/.test(value);
}

function hashRedeemCode(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function maskRedeemCode(value: string) {
  if (value.length <= 4) return `${value.slice(0, 1)}***`;
  if (value.length <= 8) return `${value.slice(0, 2)}****${value.slice(-2)}`;
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function generateRandomRedeemCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments = [4, 4, 4];
  return segments
    .map((segmentLength) => {
      let segment = '';
      while (segment.length < segmentLength) {
        const index = crypto.randomInt(0, alphabet.length);
        segment += alphabet[index];
      }
      return segment;
    })
    .join('-');
}

function getRedeemCipherKey() {
  return crypto
    .createHash('sha256')
    .update(config.REDEEM_CODE_SECRET)
    .digest();
}

function encryptRedeemCode(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getRedeemCipherKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decryptRedeemCode(value: string) {
  const [ivRaw, authTagRaw, encryptedRaw] = String(value || '').split('.');
  if (!ivRaw || !authTagRaw || !encryptedRaw) {
    throw new Error('invalid cipher payload');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getRedeemCipherKey(),
    Buffer.from(ivRaw, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function tryDecryptRedeemCode(value: string | null | undefined) {
  if (!value) return null;
  try {
    return decryptRedeemCode(value);
  } catch {
    return null;
  }
}

function getRedeemCodeStatus(
  code: Pick<RedeemCodeEntity, 'enabled' | 'expiresAt' | 'redeemedCount' | 'totalLimit'>,
  now = new Date().toISOString(),
): RedeemCodeStatus {
  if (!code.enabled) return 'disabled';
  if (code.expiresAt && code.expiresAt < now) return 'expired';
  if (code.redeemedCount >= code.totalLimit) return 'exhausted';
  return 'active';
}

@Injectable()
export class RedeemCodesRepo {
  constructor(
    private readonly sqlite: SqliteService,
    private readonly creditsRepo: CreditsRepo,
  ) {}

  findById(id: string) {
    const row = this.sqlite.connection
      .prepare('SELECT * FROM redeem_codes WHERE id = ?')
      .get(id);
    return toRedeemCode(row);
  }

  listAdminPaged(params: {
    q?: string;
    type?: string;
    status?: string;
    limit: number;
    offset: number;
  }) {
    const q = String(params.q || '').trim().toLowerCase();
    const type = String(params.type || '').trim();
    const status = String(params.status || '').trim();
    const limit = Math.max(1, Math.min(100, Math.floor(params.limit)));
    const offset = Math.max(0, Math.floor(params.offset));
    const now = new Date().toISOString();

    const where: string[] = [];
    const values: any[] = [];

    if (q) {
      where.push('(lower(title) LIKE ? OR lower(code_mask) LIKE ?)');
      values.push(`%${q}%`, `%${q}%`);
    }
    if (type === 'single' || type === 'campaign') {
      where.push('type = ?');
      values.push(type);
    }
    if (status) {
      if (status === 'disabled') {
        where.push('enabled = 0');
      } else if (status === 'expired') {
        where.push('enabled != 0 AND expires_at IS NOT NULL AND expires_at < ?');
        values.push(now);
      } else if (status === 'exhausted') {
        where.push(
          'enabled != 0 AND (expires_at IS NULL OR expires_at >= ?) AND redeemed_count >= total_limit',
        );
        values.push(now);
      } else if (status === 'active') {
        where.push(
          'enabled != 0 AND (expires_at IS NULL OR expires_at >= ?) AND redeemed_count < total_limit',
        );
        values.push(now);
      } else {
        where.push('1 = 0');
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRow = this.sqlite.connection
      .prepare(`SELECT COUNT(1) AS c FROM redeem_codes ${whereSql}`)
      .get(...values) as any;
    const total = Number(totalRow?.c || 0);

    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM redeem_codes ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...values, limit, offset);

    const codes = rows
      .map((row: any) => {
        const item = toRedeemCode(row);
        if (!item) return null;
        return {
          ...item,
          plainCode: tryDecryptRedeemCode(row.code_ciphertext),
          status: getRedeemCodeStatus(item, now),
        };
      })
      .filter(Boolean) as RedeemCodeAdminItem[];

    return {
      total,
      codes,
    };
  }

  listClaimsPaged(params: { codeId: string; limit: number; offset: number }) {
    const limit = Math.max(1, Math.min(100, Math.floor(params.limit)));
    const offset = Math.max(0, Math.floor(params.offset));
    const totalRow = this.sqlite.connection
      .prepare(
        'SELECT COUNT(1) AS c FROM redeem_code_claims WHERE code_id = ?',
      )
      .get(params.codeId) as any;
    const total = Number(totalRow?.c || 0);

    const rows = this.sqlite.connection
      .prepare(
        `SELECT c.*, u.username
         FROM redeem_code_claims c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.code_id = ?
         ORDER BY c.claimed_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(params.codeId, limit, offset);

    return {
      total,
      claims: rows
        .map((row: any) => toRedeemCodeClaim(row))
        .filter(Boolean) as RedeemCodeClaimAdminItem[],
    };
  }

  create(params: {
    title: string;
    type: RedeemCodeType;
    creditsAmount: number;
    totalLimit: number;
    expiresAt?: string | null;
    enabled?: boolean;
    createdBy: string;
  }) {
    let normalizedCode = '';
    let hashedCode = '';
    let attempt = 0;
    let createdUniqueCode = false;
    do {
      attempt += 1;
      normalizedCode = generateRandomRedeemCode();
      hashedCode = hashRedeemCode(normalizedCode);
      const exists = this.sqlite.connection
        .prepare('SELECT id FROM redeem_codes WHERE code_hash = ?')
        .get(hashedCode);
      if (!exists) {
        createdUniqueCode = true;
        break;
      }
    } while (attempt < 8);

    if (!createdUniqueCode) {
      throw new HttpException('随机生成兑换码失败，请重试', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const now = new Date().toISOString();
    const codeCiphertext = encryptRedeemCode(normalizedCode);
    const entity: RedeemCodeEntity = {
      id: crypto.randomUUID(),
      title: params.title,
      codeMask: maskRedeemCode(normalizedCode),
      type: params.type,
      creditsAmount: params.creditsAmount,
      totalLimit: params.totalLimit,
      redeemedCount: 0,
      expiresAt: params.expiresAt || null,
      enabled: params.enabled !== false,
      createdBy: params.createdBy,
      updatedBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO redeem_codes(
          id, title, code_hash, code_mask, code_ciphertext, type, credits_amount,
          total_limit, redeemed_count, expires_at, enabled,
          created_by, updated_by, created_at, updated_at
        ) VALUES(
          @id, @title, @code_hash, @code_mask, @code_ciphertext, @type, @credits_amount,
          @total_limit, @redeemed_count, @expires_at, @enabled,
          @created_by, @updated_by, @created_at, @updated_at
        )`,
      )
      .run({
        id: entity.id,
        title: entity.title,
        code_hash: hashedCode,
        code_mask: entity.codeMask,
        code_ciphertext: codeCiphertext,
        type: entity.type,
        credits_amount: entity.creditsAmount,
        total_limit: entity.totalLimit,
        redeemed_count: entity.redeemedCount,
        expires_at: entity.expiresAt,
        enabled: entity.enabled ? 1 : 0,
        created_by: entity.createdBy,
        updated_by: entity.updatedBy,
        created_at: entity.createdAt,
        updated_at: entity.updatedAt,
      });

    return {
      ...entity,
      plainCode: normalizedCode,
      status: getRedeemCodeStatus(entity),
    } as RedeemCodeAdminItem & { plainCode: string };
  }

  getPlainCodeForAdmin(id: string) {
    const row = this.sqlite.connection
      .prepare('SELECT code_ciphertext FROM redeem_codes WHERE id = ?')
      .get(id) as { code_ciphertext?: string | null } | undefined;
    if (!row) return null;
    if (!row.code_ciphertext) {
      throw new HttpException(
        '该兑换码创建于旧版本，当前无法再次查看完整码',
        HttpStatus.CONFLICT,
      );
    }
    try {
      return decryptRedeemCode(row.code_ciphertext);
    } catch {
      throw new HttpException(
        '完整兑换码解密失败，请检查 REDEEM_CODE_SECRET 是否发生变更',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  update(
    id: string,
    params: {
      title?: string;
      creditsAmount?: number;
      totalLimit?: number;
      expiresAt?: string | null;
      enabled?: boolean;
      updatedBy: string;
    },
  ) {
    const current = this.findById(id);
    if (!current) return null;

    const next: RedeemCodeEntity = {
      ...current,
      title: params.title ?? current.title,
      creditsAmount: params.creditsAmount ?? current.creditsAmount,
      totalLimit: params.totalLimit ?? current.totalLimit,
      expiresAt:
        params.expiresAt === undefined ? current.expiresAt : params.expiresAt,
      enabled: params.enabled ?? current.enabled,
      updatedBy: params.updatedBy,
      updatedAt: new Date().toISOString(),
    };

    this.sqlite.connection
      .prepare(
        `UPDATE redeem_codes SET
          title = @title,
          credits_amount = @credits_amount,
          total_limit = @total_limit,
          expires_at = @expires_at,
          enabled = @enabled,
          updated_by = @updated_by,
          updated_at = @updated_at
        WHERE id = @id`,
      )
      .run({
        id: next.id,
        title: next.title,
        credits_amount: next.creditsAmount,
        total_limit: next.totalLimit,
        expires_at: next.expiresAt,
        enabled: next.enabled ? 1 : 0,
        updated_by: next.updatedBy,
        updated_at: next.updatedAt,
      });

    return {
      ...next,
      status: getRedeemCodeStatus(next),
    } as RedeemCodeAdminItem;
  }

  setEnabled(id: string, enabled: boolean, updatedBy: string) {
    const current = this.findById(id);
    if (!current) return null;
    const updatedAt = new Date().toISOString();
    this.sqlite.connection
      .prepare(
        `UPDATE redeem_codes
         SET enabled = ?, updated_by = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(enabled ? 1 : 0, updatedBy, updatedAt, id);
    const next = this.findById(id);
    return next
      ? ({ ...next, status: getRedeemCodeStatus(next) } as RedeemCodeAdminItem)
      : null;
  }

  claim(params: { code: string; userId: string }) {
    return this.sqlite.transaction(() => {
      const normalizedCode = normalizeRedeemCode(params.code);
      if (!isValidRedeemCode(normalizedCode)) {
        throw new HttpException('兑换码格式不正确', HttpStatus.BAD_REQUEST);
      }

      const row = this.sqlite.connection
        .prepare('SELECT * FROM redeem_codes WHERE code_hash = ?')
        .get(hashRedeemCode(normalizedCode));
      const code = toRedeemCode(row);
      if (!code) {
        throw new HttpException('兑换码不存在', HttpStatus.NOT_FOUND);
      }
      if (!code.enabled) {
        throw new HttpException('该兑换码已停用', HttpStatus.BAD_REQUEST);
      }
      if (code.expiresAt && code.expiresAt < new Date().toISOString()) {
        throw new HttpException('该兑换码已过期', HttpStatus.BAD_REQUEST);
      }

      const existingClaim = this.sqlite.connection
        .prepare(
          'SELECT id FROM redeem_code_claims WHERE code_id = ? AND user_id = ?',
        )
        .get(code.id, params.userId);
      if (existingClaim) {
        throw new HttpException(
          '你已经兑换过这个兑换码了',
          HttpStatus.CONFLICT,
        );
      }

      // 条件更新保证活动码并发领取时不会超发。
      const updateResult = this.sqlite.connection
        .prepare(
          `UPDATE redeem_codes
           SET redeemed_count = redeemed_count + 1, updated_at = ?
           WHERE id = ? AND redeemed_count < total_limit`,
        )
        .run(new Date().toISOString(), code.id);
      if (Number(updateResult?.changes || 0) !== 1) {
        throw new HttpException('该兑换码已被领完', HttpStatus.CONFLICT);
      }

      const grantResult = this.creditsRepo.grantInTx({
        userId: params.userId,
        amount: code.creditsAmount,
        reason: 'redeem_code',
        refType: 'redeem_code',
        refId: code.id,
      });

      const claim: RedeemCodeClaimEntity = {
        id: crypto.randomUUID(),
        codeId: code.id,
        userId: params.userId,
        creditsAmount: code.creditsAmount,
        claimedAt: new Date().toISOString(),
        ledgerEntryId: grantResult.entry?.id || null,
      };

      this.sqlite.connection
        .prepare(
          `INSERT INTO redeem_code_claims(
            id, code_id, user_id, credits_amount, claimed_at, ledger_entry_id
          ) VALUES(
            @id, @code_id, @user_id, @credits_amount, @claimed_at, @ledger_entry_id
          )`,
        )
        .run({
          id: claim.id,
          code_id: claim.codeId,
          user_id: claim.userId,
          credits_amount: claim.creditsAmount,
          claimed_at: claim.claimedAt,
          ledger_entry_id: claim.ledgerEntryId,
        });

      return {
        amount: code.creditsAmount,
        balance: grantResult.balance,
        code: {
          id: code.id,
          title: code.title,
          type: code.type,
        },
        claim,
      };
    });
  }
}
