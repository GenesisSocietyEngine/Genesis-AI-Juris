# Studio JSON download handoff — 22 October 2026

## Verified starting state

Canonical main ee7fd18cb0abe239fbbb893f29253138036a377e is clean and matches the supported Sites source-opening result. Fresh native Sites reads confirm existing public owner project appgprj_6a88a26d2f808191aa076b9fcd8dbce6, v160/runtime8644ee279bc2dbaf89fad3266936e96ef1e9a72f, normalized archive05d15e4bcb4e66ea4f2571243911ca3a5264c958a63610af6120bab1acc33f99 and succeeded deployment appgdep_6ad8b909d0748191937afb6902c504b0. No production case is changed by this work.

## Problem, scope and review

The actual Studio JSON handler clicks a detached anchor and immediately revokes the object URL. Raw-document recovery uses a detached anchor and releases it after one second. The existing PDF helper instead attaches the anchor, separates viewer navigation from the editor, retains its bytes for a bounded60seconds and cleans up on success/error.

Reuse that helper for these two JSON paths. Keep the same filename, MIME, serialized JSON and exact raw recovery bytes. All existing saved/sealed-version, duplication, access revalidation and stale-context guards run before delivery. Recovery remains available only for verified retained bytes; no unknown document becomes editable and no unverified local file acquires export authority. No source/template/serializer/storage/role policy changes. Training play exports and source ZIP/PDF generation remain outside this bounded change.

This corrects an executable handoff-lifetime inconsistency; it does not establish that Chrome's audit download timeout has this cause. Do not claim an actual downloaded file from a handler Blob or a requested browser action.

React review: both components retain hook ordering, accessible controls, wording and event-only side effects. Reuse a small direct import; add no dependency, effect, render-time URL allocation, state or visual layout change. Entry size must remain within the existing cap.

## Tests and acceptance boundaries

The actual-handler regression fails on original source: after the authorized private JSON handler returns its URL map is already empty (expected1, actual0). Recovery separately fails the shared handoff-lifetime requirement. Original failures remain in .artifacts/download-lifetime-before-20261022.log. After correction11 focused checks pass, covering exact UTF-8/BOM/CRLF/large-number recovery bytes and hashes, no side effects for unverified recovery, unchanged private export data, fresh server authority, stale callback refusal and bounded link/URL cleanup. These are actual-handler/DOM-model tests, not browser download acceptance.

Original published v149 remains byte-unmodified in its isolated127.0.0.2:4175 harness. Normal synthetic-owner password login, visible chooser, Russian GreenFire2.5 input, first-click Save and independent reopen pass in the original client. New local identity2 belongs only to the execution at2026-10-21T15-03-28.370Z; it is not production case2 or any earlier execution's case2. The reopen shows Saved to workspace and the correct synthetic title; the import map shows65nodes/117links. Local screenshot: .artifacts/original-v149-greenfire-ru-save-reopen-20261022.png. No prior case is overwritten or deleted.

The eligible original-client JSON export is focused/enabled/visible and completes its normal authority reads, but the bounded download wait still yields no path. No console error or explicit export refusal appears. Download-byte/hash acceptance stays open. A focused Chrome-downloads UI check is denied by browser URL policy; do not work around that refusal or scan the user's download directory. This is not evidence of product data loss or a browser keyboard defect.

Candidate/full exact-main web/PDF gates, candidate browser checks, ordinary integration, source packaging, previous-live asset retention, native Sites deployment receipt and both-origin checks remain required before calling this delivered. Native cold-first PR180 is a separate diagnostic slice, not this web change's padding fix.
