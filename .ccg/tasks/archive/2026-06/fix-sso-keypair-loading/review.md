# Review: Fix SSO Keypair Loading

## Result

PASS.

## Root Cause

Node 24 treats a plain JWK object passed to `crypto.createPrivateKey()` / `crypto.createPublicKey()` as a key options object. The previous code passed `saved.privateJwk` directly, so existing `jwt-keypair.json` files failed on restart with `key.key` undefined.

## Fix

Use explicit JWK import options:

```js
crypto.createPrivateKey({ key: saved.privateJwk, format: 'jwk' })
crypto.createPublicKey({ key: saved.publicJwk, format: 'jwk' })
```

## Verification

- `npm test`: 21 passed.
- `npm run dev`: server reached `SSO auth center listening on http://localhost:4100`.
- `git diff --check -- sso-auth-center/src/keys.js sso-auth-center/test/oauth.test.js .ccg/tasks/fix-sso-keypair-loading`: passed.
