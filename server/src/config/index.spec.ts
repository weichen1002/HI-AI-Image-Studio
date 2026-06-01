import { config, validateStartupConfig } from './index';

describe('validateStartupConfig', () => {
  it('allows local development with warnings for optional secrets', () => {
    const result = validateStartupConfig(
      {
        ...config,
        ADMIN_TOKEN: '',
        BILLING_WEBHOOK_SECRET: '',
        HIAPI_API_KEY: '',
      },
      'development',
    );

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'ADMIN_TOKEN is not configured',
        'BILLING_WEBHOOK_SECRET is not configured',
        'HIAPI_API_KEY is not configured',
      ]),
    );
  });

  it('rejects missing production secrets', () => {
    const result = validateStartupConfig(
      {
        ...config,
        ADMIN_TOKEN: '',
        BILLING_WEBHOOK_SECRET: '',
        HIAPI_API_KEY: '',
      },
      'production',
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'ADMIN_TOKEN is required in production',
        'BILLING_WEBHOOK_SECRET is required in production',
        'HIAPI_API_KEY is required in production',
      ]),
    );
  });

  it('rejects invalid numeric and path configuration', () => {
    const result = validateStartupConfig(
      {
        ...config,
        PORT: 0,
        SQLITE_FILE: '',
        DATA_DIR: '',
        HIAPI_BASE_URL: '',
        HIAPI_MODEL: '',
      },
      'test',
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'PORT must be a positive number',
        'SQLITE_FILE is required',
        'DATA_DIR is required',
        'HIAPI_BASE_URL is required',
        'HIAPI_MODEL is required',
      ]),
    );
  });
});
