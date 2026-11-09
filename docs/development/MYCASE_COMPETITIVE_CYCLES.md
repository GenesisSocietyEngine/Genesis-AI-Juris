# CaseVant / MyCase comparative delivery programme — 6 November 2026

The user requests five complete comparison, amendment, test, publication and post-publication audit cycles. v181 is the starting production baseline, not one of these five cycles. Preserve the Outlook-style navigation, compact commands, contiguous lists and reading panes. Do not copy vendor assets or represent unimplemented integrations as working features.

**Completed 6 November 2026:** all five core-operation cycles are published and audited, through public v186. [Evidence and receipts](../testing/MYCASE_FIVE_CYCLES_REVIEW.md), [working guide](CASEVANT_FIRM_WORK_GUIDE.md), [CaseVant Line icon rules](CASEVANT_LINE_ICONS.md). Broader feature gaps and acceptance requirements below remain open; completion of five cycles is not full MyCase parity.

| Cycle | Published change | Live version | Exact-main web/PDF gate |
| --- | --- | --- | --- |
| 1 | Due scopes, priority sorting, navigable agenda | v182 | 42142501452 passed |
| 2 | Original 34-symbol icon family and keyboard-accessible month grid | v183 | 42145703468 passed |
| 3 | Cross-case participant directory with exact identities | v184 | 42147257309 passed |
| 4 | Applied workflow source/anchor, completion and generated-work retrieval | v185 | 42149398518 passed |
| 5 | Case next task/event and attention counts | v186 | 42151245158 passed |

Final runtime: `14f6f128cae758981d97bf600f7cc3cd85f56eba`. Both origins report that source and verify 197/197 current/retained client assets. Public access revision 2, environment revision 42/all 13 returned representations and DB/DOSSIER_DOCUMENTS bindings are unchanged. No production case record was written during these five live audits.

## Evidence

Signed-in, read-only MyCase inspection covered cases, tasks/detail panels, date filters, Month/Week calendar and view menu, unsaved event/reminder form, applied workflows, contacts, report categories and document/communication/billing navigation. Returned the reference to Cases without saving records. Visible navigation establishes feature presence, not verified backend behaviour. Reference: https://maxima-consult.mycase.com/court_cases, /events, /tasks, /contacts/clients and /reporting/dashboard.

CaseVant v181 production loads authenticated firm Tasks, Calendar and Workflow templates with an accessible synthetic case. No production record was created or changed. Both deployed origins identify exact main 5e04db955d73102064a07498fdf1a86af8a3def8; 202/202 current/retained assets verify. Provider AI execution and new production scheduling writes remain separate acceptance items.

## Feature coverage and implementation requirements

| Capability | MyCase reference | Current CaseVant coverage and remaining acceptance |
| --- | --- | --- |
| Case register and workspace | Case number/stage/owner, next task/event, status updates | Existing cases, access and history retained. Cycle 5 delivers next-work retrieval from actual authorized records. v198 adds operational stages, dated updates and private views alongside formal status. |
| Tasks | Due scopes, priorities, assignees, subtasks, detail pane | CRUD/checklists/assignment/finite recurrence exist. Cycle 1 delivers triage and priority sorting, with stale-selection, unassigned and completed-work acceptance. |
| Calendar | Day/Week/Month/Agenda/Staff, navigation | Zoned events and cross-day agenda exist. Cycle 1 delivers ranges; cycle 2 delivers a visual month with an accessible agenda alternative. Never infer a statutory date. |
| Reminders | Recipient/channel/offset controls | Shared work reminders and independent recipient reminders (in-app or email). Read-only Outlook/Google feeds publish one case or firm calendar; provider refresh cadence is external. Push, client-portal recipients and inbound calendar edits are outside this tranche. [Acceptance](../testing/calendar-delivery-2026-11-09.md). |
| Workflows | Named anchors and generated task/event inspection | Versioned templates and explicit preview/apply exist. Cycle 4 delivers grouped application inspection and recorded progress, preserving source identity. v199 adds named dates, a per-step change preview and transactional rescheduling that preserves completed, individual and manually moved work. |
| Contacts | People/companies, groups, linked cases, archive/import | The firm address book adds people, companies, relationship and group filters, affiliations, explicit case links, archive/restore and reviewed CSV import with undo. v198 adds a filterable prospect stage without changing case links. The cross-case participant directory continues to use its original identities and access rules. [Contacts audit](../testing/crm-contacts-2026-11-07.md). |
| Documents | Case/firm documents, templates, signatures, intake | Case evidence, firm storage, internal intake and reusable text templates with case-bound Word output are available. Rich Word layout import, external intake and signatures still require separate acceptance. |
| Communications | Email, messages, call log, text, comments | Existing case collaboration/history is not mailbox/SMS delivery. Track those as gaps, with explicit recipient review, delivery status and consent requirements. |
| Billing/payments/accounting | Time, expenses, invoice drafts, trust reports, payment plans | Not implemented as practice accounting. Never present hypothetical case amounts or tax calculations as invoices, a ledger or trust accounting. Requires independent currency/tax/audit/permission design and payment-provider acceptance. |
| Reports | Operational/productivity/financial reports | Case outcome and evidence/decision reports preserved. Operational summaries must label recorded scope and completeness; financial report parity is not claimed. |
| AI differentiation | Official documentation confirms document summaries and Advanced-tier case Q&A | Preserve CaseVant proposal → review → apply, source/evidence linkage, scenario comparisons and outcome reports. Merely having AI is not a competitive differentiator. AI suggestions must not silently persist tasks or certify evidence/outcomes. |
| Client portal | Official documentation describes explicitly shared documents/events, secure messages and optional payment access | The [portal candidate](../testing/client-portal-2026-11-09.md) separates client identity from case participation. Staff share an exact document version or reviewed event with a named recipient; clients upload privately and exchange messages in their own thread. External notifications and payments are outside this tranche. |
| Access/history | Firm/client membership surfaced | Preserve server authorization, account/org fences, pagination completeness, immutable revisions, idempotent retries and unsaved-work guards in every cycle. |

Every important category above stays in the implementation backlog until actually accepted. Five UI iterations are not a claim of complete MyCase feature parity; unfinished integration categories must remain explicit rather than be replaced with placeholder screens.

## Implementation order after the five UI cycles

1. **Operational depth:** standalone people and companies, duplicate review, case links and import recovery shipped in v196. Internal questionnaires and case intake forms shipped in v197, including draft/complete states, retained questions and answer download. Public v198 added case-bound Word generation, operational case stages with dated updates, prospect stages and personal register views ([acceptance](../testing/casework-records-2026-11-08.md)). v199 delivered named workflow dates and reviewed rescheduling of existing work. [Acceptance](../testing/workflow-milestones-2026-11-08.md). External intake invitations and client submissions belong to the client collaboration work. Preserve existing participant identities and generated-work history through additive migrations. Acceptance includes import dry-run, rejected rows, undo/recovery, permissions and concurrent edits.
2. **Calendar and delivery:** implemented as owner-selected read-only Outlook/Google subscriptions and recipient-specific reminder delivery ([evidence and limits](../testing/calendar-delivery-2026-11-09.md)). Specify source of truth, timezone/DST boundaries, cancellation, retries, duplicate suppression and observable failed delivery. A reminder shown in the app is not an email or push notification.
3. **Client collaboration:** explicitly shared portal documents/events, client uploads and message threads; internal material must remain private by default. Verify recipient visibility, revoked sessions, attachment access and delivery history before publication. Add signatures only with a selected provider and recorded signing evidence.
4. **Practice finance:** time/expense capture, invoice drafts, payments and accounting exports are separate from outcome economics. Define currencies, rounding, tax treatment, adjustments, trust/client-money segregation where supported, permissions and audit history before adding write paths. Payment posting requires provider-backed reconciliation and duplicate protection, not a successful UI toast.
5. **AI and reporting advantage:** evaluate reviewed workflow proposals and outcome comparisons against source-linked examples, retaining human apply and explicit uncertainty. Extend operational reports from complete authorized records; distinguish estimates, saved facts and financial ledger totals. Test provider failures and absence of configuration without losing drafts. Do not describe MyCase as lacking AI.

Each tranche needs its own data model, complete user journey, migration/recovery evidence, server authorization tests and production acceptance. The current five-cycle programme supplies navigation and retrieval improvements, not substitutes for these models or integrations.

### Published reference capability check

The 6 November official-documentation review complements the observed trial UI. MyCase's [Case Assistant](https://supportcenter.mycase.com/en/articles/12267713-8am-iq-case-assistant) documents case-scoped natural-language retrieval across documents, notes, tasks, events and other operational records, governed by a firm AI setting. This capability was not invoked in the trial during our audit. Its [Document Assistant](https://supportcenter.mycase.com/en/articles/9370119-8am-iq-document-assistant) documents text-document summaries and an OCR prerequisite for scanned inputs. Treat these as documented capabilities, not measured accuracy or a universal entitlement.

The [feature catalogue](https://www.mycase.com/features/) also identifies intake, signatures, document automation, external calendar connections, time/expenses and financial operations. The [client portal guide](https://supportcenter.mycase.com/en/articles/9369919-mycase-client-portal-overview) distinguishes shared client-visible material from internal firm records. CaseVant must retain that distinction in any future portal implementation. These references support the gap checklist; they do not authorize sending CaseVant data to MyCase or any AI provider.

## Five-cycle ledger and acceptance

1. **Work retrieval:** publish PR230 due scopes, priority sorting and Day/Week/Month agenda navigation. Audit the deployed controls and selection behaviour.
2. **CaseVant icon language and calendar orientation:** create original vector icons with consistent 24-unit geometry, restrained blue/teal accents and readable labels. Apply to navigation, case sections and common work actions. Audit contrast, narrow labels, focus and decorative SVG semantics.
   **Calendar acceptance:** implement a visual month grid linked to existing event/task details, retain agenda, explicit timezone/all-day semantics and keyboard controls. Test month boundaries and overlapping/cross-day events; audit production navigation.
3. **People and case retrieval:** surface case participants across accessible cases with exact identities and case links, search and active status. No inferred identity merges or new access grants. Test identity collisions, revocation and complete aggregation; audit production empty/populated states.
4. **Workflow execution clarity:** group applied workflows by exact case/application identity, show source version/anchor and recorded completion, and link to ordinary case editing. Audit the full journey from template preview to generated-work retrieval without changing the AI/report pipeline.

5. **Case next-work overview:** show authorized case-level next task/event, open/overdue/unassigned counts and direct destinations, preserving case identity and distinguishing recorded work from AI outcome predictions. Test mixed dates/statuses and audit live retrieval.

Sequence amendment: source review found a decorative SVG inside a native select option in the prepared icon source. Remove it before any publication. Combine the reviewed icon and visual-month amendments into cycle 2; the separate case next-work overview becomes cycle 5. This avoids publishing a known markup defect while preserving five distinct published/audited cycles.

The order may change only for a concrete finding or dependency. Each cycle must have its own reviewed source commit, full required web/PDF CI, ordinary main integration, exact-source deployment receipt, preserved environment/audience/bindings and post-deployment audit. Record actual failures and corrections; do not count an audit, screenshot or duplicate deployment as a completed implementation cycle.
