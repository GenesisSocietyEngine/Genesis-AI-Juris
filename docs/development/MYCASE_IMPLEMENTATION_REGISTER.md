# MyCase → CaseVant inspection and implementation list

Updated 5 November 2026 against public v180 (`9322f6b`). This list carries forward the earlier inspection; its observation points are not all implemented. “Present” means found in source, while “shipped” refers to the verified v180 release. MyCase was inspected read-only in Edge; no business record or communication was submitted.

| Priority | Observation / requirement | Current disposition and next acceptance |
| --- | --- | --- |
| Shipped | Document inventory alongside reader, exact version/source identity and case-section shortcuts | PR226/v180. Preserve immutable originals, selection and guarded edits. Authenticated all-case acceptance remains separate. |
| Shipped | AI-assisted case-flow preparation | PR227/v180 adds the editable EN/RU outline to existing explicit analysis → proposal review → apply. It does not execute tasks or introduce a new AI engine. |
| Current slice | MyCase task register filters by assignee, completion, priority and due groups | Refactor existing CaseVant information-request queue with combined filters, chronological groups, explicit empty/reset states and exact-target visibility. Receiving a source must not imply evidence acceptance. |
| Next | General operational tasks | Separate task entity from information requests and graph nodes; assignee, priority, due date/timezone, checklist, estimate and audit history. Prove explicit save, duplicate-safe retry, stale-update conflict and cross-case access refusal before adding bulk completion. |
| Next | Case and document organisation | Add governed collections/folders and tags using exact document IDs; show selected version and history. Define move/rename permissions and conflict behaviour; never rewrite original files. |
| Next | Case register and lifecycle | Extend current filters with practice area/stage/responsible staff, clear open/closed views and saved filters scoped to identity/organisation. Closing preserves records/history. |
| Next | Contacts and staffing | Separate directory identity, case relationship, staff role and billing rate. Same-name contacts require stable identity disambiguation. Linking a contact must not silently grant portal access. |
| Later | Workflow templates and runs | Versioned templates, anchor dates, preview of generated tasks/events, generated IDs and idempotency. Rescheduling must explicitly handle completed tasks and retain provenance. |
| Later | Reminders and calendar | MyCase form exposes reminder recipient, delivery, amount/unit before task; creator controls edits. Model timezone and delivery receipts, cancellation, duplicates and permissions before sending. Calendar dates and calculated legal deadlines need different provenance. |
| Later | Client task assignment | MyCase warns that assigning a task to a client sends a portal link. Treat this as an explicit external-sharing/notification action, with recipient and visibility review. Never infer consent from contact linkage. |
| Later | Intake, notes and status updates | Keep inquiry/lead state separate from opened cases; preserve draft text and attributable history. Next inspection: intake field/template editor, notes and case-stage/status history. |
| Later | Communications | Distinct draft/sent/received/delivery states for email, SMS, call notes and portal messages, plus case filing and channel permissions. No outbound-message acceptance has been performed. |
| Later | Time, expenses, billing and trust | Keep draft work, posted invoices, payments and trust ledgers separate. Establish arithmetic, adjustments, reconciliation and domain acceptance before money movement. |
| Later | Document editing, templates and integrations | Full preview/version replacement/concurrency remains unobserved in the empty MyCase sample library. Inspect populated authorised examples or documented product flows; test configured providers separately. |
| Later | Reports | Define permission scope and source reconciliation per financial/productivity/case report. A visible report catalogue is not accounting acceptance. |

## New observations from this pass

MyCase’s firm task register has Open case status, Me assignment and Incomplete defaults; case/lead and due-date filters; Apply/Clear controls; unread-only, grouped due rows and page-size controls. Columns separate task identity, checklist progress, priority, due date, case/lead and assignee. The Add task form permits a case/lead or an explicitly unlinked task, editable checklist, priority, shared description, optional time estimate and reminder rows. The client-assignment notice and reminder ownership rule are explicit. The unsaved form was cancelled after inspecting a reminder row; delivery and task-completion behaviour remain untested.

## Boundaries and order

Complete and verify the information-request queue first. Then define the operational-task persistence contract and task-to-case permissions before adding task creation, checklist completion or workflow scheduling. Continue inspecting MyCase’s task details/checklists, workflow template dependencies, notes and intake forms as each corresponding slice begins. Keep every release tied to a reviewed PR, canonical CI, exact merged build and live receipt. No invented saved data or provider capabilities should appear in the product.
