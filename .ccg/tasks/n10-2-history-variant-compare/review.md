# N10.2 Review

## Completed

- Added `ImagesRepo.listVariantsForImage` to query derived images by `source_image_id` with user isolation.
- Extended image detail payload with `sourceImage` and `variants`.
- Updated the images store to normalize `sourceImage` and `variants`.
- Added a variant comparison block to History Detail:
  - source image vs current image
  - prompt/parameter difference summary
  - derived variant list
  - continue-variant action
- Reloads detail data when navigating between history ids in the same component instance.

## Verification

- `npm test --prefix server -- --runInBand` passed: 23 suites, 92 tests.
- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## Notes

- Variants are based on `source_image_id`, which is the existing lineage field used by edit/variant flows.
- Old records without lineage still render normally and simply omit the comparison card.
- No commit or archive was performed per user preference.
