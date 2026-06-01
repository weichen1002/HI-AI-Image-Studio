import { HealthController } from './health.controller';
import { config } from '../config';

describe('HealthController', () => {
  let controller: HealthController;
  const originalApiKey = config.HIAPI_API_KEY;
  const originalWebhookSecret = config.BILLING_WEBHOOK_SECRET;

  beforeEach(() => {
    controller = new HealthController({
      connection: {
        prepare: jest.fn(() => ({
          get: jest.fn(() => ({ ok: 1 })),
        })),
      },
    } as any);
  });

  afterEach(() => {
    config.HIAPI_API_KEY = originalApiKey;
    config.BILLING_WEBHOOK_SECRET = originalWebhookSecret;
  });

  it('returns basic health without exposing secret values', () => {
    config.HIAPI_API_KEY = 'raw-api-key';
    config.BILLING_WEBHOOK_SECRET = 'raw-webhook-secret';

    const result = controller.health();

    expect(result.service).toBe('hi-image-studio-server');
    expect(result.config.hiapi.apiKeyConfigured).toBe(true);
    expect(result.config.billing.webhookSecretConfigured).toBe(true);
    expect(JSON.stringify(result)).not.toContain('raw-api-key');
    expect(JSON.stringify(result)).not.toContain('raw-webhook-secret');
  });

  it('checks sqlite, writable directories, configuration, and hiapi readiness', () => {
    config.HIAPI_API_KEY = '';

    const result = controller.deepHealth();

    expect(result.status).toBe('warn');
    expect(result.checks.sqlite.status).toBe('ok');
    expect(result.checks.databaseDirectory.status).toBe('ok');
    expect(result.checks.uploadsDirectory.status).toBe('ok');
    expect(result.checks.configuration.status).toBe('warn');
    expect(result.checks.hiapi).toEqual({
      status: 'warn',
      detail: 'HIAPI_API_KEY is not configured',
    });
  });

  it('reports deep health errors when sqlite is unavailable', () => {
    controller = new HealthController({
      connection: {
        prepare: jest.fn(() => {
          throw new Error('db unavailable');
        }),
      },
    } as any);

    const result = controller.deepHealth();

    expect(result.status).toBe('error');
    expect(result.checks.sqlite).toEqual({
      status: 'error',
      detail: 'db unavailable',
    });
  });
});
