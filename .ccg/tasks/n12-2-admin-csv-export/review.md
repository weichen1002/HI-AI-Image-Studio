# Review

## Status

Passed.

## Checks

- `npm test --prefix server -- --runInBand`
- `npm run build`
- `npm run smoke:frontend`
- `git diff --check`

## Notes

- Added CSV export endpoints for users, billing orders, credit ledger, and audit logs.
- Exports reuse current list filters, cap output at 1000 rows, mask IDs, and omit high-sensitive fields.
- CSV values are escaped and guarded against spreadsheet formula injection.
- Added export buttons to the corresponding admin list pages.
