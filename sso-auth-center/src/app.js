import express from 'express';
import cookieParser from 'cookie-parser';
import { AuthRepository, openDatabase } from './db.js';
import {
  hashPassword,
  hashSecret,
  randomToken,
  timingSafeEqualString,
  verifyPassword,
} from './crypto-utils.js';
import { loadOrCreateKeyPair } from './keys.js';
import { createConsoleMailer } from './mailer.js';
import {
  appendRedirect,
  authenticateAccessToken,
  buildTokenSet,
  validateAuthorizeRequest,
  verifyPkce,
} from './oauth.js';
import { createRateLimiter } from './rate-limit.js';

function requestMeta(req) {
  return {
    ip: String(req.ip || ''),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
  };
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function localNext(value) {
  const next = String(value || '/');
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

function issueCsrf(req, res, config) {
  const existing = String(req.cookies?.csrf_token || '');
  const token = existing || `csrf_${randomToken(32)}`;
  if (!existing) {
    res.cookie('csrf_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secureCookies,
      maxAge: config.sessionTtlSeconds * 1000,
    });
  }
  return token;
}

function verifyCsrf(req) {
  const cookieToken = String(req.cookies?.csrf_token || '');
  const bodyToken = String(req.body?.csrfToken || req.headers['x-csrf-token'] || '');
  return Boolean(cookieToken && bodyToken && timingSafeEqualString(cookieToken, bodyToken));
}

function renderPage(title, body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #172026; }
    main { width: min(420px, calc(100vw - 32px)); margin: 72px auto; background: #fff; border: 1px solid #d9e0e7; border-radius: 8px; padding: 28px; box-shadow: 0 16px 48px rgba(23,32,38,.08); }
    h1 { margin: 0 0 18px; font-size: 24px; }
    label { display: block; margin: 14px 0 6px; font-size: 13px; color: #52616d; }
    input { width: 100%; box-sizing: border-box; height: 40px; border: 1px solid #c9d2dc; border-radius: 6px; padding: 0 10px; font: inherit; }
    button { width: 100%; margin-top: 18px; height: 42px; border: 0; border-radius: 6px; background: #116149; color: #fff; font-weight: 700; cursor: pointer; }
    a { color: #116149; }
    .muted { color: #64727f; font-size: 13px; line-height: 1.6; }
    .error { background: #fff0f0; color: #a51f1f; border: 1px solid #f1c7c7; padding: 10px; border-radius: 6px; font-size: 13px; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

function requireLogin(req, res, repo) {
  const sessionId = req.cookies?.[repo.config.sessionCookieName];
  if (!sessionId) return null;
  const session = repo.findSession(sessionId);
  if (!session) return null;
  const user = repo.findUserById(session.user_id);
  if (!user || user.status !== 'active') return null;
  return user;
}

export function createApp({ config, db = openDatabase(config), keyPair = loadOrCreateKeyPair(config) }) {
  const repo = new AuthRepository(db, config);
  const mailer = createConsoleMailer(config);
  const authRateLimit = createRateLimiter({
    windowSeconds: config.authRateLimitWindowSeconds,
    max: config.authRateLimitMax,
    maxBuckets: config.authRateLimitMaxBuckets,
  });
  const app = express();
  app.set('trust proxy', config.trustProxy);

  app.locals.repo = repo;
  app.locals.keyPair = keyPair;
  app.locals.config = config;
  app.locals.mailer = mailer;
  app.locals.sentEmails = mailer.sent;

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/.well-known/openid-configuration', (_req, res) => {
    res.json({
      issuer: config.issuer,
      authorization_endpoint: `${config.issuer}/oauth/authorize`,
      token_endpoint: `${config.issuer}/oauth/token`,
      userinfo_endpoint: `${config.issuer}/oauth/userinfo`,
      jwks_uri: `${config.issuer}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    });
  });

  app.get('/.well-known/jwks.json', (_req, res) => {
    res.json({ keys: [keyPair.publicJwk] });
  });

  app.get('/register', (req, res) => {
    const next = localNext(req.query.next);
    const csrfToken = issueCsrf(req, res, config);
    res.send(
      renderPage(
        '注册账号',
        `<h1>注册账号</h1>
        ${req.query.error ? `<div class="error">${escapeHtml(req.query.error)}</div>` : ''}
        <form method="post" action="/register">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
          <input type="hidden" name="next" value="${escapeHtml(next)}" />
          <label>邮箱</label><input name="email" type="email" autocomplete="email" required />
          <label>姓名</label><input name="name" autocomplete="name" />
          <label>密码</label><input name="password" type="password" autocomplete="new-password" required />
          <button type="submit">注册并登录</button>
        </form>
        <p class="muted">已有账号？<a href="/login?next=${encodeURIComponent(next)}">登录</a></p>`,
      ),
    );
  });

  app.post('/register', authRateLimit, async (req, res) => {
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || '');
    const name = String(req.body.name || '').trim().slice(0, 80);
    const next = localNext(req.body.next);

    if (!isEmail(email)) return res.redirect(`/register?error=${encodeURIComponent('请输入有效邮箱')}&next=${encodeURIComponent(next)}`);
    if (password.length < 8) return res.redirect(`/register?error=${encodeURIComponent('密码至少 8 位')}&next=${encodeURIComponent(next)}`);
    if (repo.findUserByEmail(email)) return res.redirect(`/register?error=${encodeURIComponent('邮箱已注册')}&next=${encodeURIComponent(next)}`);

    const user = repo.createUser({ email, passwordHash: hashPassword(password), name });
    const verificationToken = repo.createEmailVerificationToken({ userId: user.id, email: user.email });
    await mailer.sendEmailVerification({
      to: user.email,
      verifyUrl: `${config.issuer}/verify-email?token=${encodeURIComponent(verificationToken)}`,
    });
    const session = repo.createSession(user.id);
    repo.markLogin(user.id);
    repo.writeAudit({ actorUserId: user.id, category: 'auth', action: 'register', status: 'success', ...requestMeta(req) });

    res.cookie(config.sessionCookieName, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secureCookies,
      maxAge: config.sessionTtlSeconds * 1000,
    });
    return res.redirect(next);
  });

  app.get('/verify-email', (req, res) => {
    const token = String(req.query.token || '');
    if (!repo.findEmailVerificationToken(token)) {
      return res.status(400).send(
        renderPage('邮箱验证失败', '<h1>邮箱验证失败</h1><p class="muted">验证链接无效或已过期。</p>'),
      );
    }
    const csrfToken = issueCsrf(req, res, config);
    return res.send(
      renderPage(
        '确认邮箱验证',
        `<h1>确认邮箱验证</h1>
        <p class="muted">点击按钮完成邮箱验证。</p>
        <form method="post" action="/verify-email">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
          <input type="hidden" name="token" value="${escapeHtml(token)}" />
          <button type="submit">验证邮箱</button>
        </form>`,
      ),
    );
  });

  app.post('/verify-email', authRateLimit, (req, res) => {
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const token = String(req.body.token || '');
    const record = repo.consumeEmailVerificationToken(token);
    if (!record) return res.status(400).json({ error: 'invalid_token' });
    repo.writeAudit({
      actorUserId: record.user_id,
      category: 'auth',
      action: 'email_verified',
      status: 'success',
      ...requestMeta(req),
    });
    return res.send(
      renderPage('邮箱已验证', '<h1>邮箱已验证</h1><p class="muted">你的邮箱已经完成验证。</p>'),
    );
  });

  app.get('/login', (req, res) => {
    const next = localNext(req.query.next);
    const csrfToken = issueCsrf(req, res, config);
    res.send(
      renderPage(
        '统一登录',
        `<h1>统一登录</h1>
        ${req.query.error ? `<div class="error">${escapeHtml(req.query.error)}</div>` : ''}
        <form method="post" action="/login">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
          <input type="hidden" name="next" value="${escapeHtml(next)}" />
          <label>邮箱</label><input name="email" type="email" autocomplete="email" required />
          <label>密码</label><input name="password" type="password" autocomplete="current-password" required />
          <button type="submit">登录</button>
        </form>
        <p class="muted">没有账号？<a href="/register?next=${encodeURIComponent(next)}">注册</a></p>`,
      ),
    );
  });

  app.post('/login', authRateLimit, (req, res) => {
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || '');
    const next = localNext(req.body.next);
    const user = repo.findUserByEmail(email);

    if (!user || user.status !== 'active' || !verifyPassword(password, user.password_hash)) {
      repo.writeAudit({ category: 'auth', action: 'login', status: 'failure', detail: { email }, ...requestMeta(req) });
      return res.redirect(`/login?error=${encodeURIComponent('邮箱或密码不正确')}&next=${encodeURIComponent(next)}`);
    }

    const session = repo.createSession(user.id);
    repo.markLogin(user.id);
    repo.writeAudit({ actorUserId: user.id, category: 'auth', action: 'login', status: 'success', ...requestMeta(req) });
    res.cookie(config.sessionCookieName, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secureCookies,
      maxAge: config.sessionTtlSeconds * 1000,
    });
    return res.redirect(next);
  });

  app.get('/forgot-password', (req, res) => {
    const csrfToken = issueCsrf(req, res, config);
    res.send(
      renderPage(
        '找回密码',
        `<h1>找回密码</h1>
        <form method="post" action="/forgot-password">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
          <label>邮箱</label><input name="email" type="email" autocomplete="email" required />
          <button type="submit">发送重置链接</button>
        </form>
        <p class="muted">如果邮箱存在，我们会发送密码重置链接。</p>`,
      ),
    );
  });

  app.post('/forgot-password', authRateLimit, async (req, res) => {
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const email = cleanEmail(req.body.email);
    const user = isEmail(email) ? repo.findUserByEmail(email) : null;

    if (user && user.status === 'active') {
      const token = repo.createPasswordResetToken({ userId: user.id, email: user.email });
      await mailer.sendPasswordReset({
        to: user.email,
        resetUrl: `${config.issuer}/reset-password?token=${encodeURIComponent(token)}`,
      });
      repo.writeAudit({
        actorUserId: user.id,
        category: 'auth',
        action: 'password_reset_requested',
        status: 'success',
        ...requestMeta(req),
      });
    } else {
      repo.writeAudit({
        category: 'auth',
        action: 'password_reset_requested',
        status: 'ignored',
        detail: { email },
        ...requestMeta(req),
      });
    }

    return res.send(
      renderPage('检查邮箱', '<h1>检查邮箱</h1><p class="muted">如果邮箱存在，密码重置链接已经发送。</p>'),
    );
  });

  app.get('/reset-password', (req, res) => {
    const token = String(req.query.token || '');
    const record = repo.findPasswordResetToken(token);
    if (!record) {
      return res.status(400).send(
        renderPage('重置链接无效', '<h1>重置链接无效</h1><p class="muted">链接无效或已过期。</p>'),
      );
    }
    const csrfToken = issueCsrf(req, res, config);
    return res.send(
      renderPage(
        '重置密码',
        `<h1>重置密码</h1>
        <form method="post" action="/reset-password">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
          <input type="hidden" name="token" value="${escapeHtml(token)}" />
          <label>新密码</label><input name="password" type="password" autocomplete="new-password" required />
          <button type="submit">更新密码</button>
        </form>`,
      ),
    );
  });

  app.post('/reset-password', authRateLimit, (req, res) => {
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (password.length < 8) {
      return res.redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent('密码至少 8 位')}`);
    }
    const record = repo.findPasswordResetToken(token);
    if (!record) return res.status(400).json({ error: 'invalid_token' });
    const consumed = repo.consumePasswordResetToken(record.tokenHash, hashPassword(password));
    if (!consumed) return res.status(400).json({ error: 'invalid_token' });
    repo.writeAudit({
      actorUserId: consumed.user_id,
      category: 'auth',
      action: 'password_reset_completed',
      status: 'success',
      ...requestMeta(req),
    });
    return res.send(
      renderPage('密码已更新', '<h1>密码已更新</h1><p class="muted">你现在可以使用新密码登录。</p>'),
    );
  });

  app.post('/logout', (req, res) => {
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    if (req.cookies?.[config.sessionCookieName]) repo.deleteSession(req.cookies[config.sessionCookieName]);
    res.clearCookie(config.sessionCookieName);
    res.json({ ok: true });
  });

  app.get('/oauth/authorize', (req, res) => {
    const parsed = validateAuthorizeRequest(req.query, repo);
    if (parsed.error) return res.status(400).json(parsed);

    const user = requireLogin(req, res, repo);
    if (!user) {
      return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    }

    const code = repo.createAuthCode({
      clientId: parsed.client.id,
      userId: user.id,
      redirectUri: parsed.redirectUri,
      scope: parsed.scope,
      nonce: parsed.nonce,
      codeChallenge: parsed.codeChallenge,
      codeChallengeMethod: parsed.codeChallengeMethod,
    });

    repo.writeAudit({
      actorUserId: user.id,
      clientId: parsed.client.id,
      category: 'oauth',
      action: 'authorize',
      status: 'success',
      detail: { scope: parsed.scope },
      ...requestMeta(req),
    });

    return res.redirect(appendRedirect(parsed.redirectUri, { code, state: parsed.state }));
  });

  app.post('/oauth/token', authRateLimit, (req, res) => {
    const grantType = String(req.body.grant_type || '');
    const basic = String(req.headers.authorization || '');
    let basicClientId = '';
    let basicSecret = '';
    if (basic.startsWith('Basic ')) {
      const decoded = Buffer.from(basic.slice('Basic '.length), 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      if (separator === -1) return res.status(401).json({ error: 'invalid_client' });
      basicClientId = decoded.slice(0, separator);
      basicSecret = decoded.slice(separator + 1);
    }

    const bodyClientId = String(req.body.client_id || '');
    if (basicClientId && bodyClientId && basicClientId !== bodyClientId) {
      return res.status(401).json({ error: 'invalid_client' });
    }

    const clientId = basicClientId || bodyClientId;
    const client = repo.findClient(clientId);
    if (!client) return res.status(401).json({ error: 'invalid_client' });

    if (client.type === 'confidential') {
      const secret = basicSecret || String(req.body.client_secret || '');
      if (!client.secret_hash || !timingSafeEqualString(hashSecret(secret), client.secret_hash)) {
        return res.status(401).json({ error: 'invalid_client' });
      }
    }

    if (grantType === 'authorization_code') {
      const record = repo.findAuthCode(String(req.body.code || ''));
      if (!record) return res.status(400).json({ error: 'invalid_grant' });
      if (record.client_id !== client.id) return res.status(400).json({ error: 'invalid_grant' });
      if (record.redirect_uri !== String(req.body.redirect_uri || '')) {
        return res.status(400).json({ error: 'invalid_grant' });
      }
      if (!verifyPkce(String(req.body.code_verifier || ''), record.code_challenge, record.code_challenge_method)) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
      }

      const user = repo.findUserById(record.user_id);
      if (!user || user.status !== 'active') return res.status(400).json({ error: 'invalid_grant' });
      if (!repo.consumeAuthCodeHash(record.codeHash)) {
        return res.status(400).json({ error: 'invalid_grant' });
      }
      const refreshToken = record.scope.split(/\s+/).includes('offline_access')
        ? repo.createRefreshToken({ clientId: client.id, userId: user.id, scope: record.scope })
        : null;
      return res.json(buildTokenSet({
        config,
        keyPair,
        clientId: client.id,
        user,
        scope: record.scope,
        nonce: record.nonce,
        refreshToken,
      }));
    }

    if (grantType === 'refresh_token') {
      const rotated = repo.rotateRefreshToken(String(req.body.refresh_token || ''), client.id);
      if (!rotated) {
        return res.status(400).json({ error: 'invalid_grant' });
      }
      const user = repo.findUserById(rotated.record.user_id);
      if (!user || user.status !== 'active') return res.status(400).json({ error: 'invalid_grant' });
      return res.json(buildTokenSet({
        config,
        keyPair,
        clientId: client.id,
        user,
        scope: rotated.record.scope,
        refreshToken: rotated.replacement,
      }));
    }

    return res.status(400).json({ error: 'unsupported_grant_type' });
  });

  app.get('/oauth/userinfo', (req, res) => {
    const claims = authenticateAccessToken(req, keyPair);
    if (!claims || claims.iss !== config.issuer) return res.status(401).json({ error: 'invalid_token' });
    const user = repo.findUserById(claims.sub);
    if (!user || user.status !== 'active') return res.status(401).json({ error: 'invalid_token' });
    const scopes = String(claims.scope || '').split(/\s+/);
    res.json({
      sub: user.id,
      ...(scopes.includes('email') ? { email: user.email, email_verified: Boolean(user.email_verified) } : {}),
      ...(scopes.includes('profile') ? { name: user.name || user.email } : {}),
    });
  });

  app.get('/', (req, res) => {
    const user = requireLogin(req, res, repo);
    res.send(
      renderPage(
        '账号中心',
        user
          ? `<h1>账号中心</h1><p class="muted">当前登录：${escapeHtml(user.email)}</p><form method="post" action="/logout"><input type="hidden" name="csrfToken" value="${escapeHtml(issueCsrf(req, res, config))}" /><button type="submit">退出登录</button></form>`
          : `<h1>账号中心</h1><p class="muted">统一管理账号、登录会话和 OAuth/OIDC 授权。</p><p><a href="/login">登录</a> · <a href="/register">注册</a></p>`,
      ),
    );
  });

  return app;
}
