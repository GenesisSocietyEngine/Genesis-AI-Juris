# Home, work and Library redesign â€” 7 November 2026

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
