import { URL } from 'node:url';
import { sha256, timingSafeEqualString } from './crypto-utils.js';
import { signJwt, verifyJwt } from './keys.js';

export const SUPPORTED_SCOPES = new Set(['openid', 'profile', 'email', 'offline_access']);

export function normalizeScope(scope) {
  const requested = String(scope || 'openid').split(/\s+/).filter(Boolean);
  const unique = [...new Set(requested)];
  if (!unique.includes('openid')) unique.unshift('openid');
  const unknown = unique.filter((item) => !SUPPORTED_SCOPES.has(item));
  if (unknown.length) return { error: 'invalid_scope', unknown };
  return { scope: unique.join(' ') };
}

export function validateAuthorizeRequest(query, repo) {
  const responseType = String(query.response_type || '');
  if (responseType !== 'code') return { error: 'unsupported_response_type' };

  const client = repo.findClient(String(query.client_id || ''));
  if (!client) return { error: 'invalid_client' };

  const redirectUri = String(query.redirect_uri || '');
  if (!client.redirectUris.includes(redirectUri)) return { error: 'invalid_redirect_uri' };

  const codeChallenge = String(query.code_challenge || '');
  const method = String(query.code_challenge_method || '');
  if (!codeChallenge) return { error: 'invalid_request', description: 'code_challenge is required' };
  if (method !== 'S256') {
    return { error: 'invalid_request', description: 'code_challenge_method must be S256' };
  }

  const normalized = normalizeScope(query.scope);
  if (normalized.error) return { error: normalized.error };
  const scope = normalized.scope;
  const rejected = scope.split(/\s+/).filter((item) => !client.allowedScopes.includes(item));
  if (rejected.length) return { error: 'invalid_scope' };

  return {
    client,
    redirectUri,
    scope,
    state: String(query.state || ''),
    nonce: String(query.nonce || ''),
    codeChallenge,
    codeChallengeMethod: method,
  };
}

export function appendRedirect(redirectUri, params) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export function verifyPkce(verifier, challenge, method) {
  if (method === 'S256') return timingSafeEqualString(sha256(verifier), challenge);
  return false;
}

export function buildTokenSet({ config, keyPair, clientId, user, scope, nonce, refreshToken }) {
  const now = Math.floor(Date.now() / 1000);
  const scopeList = String(scope || 'openid').split(/\s+/).filter(Boolean);

  const accessToken = signJwt(
    {
      iss: config.issuer,
      sub: user.id,
      aud: clientId,
      exp: now + config.accessTokenTtlSeconds,
      scope,
      typ: 'access_token',
    },
    keyPair,
  );

  const idToken = signJwt(
    {
      iss: config.issuer,
      sub: user.id,
      aud: clientId,
      exp: now + config.idTokenTtlSeconds,
      nonce: nonce || undefined,
      email: scopeList.includes('email') ? user.email : undefined,
      email_verified: scopeList.includes('email') ? Boolean(user.email_verified) : undefined,
      name: scopeList.includes('profile') ? user.name || user.email : undefined,
    },
    keyPair,
  );

  return {
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: config.accessTokenTtlSeconds,
    scope,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  };
}

export function authenticateAccessToken(req, keyPair) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  const claims = verifyJwt(header.slice('Bearer '.length), keyPair.publicKey);
  if (!claims || claims.typ !== 'access_token') return null;
  return claims;
}
