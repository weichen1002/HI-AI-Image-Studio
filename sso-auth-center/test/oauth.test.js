import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import request from 'supertest';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function makeServer() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sso-auth-center-'));
  const config = loadConfig({
    issuer: 'http://localhost:4100',
    dataDir: tmp,
    dbFile: path.join(tmp, 'auth.db'),
    keyFile: path.join(tmp, 'jwt-keypair.json'),
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
