# Workflow milestone scheduling — 8 November 2026

## Acceptance and reference

Firm administrators can name the date used by each task or event in a reusable template. A case contributor can apply a template, then review and save revised dates on that same case. The comparison programme recorded named workflow anchors and generated-work inspection in MyCase. The signed-in dashboard was available again on 8 November. CaseVant uses its own calendar icons, status badges, controls and date rules. [Comparison record](../development/MYCASE_COMPETITIVE_CYCLES.md)

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
