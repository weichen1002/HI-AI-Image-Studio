# Fix Studio Page Layout Issues Review

## Scope

- Fixed the blank dialogue creation page.
- Made Billing Center and Task Center use the full content width.
- Merged profile information into Settings as "账户与偏好".
- Kept `/studio/profile` as a redirect to `/studio/settings`.

## Root Cause

- `CreateView.vue` used `<DialoguePanel>` in the template without importing the component, so Vue rendered an inert `<dialoguepanel>` custom element.
- `CreateView.vue` also referenced `routeMode` from `finally` while it was scoped inside `try`; this was fixed at the same time.
- Billing and task pages had page-level max-width plus centered margins.
- Profile and Settings duplicated account state, so the account data now lives in Settings.

## Verification

- `npm run build` passed.
- `npm run smoke:frontend` passed: 63 assets checked.
- `npm test --prefix server -- --runInBand` passed: 23 suites, 90 tests.
- `git diff --check` passed.
- Browser check with a temporary SQLite user confirmed:
  - `/studio/dialogue` renders `.dialogue-workspace` and no longer renders unknown `<dialoguepanel>`.
  - `/studio/billing` content width matches the page shell width.
  - `/studio/tasks` content width matches the page shell width.
  - `/studio/settings` includes account data and preferences.
  - `/studio/profile` redirects to `/studio/settings`.

## Notes

- Task was not archived and no git commit was created because the user requested no submit/commit.
