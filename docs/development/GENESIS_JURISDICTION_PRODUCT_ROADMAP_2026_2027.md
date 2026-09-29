---
document_type: public_product_roadmap
project: "GENESIS: JURIS / Genesis: Jurisdiction"
status: active_direction
roadmap_period: 2026-08_to_2027-08
baseline_release: v61
baseline_mobile_commit: 29f862649dea378cfe3d4e145f5e396bf6d4c6ff
last_updated: 2026-08-31
---

# Genesis: Jurisdiction — public product roadmap 2026–2027

## Product direction

Genesis: Jurisdiction is a professional decision-simulation and case-engineering
platform for legal, tax, compliance, investigation, training and enterprise/ERP
matters.

Its purpose is to turn an unstructured professional matter into a versioned,
explainable, testable and reusable decision package. The platform connects facts,
evidence, authorities, deadlines, decisions, alternative scenarios and professional
outputs while preserving a reproducible causal history.

The next product evolution is a **decision-centric dossier workspace**:

> One governed professional matter containing its documents, evidence, decision
> graph, simulations, approvals, reports and audit history.

Genesis is not intended to replace a general-purpose document-management,
practice-management, billing or accounting system. Its differentiator is the governed
decision and simulation layer that converts dossier material into explainable,
reviewable professional work.

## v61 baseline

The v61 milestone establishes the professional-beta foundation:

- nine immutable professional case-type and playbook packages;
- an authoritative Rust simulation model;
- compatible web and Flutter/mobile case semantics;
- guided and expert Studio workflows;
- versioned evidence and document-pack structures;
- provenance, citations, permissions, approvals and redaction controls;
- controlled decision tables and immutable audit/report receipts;
- deterministic report models and case-aware professional outputs;
- local PDF generation and readiness/staleness gates;
- exact-head Rust and Flutter verification before release.

The authorised v61 packages are:

1. general advisory;
2. litigation strategy;
3. contract review;
4. tax planning;
5. compliance;
6. tax compliance;
7. ERP incident;
8. investigation;
9. training simulation.

## Non-negotiable architecture principles

1. **One authoritative simulation model.** Web and mobile must not develop
   incompatible scenario logic.
2. **Deterministic replay.** A completed session remains reproducible after later
   dossier or package changes.
3. **Explainable outcomes.** Material consequences trace to facts, time, decisions,
   rules and source material.
4. **Human-controlled evidence.** AI may propose facts, classifications and links;
   it does not silently convert extraction into accepted professional evidence.
5. **Immutable lineage.** Cases, documents, reports and approvals use explicit
   versions, parentage, hashes and supersession records.
6. **Time is first-class.** Deadlines, elapsed time, waiting states and missed
   opportunities remain part of the professional model.
7. **Matter-centric permissions.** Organisation, dossier and sensitive-document
   boundaries are explicit and auditable.
8. **Evidence before expansion.** Large platform features follow observed
   professional use and defined acceptance gates.

## Target domain model

```text
Organisation / workspace
└── Dossier / matter
    ├── identity, type, jurisdiction, owner and confidentiality
    ├── lifecycle status, priority, reasons and deadlines
    ├── participants, roles and access policy
    ├── documents and immutable document versions
    ├── facts, evidence, authorities and unresolved questions
    ├── tasks, requests, milestones and communication references
    ├── versioned decision packages and graphs
    ├── simulations, assumptions and comparison runs
    ├── reports, approvals and publication states
    └── append-only activity and audit events
```

A dossier is not itself a playable case. It can contain several package versions,
several simulations and several reports. A report is generated from an exact frozen
dossier/package snapshot rather than from mutable live state.

## Canonical dossier lifecycle

The neutral lifecycle can be relabelled by vertical without changing its semantics:

| Status | Meaning |
|---|---|
| Draft | The matter is being created and may be incomplete |
| Intake review | Scope, authority, confidentiality and acceptance are checked |
| Active | Professional work and evidence collection are underway |
| Awaiting input | Progress is blocked by an identified dependency |
| Internal review | A decision package or output is being reviewed |
| Output approved | A named reviewer approved an exact saved version |
| Closed | Ordinary work is complete |
| Archived | The dossier is retained read-only under policy |
| Declined / cancelled | Exceptional terminal state with an explicit reason |

Reopening is an authorised, auditable transition back to Active. Every transition
records actor, time, reason, previous status, new status and resulting actions.

Dossier status is distinct from computed readiness. Readiness can report:

- intake completeness;
- evidence completeness;
- unresolved contradictions;
- overdue requests and deadlines;
- unreviewed AI proposals;
- stale authorities or source material;
- graph/test readiness;
- report-approval readiness.

## Document intelligence model

Minimum document lifecycle:

```text
Received / uploaded
→ Classified
→ Under review
→ Accepted as supporting material | Rejected / irrelevant
→ Superseded by an accepted newer version
→ Sealed with an approved output or closed dossier
→ Retained / archived under policy
```

Each document version requires:

- immutable identity and content hash;
- original filename, type, size and capture time;
- source and provenance classification;
- dossier, category, jurisdiction and confidentiality metadata;
- version lineage and supersession reason;
- review state and responsible reviewer;
- links to facts, authorities, nodes, deadlines, decisions and reports;
- extraction warnings and human-confirmation state;
- access and audit history.

## Delivery roadmap

### Stage 1 — professional-beta stabilisation

- complete semantic multi-page graph pagination;
- use paired, traceable off-page connectors;
- wrap node text and prevent page-boundary clipping;
- close remaining high-impact guided-workflow defects;
- retain green exact-head Rust, Flutter, web and report gates;
- validate flagship workflows with professionals.

### Stage 2 — bounded dossier prototype

Implement the smallest complete dossier slice:

- one organisation workspace;
- one dossier type and configurable status flow;
- dossier identity, owner, jurisdiction, confidentiality and deadline;
- 3–10 documents with versions, provenance and hashes;
- exact links from document pages/sections to facts and graph nodes;
- missing-information requests with owner and due date;
- append-only dossier timeline;
- owner, contributor, reviewer and read-only roles;
- readiness summary;
- one governed report from a frozen dossier snapshot.

Prototype exit gate:

> Independent professional users can understand the dossier status, find the
> controlling material and explain why the decision package is or is not ready for
> review.

### Stage 3 — closed professional validation

- test complete dossier workflows with legal, tax, compliance and ERP professionals;
- measure intake-to-ready time and report-preparation time;
- measure missing-information identification and resolution;
- verify that accepted AI links remain attributable to exact sources;
- test whether users create and resume a second dossier without assistance;
- determine whether target organisations prefer internal storage or references to
  their established DMS.

### Stage 4 — institutional productisation

Proceed only after the dossier prototype passes its evidence gates:

- organisation administration and stronger permission boundaries;
- configurable matter templates and status transitions;
- portfolio dashboards across dossiers;
- API/webhook events for intake, status, document and approval changes;
- retention-policy configuration and documented data-residency controls;
- connectors or governed references for established enterprise storage and legal DMS
  environments where justified by customer requirements;
- controlled external collaboration and reviewer access.

### Stage 5 — controlled scale

- reusable vertical dossier templates;
- organisation analytics and cohort/reporting views;
- repeatable author and reviewer onboarding;
- measured package reuse across professional domains;
- validated partner integrations without semantic drift from the authoritative model;
- security, privacy, operational and support controls appropriate for institutional
  adoption.

## Explicitly deferred scope

The roadmap does not currently include:

- billing, trust accounting, invoicing or broad time recording;
- a general CRM or marketing-intake platform;
- unrestricted Outlook/email capture and journaling;
- Microsoft Word co-authoring or a general document editor;
- eDiscovery-scale ingestion and bulk review;
- enterprise legal holds and disposition automation;
- electronic court filing;
- arbitrary shared-drive folder structures;
- migration tooling intended to replace iManage, NetDocuments or equivalent systems;
- unrestricted customer-specific workflow programming.

The initial document store is a controlled pilot vault. Enterprise deployments should
prefer governed integration with existing systems of record where appropriate.

## Product evidence and acceptance metrics

Roadmap decisions should use observable evidence:

- complete flagship workflows;
- professional completion and abandonment rates;
- explainability and source-traceability ratings;
- dossiers created, activated, closed and reopened;
- median time from intake to Active and Internal review;
- material documents linked to facts, rules and nodes;
- missing-information requests resolved;
- unreviewed AI proposals and acceptance/rejection rate;
- time to produce an approved professional output;
- repeat dossiers created by the same organisation;
- defects, security findings and deterministic replay failures;
- demand for DMS integration versus internal storage.

Broader dossier investment requires observed recurring use, an institutional
requirement, a measurable reduction in professional cycle time, or a credible
integration/distribution path.

## Standards direction

The records and document model should be informed by:

- [ISO 15489-1:2016](https://www.iso.org/standard/62542.html) for records concepts,
  metadata, controls, capture and management;
- [ISO 16175-1:2020](https://www.iso.org/standard/74294.html) and
  [ISO/TS 16175-2:2020](https://www.iso.org/standard/74293.html) for software that
  manages digital records;
- [ISO/IEC 27001:2022](https://www.iso.org/standard/27001) for information-security
  management direction;
- [ISO/IEC 27701:2025](https://www.iso.org/standard/27701) for privacy-information
  management direction;
- BPMN 2.0.2 Link Events or equivalent paired off-page connector semantics for
  printed multi-page process/decision graphs.

These references inform product design. The project must not claim certification or
formal conformance without appropriate independent evidence.

## Release governance

Every roadmap increment must:

1. identify its exact base and resulting commit;
2. preserve package and simulation compatibility;
3. run relevant Rust, Flutter, web, schema and report gates;
4. record migration and rollback behaviour;
5. distinguish automated checks from observed professional validation;
6. document known limitations;
7. avoid declaring success from generation tests alone when semantic visual review is
   required.

This roadmap is directional. Verified professional evidence and release safety take
precedence over feature volume.
