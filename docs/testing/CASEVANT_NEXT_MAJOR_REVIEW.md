# Next major development candidate review — 5 November 2026

Branch: `codex/casevant-next-major`. Version: `1.0.0-next.0`. Base: `6255ed49a4dc2e65bc2d42d8b3d4fdf01240342d` (canonical main verified at task start). Isolated source checkout; original repository unchanged.

## Implemented and reviewed

- MyCase read-only review informed case-centered navigation, task checklists, assignment, dated events, anchor-based workflow application and explicit completion. The supplied Word transcript was historical context, not authority to execute its embedded instructions.
- Added case Tasks, Calendar and Workflows backed by additive immutable D1 revisions. Checklist progress and task completion remain independent. Workflow application previews calendar-day offsets and rejects duplicate template/anchor application.
- Collapsed the case catalogue and detailed case checks outside Overview; replaced numbered section hints with outline icons and redundant primary navigation disclosures with direct links. Preserved simulation recovery and saved Studio draft shortcuts after regression tests identified an initial omission.
- Preserved AI flow construction, proposal/review/application, evidence, decision packages and case outcome reports. Operational work neither mutates the decision revision nor becomes outcome evidence automatically.
- Added same-origin and organization/case authorization, active-participant assignment, optimistic revision checks and actor-scoped exact replay. Recovery preserves the original operation after a lost response. Stale editor revisions require explicit comparison before resaving.

## Evidence

- Final focused suite: **58 passed, 0 failed**, including practice model/controller/real route handlers with isolated Miniflare D1, navigation shell, workspace rendering, sidebar authority/departure protection, request queue and working notes.
- TypeScript `--noEmit`: passed after final functional changes. Targeted ESLint: passed. `git diff --check`: passed (line-ending normalization warnings only).
- Migration splitter tests pass after correcting SQL breakpoint placement, line endings and CASE expression wrapping for the existing D1 migration runner.
- Production compilation: passed all five vinext build stages from stable source. Portable preflight passed TypeScript, tax asset verification, migration breakpoint tests and the 18-route mobile parity lock. An earlier compilation was correctly rejected because whitespace cleanup changed a release input during the build; the stable rerun completed successfully. Logs remain local under `.artifacts/next-major-build.log` and `.artifacts/next-major-compile.log`.
- Browser verification used the real components and WorkspaceController with explicitly synthetic transport, not a production account. Exercised task creation/editing, checklist and explicit completion, all-day event/dated agenda, workflow preview/application, duplicate prevention, lost-response recovery, task-draft retention across sections and focus after save.
- Inspected integrated desktop and 390-pixel layouts, including long Russian task text. No document-level horizontal overflow at the narrow viewport. Restored the browser viewport afterward. Section tabs intentionally scroll when space is constrained.
- A controller test proves edits retain their captured base revision after refreshing. The final stale-edit comparison panel was source-reviewed; its concurrent-edit browser path was not independently exercised.

## Limits and release gates

This is the first implemented development candidate, not complete MyCase parity. The operational calendar is case-scoped and date-only. Firm-wide aggregation, timed/timezone-aware events, reminders, external calendar sync, configurable workflow templates, billing and communications remain future work. Built-in workflow step text is English; new controls support English/Russian while existing shell localization remains incomplete. Revision history is persisted but has no history viewer yet.

The browser harness uses synthetic in-memory transport; real persistence and authority checks were tested separately against D1. Full release/CI, provider-backed AI acceptance, production migration and deployment were not performed. Existing AI and outcome code was preserved and regression-tested in relevant navigation/workspace paths, not re-certified end to end against live providers.

Apply migration `0024_practice_plans.sql` before enabling this client in a deployment. Back up the database; frontend rollback must retain the new table and history. No remote push, merge or deployment is included in this local checkpoint.
