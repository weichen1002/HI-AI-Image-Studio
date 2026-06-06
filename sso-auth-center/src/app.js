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

function cleanId(value) {
  return String(value || '').trim();
}

function textLines(value) {
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
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

function renderPage(title, body, options = {}) {
  const mainClass = options.wide ? ' class="wide"' : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #172026; }
    main { width: min(420px, calc(100vw - 32px)); margin: 72px auto; background: #fff; border: 1px solid #d9e0e7; border-radius: 8px; padding: 28px; box-shadow: 0 16px 48px rgba(23,32,38,.08); }
    main.wide { width: min(1120px, calc(100vw - 32px)); }
    h1 { margin: 0 0 18px; font-size: 24px; }
    h2 { margin: 28px 0 12px; font-size: 16px; }
    label { display: block; margin: 14px 0 6px; font-size: 13px; color: #52616d; }
    input, select, textarea { width: 100%; box-sizing: border-box; min-height: 40px; border: 1px solid #c9d2dc; border-radius: 6px; padding: 0 10px; font: inherit; }
    textarea { min-height: 86px; padding: 10px; resize: vertical; }
    button { width: 100%; margin-top: 18px; min-height: 42px; border: 0; border-radius: 6px; background: #116149; color: #fff; font-weight: 700; cursor: pointer; padding: 0 12px; }
    button.danger { background: #a51f1f; }
    button.secondary { background: #52616d; }
    a { color: #116149; }
    .muted { color: #64727f; font-size: 13px; line-height: 1.6; }
    .error { background: #fff0f0; color: #a51f1f; border: 1px solid #f1c7c7; padding: 10px; border-radius: 6px; font-size: 13px; }
    .notice { background: #eef8f4; color: #116149; border: 1px solid #b9dfd1; padding: 10px; border-radius: 6px; font-size: 13px; }
    .topnav { display: flex; flex-wrap: wrap; gap: 12px; margin: 0 0 22px; font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
    .panel { border: 1px solid #d9e0e7; border-radius: 8px; padding: 16px; background: #fbfcfd; }
    .metric { font-size: 28px; font-weight: 800; margin: 6px 0 0; }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: end; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; border-bottom: 1px solid #e6ebef; padding: 10px 8px; vertical-align: top; }
    th { color: #52616d; font-weight: 700; }
    code { background: #edf1f4; border-radius: 4px; padding: 2px 4px; }
    .inline-form { display: inline; }
    .inline-form button { width: auto; min-height: 32px; margin: 0; }
  </style>
</head>
<body><main${mainClass}>${body}</main></body>
</html>`;
}

function nav(user) {
  return `<div class="topnav">
    <a href="/">首页</a>
    <a href="/account">我的账号</a>
    ${user?.is_admin ? '<a href="/admin">管理控制台</a><a href="/admin/clients">应用接入</a><a href="/admin/audit">审计日志</a>' : ''}
  </div>`;
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

function requireAdmin(req, res, repo) {
  const user = requireLogin(req, res, repo);
  if (!user) {
    res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    return null;
  }
  if (!user.is_admin) {
    res.status(403).send(renderPage('无权访问', '<h1>无权访问</h1><p class="muted">需要管理员权限。</p>'));
    return null;
  }
  return user;
}

function auditRows(events) {
  return events.map((event) => {
    let detail = '';
    try {
      detail = JSON.stringify(JSON.parse(event.detail_json || '{}'));
    } catch {
      detail = event.detail_json || '{}';
    }
    return `<tr>
      <td>${escapeHtml(event.created_at)}</td>
      <td>${escapeHtml(event.category)} / ${escapeHtml(event.action)}</td>
      <td>${escapeHtml(event.status)}</td>
      <td>${escapeHtml(event.actor_user_id || '-')}</td>
      <td>${escapeHtml(event.client_id || '-')}</td>
      <td>${escapeHtml(event.ip || '-')}</td>
      <td><code>${escapeHtml(detail)}</code></td>
    </tr>`;
  }).join('');
}

function renderClientSecretPage(admin, client, secret) {
  return renderPage(
    'Client Secret',
    `${nav(admin)}
    <h1>Client Secret</h1>
    <div class="notice">Client secret 只显示这一次。</div>
    <div class="panel">
      <div class="muted">Client</div>
      <div><code>${escapeHtml(client.id)}</code> ${escapeHtml(client.name)}</div>
      <div class="muted" style="margin-top:12px;">Secret</div>
      <code>${escapeHtml(secret)}</code>
    </div>
    <p class="muted"><a href="/admin/clients">返回应用接入</a></p>`,
    { wide: true },
  );
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

  app.get('/account', (req, res) => {
    const user = requireLogin(req, res, repo);
    if (!user) return res.redirect(`/login?next=${encodeURIComponent('/account')}`);
    const csrfToken = issueCsrf(req, res, config);
    const sessions = repo.listUserSessions(user.id);
    const audits = repo.listAuditEvents({ userId: user.id, limit: 20 });

    return res.send(
      renderPage(
        '我的账号',
        `${nav(user)}
        <h1>我的账号</h1>
        ${req.query.saved ? '<div class="notice">已保存。</div>' : ''}
        ${req.query.error ? `<div class="error">${escapeHtml(req.query.error)}</div>` : ''}
        <div class="grid">
          <div class="panel"><div class="muted">邮箱</div><div>${escapeHtml(user.email)}</div></div>
          <div class="panel"><div class="muted">邮箱验证</div><div>${user.email_verified ? '已验证' : '未验证'}</div></div>
          <div class="panel"><div class="muted">账号状态</div><div>${escapeHtml(user.status)}</div></div>
          <div class="panel"><div class="muted">管理员</div><div>${user.is_admin ? '是' : '否'}</div></div>
        </div>

        <h2>资料</h2>
        <form method="post" action="/account/profile">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
          <label>姓名</label><input name="name" value="${escapeHtml(user.name || '')}" autocomplete="name" />
          <button type="submit">保存资料</button>
        </form>

        <h2>修改密码</h2>
        <form method="post" action="/account/password">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
          <label>当前密码</label><input name="currentPassword" type="password" autocomplete="current-password" required />
          <label>新密码</label><input name="newPassword" type="password" autocomplete="new-password" required />
          <button type="submit">更新密码</button>
        </form>

        <h2>登录会话</h2>
        <table>
          <thead><tr><th>创建时间</th><th>最后使用</th><th>过期时间</th></tr></thead>
          <tbody>${sessions.map((session) => `<tr><td>${escapeHtml(session.created_at)}</td><td>${escapeHtml(session.last_used_at)}</td><td>${escapeHtml(session.expires_at)}</td></tr>`).join('')}</tbody>
        </table>
        <form method="post" action="/account/logout-all">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
          <button class="danger" type="submit">退出所有设备</button>
        </form>

        <h2>最近账号事件</h2>
        <table>
          <thead><tr><th>时间</th><th>事件</th><th>状态</th><th>用户</th><th>Client</th><th>IP</th><th>详情</th></tr></thead>
          <tbody>${auditRows(audits)}</tbody>
        </table>`,
        { wide: true },
      ),
    );
  });

  app.post('/account/profile', (req, res) => {
    const user = requireLogin(req, res, repo);
    if (!user) return res.redirect(`/login?next=${encodeURIComponent('/account')}`);
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    repo.updateUserProfile(user.id, { name: req.body.name });
    repo.writeAudit({ actorUserId: user.id, category: 'account', action: 'profile_updated', status: 'success', ...requestMeta(req) });
    return res.redirect('/account?saved=1');
  });

  app.post('/account/password', (req, res) => {
    const user = requireLogin(req, res, repo);
    if (!user) return res.redirect(`/login?next=${encodeURIComponent('/account')}`);
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!verifyPassword(currentPassword, user.password_hash)) {
      return res.redirect(`/account?error=${encodeURIComponent('当前密码不正确')}`);
    }
    if (newPassword.length < 8) {
      return res.redirect(`/account?error=${encodeURIComponent('新密码至少 8 位')}`);
    }
    repo.updatePasswordHash(user.id, hashPassword(newPassword));
    repo.revokeUserRefreshTokens(user.id);
    repo.writeAudit({ actorUserId: user.id, category: 'account', action: 'password_changed', status: 'success', ...requestMeta(req) });
    return res.redirect('/account?saved=1');
  });

  app.post('/account/logout-all', (req, res) => {
    const user = requireLogin(req, res, repo);
    if (!user) return res.redirect(`/login?next=${encodeURIComponent('/account')}`);
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    repo.deleteUserSessions(user.id);
    repo.revokeUserRefreshTokens(user.id);
    repo.writeAudit({ actorUserId: user.id, category: 'account', action: 'logout_all', status: 'success', ...requestMeta(req) });
    res.clearCookie(config.sessionCookieName);
    return res.redirect('/login');
  });

  app.get('/admin', (req, res) => {
    const admin = requireAdmin(req, res, repo);
    if (!admin) return undefined;
    const users = repo.listUsers({ limit: 10 });
    const clients = repo.listClients().slice(0, 10);
    const audits = repo.listAuditEvents({ limit: 12 });
    return res.send(
      renderPage(
        '管理控制台',
        `${nav(admin)}
        <h1>管理控制台</h1>
        <div class="grid">
          <div class="panel"><div class="muted">用户</div><div class="metric">${repo.countUsers()}</div></div>
          <div class="panel"><div class="muted">Client</div><div class="metric">${repo.countClients()}</div></div>
          <div class="panel"><div class="muted">审计事件</div><div class="metric">${repo.countAuditEvents()}</div></div>
        </div>

        <h2>最近用户</h2>
        <table>
          <thead><tr><th>邮箱</th><th>状态</th><th>验证</th><th>管理员</th><th>操作</th></tr></thead>
          <tbody>${users.map((item) => `<tr><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.status)}</td><td>${item.email_verified ? '是' : '否'}</td><td>${item.is_admin ? '是' : '否'}</td><td><a href="/admin/users/${encodeURIComponent(item.id)}">详情</a></td></tr>`).join('')}</tbody>
        </table>
        <p class="muted"><a href="/admin/users">查看全部用户</a></p>

        <h2>应用接入</h2>
        <table>
          <thead><tr><th>ID</th><th>名称</th><th>类型</th><th>Scopes</th></tr></thead>
          <tbody>${clients.map((client) => `<tr><td><code>${escapeHtml(client.id)}</code></td><td>${escapeHtml(client.name)}</td><td>${escapeHtml(client.type)}</td><td>${escapeHtml(client.allowedScopes.join(' '))}</td></tr>`).join('')}</tbody>
        </table>

        <h2>最近审计</h2>
        <table>
          <thead><tr><th>时间</th><th>事件</th><th>状态</th><th>用户</th><th>Client</th><th>IP</th><th>详情</th></tr></thead>
          <tbody>${auditRows(audits)}</tbody>
        </table>`,
        { wide: true },
      ),
    );
  });

  app.get('/admin/users', (req, res) => {
    const admin = requireAdmin(req, res, repo);
    if (!admin) return undefined;
    const users = repo.listUsers({ limit: 200 });
    return res.send(
      renderPage(
        '用户管理',
        `${nav(admin)}
        <h1>用户管理</h1>
        <table>
          <thead><tr><th>邮箱</th><th>姓名</th><th>状态</th><th>验证</th><th>管理员</th><th>最后登录</th><th>操作</th></tr></thead>
          <tbody>${users.map((item) => `<tr><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.name || '-')}</td><td>${escapeHtml(item.status)}</td><td>${item.email_verified ? '是' : '否'}</td><td>${item.is_admin ? '是' : '否'}</td><td>${escapeHtml(item.last_login_at || '-')}</td><td><a href="/admin/users/${encodeURIComponent(item.id)}">详情</a></td></tr>`).join('')}</tbody>
        </table>`,
        { wide: true },
      ),
    );
  });

  app.get('/admin/users/:id', (req, res) => {
    const admin = requireAdmin(req, res, repo);
    if (!admin) return undefined;
    const target = repo.findUserById(req.params.id);
    if (!target) return res.status(404).send(renderPage('用户不存在', `${nav(admin)}<h1>用户不存在</h1>`));
    const csrfToken = issueCsrf(req, res, config);
    const sessions = repo.listUserSessions(target.id);
    const audits = repo.listAuditEvents({ userId: target.id, limit: 30 });
    return res.send(
      renderPage(
        '用户详情',
        `${nav(admin)}
        <h1>${escapeHtml(target.email)}</h1>
        ${req.query.saved ? '<div class="notice">已保存。</div>' : ''}
        ${req.query.error ? `<div class="error">${escapeHtml(req.query.error)}</div>` : ''}
        <div class="grid">
          <div class="panel"><div class="muted">用户 ID</div><code>${escapeHtml(target.id)}</code></div>
          <div class="panel"><div class="muted">状态</div>${escapeHtml(target.status)}</div>
          <div class="panel"><div class="muted">邮箱验证</div>${target.email_verified ? '已验证' : '未验证'}</div>
          <div class="panel"><div class="muted">管理员</div>${target.is_admin ? '是' : '否'}</div>
        </div>

        <h2>资料</h2>
        <form method="post" action="/admin/users/${encodeURIComponent(target.id)}/profile">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
          <label>姓名</label><input name="name" value="${escapeHtml(target.name || '')}" />
          <button type="submit">保存资料</button>
        </form>

        <h2>账号控制</h2>
        <div class="row">
          <form method="post" action="/admin/users/${encodeURIComponent(target.id)}/status">
            <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
            <label>状态</label>
            <select name="status"><option value="active" ${target.status === 'active' ? 'selected' : ''}>active</option><option value="banned" ${target.status === 'banned' ? 'selected' : ''}>banned</option></select>
            <button type="submit">更新状态</button>
          </form>
          <form method="post" action="/admin/users/${encodeURIComponent(target.id)}/email-verified">
            <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
            <label>邮箱验证</label>
            <select name="verified"><option value="1" ${target.email_verified ? 'selected' : ''}>已验证</option><option value="0" ${target.email_verified ? '' : 'selected'}>未验证</option></select>
            <button type="submit">更新验证</button>
          </form>
          <form method="post" action="/admin/users/${encodeURIComponent(target.id)}/admin">
            <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
            <label>管理员</label>
            <select name="isAdmin"><option value="1" ${target.is_admin ? 'selected' : ''}>是</option><option value="0" ${target.is_admin ? '' : 'selected'}>否</option></select>
            <button type="submit">更新管理员</button>
          </form>
        </div>
        <form method="post" action="/admin/users/${encodeURIComponent(target.id)}/revoke-sessions">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
          <button class="danger" type="submit">强制退出所有设备并撤销 refresh token</button>
        </form>

        <h2>会话</h2>
        <table>
          <thead><tr><th>创建时间</th><th>最后使用</th><th>过期时间</th></tr></thead>
          <tbody>${sessions.map((session) => `<tr><td>${escapeHtml(session.created_at)}</td><td>${escapeHtml(session.last_used_at)}</td><td>${escapeHtml(session.expires_at)}</td></tr>`).join('')}</tbody>
        </table>

        <h2>审计</h2>
        <table>
          <thead><tr><th>时间</th><th>事件</th><th>状态</th><th>用户</th><th>Client</th><th>IP</th><th>详情</th></tr></thead>
          <tbody>${auditRows(audits)}</tbody>
        </table>`,
        { wide: true },
      ),
    );
  });

  app.post('/admin/users/:id/profile', (req, res) => {
    const admin = requireAdmin(req, res, repo);
    if (!admin) return undefined;
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const target = repo.findUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'not_found' });
    repo.updateUserProfile(target.id, { name: req.body.name });
    repo.writeAudit({ actorUserId: admin.id, category: 'admin', action: 'user_profile_updated', status: 'success', detail: { targetUserId: target.id }, ...requestMeta(req) });
    return res.redirect(`/admin/users/${encodeURIComponent(target.id)}?saved=1`);
  });

  app.post('/admin/users/:id/status', (req, res) => {
    const admin = requireAdmin(req, res, repo);
    if (!admin) return undefined;
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const target = repo.findUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'not_found' });
    const status = String(req.body.status || 'active');
    if (target.id === admin.id && status !== 'active') {
      return res.redirect(`/admin/users/${encodeURIComponent(target.id)}?error=${encodeURIComponent('不能禁用当前管理员账号')}`);
    }
    repo.updateUserStatus(target.id, status);
    repo.writeAudit({ actorUserId: admin.id, category: 'admin', action: 'user_status_updated', status: 'success', detail: { targetUserId: target.id, status }, ...requestMeta(req) });
    return res.redirect(`/admin/users/${encodeURIComponent(target.id)}?saved=1`);
  });

  app.post('/admin/users/:id/email-verified', (req, res) => {
    const admin = requireAdmin(req, res, repo);
    if (!admin) return undefined;
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const target = repo.findUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'not_found' });
    const verified = String(req.body.verified || '') === '1';
    repo.setUserEmailVerified(target.id, verified);
    repo.writeAudit({ actorUserId: admin.id, category: 'admin', action: 'user_email_verified_updated', status: 'success', detail: { targetUserId: target.id, verified }, ...requestMeta(req) });
    return res.redirect(`/admin/users/${encodeURIComponent(target.id)}?saved=1`);
  });

  app.post('/admin/users/:id/admin', (req, res) => {
    const admin = requireAdmin(req, res, repo);
    if (!admin) return undefined;
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const target = repo.findUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'not_found' });
    const isAdmin = String(req.body.isAdmin || '') === '1';
    if (target.id === admin.id && !isAdmin) {
      return res.redirect(`/admin/users/${encodeURIComponent(target.id)}?error=${encodeURIComponent('不能移除当前管理员权限')}`);
    }
    repo.setUserAdmin(target.id, isAdmin);
    repo.writeAudit({ actorUserId: admin.id, category: 'admin', action: 'user_admin_updated', status: 'success', detail: { targetUserId: target.id, isAdmin }, ...requestMeta(req) });
    return res.redirect(`/admin/users/${encodeURIComponent(target.id)}?saved=1`);
  });

  app.post('/admin/users/:id/revoke-sessions', (req, res) => {
    const admin = requireAdmin(req, res, repo);
    if (!admin) return undefined;
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const target = repo.findUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'not_found' });
    repo.deleteUserSessions(target.id);
    repo.revokeUserRefreshTokens(target.id);
    repo.writeAudit({ actorUserId: admin.id, category: 'admin', action: 'user_sessions_revoked', status: 'success', detail: { targetUserId: target.id }, ...requestMeta(req) });
    if (target.id === admin.id) res.clearCookie(config.sessionCookieName);
    return target.id === admin.id
      ? res.redirect('/login')
      : res.redirect(`/admin/users/${encodeURIComponent(target.id)}?saved=1`);
  });

  app.get('/admin/clients', (req, res) => {
    const admin = requireAdmin(req, res, repo);
    if (!admin) return undefined;
    const csrfToken = issueCsrf(req, res, config);
    const clients = repo.listClients();
    return res.send(
      renderPage(
        '应用接入',
        `${nav(admin)}
        <h1>应用接入</h1>
        ${req.query.saved ? '<div class="notice">已保存。</div>' : ''}
        ${req.query.error ? `<div class="error">${escapeHtml(req.query.error)}</div>` : ''}

        <h2>创建 client</h2>
        <form method="post" action="/admin/clients">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
          <div class="row">
            <div><label>Client ID</label><input name="id" required /></div>
            <div><label>名称</label><input name="name" required /></div>
            <div><label>类型</label><select name="type"><option value="confidential">confidential</option><option value="public">public</option></select></div>
          </div>
          <label>Redirect URI，每行一个</label><textarea name="redirectUris" required></textarea>
          <label>Scopes</label><input name="allowedScopes" value="openid profile email offline_access" />
          <label><input style="width:auto; min-height:auto;" type="checkbox" name="trusted" value="1" /> trusted first-party client</label>
          <button type="submit">创建 client</button>
        </form>

        <h2>Client 列表</h2>
        <table>
          <thead><tr><th>ID</th><th>名称</th><th>类型</th><th>Redirect URIs</th><th>Scopes</th><th>操作</th></tr></thead>
          <tbody>${clients.map((client) => `<tr>
            <td><code>${escapeHtml(client.id)}</code></td>
            <td>${escapeHtml(client.name)}</td>
            <td>${escapeHtml(client.type)}${client.trusted ? ' / trusted' : ''}</td>
            <td>${client.redirectUris.map((uri) => `<div>${escapeHtml(uri)}</div>`).join('')}</td>
            <td>${escapeHtml(client.allowedScopes.join(' '))}</td>
            <td>
              ${client.type === 'confidential' ? `<form class="inline-form" method="post" action="/admin/clients/${encodeURIComponent(client.id)}/rotate-secret"><input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" /><button class="secondary" type="submit">轮换 secret</button></form>` : ''}
              <form class="inline-form" method="post" action="/admin/clients/${encodeURIComponent(client.id)}/delete"><input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" /><button class="danger" type="submit">删除</button></form>
            </td>
          </tr>`).join('')}</tbody>
        </table>`,
        { wide: true },
      ),
    );
  });

  app.post('/admin/clients', (req, res) => {
    const admin = requireAdmin(req, res, repo);
    if (!admin) return undefined;
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const id = cleanId(req.body.id);
    const name = String(req.body.name || '').trim().slice(0, 120);
    const type = String(req.body.type || 'public') === 'confidential' ? 'confidential' : 'public';
    const redirectUris = textLines(req.body.redirectUris);
    const allowedScopes = textLines(req.body.allowedScopes || 'openid profile email').join(' ');
    const secret = type === 'confidential' ? randomToken(32) : '';

    try {
      const client = repo.createClient({
        id,
        name,
        type,
        secret,
        redirectUris,
        allowedScopes,
        trusted: Boolean(req.body.trusted),
      });
      repo.writeAudit({ actorUserId: admin.id, clientId: client.id, category: 'admin', action: 'client_created', status: 'success', ...requestMeta(req) });
      if (secret) return res.send(renderClientSecretPage(admin, client, secret));
      return res.redirect('/admin/clients?saved=1');
    } catch (error) {
      return res.redirect(`/admin/clients?error=${encodeURIComponent(error.message)}`);
    }
  });

  app.post('/admin/clients/:id/rotate-secret', (req, res) => {
    const admin = requireAdmin(req, res, repo);
    if (!admin) return undefined;
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const secret = randomToken(32);
    const client = repo.rotateClientSecret(req.params.id, secret);
    if (!client) return res.redirect(`/admin/clients?error=${encodeURIComponent('client 不存在或不是 confidential 类型')}`);
    repo.writeAudit({ actorUserId: admin.id, clientId: client.id, category: 'admin', action: 'client_secret_rotated', status: 'success', ...requestMeta(req) });
    return res.send(renderClientSecretPage(admin, client, secret));
  });

  app.post('/admin/clients/:id/delete', (req, res) => {
    const admin = requireAdmin(req, res, repo);
    if (!admin) return undefined;
    if (!verifyCsrf(req)) return res.status(403).json({ error: 'invalid_csrf' });
    const clientId = req.params.id;
    if (clientId === 'demo-web' && config.seedDemoClient) {
      return res.redirect(`/admin/clients?error=${encodeURIComponent('开发 demo client 会在启动时自动 seed，生产环境请关闭 SEED_DEMO_CLIENT')}`);
    }
    const deleted = repo.deleteClient(clientId);
    repo.writeAudit({ actorUserId: admin.id, clientId, category: 'admin', action: 'client_deleted', status: deleted ? 'success' : 'ignored', ...requestMeta(req) });
    return res.redirect('/admin/clients?saved=1');
  });

  app.get('/admin/audit', (req, res) => {
    const admin = requireAdmin(req, res, repo);
    if (!admin) return undefined;
    const events = repo.listAuditEvents({ limit: 200 });
    return res.send(
      renderPage(
        '审计日志',
        `${nav(admin)}
        <h1>审计日志</h1>
        <table>
          <thead><tr><th>时间</th><th>事件</th><th>状态</th><th>用户</th><th>Client</th><th>IP</th><th>详情</th></tr></thead>
          <tbody>${auditRows(events)}</tbody>
        </table>`,
        { wide: true },
      ),
    );
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
