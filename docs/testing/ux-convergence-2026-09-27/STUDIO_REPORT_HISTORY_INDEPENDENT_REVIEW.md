# Independent Studio export-history review

2026-09-27, source reread at 18:30 UTC. Reviewer: `report_verification`. The reviewer did not author the history implementation or save-response parser and made no application, schema, fixture, permission or deployment changes during this review.

## Outcome and scope

**No unresolved material finding in the reviewed source.** Two asynchronous-result findings were corrected by their respective authors and independently reread. This is a source and targeted-test review, not a claim that the new candidate has passed authenticated browser delivery, hosted QA or publication.

The intended outcome is account-scoped, paginated metadata for exports of an exact saved Studio case. It uses existing generic `audit_events`, without a migration, PDF upload, Matter association, generated-byte attestation or independent approval. The earlier implementation gap in [EXPORT_HISTORY_CONTRACT_REVIEW.md](EXPORT_HISTORY_CONTRACT_REVIEW.md) describes the pre-slice state; this implementation addresses Studio receipt persistence separately. The earlier finding that a Studio receipt cannot be submitted as a governed Matter output remains correct.

Reviewed application files: `app/studio-report-history.ts`, `app/studio-report-history-server.ts`, `app/api/custom-cases/report-receipts/route.ts`, `app/studio-report-history-client.ts`, `app/StudioReportHistory.tsx`, history integration in `app/CaseReportDialog.tsx`, and the `customCaseId` handoff from `app/JurisApp.tsx`. Account deletion was traced through `app/api/me/route.ts`; existing actor-ID guards and report/access contracts were also inspected.

## Findings and disposition

| Finding | Correction and independent assessment |
| --- | --- |
| A slow manual retry for receipt A could replace the account-history status for a later receipt B in the same dialog context. | `saveAccountReceipt` now captures an attempt object and requires object identity as well as current account/case context before POST and before updating either success or failure. Actual parent-callback regression defers A, starts B, fails B, releases A, rejects a mismatched B response, then accepts a matching B retry. PDF download count remains two. **Resolved.** |
| Authority could disappear between the initial GET guard and the guarded history query, causing a false empty-success response. | `readHistory` now rechecks live authority after reading rows and returns conflict if it changed. The passing API test revokes a grant at the actual history-read boundary. **Resolved.** |
| Generic audit history follows account deletion and current case access, so “immutable receipt” must not imply permanent governed retention. | The history disclosure now states that account deletion removes receipts and loss of case access can make them unavailable. The device copy is explicitly separate from account history. **Resolved wording.** |

## Authorization, binding and retention assessment

- Ordinary authentication and strict same-origin POST checks remain in force. A positive saved case ID and expected hashed account scope are required. Scope is a consistency guard, not the credential. The server resolves the authenticated user's immutable actor ID.
- Owner history includes private/protected owner cases. A nonowner must hold the existing share grant for a nonprivate, nonprotected case; inspection-only platform-admin access does not become export authority. Protection seals use the existing verifier.
- The final SQL operation checks the captured user ID/actor ID, live local session when applicable, exact grant ID, current case identity/version/privacy/fingerprint, exact stored draft payload and latest matching draft identity. Removing and recreating a grant does not validate an old request. Trusted-header authentication retains its existing ingress contract; this review adds no alternative identity mechanism.
- POST validates strict V2 receipt/options shapes and recomputes current production report, layout and presentation bindings against the exact saved draft. It stores the receipt, effective format, actor ID and deduplication digest; it does not retain the settings snapshot or PDF bytes. An atomic conditional insert makes the same actor/case/receipt retry idempotent. Old receipts are read as their original version and evaluated for staleness by the client.
- These are **client-reported download-start records**. Exact metadata validation cannot prove that PDF bytes were rendered or saved by the browser; an authorized caller can report the corresponding event. UI copy correctly avoids delivery and independent-approval claims. A draft/final field remains the report's declaration, not a governed approval.
- GET is actor-only and case-authorized, with bounded descending-ID cursor pages. Server responses are private/no-store. Client context and request tickets hide previous-account results and reject late responses; authority loss renders no history. Errors clear the presented list instead of claiming empty verified history.
- Successful ordinary `DELETE /api/me` deletes the actor's generic audit rows. Existing governed responsibilities may block account deletion. If a case owner's deletion leaves another actor's generic receipt rows, that actor cannot read them through this endpoint without the deleted case and current access. Immutable actor IDs prevent a replacement account with the same email from inheriting retained rows. This is not the permanent `dossier_audit_events` retention contract.

## Independent save-conflict parser check

`readStudioSaveResponse` parses JSON on error statuses rather than discarding it based on `response.ok`. `shareDraft` still handles HTTP 401 and all other unsuccessful statuses before considering `verifiedStudioSaveReceipt`. Thus `stale_draft` on 409 remains a conflict, and `profile_required` remains an authorization state. Server messages are rendered as bounded text. A malformed body returns null and cannot confirm a save; successful HTTP alone still does not bypass the exact case/version/content/publication/submission receipt checks. No new material issue was found in this narrowly reviewed correction.

## Evidence and remaining verification

| Scope | Result / evidence |
| --- | --- |
| Client regression source and completed receipt | **PASS, 19/19** in [reconciliation-final-client-tests-expanded.log](evidence/reconciliation-final-client-tests-expanded.log), independently read. Actual bundled report/history parents run with modeled React scheduling/DOM and a modeled PDF byte renderer. Includes previous-account late GET, authority loss, ordered retries, mismatched and matching responses, plus existing protected output, saved navigation and save-receipt tests. This is not actual PDF rendering or browser verification. |
| Earlier client run | **PASS, 18/18** retained in [reconciliation-final-client-tests.log](evidence/reconciliation-final-client-tests.log); the 19-test run is the expanded evidence. |
| Save-conflict regression scope | The focused parser test exercises 409 `stale_draft`, 403 `profile_required`, malformed 503 and a valid receipt. The complete `shareDraft` status mapping is source-reviewed; the test does not exercise an end-to-end browser conflict. |
| API regression source and completed receipt | **PASS, 11/11**, exit 0 reported by the backend author; complete TAP independently read and copied unchanged from `.artifacts/report-history-tests/api-tests.log` into [independent-history-api-tests.log](evidence/independent-history-api-tests.log). Actual ordinary password login, auth/routes, all migrated Miniflare D1 tables and exact report binding execute; only runtime transport is adapted and synthetic users/cases are seeded. Covers idempotence, account isolation, pagination, privacy, strict bindings, late grant/session/payload changes, protected owner/shared access, account deletion/recreation and malformed history. No second independent execution was claimed. |
| Diff formatting | Scoped `git diff --check` completed without findings at this review. |
| New history browser/reload/delivery | **NOT_RUN in this independent review.** Coordinator/browser reviewer owns real signed-in generation, recorded receipt, reload/history, failure recovery, current/stale display and narrow-layout checks on the resulting candidate. |
| Build, complete suite, hosted deployment | Separate coordinator gates; not inferred from targeted tests or prior candidates. No v2 upload workaround, schema adaptation or approval bypass was introduced. |

Snapshot SHA-256 for the application history files reread: shared contract `c9d9a2ce106c0a812d5b3924c7f7bb40149854157d66f4b5afd73912b174a197`; server helper `31dc4b34e89ad20885b15a5000f495072cf6e1071d6833d44df54855f1586055`; route `6492cc859b97ff6871ca0f6372cf8df6116fdfdcd1970cf8ef6e5804e0b86476`; client helper `60e7eed0b8f041beb55816204e326c3bcb7919091d330394687499be14f52183`; history component `9ebade3ebef3ce5bc727f73fb840b9ae606337198883f9728d1927143cf7e369`; report dialog `416b1aaf1f68de5a6192c710fddf96bff236526dbf4e61343e2357f1d3160fee`. The history-component reread includes the final effect-local reference used to increment the same request counter during cleanup. Later code edits require reassessment of the affected scope.

Post-commit identity note, 18:35 UTC: coordinator normalized selected files to LF under `.gitattributes` before commit `8ee07c0fcf5a6ea78f5fd9c435bfe4b013e052b6`, without changing parsed source. A fresh hash read confirmed all six history application hashes listed above still match the committed worktree bytes. This note does not promote the later committed build or browser checks to PASS.
