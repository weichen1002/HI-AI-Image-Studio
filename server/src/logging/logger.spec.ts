import { sanitizeLogMeta, toErrorDetails } from './logger';

describe('logger sanitization', () => {
  it('redacts sensitive metadata recursively', () => {
    expect(
      sanitizeLogMeta({
        username: 'user@example.com',
        password: 'secret',
        nested: {
          mailApiKey: 'api-key',
          authorization: 'Bearer token',
          safe: 'visible',
        },
        list: [{ session: 'cookie-value' }],
      }),
    ).toEqual({
      username: 'user@example.com',
      password: '[REDACTED]',
      nested: {
        mailApiKey: '[REDACTED]',
        authorization: '[REDACTED]',
        safe: 'visible',
      },
      list: [{ session: '[REDACTED]' }],
    });
  });

  it('redacts sensitive error causes', () => {
    const error = new Error('failed');
    (error as any).cause = {
      request: {
        token: 'raw-token',
        prompt: 'safe prompt',
      },
    };

    expect(toErrorDetails(error, { includeStack: false })).toEqual({
      name: 'Error',
      message: 'failed',
      cause: {
        request: {
          token: '[REDACTED]',
          prompt: 'safe prompt',
        },
      },
    });
  });
});
