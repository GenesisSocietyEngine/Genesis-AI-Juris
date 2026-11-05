# Personal Studio materials — implementation review, 5 November 2026

Status: development candidate; not a production receipt. Public v179 remains runtime 88eec428. Branch codex/materials-dialog-20261105 starts at 03f88575 (PR224 documentation above that runtime). Existing deployed identities were rechecked before implementation. No existing case or protected preview was edited.

## User outcome and audit findings

Node materials must be understandable without moving a graph node or navigating away from the map. The previous inspector squeezed documents into a narrow column, labelled text records as evidence, and opened an unrelated composer. Adding a note unmounted search state; Undo restored content without restoring the matching list. Missing-original placeholders looked too similar to actual files.

The user explicitly selected direct personal-Studio file storage. The implementation keeps a wide node-scoped dialog, separate Original documents and Notes & references sections, Add document versus Add note, genuine original downloads, explicit link changes and unchanged review status. Opening a window, previewing or attaching does not approve evidence.

Primary design references: [Clio document upload](https://help.clio.com/hc/en-us/articles/9290308200091-Create-and-Upload-Document-Files-and-Folders), [iManage document preview](https://docs.imanage.com/cloud/the-imanage-platform/user-help/en-US/Preview_documents_and_emails.html). The adopted patterns are case-scoped filing, explicit upload and distinct preview/download actions; this is not a claim of competitor parity.

## Data and authority contract

Original bytes use the existing private R2 binding in a separate studio-personal actor/case/file namespace. Owner-only metadata and link changes use an append-only audit ledger. There is no organization-case inference, schema migration or substitution of missing sources. PDF/DOCX/TXT/Markdown uploads are bounded at 8 MB/file, 24 MB/case and 100 files, with observed-format validation and exact SHA-256 checks. No OCR, model processing or human approval is recorded.

Upload and attachment changes require the exact saved case, active account/source authority and registry revision. Raw-original recovery remains available to the owner even for unsupported saved versions. Changed-byte retries cannot replace originals. Interrupted completion may leave a pending original; refresh/retry the same intent instead of claiming cancellation means zero writes. Original case payloads and historical saved bytes are not changed by file ingestion. Account cleanup is guarded against orphaning the file ledger, including a concurrent first upload.

Files remain with the original saved identity; legacy JSON exports do not contain file bytes. Genuine originals can be downloaded separately or in an archive with a manifest. Independent case copying does not clone private file access. Uploads and server-side file links are not local graph Undo operations. These boundaries must be visible before wider release.

## Evidence so far

- Existing focused material/attachment/overview tests plus initial personal-file tests: 57 passed, zero failures before the account-cleanup amendment.
- Updated real migrated Miniflare D1/R2 and normal login handler suite: 9 passed, zero failures. Includes owner/foreign/shared denial, exact bytes, idempotence, stale payload/session, atomic link CAS, pending recovery, deleted-node reattachment, unsupported-version raw recovery and guarded account cleanup, including a ledger insertion immediately before the atomic cleanup batch. These are local real-handler observations, not production browser acceptance.
- Isolated local ERP browser: 196 nodes/321 links; search Change; add synthetic note gives 197/322 and two matches; Undo gives 196/321 and one match. Query and normal-width dialog persist. No workspace save or provider action.
- TypeScript passes; targeted lint has zero errors and 14 warnings (seven existing catalogue warnings and seven retained interaction functions now unused). The original handlers were preserved after automatic review rejected a broad heuristic cleanup. Fresh screenshot capture twice timed out; DOM measures a 1080 px dialog with Close focused at 2283 × 1032. This is not visual acceptance. File-chooser acceptance remains in progress. Full CI, authenticated browser upload/download hashes and production acceptance remain unverified.

## Release gate and remaining refinements

1. Review new storage lifecycle, retention fence and concurrent first-upload/account-cleanup fixture. Retain originals and every historic case. Do not offer disposal without a separately authorized process.
2. Confirm live local UI file chooser/drop, saved-case first-click upload, reopen/download/archive hashes, node selection/bulk links, stale source/account cancellation and orphan recovery through supported controls. Never inject a production unsupported row or transfer profile cookies.
3. Inspect genuine desktop and narrow EN/RU dialog captures, keyboard focus/Escape, long filenames and short heights. Resolve confirmed clipping; do not infer success from DOM bounds alone.
4. Complete full web/PDF and exact-main CI. Keep PR224 infrastructure failures (Rust DNS; editor VM discovery) distinct from application failures. Follow existing web-only/native authorization precisely.
5. Publish only a verified runtime through the existing Site with an exact source/archive receipt. Do not duplicate v179 for documentation closure. Keep all S03/S05, same-tab identity/timing, legitimate owner recovery, original-artifact/pagination, 43 missing originals, full ERP/PDF and native/operator/commercial limits explicit.

No governed merging, original-source acquisition, provider processing, case disposal, analytics, pricing or outreach is added.
