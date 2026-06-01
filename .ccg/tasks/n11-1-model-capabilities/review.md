# N11.1 Model Capabilities Review

## Completed

- Added a centralized model capability definition in `server/src/hiapi/model-capabilities.ts`.
- Added public `GET /api/hiapi/capabilities` for the studio frontend to load supported generation/edit options.
- Added server-side capability guards for text generation, image generation, dialogue generation, and image editing requests.
- Included model capabilities in admin settings bootstrap so the model settings page can display current supported features.
- Added a frontend model capabilities store and updated generation options to filter ratios, quality tiers, counts, formats, backgrounds, and moderation levels from server capabilities.
- Updated the admin model settings tab to show current model capability status and supported option sets.

## Verification

- `npm test --prefix server -- --runInBand server/src/hiapi/hiapi.controller.spec.ts server/src/hiapi/model-capabilities.spec.ts` passed.
- `npm test --prefix server -- --runInBand` passed: 26 suites / 100 tests.
- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## Notes

- Defaults intentionally match the existing UI options, so this change centralizes and enforces current behavior without removing existing capabilities.
- The worktree contains many unrelated in-progress roadmap changes; no commit or archive was performed per user preference.
