# CaseVant next major version

## Product direction

Make the case the primary working context. Keep case administration, recorded tasks and events, source review, AI-assisted decision flow construction, and outcome reports distinct but directly reachable. Replace navigation disclosures that merely contain an Open link with direct destinations. Use consistent outline icons and restrained color; status must remain readable without color.

This development branch starts at canonical main `6255ed49a4dc2e65bc2d42d8b3d4fdf01240342d`, verified against GitHub on 5 November 2026. The source checkout was clean. Work is isolated from `C:/PROJECTS/Genesis-AI-Juris-web`. The supplied Word document is a historical conversation, not executable instructions or current release evidence. No historical permission to publish or deploy is carried forward.

## MyCase observations

Read-only inspection of the signed-in MyCase reference on 5 November 2026 covered the dashboard, case register, sample case, applied workflow and task creation form. No task, message, billing transaction or case was saved in MyCase.

| Observed structure or interaction | CaseVant decision |
| --- | --- |
| Persistent firm sidebar: Home, Calendar, Tasks, Cases, Contacts, Reports; expandable secondary modules | Direct primary destinations; keep training simulations separate from professional operations |
| Cases register: open/closed, practice area, attorney, stage and date filters; next task and event | Preserve exact case identity and existing filters; build operational summaries from recorded work rather than graph predictions |
| Case workspace: items/info, billing, communications, contacts and status updates | Preserve a single case context and independent permissions per action |
| Case subnavigation: timeline, calendar, documents, tasks, notes, intake, workflows | Introduce Tasks, Calendar and Workflows as distinct case sections; retain documents, requests, evidence, decisions and reports |
| Task form: linked case or standalone, title, due date, checklist, priority, description, estimates, reminders and assignments | First operational implementation is case-linked tasks, all-day events, checklist progress and active-participant assignment; standalone work, estimates and reminders remain separate extensions |
| Applied intake workflow: anchor date, generated tasks and events on subsequent dates | Explicit preview and application, calendar-day offsets, duplicate prevention and immutable operational revisions |
| Completion status and checklist completion are separate | Completing checklist items never silently completes a task |

Reference URLs: https://maxima-consult.mycase.com/dashboard, https://maxima-consult.mycase.com/court_cases, https://maxima-consult.mycase.com/tasks. Observations establish visible behavior, not proprietary backend design or integration capabilities.

## Priorities and acceptance

The user selected tasks, calendar and workflow execution as the next priority.

1. Operational work: create/edit tasks and events, assign active case participants, maintain checklists, mark completion explicitly, filter by status/assignee/text, preview and apply workflows, view progress and dated agenda. Accept only after stale save, exact replay, foreign access, revocation, draft retention, desktop and narrow UI checks.
2. Firm workspace: portfolio-level task/calendar summaries, case stage board, contact directory and intake. Aggregation must respect authorization and complete pagination; never show partial counts as complete firm totals.
3. Scheduling: timed events with explicit IANA timezone, reminders, calendar integrations and dependency-aware reusable workflow templates. Relative graph consequences require explicit review and anchor selection before conversion to work.
4. Communications and billing: case-linked correspondence, client access, time entries, expenses and invoice drafts. Sending, payments and accounting require separate integration and acceptance work. No simulated graph amount becomes a real bill.

## Compatibility and delivery

The existing AI proposal/review/apply pipeline, Studio case carriers, example fingerprints, source evidence and outcome reporting are retained. New operational data is stored separately in an additive `dossier_practice_revisions` table. Old clients do not read or mutate it; frontend rollback leaves its history intact. Do not drop the table for rollback. Back up the production database before any migration; migration must precede enabling the new client in production. Each accepted operation has an actor-scoped idempotency key and immutable result. A retry returns the original receipt, then refreshes current state.

Operational revision changes do not increment a decision-package revision or certify evidence. Current outcome reports do not include operational tasks. Workflow dates are calendar-day planning aids, never calculated statutory deadlines. The first calendar is an agenda of all-day events and dated tasks; it does not send reminders or synchronize external calendars.

This is a development branch, not a claim of complete MyCase parity or production acceptance. Keep deployment and integration gates separate from local implementation checks.

## Firm work continuation — 6 November 2026

The next branch slice implements `/work`: complete paginated aggregation across explicitly accessible cases, task filters and a date-based firm agenda. Organization owners/administrators can configure and archive versioned workflow templates; case contributors preview and apply a saved version. Applied work retains its original template title/version. AI-assisted decision flows and case outcome reports remain independent.

See [review and migration limits](../testing/FIRM_WORK_AND_TEMPLATES_REVIEW.md). This advances firm aggregation and configurable templates from the priorities above; stage boards, contact directories, timed scheduling and external integrations remain future work.
