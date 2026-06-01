# N11.2 Prompt Quality Assist Review

## Completed

- Added a free, rule-based prompt quality checker in `server/src/prompts/prompt-quality.ts`.
- Added `POST /api/prompts/check` returning score, issues, suggestions, improved prompt draft, and billing policy.
- Kept checking non-blocking: it does not charge credits, does not call upstream, does not prevent generation, and never overwrites the prompt automatically.
- Added prompt quality UI to text creation and dialogue creation surfaces.
- Added manual "应用建议" action so users can choose whether to replace the current prompt.
- Clears stale check results when users edit the prompt or apply enhanced/suggested text.

## Verification

- `npm test --prefix server -- --runInBand server/src/prompts/prompt-quality.spec.ts server/src/prompts/prompts.controller.spec.ts` passed.
- `npm test --prefix server -- --runInBand` passed: 27 suites / 104 tests.
- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## Notes

- The billing policy is explicitly returned as free rule checking. Existing paid prompt enhance/describe behavior is unchanged.
- No commit or archive was performed per user preference.
