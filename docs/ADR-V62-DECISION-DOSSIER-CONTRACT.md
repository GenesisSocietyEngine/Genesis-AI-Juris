# ADR: Decision-Centric Dossier Contract

- Status: accepted for Slice 1; persistence and product activation are deferred
- Contract: `app/dossier-contract.v1.json`
- Web validator: `app/dossier-contract.ts`
- Baseline: v61 behavior at web commit `8bd10594bc01e5a45183a743396ac24b7aeaf321`
- Governing instruction: Decision-Centric Dossier Workspace v1, SHA-256 `283B05CCE4BD966C7DD007B688F81456F62C99D29FF72C1CDB5DE4FC120578C9`

## Decision

Add a dormant, versioned, runtime-neutral dossier wire contract. A Matter/Dossier is a governed workspace containing zero or more exact decision-package versions; it is never itself playable. The contract uses snake-case JSON, explicit nulls, stable opaque IDs, schema version 1, an exact enum registry, strict reference validation and canonical key-sorted serialization.

This slice does not import the dossier contract into `StudioDraft`, case fingerprints, `CanonicalReportModel`, the web reducer or the Rust runtime. It therefore does not reinterpret any v61 case or change anonymous reporting.

The pre-activation V1 contract also fails closed on six named integrity rules:

- evidence targeting a graph node or edge identifies the exact same-dossier decision-package reference, while non-graph evidence carries no package reference;
- every status transition records an adjacent `revision_before`/`revision_after` CAS pair, and output approval identifies the exact approved governed output;
- every audit event records its dossier revision; ordered audit events cover every mutation-receipt revision without gaps, while consequence and artifact events may share that revision;
- a snapshot at the live dossier revision is an exact manifest of current document versions, accepted assertions, accepted anchors and current decision-package references;
- governed output content references are private opaque locators, never URLs or traversal-capable paths;
- output-state history is authoritative for freshness, with a single exception for the exact `internal_review` to `output_approved` transition immediately following the output snapshot revision.

## The ten architecture questions

### 1. What is the current canonical unit?

For web authoring, `StudioDraft` is the only editable source. A protected, versioned case export packages that draft with its case-type reference and deterministic `CaseCoreV2` projection. `CaseCoreV2`, Studio views and `CanonicalReportModel` are derived projections, not parallel editors. For executable/training content, the exact `ScenarioDefinition` and fingerprint in the canonical mobile bundle are the runtime input.

The extension keeps those meanings:

- Matter/Dossier becomes the authoritative workspace aggregate.
- A linked case package is a versioned decision-package reference inside a dossier.
- A playable case remains a specialised decision package.
- A report model remains a deterministic projection of one immutable snapshot.

No legacy case becomes a dossier implicitly.

### 2. Which runtime owns simulation semantics?

Rust owns them. `juris-scenario-schema` defines declarative `ScenarioDefinition`; `juris-scenario-validator` validates it; `juris-engine`/`juris-simulation` own authoritative transitions and deterministic receipts. Flutter and web adapt or project canonical state but do not acquire a second simulation engine. Dossier deadlines of kind `workspace` cannot mutate projected simulation deadlines; `projected_simulation` references identify the exact decision package and native deadline.

### 3. Where are registries and migrations defined?

Current locations are:

- web package/type/report data: `app/case-type-registry.v1.json`, `app/case-type-playbooks.v1.json`, `app/report-profiles.v1.json`, `app/report-manifest.v1.json`;
- web canonical runtime projection: `app/canonical-case-bundle.json`;
- shared mobile source registries: mobile repository `contracts/*.json`;
- Flutter mirrors and parsers: `apps/juris-mobile/assets/case_types/*` and `apps/juris-mobile/lib/models/*`;
- Rust schema/validation/runtime: `crates/juris-scenario-schema`, `crates/juris-scenario-validator`, `crates/juris-engine`;
- D1 schema and migrations: `db/schema.ts`, `drizzle.config.ts`, `drizzle/*.sql`, and `drizzle/meta/*`.

The v1 dossier registry is currently canonical at `app/dossier-contract.v1.json`. It contains every persisted enum vocabulary and the complete allowed-transition set. Before any mobile or Rust code consumes dossiers, a generated or byte-identical copy must live under the mobile repository's `contracts/`, with Flutter/Rust parsers and CI hash/blob checks matching the existing case-type pattern. Hand-maintained divergent enums are not an activation path.

### 4. How are account, organisation and ownership represented?

Trusted identities come from ChatGPT authentication headers or a verified local session. Existing records primarily key ownership by normalized email: `custom_cases.owner_email`, `case_drafts.user_email`, grants and play sessions. `users.organisation` is free-text profile metadata, not a tenant boundary. The internal `__genesis_tenant__`/platform deployment context is also not an organisation model.

The MVP therefore starts as a personal workspace with:

- one server-resolved owner actor;
- explicit owner/contributor/reviewer/viewer participant rows;
- object access derived from owner plus active participant role;
- no client-supplied owner or organisation authority.

If stable actor IDs are required, Slice 2 may add an opaque UUID `users.actor_id` and backfill it additively. It must not infer a tenant from email domain or the free-text organisation field. Organisation tenancy remains null until a real organisation, membership and tenant-isolation model exists.

### 5. Where are saved cases and their gates?

Device saves use browser-local state. Server saves use D1 `custom_cases` plus immutable/revisioned `case_drafts`; published catalogue content uses `cases` and `case_versions`. Play state uses `play_sessions` and append-only/idempotent `play_events`.

Routes require a trusted identity, same-origin bounded JSON for mutations, normalized owner comparison, grant checks for shared custom cases, exact version/fingerprint checks and platform-admin checks where applicable. Private misses use non-disclosing not-found behavior.

Dossier APIs must reuse those request/session controls but need object-level owner/participant authorization on every list, read, mutation, upload, version, download, snapshot and output operation. Mutation credentials must be accepted only from the existing trusted origins; a bearer identity, owner ID or role supplied in JSON is never authority. Account deletion must return 409 while the account owns or participates in a dossier, until an explicit transfer or governed pseudonymisation workflow completes.

### 6. How are PDF, JSON and Markdown outputs generated and versioned?

- JSON case export/import is implemented in `app/case-export.ts` with explicit schema compatibility and integrity checks.
- Canonical Markdown hand-off is implemented in `app/case-markdown.ts` and the Markdown dialog; the embedded case and fingerprint, not edited narrative prose, re-open the graph.
- PDF uses `app/case-report.ts` over `CanonicalReportModel` (`REPORT_MODEL_SCHEMA_VERSION = 1`) and the versioned report-profile/renderer contract. Compatible PDFs remain local and anonymous.

A governed dossier output will extend this deterministic report path in Slice 6. It must first create an immutable `DossierSnapshotV1`, bind the output to its manifest digest, store generator/schema/build versions, and mark rather than rewrite an output after any authoritative change. PDF/Markdown render trees are derived presentation; the snapshot, output record, manifest/hash and approval are authoritative receipts.

`governed_output.state` is the authoritative freshness history. Every non-approval revision mutation must append a stale state. The parser permits a current output whose snapshot trails the live dossier by exactly one revision only when the sole intervening transition is `internal_review` to `output_approved`, its revision pair is exact, and its `approved_output_id` and reviewer bind to that same current output. Any later or different mutation makes that exception invalid.

### 7. What extraction and AI endpoints exist?

`POST /api/studio/ai-plan` is the existing bounded AI boundary. It sends an explicit Studio instruction and constrained graph context to the configured OpenAI Responses endpoint with response storage disabled, capacity/size limits and proposal review before application. It is not document ingestion.

Canonical Markdown parsing is local deterministic import, not AI extraction. Poppler text extraction exists in report QA scripts, not as a governed product service. There is no production document upload/version/extraction API and no OCR path.

For the pilot, strict UTF-8 TXT/Markdown may use a deterministic extractor after storage is proven. PDF and DOCX may be retained with honest `not_extractable` state until a safe, bounded, production-tested text-layer extractor exists. Image-only and unsupported content never receives a successful-analysis state. OCR is deferred.

### 8. Which new objects have which authority?

| Class | Objects |
| --- | --- |
| Authoritative | dossier identity/revision/status; participants and roles; logical documents; immutable document-version metadata/hash/object reference; reviewed source anchors; accepted professional assertions; reviewed evidence links; information requests; workspace deadline references; exact decision-package references; status-transition records; immutable snapshots; governed-output records/approvals; append-only dossier audit events |
| Authoritative history, not professional truth | AI proposal record, source/model receipt, review decision and rejection/supersession history; proposed content remains non-authoritative until explicit permitted acceptance creates a normal authoritative object |
| Derived | readiness dimensions/reason codes/deep links; output staleness; case/report projections; validation summaries; search/filter projections |
| Immutable derived cache | extracted text result, page/section map, extraction version and checksums; these are separate from mutable bounded extraction-job state |
| Operational cache/job | upload intent, extraction/AI job lease, retry/error state and temporary uncommitted object key |
| Presentation-only | Matter/Dossier/Engagement/Case display term, locale labels, User/Developer view formatting, report render tree and UI colour/layout |

Readiness is recomputed from authoritative conditions. It is never a mutable boolean on the dossier.

### 9. What is the migration and rollback strategy?

Slice 2 is additive and feature-off by default:

1. Add new dossier/document/participant/transition/request/anchor/assertion/evidence/snapshot/output/audit/job tables with no changes to legacy case rows.
2. Use composite `(dossier_id, object_id)` uniqueness/foreign-key relationships so cross-dossier IDs cannot satisfy a reference.
3. Add optimistic dossier revision checks and transact metadata, status and audit mutations. A successful dossier-row CAS advances one revision and appends a mutation-receipt audit event at that revision; append-only consequence or artifact events may share the revision and do not consume another receipt.
4. Offer explicit legacy-case-to-dossier migration only; emit a receipt mapping the legacy case/version/fingerprint to the new decision-package reference. Never auto-convert.
5. On rollback, disable dossier routes/UI/jobs and leave new tables and private objects intact. Do not run a destructive down migration or rewrite old reports.

Document bytes must use a new private logical R2 binding named `DOSSIER_DOCUMENTS`; D1 stores metadata, hashes, state and audit only. D1 BLOB storage is rejected. Object keys are non-guessable and never public. Downloads go through an owner/participant-authorized application route (or a short-lived owner-gated mechanism), with existence-safe errors.

The source Sites configuration now declares only the logical private binding
`DOSSIER_DOCUMENTS`; no physical bucket has been provisioned or wired by a
publish operation. That remains a hard stop: no document-byte/version API,
external bucket creation or deployment occurs until owner/participant-gated
upload/download tests pass and the later release operation has separate
authorization.

The later upload/version protocol is an idempotent compare-and-set state machine:

1. create a bounded D1 upload intent tied to dossier, actor and expected revision;
2. upload to an opaque temporary R2 key;
3. server-verify media type/size and recompute SHA-256 from stored bytes;
4. atomically commit immutable document-version metadata, current-version pointer and dossier audit under the expected revision;
5. clean only expired, uncommitted temporary keys; never delete a committed version during cleanup.

Extraction results are immutable versioned records; mutable jobs/retries are separate. Dossier audit is separate from the existing generic audit table because existing account-deletion behavior can remove generic events, which is incompatible with dossier append-only history.

### 10. Which MVP capabilities are deliberately deferred?

Deferred: real organisation/tenant administration; enterprise DMS synchronisation; public object URLs; PDF/DOCX extraction until safe tooling is proven; OCR; background auto-accepting AI; vector search as citation; bulk/eDiscovery review; arbitrary folders; email/Office capture; Word co-authoring; billing/time/trust/accounting; CRM/KYC/conflicts; legal holds/records disposition; e-filing/e-signature; production pricing; destructive legacy conversion; and any claim of enterprise compliance certification.

## Lifecycle and authorization contract

The neutral statuses are `draft`, `intake_review`, `active`, `awaiting_input`, `internal_review`, `output_approved`, `closed`, `archived`, `declined` and `cancelled`. The registry lists every allowed edge; absence means forbidden.

Key rules enforced by the pure transition decision:

- viewers have no transition;
- contributors cannot approve output;
- `output_approved` requires reviewer role, a current non-stale output and reviewer approval;
- leaving active work and every reopen requires a reason where declared;
- ordinary archive starts only from closed/declined/cancelled;
- platform administration may archive another state only through an explicit override with a reason and a separate audit event;
- every accepted transition recomputes readiness; all except the approval transition mark prior outputs stale.

## Contract validation

`parseDossierContractBundleV1` rejects:

- unknown format, schema, registry, enum or object key;
- non-canonical timestamps/hashes/IDs and unbounded JSON;
- missing, cross-dossier or mismatched document/version/anchor references;
- non-monotonic immutable document versions;
- ungrounded or silently accepted AI proposals;
- invalid readiness explanations/dimensions;
- stale snapshot/output digest bindings;
- incomplete current-revision snapshot manifests or graph evidence without its exact decision-package scope;
- public/traversal-capable governed-output locators;
- unordered, gapped or revision-incoherent audit chains;
- a transition absent from the registry, missing role/reason/output/approval conditions, or not bound to an adjacent CAS revision and exact approved output;
- a current output whose snapshot revision differs from live state outside the sole exact output-approval exception.

`serializeDossierContractBundleV1` validates first and then sorts object keys recursively. Array order remains semantic. This gives deterministic round trips without changing v61 case fingerprint canonicalisation.

## Consequences

The new contract is reviewable and testable before storage/UI/API work, and later runtimes can consume the same wire registry. The cost is deliberate activation work: private R2, additive D1 schema, server authorization, migration receipts and generated mobile/Rust projections must all be proven before dossier persistence is enabled.
