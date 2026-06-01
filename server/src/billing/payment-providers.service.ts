import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { config } from '../config';

export type PaymentProviderChannel = 'mock' | 'manual' | 'wechat' | 'alipay' | 'stripe';

export type PaymentWebhookHeaders = {
  signature?: string;
};

export type PaymentWebhookCompletion = {
  orderId: string;
  paymentChannel: PaymentProviderChannel;
  paymentRef: string;
  amountCents: number;
  currency: string;
  grantReason: string;
  enforcePaymentChannel: boolean;
  enforcePaymentRef?: boolean;
};

export type PaymentProviderAdapter = {
  channel: PaymentProviderChannel;
  parsePaidWebhook(body: any, headers: PaymentWebhookHeaders): PaymentWebhookCompletion;
};

function normalizeCurrency(value: unknown) {
  return String(value || 'CNY').trim().toUpperCase();
}

function normalizeAmountCents(value: unknown) {
  const amountCents = Number(value);
  return Number.isFinite(amountCents) ? Math.floor(amountCents) : 0;
}

function mockWebhookPayloadForSignature(body: any) {
  return [
    String(body?.orderId || '').trim(),
    String(body?.paymentRef || '').trim(),
    String(normalizeAmountCents(body?.amountCents || 0)),
    normalizeCurrency(body?.currency),
  ].join('.');
}

function verifyMockWebhookSignature(body: any, signature: string | undefined) {
  if (!config.BILLING_WEBHOOK_SECRET) {
    throw new HttpException('支付回调密钥未配置', HttpStatus.INTERNAL_SERVER_ERROR);
  }
  const actual = String(signature || body?.signature || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(actual)) {
    throw new HttpException('支付回调验签失败', HttpStatus.UNAUTHORIZED);
  }
  const expected = crypto
    .createHmac('sha256', config.BILLING_WEBHOOK_SECRET)
    .update(mockWebhookPayloadForSignature(body))
    .digest('hex');
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new HttpException('支付回调验签失败', HttpStatus.UNAUTHORIZED);
  }
}

@Injectable()
export class MockPaymentProviderAdapter implements PaymentProviderAdapter {
  readonly channel = 'mock' as const;

  parsePaidWebhook(body: any, headers: PaymentWebhookHeaders): PaymentWebhookCompletion {
    verifyMockWebhookSignature(body, headers.signature);
    return {
      orderId: String(body?.orderId || '').trim(),
      paymentChannel: this.channel,
      paymentRef: String(body?.paymentRef || '').trim(),
      amountCents: normalizeAmountCents(body?.amountCents),
      currency: normalizeCurrency(body?.currency),
      grantReason: 'billing_order_mock_webhook_paid',
      enforcePaymentChannel: true,
    };
  }
}

@Injectable()
export class PaymentProvidersService {
  private readonly adapters: PaymentProviderAdapter[];

  constructor(mockProvider: MockPaymentProviderAdapter) {
    this.adapters = [mockProvider];
  }

  getAdapter(channel: PaymentProviderChannel) {
    const adapter = this.adapters.find((item) => item.channel === channel);
    if (!adapter) {
      throw new HttpException('不支持的支付渠道', HttpStatus.BAD_REQUEST);
    }
    return adapter;
  }

  parsePaidWebhook(
    channel: PaymentProviderChannel,
    body: any,
    headers: PaymentWebhookHeaders,
  ) {
    return this.getAdapter(channel).parsePaidWebhook(body, headers);
  }
}
