# MyCase inspection and request queue — 5 November 2026

## Baseline and intended outcome

Clean canonical main and live Sites v180 both identify `9322f6b74d7e699d2053e11c45b0220cab0f6596`. This task owns branch `codex/request-queue-20261105`. No dependency, schema or permission changes are planned.

Help case workers find the next information request by responsible person, priority and due state. Preserve exact request/document identities, existing response and creation forms, explicit receipt confirmation and review authority. Filters must not hide an incoming exact request target, overwrite form buffers or carry into a different case. Invalid/missing dates must not be classified as overdue. Received, waived and cancelled requests remain separate from open work. Review the real component at desktop/narrow sizes and preserve the existing route/controller tests.

## Additional MyCase observations

Read-only Edge inspection of Tasks and its Add task form: firm register has case status, assignee, completion, case/lead and due-date filters, Apply/Clear, unread-only and paginated grouped rows. Rows expose priority, subtasks, due date and assigned person; overdue is a separate group. The add form supports case/lead or explicitly unlinked tasks, a checklist, priority, description, optional time estimate and reminder rows. The description is visible to people sharing the task. Client assignment is accompanied by a notice that the client receives a portal link. Reminder rows specify recipient, delivery choice, quantity and unit before the task; the form says only their creator can edit reminders. One reminder row was opened in the unsaved form, then Cancel returned to the register. No task, reminder, client communication or billing entry was submitted. Completion, notification delivery, scheduling and provider integration were not exercised.

## Scope

This slice refactors the existing information-request queue. It does not represent general operational tasks, publish an AI graph as work, add reminder delivery or mark evidence accepted. Separate operational tasks/checklists and workflow runs remain on the implementation list.

## Implementation and review

Extracted an EN/RU queue with search, status, priority and responsible-person filters, explicit reset/count/empty states and chronological groups. Existing requested participant IDs are retained by normalization so identical display names remain distinct; IDs are shown only where needed to disambiguate names. Open overdue/upcoming/undated records are separate from received/waived/cancelled and unknown statuses. The queue updates its clock each minute and cleans up its timer on unmount. The original cards and source-response/create/deadline handlers remain intact. A case-keyed queue resets filters; an incoming exact target outside the filters is rendered separately without selecting another record. No persistence fields or API writes are added.

Twenty-two focused checks pass: queue date/identity/filter invariants, document interactions, workspace rendering and request/activity route contracts. Strict TypeScript and changed-file lint passed. React review found no added data fetch, persistence state, dependency or context-provider boundary; derived filters stay local to the queue.

Actual browser review used a synthetic fixture rendering the production RequestsSection and RequestQueue. Combined priority/person filters retain a typed request-creation buffer. Opening exact request B outside filters shows it separately; keyboard activation selects B, choosing source B then clearing filters preserves both and the unsaved creation text. Confirm receipt calls the fixture callback with exactly request_b/doc_b. This callback is not a production write. Switching the synthetic case resets filters; EN/RU controls and desktop layout were reviewed. Actual 390 × 640 has document and scroll widths of 375 px. The initial fixture lacked Next's process.env build definition and production global box sizing; correcting the fixture resolved its startup error and diagnostic overflow. Neither was a product failure; no newer browser errors appeared after the correction.

Existing surrounding task forms/cards retain their inherited English wording; the new queue controls are bilingual. Authenticated production workflow acceptance, actual API save/reload and broad MyCase task parity are not claimed by this component test. Full canonical CI and exact-source release remain pending at this checkpoint.
