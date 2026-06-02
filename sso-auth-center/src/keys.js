import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { jsonBase64url } from './crypto-utils.js';

export function loadOrCreateKeyPair(config) {
  fs.mkdirSync(path.dirname(config.keyFile), { recursive: true });

  if (fs.existsSync(config.keyFile)) {
    const saved = JSON.parse(fs.readFileSync(config.keyFile, 'utf8'));
    return {
      kid: saved.kid,
      privateKey: crypto.createPrivateKey(saved.privateJwk),
      publicKey: crypto.createPublicKey(saved.publicJwk),
      publicJwk: saved.publicJwk,
    };
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const kid = crypto.randomBytes(8).toString('hex');
  const publicJwk = publicKey.export({ format: 'jwk' });
  const privateJwk = privateKey.export({ format: 'jwk' });
  publicJwk.kid = kid;
  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';

  fs.writeFileSync(
    config.keyFile,
    JSON.stringify({ kid, publicJwk, privateJwk }, null, 2),
    { mode: 0o600 },
  );

  return { kid, privateKey, publicKey, publicJwk };
}

export function signJwt(payload, keyPair, options = {}) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: keyPair.kid,
  };
  const body = {
    iat: Math.floor(Date.now() / 1000),
    ...payload,
  };
  const unsigned = `${jsonBase64url(header)}.${jsonBase64url(body)}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), keyPair.privateKey);
  return `${unsigned}.${signature.toString('base64url')}`;
}

export function verifyJwt(token, publicKey) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const unsigned = `${header}.${payload}`;
  const ok = crypto.verify(
    'RSA-SHA256',
    Buffer.from(unsigned),
    publicKey,
    Buffer.from(signature, 'base64url'),
  );
  if (!ok) return null;
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
  return claims;
}
