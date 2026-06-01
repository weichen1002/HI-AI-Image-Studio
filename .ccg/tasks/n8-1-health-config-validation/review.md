# N8.1 Health And Config Validation Review

## Scope

- Added startup config validation helpers in `server/src/config/index.ts`.
- Added `HealthModule` with `GET /api/health` and `GET /api/health/deep`.
- Deep health checks SQLite queryability, database directory writability, uploads directory writability, config readiness, and HiAPI key presence.
- Wired production startup validation into `server/src/main.ts`.

## Verification

- `npm test --prefix server -- --runInBand src/config/index.spec.ts src/health/health.controller.spec.ts` passed.
- `npm run build --prefix server` passed.
- `npm test --prefix server -- --runInBand` passed: 21 suites / 77 tests.
- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## Notes

- `/api/health` and `/api/health/deep` return configured/missing booleans only; secret values are not exposed.
- Production requires `SESSION_SECRET`, `ADMIN_TOKEN`, `BILLING_WEBHOOK_SECRET`, and `HIAPI_API_KEY`.
- Local development remains permissive and reports missing optional secrets as warnings.
- A sandboxed `npm start` failed with `EPERM` on port binding; an escalated temporary run on port `3100` started successfully and registered both health routes. The temporary process was stopped.
