# Mobile workspace recovery review — 2026-09-30

Base: canonical merge `bc093010bef5ffa9476aac2d68e7b2b19ebf39d5` (PR #68). Implementation branch: `codex/tax-mobile-recovery-2026-09-30`. This review concerns the workspace store and its Studio UI; it does not close aggregate workspace/tax-sidecar interruption acceptance.

## Intended result

Reopening an interrupted save must recover only a supported, structurally readable generation, preserve unresolved or unsupported originals, and avoid replacing retained work with an empty editable draft. Concurrent callers using different store instances for the same path must not share temporary writes. Awaited save failure must prevent export or opening the tax editor on an unsaved source.

## Original limitation and correction

The pre-existing `ApplicationSupportStudioDraftStore` returned an empty workspace when the primary was absent, even when a backup existed. Writes reused and deleted `.tmp`/`.bak` files without shared serialization or a future-version guard. A read error left a blank editable Studio screen labelled Auto-saved, and `_persist` swallowed failures even when its caller awaited successful persistence before continuing.

The correction adds ordered path reservations and a shared queue for reads and writes to the resolved target path. Payloads are encoded before waiting, including caller-owned progress collections. Different store instances resolving the same directory now use one file queue. Failed operations still report errors to their callers and do not poison later queue entries.

A valid primary remains authoritative. An absent or corrupt primary can recover from a parsed, supported backup; the backup stays retained, and corrupt primary bytes move to a unique recovery filename. Malformed UTF-8 is handled as retained corruption, not discarded. The recovery parser checks the known workspace envelope, workflow stages, native scenario version, case-type package and the structural fields used by Studio. Rust remains responsible for full scenario validation before the existing validation/export gate; storage recovery does not claim to validate legal/runtime semantics.

Unresolved corrupt/temporary-only state reports a recovery error. Unsupported primary versions are never downgraded to an older backup. Unsupported backup or temporary generations are not overwritten by an older writer. A new write with an authoritative valid target retains an orphan temporary file under a unique `.tmp.interrupted-*` name and retains a corrupt older backup under `.bak.corrupt-*`. The last committed valid generation remains in `.bak` after a successful replacement. No failed write unconditionally deletes its temporary payload.

Scenario export keeps its existing JSON content and one-space indentation. The replacement mechanism now also prevents overwriting unsupported future scenario exports. Unknown nested scenario fields remain in the cloned document; backup recovery preserves exact saved bytes.

Studio now presents a persistent read-only recovery screen after a failed reopen, with retained-error information, normal product navigation and a read-only retry. It exposes no blank-draft editing/import/save controls in that state. Save status distinguishes not-yet-saved, pending, failed and completed saves. Awaited persistence throws on failure; fire-and-forget autosave consumes the reported error and retains the editable in-memory draft. Failed persistence prevents subsequent scenario export and tax-editor navigation.

## Verification

- Real-file tests cover no-file startup, committed-generation rotation, exact backup restoration, malformed JSON/UTF-8 preservation, orphan temporary and corrupt backup retention, unresolved disk-state write guards, future outer/native/package/workflow data, future auxiliary generations, malformed backups, absent-primary/future-backup refusal, two-instance read ordering, frozen caller collections, overlapping writes, queue recovery after failure and unchanged export bytes.
- Widget tests cover persistent read-only recovery and retry for unsupported/corrupt/read failures, no blank workspace writes, pending/failed autosave status with retained text, successful retry, and no export/Saved notice after an awaited write failure. Existing Studio and product-navigation tests are included.
- Final `flutter test test/studio_draft_store_test.dart test/studio_wizard_screen_test.dart test/product_navigation_test.dart --reporter expanded` passed **45/45** (24 disk, 9 wizard, 12 navigation cases). Receipt: `.artifacts/workspace-recovery-tests.log` in the task worktree.
- Focused Dart analysis passed for the store, UI and both test files; formatting verification reported four files, zero changes. The exact unknown-nested-data recovery/write round trip and unchanged scenario-export bytes are included in the final passing suite.
- The first test pass exposed an invalid-UTF-8 decoding gap and Windows separator assumptions in test discovery. Both were corrected before the final run; the disk-only rerun passed all 23 then-current cases.
- Two independent read-only reviews found no material issue in the final store/UI correction. They checked shared-path ordering, frozen payloads, retained backup/future/temporary data, unknown nested scenario fields, read-only recovery and awaited/autosave failure behavior. Those reviews did not rerun tests or establish device interruption evidence.

## Scope and remaining acceptance

The static path queue coordinates callers within the same Dart isolate/process. It is not a cross-process lock, a power-loss durability guarantee, or a transaction across workspace and tax-sidecar files. Retaining a backup permits subsequent recovery if process termination interrupts primary recovery itself.

The PR #68 sidecar-first/workspace-second aggregate import remains a separate recovery problem. Its source-mismatch protections must continue preserving both artifacts, and a durable aggregate journal or equivalent reviewed protocol is still required before claiming all-or-nothing import. No aggregate atomicity claim is made here.

The existing `TaxArtifactStore` also remains outside this bounded correction: its queue is per instance, reads only await pending writes rather than reserving their own order, absent-primary backup promotion precedes validation, an orphan `.tmp` may be overwritten, and write validation reads the caller map after its earlier encoded snapshot was taken. Those sidecar preservation/concurrency issues require a separate correction before complete filesystem-boundary or aggregate acceptance.

Unit/widget results are development evidence. Emulator application process-death/relaunch tests for the new workspace states, iOS application-level acceptance, actual keyboard/screen-reader/enlarged-text journeys and any physical-device checks remain separately recorded gates. No new emulator or physical-device acceptance is claimed by this document until its evidence is appended.
