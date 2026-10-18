# Vertical node palette — review and release

18 October 2026. Requested outcome: place creation tools beside the decision map, keep them available during map/page scrolling, and reclaim the previous horizontal palette's height.

## Baseline and bounded implementation

Native Sites reports public v144. Canonical main and clean isolated HEAD were ea1caffb5aa0bdb74b0db623a0aa2dd993a4f204; its difference from runtime7515d185d31513b00aa0959e61426596ff6875bd consists of six Markdown files only. Supported Sites source opening confirmed the same documentation HEAD before edits. Root checkout belongs to another writer and is excluded.

The existing native details disclosure opens by default. Desktop uses a reserved180px left column, sticky within the workspace, bounded to viewport height with independent tool scrolling. Collapsing leaves a48px labelled rail and returns width to the map. At intermediate widths the inspector follows the map; narrow screens use a bounded two-column disclosure above it. The palette never overlays graph nodes. Native disclosure keyboard operation and visible focus remain available; presentation changes do not write case data.

Only JurisApp's disclosure and workspace-design.css change. Existing lazy palette boundary, drag authority/context guards, coordinate conversion, add/history/undo/save callbacks, zoom and case/source formats remain unchanged. No new dependency, schema, template or fixture hash. Preserve all cases, particularly user-amended37/39 and negative regression38; use a fresh synthetic identity for any production edits.

## Acceptance and review

- Eight existing actual-handler/normalization/source-revision map regressions passed; strict TypeScript passed.
- Desktop: inspect vertical arrangement, sticky containment, collapse/reopen by keyboard, zoom, viewport and scrollbar access; verify native drag and click fallback.
- Narrow EN/RU: measure actual viewport, wrapping, disclosure bounds, reachable controls, inspector and absence of document overflow.
- Existing source/undo/save regressions remain distinct from authenticated production save/reopen evidence.
- Required canonical web/PDF gates, exact merged-source build, current live predecessor retention, Sites receipt and both-origin asset verification must complete before release is claimed.

Local rendered review found the inherited app-shell overflow-x:hidden created an unintended scroll container, defeating sticky positioning. The bounded map-shell amendment uses overflow-x:clip/overflow-y:visible. Recheck confirmed palette top16px while the page moves. No map overlay: desktop measured columns180/763.6/250px; collapse48/895.6/250px and unchanged65 nodes. Native Actor drag at110% created exactly one node at445,91 with the ordinary dropped status. Narrow EN/RU at actual390px (document375px) used a341.6px disclosure, two146.4px tool columns and320px height cap. Russian labels, including jurisdiction, fit without button or document horizontal overflow. Native Enter collapse/reopen worked. Responsive override was reset. These local checks are not authenticated persistence evidence.

Changed-source lint passed with seven inherited unused-variable warnings and no errors. Review confirms no new hook/effect/state, no eager dependency, no data callback changes and native keyboard disclosure semantics.

## Production closure — Sites v145

PR136 merged normally to runtime **cc84d0c7c664cafb91703b8f02202b74cd238065**. Candidate run39125625141 and exact-main run39126077291 passed web-and-pdf and pdf-visual:1617 tests/1614 pass/0 fail/3 inherited skips, unchanged full/Base/tax PDF locks. Exact merged portable build and both built-output tests passed. Initial entry324763 bytes against unchanged325000 cap. This remains little headroom; preserve the extraction backlog.

| Receipt | Value |
| --- | --- |
| Site | Existing public CaseVant, https://casevant.pro and https://genesis-juris-web.maxim-hayan.chatgpt.site |
| Saved version | appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_8ab66c019eac819190e93fdb1b163926 —145 |
| Deployment | appgdep_6ad4b8862cf48191a96f4709cdbe46a9 —succeeded2026-10-18T12:16:32.660005Z |
| Environment |42; existing DB/R2 bindings retained |
| Application inputs SHA256 | aee2c2f1c7977d784faa17cf9d0268043584065c099e277c4908eac3f3fdda75 |
| Hosting SHA256 |20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe |
| Raw local archive SHA256 |ff3064cea7e7ee80f4687419e3ed1879776bdfc7d6e0411b4c7185fea98246ec |
| Native normalized archive SHA256 |0d6f8cfed5c31c1417c7cbca204cdc6ecea0186fa6afcf283a305c4c322eb1af —49203200 bytes/537 files |

Raw and native archives are different representations. Both origins passed165/165 status/MIME/length/SHA asset checks:118 current plus47 retained from actual v144. Native source/publication receipts, static verification and browser acceptance are separate evidence. Archive: `.artifacts/casevant-sticky-palette-cc84d0c-20261018.tar` in the root workspace. Evidence: root `.artifacts/sticky-palette-20261018/`; build/CI logs in the isolated clone's ignored `.artifacts/`.

### Authenticated changed flow

Chrome Maxim Hayan saved fresh synthetic40, **QA synthetic — GreenFire vertical palette — 2026-10-18 D**, caseId `example_work_c55abd68069d469bb30430f72d86430d`. Baseline was actually exported and independently reopened on v144. On v145 it reopened with65 nodes/117 links/Saved status. Desktop palette uses180px and sticks at16px; keyboard collapse returns132px to the map without editing.

A refreshed native Actor drag at110% created one node at411,115; Undo65/Redo66,117 links. An initial native drag produced no change; refreshed label coordinates succeeded. No second node or unexpected write occurred. Explicit keyboard Save showed Saving then Saved at14:17:41 Paris. Independent new-tab reopen retained66 nodes and exact411,115 at default100%. Actual export confirmed all65 original node records,117 links, category/classification, mandate, identity and exact source `greenfire_first_72_hours@2.5.0` fingerprint `sha256-e70a0e7ba866801dd6bc1cab6555e081d59b8e9c04fc14f892487a79c807d0a0` unchanged. Four history entries retain title/add/undo/redo. Protection policies remain exact; content code/seal change as expected when the newly saved content is reattested, so those signatures are not compared as immutable across an edit.

Actual baseline JSON SHA256:66d91cb6038f67c78a7736bfe823cdb4005713bf426fe850d0737d90eea5d746. After SHA256:ce7e3ae5ceafd51c120bae37a32b10b467761e570696c457542aa5ddf1d76a36. Files are retained as case40-before/after.json with machine comparison in the evidence directory. A rapid baseline context-confirm→header click did not confirm Save; settled keyboard activation confirmed it before further work. This slice does not infer another persistence defect from that transition.

Released narrow EN/RU checks requested390×844 but measured actualCSS488/document469. Palette width435, two191px columns,320px maximum height; labels fit without button/document horizontal overflow. Collapse/reopen and language changes retained Saved status and66 nodes. Local responsive review separately measured actual390px. Viewport override was reset and EN restored. No touch-drag or Safari/Firefox claim.

Preserve40 and every prior case, including user-amended37/39 and regression38. No old case was reset or deleted. This bounded presentation slice does not complete eighteen-package QA, historic imports, same-tab account switching, missing source-body/retrieval work or governed user-edit merging. Subsequent documentation-only commits do not require an unchanged-runtime deployment.
