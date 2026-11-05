# CaseVant practice management and AI case flows

Development plan · 5 November 2026

CaseVant should support the whole journey from an enquiry through case work, documents, billing and closure, with a source-linked decision flow at the centre of each case. MyCase defines the functional baseline; Filevine and NetDocuments inform the document workspace. This is a staged product programme. The first implementation improves case navigation and document reading; it does not establish full MyCase parity.

## Reference model

The signed-in MyCase workspace was inspected in Edge. Observed screens include the dashboard, four-stage case creation wizard and case details workspace. The computer locked before detailed document, billing and workflow inspection could finish. Those areas below are supported by official documentation or marked for acceptance discovery; a visible navigation link is not evidence that its integration is configured.

| Reference | Pattern to adapt in CaseVant |
| --- | --- |
| MyCase dashboard and case workspace, observed | Persistent case identity, compact section navigation, activity timeline, upcoming work, global quick actions and separate firm-wide and case views. |
| MyCase case creation, observed | Clients and contacts → case metadata → billing arrangement → responsible staff and access. Preserve progress and explain required fields. |
| [Filevine Docs Section](https://support.filevine.com/hc/en-us/articles/360004141452-Docs-Section) | Keep an inventory visible beside preview, properties, versions and relationships. Distinguish opening a document from selecting it. |
| [NetDocuments document management guide](https://pages.netdocuments.com/rs/549-CKV-717/images/netdocuments-dm-buyers-guide-2022.pdf) | Matter-centred document workspaces, contextual collaboration and visible external-access boundaries. |
| [MyCase document overview](https://supportcenter.mycase.com/en/articles/9369983-documents-overview) | Retain previous document versions, document-specific comments and controlled client uploads. Concurrent edits require conflict resolution. |
| [MyCase workflow setup](https://supportcenter.mycase.com/en/articles/9370081-creating-and-applying-workflows) | Reusable tasks and events calculated from trigger dates or task completion; distinguish weekdays from calendar days; generate documents from approved templates. |

Use CaseVant typography, colours and terminology. Borrow interaction patterns, not vendor branding. Dense desktop lists become a sequential list and inspector on narrow screens. All actions need keyboard access, clear selection, readable long names and useful empty/error states.

## Functional parity register

“Existing” below means source implementation found, not that every production scenario was exercised. The source baseline is canonical main `88eec428f922aec28fef37f95b9014c38156a6f6` and Sites v179. The [official MyCase feature catalogue](https://www.mycase.com/features/) supplies the broader product baseline; subscriptions and integrations must be tracked separately in the detailed acceptance register.

| Capability | CaseVant baseline and gap | Delivery |
| --- | --- | --- |
| Case register and lifecycle | Personal Studio cases and organisation dossiers exist. Add practice area, office, stage definitions, responsible lawyer, related contacts, conflict-check record, custom fields, archived views and saved filters. | P1 |
| Contacts and staff | Organisation membership and governed participants exist. Add a proper contact directory, companies, multiple case roles, duplicate resolution and client relationships. | P1 |
| Documents | Immutable dossier versions, extraction, secure download, source acceptance and Studio materials exist. Add folders/collections, tags editing, resumable batch intake, full file preview, comments, conflict-safe editing and version comparison. | P0–P2 |
| Tasks and calendar | Requests, reviewed deadlines and planning projections exist. Add assigned operational tasks, checklists, reminders, recurring events, timezone handling and calendar synchronisation. A graph node is not a completed task. | P2 |
| Workflows | AI graph proposals and reversible application exist. Add reusable execution templates, trigger dates, dependent tasks and audited workflow runs. | P2–P3 |
| Intake and leads | No equivalent firm CRM module found in the current API routes. Add enquiry pipeline, forms, engagement documents, referral sources and conversion to a case without duplicate records. | P3 |
| Communications and client portal | Notes, activity and information requests exist. Add scoped client access, secure threads, attachments, notification preferences, email filing, SMS and call records via adapters. | P3 |
| Time, expenses and invoices | No equivalent billing module found in current API routes. Add timers, rates, billable entries, expense receipts, fee arrangements, draft invoices, adjustments and receivables. | P4 |
| Payments and trust accounting | Treat as a separate financial subsystem. Design immutable balanced ledgers, allocations, reconciliation, refunds and payment-provider webhooks with jurisdiction-specific validation. | P5 |
| Reports | Case/decision outputs and snapshot receipts exist. Add operational, workload, intake, time, billing and financial reports with defined metrics and permission-aware export. | P2–P5 |
| Document generation and signatures | Existing report generation is not editable legal-template automation or eSignature. Add versioned templates, merge-field validation, signature-provider envelopes and completion evidence. | P3–P4 |
| Integrations and mobile | Existing native parity controls must remain. Add Google/Microsoft calendar and email, office editing/DMS integration, accounting exports and partner-specific filing/service adapters where supported. | P3–P6 |
| Migration and administration | Add import mapping, dry runs, deduplication, reconciliation, user/role administration, retention, recoverable archive, bulk operations and export portability. | P1–P6 |

The MyCase workspace also exposes Proof service of process, InfoTrack and NetDocuments integrations. These require separate provider availability, commercial and jurisdiction checks; displaying a corresponding CaseVant menu item would not constitute parity. MyCase's client portal includes controlled case/billing visibility and communication ([portal overview](https://supportcenter.mycase.com/en/articles/9369919-mycase-client-portal-overview)).

## Target workspace

Firm navigation: Home, Cases, Contacts, Tasks, Calendar, Documents, Communications, Intake, Billing, Reports. Show modules only when they provide working functionality and the user has access.

Case navigation: Overview, Documents, AI case flow, Tasks and calendar, Contacts and staff, Communications, Time and billing, Activity. Keep case name, reference, status and owner visible. Preserve existing deep links and return state. Personal Studio drafts and governed organisation dossiers remain distinguishable until an explicit, tested linking/migration operation exists.

Document workspace: search/filter toolbar → inventory → selected document inspector. Inspector sections: content, properties, versions, linked evidence and activity. Editing source bytes creates a new immutable version; editing a working evidence record uses the existing case editor. An unavailable original is labelled unavailable. Source acceptance belongs to an exact version and must never carry over silently to replacement bytes.

## AI assisted logical flows

Build on `/api/studio/ai-plan`, `studio-ai-plan.ts` and `StudioAIReview.tsx`. These already validate graph proposals, bind them to the current graph fingerprint and expose a human review before reversible application. The first slice promotes this existing flow to a visible case-navigation destination.

Next implementation: a structured brief captures objective, jurisdiction, parties by role, disputed issues, known dates and desired outcome. Users select which document versions and excerpts may enter AI context. Show that scope before generation and retain the current provider-disclosure controls. Extracted document content remains evidence, not an instruction channel.

The proposed graph separates facts, evidence, assumptions, deadlines, decisions, actions and outcomes. Relations distinguish support, contradiction, dependency and conditional branches. Every factual claim links to an exact source/version/location, or is explicitly marked unsupported. The proposal displays missing information, assumptions and alternative branches. Suggested procedural deadlines require a stated basis and human validation.

Example: intake → conflicts and engagement → collect contract and correspondence → establish obligations and disputed facts → assess breach and remedy → negotiate or escalate → settlement/filing/closure. Each decision branch carries its condition, evidence needs and owner. This is a planning example, not a prescribed legal route.

Review and execution are separate operations:

1. Generate a candidate against an immutable context snapshot.
2. Validate IDs, references, node types, reachable outcomes and cycles. Reject malformed output without changing the case.
3. Show additions, modifications, source citations and unresolved questions. Permit manual corrections and regeneration.
4. Apply the reviewed candidate as a new reversible graph revision, rejecting stale context.
5. Separately publish selected action nodes into tasks/calendar after previewing assignments, dates and notifications. Use idempotency keys so retries cannot create duplicate work.
6. Mark affected reasoning stale when cited documents change. Offer a reviewed revision; never rewrite the accepted graph silently.

Measure source-link accuracy, unsupported claims, invalid graph rate, stale-context rejection, user corrections, time to reviewed plan and task-publication duplication. A visually plausible flow is insufficient acceptance evidence.

## Delivery phases and acceptance

| Phase | Concrete deliverable | Exit criteria |
| --- | --- | --- |
| P0 — current slice | Searchable Studio library with side reader; dossier document list and version inspector; direct case-section links; visible AI case-flow entry. | Original content unchanged; exact selected identity; filter/return state; access loss clears private view; keyboard and narrow-layout review; focused regression and type checks. |
| P1 — case and contact foundation | Contacts, matter relationships, metadata/stages, saved views and a migration dry-run framework. | Permission tests per role; no duplicate case on retry; existing IDs and links survive; reconciled imports can be rolled back before activation. |
| P2 — daily work and document depth | Tasks/calendar, folders/tags/comments, preview, version replacement and operational reporting. | Conflict and stale-version handling; recoverable batch failures; timezone and reminder tests; no unauthorised document retrieval. |
| P3 — intake, portal and AI execution | Lead conversion, scoped client portal, communications, structured source-grounded flow builder and reviewed task publication. | No source-less fact promoted; no duplicate tasks; controlled notification recipients; client cannot see internal notes; provider failure leaves manual work usable. |
| P4 — billing and automation | Time/expenses, fee types, invoices, templates and signatures. | Decimal monetary arithmetic; reproducible invoice totals; adjustments preserve history; signature status reconciles to provider evidence. |
| P5 — financial operations | Payment integration, trust ledger and reconciliation. | Accounting invariants; idempotent signed webhooks; reconciliation and reversal scenarios; separate financial/domain acceptance. |
| P6 — full parity certification | Integration matrix, mobile flows, migration rehearsal, operational reporting and end-to-end firm scenarios. | Every agreed MyCase capability has an implemented test or a named supported integration; unresolved exclusions remain visible. |

P1 precedes shared tasks, portal and billing. P2 document provenance supports P3 AI grounding. P4 billing precedes P5 payments. These are dependency stages, not calendar promises; estimate each after schema and provider contracts are agreed.

## Implementation architecture and release

Extend the current application in bounded modules around the existing organisation/authority model. Add entities for contacts, case relationships, tasks, calendar events, workflow templates/runs, communication threads, time entries, expenses, invoices and ledger records as their phases arrive. Every record is organisation-scoped; case-scoped children use the same authorisation boundary. Use optimistic concurrency and explicit save receipts for writes, and an outbox plus idempotency for jobs and integrations.

Do not collapse Studio graph storage into dossier records during a UI refactor. Link them with explicit version references. Keep imported originals, extracted text, working annotations, AI proposals and accepted evidence distinct. Maintain an append-only activity trail with attributable actions and exact record/version IDs.

Release each coherent phase through a reviewed branch, focused tests, type/lint/build checks and existing canonical CI. Validate desktop/narrow layouts, EN/RU Studio journeys, long titles, sign-in expiry, permission withdrawal, save conflicts and recovery. Deploy only a verified source revision and check its reported build identity. Full parity acceptance should include intake-to-closure, document replacement, reviewed AI planning, billing adjustment and client-access isolation scenarios.

## Next backlog

1. Finish signed-in MyCase Documents, Workflows, Tasks, Billing and client-sharing inspection when Windows is unlocked; add screen-specific acceptance details without copying client data into fixtures.
2. Complete P0 verification and source delivery; record exact results in `docs/testing/case-document-workspace-2026-11-05.md`.
3. Specify P1 contact and case schemas, role permissions, migration mappings and a saved-case/dossier linking contract.
4. Prototype the P3 structured flow brief using synthetic sources, alongside P2 task contracts, before enabling graph-to-task publication.
