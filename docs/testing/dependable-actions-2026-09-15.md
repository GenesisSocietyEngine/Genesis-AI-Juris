# Dependable case actions — 15 September 2026

## Baseline and reference evidence

Starting review: `action-tiles-2026-09-15.md` described changes based on published version 82. This iteration starts from its subsequent published version 83, source `00a7df7298dc48077344c52487a5ab0e8603af15`. The live Site reports version 83; the checkout was clean before editing.

Available and visually inspected: `action-tiles-images/tasks-before.jpg`, `tasks-after.jpg`, `studio-actions.jpg`, `studio-complete.jpg`. The task images show different views in an explicitly labelled callback harness; they are a presentation comparison, not browser persistence proof. No SVG audit was found. Coda/ClickUp references remain as recorded previously; official Plane images remain labelled secondary.

The Windows OneDrive folder is not mounted here. The same Plane archive is listed, but one supported download retry returned 502 without bytes. No OneDrive-specific connector is exposed. No new archive screenshots have been inspected.

## Stage 1 — authenticated continuation and truthful persistence

Acceptance: preserve eligible draft, prompt, selected item and intended action through sign-in/cancellation; never mark a mismatched receipt or visibility-only change as content saved; reload saved Studio cases through authorization; revoke both session paths on full sign-out.

Diagnosis: the browser reproduced `/signin-with-chatgpt` 404 on the HTTP managed preview. Sites owns that route and its HTTPS dispatcher is absent from the Vite preview. Existing password enrollment requires trusted ChatGPT identity and local cookies are Secure/HttpOnly/__Host; those protections are retained. The current browser environment only supports the internal HTTP preview, so real authenticated-browser persistence and registration-inclusive timing remain blocked. No simulated identity is represented as authentication proof.

Implementation: removed the legacy unscoped auto-save continuation; reuse the bounded, account-scoped continuation and Account/profile flow. Protected content stays in its current tab during reauthentication. Save success requires exact content and publication receipts; a saved-case URL reopens through the existing authorized endpoint. Visibility confirmation is separate from content saving. Full sign-out revokes local sessions before platform sign-out. Local history is labelled draft changes. Saved Studio drafts and organization cases have distinct entry links because they use different existing storage/authorization models.

Review: typecheck and 12 focused continuation/receipt/release checks passed. Browser review exposed use of a secure-context-only UUID helper in the temporary continuation; replaced it with cryptographic random bytes supported by the preview without weakening authentication. Browser cancellation review and remaining stage evidence will be recorded below.

## State-action implementation design

Historical deadline: retain original date/time, kind and provenance; append an immutable disposition with reason/reference and exact actor/time/revision. Use existing domain states completed (Fulfilled), waived and cancelled (No longer applicable). Simulation-projected deadlines remain engine-controlled. Preview readiness impact; closing the last critical deadline may still require a current key deadline. Enforce same-case references, roles, conflict checks and idempotent receipts server-side.

Citation retirement: retain accepted anchor and original acceptance history; append an immutable retirement review with optional current replacement. Dependent accepted assertions remain blocked until explicitly corrected, including assertions with another valid source. Mark current outputs stale through existing append-only state events. New snapshots retain the historical provenance register and seal retirement annotations in a versioned deterministic receipt, so old reports/manifests remain reproducible.

### Stage 1 review outcome

Browser, managed HTTP preview: entered a synthetic Canopy prompt, selected Save, reached Account, cancelled, and returned to the same draft. The exact prompt remained and the UI said **Not saved to workspace**. Evidence: `dependable-actions-images/save-return.jpg`. Review found and corrected a secure-context UUID dependency, a stale saved-case URL on import, a reauthentication reload that could replace dirty work, lost submit intent, and late visibility-response state updates. Identity resolution now continues if browser storage is unavailable. Saved URLs use the real `run_compare` workflow step.

Real sign-in is **not verified**. Production logs showed authenticated `/api/submissions` requests returning 409, but logs do not establish a successful save/reopen journey. No production credentials or identities were injected into the preview.

## Stage 2 — exact historical actions

| Existing action | Implemented destination | Saved result and return |
|---|---|---|
| Review overdue deadline | Exact deadline in Tasks & reviews; historical-outcome form loads by ID, including records outside the first loaded page | Completed/Fulfilled, Waived or Cancelled/No longer applicable; original date, timezone and provenance retained; audited disposition; refreshed overview queue |
| Review changed source | Exact citation in Evidence review; retirement panel with dependent assertions and optional current accepted replacement | Original acceptance retained; retirement appended; dependent assertions remain blocked until explicitly reviewed/superseded; current outputs stale |
| Repair evidence after retirement | Dependent assertion links and current-source citation controls | New reviewed assertion required; replacement selection alone does not create support |
| Return after interrupted confirmation | Refresh exact record while retaining the reason; inspect the immutable receipt | Retry uses the same idempotency key for the same request; a confirmed existing disposition offers return to the refreshed queue |
| Inspect historical outcome | Plain-language audit summary/reason with a link to the exact reviewed record | Actor, timestamp, original context and affected records remain in immutable audit history |

Implementation uses generated forward migrations `0020_dependable_actions` and `0021_disposition_audit_binding`. Older migrations and V1 audit contracts are unchanged. Deadline disposition is a registered typed `dossier_updated` aggregate event (`HISTORICAL_DEADLINE_DISPOSED`), with a sidecar-to-audit binding enforced in both directions. Citation retirement uses `source_anchor_reviewed`/`SOURCE_ANCHOR_RETIRED`. Both sidecars are append-only and each requires its own audit ID. Organization membership, participant role, pending revision, exact record, reason, actor and timestamp are checked in the transaction. Audit/receipt ordering is preserved.

The review corrected: shared audit IDs; incorrect previous-status detail; retired-source acceptance through a pending graph proposal; over-limit retirement registers that could otherwise seal an unrenderable snapshot; cross-record form reuse; edits during pending confirmation; and missing exact-record receipt checks. Future deadlines show an eligibility explanation before confirmation. Simulation deadlines remain engine-controlled. Readiness/output consequences are described before submission.

**Server verification:** actual route handlers with isolated Miniflare D1/R2 and synthetic trusted identity transport. These are server integration tests, not authenticated browser observations. The full organization/ERP/Canopy run passed **18 checks**. A focused **6-check** rerun additionally verified explicit supersession, current evidence review, a new sealed snapshot and a generated JSON report containing the sealed retirement annotation. It verified denied anonymous/viewer/foreign-organization calls, duplicate replay, changed-body/stale-revision conflicts, preserved original deadline fields and acceptance rows, blocked retired dependencies, rejection of new retired-source reliance, foreign-key integrity, and unchanged previously generated PDF bytes. Evidence: `dependable-actions-server-evidence.json`; test: `tests/p1-organization-erp.test.ts`.

Limits: fulfilled disposition was exercised end-to-end on the server; waived/cancelled use the same validated transition but have not been separately exercised in a browser. A simultaneous two-browser conflict was not tested. The test injects one synthetic legacy deadline by temporarily removing and restoring the unchanged creation guard in the isolated fixture; no production deadline insertion protection is removed.

## Stage 3 — PDF failure reported during this iteration

User references: `082a7ef9-fd30-4936-89a9-c7139bf67b9e.png` and `bcfcdad8-13c0-417f-8b26-16d8045f7aa6.png`. They show the Tax position memorandum dialog and the application error screen at `studio_step=report_save`.

Confirmed defect: the PDF library's callback-only `getBlob`/`getBuffer` path can throw inside an unreturned promise. The caller's promise never rejects, so the report dialog cannot recover. A controlled missing-font reproduction demonstrated this escape. The shared adapter now uses the public synchronous stream-creation path with error, end and premature-close handling. It is used for Studio preview/download and governed PDF output. A local report boundary contains render/module failures and offers a keyboard-accessible return to the unchanged editor. Report fingerprints and layout algorithms were not changed.

**Verification:** actual Tax and Canopy PDFs generated successfully through the corrected stream adapter; an invalid-font renderer failure rejects to the caller. **31 focused report/save/continuation checks passed**, with **14 rerun** after final adapter hardening. Generated Tax output is portrait A4, 595.28 × 841.89 points, 9 pages; Canopy output is 15 pages. First pages were rendered with Poppler and visually inspected for typography, wrapping, margins and footer placement. Representative renders: `dependable-actions-images/tax-first.png`, `canopy-first.png`. These are controlled fixture outputs, not the user's private case.

Browser: Canopy preview produced an inline PDF before the connection failure. Later Tax and corrected-adapter browser verification could not finish: the browser repeatedly returned CDP refresh timeouts, including after documented recovery and a fresh tab. The original private Tax input was not available. Therefore the user's exact crash is **not claimed reproduced or fully resolved in their session**; the demonstrated failure mechanism is repaired and tested.

## Reference continuity

Retained from the starting review: Coda `Coda web Mar 2024 99.png` supports narrative alongside structured records; ClickUp `ClickUp web Nov 2025 158.png` supports attributable status and explicit confirmation. Genesis adaptation: one contextual review form, readable consequences, exact record links and a confirmation-backed queue. Official Plane examples `blog-asset-issue-tracking-in-plane-intake-desktop-light-d0e3f0c1.webp` and `blog-asset-issue-tracking-in-plane-work-item-desktop-light-85341650.webp` remain **secondary, previously recorded references**. No September 2025 Plane ZIP screenshot is claimed inspected. The exact archive remains `Plane web Sep 2025.zip`; the requested Windows directory is not mounted and the supported archive download failed with 502.

## Completion matrix and release assessment

| Requirement | Status | Evidence / remaining dependency |
|---|---|---|
| Authenticated onboarding and persistence | **Blocked** | Hosting sign-in dispatcher absent in HTTP preview. Need a supported real HTTPS authenticated browser for save/reload/sign-out/sign-in proof. Cancellation preserves the synthetic draft. |
| Organization switching and access control | **Implemented but unverified** | Real server handlers prove organization isolation, roles and revocation. Interactive signed-in switching remains unverified. |
| Historical deadline disposition | **Implemented but unverified** | Persistent fulfilled outcome, audit, immutable context and denied/conflict paths pass server tests. Rendered desktop/narrow completion remains unverified. |
| Citation retirement and dependent readiness | **Implemented but unverified** | Server retirement, blocked dependencies, explicit repair, new sealed report and old-byte preservation pass. Browser completion remains unverified. |
| Action-tile completion and queue updates | **Implemented but unverified** | Exact-record forms, verified receipts, retained failures and queue refresh implemented; no claim of successful real browser persistence. |
| Plane archive inspection | **Blocked** | No archive bytes; an uploaded ZIP or extracted navigation/detail/queue/form screenshots are needed. |
| Timed first use and mobile | **Blocked** | Registration-inclusive timing cannot be measured. Initial 390px iframe attempt was refused; later component review hit browser timeouts. No native device is available. |
| PDF rendering and recoverable renderer failure | **Verified** | Actual Tax/Canopy PDFs, controlled error test, server governed PDF journey and first-page visual inspection. The exact private browser case remains unverified. |

**Guided demo:** conditionally usable for demonstrated sample paths, with the listed browser gaps disclosed. **Self-service trial:** hold. Do not recommend release as self-service-ready until a real authenticated save/reopen/organization journey and the exact PDF incident are verified. Remaining priorities: (1) supported authenticated browser and private-case PDF retest; (2) desktop/narrow action completion, failure, keyboard and return checks; (3) complete controlled conflict/status variants; (4) actual Plane archive and native-device review. No registration-inclusive two-minute claim is made.

Build verification: the production bundle, strict typecheck and locked canonical mobile contract passed. The mobile contract check is deterministic code parity, not a mobile-device test. Temporary review harness assets were removed before packaging. The managed preview was stopped after browser recovery remained unavailable.
