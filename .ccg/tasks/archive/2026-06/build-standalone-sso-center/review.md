# Review

## Scope

Created a standalone `sso-auth-center` project for a self-hosted SSO account center. The implementation is independent from the existing HI-Image-Studio app.

## Delivered

- Express + SQLite account center
- User registration and login
- HttpOnly server-side login session
- OIDC discovery
- JWKS
- OAuth2 authorization code flow
- PKCE verification
- RS256 access token and ID token
- Refresh token rotation
- UserInfo endpoint
- Client creation CLI
- `.env.example`
- README and full technical design
- Codex review fixes: CSRF protection, Basic auth compatibility, strict scope validation, S256-only PKCE, deferred auth-code consumption, client-bound transactional refresh token rotation, access-token-only UserInfo, and production-safe demo client seeding

## Verification

- `npm audit --audit-level=high`: passed, 0 vulnerabilities
- `npm test`: passed, 13 tests
- Runtime smoke test on `127.0.0.1:4111`: `/health` and `/.well-known/openid-configuration` returned expected JSON
- Codex review: initial review found CSRF and protocol compatibility issues; fixes were implemented and covered by regression tests
- Codex re-review: found mutation-order issues for authorization codes and refresh tokens; fixes were implemented and covered by regression tests

## Remaining Product Work

Before opening third-party access, add email verification, password reset, rate limiting, MFA, consent screen, key rotation, audit UI, client management UI, and user authorization revocation.
