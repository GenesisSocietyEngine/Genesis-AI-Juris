# Map zoom, draggable nodes and revision preservation — production closure

Updated 18 October 2026 (Europe/Paris). [Implementation and review history](graph-zoom-review-2026-10-17.md).

## Delivered behavior

The map has −10% / +10% controls immediately above its scroll window, a live percentage, manual 10–200% limits and centre-preserving zoom. Opening remains readable at100%; explicit Fit still shows the whole map. These controls change presentation only.

Authors can drag an allowed palette node onto the map or activate its button by click/keyboard. Placement accounts for zoom and both scroll axes. A dropped node uses the existing aggregate creation, history, undo and save operations. External, canceled, stale, account-mismatched, inspection-only and over-limit drags do not add nodes.

Optional `node.mapPosition` retains explicit placement through normalization and save/reopen. Its finite coordinates are bounded0–100000; existing `x/y` validation remains0–5000. Legacy nodes receive no new field on read. Explicit Auto-layout records new positions; deliberate moves and keyboard nudges update manual positions. Source templates, frozen versions, IDs, source bodies, decision rules and report visual locks were not rewritten.

The final correction also fixes an inherited undo/redo omission: snapshots now retain the complete authoring draft except separately managed protection/history/time. Legacy snapshots may retain an existing exact example reference; no reference is invented from a current template. Current server-attested protection remains separate from authoring undo.

## Release receipt

| Item | Verified result |
| --- | --- |
| Production | https://casevant.pro and the existing native Site origin |
| Final version | Sites **144** |
| Runtime source | `7515d185d31513b00aa0959e61426596ff6875bd` |
| Saved version | `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_53e7715dfdf48191bb8080c3413a85bb` |
| Deployment | `appgdep_6ad3f20b064481919833e338fdc55dbd` — succeeded2026-10-17T22:09:38.970152Z |
| Audience / environment | Existing public audience and environment42/DB/R2 retained |
| Application inputs SHA256 | `a4fc15b35d7857c4285d242865ae43fcde37f1b4f850a275ba54ac7ea3a00a61` |
| Hosting SHA256 | `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe` |
| Raw local archive SHA256 | `443e75a8710364b51ad360ff1f9dc179b2dd0ef7be8e6516b654230ac77d59f2` |
| Native normalized archive SHA256 | `b263e04cc8fe904c8775653340ec254edeac54c754dc1a5ac15a4b10e6654200` —49203200 bytes/537 files |

Raw and normalized archives are different representations. Both origins passed **165/165** status/MIME/length/SHA checks:118 current assets and47 retained from the actual v143 current manifest. Native publication, static byte verification and authenticated browser evidence are distinct receipts.

PRs131–133 delivered the interaction slices and bundle refinements; PR134 delivered the source-reference correction. Exact merged-main run39073294379 passed web and PDF gates: **1617 tests,1614 passed,0 failed,3 existing skips**. The carrier/report cohort38/38 and earlier interaction cohort29/29 overlap the full suite. Strict types and changed-source lint passed; the existing seven unrelated warnings remain. The final exact-byte portable build passed both built-output checks; its initial entry is324817 bytes against the unchanged325000 limit. Existing PDF baselines were unchanged.

## Authenticated production acceptance

Chrome visibly identified Maxim Hayan. A fresh standard-library GreenFire launch was saved as independent synthetic **case39**, `example_work_c7bf713b32cd438e8d0c87a7455e05cf`, titled “QA synthetic — GreenFire tall drop and source recovery — 2026-10-18 C”.

At110%, the settled scroll window reached14634 of14634 (scrollHeight15182/clientHeight548). A real native Actor drag to pointer700,700 rendered its centre700.34375,700.046875 and placed it at **366,13373**. The map stayed at110% and at its tail. Undo removed the node (65); Redo restored it (66) at the same position. Ordinary header Save confirmed success.

An independent tab reopened66 nodes at default100%, with the new node still at366,13373. The actual downloaded export retains legacy `y:5000` plus `mapPosition:{x:366,y:13373}`. Its SHA256 is `0f02bec303278df14caff460f2d4ed4c156a886023a59e1c86ea07af932ce93a`. Comparison with the actual before-export proves:

- All65 original nodes and117 links are exactly unchanged.
- Working identity, Investigation category, classification and exact `greenfire_first_72_hours@2.5.0` source reference are unchanged.
- The source fingerprint remains `sha256-e70a0e7ba866801dd6bc1cab6555e081d59b8e9c04fc14f892487a79c807d0a0`.
- Exactly one Actor was added. Four history entries cover the title edit, add, undo and redo.

Production narrow EN/RU checked100→110→100,66 records and confirmed Saved status. The requested390×844 override measured actual CSS width488/document469 rather than the requested physical dimensions; the control bar stayed within17–452. Local rendered RU and limit checks additionally verified disabled controls at10%/200%, reset100%, and keyboard nudge/undo. Temporary viewport overrides were reset. A production screenshot shows the independently reopened new node and zoom controls.

## Audit findings and preserved evidence

The first two candidate builds exceeded the existing entry limit (326198 and325408 bytes); neither was published. Lazy zoom and palette components recovered the budget without changing its threshold. A stale source-opening receipt was rejected by automatic approval review; a fresh exact opening resolved it. Transient provider Git DNS and credential expiry were resolved through the supported helper. Temporary local diagnostics were removed before the verified build.

v143 (`7344d1c…`) passed its runtime gates and deployed, but the actual case38 export exposed the pre-existing snapshot omission. That export preserves all original nodes/links and its manual position, while its source reference is absent. **Case38 is retained as negative regression evidence**, alongside its exact before/after exports; it was not rewritten or silently reconstructed. The earlier planned in-place recovery was not performed. Case39 is an independent acceptance copy, not a merge or migration of case38 edits.

Preserve all cases, including38 and39. User-amended37 was not changed; historical65/117 assertions must never be used to reset its current work. No whole-database byte audit, all18-package acceptance, fresh account-switch cohort, touch drag or Safari/Firefox acceptance is claimed. Existing broader backlog remains open. Old-client/unknown-field roundtrips for manual placements deserve a separate bounded compatibility slice. Further feature growth needs more initial-bundle headroom; do not raise the current cap.

Local evidence is under `.artifacts/map-interactions-20261017/`: native/static receipts, baseline/after exports, case38 negative comparison, case39 passing comparison and final production PNG. Artifacts and case payloads are not committed. Later Markdown-only handoff commits do not require republishing unchanged runtime7515d18.
