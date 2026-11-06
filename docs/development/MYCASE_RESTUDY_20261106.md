# MyCase UI/UX study and next implementation plan — 6 November 2026

## Evidence and direction

Read-only review of the signed-in reference covered the case register, calendar Month and Week views and view menu, unsaved Add event/reminder form, task list and due-date filter menu, sample task detail panel, sample case navigation, and applied workflow detail. No business record, comment, invitation, task or event was saved. Calendar was returned to Month and the browser to the original case register. The study concerns visible structure and interactions, not proprietary backend reconstruction.

| Observed MyCase workflow | Current CaseVant | Decision and acceptance |
| --- | --- | --- |
| Direct Calendar/Tasks/Cases destinations | Work views grouped under Firm work | Keep one compact application rail; expose work views without adding dashboard tiles. Preserve departure guards and organization context. |
| Month/Week/Day/Agenda/Staff view menu; Today and previous/next controls | Month-bounded agenda, timezone selector | Next: explicit Day/Week/Month agenda ranges and Today/previous/next. Do not call this an hourly calendar grid. Test year/month boundaries, Monday week boundary, display-zone date and cross-midnight events. Visual month/time grid follows separately. |
| Tasks grouped by overdue/upcoming date; due-range filter, assignee, case, completion, clear filters | Search/case/assignee/status filters and flat dated rows | Next: due-date scopes, clear filters, priority sort and explicit overdue cues, based only on recorded work. Completed work must not be labelled overdue. Test inclusive boundaries and undated records. |
| Selecting a task retains list context and opens details with subtasks, reminders, history, edit | Selected-work reading pane with Open in case | Retain list/reading pane; improve scan labels and navigation rather than copying a website hero. Preserve exact case/item identity and hidden/unauthorized selection fences. |
| Event form has linked/standalone mode, start/end, all-day/repeats, location, reminder recipients/channel, private/sharing options | Case-linked zoned events, single shared in-app reminder | Retain clear in-app-only disclosure. Add location and recipients only with separate authority/data design. No implied popup/email delivery, private-event security or external sync. |
| Workflow application stores named anchors and lists generated tasks/events with dates and assignees | Versioned templates, single anchor preview, applied progress | Next execution slice after triage: grouped applied-work inspection with exact source version and open/completed records. Multi-anchor rebasing requires preview/conflict rules and immutable history. |
| Case table exposes next task/event and status update | Case catalogue plus work aggregation | Follow-on: authorized next-work summaries, no projections masquerading as recorded work. |

## Delivery order

1. Publish the reviewed scheduling and Outlook-layout candidate through PR229, full web/PDF checks, exact-main artifact and existing Sites audience/bindings.
2. Implement bounded read-only work triage and navigable agenda ranges on the next-major branch after reconciliation with canonical main. Accept with date-boundary tests, real-component browser selection/filter/reset checks, narrow Russian labels, lint/type/build and preserved workflow/report contracts.
3. Add visual month/week calendar with overlap handling and keyboard navigation. Keep a readable agenda alternative and explicit timezone/all-day separation; no drag rescheduling until guarded preview and save contracts exist.
4. Improve applied workflow inspection and execution; separate reusable templates, application instances and actual completion. Defer dependency chains and anchor rebasing until conflicts, idempotency and history are specified.
5. Add authorized case next-work summaries and contacts/intake; then explicit notification delivery integrations. Communications, billing and private/shared event models need their own data/authority and acceptance design.

AI-assisted proposal/review/apply and case outcome reporting remain independent. No scheduling action approves evidence, selects a legal decision or certifies an outcome. All follow-on scope keeps the user's Outlook-style application direction: compact commands, stable navigation, lists and reading panes.

## Reference pages

- https://maxima-consult.mycase.com/court_cases
- https://maxima-consult.mycase.com/events
- https://maxima-consult.mycase.com/tasks
- https://maxima-consult.mycase.com/court_cases/51865796/workflows (vendor sample case)

Public/production acceptance is recorded separately from the synthetic UI harness and model/handler tests. No new live provider AI acceptance is implied.
