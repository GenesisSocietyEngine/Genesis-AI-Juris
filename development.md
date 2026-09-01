# GENESIS: JURIS Development

## Active milestone

Product version **v62** is the **Decision-Centric Dossier Workspace and
Document Intelligence MVP**. Deterministic A4 portrait graph pagination is the
mandatory Slice 0 hardening gate, not the complete release. The verified v61 baseline is web commit
`8bd10594bc01e5a45183a743396ac24b7aeaf321`, mobile `main` commit
`29f862649dea378cfe3d4e145f5e396bf6d4c6ff`, and production Sites version 63.

Development happens on isolated v62 web and mobile branches. The v61 release
commits, receipts, and rollback deployment remain immutable.

The authoritative user-attached brief is the 1,418-line instruction version
1.0 prepared 31 August 2026, with SHA-256
`283b05cce4bd966c7dd007b688f81456f62c99d29ff72c1cdb5de4fc120578c9`.

## Architectural contract

- Rust remains authoritative for case and report input validation.
- A Matter/Dossier is a governed workspace that may reference zero, one, or
  multiple immutable decision-package versions; it is never itself playable.
- Documents and their versions, reviewed assertions/source anchors, lifecycle
  status, computed readiness, snapshots, outputs, and audit events are distinct
  canonical objects. AI records remain proposals until explicit professional
  review.
- Existing v61 cases are not silently migrated. Anonymous/local case PDF,
  JSON/Markdown import/export, and deterministic simulation remain compatible.
- `CanonicalReportModel` remains the semantic report source. Pagination data
  must never enter its content fingerprint or the canonical case graph.
- A versioned, deterministic `ReportGraphLayoutModel` is the sole presentation
  projection between the report model and PDF renderer.
- Web and Flutter must agree byte-for-byte on locked layout fixture semantics:
  node-page assignments, connector identities, and the layout fingerprint.
- Renderer or layout-version drift makes a rendered receipt stale without
  making the professional matter or `CanonicalReportModel` stale.
- Every report and graph page is A4 portrait. Nodes remain whole, titles wrap,
  page breaks occur only between complete layers, and cross-page edges use
  paired BPMN-inspired off-page continuity markers.
- Every visual graph is followed by a complete extractable textual alternative:
  ordered node register, full adjacency list, connector index, and summary.
- Confidential PDF generation remains local by default. External reports must
  continue to exclude prompts, secrets, and internal-only audit material.
- Existing registry, playbook, report-manifest, import/export, revision, route,
  SIWC-return, stale-chunk, and anonymous-local-PDF gates remain fail closed.

## Implementation strategy

1. Slice 0: close the empty-draft, graph pagination, PDF privacy/integrity, and
   release-harness gaps without changing v61 runtime semantics.
2. Slice 1: freeze the dossier ADR, wire contract, roles, lifecycle transition
   matrix, readiness reasons, and compatibility strategy.
3. Slice 2: add additive D1 persistence and authenticated service boundaries
   for dossiers, immutable document versions, anchors, requests, audit, and
   optimistic concurrency. Add a private logical R2 binding for document bytes
   while D1 retains ownership/version metadata. Document-byte APIs remain
   blocked until server hash/media validation, opaque object keys,
   owner/participant-gated download, and non-leaking route tests are proven.
   The binding is a bounded pilot vault, never enterprise DMS storage.
4. Slices 3–4: add the accessible Matter workspace and source-grounded proposal
   review without silent AI acceptance.
5. Slices 5–6: bind decision packages and governed outputs to immutable dossier
   snapshots and export a versioned manifest.
6. Slice 7: run the five factual end-to-end scenarios, security/performance,
   browser/native, full PDF, and cross-runtime gates on exact final heads.
7. Only after all slices pass: merge/push/package one Sites version, request
   fresh immediate production approval, deploy, and verify or roll back.

## Standards language

The connector treatment is described only as **BPMN-inspired off-page
continuity**. GENESIS graphs are not BPMN models. Generated PDFs are described
as accessibility-improved unless tagged output is independently validated for
PDF/UA conformance.

## Release discipline

No public version is saved until all local and CI gates pass on exact reviewed
heads. Site version 63 remains the rollback target. Public deployment requires
fresh explicit approval immediately before deployment. App-store distribution
is out of scope without separate authorization.

## Baseline findings and compatibility decisions

- The v61 PDF used arbitrary four-node slices, landscape pages, a 57/43 graph
  and right-register split, character-count estimates, ellipsized titles, and
  anonymous cropped edges. None of those presentation heuristics is reused as
  the v62 layout contract.
- Mobile v61 has no professional ReportModel or PDF renderer. Mobile v62 adds a
  pure presentation-layout parity model and locked fixture evaluator; it does
  not duplicate Rust rules or imply that mobile PDF bytes must match web bytes.
- The v61 `CanonicalReportModel` includes its legacy `rendererVersion` in the
  already-released content fingerprint. v62 preserves that value and hash
  shape. New layout schema, algorithm, renderer, and fingerprint fields live in
  the layout projection and render receipt only.
- Existing v1 receipts should remain parseable as legacy receipts and display
  as layout-stale. They must not disappear merely because a new renderer exists.
- The active hosted release-identity variables currently lag the actual v61
  deployment. The v62 release must update only
  `GENESIS_DEPLOYMENT_VERSION` and `GENESIS_WEB_COMMIT` to the assigned saved
  Site version and exact pushed SHA before deployment, then verify emitted
  telemetry. Secrets and unrelated environment entries remain unchanged.
- The active rollback target is verified Site version 63. Historical v53
  runbooks remain historical; active application guidance names version 63.

## Current implementation state

- The locked layout core now uses integer micrometres, exact committed Roboto
  advance metrics, stable components/topology layers with complete serialized
  boxes, three-lane portrait sub-layers, atomic layer packing, obstacle-free
  orthogonal routes, dynamic connector bands, compact paired `C###`
  connectors, and complete relationship/accessibility records.
- The frozen presentation contract is layout schema 1, algorithm 1.1.0, and
  renderer 2.1.0. Every rendered coordinate, route, connector ink box, header
  line, and layer bound is included in the layout fingerprint.
- PDF generation computes the canonical model and layout model exactly once.
  It renders every graph page through the locked coordinates at full A4
  portrait width, then emits the summary, node register, full adjacency
  register, and connector index in logical order.
- Graph cards grow to retain complete measured detail. A card is remeasured on
  a dedicated full-width page before the exceptional `Full detail: Nxx`
  fallback is permitted; the following register always retains the complete
  Unicode content.
- Report receipt schema 2 is implemented as a presentation receipt. It binds
  layout schema, algorithm, renderer, layout fingerprint, and a separate
  presentation fingerprint alongside the unchanged semantic report fingerprint.
- PDF source annotations are generated only from canonical HTTPS URLs with no
  credentials. Invalid values are omitted for internal drafts and block final
  or client output. Raw prompt premises, prompt audit messages, and the
  rule-based fallback's intake sentences cannot enter report-visible fields.
- Empty untitled drafts now override stale URL/device workflow state and open
  Guided Studio at Step 1.
- The release verifier now checks Dart formatting across `lib`, `test`, `tool`,
  and `integration_test`, rejects PDF baseline mutation mode, requires exact
  hosted evidence keys, and revalidates the mobile exact HEAD/tracked bytes
  after every mobile/native tool.
- Historical schema-1 receipts and receipts from superseded renderers remain
  parseable for operator visibility, but the stale check fails closed until a
  current schema-2 layout binding is present.
- Focused receipt tests prove case-change, layout-fingerprint-change, legacy,
  and superseded-version staleness without storing report content.
- The PDF metadata sets a document title, display-title preference, and
  `en-GB` or `ru-RU` language. The generated output is described as
  accessibility-improved and explicitly not certified as PDF/UA.
- The final web fixture lock is ASCII-canonical and has SHA-256
  `7f71a976872aa7266a7c360529430b9bdc6c2978368917bc0d61c0e3a33e249f`.
  The governed font-metrics artifact is
  `dce864593f4230771a0466e73eec1f7f2cf3a1024bcc83580975d4e1fefe7dda`;
  the report manifest is
  `261ff3984e2e73a52f1bf672f94a7e6b0312c1f5d5a228b5e372ec5c885de5f3`.
  The exact Bhopal input is bound to the production
  `decision_memorandum / legal_advisory` profile semantics.
- Slice 1 now has an accepted ten-question architecture ADR, an exact
  versioned registry, and a strict runtime-neutral dossier bundle validator.
  It fails closed on unknown schema surface, cross-dossier references,
  invalid immutable history, silent AI acceptance, stale snapshot/output
  bindings, broken audit chains, and transitions outside the role matrix.
- A separate publication-safety fingerprint now binds premise review state
  without changing the released semantic case fingerprint. Server save CAS,
  protected import verification, exact custom-case load, and admin promotion
  compare the authoritative safety binding. Client/report propagation remains
  part of the current hardening closure before release sign-off.
- The release verifier no longer claims graph-only readiness. It now requires
  an explicit exact web HEAD, rejects tracked/staged/untracked drift, hashes
  raw tracked bytes before and after all tools, runs the five dossier E2Es, and
  invokes an executable Flutter layout-fixture/fingerprint probe before it can
  emit the dossier-MVP PASS line. The absent future gates deliberately block
  release while implementation continues.
- Sites source now declares the logical private R2 binding
  `DOSSIER_DOCUMENTS`, and the Worker environment types that binding as
  `R2Bucket`. No physical resource, public URL, credential, Site version, or
  deployment was created; D1 remains metadata-only.
- The senior non-graph hardening findings are closed in code: report receipts
  use verified account-scoped v2 keys and never persist for anonymous,
  private, protected, workspace, or inspection-only cases; inspection-only
  access is blocked at both PDF buttons, dialog generation, and the download
  function; publication-safety fingerprints now flow from authoritative
  server storage through save/import/load and final-report readiness; rendered
  protection code/policy changes make technical-ID receipts stale.
- Account deletion now fails closed with a private, generic `409` and stable
  `dossier_transfer_required` code whenever the authenticated user still owns
  or has any participant history in a governed dossier. The guard runs before
  destructive identity cleanup and returns no dossier or role identifiers.
- The derived readiness evaluator now emits all ten contract dimensions in
  canonical order from explicit authoritative findings. It keeps lifecycle
  status out of readiness, produces stable source-object deep links, and
  rejects duplicate findings, invalid timestamps, and not-applicable blockers.
- The server readiness collector now derives that projection from bounded D1
  metadata queries over current document versions, requests, proposals,
  contradictions, deadlines, accepted-source bindings, package validation and
  simulation receipts, snapshot revisions, output states, and approvals. It
  never reads binary objects or extracted document bodies for catalogue or
  overview readiness.
- The route-independent Slice 2 security core now freezes the exact role/action
  matrix, rejects removed or cross-dossier participants, permits no ambient
  administrator access, validates private opaque R2 keys and byte observations,
  and models upload commit/cleanup as compare-and-set transitions. TXT/Markdown
  use strict deterministic UTF-8 extraction; PDF/DOCX remain honestly
  `not_extractable` until an approved parser exists.
- Proposal review is now a separate explicit state machine. Only permitted
  professional roles can accept, edit-and-accept, or reject a pending proposal;
  acceptance requires exact source-version/anchor bindings plus the ID of an
  authoritative object created by the server. Source replacement supersedes
  pending candidates and flags accepted dependencies for stale review without
  rewriting accepted history. Provider context quotes document instructions as
  untrusted evidence data.
- The dossier server context now resolves only the registered actor ID stored
  on the authenticated user. Private-object access is one joined active-
  participant check and returns the same no-store 404 for absent, cross-dossier,
  removed, or unauthorized objects; organisation text grants no authority.
- The Matter API now supports participant-scoped, bounded metadata catalogue
  reads plus server-owned creation, exact detail reads, and explicit safe-field
  updates. Creation starts at revision 1. Updates require revision compare-and-
  set, keep status/owner/tenant/approval/hash fields behind separate actions,
  append authoritative-output stale events, and write the chained audit events
  atomically with the mutation.
- The responsive /matters workspace now exposes the seven conceptual
  destinations, first-viewport responsibility/readiness facts, User and
  Developer views, compact phone navigation, bounded pagination, explicit
  loading/empty/permission/stale/unsupported states, and revision-bound
  mutations. Document versions, citations, AI proposals, packages, snapshots,
  requests, outputs, approvals, and activity remain visibly distinct.
- Lifecycle transition is now a distinct owner/contributor/reviewer action,
  separate from generic update. The route evaluates the frozen status matrix
  from server-derived current-output and reviewer-approval facts, rejects
  client authority fields, binds status plus revision to immutable transition
  history, applies output-staleness consequences, and records closure/archive
  facts in one D1 batch.

## Current checkpoint

Update: Slice 1 contract code is accepted. Its focused suite passes 8/8 and
strict TypeScript passes; the focused publication-integrity suite passes
66/66 after the complete client/report hardening integration. Slice 2 schema,
private-vault, authorization, and service-boundary work is in progress. The
account-deletion responsibility stop passes its focused auth suite 9/9 and
strict TypeScript. The deterministic readiness suite passes 4/4.
The independently rerun security-core suite passes 19/19; its focused ESLint
and strict TypeScript gates pass. Schema-trigger review remains open and is not
covered by that pure-core acceptance.
The source-grounded proposal-review suite passes 5/5; focused ESLint and strict
TypeScript pass.
The stored-fact readiness matrix passes 3/3 and focused ESLint passes.
The integrated server/readiness/route suite passes 15/15; focused ESLint is
warning-free and the repository-wide strict TypeScript gate passed at that
checkpoint. The responsive workspace suite independently passes 9/9 and its
focused ESLint and whitespace gates pass. The transition/security/contract set
passes 32/32 with focused ESLint clean.
Senior persistence review has withheld migration sign-off pending closure of
SQL-level hard-delete, upload CAS/cleanup, cross-dossier proposal, immutable
provenance, sealed-package, reviewer-identity, revision/hash projection, and
stable actor-binding findings. Release activation of the route surface remains
gated on a fresh in-memory migration re-audit and the remaining route families.
Audit rows now bind the resulting dossier revision and distinguish one primary
mutation receipt from same-revision output-staleness consequences. A partial
unique receipt plus live-revision trigger makes a stale zero-row CAS roll back
without collapsing the multi-event chain. The reconciled server/route suite
passes 14/14, focused ESLint is clean, and strict TypeScript passes again.

Slice 0 is complete and is not a release checkpoint by itself. Strict
TypeScript passes; the graph engineer's final focused graph suite passes 33/33,
and the expanded report/privacy/domain/Studio/release regression set passes
63/63. Exact Poppler 25.07.0 rendered all 47 PDFs into 702 A4 pages and 702
PNGs. Every page was reviewed across 36 labelled contact sheets, with targeted
full-resolution checks for Bhopal, cyclic repair, long title/detail, and the
200-node limit. The 55-page visual baseline and normal-mode replay both bind
SHA-256 `fbcc9a03d8a26b7076aa2504ac1adf28c28a4196806c9e2849bb6a6aba12f8bb`;
the complete QA manifest is
`50abedd58f7991915abe7a90a58ecdd286e54a0da84e605381b7be4f8f4e0e62`.
Exact mobile report-layout parity is now closed at the source/fixture level.
Dossier persistence sign-off, remaining Slices 5–7, full release gates,
commits, pushes, the single Sites save, and deployment remain open.

## 2026-09-01 - Request, activity, and private document read boundary

- Added participant-scoped request/deadline reads and revision-bound create and
  status mutations. Received requests require a same-Matter satisfying source;
  deadlines are normalized on the server and authority fields are rejected.
- Added immutable, cursor-paged activity reads over bounded audit metadata.
- Added a finalized-document-only catalogue with immutable version metadata and
  server download routes. Authorized downloads resolve D1 scope before private
  R2 access and verify length, media type, custom content hash, and R2 checksum
  before returning safe attachment headers; object keys never leave the server.
- Matter creation now rejects an empty jurisdiction list, and catalogue counts
  exclude provisional zero-version documents so interrupted uploads cannot
  poison visible counts or quotas.
- Root independently reran the combined route/security suite (46/46), focused
  ESLint (clean), and strict TypeScript (pass). The private upload commit and
  cleanup route, schema re-audit, and production resource provisioning remain
  gated and no deployment state changed.

## 2026-09-01 - Private upload route implemented; schema sign-off still held

- Added bounded exact multipart parsing and byte-level PDF/DOCX signature
  checks. TXT/Markdown use the one strict UTF-8 extractor; browser Markdown
  text/plain declarations are normalized only when filename and content agree.
- New uploads stage a non-exportable provisional document plus idempotent
  intent before private R2. Stored size, media metadata, custom SHA-256, and R2
  checksum must match before D1 can atomically bind the immutable version,
  current pointer, extraction job, revision CAS, output staleness, and audit.
- Deterministic text extraction starts only after the source commit, writes a
  checksum-bound private derived object, and makes the immutable result visible
  only with a ready extraction job. Failed publication attempts remove the
  derived object before marking extraction failed.
- Focused upload/catalogue/download tests pass 12/12; focused ESLint and strict
  TypeScript pass. No physical R2 bucket or deployment was created.
- Independent migration re-audit still withholds sign-off. Open findings cover
  explicit pre-expiry abort, deleted later-version idempotency cleanup,
  zero-version external/import rows, accepted proposal targets, and received
  request bindings to provisional documents.

## 2026-09-01 - Proposal and explicit professional review API

- Added private bounded proposal catalogue and exact create/source-rebind/review
  mutations. Every proposal carries same-Matter document-version and anchor
  bindings; rejected or superseded source anchors fail closed.
- Candidate content and model provenance remain immutable. Accept and
  edit-and-accept materialize a separately attributed professional assertion;
  reject creates no authoritative object. Unsupported proposal destinations
  return an honest pilot-boundary error.
- Accepted assertions bind accepted anchors, stale current outputs, advance the
  Matter revision by compare-and-set, and append one primary audit receipt plus
  only allowed output-stale consequences in the same D1 batch.
- Root reran the focused proposal route suite (7/7), focused ESLint (clean), and
  strict TypeScript (pass). A broader concurrent run passed every non-migration
  test; two persistence cases observed an in-progress migration rewrite and
  remain gated on the next frozen migration hash.

## 2026-09-01 - Separated revision receipts and immediate upload abort

- Replaced the provisional audit-row receipt flag with a dedicated immutable
  revision-receipt record. Every revision-changing route now orders its atomic
  D1 batch as guarded revision update, one receipt insert, domain consequences,
  and chained audit rows. Snapshot/output/approval operations can therefore
  append multiple honest events at the unchanged live revision.
- Reordered upload commit so verified measured metadata is recorded on the
  still-pending intent before the immutable version insert; only after version,
  current pointer, revision CAS, and receipt exist does the intent commit and
  finalize a provisional document.
- Added an actor-bound explicit abort transition. A failed upload claims
  `pending -> deleting` with an immutable bounded failure code before TTL,
  deletes private objects only after winning the D1 CAS, completes `deleted`,
  and removes unreferenced intent metadata so exact retries are not poisoned.
- The focused receipt/route/upload/security suite passes 52/52, focused ESLint
  is clean, and strict TypeScript passes. The persistence migration is still an
  active candidate, not signed off; no R2 resource, Site version, push, or
  production deployment was created.

## 2026-09-01 - Evidence route family and executable graph binding

- Added participant-scoped anchor, assertion, and evidence-link route families
  with exact revision compare-and-set, protected-field rejection, finalized
  version and extraction revalidation, accepted typed sources, and current
  published decision-package graph validation.
- The production graph validator rejects node, edge, package, version, digest,
  and dossier substitution. The focused Evidence suite passes 8/8; the
  neighboring persistence/security set passed 32/32 at that checkpoint;
  focused ESLint and strict TypeScript pass.
- `report_section` targets intentionally return a generic unavailable response
  because the current schema has no dossier-scoped report-section entity that
  can be validated without inventing authority.

## 2026-09-01 - Exact Flutter report-layout parity

- Synchronized the governed report manifest, profiles, 2048-UPM Roboto metric
  artifact, and seven layout fixtures into the isolated mobile checkout.
- Flutter now applies the web 1.1 shaping allowances, ink reservations,
  grapheme receipt, compact seven-row connector lanes, endpoint identity, and
  mandatory gutter seam without changing Rust or ReportModel semantics.
- The release-script invocation passes with manifest SHA-256
  `261ff3984e2e73a52f1bf672f94a7e6b0312c1f5d5a228b5e372ec5c885de5f3`,
  metrics `dce864593f4230771a0466e73eec1f7f2cf3a1024bcc83580975d4e1fefe7dda`,
  fixtures `7f71a976872aa7266a7c360529430b9bdc6c2978368917bc0d61c0e3a33e249f`,
  and exact fingerprints for all seven families, including 200 nodes and 187
  cross-page connector pairs. Focused Flutter tests pass 15/15, full Flutter
  tests pass 258/258, and full Flutter analysis reports no issues.

## 2026-09-01 - Persistence candidate retracted after adversarial audit

- Independent migrated-SQLite writes reproduced five high-severity bypasses:
  lifecycle changes not coupled to the complete transition matrix, governed
  outputs without an initial state, receipts without audit coverage, malformed
  readiness/approver snapshot seals, and forged extraction provenance.
- The previous migration hash is not approved. Migration repair now makes the
  receipt the final batch statement after domain/staleness and complete audits,
  and requires every status update to be coupled to its exact transition row.
  All affected routes must pass fresh integration tests against the new frozen
  migration before Slice 2 can close.

## 2026-09-01 - Ordinary User View governance controls

- Wired the existing version, source-anchor, professional-assertion,
  evidence-link, and information-request APIs into the bounded Matter User View.
- A professional can now add an immutable version to an existing logical
  document, create and review an exact manual anchor and assertion, bind
  accepted evidence to an exact current package node or edge, and satisfy an
  open information request with a Matter document link.
- The focused workspace acceptance suite passes 9/9 and focused ESLint reports
  zero warnings. Strict TypeScript remains temporarily masked by the concurrent
  decision-package refactor and will be rerun when that file is stable.

## 2026-09-01 - Slice 5 exact decision-package integration accepted

- Linked Matters only to exact published package ID/version/playable
  fingerprints whose canonical Studio graph passes deterministic validation.
- Bound governed parent lineage, exact base/target graph proposal diffs, and
  current same-Matter node/edge evidence without reimplementing Rust runtime
  semantics.
- Proved referenced v61 simulation sessions from the authenticated actor,
  package binding, completed state, contiguous event sequence, runtime-state
  digest, parameter-binding digest, and canonical receipt digest.
- Corrected document upload finalization to order domain/current-pointer and
  dossier writes, stale outputs, complete audits, the revision receipt, then
  the committed-intent compare-and-set last.
- Root independently replayed the decision-package and Evidence suites: 24/24
  passed. The agent gate also passed the 12/12 real Miniflare private-R2 upload
  matrix, strict TypeScript, and zero-warning scoped ESLint.
- This is a local implementation gate only. No push, Site version, R2
  provisioning, or deployment occurred.

## 2026-09-01 - Frozen-chain release-candidate acceptance

- Froze migrations `0012` through `0015`. A fresh full-chain database has 62
  tables, 251 triggers, zero foreign-key violations, and
  `integrity_check=ok`; the v61 upgrade path and Drizzle no-drift check pass.
- Independent exhaustive mutation/audit review found no Critical or High
  blocker under the documented v61-to-v62 rollout. Snapshot/output policy,
  canonical insert state, provenance, revision receipt, and stale-output
  invariants all fail closed.
- Added owner-only participant enrollment by exact opaque Actor ID with a
  100-row historical capacity boundary, server-resolved profile identity,
  revision CAS, reviewer authorization, exact audit ordering, and output
  staleness. Its focused route/workspace/real-D1 gate passes 17/17.
- The four held runtime suites pass 29/29, including historical non-pilot
  snapshot manifest, generation, output download, and approval rejection before
  R2 access or approval mutation.
- The final verified build and full web suite pass 493/493. Strict TypeScript,
  full ESLint, production audit (zero vulnerabilities), patch hygiene, 47-PDF /
  702-page / 702-PNG QA, the 55-PNG visual baseline, Flutter 258/258, Rust
  format/Clippy/tests, and Android native persistence 12/12 are green.
- Local HTTP rendering and security-header smokes pass for `/` and `/matters`.
  In-app visual browser inspection is explicitly unverified because this chat
  lacks the trusted browser-control service.
- No push, Site version, R2 provisioning, production deployment, or app-store
  distribution occurred at this checkpoint.
