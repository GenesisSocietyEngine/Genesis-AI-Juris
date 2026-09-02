# Codex implementation instructions — v64 Phase B Tenant Foundation

## Role and required outcome

Act as Senior Solution Architect, Security Engineer, Product Owner, and implementation owner for GENESIS: JURIS.

Implement **v64 Phase B — Protected Tenant Foundation** as the next isolated product slice. Build the organisation lifecycle, authorization foundation, tenant-bound persistence, Entra/OIDC boundary, immutable security receipts, and adversarial isolation tests needed before any confidential document pipeline can exist.

The product objective remains:

> Turn an unstructured professional matter into a versioned, explainable, testable, and reusable decision package.

This is not authorization to deploy, activate confidential uploads, provision production confidential resources, distribute a mobile build, merge to `main`, or claim confidential-client readiness.

## 1. Authoritative baseline and scope receipt

Start from a clean branch/worktree at exact `main` commit:

- Phase A merge: `c088200138332cd212b87e266746ea85b53a2f77`
- approved Phase A head: `7d1ca3bb0febf869c521e1ace53ea8c7be1aab06`
- PR: `#41`
- expected production rollback baseline from the latest cumulative handoff: Site 69 / v62 at web commit `6019e47346a2bf719a09dc1d874a2fc807f99598`
- conflicting older repository evidence: Site 63 / marker v61; treat this as an unresolved production-identity discrepancy, not as permission to select either record silently
- information-architecture source identity: `2881e81f08b3459805a293450edd4840f06d6c97`
- confidential document mode: `disabled` or validation-only; synthetic/de-identified material only

Before editing:

1. Verify `git rev-parse HEAD` equals the Phase A merge SHA.
2. Verify the worktree is clean and record all configured remotes.
3. Read `CodexToInstructions.md`, the three v64 JSON Schemas, and every document under `docs/architecture/v64/` in full.
4. Inspect the existing D1 migrations, Worker/API routes, session/auth implementation, dossier roles, revision-CAS, audit receipts, Rust bridge, Flutter persistence, and all release workflows.
5. Produce a short discovery receipt mapping existing components to the frozen Phase A contracts. Do not invent parallel models when a compatible invariant already exists.
6. Attempt to confirm the actual production marker and deployment identity read-only through an authorized Sites/hosting receipt. If that channel is unavailable, record the discrepancy and continue only with isolated branch implementation and tests under the amendment below. Do not infer production identity from source history and do not modify production.

Phase A schemas and decisions are frozen. Changes require a new ADR, explicit compatibility analysis, security review, and product-owner approval. Never weaken them merely to simplify implementation.

## 1A. Mandatory amendment — resolve the B0 production-identity stop safely

This amendment supersedes only the earlier instruction to stop all implementation when the production identity cannot be read. It does not weaken any merge, release, deployment, migration, or confidential-activation gate.

### Current verified task state

- PR `#43` instruction-only head: `6feb611b70a79f41bc87e25a6d469490cf8ba71c`.
- Codex B0 checkpoint created locally: commit `f71848f527fe7bebb3f7339a32673b37b443e13a`, tree `f3c1736ab40cc311048e2e74c0af2493ae09f627`.
- The B0 checkpoint contains only the discovery receipt and `CURRENT_PROGRESS.md` update; it is not yet present on PR `#43`.
- Eight baseline push/PR checks across Rust, Flutter, and Android were reported green by the previous task; the two iOS simulator checks were still running at that task's stop point and had not failed.
- Full Phase B migrations, authorization, isolation, parity, accessibility, exact-head review, and security gates have not yet run and must not be represented as green.
- No Phase C or later work, deployment, production mutation, secret change, confidential-upload enablement, or app-store activity occurred. The warning and synthetic/de-identified restriction remain mandatory.

### Source-of-truth hierarchy

Keep these identities separate:

1. **Development source baseline:** exact repository `main` commit `c088200138332cd212b87e266746ea85b53a2f77`. This is authoritative for Phase B branch construction.
2. **Production deployment identity:** unresolved between Site 63/v61 and Site 69/v62 until an authorized read-only hosting receipt proves the live deployment, saved version, production marker, and exact source commit.
3. **Rollback candidate:** no version may be called the rollback target until the production identity is reconciled and its deployment health receipt is current.

Do not overwrite repository history to make the records agree. Create an immutable reconciliation receipt containing both claims, their sources/timestamps, the authoritative hosting evidence when obtained, the decision, actor, and receipt digest.

### Development may continue under isolation

The unresolved production identity is **not a blocker for B1–B9 implementation on the dedicated, non-production PR branch**, because this task is forbidden to deploy, migrate production, provision production resources, change secrets, or enable confidential mode.

Continue only if all of the following remain true:

- branch base is exactly `c088200138332cd212b87e266746ea85b53a2f77`;
- no production credential or binding is used;
- D1/R2/KMS/Entra interactions use deterministic local fakes or explicitly non-production isolated fixtures;
- migrations are additive and are tested against both repository-represented candidate upgrade shapes: v61/Site 63 and v62/Site 69;
- legacy fingerprints and `legacy_personal_pilot` behavior remain byte/semantically unchanged;
- confidential upload stays disabled server-side and visibly warned on web/Flutter;
- every external dependency without an authoritative receipt is labelled `unverified_external_dependency`.

Production reconciliation remains a hard blocker before marking the PR ready, merging it, creating a Site version, deploying, provisioning a production tenant, changing production secrets, or enabling confidential material.

### Recover B0 without duplication

1. If local commit `f71848f527fe7bebb3f7339a32673b37b443e13a` is reachable and its parent/tree/content match the recorded receipt, cherry-pick or fast-forward its exact content onto the current PR branch.
2. If it is not reachable, reproduce only the two B0 files from the task result, verify their semantic diff against the recorded summary, and create a new attributable commit. Do not fabricate the old SHA.
3. Correct stale links in the B0 receipt so they point to the actual PR head containing the files, not the instruction-only head.
4. Record which recovery route was used, exact parent/head/tree SHAs, and `git diff --check`.
5. Then proceed to B1; do not repeat the completed discovery audit unless source changes invalidate it.

### Tool and evidence dependencies

- A missing GitHub remote credential in the Codex terminal must not trigger `gh pr create`, force-push, credential discovery, or scope expansion. The existing PR `#43` is the sole review vehicle; return committed work for the connected workflow to publish.
- Missing local Flutter/Dart or Apple toolchains do not permit skipping their gates. Implement and run available tests locally, then require hosted exact-head Flutter/Android/iOS receipts before Phase B acceptance.
- Hosted Codex code review and security review are mandatory on the final exact head.
- Entra, D1/R2 EU isolation, KMS/key rotation, email delivery, compliance, DPA/subprocessor, penetration-test, and restore evidence may be mocked only for implementation tests. They remain external blockers for confidential beta and must be listed precisely.
- Do not ask for production secrets in comments, commits, CI output, or chat.

## 2. Non-negotiable boundaries

- Preserve all existing v62/v63 case, document, evidence, Decision map, task, report, audit, import/export, revision-CAS, PDF, and 18-route semantics.
- Preserve exact legacy fingerprints. Never silently reinterpret, migrate, tenant-assign, or re-key an existing user, matter, document, anchor, report, or receipt.
- Existing data remains explicit `legacy_personal_pilot` and synthetic/de-identified only.
- Rust remains authoritative for canonical case validation/runtime semantics.
- Server authorization is authoritative for organisations, dossiers, documents, exports, policies, and security actions. Browser, Flutter, OIDC claims, and Rust are not independent authorization engines.
- AI remains proposal-only. No AI access to quarantined, unscanned, unauthorized, stale, held, or unreviewed document content.
- Packages and policy manifests are allowlisted, immutable, versioned data. No arbitrary executable package/formula code.
- Deny by default for missing, unknown, stale, suspended, cross-tenant, malformed, or unsupported context.
- Unknown and unauthorized tenant/dossier/object identifiers must have indistinguishable private responses.
- Never log document text, filenames, client identity, raw prompts, credentials, tokens, private object locators, or storage keys.
- Keep the existing web and Flutter warning visible and enforced server-side:

  > Confidential document mode is not active. Do not upload privileged, client-identifying, or live production documents. Use only synthetic or properly de-identified material.

- Do not create an app-store distribution.
- Do not create a Site checkpoint or deployment.
- Do not enable `confidential_document_mode = approved`.
- Do not use real client documents, identities, tenants, credentials, malware, or production secrets in tests.

## 3. Execution model and stop conditions

Work in small reviewable commits in this order:

1. B0 discovery and contract-to-code matrix.
2. B1 additive organisation/control-plane migrations.
3. B2 tenant-bound data-plane constraints and compatibility adapter.
4. B3 deny-by-default policy decision point and authorization matrix.
5. B4 organisation lifecycle, invitations, roles, and compliance-export authority.
6. B5 Entra/OIDC provider boundary and session revocation.
7. B6 tenant provisioning/verification abstractions, KMS envelope contract, and key rotation state machine.
8. B7 immutable security/audit receipts and cross-tenant adversarial tests.
9. B8 web/Flutter parity for organisation context and safe non-document flows.
10. B9 exact-head verification and Phase B evidence pack.

Do not begin Phase C document ingestion during this task. Phase C may start only after all Phase B gates are green, a clean Codex/security review is complete, and a human explicitly approves the next slice.

If a required provider, secret, EU infrastructure receipt, compliance approval, platform capability, or native toolchain is unavailable, record it precisely. Continue branch-safe implementation with deterministic fakes where the amendment permits it, but stop before any gate or action that needs the missing evidence. Never represent a test double as production evidence and never weaken an acceptance gate.

## 4. B1 — organisation and control-plane migrations

Implement deterministic additive migrations for the frozen `organization-contract.v1` model:

- `organizations`
- `organization_identity_connections`
- `organization_memberships`
- `organization_invitations`
- `organization_policy_versions`
- `tenant_resource_manifests`
- delegated grants and current-grant pointers where required by the frozen contract
- compliance-export authority and approval records
- immutable security/audit receipt envelopes

Requirements:

- opaque stable IDs; never derive authority from display names, slugs, or email domains;
- explicit organisation lifecycle: `provisioning → active → suspended → closing → closed`, with only allowlisted transitions;
- confidential capability lifecycle remains separately versioned and server-owned;
- active organisation state is required for organisation- and dossier-scoped operations;
- every mutable security record has a monotonic authorization/configuration version;
- current delegated/compliance grants resolve through an immutable grant revision plus a server-owned current pointer;
- invitations store token digests, not tokens, and encrypted delivery addresses only for a bounded period;
- identity connection records store metadata, never client secrets or signing keys;
- every migration is rerunnable or deterministically rejected, transaction-safe, and has fresh-schema plus upgrade tests;
- schema downgrade/rollback instructions must preserve evidence and never silently discard tenant bindings.

Generate and freeze:

- fresh-schema manifest;
- v62/v63-to-Phase-B migration receipt;
- table/index/trigger/foreign-key counts;
- `foreign_key_check` and integrity results;
- deterministic schema fingerprint.

## 5. B2 — tenant-isolated data plane

Add `organization_id` and tenant-bound composite relationships to every confidential-capable aggregate, including dossiers, participants, documents, versions, upload intents, processing jobs, anchors, assertions, requests, Decision packages, snapshots, reports, audit events, exports, holds, and receipts.

Rules:

- All tenant-owned primary/unique identities include or are verified against exact `organization_id`.
- All parent-child foreign keys include the tenant dimension.
- Repository/query APIs require trusted server-resolved tenant context and must not accept an authoritative tenant ID from request JSON.
- Object locators are random, private, tenant-bound, environment-bound, and never authorization credentials.
- Cache keys, idempotency keys, queue messages, signed grants, search indexes, logs, and background jobs include verified tenant scope.
- Organisation membership does not create dossier participation.
- `org_owner` and `org_admin` have no ambient dossier-content access.
- Dossier owner/contributor/reviewer/viewer permissions remain separate and least-privilege.
- Platform administrators have no routine content access; do not implement break-glass content access in this slice.
- Organisation switching invalidates cached dossier/document state and rotates the server session context.
- Legacy personal matters remain untouched. Any later organisation transfer must be explicit export/import with new IDs and immutable transfer receipts.

Add repository-level and database-level constraints. Application checks alone are insufficient.

## 6. B3 — deny-by-default authorization

Implement one server-side policy decision point with typed actions and resource scopes.

### Request classes

- **pre-membership identity:** OIDC callback, invitation inspection/acceptance; governed by exact state/token/identity rules;
- **organisation scoped:** organisation profile, membership administration, policy inspection; requires active membership and allowed organisation role;
- **dossier scoped:** case/document/evidence/task/report/audit actions; additionally requires active dossier participation and allowed case role;
- **compliance export:** requires separately assigned current compliance-export authority plus exact owner approval for every included dossier;
- **security operations:** suspension, key rotation, policy activation, restore, hold release; require explicit separation of duties.

Never require dossier participation for legitimate pre-membership or organisation-level flows. Never allow organisation administration to bypass dossier authorization.

For every decision, bind and verify:

- authenticated actor/session;
- server-resolved organisation;
- organisation lifecycle and confidential-mode state;
- current membership and authorization version;
- exact action and resource scope;
- current dossier participant and role when dossier-scoped;
- current delegated/compliance grant revision where applicable;
- resource revision/receipt freshness;
- tenant resource-manifest identity and activation state where infrastructure is involved.

Return a privacy-safe decision code and immutable receipt. Do not record sensitive request bodies.

Create a machine-readable role/action matrix covering organisation roles, case roles, compliance authority, and lifecycle states. Generate exhaustive positive and negative tests from the matrix so documentation and enforcement cannot drift.

## 7. B4 — organisation lifecycle, invitations, roles, compliance export

Implement safe API/domain behavior for:

- create/provision/activate/suspend/close organisation state transitions;
- invite, inspect, accept, expire, revoke, and replay-reject invitations;
- membership activate/suspend/remove;
- dossier enrolment and role change by dossier owner;
- separate assignment/revocation of compliance-export authority;
- owner-approval collection for a future tenant-wide export;
- organisation switching with complete cache/session isolation.

Invitation requirements:

- high-entropy, single-use, hashed-at-rest, short-lived, origin-bound tokens;
- acceptance bound to the exact authenticated identity and intended invitation;
- no authority before acceptance;
- replay, expiry, revocation, email change, mixed tenant, swapped role, and concurrent acceptance fail closed;
- authorization version increments and sessions/grants invalidate immediately on membership or role change;
- audit receipts identify actor/action/result without exposing delivery address or token.

Implement roles `owner | contributor | reviewer | viewer` inside dossiers and preserve separate organisation roles. Add a dedicated `compliance_export_authority`; do not overload `org_admin`, `reviewer`, or platform administration.

No actual confidential export package is built in Phase B. Only freeze and test the authority/approval state needed by the later governance slice.

## 8. B5 — Microsoft Entra/OIDC foundation

Implement the production-shaped boundary with fake/local identity-provider fixtures. Do not register or change a production Entra application without separate approval.

Use Authorization Code Flow with PKCE and system-browser return. Validate:

- `state`, nonce, PKCE verifier/challenge, exact redirect URI;
- HTTPS discovery and JWKS metadata;
- signature, issuer, audience/client ID, verified tenant ID, nonce, `exp`, and `nbf`;
- stable actor identity from `iss + tid + oid/sub`, never email alone;
- exact enabled `organization_identity_connection` mapping;
- key rotation, bounded clock skew, replay rejection, admin-consent status, and session rotation.

Security rules:

- no token in URL history, localStorage, logs, analytics, audit detail, screenshots, or crash reporting;
- HttpOnly, Secure, SameSite server sessions with bounded duration;
- session bound to organisation and authorization version;
- suspension, removal, role/policy change, organisation switch, or identity-connection disablement revokes access immediately;
- preserve the originating Studio tab and pending save across browser auth return; do not open a duplicate working session;
- safe stale-JS-chunk recovery must not lose pending state or weaken auth;
- request no Microsoft Graph permission unless separately justified and approved.

Required negative fixtures include wrong issuer/audience/tenant/nonce/redirect, stale or replayed code, mixed issuer keys, unknown tenant, disabled connection, revoked session, callback CSRF, invitation substitution, and tab-correlation loss.

## 9. B6 — tenant resource manifests, encryption/KMS, and rotation

Implement provider-neutral provisioning and verification interfaces around the frozen tenant-resource manifest. Use local/test manifests unless approved provider credentials and EU resources already exist.

Each manifest binds:

- organisation and environment;
- deployment/build/schema identities;
- dedicated D1 and private R2 quarantine/clean/extracted/export/backup namespaces;
- EU jurisdiction and endpoint evidence;
- encryption key alias/version, not key material;
- activation state, verification time, verifier identity, and expiry;
- receipt fingerprints.

Enforce one dedicated confidential data plane per pilot organisation for v64. Do not introduce pooled confidential storage.

Implement an envelope-encryption/KMS contract:

- provider-managed root key/HSM or KMS boundary;
- per-tenant key alias and version;
- authenticated encryption with tenant/object/version associated data;
- no key material in D1, source, logs, manifests, client storage, or CI artifacts;
- monotonic rotation state machine with dual-read/single-write transition only where explicitly designed;
- idempotent resumable rewrap, verification receipts, rollback safety, and revoked-key behavior;
- key deletion requires retention/legal-hold/export checks and separation of duties.

Do not claim EU residency, encryption readiness, backup readiness, or production provisioning from mocks. Record `unverified_external_dependency` for evidence that cannot be obtained in this task.

## 10. B7 — immutable security/audit receipts and adversarial isolation

Security receipts must be append-only and bind:

- schema/version and event type;
- trusted actor/session and authentication method;
- organisation and optional dossier/resource scope;
- exact action and policy/authorization version;
- request/idempotency correlation without content;
- prior/current receipt digest where chaining applies;
- outcome and bounded privacy-safe reason;
- server timestamp, deployment SHA, and environment;
- reviewer/approval identity where required.

Rejected security-relevant operations are also audited without leaking resource existence or sensitive inputs.

Build property-based, mutation, and concurrency tests that substitute or race:

- organisation, user, membership, invitation, dossier, participant, document, version, anchor, report, export, hold, grant, object locator, queue job, policy, receipt, and idempotency IDs;
- active/suspended/removed/expired/revoked/stale states;
- same opaque ID under different tenants;
- stale authorization versions and current-grant pointers;
- organisation switches with cached UI/mobile state;
- concurrent role change and write/download;
- cross-tenant pagination/search timing and error shapes.

Acceptance is zero cross-tenant read, write, existence disclosure, cache reuse, download, signed grant, background processing, log correlation, notification, or audit contamination.

## 11. B8 — web and Flutter parity

Implement equivalent safe Phase B capability in web and Flutter:

- visible current organisation and organisation switcher;
- organisation lifecycle/confidential-mode status;
- invitation acceptance and membership state;
- dossier roles and allowed role-management actions;
- Entra/OIDC system-browser sign-in and exact originating-tab/deep-link return;
- session revocation and organisation-switch cache clearing;
- compliance-export authority/approval visibility without export execution;
- privacy-safe security/audit timeline;
- the unchanged confidential upload warning and disabled server behavior.

No confidential document body may enter ordinary mobile cache. Clear tenant state on sign-out, membership removal, organisation switch, policy change, or session revocation. Redact app-switcher previews and prohibit sensitive notifications, clipboard telemetry, analytics, and crash fields.

Web and Flutter must consume the same versioned role/action/policy manifests and produce identical canonical semantics/fingerprints. Responsive mobile web is not Flutter parity.

## 12. Information architecture continuity and next IA slice

Preserve the existing v63 shell during Phase B:

### Global

- My cases
- Templates
- Documents
- Tasks & reviews
- Reports

### Inside a case

- Overview
- Documents
- Evidence
- Decision map
- Tasks
- Reports
- Audit

Phase B may add only organisation context, membership/security states, and safe empty states needed for its flows. Do not redesign the dossier workspace during the security slice.

Prepare, but do not implement beyond compatible empty-state/parity fixes, the later IA completion acceptance:

- Guided Studio Step 2 is explicitly **Documents & evidence**;
- every global and case library explains ownership and scope;
- empty states explain where documents live and how they become case evidence;
- the visible lineage is `document → immutable version → evidence anchor → decision assertion/node → report citation`;
- labels and version branding match across web and Flutter;
- a document is never detached from its organisation and explicit case linkage.

IA work may proceed in a parallel future branch, but confidential activation remains blocked until the backend, governance, and mobile evidence is complete.

## 13. Locked roadmap after Phase B

These are future slices, not authorized implementation in the current task.

### Phase C — document ingestion

Entry gate: Phase B exact-head gates, adversarial isolation, and security review are green.

`Upload → Quarantine → Malware scan → Extraction/OCR → Citation anchors → Reviewed evidence`

Required later capabilities:

- private tenant EU quarantine and clean namespaces;
- strict PDF/DOCX validation, magic/structure/archive limits;
- isolated, pinned, network-denied malware scanning with immutable receipts;
- EICAR, polyglot, ZIP-bomb, encrypted/malformed, timeout/outage, digest-replay, and cross-tenant fixtures;
- extraction only after clean scan;
- sandboxed PDF/DOCX extraction;
- separately requested/versioned OCR with EN/RU packs, confidence, and review state;
- page/block/range PDF anchors and heading/paragraph/table DOCX anchors;
- immutable originals, derived lineage, idempotent retry/dead-letter behavior;
- no AI access before scan, authorization, extraction provenance, and review policy permit it;
- redaction as a derived immutable version, never destructive overwrite.

### Phase D — governance and operational evidence

Entry gate: Phase C is green and no ingestion bypass exists.

- versioned retention, dry-run deletion, purge, export, and legal hold;
- separation of duties for hold release and tenant-wide export;
- encrypted EU backup and proven isolated restore against defined RPO/RTO;
- reviewer approvals and immutable approval receipts;
- EU residency receipts for D1, R2, Workers, queues, cron, scanning, extraction, OCR, KMS, backup, logs, analytics, support, and AI;
- DPA, TOMs, DPIA decision, subprocessor register, transfer assessment, privacy/DSAR procedures;
- penetration test and retest of every critical/high and tenant-isolation finding;
- incident-response, breach, restore, deletion, export, and key-rotation runbooks;
- documented mobile offline/cache policy;
- complete web, Rust, Flutter, Android, and iOS gates.

### Phase E — enterprise-pilot IA completion

May be developed in parallel after Phase B contracts stabilize, but cannot activate confidential mode:

- global Documents, Tasks & reviews, Reports;
- Guided Studio Step 2 = Documents & evidence;
- case tabs Overview / Documents / Evidence / Decision map / Tasks / Reports / Audit;
- consistent labels/version branding and instructive empty states;
- traceable document-to-case-to-anchor-to-report lineage;
- full web/Flutter parity, accessibility, EN/RU, keyboard, tablet/mobile, high contrast, reduced motion.

### Phase F — confidential validation and pilot activation

Only after named product, security, privacy/legal, and operations approval:

1. activate one synthetic internal validation tenant;
2. execute full production-shaped observability, restore, residency, security, and mobile gates;
3. obtain a fresh explicit approval for one exact confidential pilot tenant;
4. create one exact-SHA release and deployment;
5. verify production before changing that tenant from `validation` to `approved`;
6. never create an app-store release without separate authorization.

## 14. Mandatory Phase B gates

All must pass on the exact candidate head:

### Contracts and migrations

- all Phase A JSON Schemas compile under Draft 2020-12 and remain fail-closed;
- fresh-schema and supported-upgrade migrations pass with deterministic fingerprints;
- `foreign_key_check`, integrity check, tenant composite constraints, rollback/resume tests pass;
- malformed, future, unknown-field, stale-version, and unsupported imports are rejected atomically before persistence;
- import/export and revision protection remain green.

### Authorization and security

- complete role × action × scope × lifecycle matrix passes;
- negative cross-tenant generator passes for every resource type;
- no ambient organisation-admin dossier access;
- compliance export requires separate current authority and every included dossier owner’s approval;
- session/authorization invalidation is immediate and race-tested;
- OIDC negative/replay/key-rotation/tab-return tests pass;
- secrets/tokens/client data are absent from logs, receipts, errors, analytics, URLs, and client storage;
- dependency and secret scans report no unresolved critical/high issue;
- Codex review and dedicated security review report no unresolved critical/high/P1 finding.

### Existing product regression

- all web tests;
- strict TypeScript and full lint;
- verified production build and chunk budget;
- production dependency audit with zero unresolved vulnerability;
- auth return/save, stale-JS-chunk recovery, anonymous PDF, report manifest, PDF structural/visual QA;
- all 18 cross-runtime routes;
- legacy case/report/document fingerprints unchanged.

### Native and parity

- Rust `fmt`, Clippy with warnings denied, locked workspace tests;
- Flutter format, analyze, unit/widget/integration tests;
- Android build, persistence, deep-link/auth, secure-storage/cache tests;
- iOS build, exact FFI export audit per Mach-O slice, simulator lifecycle, keychain/cache tests;
- web/Flutter role/action/organisation/security manifest fingerprints identical;
- 360×800, 412×915, tablet, 200% text, keyboard-only, screen reader, high contrast, reduced motion, and 48 px targets;
- EN/RU internal strings and error/privacy states.

### Evidence pack

- authoritative read-only production reconciliation receipt identifying the actual live Site version, marker, deployment, source SHA, and health evidence; if unavailable, PR remains draft and unmergeable by policy;
- exact base/head/tree SHAs and clean diff;
- ordered commits and changed-file inventory;
- migration/schema fingerprints;
- test commands, totals, workflow/run IDs, and conclusions;
- threat-model delta and residual-risk register;
- explicit list of mocked/unverified external dependencies;
- proof that production, confidential mode, tenant infrastructure, Site versions, and app-store state were not changed.

## 15. Completion and handoff

When Phase B is complete:

1. Re-read this instruction and Phase A contracts; perform a requirement-by-requirement gap audit.
2. Re-run all gates on one exact head. Do not combine evidence from superseded commits.
3. Request Codex code review and security review of that exact head.
4. Correct all actionable findings and rerun affected gates.
5. Update `CURRENT_PROGRESS.md` with factual receipts, blockers, and unchanged production/confidential state.
6. Improve the Phase C–F plan using what was learned, but do not begin those phases.
7. Return the complete diff, exact SHAs, tests, review status, residual risks, and required approvals.

The task may push implementation commits to its dedicated branch and maintain one draft PR for review. It must not merge the PR, deploy a Site, provision production confidential infrastructure, change production secrets, activate confidential uploads, or distribute an app-store build.

Phase B is accepted only when the production identity is authoritatively reconciled, organisation isolation and deny-by-default authorization are proven at both database and application boundaries, web/mobile parity is factual, every exact-head gate is green, and no unresolved tenant-isolation or authentication finding remains. Otherwise keep PR `#43` draft, stop at the last green checkpoint, and report the blocker without weakening a gate.
