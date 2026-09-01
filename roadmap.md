# GENESIS: JURIS Roadmap

## v62 - Decision-Centric Dossier Workspace and Document Intelligence MVP

Status: **in development**

### Slice 0 - baseline and hardening

- [x] Freeze exact v61 web baseline and preserve the dirty original worktree.
- [x] Freeze exact mobile `main` baseline on an isolated v62 branch.
- [x] Add the versioned `ReportGraphLayoutModel` contract.
- [ ] Add locked web/Flutter parity fixtures and fingerprint vectors.
  - [x] Freeze the web vectors for every required family.
  - [x] Reproduce all vectors in Flutter with the release-script manifest,
    metric, fixture, node-page, connector, and fingerprint probe.
- [x] Implement font-aware Unicode wrapping and variable-height nodes.
- [x] Implement stable topology layers, portrait lanes, and layer-only packing.
- [x] Implement paired cross-page connector records and rendered markers.
- [x] Move the complete node/edge/connector register after the graph.
- [x] Bind layout fingerprints and renderer versions into report receipts.
  - [x] Preserve legacy receipt parsing and mark schema-1 receipts stale.
  - [x] Define and test schema-2 content-plus-layout receipt bindings.
  - [x] Emit the schema-2 receipt from the integrated PDF artifact build.
- [x] Add Bhopal plus deep, wide, fan-out, fan-in, disconnected,
  cyclic-repair, long-title, long-detail, EN, RU, and maximum-node fixtures.
- [x] Pass structural, adjacency, extraction, A4 geometry, and visual PDF QA.
  - [x] Pass the final focused web graph/layout/renderer suite (33/33).
  - [x] Enforce exact Poppler 25.07.0, 96 DPI, and a fail-closed visual
    baseline update gate.
  - [x] Complete the 47-PDF corpus, human visual review, baseline lock, and
    normal-mode replay.
- [x] Force every genuinely empty untitled draft to Guided Studio Step 1.
- [x] Close prompt/premise/audit leakage, strict source-link, typed PDF-error,
  presentation-receipt, visual-baseline mutation, and mobile post-tool guard gaps.
- [x] Scope report receipts to the verified account and keep restricted cases
  memory-only; ignore and remove legacy origin-wide receipt keys.
- [x] Block inspection-only PDF entry, dialog generation, and download; bind
  premise-review safety plus visible protection fields into saved/readiness and
  presentation-receipt gates without changing v61 semantic fingerprints.

### Slice 1 - contract and ADR

- [x] Record the ten-question architecture ADR and authoritative/derived/cache boundaries.
- [x] Freeze versioned dossier statuses, roles, readiness reasons, transition
  matrix, wire validation, and compatibility/migration strategy.

### Slice 2 - persistence and service boundary

- [ ] Add additive D1 migrations for dossiers, participants, immutable documents
  and versions, anchors, assertions, requests, proposals,
  decision-package references, snapshots, outputs, and append-only audit.
- [x] Pass senior migration re-audit for deletion retention, upload CAS,
  cross-dossier proposal review, provenance immutability, sealed bindings,
  reviewer identity, canonical hashes/revisions, and stable actor references.
- [ ] Enforce owner/participant roles on every route, indistinguishable 404s,
  optimistic concurrency, server hashes, bounds, idempotency, and safe media states.
- [x] Resolve stable actor identity from the registered user, enforce joined
  participant access with private no-store 404s, and add bounded Matter
  catalogue/create/detail/update routes with revision compare-and-set.
- [x] Keep lifecycle, owner, tenant, approval, hash, and audit authority out of
  generic updates; stale current outputs and append chained audit events in the
  same D1 mutation batch.
- [x] Bind every authoritative D1 mutation to one live-revision primary audit
  receipt while allowing bounded same-revision output-staleness consequences;
  reject and roll back zero-row stale compare-and-set batches.
- [x] Add a distinct role-scoped lifecycle-transition action using the frozen
  matrix, server-derived output/approval facts, revision-bound immutable
  history, closure/archive facts, and atomic output-staleness consequences.
- [x] Freeze and test the pure role/action, object-key, media/quota, observed-byte,
  extraction, upload-intent CAS, and private-download security decisions.
- [x] Stop account deletion with a private generic `409` before any cleanup
  while governed dossier ownership or participant history remains.
- [x] Declare the source-only private logical `DOSSIER_DOCUMENTS` R2 binding
  and Worker type without provisioning or exposing a resource.
- [ ] Prove the private R2 document vault before exposing bytes:
  opaque keys, no public URLs, bounded validation, and server-side download
  authorization at the D1 metadata boundary. Free-form `users.organisation`
  is not a tenant boundary.
  - [x] Add finalized-only metadata catalogue and authorized server download
    route with D1-first scope checks, private attachment headers, and exact R2
    length/media/hash/checksum verification.
  - [x] Complete provisional upload intent commit, derived extraction, bounded
    cleanup, and fresh schema re-audit before any R2 resource is provisioned.
  - [x] Implement exact multipart/media validation, intent-before-R2 storage,
    checksum verification, atomic version/current/revision/audit commit, and
    post-commit deterministic TXT/Markdown derived extraction.
  - [x] Add actor-bound pre-expiry abort, D1-before-R2 cleanup claiming, and
    deletion of completed unreferenced intent metadata for exact retries.
  - [x] Freeze and sign off the migration fixes for zero-version non-upload
    rows, provisional proposal/request targets, upload triggers, and receipts.

### Slices 3–4 - workspace and document intelligence

- [x] Add Matter list/create/open plus Overview, Documents, Evidence, Requests,
  Decision packages, Outputs, and Activity destinations.
- [x] Build the responsive seven-destination /matters workspace with User and
  Developer views, explicit readiness, citations, bounded paging, compact
  phone navigation, revision-bound writes, and honest failure/permission states.
- [x] Complete and integrate the document, proposal, request, package, snapshot,
  output, approval, and activity route families behind those workspace states.
- [x] Add participant-scoped anchor, assertion, and evidence-link APIs with
  finalized extraction provenance and exact current-package graph validation.
- [x] Add bounded participant-scoped request/deadline mutation and activity
  route families with same-Matter satisfying-source enforcement, revision CAS,
  server actor identity, one atomic revision receipt, and chained audit events.
- [x] Expose immutable-version upload, manual exact-anchor/assertion review,
  graph-node/edge evidence linking, and document-backed request satisfaction in
  the ordinary User View; focused workspace acceptance passes 9/9.
- [x] Add the server-side Matter catalogue/create/open/update foundation with
  metadata-only readiness summaries and exact-detail readiness projection.
- [x] Implement the deterministic ten-dimension readiness projection with
  canonical reason ordering, source deep links, and status separation.
- [x] Collect all readiness facts from bounded metadata-only queries without
  loading document bytes into Matter catalogue or overview responses.
- [x] Add deterministic text extraction for safely supported pilot types and
  honest `not_extractable` states for unsupported/image-only content.
- [x] Implement strict deterministic UTF-8 extraction for TXT/Markdown and an
  explicit no-parser state for PDF/DOCX in the route-independent security core.
- [x] Add individually cited pending/accepted/rejected/superseded proposals;
  no AI proposal becomes authoritative without permitted explicit review.
- [x] Freeze the explicit accept/edit-and-accept/reject and source-replacement
  decision core with exact anchor bindings and prompt-injection separation.

### Slices 5–6 - integration and governed output

- [x] Link/create decision packages from immutable dossier revisions without
  changing Rust simulation semantics.
- [x] Retain evidence-to-node/edge anchors, reviewed graph diffs, and staleness.
- [x] Create immutable snapshots, dossier ReportModel/PDF, JSON manifest,
  approvals, and stale-output gates while preserving anonymous legacy PDFs.
- [x] Decouple revision CAS receipts from audit rows so snapshot, output, and
  approval artifact events can share one unchanged live dossier revision.

### Slice 7 - acceptance and release

- [x] Replace the graph-only PASS path with fail-closed dossier E2E,
  executable mobile-layout, exact web HEAD/raw-byte, and post-tool guards.
- [x] Pass all five required end-to-end scenarios with factual receipts.
- [ ] Pass strict web, dependency, security, parity, production-build,
  performance, browser, PDF, and accessibility gates.
  - [x] Pass strict TypeScript, full ESLint, production audit, verified build,
    performance fixtures, PDF structure/extraction, and the exact visual
    baseline.
  - [x] Pass 493/493 full web tests and 29/29 held dossier runtime tests.
  - [ ] Complete in-app visual inspection; local HTTP rendering and security
    headers are green, but the trusted browser-control service is unavailable.
- [ ] Pass Rust, Flutter, Android, iOS, and exact shared-contract/layout parity gates.
  - [x] Pass exact web/Flutter report-manifest, metric, fixture, connector, and
    layout-fingerprint parity; full Flutter analysis and 258-test suite pass.
  - [x] Pass Rust formatting, Clippy with warnings denied, locked workspace
    tests, and 12/12 Android native persistence scenarios.
  - [ ] Bind the exact candidate head to successful hosted iOS evidence.
- [ ] Review and merge the exact mobile head; bind its SHA and four CI receipts.
- [ ] Commit and push the exact reviewed web head.
- [ ] Save exactly one Sites version only after every exact-head gate passes.
- [ ] Obtain fresh immediate public-deployment approval, deploy, and verify or roll back.
- [ ] Record final source, deployment, PDF, auth-save, and observability receipts.

Candidate evidence recorded on 2026-09-01:

- frozen migration hashes: `0012 64E11AA3577547287C072CC38D79F3A9C19A9CA6986DEABDC6C7DF6684458190`,
  `0013 B6162866FE602E24879829231F28B596DC707DE4D187D93E52C4236983025360`,
  `0014 23ED8FD4E102F75EBAA149BCA07CF2DF3737B7ABFCCD61ECD2160AFC0DEE9DF8`,
  and `0015 2B616B413351B3CFAE8A58FF23CD52638E27094EF2311D70C474D8DB243DBD81`;
- exact visual baseline: 55 PNGs,
  `fbcc9a03d8a26b7076aa2504ac1adf28c28a4196806c9e2849bb6a6aba12f8bb`;
- production remains Site version 63 / marker `v61`; fresh approval is still
  required immediately before the sole production deployment.

Operational release items:

- [x] Replace stale active rollback guidance with verified Site version 63.
- [ ] Replace hosted release-identity values with the exact final v62 Site
  version and web SHA without altering unrelated environment variables.
- [ ] Verify post-deployment structured events carry the exact v62 identities.

## Release blockers

Any clipped/split node, ellipsized title, arbitrary layer cut, orphan or reversed
connector, adjacency drift, landscape graph page, unreadable scale, missing text
alternative, malformed-import regression, mobile mismatch, unresolved high or
critical dependency/security finding, exception, or HTTP 5xx blocks release.

## Deferred / non-goals

Billing, CRM/KYC, email capture, Office co-authoring, arbitrary shared-drive
folders, eDiscovery, retention/legal hold, e-filing, e-signature, DMS sync,
OCR, background AI acceptance, production pricing, and unrelated redesign are
not part of this milestone. No app-store distribution or second v62 Sites
version is authorized merely to repeat verification.
