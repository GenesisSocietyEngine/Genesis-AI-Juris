# CaseVant / MyCase comparative delivery programme — 6 November 2026

The user requests five complete comparison, amendment, test, publication and post-publication audit cycles. v181 is the starting production baseline, not one of these five cycles. Preserve the Outlook-style navigation, compact commands, contiguous lists and reading panes. Do not copy vendor assets or represent unimplemented integrations as working features.

## Evidence

Signed-in, read-only MyCase inspection covered cases, tasks/detail panels, date filters, Month/Week calendar and view menu, unsaved event/reminder form, applied workflows, contacts, report categories and document/communication/billing navigation. Returned the reference to Cases without saving records. Visible navigation establishes feature presence, not verified backend behaviour. Reference: https://maxima-consult.mycase.com/court_cases, /events, /tasks, /contacts/clients and /reporting/dashboard.

CaseVant v181 production loads authenticated firm Tasks, Calendar and Workflow templates with an accessible synthetic case. No production record was created or changed. Both deployed origins identify exact main 5e04db955d73102064a07498fdf1a86af8a3def8; 202/202 current/retained assets verify. Provider AI execution and new production scheduling writes remain separate acceptance items.

## Feature coverage and implementation requirements

| Capability | MyCase reference | CaseVant baseline and required acceptance |
| --- | --- | --- |
| Case register and workspace | Case number/stage/owner, next task/event, status updates | Existing cases, access and history retained. Add next-work retrieval from actual authorized records; no predicted deadlines. |
| Tasks | Due scopes, priorities, assignees, subtasks, detail pane | CRUD/checklists/assignment/finite recurrence exist. Cycle 1 adds triage and priority sorting. Verify stale selection, unassigned and completed work. |
| Calendar | Day/Week/Month/Agenda/Staff, navigation | Zoned events and cross-day agenda exist. Cycle 1 adds ranges; later cycle adds a visual month with an accessible agenda alternative. Never infer a statutory date. |
| Reminders | Recipient/channel/offset controls | Shared in-app reminders only. Email/push/external calendar sync remain missing integrations; require delivery receipts, retry/deduplication and recipient authority before being called supported. |
| Workflows | Named anchors and generated task/event inspection | Versioned templates and explicit preview/apply exist. Add grouped application inspection, immutable source identity and progress. Multi-anchor rebasing remains a separately specified conflict workflow. |
| Contacts | People/companies, groups, linked cases, archive/import | Case participants exist. Add an authorized cross-case participant directory; do not equate it with a complete standalone CRM or merge people by display name. Standalone contacts/import require an additive model and duplicate review. |
| Documents | Case/firm documents, templates, signatures, intake | Existing case uploads, evidence links, requests and source review retained. Firm library, signatures and intake forms are gaps requiring their own durable models and provider acceptance. |
| Communications | Email, messages, call log, text, comments | Existing case collaboration/history is not mailbox/SMS delivery. Track those as gaps, with explicit recipient review, delivery status and consent requirements. |
| Billing/payments/accounting | Time, expenses, invoice drafts, trust reports, payment plans | Not implemented as practice accounting. Never present hypothetical case amounts or tax calculations as invoices, a ledger or trust accounting. Requires independent currency/tax/audit/permission design and payment-provider acceptance. |
| Reports | Operational/productivity/financial reports | Case outcome and evidence/decision reports preserved. Operational summaries must label recorded scope and completeness; financial report parity is not claimed. |
| AI differentiation | Not assessed in the visible reference | Preserve CaseVant proposal → review → apply, source/evidence linkage, scenario comparisons and outcome reports. AI suggestions must not silently persist tasks or certify evidence/outcomes. |
| Access/history | Firm/client membership surfaced | Preserve server authorization, account/org fences, pagination completeness, immutable revisions, idempotent retries and unsaved-work guards in every cycle. |

Every important category above stays in the implementation backlog until actually accepted. Five UI iterations are not a claim of complete MyCase feature parity; unfinished integration categories must remain explicit rather than be replaced with placeholder screens.

## Five-cycle ledger and acceptance

1. **Work retrieval:** publish PR230 due scopes, priority sorting and Day/Week/Month agenda navigation. Audit the deployed controls and selection behaviour.
2. **CaseVant icon language:** create original vector icons with consistent 24-unit geometry, restrained blue/teal accents and readable labels. Apply to navigation, case sections and common work actions. Audit contrast, narrow labels, focus and decorative SVG semantics.
3. **Calendar orientation:** implement a visual month grid linked to existing event/task details, retain agenda, explicit timezone/all-day semantics and keyboard controls. Test month boundaries and overlapping/cross-day events; audit production navigation.
4. **People and case retrieval:** surface case participants across accessible cases with exact identities and case links, search and active status. No inferred identity merges or new access grants. Test identity collisions, revocation and complete aggregation; audit production empty/populated states.
5. **Workflow execution clarity:** group applied workflows by exact case/application identity, show source version/anchor and recorded completion, and link to ordinary case editing. Audit the full journey from template preview to generated-work retrieval without changing the AI/report pipeline.

The order may change only for a concrete finding or dependency. Each cycle must have its own reviewed source commit, full required web/PDF CI, ordinary main integration, exact-source deployment receipt, preserved environment/audience/bindings and post-deployment audit. Record actual failures and corrections; do not count an audit, screenshot or duplicate deployment as a completed implementation cycle.
