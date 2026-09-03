# GENESIS: JURIS Development Journal

## 2026-08-31 - v62 initialization

- Loaded the authorized v62 milestone brief and preserved its permanent
  fail-closed release gates.
- Confirmed the original workspace is an older dirty checkout; none of its
  existing changes were modified or discarded.
- Obtained the current Sites source through a short-lived repository credential
  and verified deployed v61 source commit
  `8bd10594bc01e5a45183a743396ac24b7aeaf321`.
- Created isolated web branch `codex/v62-report-graph-pagination` from that exact
  commit. No v61 receipt or production version was changed.
- Confirmed `.openai/hosting.json` still targets the existing Sites project and
  D1 binding; no storage or access-policy change is planned.
- Began read-only architecture, mobile, standards, test, and release-tooling
  reconnaissance before defining the locked layout contract.

### Current gate state

- Web baseline: frozen.
- Mobile baseline: discovery in progress.
- Source changes: documentation only.
- Site versions/deployments: none created.
- Public deployment approval: intentionally deferred until all release gates
  are green.

## 2026-09-01 - Baselines and change surface locked

- Fetched mobile `origin/main` and created isolated branch
  `codex/v62-report-graph-pagination` at exact merge commit
  `29f862649dea378cfe3d4e145f5e396bf6d4c6ff`. The original dirty mobile
  checkout was not modified. Windows long-path checks confirm the new worktree
  is clean when Git long-path support is enabled per command.
- Confirmed the web graph appendix used arbitrary node-group cuts, landscape
  split columns, title ellipsis, approximate character measurement, cropped
  cross-page edges, and incomplete text alternatives.
- Confirmed mobile has no v61 professional ReportModel/PDF implementation;
  v62 mobile work is a deterministic presentation-contract mirror, while Rust
  remains the sole validation/runtime authority.
- Chose to preserve the released v61 ReportModel content-hash shape and add
  layout/render versions and fingerprints outside it.
- Initialized deterministic layout-core, immutable report-manifest/profile
  parity, and mobile documentation work on non-overlapping change surfaces.
- Verified production Site version 63, source `8bd10594...`, custom domain, and
  SSL remain healthy. Found stale hosted release-identity values that would
  mislabel telemetry; correcting and verifying only those two values is now a
  blocking v62 deployment task.
- Updated the v62 product marker in source and replaced active rollback text
  with verified Site version 63. Historical release documents were preserved.

## 2026-09-01 - Layout receipt compatibility

- Added report receipt schema 2 with independent layout schema, algorithm,
  renderer, and layout-fingerprint bindings. No field was added to
  `CanonicalReportModel`, and its schema-1 content-fingerprint input remains
  unchanged.
- Changed receipt parsing to retain structurally valid historical and
  superseded receipts. These records are now visible but stale, rather than
  disappearing from the report dialog.
- Added fail-closed staleness checks for legacy receipts, layout-version drift,
  and an optional freshly computed layout fingerprint.
- Ran `tests/report-model.test.ts`: 5/5 tests passed, including case-content
  drift, layout drift, and legacy/superseded receipt coverage.
- PDF emission still needs to pass the completed deterministic layout artifact
  into schema-2 receipt creation before this gate can be marked complete.

## 2026-09-01 - Deterministic portrait renderer integrated

- The initial layout schema-1 implementation used algorithm 1.0.0 and renderer
  2.0.0. Adversarial visual review subsequently required the unreleased
  algorithm and renderer to be hardened before the release lock was frozen.
- Replaced the production report appendix path with full-width A4 portrait SVG
  pages driven only by the frozen layout model. Whole nodes, wrapped titles,
  fixed-point directed paths, paired `C###` markers, graph-page furniture,
  and layout fingerprints now come from the same artifact.
- Added the complete post-graph text alternative: component/root/terminal
  summary, page-ordered node records with full detail, every directed
  adjacency, and the paired connector index.
- Refactored generation into a one-shot `buildCaseReportArtifacts` pipeline,
  so the PDF definition and schema-2 receipt bind the same canonical model and
  layout fingerprint.
- Set portrait-only document settings plus title and language metadata. The
  report states that the connector treatment is BPMN-inspired and that the
  accessibility-improved PDF is not certified as PDF/UA.
- Strict TypeScript and focused lint passed. The integrated report/layout/
  receipt/manifest suite passed 16/16 tests.
- Installed user-scoped Poppler 25.07.0-0 through WinGet after verified package
  hash validation. All 32 bilingual/audience goldens passed A4, extraction,
  and PNG rendering. The first long-content run exposed a harness-only issue:
  exact whole-record substring matching cannot cross inserted page furniture;
  extracted output visibly retained the complete record. The harness is being
  tightened to verify full cross-page content without weakening the gate.

## 2026-09-01 - Adversarial graph hardening and final web fixture lock

- Froze layout schema 1, algorithm 1.1.0, and renderer 2.1.0 after replacing
  fixed connector rows and direct/curved paths with dynamic connector bands,
  serialized ink geometry, and deterministic obstacle-free orthogonal routes.
- Added complete serialized layer boxes, measured wrapping for every repeated
  header field, grapheme-safe fallback, full-detail fit/dedicated/deferral
  ordering, and self-contained connector relationship/accessibility text.
- The 200-node binary stress model produces 13 graph pages and 187 paired
  cross-page edges. Its busiest tested page has 45 legible endpoints across
  multiple connector rows without node, marker, label, header, or footer ink
  collisions.
- Focused graph/layout/renderer tests pass 15/15; fixture regeneration/check,
  strict TypeScript, focused ESLint, and diff/whitespace checks are green.
- Exact Bhopal preflight caught and corrected two fixture-generator defects:
  the profile kind now matches the immutable production registry
  (`legal_advisory`), and all input arrays use production-canonical ASCII ID
  order. The final web fixture lock SHA-256 is
  `4a0a60c79c8224daa9a0c81c2d78987b2bf22e9c278d1cf95f28fcf8b7ce0290`.
- Added a normal-mode read-only visual regression gate. Re-baselining is
  possible only with `REPORT_PDF_UPDATE_VISUAL_BASELINE=1`, after all 47 PDFs
  pass, using exact Poppler 25.07.0 at 96 DPI. No baseline has been blessed
  before human inspection.

## 2026-09-01 - Scope correction and Slice 0 completion

- Re-read the newest approved Downloads brief,
  `GENESIS_JURIS_CODEX_INSTRUCTIONS_DECISION_CENTRIC_DOSSIER_WORKSPACE_V1.md`
  (41,122 bytes). It defines graph pagination as mandatory Slice 0 and requires
  the full decision-centric dossier MVP through Slices 1–7. Stopped the prior
  graph-only release trajectory; no Site version or deployment was created.
- Closed the second graph refreeze at schema 1 / algorithm 1.1.0 / renderer
  2.1.0. Final fixture, font-metrics, and manifest SHA-256 values are
  `7f71a976872aa7266a7c360529430b9bdc6c2978368917bc0d61c0e3a33e249f`,
  `dce864593f4230771a0466e73eec1f7f2cf3a1024bcc83580975d4e1fefe7dda`,
  and `261ff3984e2e73a52f1bf672f94a7e6b0312c1f5d5a228b5e372ec5c885de5f3`.
- Added exact whole-definition Roboto/XML preflight and bounded typed UI
  diagnostics. Changed the rule-based fallback to a content-neutral template;
  raw intake remains only in governed prompt history and cannot be copied into
  report-visible nodes automatically.
- Added durable premise publication provenance across normalization,
  revisions, submission/publication boundaries, public payloads, and reports.
  Prompt-derived/legacy premise text is excluded; deliberately author-reviewed
  context is retained. Provenance remains outside the released case and
  ReportModel fingerprints but is bound by the presentation receipt.
- Added strict report-boundary HTTPS canonicalization, credential/scheme/length
  rejection, valid-link-only PDF annotations, internal warnings, and
  final/client blockers while preserving the byte shape of safe v61 source
  URLs in legacy case fingerprints.
- Added receipt presentation fingerprints for language, labels, audience,
  classification, preparer/recipient/reference, include flags, approvals,
  redactions, audit presentation, and premise publication. Generation time
  remains intentionally excluded.
- Hardened release verification: visual baseline update mode is forbidden,
  hosted workflow evidence must have exactly Android/Flutter/iOS/Rust keys,
  Dart formatting covers `lib test tool integration_test`, and a final checkout
  guard proves mobile exact HEAD and tracked bytes after all native commands.
- Fixed Guided Studio restoration so empty untitled drafts overwrite stale
  URL/local Step 6 state with Step 1.
- Verification at this checkpoint: strict TypeScript passed; final graph tests
  passed 33/33; expanded report/privacy/domain/Studio/release tests passed
  63/63; the focused post-empty-draft set passed 23/23. The 47-PDF human visual
  baseline, mobile parity, dossier slices, full gates, commits, pushes, saved
  Site version, and deployment remain open.

## 2026-09-01 - Authoritative brief receipt and Slice 2 stop gate

- Read the complete user-attached 1,418-line Decision-Centric Dossier Workspace
  brief, SHA-256
  `283b05cce4bd966c7dd007b688f81456f62c99d29ff72c1cdb5de4fc120578c9`.
  It confirms the existing Slices 0-7 scope and five required end-to-end
  scenarios; it does not authorize a graph-only release.
- Confirmed the deployed Sites project exposes D1 but `.openai/hosting.json`
  has `r2: null`; the Worker environment has no private object-store binding.
  The Sites persistence contract requires uploads/documents in R2 and metadata
  in D1, so Slice 2 will add a private logical R2 binding rather than store
  document bytes in D1. No byte API may be exposed until server-side
  hash/media validation, opaque keys, owner/participant-gated downloads, and
  indistinguishable unauthorized/not-found behavior are proven together.
- Confirmed `users.organisation` is mutable profile text and
  `__genesis_tenant__` is an AI-capacity label, not a tenant or membership
  authority. The MVP authorization boundary therefore uses authenticated owner
  identity plus explicit dossier participant roles and does not invent tenancy.
- Rejected the provisional D1 BLOB fallback after reading the mandatory Sites
  persistence guidance. R2 provisioning and wiring remain external release
  actions; they occur only in the later authorized Sites publish sequence.

## 2026-09-01 - Slice 1 contract accepted and safety receipt strengthened

- Added `docs/ADR-V62-DECISION-DOSSIER-CONTRACT.md` with all ten required
  architecture decisions and explicit authoritative, derived, immutable-cache,
  operational-job, and presentation-only boundaries.
- Froze `app/dossier-contract.v1.json` and the strict
  `app/dossier-contract.ts` parser/serializer. The registry carries every
  persisted enum, readiness reason, and lifecycle edge; validation rejects
  unknown schema surface, invalid references/history, silent AI acceptance,
  stale snapshot/output bindings, and broken audit order.
- Kept the contract dormant from v61 case fingerprints, report semantics, and
  Rust simulation adapters. No legacy case is converted implicitly. The ADR
  confirms private logical R2 bytes plus D1 metadata, explicit participants,
  and a 409 account-deletion stop until governed transfer/pseudonymisation.
- Independently ran the contract suite (6/6) and strict TypeScript (pass).
- Added a separate compatible publication-safety fingerprint for premise
  review provenance. Server save concurrency, protected import verification,
  custom-case load, moderation evidence, and admin promotion now compare the
  authoritative stored state. The focused integrity suite passes 24/24;
  client/report propagation remains open, so release sign-off is still held.

## 2026-09-01 - Release verifier made dossier-complete and source-exact

- Removed the graph-pagination-only PASS claim from the v62 verifier.
- Added an exact web-checkout receipt that requires the reviewed 40-character
  HEAD, a clean index/worktree, no untracked files, no divergent submodules,
  and a SHA-256 over every raw tracked working-tree byte. The same receipt is
  recomputed after all web/mobile/native tools and must match exactly.
- Added deliberate hard stops for the not-yet-landed five-scenario dossier E2E
  test and executable Flutter report-layout fixture/fingerprint probe. Runtime
  route parity no longer overclaims presentation-layout parity.
- Release-harness and checkout regression tests pass 7/7, including clean,
  modified, untracked, and wrong-HEAD cases. No release was attempted.

## 2026-09-01 - Logical private document vault declared in source

- Following the mandatory Sites persistence contract, changed only the source
  binding from `r2: null` to logical `DOSSIER_DOCUMENTS` and added the Worker
  `R2Bucket` type.
- Added a regression proving D1 stays the metadata binding and the hosting
  source contains no bucket name, public URL, token, secret, or credential;
  the focused binding test passes 1/1.
- No physical R2 resource was provisioned, no byte route was enabled, no Site
  version was saved, and nothing was deployed. Those remain gated on the
  owner/participant upload/download and release authorization sequence.

## 2026-09-01 - Non-graph report safety blockers closed

- Replaced the origin-wide report receipt key with a strict v2 key scoped by
  the verified account device hash. Legacy keys are ignored and removed;
  anonymous, private, protected, workspace, shared-inspection, and otherwise
  ineligible reports remain memory-only. Storage failures cannot invalidate an
  already-completed local PDF download.
- Blocked inspection-only PDF export at both Studio buttons, the report-open
  function, the dialog generator, and the download function's explicit
  authorization argument.
- Threaded the separate publication-safety fingerprint through SIWC retry,
  exact save/child CAS, protected import, custom-case open, and report
  readiness. A local premise-review change can no longer reuse a v61 semantic
  saved/reviewed receipt.
- Added the rendered lineage `currentCode` and `copyPolicy` to the presentation
  projection only when technical IDs are visible; hidden technical fields do
  not spuriously stale a client report.
- The integrated focused report/domain/protection/persistence/Studio/receipt
  suite passes 66/66 and strict TypeScript passes. No deployment was attempted.

## 2026-09-01 - Governed account-deletion interlock

- Added a pre-deletion lookup against both dossier ownership and dossier
  participant history. Any match stops the operation before identity cleanup
  with private no-store `409 dossier_transfer_required` semantics.
- The response intentionally contains no dossier ID, role, status, or other
  responsibility detail. Removed/inactive participant history remains governed
  until an explicit transfer or pseudonymisation workflow exists.
- The focused authentication/security suite passes 9/9 and strict TypeScript
  passes. No R2 resource, Site version, push, or deployment was created.

## 2026-09-01 - Deterministic readiness projection

- Added a runtime-neutral evaluator which always returns the frozen ten
  readiness dimensions in registry order and never infers readiness from the
  dossier lifecycle status.
- Findings are sorted deterministically, retain exact related-object deep
  links, and cannot be hidden inside a `not_applicable` dimension. Callers must
  provide the explicit dossier revision and canonical evaluation timestamp so
  snapshot projections remain reproducible.
- Focused readiness tests pass 4/4 and strict TypeScript passes. Route-level
  fact collection and the responsive readiness UI remain part of Slices 2-3.

## 2026-09-01 - Slice 2 security core independently accepted

- Froze the complete ordinary action matrix for owner, contributor, reviewer,
  viewer, removed participant, trusted creator, and the separately audited
  platform-admin archive override. Organisation labels and client claims grant
  no authority.
- Added opaque private object-key scoping, exact media/size/hash observation,
  bounded quotas, strict TXT/Markdown extraction, honest PDF/DOCX no-parser
  states, upload-intent commit/cleanup CAS decisions, and non-disclosing private
  download responses.
- Root independently reran the focused suite (19/19), ESLint (pass), and strict
  TypeScript (pass). Database triggers and route integration remain separately
  gated; this receipt does not sign off the still-reviewed migration.

## 2026-09-01 - Persistence migration sign-off withheld

- A separate read-only senior review reproduced SQL-level bypasses in the
  current 0012 draft: governed hard deletion, expected/measured upload drift,
  unsafe object cleanup, cross-dossier accepted-proposal insertion, mutable
  extraction/package provenance, and reviewer-approval impersonation.
- The review also found contract/storage drift for revision zero, canonical
  SHA-256 representation, confidence-score units, and server-resolved actor
  identity. These are release-blocking integrity issues, not documentation
  nits.
- Route activation and Slice 2 sign-off are held until the persistence owner
  closes every finding, reruns fresh and v61-upgrade probes, and the reviewer
  performs a clean in-memory re-audit.

## 2026-09-01 - Source-grounded proposal review core

- Added an explicit pending-proposal review transition for owner, contributor,
  and reviewer roles. Viewer review, repeated review, source substitutions, and
  accepted-object smuggling on rejection fail closed.
- Acceptance and edit-and-accept require every proposal source version to have
  an exact cited anchor plus a server-generated authoritative object binding.
  Replacing a source version supersedes pending proposals and returns accepted
  dependencies for stale review without changing accepted proposal history.
- The model-provider context labels uploaded text as untrusted document data
  and forbids instructions in it from changing roles, policy, source bindings,
  or acceptance state. Focused tests pass 5/5; ESLint and strict TypeScript pass.

## 2026-09-01 - Stored readiness facts wired

- Added bounded metadata-only fact collection for document completeness,
  current-version provenance, information requests, pending AI proposals,
  contradictions, critical deadlines, graph validation, simulation receipts,
  snapshot/output freshness, and reviewer approval.
- The collector resolves latest output state and exact snapshot revision while
  keeping document bytes and extracted bodies outside catalogue/overview reads.
- The complete blocker-matrix tests pass 3/3 and focused ESLint passes. The
  subsequent integrated route gate also passes the repository-wide strict
  TypeScript check.

## 2026-09-01 - Matter server context and catalogue/detail routes

- Added a private server context that accepts only the stable actor ID persisted
  on a registered authenticated user. Dossier-object access is a single joined
  active-participant authorization boundary with indistinguishable no-store
  404s; free-form organisation labels and client actor claims grant no access.
- Added bounded participant-scoped Matter catalogue reads, server-owned draft
  creation at revision 1, exact detail reads, and safe-field updates. Catalogue
  readiness is metadata-only, while detail responses use the full deterministic
  stored-fact projection.
- Generic updates require the expected revision and cannot mutate status,
  ownership, tenant labels, approvals, hashes, or audit data. An authoritative
  edit appends stale-state events for current outputs and a sequential audit
  chain in the same D1 batch.
- Root reran the combined server, route, and readiness suite (15/15), focused
  ESLint (warning-free), and repository-wide strict TypeScript (pass). No R2
  resource, Site version, push, or deployment was created.

## 2026-09-01 - Responsive Matter workspace

- Added the /matters catalogue and seven-destination dossier workspace with
  bounded safe metadata, first-viewport responsibility and readiness facts,
  User/Developer modes, compact phone navigation, and explicit loading, empty,
  permission, stale-revision, unsupported, and generic failure states.
- Kept logical documents separate from immutable versions; visually separated
  source-cited AI proposals from authoritative records; exposed packages,
  snapshots, requests, deadlines, outputs, reviewer approvals, and bounded
  activity without treating unavailable route data as successful.
- Every client mutation carries the visible expected revision. Pilot upload
  checks constrain file names, media types, empty/oversize input, and require a
  synthetic/de-identified privacy acknowledgement.
- Root independently reran the focused UI suite (9/9), focused ESLint (clean),
  and whitespace checks (pass). The required in-app Browser smoke was attempted,
  but this runtime exposed no browser backend, so no substitute browser tool was
  used and visual smoke remains open.

## 2026-09-01 - Protected lifecycle-transition route

- Added a distinct transition authorization action for owners, contributors,
  and reviewers; viewers remain read-only and generic Matter update cannot
  change lifecycle status.
- The route accepts only bounded transition fields, evaluates the frozen matrix
  with current-output and reviewer-approval facts read from D1, and never trusts
  client claims for role, actor, approval, output state, or admin override.
- The dossier revision/status compare-and-set, immutable transition row,
  closure/archive facts, output-stale state events, deterministic readiness
  recomputation, and sequential audit events are one intended D1 batch.
- The focused contract/security/transition set passes 32/32 and focused ESLint
  is clean. The initial repository-wide typecheck was temporarily blocked by
  a concurrent persistence change requiring an audit revision receipt in the
  shared server helper. Review also caught that one unique audit row per
  revision would break legitimate multi-event chains; persistence sign-off now
  requires both stale-writer rollback and same-revision multi-event commit
  proofs. No push, Site version, R2 resource, or deployment was created.

## 2026-09-01 - Multi-event-safe audit revision receipts

- Added a positive dossier-revision binding to every D1 dossier audit row and a
  separate primary-mutation receipt flag. A partial unique index permits exactly
  one primary receipt for each dossier revision while bounded
  output-marked-stale consequence events share that revision.
- The database primary-receipt trigger requires the live dossier revision.
  Therefore a stale compare-and-set that updates zero rows cannot append a
  duplicate receipt; the batch aborts and rolls back. Secondary consequence
  events require the already-inserted primary receipt.
- The shared audit helper validates and hashes the revision plus receipt role,
  marks only the first event in a mutation batch primary, and retains the
  sequential previous-event digest chain. Creation, generic update, and status
  transition callers now pass their exact resulting revision.
- Root reran the reconciled server/route suite (14/14), focused ESLint (clean),
  and repository-wide strict TypeScript (pass). Persistence tests separately
exercise both stale-writer rollback and legitimate same-revision consequence
commit. No external resource or deployment was created.

## 2026-09-01 - Request, activity, and private document reads

- Integrated bounded request/deadline APIs with joined participant access,
  same-origin mutation checks, server-owned actor identity, exact revision CAS,
  and same-Matter satisfying-source validation before a request can be received.
- Integrated a metadata-only immutable activity feed with opaque keyset
  cursors. It exposes neither document bodies nor storage identifiers.
- Added finalized-document-only catalogue reads and an authorized download
  boundary. The download path completes its D1 dossier/document/version lookup
  before touching private R2, checks stored size, media, custom SHA-256, and R2
  checksum, and returns only safe attachment metadata.
- Closed two adjacent lifecycle gaps: new Matters require at least one
  jurisdiction, and provisional zero-version documents do not enter visible
  document counts.
- Root's combined dossier route/security regression passes 46/46; focused
  ESLint and strict TypeScript both pass. Upload commit/cleanup is still under
  implementation and persistence sign-off remains explicitly withheld. No R2
  resource, Site version, push, or production deployment was created.

## 2026-09-01 - Private upload transaction and second schema re-audit

- Implemented bounded multipart ingestion with exact allowlisted fields,
  duplicate-field rejection, privacy acknowledgement, strict filenames,
  byte-signature media observation, per-file/dossier quotas, and canonical
  SHA-256 measurement.
- The route stages an idempotent provisional intent before R2, uses create-only
  object writes, verifies R2 size/media/custom hash/checksum, and commits the
  immutable version, current pointer, extraction job, dossier revision,
  output-stale consequences, and primary audit receipt in one D1 batch.
- TXT/Markdown derived extraction is lease-bound and becomes visible only when
  the job and immutable result commit together. PDF/DOCX remain honestly
  not_extractable. Response bodies expose download routes, never object keys or
  extracted text.
- Root reran focused upload/catalogue/download tests (12/12), focused ESLint
  (clean), and repository strict TypeScript (pass).
- Senior re-audit withheld schema sign-off on five lifecycle edges: an explicit
  safe pre-expiry abort is missing; deleted failed later-version intents retain
  a unique retry key; external/import zero-version rows can poison finalized
  counts; accepted proposals can target provisional documents; and received
  requests can bind provisional documents. Persistence remediation is active.
- No R2 resource, Site version, push, or production deployment was created.

## 2026-09-01 - Proposal route integration

- Added bounded cursor-paged proposal reads and exact same-origin create,
  pending-source-rebind, accept, edit-and-accept, and reject actions. Client
  actor, role, review, model, and accepted-object authority fields are absent
  from the allowlist.
- Pending candidate value/type/model provenance is immutable. Edit-and-accept
  preserves that history and creates a new accepted professional assertion
  from the reviewed value, with exact accepted-anchor sources and server actor
  attribution. Unsupported authoritative mappings fail closed.
- Accepted review stales current governed outputs and writes the assertion,
  source bindings, review decision, revision CAS, output events, and chained
  audit receipt atomically.
- Root independently reran the proposal route tests (7/7), focused ESLint
  (clean), and strict TypeScript (pass). A wider 55-test run passed all 53
  non-changing cases; two persistence assertions raced the active migration
  remediation and will be rerun against its next explicit freeze.
- No external resource, push, Site version, or deployment was created.

## 2026-09-01 - Receipt architecture correction and failed-upload abort

- Re-audit proved the earlier partial-unique audit-row receipt design could not
  represent snapshot creation, output generation, and approval at one unchanged
  source revision. It is superseded by an append-only
  `dossier_revision_receipts` CAS-token table; audit events reference the token
  but remain unlimited and sequential at that current revision.
- Updated every implemented revision mutation (Matter create/update/transition,
  request create/status, proposal create/rebind/review, and document commit) to
  insert exactly one receipt after its guarded revision change and before its
  audit events.
- Corrected upload commit ordering to verify the pending intent in D1 before
  inserting the version required by the persistence trigger. Added an explicit
  actor-bound abort CAS with immutable uppercase failure receipt, post-claim R2
  deletion, terminal cleanup, and removal of unreferenced retry metadata.
- Root reran 52 focused route/security/receipt tests successfully; focused
  ESLint and strict TypeScript passed. Persistence remains under concurrent
  frozen-hash review, so this is not schema sign-off. No external resource,
  push, Site version, or deployment was created.

## 2026-09-01 - Slice 0 PDF corpus and visual baseline closed

- Exact Poppler 25.07.0 rendered the complete 47-fixture corpus into 702 A4
  PDF pages and 702 PNGs. Structural, extraction, geometry, adjacency, fixture,
  renderer, and raster checks all passed.
- Manually inspected all 702 pages through 36 labelled contact sheets and then
  inspected Bhopal, cyclic-repair connectors, long-title, long-detail, and
  maximum-200-node pages at full resolution. No clipped cards, anonymous
  connector lines, landscape pages, blank renders, or broken typography were
  accepted.
- Locked 55 governed page hashes in
  `parity/report-pdf-visual-baseline.v1.json`, SHA-256
  `fbcc9a03d8a26b7076aa2504ac1adf28c28a4196806c9e2849bb6a6aba12f8bb`.
  A second full run with baseline-update mode unset passed normal-mode replay
  without mutation. Its 47-fixture QA manifest SHA-256 is
  `50abedd58f7991915abe7a90a58ecdd286e54a0da84e605381b7be4f8f4e0e62`.

## 2026-09-01 - Executable private-upload integration accepted

- Extracted the exact post-auth document-upload transaction into the shared
  coordinator used by the route and exercised it with migration 0012 against
  real Miniflare D1 and private R2 implementations.
- The integration suite passes 11/11: TXT/PDF success and honest
  `not_extractable`, lost-201 replay before revision/quota checks, atomic
  reservations, actor/request provenance rejection, immediate abort and key
  reuse, first/later-version rollback, deleting/deleted crash recovery,
  wall-clock expiry plus cleanup ordering, commit/abort one-winner behavior,
  and queued/expired-processing extraction recovery.
- Neighboring upload/route/security tests pass 13/13; strict TypeScript and
  focused ESLint pass. The origin, multipart, and access wrapper remains
  static/unit-covered because Node cannot import the Cloudflare route module.
  No physical R2 resource, Site version, push, or deployment was created.

## 2026-09-01 - Evidence routes and graph substitution resistance

- Added bounded anchor, assertion, and evidence-link APIs. Every mutation is
  participant-scoped, same-origin, exact-revision, and server-attributed.
- Manual and accepted anchors revalidate finalized immutable document versions,
  exact extraction versions, and source checksums. Accepted assertions cannot
  cite provisional documents. AI provenance remains proposal-only until an
  explicit permitted professional review creates an authoritative record.
- Graph links require the same dossier's exact current published package and a
  real node or edge under the stored graph digest. Executable production-helper
  tests cover fingerprint, compile, digest, node, edge, package, and dossier
  substitution; the Evidence suite passes 8/8, focused ESLint is warning-free,
  and strict TypeScript passes.
- Report-section links remain fail-closed because no dossier-scoped section
  entity exists in migration 0012. No production resource or deployment state
  changed.

## 2026-09-01 - Flutter layout lock reproduced exactly

- Replaced the stale mobile 1000-UPM approximation with the governed web 1.1
  contract: exact 2048-UPM face locks, positive shaping allowances, one-run ink
  reservations, the versioned grapheme-break receipt, seven compact connector
  rows per side, distinct route lanes, endpoint IDs, and preserved gutter seams.
- Added a pure-Dart fail-closed release probe that accepts the exact
  `verify-release.sh` manifest/metrics/fixtures arguments and proves byte and
  semantic manifest equality before evaluating all seven fixtures.
- Receipt hashes are manifest
  `261ff3984e2e73a52f1bf672f94a7e6b0312c1f5d5a228b5e372ec5c885de5f3`,
  metrics `dce864593f4230771a0466e73eec1f7f2cf3a1024bcc83580975d4e1fefe7dda`,
  and fixtures `7f71a976872aa7266a7c360529430b9bdc6c2978368917bc0d61c0e3a33e249f`.
  All fixture fingerprints match, including the 200-node/187-connector stress
  graph. Focused tests pass 13/13, full Flutter tests pass 256/256, and full
  Flutter analysis is clean. A temporary short drive mapping avoided the known
  283-character generated iOS path and was removed after each command.

## 2026-09-01 - Adversarial migration audit withheld sign-off

- A fresh independent SQLite audit retracted the earlier frozen migration
  candidate after committing five foreign-key-clean high-severity bypasses:
  incomplete lifecycle authority, state-less governed outputs, audit-less
  receipts, invalid sealed readiness/approver manifests, and forged extraction
  versions on accepted anchors.
- The remediation changes the authoritative revision batch order to domain and
  stale-state writes, complete audit events, then the receipt last. Status
  changes additionally require the transition row before the dossier update.
  The final migration hash and every reordered route remain release-blocking
  until independently rerun; no R2 bucket, Site version, or deployment exists.

## 2026-09-01 - Mobile adversarial parity tests complete

- Added exact font-face byte-drift and malformed Unicode/unsafe-shaping
  regression coverage to the synchronized Flutter report contract and layout
  suite.
- Focused contract/layout tests pass 15/15, the complete Flutter suite passes
  258/258, and full Flutter analysis remains clean.
- The temporary short Windows drive mapping used for the deeply nested iOS
  package path was removed after the run. No deployment or app-store state
  changed.

## 2026-09-01 - Matter User View completes governed manual workflows

- Added a logical-document selector to the safe upload form so a user can add
  an immutable version without losing access to earlier versions.
- Added bounded forms and role-aware review actions for exact manual source
  anchors, professional assertions, and current-package graph node/edge links.
- Added the exact document-link action that moves an open information request
  to received without copying privileged source text into list or audit views.
- `dossier-workspace-ui.test.ts` passes 9/9 and focused ESLint is clean.
  Full TypeScript will be rerun after the concurrent decision-package route
  stops changing.

## 2026-09-01 - Exact decision-package and simulation receipt gate

- Added exact published package ID/version/playable-fingerprint resolution and
  deterministic Studio graph validation without changing Rust simulation
  rules.
- Enforced exact governed parent lineage and canonical reviewable graph diffs;
  source-grounded pending proposals are accepted only inside the same atomic
  package mutation that proves the target graph.
- Re-proved every referenced v61 session against authenticated ownership,
  completed status, contiguous start-to-terminal event history, exact package
  identity, runtime-state digest, parameter-binding digest, and receipt digest.
- Fixed upload finalization ordering so stale outputs and complete chained
  audits precede the revision receipt, with the intent committed last.
- Root replayed 24 decision-package/Evidence tests successfully. The complete
  Slice 5 handoff also passed 12/12 Miniflare upload integration tests, strict
  TypeScript, and warning-free scoped ESLint.
- No external resource, saved Site version, push, or deployment was created.

## 2026-09-01 - Final frozen-chain and cross-platform candidate gate

Migrations `0012` through `0015` were frozen after fresh-schema, v61-upgrade,
no-drift, and independent mutation/audit review. The final schema receipt is 62
tables, 251 triggers, no foreign-key violations, and SQLite integrity `ok`.
No Critical or High mutation/audit blocker remains for the documented rollout.

The held upload, proposal, governed-output, and end-to-end suites passed 29/29.
Historical non-pilot snapshot/output rows now fail manifest download, generation,
output download, and approval before private-object access or approval mutation.
Owner-only participant enrollment adds exact Actor-ID lookup, server-resolved
identity, a 100-row history-inclusive capacity, reviewer authorization, atomic
output staleness, audits, and a final revision receipt; its focused gate passes
17/17.

The complete web run produced a verified build and 493/493 passing tests.
Strict TypeScript, full ESLint, production dependency audit with zero
vulnerabilities, and patch hygiene passed. PDF verification reproduced 47 PDFs,
702 pages, 702 PNG pages, and the exact 55-PNG baseline
`fbcc9a03d8a26b7076aa2504ac1adf28c28a4196806c9e2849bb6a6aba12f8bb`.
Flutter analysis and all 258 tests passed; Rust format, Clippy, and all locked
workspace tests passed; Android native persistence passed 12/12.

Local `/` and `/matters` requests returned 200 with the expected no-store and
browser security headers. Visual browser inspection remains explicitly
unverified because the trusted in-app browser service is unavailable in this
chat; the temporary compatible Node runtime and PATH shim used to diagnose that
boundary were removed. No unsupported browser automation was substituted.

The remaining release boundary is exact commits and push, exact-head hosted
Android/Flutter/iOS/Rust evidence, one saved Sites version, fresh explicit
production approval, and post-deployment verification. Production and app-store
state are unchanged.

## 2026-09-01 - Mobile release head published and four hosted gates accepted

The approved mobile branch `codex/v62-report-graph-pagination` was pushed at
`268401ab7dbc12cdc80c20a281268189aad01e60`. Rust run `33503429648`, Flutter run
`33503429646`, Android run `33503429598`, and iOS run `33503429554` each
concluded `success` on that exact SHA; the iOS run completed the native simulator
lifecycle rather than stopping at build or export inspection.

The web parity lock now binds that exact commit and only those four successful
hosted receipts. The final checkout guard now admits only the 11 exact generated
paths created by Flutter/Android/iOS release commands and still rejects arbitrary
ignored source; its focused checkout/release matrix passes 16/16.

The mobile branch was not merged, no app-store action was taken, and production
remains Site version 63 / marker `v61` pending the final exact-web-head verifier,
Sites source push/save, and fresh immediate deployment approval.
