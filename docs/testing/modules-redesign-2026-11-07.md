# Home, work and Library redesign — 7 November 2026

## Baseline and acceptance

This task owns the module redesign on `codex/casevant-next-major`. Initial checkout was clean at 5bc07f8; canonical main and the supported Sites source opening are now f6c685f2f733cb5a9218485679705f7a606dd3a0. Site latest version was 191. Preserve the newer Home, integrated Studio, guarded case editor and save/return work. No other local writer's changes were present.

Acceptance: Home starts the workspace; task creation/editing supports explicit Case or Firm scope with saved recurrence/reminders; Calendar exposes month/week/day/agenda and timezone-aware timed events; Library separates Case documents and Firm documents and owns Templates and Demo; scenario testing is reachable within Studio, not the main menu. Preserve AI proposal/review/apply, outcome reports, authority fences, drafts and immutable history. Verify meaningful server/controller tests, desktop/narrow browser workflows, full web/PDF gates, exact-source deployment and live audit.

## Live reference

Signed-in MyCase Home observed in IAB; further navigation encountered DNS failure. At the user's request, opened a separate Chrome window. Live Tasks shows due groups, priority, checklist progress, assignee and case filters. Add task explicitly permits no case, and offers checklist, reminders and assignments. Reference forms are cancelled without saving. No MyCase data changes.

## Implementation

Candidate implemented; not yet released. Home includes standalone firm work and a Library quick action. Tasks filters out events and offers direct creation/editing; scope and assignee are explicit. Calendar has day/week start-hour grids in addition to month/agenda, with selected display timezone and continuation handling. Firm documents use organization-scoped private R2, immutable D1 versions, exact-operation retries, content checksums and active-access revalidation. Library keeps case-document access in the existing evidence workflow; Templates and Demo are child destinations. Main-menu Simulations is removed; Studio retains Test scenarios and saved drafts.

Live Chrome also confirmed Calendar Staff/Day/Week/Month/Agenda, firm-document folders, and add-document upload/template/blank choices. No reference records were saved.

## Verification and review

- Initial focused suite: 32/32 pass, including real D1 migration/application and R2 upload/download/version checks, original receipt replay, conflicts, organization isolation and immutable history. Additional controller/calendar tests are being completed.
- Strict types and changed-module lint passed before final review refinements; repeat on the final candidate.
- Synthetic real-component browser: create firm task and read saved state; select weekly calendar and verify New York 23:30 becomes Paris 05:30 next day; Library menu, firm file table and upload form; keyboard cancel restores Upload document focus. A 390-CSS-pixel viewport measured document width 367px, with dialog width 333px, without page overflow. Temporary viewport overrides were reset. User previews on 4317/4318 were preserved; isolated preview uses 4321.
- Browser findings corrected: dialog centering, compact two-column desktop editor, checkbox sizing. Code review corrected reading-pane decoration leaking into update payloads and retained pending operations across read failures.
- UI fixture uses synthetic adapters; firm upload persistence/download acceptance comes from the actual route + D1/R2 test, not the fixture.

## Explicit scope boundaries

No desktop drive sync, e-signature, bulk upload, empty-folder creation, external calendar sync or email/push reminders. Existing case evidence upload remains case-scoped. Firm upload retains the existing synthetic/de-identified data gate. Templates are case/workflow starters, not a new Word mail-merge system. Day/week grid lists events at start hour (continuations at midnight), not draggable duration blocks. Latest 100 file versions are listed; earlier immutable files remain stored. No native release acceptance claim. Full web/PDF CI and production audit remain mandatory before release.

Final focused application set: 38/38 passed, zero skips/failures, including auditor/suspension checks, file retry recovery, calendar midnight boundaries and editing decorated reading-pane rows without losing workflow identity. Library return-context review added an explicit same-case/saved-Studio regression check. Canonical main advanced only in release/progress documentation to e2474c42; reconcile those updates without discarding them.

CI follow-up: candidate run 42316091121 caught unparenthesized SELECT CASE in the new, unpublished 0028 migration. Corrected both trigger expressions without changing existing applied migrations. The local full persistence/route run passed 41 checks with one migration-format failure caused by local CRLF in 0027; normalized that checkout file to its tracked LF format, then both migration gates passed (2/2). No test assertions or baselines were weakened. Full CI is rerunning before merge/deployment.

Final-candidate full run 42316952520: 2,020 passed, two failed, three inherited skips. Both failures were outdated menu destination assertions (Demo/Template links moved into Library by explicit request). Updated assertions verify all four Library destinations with organization/language context, Demo active state, retained scenario operations, and no Simulations main-menu label. All 33 targeted navigation/workspace checks pass. PDF visual job passed. Full final-head web/PDF verification is rerunning; no deployment yet.

Candidate 1934eaa9013101e2e1c37de388d964686cb46f7e passed full Root Web and PDF run 42318155565. Normal PR248 merge produced 92e52d8106aac6006e4d585b2892446e677d92b2; both task checkout and isolated release checkout are reconciled. Exact-main run 42319109880 is running. Production remains v191 until verified publication.

## Delivered - public v192

Published 7 November 2026 at 00:49:02 UTC through the existing Sites project. Runtime `92e52d8106aac6006e4d585b2892446e677d92b2`, normal [PR248](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/248). [Receipt](receipts/modules-redesign-v192-2026-11-07.json).

Candidate run 42318155565 and exact-main run 42319109880 passed: **2,022 tests, zero failures, three inherited skips**, PDF visual/bilingual/tax checks and zero-finding full/production dependency audits. The adopted CI artifact matches the exact Git tree and all 655 runtime inputs. Both live origins report the exact source and application/hosting hashes; each verifies **233/233 assets** (150 current, 83 retained from v191). Public audience/access revision 2, environment revision 42, DB and DOSSIER_DOCUMENTS bindings are unchanged.

Fresh signed-in production browser audit confirms Home's direct task/event editors, explicit firm/case scope, recurrence and shared in-app reminders, timed-event timezone/DST controls, day/week calendar grids, the four Library sections, and the firm upload form. Existing case/task remains visible (one accessible case, one completed task); no production records were changed, no files uploaded, and no AI provider requests made. Upload/task Cancel restores the initiating command. Measured production 390px viewport: document width 371px and dialog width 337px; no page overflow. The temporary viewport override was reset. No console errors were observed. Local synthetic authoring/persistence tests remain distinct from production read-only acceptance. Screenshot: local `.artifacts/modules-v192-task-editor.png`.

Minor audit follow-up: avoid duplicate recurrence validation text in the shared work editor, use scope-neutral reminder wording for firm work, and consider hiding Agenda range outside Agenda. These do not block creation or cancel/save controls. Broader limits above remain explicit. Rust, Android and Flutter checks pass on the release commit; iOS Native FFI and iOS Tax Application are still running at this checkpoint, not claimed as accepted. Documentation-only closure must not trigger another deployment.

## Calendar and reminder follow-up

MyCase groups Day, Week, Month and Agenda as alternative views. Its live Help Center confirms the selector and its reminder delivery options. The firm tenant returned a sign-in prompt on this pass. [MyCase Calendar overview](https://supportcenter.mycase.com/en/articles/9370065-calendar-overview)

Calendar now keeps the Agenda range within Agenda and remembers it across layout changes. Previous and Next follow the displayed period. Day shows one date. Recurring tasks show one first-date prompt and keep Save disabled until scheduling is valid. The reminder explanation covers firm and case work in English and Russian.

Fifteen focused scheduling, date-view and firm work tests passed. Release acceptance also checks the rendered toolbar and editor.
