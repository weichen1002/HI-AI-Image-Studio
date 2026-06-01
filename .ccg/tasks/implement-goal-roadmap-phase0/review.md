# Review

## Completed scope

- G0.1: README now points to `docs/goal-mode-roadmap.md`.
- G0.2: Added backend mock coverage for text-to-image, image-to-image, dialogue, and edit/tool generation paths.
- G0.3: Added `npm run smoke:frontend` build artifact smoke checks.
- G1.1: Added `image_jobs` persistence, repository, service, and generation status recording.
- G1.2: Extracted text-to-image workflow.
- G1.3: Extracted image-to-image and edit/tool workflows.
- G1.4: Extracted dialogue generation workflow, including chain/message selection, previous response handling, input image resolution, billing/refund lifecycle, result persistence, and job status updates.
- G2.1: Moved image favorites to server-side persistence with `favorite_at`, API updates, old local favorite import, and server-side favorite pagination/filtering.
- G2.2: Moved template favorites to server-side persistence with a dedicated API, repository tests, login-time sync, and local fallback for anonymous use.
- G2.3: Added server-side dialogue chain aggregation with first/last images, round counts, updated time, and CreateView sidebar integration.
- G2.4: Added generated image preview references, lightweight SVG preview asset creation, API/store preview fields, history list preview rendering, original-image detail/download fallback, and preview file cleanup.
- G3.1: Extracted generation options, route option hydration, format/background compatibility rules, preview ratio, and advanced summary into `useGenerationOptions`.
- G3.2: Extracted `TextCreatePanel` and `ImageReferencePanel` from `CreateView`, keeping submission and mode orchestration in the parent.
- G3.3: Extracted `DialoguePanel` from `CreateView`, keeping dialogue state, chain loading, and submission orchestration in the parent.
- G3.4: Extracted `ToolPanel` from `CreateView`, keeping tool source state, editor launch, and submit orchestration in the parent.
- G4.1: Moved SQLite schema setup and field backfills behind `runSqliteMigrations`, with migration runner tests for empty DBs, legacy field backfills, and idempotent version recording.
- G4.2: Unified the remaining backend pagination gap by moving redeem code admin status filtering and paging into SQL; tightened audit log and redeem code admin page pagination reset/overflow behavior.
- G4.3: Added confirmations for high-risk admin actions and expanded audit details for user role/status/delete/credit adjustment and redeem code update/enable/disable flows.

## Verification

- `npm test --prefix server -- --runInBand` passed.
- `npm run build --prefix server` passed.
- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## G2.1 verification

- `npm test --prefix server -- --runInBand` passed.
- `npm run build --prefix server` passed.
- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## G2.2 verification

- `npm test --prefix server -- --runInBand` passed.
- `npm run build --prefix server` passed.
- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## G2.3 verification

- `npm test --prefix server -- --runInBand` passed.
- `npm run build --prefix server` passed.
- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## G2.4 verification

- `npm test --prefix server -- --runInBand` passed.
- `npm run build --prefix server` passed.
- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## G3.1 verification

- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## G3.2 verification

- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.
- Browser opened `http://127.0.0.1:5171/studio` and reached the expected login guard (`/login?redirect=/studio`); authenticated workspace switching still needs a logged-in session for manual verification.

## G3.3 verification

- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## G3.4 verification

- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## G4.1 verification

- `npm test --prefix server -- --runInBand` passed.
- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## G4.2 verification

- `npm test --prefix server -- --runInBand` passed.
- `npm test --prefix server -- --runInBand src/db/repositories/redeem-codes.repo.spec.ts` passed.
- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## G4.3 verification

- `npm test --prefix server -- --runInBand src/admin/admin.controller.spec.ts src/redeem-codes/admin-redeem-codes.controller.spec.ts` passed.
- `npm test --prefix server -- --runInBand` passed.
- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.

## Notes

- No commit was created per user request.
- External Claude/Gemini review was intentionally skipped per user request to use Codex only.
- G2.4 uses lightweight SVG preview assets because no portable raster thumbnail dependency is present; old records without previews fall back to original image URLs.
- Next roadmap target: G5.1 orders and packages data model.

## G5.2 verification

- `npm run build` passed after the final BillingView pagination cleanup.
- `npm run smoke:frontend` passed (58 assets checked).
- `git diff --check` passed.
- New files: `src/stores/billing.js`, `src/views/studio/BillingView.vue`.
- Updated: `src/router/index.js` (added `/studio/billing` route), `src/views/studio/ProfileView.vue` (added 充值 button linking to billing page), `src/views/StudioView.vue` (added sidebar entry, route title, and route description).
- BillingView uses the shared `Pagination` component and refreshes the order list after creating an order.
- No payment integration; orders are created in `pending` state only.

## G5.3 partial verification

- Implemented the payment-channel-independent path: admin manual order completion, order-to-ledger linking, idempotent repeated completion handling, missing-user rejection, and admin audit details.
- Added admin billing orders view at `/studio/admin/billing-orders` with user/status filters, pagination, pending-only manual completion, and refreshed order state.
- `npm test --prefix server -- --runInBand src/billing/billing.service.spec.ts src/billing/billing.controller.spec.ts src/billing/billing.repo.spec.ts` passed.
- `npm test --prefix server -- --runInBand` passed (15 suites / 49 tests).
- `npm run build --prefix server` passed.
- `npm run build` passed.
- `npm run smoke:frontend` passed (60 assets checked).
- `git diff --check` passed.
- Real third-party payment callback/signature verification remains intentionally unimplemented because the roadmap marks G5.3 as dependent on selecting a payment channel and signature rules first.
- Next roadmap target: G6.1 background worker and task polling.

## G5.3 webhook foundation follow-up

- Added `BillingService.completePaidOrder` as the shared paid-order completion path for real callbacks and admin/manual flows.
- Added `POST /api/billing/webhooks/mock` with `BILLING_WEBHOOK_SECRET` HMAC-SHA256 verification over `orderId.paymentRef.amountCents.CURRENCY`.
- Added amount, currency, payment reference, payment channel, and paid-order idempotency checks before granting credits.
- Documented the mock callback contract in README files and `.env.example`.
- `npm test --prefix server -- --runInBand src/billing/billing.service.spec.ts src/billing/billing.controller.spec.ts src/billing/billing.repo.spec.ts` passed.
- `npm test --prefix server -- --runInBand` passed (19 suites / 71 tests).
- `npm run build` passed.
- `npm run smoke:frontend` passed (65 assets checked).
- `git diff --check` passed.
- Remaining provider-specific work: select a real payment channel and map its official callback signature/payload into `completePaidOrder`.

## G6.1 verification

- Implemented queued image jobs for text-to-image, image-to-image, dialogue image, and edit/tool generation endpoints.
- Added an in-process background worker queue and job polling endpoints: `GET /api/images/jobs` and `GET /api/images/jobs/:id`.
- Updated image workflows to bind work to pre-created queued job ids, preserving existing charge/refund failure behavior inside the workflow lifecycle.
- Updated the frontend image store so generation calls return queued jobs, poll task status, restore queued/running tasks after refresh, refresh user balance on completion/failure, and upsert successful results.
- Updated the studio shell generation bar for queued/running/success/error states, and restored active jobs after login/session availability.
- Updated dialogue mode so it no longer expects immediate generated image data; successful polled dialogue jobs refresh the active chain and session list.
- `npm run build` passed.
- `npm run smoke:frontend` passed (60 assets checked).
- `npm test --prefix server -- --runInBand` passed (15 suites / 49 tests).
- `git diff --check` passed.
- Limitation: the current worker is an in-process queue. It supports async response + frontend polling, but server restart recovery/durable payload persistence is deferred to G6.3.
- Next roadmap target: G6.2 frontend task center.

## G6.2 verification

- Added `/studio/tasks` frontend task center with status filters, pagination, manual refresh, active-task auto-refresh, result navigation, failed-task retry prefill, and completed-task cleanup.
- Added task center navigation in the studio sidebar plus route title and description metadata.
- Extended the image store with persisted job list state, job pagination, completed-task cleanup, and backend active-task checks before starting new generation.
- Updated image job list API to return public job payloads with result image data so successful tasks can open their generated asset.
- Added backend completed-job cleanup support via `DELETE /api/images/jobs/completed`, with repo and controller tests.
- `npm run build` passed.
- `npm test --prefix server -- --runInBand src/db/repositories/image-jobs.repo.spec.ts src/image/image.controller.spec.ts` passed (2 suites / 9 tests).
- `npm test --prefix server -- --runInBand` passed (15 suites / 51 tests).
- `npm run smoke:frontend` passed (62 assets checked).
- `git diff --check` passed.
- Browser check opened `http://localhost:5171/studio/tasks` and confirmed the route loads through the expected auth redirect to `/login?redirect=/studio/tasks`; API console 500s were from running Vite without the backend server.
- Limitation: failed-task retry currently preloads mode and prompt back into the create page. Durable replay of original files and advanced generation payloads remains for G6.3.
- Next roadmap target: G6.3 concurrency control, cancel, and retry policy.

## G6.3 verification

- Added configurable image job queue concurrency via `IMAGE_JOB_CONCURRENCY`, with queue stats exposed to the frontend.
- Tightened job startup so workers only transition `queued -> running`; cancelled or already-mutated jobs cannot start and charge credits.
- Added task payload and attempts persistence for retryable text-to-image jobs.
- Added user task stats and failure rate through `GET /api/images/jobs/stats` and list responses.
- Added queued-task cancellation through `POST /api/images/jobs/:id/cancel`; cancellation removes queued work and does not charge credits.
- Added failed-task retry through `POST /api/images/jobs/:id/retry`; retryable persisted text jobs are requeued without immediate duplicate charge. Multipart upload tasks remain non-auto-retry and fall back to workbench resubmission.
- Updated task center to show queue concurrency, queue depth, failure rate, attempt count, cancel actions, and backend retry for retryable failures.
- `npm test --prefix server -- --runInBand src/db/repositories/image-jobs.repo.spec.ts src/db/migrations/sqlite-migration-runner.spec.ts src/image/image.controller.spec.ts src/image/image-job-queue.service.spec.ts` passed (4 suites / 20 tests).
- `npm test --prefix server -- --runInBand` passed (16 suites / 59 tests).
- `npm run build` passed.
- `npm run smoke:frontend` passed (62 assets checked).
- `git diff --check` passed.
- Next roadmap target: G7.1 generate variants from history.

## G7.1 verification

- History detail now treats non-dialogue reuse as “生成变体” and uses the result image as the image-to-image reference when available.
- Reuse query preserves prompt, ratio, quality tier, count, output format, compression, background, and moderation values from `generationParams`.
- Dialogue records still continue through dialogue mode, while old records without a result image degrade to prompt + ratio text generation.
- `npm run build` passed.
- `npm run smoke:frontend` passed (62 assets checked).
- `git diff --check` passed.
- Next roadmap target: G7.2 describe image to prompt.

## G7.2 verification

- Added `POST /api/prompts/describe` to generate an editable prompt draft from an image without mutating the original image prompt.
- Added HiAPI Responses image-understanding support for describe prompts, with clear missing-text-model and empty-result errors.
- Describe uses the existing prompt tool price, records ledger reason `prompt_describe`, and refunds with `prompt_describe_refund` when upstream generation fails.
- History detail now exposes “反推提示词”, shows an independent editable prompt draft, supports copy and “带入工作台”, and keeps the original prompt unchanged.
- `npm test --prefix server -- --runInBand` passed (18 suites / 64 tests).
- `npm run build` passed.
- `npm run smoke:frontend` passed (62 assets checked).
- `git diff --check` passed.
- Next roadmap target: G7.3 project style boards.

## G7.3 verification

- Added project style board persistence with `style_boards` and `style_board_refs` SQLite tables plus migration version 17.
- Added authenticated `/api/style-boards` APIs for listing, creating, updating, deleting boards, adding/removing references, and adding a reference from an owned history image.
- Added `/studio/style-boards` with style board management, manual image URL references, reference removal, and sidebar navigation.
- Added history detail “加入风格板”, including quick board creation and adding the current generated result as a style reference.
- Added explicit style board selection in the workbench; selected boards append style guidance to this submission and pass board references as image-to-image references, while unselected boards do not affect generation.
- `npm test --prefix server -- --runInBand` passed (19 suites / 66 tests).
- `npm run build` passed.
- `npm run smoke:frontend` passed (65 assets checked).
- `git diff --check` passed.
- Roadmap Phase 0/1 implementation slice is complete through G7.3.
