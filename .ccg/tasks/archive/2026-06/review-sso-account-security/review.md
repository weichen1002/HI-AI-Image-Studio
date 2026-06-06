# Review

## Scope

Reviewed the recent `sso-auth-center` account security implementation and fixed issues found in the review.

## Findings And Fixes

### Medium

- Email verification used `GET /verify-email` to consume the token. Some email clients and security gateways prefetch links, which could verify an address without user intent. Fixed by making `GET /verify-email` render a confirmation form and moving token consumption to CSRF-protected `POST /verify-email`.
- Development mailer logged full verification and password reset URLs, including bearer-like one-time token values. Fixed console output to redact the `token` query parameter while keeping full URLs in `app.locals.sentEmails` for tests and local development.

### Low

- Confidential client secret comparison used plain string equality over SHA-256 hashes. Fixed by using the existing timing-safe string helper.
- In-memory rate limiter did not cap bucket cardinality. Fixed by adding expired-bucket pruning and `AUTH_RATE_LIMIT_MAX_BUCKETS`.

## Verification

- `npm test` in `sso-auth-center`: passed, 16 tests.
- `npm audit --audit-level=high` in `sso-auth-center`: passed, 0 vulnerabilities.
- `git diff --check -- sso-auth-center .ccg/tasks/review-sso-account-security`: passed.

## Notes

This review was Codex-only to honor the user's earlier "只用 codex" preference.
