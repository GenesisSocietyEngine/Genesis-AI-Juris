# GENESIS: AI Juris mobile v0.5.0+5

## Event lifecycle and deadline integrity patch

This patch fixes three state-lifecycle defects in the Flutter demo repository.

### Independent ERP expert

- Expert engagement now has an explicit lifecycle:
  - `notCommissioned`
  - `pending`
  - `reportReady`
  - `reviewed`
- Commissioning schedules the report for two simulation days later.
- Rest processes the asynchronous event when the due day is reached.
- The commissioning message becomes `RESOLVED`.
- A new action-required message, `Technical assessment ready for review`, appears.
- Reviewing the report:
  - adds the expert report to evidence;
  - increments `knownFactsRevision`;
  - improves merits, evidence, leverage, and case strength;
  - makes an updated AI damages model available when the prior model is stale.

### Deadline status progression

- Deadlines no longer remain `OPEN` after their due moment.
- Rest evaluates the new simulation day and changes overdue deadlines to `MISSED`.
- The eight-hour document review also evaluates the Day 1 partner-brief deadline.
- Missing a deadline applies explicit, explainable consequences.
- Calendar rows use distinct icons for `OPEN`, `DONE`, and `MISSED`.
- Missed deadline details display the consequence.

### Executable deadline actions

- `Partner risk brief` now links to `Prepare partner risk brief`.
- `Evidence-preservation notice` now links to `Issue evidence-preservation notice`.
- The deadline detail sheet exposes `Open related action` while the action remains eligible.
- The standard Yes/No action confirmation is preserved.
- Completing an action changes its deadline to `DONE` and removes the action.

### Regression coverage

Added or updated tests for:

- recurring rest progression from an eligible state;
- deadline action availability;
- deadline completion and missed-state transitions;
- executable preservation notice;
- expert report arrival and review;
- deadline detail sheet exposing the related action.

## Required restart

Apply this patch with the app stopped, then run a full restart. Hot reload cannot safely preserve an existing `GameSnapshot` after new lifecycle fields are introduced.
