# N10.3 Parameterized Prompt Templates Review

## Completed

- Added `user_prompt_templates` SQLite table and migration version 19.
- Added `UserPromptTemplatesRepo` with per-user list/create/update/delete and explicit argument JSON persistence.
- Added authenticated `/api/templates/user` CRUD endpoints while keeping existing template favorites API behavior.
- Extended the inspiration template page with system/user source filters, user template creation, editing, deletion, explicit variable defaults/examples, and existing fill-arguments-to-workbench flow.
- Kept static system templates read-only and backward compatible with `{argument name="..." default="..."}` prompt parsing.

## Verification

- `npm run build` passed.
- `npm test --prefix server -- --runInBand server/src/db/repositories/user-prompt-templates.repo.spec.ts server/src/db/repositories/template-favorites.repo.spec.ts` passed.
- `npm test --prefix server -- --runInBand` passed: 24 suites / 94 tests.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## Notes

- User templates are scoped by authenticated user id; cross-user update/delete returns no match.
- User template favorite ids are prefixed with `user:` to avoid collisions with system template ids.
- No commit or archive was performed per user preference.
