import {
  cleanUsername,
  hashPassword,
  normalizeAspectRatio,
  signSession,
  verifyPassword,
  verifySession,
} from './index';

describe('utils', () => {
  it('signs and verifies sessions', () => {
    const token = signSession('user-1');

    expect(verifySession(token)).toBe('user-1');
    expect(verifySession(`${token}x`)).toBeNull();
    expect(verifySession(`${token}.extra`)).toBeNull();
  });

  it('hashes and verifies passwords', () => {
    const hash = hashPassword('secret');

    expect(hash).not.toBe('secret');
    expect(verifyPassword('secret', hash)).toBe(true);
    expect(verifyPassword('wrong', hash)).toBe(false);
    expect(verifyPassword('secret', 'salt:short')).toBe(false);
  });

  it('cleans usernames', () => {
    expect(cleanUsername('  user@example.com  ')).toBe('user@example.com');
    expect(cleanUsername('x'.repeat(300))).toHaveLength(254);
  });

  it('normalizes supported aspect ratios', () => {
    expect(normalizeAspectRatio('16:9')).toBe('16:9');
    expect(normalizeAspectRatio('bad')).toBe('1:1');
  });
});
