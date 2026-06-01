# Split Dialogue Menu Review

## Scope

- Added `/studio/dialogue` route using the existing dialogue-capable `CreateView`.
- Added a dedicated left-sidebar menu entry labeled `对话创作`.
- Removed `对话创作` from the regular workspace mode switch on `/studio`.
- Kept legacy `?mode=dialogue` links compatible and redirected new continue-dialogue flows to `/studio/dialogue`.
- Added N13.1 planning for sidebar collapse and secondary menus in `docs/goal-mode-roadmap-next.md`.

## Verification

- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.
- Browser check passed: `http://127.0.0.1:5173/studio/dialogue` redirects to `/login?redirect=/studio/dialogue` when unauthenticated.

## Notes

- `/studio` now focuses on text-to-image, image-to-image, and tools.
- `/studio/dialogue` reuses the existing dialogue panel, session list, chain hydration, and submit flow.
- The main `/studio` nav link uses exact active matching so it does not stay highlighted on `/studio/dialogue`.
