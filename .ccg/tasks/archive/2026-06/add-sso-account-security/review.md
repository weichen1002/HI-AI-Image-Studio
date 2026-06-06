# Review

## Scope

Reviewed the account security slice for `sso-auth-center` only:

- Email verification token flow
- Password reset token flow
- Auth-sensitive endpoint rate limiting
- Documentation and protocol tests

User explicitly requested Codex-only work earlier in the thread, so this review is a Codex-only review rather than the CCG default dual-model review.

## Findings

### Critical

None.

### Warning

None blocking for this MVP slice.

### Info

- Email verification and password reset tokens are stored as hashes, expire, and are single-use.
- Password reset now invalidates existing account-center sessions and revokes the user's refresh tokens.
- Password reset response text is the same for existing and missing accounts, reducing direct account enumeration.
- Auth rate limiting is in-memory and single-process. This is documented as MVP-only and should move to Redis or another shared store before multi-instance deployment.
- `TRUST_PROXY` defaults to `false`, so forwarded IP headers are not trusted unless deployment explicitly enables proxy trust.

## Verification

- `npm test` in `sso-auth-center`: passed, 16 tests.
- `npm audit --audit-level=high` in `sso-auth-center`: passed, 0 vulnerabilities.
