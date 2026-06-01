# History Cover Preview Priority Review

## Completed

- Updated history card cover selection to prefer generated result images before preview placeholders.
- Updated dialogue chain cover priority in frontend store and backend public chain payloads.
- Kept preview placeholders as fallback only when no real generated image exists.

## Verification

- `npm run build` passed.
- `npm test --prefix server -- --runInBand` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## Notes

- The download action still requires a real generated image and does not download placeholder previews.
- No commit or archive was performed per user preference.
