# Firm work and configurable workflow templates — 6 November 2026

Development branch: `codex/casevant-next-major`, following local checkpoint `01b303c`. Canonical main was verified at `6255ed49a4dc2e65bc2d42d8b3d4fdf01240342d` before this slice; the checkout was clean. Work stays in the isolated CaseVant checkout. No remote publication or production mutation is part of this checkpoint.

## Outcome and acceptance

- `/work` provides Tasks, Calendar and Workflow templates for the selected organization. Search, case, assignee and status filters work across accessible cases; Calendar groups dated tasks and all-day events by date in the chosen month. Undated work stays in Tasks. Links open the exact case and operational section.
- The server pages by case identity and checks both organization membership and explicit case grants, including the lookahead row. Organization ownership does not confer private-case access. The client accumulates all pages before publishing results and never presents a partial scan as complete. A same-authority refresh retains the last complete view with a refresh indicator; failures remove the results. Counts describe accessible cases, not every case in the firm. A scan is not a transactionally consistent point-in-time database snapshot.
- Owners and administrators can create/edit/archive/unarchive templates with 1–30 ordered steps, task/event types and signed calendar-day offsets. Other organization members can read templates; only case owners/contributors can apply them. Each save creates an immutable library revision and increments the changed template version.
- A case preview carries the selected template version. The application handler resolves it in the selected organization, rejects unavailable/archived/changed versions and transactionally checks the library revision. Generated work preserves the original title and version; later template changes do not rewrite it. Duplicate applications of the same version and anchor are rejected. Applying a newer version is a separate deliberate operation.
- Template edits participate in existing departure guards. Stale edits retain their draft and require comparison; ambiguous saves retain their exact original payload/key for recovery. Expiry hides private data while preserving same-user recovery; revocation clears it. Late responses cannot restore data after authority loss.
- AI-assisted Studio construction, proposal/review/apply flows and outcome reports remain separate. These new operations create no evidence approval, reported outcome or inferred legal deadline.

## Verification

- Final focused suite: **96 passed, 0 failed**. Persistence/controller/model/navigation/workspace/Studio-continuity/report tests cover pagination, access isolation, explicit case enrollment, organization revocation, exact replay, conflicting operation keys, stale versions, archival, immutable history, negative offsets, date limits, late responses, session recovery and preserved decision data.
- A fixture that directly inserted or removed participants was rejected by existing audit constraints. The final integration test uses the actual enrollment API and tests organization revocation after enrollment; it does not weaken those constraints. A case-grant-only removal with its complete audit transaction is not claimed as new integration coverage.
- TypeScript, targeted ESLint, D1 migration breakpoint checks, tax asset verification, 18-route mobile parity lock and the five-stage production build passed. Build log: `.artifacts/firm-build.log`. Final test log: `.artifacts/firm-tests-final.log`.
- Browser checks used real components/controllers with explicitly synthetic transport; real handler persistence was tested separately with Miniflare D1. Verified complete loading across 27 fixture cases; calendar/search filtering; template creation, ordered steps, signed-offset preview, concurrent-edit comparison, exact lost-response recovery, archival/version increment and custom-template application into case tasks/events.
- Verified focus moves into the new template title and returns to the workspace heading after save. Desktop rendering and Russian long text were inspected. Browser viewport override did not take effect, so narrow validation used a real 390-pixel iframe: inner width 390, document scroll width 375, no horizontal overflow. The override was reset. This is responsive-frame evidence, not physical-device testing.
- React review focused on authority-bound external stores, draft preservation, accessible input labels, visible focus, stable item identity, explicit error/loading states and avoiding partial aggregate results.

## Compatibility and limits

Migration `0025_workflow_libraries.sql` is additive and must run before enabling the new client. Back up the database before deployment. Old clients continue using built-in workflows; rolling back the frontend must retain both new operational tables and their history. No existing decision/package/AI/report schema or historical case carrier is migrated.

Templates support up to 100 entries including archived entries; plans retain their existing 200-item bound. Firm scanning stops with an explicit error beyond 200 pages (5,000 cases) instead of silently truncating. Steps use calendar days, not business-day/holiday/legal rules. Calendar remains date-only; timed events, recurrence, reminders and external synchronization are outside this slice. There is no template-history viewer or standalone task storage. Some controller/server feedback remains English in the Russian interface.

Production migration, full CI/PDF release gates and live AI-provider acceptance were not run. This is a local development checkpoint, not a deployment or full MyCase-parity claim.

Final remote check: canonical main remains `6255ed49a4dc2e65bc2d42d8b3d4fdf01240342d`; no remote `codex/casevant-next-major` ref exists. Main does not contain either local development checkpoint. Source is committed locally only.
