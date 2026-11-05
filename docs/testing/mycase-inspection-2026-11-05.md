# MyCase inspection follow-up

5 November 2026. Read-only inspection of the signed-in Edge workspace, using its built-in sample matter. No case, task, workflow, time entry or payment was submitted.

| Screen | Observed interaction | CaseVant acceptance requirement |
| --- | --- | --- |
| Case register | Open/closed views; practice-area, lead-attorney, stage and date filters; my-cases switch; next task/event and status update columns | Filtered lists retain exact case IDs and links; closing a case preserves its history and access rules. |
| Documents | Search, drag/drop intake, breadcrumb; Add menu offers document, document from template, eSignature from template, advanced template, folder and default folders | Separate file intake, reusable folder sets, template generation and signature envelopes. Show exact current version beside history and access. |
| Document integrations | Desktop Access for MyCase Drive, Word automation access, InfoTrack filing | Provider availability and configuration must be tested separately; visible buttons do not prove working integration. |
| Applied workflow | Named retention date, applied-to case, applied date/user, date-grouped tasks and events, assignees and checklist progress; edit dates/remove workflow | Store template version and each run's trigger dates and generated object IDs. Preview rescheduling and define what happens to completed tasks. Preserve run provenance. |
| Case tasks | Assignee and incomplete-status filters; bulk selection; overdue grouping; priority, due date, assignee, completion control; checklist progress | Operational tasks are separate from reasoning graph nodes. Task publication needs explicit review and idempotency; completing a task must not assert that evidence is accepted. |
| Billing overview | Un-invoiced balances split into time/expenses; allocated and unallocated trust balances; billing settings, totals and running trust balance | Separate billing arrangements, billable work, invoices, payments and trust balances. Use financial/domain acceptance before money movement. |
| Time entries | Date filters, bulk actions, activity, duration, description, rate, total, status and user; edit/duplicate/delete controls | Preserve posted invoice lineage; define adjustment versus editable draft state. |
| Add time entry | Single/bulk modes; case, user, activity, billable flag, invoice-visible description, custom fields, date, rate/unit and duration; Save and Save and new | Explicit save with duplicate-safe retries; consistent duration/rate arithmetic; clear invoice-visible fields. The form was inspected and closed without saving. |
| Communications | Separate messages, call log, text messages, emails and chat conversations | Case filing and permission rules per channel; distinct draft, sent, received and delivery states. No message was sent. |
| Contacts and staff | Contact group/role, phone and email; link/unlink controls; staff case rate; lead and originating attorney | Separate directory identity, case relationship, staff membership and billing rate; contact linkage alone must not grant portal access. |
| Calendar | Case events grouped by date, time, title, type and users; Add event and Court Rule trial controls | Explicit timezone and rule provenance; distinguish user-entered dates, calculated reminders and validated deadlines. |
| Reports | Accounting, financial, productivity, case/contact and leads catalogues; saved reports; receivables, aging, trust, WIP, limitation dates and pipeline views | Define metrics and scope for each report; export must preserve permission boundaries and reconcile to source records. Catalogue inspection does not establish accounting accuracy. |

The sample document inventory was empty. File preview, version replacement, concurrent editing and client download controls therefore remain documentation-supported requirements, not observed end-to-end acceptance. No provider integration, eSignature, payment or client communication was executed.

## Next bounded implementation

Add an optional structured outline to the existing AI case-flow prompt: objective, parties/roles, disputed issues, known dates, evidence references and alternatives. Preparing the brief appends editable headings without overwriting the existing prompt or changing the graph. Use the existing brief buffer and departure protections instead of a second unsaved form. The current explicit analysis, proposal review and reversible application remain the execution path.

Acceptance: no silent prompt truncation; no cross-case/account carryover; no source selection claim when the provider still receives the current graph; no automatic provider request, task creation, deadline calculation or case save. Preserve keyboard focus, EN/RU labels, narrow layouts and existing canonical Markdown import.

## Integration checkpoint

PR #226 at `feb6fcbdabd4ec62575c2f33de224f20ea55215d` passed all six candidate workflows and code review without findings. It merged normally as `d411fc631eb2bfe2a9eb892a2a75323fbd393d69`. The first iOS application attempt timed out waiting for the product navigation menu during `legacy-write`; attempt 2 passed. Candidate web CI reports 1,924 passed, zero failures, three inherited skips, two HTML checks, passing PDF locks and zero dependency findings. Exact-main release checks started after merge; this checkpoint is not a deployment receipt.
