# Review

## Status

Passed.

## Checks

- `npm test --prefix server -- --runInBand`
- `npm run build`
- `npm run smoke:frontend`
- `git diff --check`

## Notes

- Added `GET /api/admin/dashboard` with 24h / 7d / 30d bounded aggregation.
- Dashboard covers users, generation jobs, credits, orders, failed job reasons, and low-score feedback reasons.
- Added admin dashboard route, sidebar entry, and responsive overview UI.
