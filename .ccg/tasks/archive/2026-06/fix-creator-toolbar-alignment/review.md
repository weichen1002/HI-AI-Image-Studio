# Review

## Scope

- Updated `src/components/studio/TextCreatePanel.vue`.
- Updated `src/components/studio/DialoguePanel.vue`.
- Fixed prompt toolbar alignment, oversized more button, and dialogue composer footer wrapping.

## Verification

- Inspected `http://localhost:5171/studio` prompt toolbar with Playwright layout snapshots.
- Inspected `http://localhost:5171/studio/dialogue` composer footer with Playwright layout snapshots.
- `npm run build` passed.

## Notes

- Prompt count remains single-line.
- The more button is constrained to a 34px icon button.
- Dialogue settings wrap inside their own group instead of colliding with the submit area.
