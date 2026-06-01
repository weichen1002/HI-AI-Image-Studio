import { HttpException } from '@nestjs/common';
import * as crypto from 'crypto';
import { config } from '../config';
import {
  MockPaymentProviderAdapter,
  PaymentProvidersService,
} from './payment-providers.service';

function signMockPayload(secret: string, payload: string) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

describe('payment provider adapters', () => {
  const originalSecret = config.BILLING_WEBHOOK_SECRET;
  let mockProvider: MockPaymentProviderAdapter;

  beforeEach(() => {
    config.BILLING_WEBHOOK_SECRET = 'webhook-secret';
    mockProvider = new MockPaymentProviderAdapter();
  });

  afterEach(() => {
    config.BILLING_WEBHOOK_SECRET = originalSecret;
  });

  it('maps signed mock paid webhooks to a billing completion payload', () => {
    const body = {
      orderId: 'order-1',
      paymentRef: 'mock:pay-1',
      amountCents: 990,
      currency: 'cny',
    };
    const signature = signMockPayload('webhook-secret', 'order-1.mock:pay-1.990.CNY');

    expect(mockProvider.parsePaidWebhook(body, { signature })).toEqual({
      orderId: 'order-1',
      paymentChannel: 'mock',
      paymentRef: 'mock:pay-1',
      amountCents: 990,
      currency: 'CNY',
      grantReason: 'billing_order_mock_webhook_paid',
      enforcePaymentChannel: true,
    });
  });

  it('accepts mock signatures from the body for fixture-style tests', () => {
    const signature = signMockPayload('webhook-secret', 'order-2.mock:pay-2.100.USD');

    expect(
      mockProvider.parsePaidWebhook(
        {
          orderId: 'order-2',
          paymentRef: 'mock:pay-2',
          amountCents: '100',
          currency: 'usd',
          signature,
        },
        {},
      ),
    ).toEqual(
      expect.objectContaining({
        orderId: 'order-2',
        paymentRef: 'mock:pay-2',
        amountCents: 100,
        currency: 'USD',
      }),
    );
  });

  it('rejects mock webhooks with invalid signatures', () => {
    expect(() =>
      mockProvider.parsePaidWebhook(
        {
          orderId: 'order-1',
          paymentRef: 'mock:pay-1',
          amountCents: 990,
          currency: 'CNY',
        },
        { signature: 'bad-signature' },
      ),
    ).toThrow(HttpException);
  });

  it('rejects unsupported payment providers', () => {
    const service = new PaymentProvidersService(mockProvider);

    expect(() => service.getAdapter('stripe')).toThrow('不支持的支付渠道');
  });
});
