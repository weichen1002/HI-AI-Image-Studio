import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import request from 'supertest';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/crypto-utils.js';

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function makeServer(overrides = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sso-auth-center-'));
  const config = loadConfig({
    issuer: 'http://localhost:4100',
    dataDir: tmp,
    dbFile: path.join(tmp, 'auth.db'),
    keyFile: path.join(tmp, 'jwt-keypair.json'),
    ...overrides,
  });
  const app = createApp({ config });
  return { agent: request.agent(app), app, config, tmp };
}

async function csrfFrom(agent, path) {
  const page = await agent.get(path);
  assert.equal(page.status, 200);
  const match = page.text.match(/name="csrfToken" value="([^"]+)"/);
  assert.ok(match, `csrf token not found on ${path}`);
  return match[1];
}

function urlToken(url) {
  const parsed = new URL(url);
  return parsed.searchParams.get('token');
}

async function registerAndAuthorize(agent, overrides = {}) {
  const csrfToken = await csrfFrom(agent, `/register?next=${encodeURIComponent('/')}`);
  await agent
    .post('/register')
    .type('form')
    .send({
      csrfToken,
      email: overrides.email || `user-${crypto.randomUUID()}@example.com`,
      password: 'password123',
      name: overrides.name || 'Example User',
      next: '/',
    });

  const { verifier, challenge } = pkcePair();
  const authorize = await agent
    .get('/oauth/authorize')
    .query({
      response_type: 'code',
      client_id: overrides.clientId || 'demo-web',
      redirect_uri: overrides.redirectUri || 'http://localhost:4100/demo/callback',
      scope: overrides.scope || 'openid profile email offline_access',
      state: 'state-1',
      nonce: 'nonce-1',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

  return {
    verifier,
    authorize,
    code: new URL(authorize.headers.location).searchParams.get('code'),
  };
}

test('OIDC authorization code with PKCE issues tokens and userinfo', async () => {
  const { agent } = makeServer();
  const { authorize, code, verifier } = await registerAndAuthorize(agent, {
    email: 'user@example.com',
  });
  assert.equal(authorize.status, 302);

  const redirect = new URL(authorize.headers.location);
  assert.ok(code);
  assert.equal(redirect.searchParams.get('state'), 'state-1');

  const token = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('demo-web:demo-secret').toString('base64')}`)
    .send({
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:4100/demo/callback',
      code,
      code_verifier: verifier,
    });
  assert.equal(token.status, 200);
  assert.ok(token.body.access_token);
  assert.ok(token.body.id_token);
  assert.ok(token.body.refresh_token);

  const reused = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('demo-web:demo-secret').toString('base64')}`)
    .send({
      grant_type: 'authorization_code',
      client_id: 'demo-web',
      redirect_uri: 'http://localhost:4100/demo/callback',
      code,
      code_verifier: verifier,
    });
  assert.equal(reused.status, 400);
  assert.equal(reused.body.error, 'invalid_grant');

  const userinfo = await agent
    .get('/oauth/userinfo')
    .set('Authorization', `Bearer ${token.body.access_token}`);
  assert.equal(userinfo.status, 200);
  assert.equal(userinfo.body.email, 'user@example.com');
  assert.equal(userinfo.body.name, 'Example User');
  assert.ok(userinfo.body.sub.startsWith('usr_'));
});

test('refresh token rotates and old refresh token cannot be reused', async () => {
  const { agent } = makeServer();
  const { code, verifier } = await registerAndAuthorize(agent, {
    email: 'refresh@example.com',
  });

  const token = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('demo-web:demo-secret').toString('base64')}`)
    .send({
      grant_type: 'authorization_code',
      client_id: 'demo-web',
      redirect_uri: 'http://localhost:4100/demo/callback',
      code,
      code_verifier: verifier,
    });
  assert.equal(token.status, 200);

  const refreshed = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('demo-web:demo-secret').toString('base64')}`)
    .send({
      grant_type: 'refresh_token',
      client_id: 'demo-web',
      refresh_token: token.body.refresh_token,
    });
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.body.refresh_token);
  assert.notEqual(refreshed.body.refresh_token, token.body.refresh_token);

  const reused = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('demo-web:demo-secret').toString('base64')}`)
    .send({
      grant_type: 'refresh_token',
      client_id: 'demo-web',
      refresh_token: token.body.refresh_token,
    });
  assert.equal(reused.status, 400);
  assert.equal(reused.body.error, 'invalid_grant');
});

test('userinfo rejects ID tokens', async () => {
  const { agent } = makeServer();
  const { code, verifier } = await registerAndAuthorize(agent, {
    email: 'id-token@example.com',
  });

  const token = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('demo-web:demo-secret').toString('base64')}`)
    .send({
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:4100/demo/callback',
      code,
      code_verifier: verifier,
    });
  assert.equal(token.status, 200);

  const userinfo = await agent
    .get('/oauth/userinfo')
    .set('Authorization', `Bearer ${token.body.id_token}`);
  assert.equal(userinfo.status, 401);
  assert.equal(userinfo.body.error, 'invalid_token');
});

test('token endpoint rejects invalid PKCE verifier', async () => {
  const { agent } = makeServer();

  const csrfToken = await csrfFrom(agent, '/register');
  await agent
    .post('/register')
    .type('form')
    .send({
      csrfToken,
      email: 'pkce@example.com',
      password: 'password123',
      name: 'PKCE User',
      next: '/',
    });

  const { verifier, challenge } = pkcePair();
  const authorize = await agent
    .get('/oauth/authorize')
    .query({
      response_type: 'code',
      client_id: 'demo-web',
      redirect_uri: 'http://localhost:4100/demo/callback',
      scope: 'openid email',
      state: 'state-2',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

  const code = new URL(authorize.headers.location).searchParams.get('code');
  const token = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('demo-web:demo-secret').toString('base64')}`)
    .send({
      grant_type: 'authorization_code',
      client_id: 'demo-web',
      redirect_uri: 'http://localhost:4100/demo/callback',
      code,
      code_verifier: 'wrong-verifier',
    });

  assert.equal(token.status, 400);
  assert.equal(token.body.error, 'invalid_grant');

  const retried = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('demo-web:demo-secret').toString('base64')}`)
    .send({
      grant_type: 'authorization_code',
      client_id: 'demo-web',
      redirect_uri: 'http://localhost:4100/demo/callback',
      code,
      code_verifier: 'wrong-verifier',
    });
  assert.equal(retried.status, 400);
  assert.equal(retried.body.error, 'invalid_grant');

  const valid = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('demo-web:demo-secret').toString('base64')}`)
    .send({
      grant_type: 'authorization_code',
      client_id: 'demo-web',
      redirect_uri: 'http://localhost:4100/demo/callback',
      code,
      code_verifier: verifier,
    });
  assert.equal(valid.status, 200);
  assert.ok(valid.body.access_token);
});

test('discovery and JWKS endpoints expose OIDC metadata', async () => {
  const { agent } = makeServer();

  const discovery = await agent.get('/.well-known/openid-configuration');
  assert.equal(discovery.status, 200);
  assert.equal(discovery.body.issuer, 'http://localhost:4100');
  assert.equal(discovery.body.authorization_endpoint, 'http://localhost:4100/oauth/authorize');
  assert.ok(discovery.body.code_challenge_methods_supported.includes('S256'));
  assert.deepEqual(discovery.body.code_challenge_methods_supported, ['S256']);

  const jwks = await agent.get('/.well-known/jwks.json');
  assert.equal(jwks.status, 200);
  assert.equal(jwks.body.keys.length, 1);
  assert.equal(jwks.body.keys[0].alg, 'RS256');
});

test('authorize rejects redirect URIs outside the client allowlist', async () => {
  const { agent } = makeServer();
  const csrfToken = await csrfFrom(agent, '/register');
  await agent
    .post('/register')
    .type('form')
    .send({
      csrfToken,
      email: 'redirect@example.com',
      password: 'password123',
      name: 'Redirect User',
      next: '/',
    });

  const { challenge } = pkcePair();
  const authorize = await agent
    .get('/oauth/authorize')
    .query({
      response_type: 'code',
      client_id: 'demo-web',
      redirect_uri: 'https://evil.example.com/callback',
      scope: 'openid email',
      state: 'state-3',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

  assert.equal(authorize.status, 400);
  assert.equal(authorize.body.error, 'invalid_redirect_uri');
});

test('authorize rejects unknown scopes instead of silently dropping them', async () => {
  const { agent } = makeServer();
  await registerAndAuthorize(agent, { email: 'scope-user@example.com' });
  const { challenge } = pkcePair();

  const authorize = await agent
    .get('/oauth/authorize')
    .query({
      response_type: 'code',
      client_id: 'demo-web',
      redirect_uri: 'http://localhost:4100/demo/callback',
      scope: 'openid admin',
      state: 'state-scope',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

  assert.equal(authorize.status, 400);
  assert.equal(authorize.body.error, 'invalid_scope');
});

test('authorize requires PKCE S256', async () => {
  const { agent } = makeServer();
  await registerAndAuthorize(agent, { email: 'plain-user@example.com' });

  const authorize = await agent
    .get('/oauth/authorize')
    .query({
      response_type: 'code',
      client_id: 'demo-web',
      redirect_uri: 'http://localhost:4100/demo/callback',
      scope: 'openid email',
      state: 'state-plain',
      code_challenge: 'plain-verifier',
      code_challenge_method: 'plain',
    });

  assert.equal(authorize.status, 400);
  assert.equal(authorize.body.error, 'invalid_request');
});

test('public native client can exchange code without client secret', async () => {
  const { agent, app, config } = makeServer();
  const repo = app.locals.repo;
  repo.createClient({
    id: 'native-app',
    name: 'Native App',
    type: 'public',
    redirectUris: ['com.example.app:/oauth/callback'],
    allowedScopes: 'openid profile email offline_access',
  });

  const { code, verifier } = await registerAndAuthorize(agent, {
    email: 'native@example.com',
    clientId: 'native-app',
    redirectUri: 'com.example.app:/oauth/callback',
  });

  const token = await agent
    .post('/oauth/token')
    .type('form')
    .send({
      grant_type: 'authorization_code',
      client_id: 'native-app',
      redirect_uri: 'com.example.app:/oauth/callback',
      code,
      code_verifier: verifier,
    });

  assert.equal(token.status, 200);
  assert.ok(token.body.access_token);
  assert.equal(config.issuer, 'http://localhost:4100');
});

test('wrong client cannot revoke another client refresh token', async () => {
  const { agent, app } = makeServer();
  app.locals.repo.createClient({
    id: 'other-web',
    name: 'Other Web',
    type: 'confidential',
    secret: 'other-secret',
    redirectUris: ['http://localhost:4100/other/callback'],
    allowedScopes: 'openid profile email offline_access',
  });
  const { code, verifier } = await registerAndAuthorize(agent, {
    email: 'wrong-client-refresh@example.com',
  });

  const token = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('demo-web:demo-secret').toString('base64')}`)
    .send({
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:4100/demo/callback',
      code,
      code_verifier: verifier,
    });
  assert.equal(token.status, 200);

  const wrongClient = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('other-web:other-secret').toString('base64')}`)
    .send({
      grant_type: 'refresh_token',
      refresh_token: token.body.refresh_token,
    });
  assert.equal(wrongClient.status, 400);
  assert.equal(wrongClient.body.error, 'invalid_grant');

  const originalClient = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('demo-web:demo-secret').toString('base64')}`)
    .send({
      grant_type: 'refresh_token',
      refresh_token: token.body.refresh_token,
    });
  assert.equal(originalClient.status, 200);
  assert.ok(originalClient.body.refresh_token);
});

test('login next parameter is constrained to local paths', async () => {
  const { agent } = makeServer();
  const csrfToken = await csrfFrom(agent, '/register');
  const register = await agent
    .post('/register')
    .type('form')
    .send({
      csrfToken,
      email: 'next@example.com',
      password: 'password123',
      name: 'Next User',
      next: 'https://evil.example.com',
    });

  assert.equal(register.status, 302);
  assert.equal(register.headers.location, '/');
});

test('login, register, and logout require CSRF token', async () => {
  const { agent } = makeServer();

  const register = await agent
    .post('/register')
    .type('form')
    .send({
      email: 'csrf@example.com',
      password: 'password123',
      name: 'CSRF User',
      next: '/',
    });
  assert.equal(register.status, 403);
  assert.equal(register.body.error, 'invalid_csrf');

  const login = await agent
    .post('/login')
    .type('form')
    .send({
      email: 'csrf@example.com',
      password: 'password123',
      next: '/',
    });
  assert.equal(login.status, 403);
  assert.equal(login.body.error, 'invalid_csrf');

  const logout = await agent.post('/logout').send({});
  assert.equal(logout.status, 403);
  assert.equal(logout.body.error, 'invalid_csrf');
});

test('registration sends email verification link and token is single-use', async () => {
  const { agent, app } = makeServer();
  const csrfToken = await csrfFrom(agent, '/register');
  const logLines = [];
  const originalLog = console.log;
  console.log = (line) => logLines.push(String(line));
  let register;
  try {
    register = await agent
      .post('/register')
      .type('form')
      .send({
        csrfToken,
        email: 'verify@example.com',
        password: 'password123',
        name: 'Verify User',
        next: '/',
      });
  } finally {
    console.log = originalLog;
  }
  assert.equal(register.status, 302);

  const verificationEmail = app.locals.sentEmails.find((message) => message.type === 'email_verification');
  assert.equal(verificationEmail.to, 'verify@example.com');
  const token = urlToken(verificationEmail.verifyUrl);
  assert.ok(token?.startsWith('evf_'));
  assert.ok(logLines.some((line) => line.includes('token=%5Bredacted%5D')));
  assert.ok(logLines.every((line) => !line.includes(token)));

  let user = app.locals.repo.findUserByEmail('verify@example.com');
  assert.equal(user.email_verified, 0);

  const verifyPage = await agent.get('/verify-email').query({ token });
  assert.equal(verifyPage.status, 200);
  user = app.locals.repo.findUserByEmail('verify@example.com');
  assert.equal(user.email_verified, 0);

  const verifyCsrf = verifyPage.text.match(/name="csrfToken" value="([^"]+)"/)?.[1];
  assert.ok(verifyCsrf);
  const verified = await agent
    .post('/verify-email')
    .type('form')
    .send({ csrfToken: verifyCsrf, token });
  assert.equal(verified.status, 200);
  user = app.locals.repo.findUserByEmail('verify@example.com');
  assert.equal(user.email_verified, 1);

  const reused = await agent
    .post('/verify-email')
    .type('form')
    .send({ csrfToken: verifyCsrf, token });
  assert.equal(reused.status, 400);
});

test('forgot password hides account existence and reset token updates password once', async () => {
  const { agent, app } = makeServer();
  const registerCsrf = await csrfFrom(agent, '/register');
  await agent
    .post('/register')
    .type('form')
    .send({
      csrfToken: registerCsrf,
      email: 'reset@example.com',
      password: 'old-password',
      name: 'Reset User',
      next: '/',
    });

  const { verifier, challenge } = pkcePair();
  const authorize = await agent
    .get('/oauth/authorize')
    .query({
      response_type: 'code',
      client_id: 'demo-web',
      redirect_uri: 'http://localhost:4100/demo/callback',
      scope: 'openid profile email offline_access',
      state: 'reset-state',
      nonce: 'reset-nonce',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
  assert.equal(authorize.status, 302);
  const code = new URL(authorize.headers.location).searchParams.get('code');
  const token = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('demo-web:demo-secret').toString('base64')}`)
    .send({
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:4100/demo/callback',
      code,
      code_verifier: verifier,
    });
  assert.equal(token.status, 200);
  assert.ok(token.body.refresh_token);

  const missingCsrf = await csrfFrom(agent, '/forgot-password');
  const missing = await agent
    .post('/forgot-password')
    .type('form')
    .send({ csrfToken: missingCsrf, email: 'missing@example.com' });
  assert.equal(missing.status, 200);
  assert.equal(app.locals.sentEmails.filter((message) => message.type === 'password_reset').length, 0);

  const forgotCsrf = await csrfFrom(agent, '/forgot-password');
  const forgot = await agent
    .post('/forgot-password')
    .type('form')
    .send({ csrfToken: forgotCsrf, email: 'reset@example.com' });
  assert.equal(forgot.status, 200);

  const resetEmail = app.locals.sentEmails.find((message) => message.type === 'password_reset');
  assert.equal(resetEmail.to, 'reset@example.com');
  const resetToken = urlToken(resetEmail.resetUrl);
  assert.ok(resetToken?.startsWith('rst_'));

  const resetPageCsrf = await csrfFrom(agent, `/reset-password?token=${encodeURIComponent(resetToken)}`);
  const reset = await agent
    .post('/reset-password')
    .type('form')
    .send({ csrfToken: resetPageCsrf, token: resetToken, password: 'new-password' });
  assert.equal(reset.status, 200);

  const reused = await agent
    .post('/reset-password')
    .type('form')
    .send({ csrfToken: resetPageCsrf, token: resetToken, password: 'another-password' });
  assert.equal(reused.status, 400);
  assert.equal(reused.body.error, 'invalid_token');

  const refreshedAfterReset = await agent
    .post('/oauth/token')
    .type('form')
    .set('Authorization', `Basic ${Buffer.from('demo-web:demo-secret').toString('base64')}`)
    .send({
      grant_type: 'refresh_token',
      refresh_token: token.body.refresh_token,
    });
  assert.equal(refreshedAfterReset.status, 400);
  assert.equal(refreshedAfterReset.body.error, 'invalid_grant');

  const loginCsrf = await csrfFrom(agent, '/login');
  const oldLogin = await agent
    .post('/login')
    .type('form')
    .send({
      csrfToken: loginCsrf,
      email: 'reset@example.com',
      password: 'old-password',
      next: '/',
    });
  assert.equal(oldLogin.status, 302);
  assert.match(oldLogin.headers.location, /^\/login\?error=/);

  const newLoginCsrf = await csrfFrom(agent, '/login');
  const newLogin = await agent
    .post('/login')
    .type('form')
    .send({
      csrfToken: newLoginCsrf,
      email: 'reset@example.com',
      password: 'new-password',
      next: '/',
    });
  assert.equal(newLogin.status, 302);
  assert.equal(newLogin.headers.location, '/');
});

test('auth-sensitive endpoints are rate limited', async () => {
  const { agent } = makeServer({
    authRateLimitWindowSeconds: 60,
    authRateLimitMax: 1,
    authRateLimitMaxBuckets: 2,
  });
  const first = await agent
    .post('/login')
    .set('X-Forwarded-For', '203.0.113.10')
    .type('form')
    .send({ email: 'rate@example.com', password: 'password123', next: '/' });
  assert.equal(first.status, 403);
  assert.equal(first.body.error, 'invalid_csrf');
  assert.equal(first.headers['ratelimit-limit'], '1');

  const second = await agent
    .post('/login')
    .set('X-Forwarded-For', '203.0.113.10')
    .type('form')
    .send({ email: 'rate@example.com', password: 'password123', next: '/' });
  assert.equal(second.status, 429);
  assert.equal(second.body.error, 'rate_limited');
});

test('account center lets a user update profile and password', async () => {
  const { agent, app } = makeServer();
  const registerCsrf = await csrfFrom(agent, '/register');
  await agent
    .post('/register')
    .type('form')
    .send({
      csrfToken: registerCsrf,
      email: 'account@example.com',
      password: 'old-password',
      name: 'Old Name',
      next: '/',
    });

  const accountPage = await agent.get('/account');
  assert.equal(accountPage.status, 200);
  const csrfToken = accountPage.text.match(/name="csrfToken" value="([^"]+)"/)?.[1];
  assert.ok(csrfToken);

  const profile = await agent
    .post('/account/profile')
    .type('form')
    .send({ csrfToken, name: 'New Name' });
  assert.equal(profile.status, 302);
  assert.equal(app.locals.repo.findUserByEmail('account@example.com').name, 'New Name');

  const password = await agent
    .post('/account/password')
    .type('form')
    .send({
      csrfToken,
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });
  assert.equal(password.status, 302);

  const logoutCsrf = await csrfFrom(agent, '/account');
  await agent.post('/logout').type('form').send({ csrfToken: logoutCsrf });

  const loginCsrf = await csrfFrom(agent, '/login');
  const login = await agent
    .post('/login')
    .type('form')
    .send({
      csrfToken: loginCsrf,
      email: 'account@example.com',
      password: 'new-password',
      next: '/account',
    });
  assert.equal(login.status, 302);
  assert.equal(login.headers.location, '/account');
});

test('admin control center requires admin and can manage users and clients', async () => {
  const { agent, app } = makeServer({ adminEmails: ['admin@example.com'] });
  const repo = app.locals.repo;
  const registerCsrf = await csrfFrom(agent, '/register');
  await agent
    .post('/register')
    .type('form')
    .send({
      csrfToken: registerCsrf,
      email: 'admin@example.com',
      password: 'admin-password',
      name: 'Admin User',
      next: '/',
    });

  const user = repo.createUser({
    email: 'managed@example.com',
    passwordHash: hashPassword('managed-password'),
    name: 'Managed User',
  });
  const userSession = repo.createSession(user.id);
  assert.ok(repo.findSession(userSession.id));

  const adminPage = await agent.get('/admin');
  assert.equal(adminPage.status, 200);
  assert.match(adminPage.text, /管理控制台/);

  const userPage = await agent.get(`/admin/users/${encodeURIComponent(user.id)}`);
  assert.equal(userPage.status, 200);
  const csrfToken = userPage.text.match(/name="csrfToken" value="([^"]+)"/)?.[1];
  assert.ok(csrfToken);

  const ban = await agent
    .post(`/admin/users/${encodeURIComponent(user.id)}/status`)
    .type('form')
    .send({ csrfToken, status: 'banned' });
  assert.equal(ban.status, 302);
  assert.equal(repo.findUserById(user.id).status, 'banned');
  assert.equal(repo.findSession(userSession.id), null);

  const createClient = await agent
    .post('/admin/clients')
    .type('form')
    .send({
      csrfToken,
      id: 'review-web',
      name: 'Review Web',
      type: 'confidential',
      redirectUris: 'https://review.example.com/callback',
      allowedScopes: 'openid email',
      trusted: '1',
    });
  assert.equal(createClient.status, 200);
  assert.match(createClient.text, /Client secret 只显示这一次/);
  assert.equal(createClient.headers.location, undefined);
  const client = repo.findClient('review-web');
  assert.equal(client.name, 'Review Web');
  assert.deepEqual(client.redirectUris, ['https://review.example.com/callback']);

  const audit = await agent.get('/admin/audit');
  assert.equal(audit.status, 200);
  assert.match(audit.text, /client_created/);
});

test('admin client creation rejects unsafe client ids and redirect URIs', async () => {
  const { agent, app } = makeServer({ adminEmails: ['admin@example.com'] });
  const registerCsrf = await csrfFrom(agent, '/register');
  await agent
    .post('/register')
    .type('form')
    .send({
      csrfToken: registerCsrf,
      email: 'admin@example.com',
      password: 'admin-password',
      name: 'Admin User',
      next: '/',
    });

  const clientsPage = await agent.get('/admin/clients');
  assert.equal(clientsPage.status, 200);
  const csrfToken = clientsPage.text.match(/name="csrfToken" value="([^"]+)"/)?.[1];
  assert.ok(csrfToken);

  const longId = 'client'.repeat(20);
  const invalidId = await agent
    .post('/admin/clients')
    .type('form')
    .send({
      csrfToken,
      id: longId,
      name: 'Too Long',
      type: 'public',
      redirectUris: 'https://safe.example.com/callback',
      allowedScopes: 'openid email',
    });
  assert.equal(invalidId.status, 302);
  assert.match(invalidId.headers.location, /client%20id%20must/);
  assert.equal(app.locals.repo.findClient(longId.slice(0, 80)), null);

  const unsafeRedirect = await agent
    .post('/admin/clients')
    .type('form')
    .send({
      csrfToken,
      id: 'unsafe-redirect',
      name: 'Unsafe Redirect',
      type: 'public',
      redirectUris: 'javascript:alert(1)',
      allowedScopes: 'openid email',
    });
  assert.equal(unsafeRedirect.status, 302);
  assert.match(unsafeRedirect.headers.location, /redirect%20URI%20must/);
  assert.equal(app.locals.repo.findClient('unsafe-redirect'), null);

  const nativeRedirect = await agent
    .post('/admin/clients')
    .type('form')
    .send({
      csrfToken,
      id: 'native-review',
      name: 'Native Review',
      type: 'public',
      redirectUris: 'com.example.app:/oauth/callback',
      allowedScopes: 'openid email',
    });
  assert.equal(nativeRedirect.status, 302);
  assert.equal(app.locals.repo.findClient('native-review').redirectUris[0], 'com.example.app:/oauth/callback');
});

test('non-admin users cannot access admin control center', async () => {
  const { agent } = makeServer({ adminEmails: ['admin@example.com'] });
  const registerCsrf = await csrfFrom(agent, '/register');
  await agent
    .post('/register')
    .type('form')
    .send({
      csrfToken: registerCsrf,
      email: 'regular@example.com',
      password: 'password123',
      name: 'Regular User',
      next: '/',
    });

  const admin = await agent.get('/admin');
  assert.equal(admin.status, 403);
});

test('production-safe config can disable demo client seeding', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sso-auth-center-prod-'));
  const config = loadConfig({
    issuer: 'https://accounts.example.com',
    dataDir: tmp,
    dbFile: path.join(tmp, 'auth.db'),
    keyFile: path.join(tmp, 'jwt-keypair.json'),
    seedDemoClient: false,
  });
  const app = createApp({ config });
  assert.equal(app.locals.repo.findClient('demo-web'), null);
});
