# Workflow milestone scheduling — 8 November 2026

## Acceptance and reference

Firm administrators can name the date used by each task or event in a reusable template. A case contributor can apply a template, then review and save revised dates on that same case. The comparison programme recorded named workflow anchors and generated-work inspection in MyCase. The signed-in dashboard was available again on 8 November. CaseVant uses its own calendar icons, status badges, controls and date rules. [Comparison record](../development/MYCASE_COMPETITIVE_CYCLES.md)

MyCase documents named trigger dates on templates and later date changes from the case where a workflow was applied. CaseVant follows that case-level scheduling pattern and previews how it treats individual work before saving. [Creating and applying workflows](https://supportcenter.mycase.com/en/articles/9370081-creating-and-applying-workflows) · [Editing dates on an applied workflow](https://supportcenter.mycase.com/en/articles/9370078-editing-dates-of-previous-workflow-templates)

## Changes and preservation

- The template editor accepts positive, zero and negative calendar-day offsets. Steps sharing a milestone use the same date. Existing templates use Workflow start. The built-in Filing and review template supplies a two-date example.
- Case Workflows previews additions, changed dates, and dates kept with a reason. Case Overview, Tasks, Calendar and the firm workflow reading pane use the same case and recorded work. Saving requires a reviewed preview matching the case revision and template version.
- Completed tasks, manual dates, timed appointments, reminders and recurring occurrences retain their individual schedules. Previously held items keep that protection across subsequent milestone changes. A template edit or archive preserves the version and offsets already applied to a case.
- Migration 0033 adds two append-only tables. The practice plan and template library retain their original storage format. Older applications reconstruct the initial offsets from their first immutable case revision. Date updates and their case revisions commit in one transaction. Retry returns the original receipt.
- Case membership and organization selection guard reads and writes. Workflow writes also require an open case and a writable organization role. The source version stays in the firm reading pane’s collapsed technical details.

## Verification

The isolated browser fixture uses the real case and firm clients, case access checks, request handlers and a populated local D1 database. The desktop journey created a two-milestone firm template, returned to the same case, previewed both steps and received a case save receipt. Rescheduling a second workflow showed an individually moved step and a completed step as kept. Two open steps moved. Reload displayed the saved values and the original completion count. Keyboard focus reached the preview and its explicit save command. At 390 pixels, the Russian editor fit within the available width and the preview command measured 44 pixels high.

The regression suite covers historical applications, leap dates, both year boundaries, bad or missing dates, template archival, exact retries, case access, a stale revision, concurrent saves, rollback and populated pre-upgrade data. The release record below distinguishes production navigation from local writes.

## Scope

Milestones use calendar days. A professional enters the intended dates. Recipient delivery, professional deadline rules and Outlook/Google synchronization are separate roadmap items.

## Production acceptance — v199

[PR #261](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/261) merged as `536713a2abb95980d8979e39201ba9e805e872e8`. The [merged web and PDF checks](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42529089118) passed with 2,048 tests and 3 inherited skips. Both production origins verified the same source, the configured database and document bindings and all 208 browser assets. The release preserved the existing audience and environment. [Release receipt](receipts/workflow-milestones-v199-2026-11-08.json)

On the signed-in public site, the existing governed synthetic case opened its Workflows tab. Filing and review prompted for both dates and showed four proposed additions. Discard cleared the preview. Firm workflow templates retained the governed case, and Return to your case reopened its Workflows tab. The accessible firm had no applied workflows. Application, rescheduling and receipt recovery were exercised with synthetic storage. Production case records received no writes during this audit.
