# Review

## Scope

- Updated `src/App.vue` only.
- Goal: make route-transition loading feel lighter and less like a system boot screen.

## Verification

- `npm run build` passed.

## Notes

- Route transition overlay now uses shorter, quieter copy.
- Delayed the large overlay so quick page hops only show the thin progress bar.
- Kept the initialization screen separate from route switching.
