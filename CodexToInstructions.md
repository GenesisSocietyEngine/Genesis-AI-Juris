# Codex instructions — complete v64 Phase B and release one public Site version

## Mission

Act as the Senior Solution Architect, Security Engineer, Product Owner, and release owner for GENESIS: JURIS.

Complete **v64 Phase B — Protected Tenant Foundation** from draft PR #43, reconcile the production/source baseline, wire the tenant foundation into real server routes and durable adapters, finish equivalent web and Flutter organisation experiences, close every mandatory review and release gate, merge the verified work, and publish exactly one new public Site version.

The intended user-facing outcome is a production v64 release in which organisation context, invitations, roles, approvals, policy and security state are real and tenant-isolated. This release must **not** activate confidential document ingestion. Phase C remains out of scope.

The product objective remains:

> Turn an unstructured professional matter into a versioned, explainable, testable, and reusable decision package.

## 1. Exact current state to verify before editing

Treat every value below as an observation to verify, not as permission to manufacture agreement.

| Item | Expected observation |
|---|---|
| Repository | `GenesisSocietyEngine/Genesis-AI-Juris` |
| Phase B PR | `#43`, branch `codex/v64-phase-b-tenant-foundation`, still draft |
| Current remote PR head | `ff9c6f4250fd999249e9a893892c2115a0103734` |
| Current remote PR tree | `8d7bf7201190e57724b3f8486707d1b5e8143573` |
| Phase A / current PR base | `c088200138332cd212b87e266746ea85b53a2f77` |
| Instruction-only predecessor | `6feb611b70a79f41bc87e25a6d469490cf8ba71c` |
| Production Site project | `appgprj_6a88a26d2f808191aa076b9fcd8dbce6` |
| Current saved version | Site 69, opaque version ID `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_7a9411bf30348191bb0cb483d4807ffa` |
| Saved version source | `6019e47346a2bf719a09dc1d874a2fc807f99598` |
| Saved archive | SHA-256 `3dcfe92950c2e5e0f99d7f638f0f66633397c5c25e62ac9e065cc8e27255d555`; 320 files; 25,825,280 bytes |
| Live URL | `https://studio.falcon-merlin.com` |
| Custom domain | active; SSL active |
| Latest runtime observation | Worker script version `0b8eda40-a900-4523-bfb3-992f9f74e7d1`; structured event reports `deploymentVersion=69` and `webCommit=6019e47346a2bf719a09dc1d874a2fc807f99598` |
| Current exact-head hosted CI | Rust, Flutter and Android green; iOS was still running when this amendment was prepared |
| Current local/source gate | 144 tests passed, 0 failed, 1 deliberate blocked migration-fixture test; strict TypeScript, lint, build, chunk guard and full dependency audit passed |

Before any edit:

1. Fetch PR #43 and verify its remote head and tree. Do not start from an inaccessible task-local commit.
2. Verify that the current head is a clean descendant of the Phase A base and that its scope is still Phase B.
3. Read in full:
   - this file;
   - `docs/development/CURRENT_PROGRESS.md`;
   - every file under `docs/architecture/v64/`;
   - all three frozen v64 schemas under `contracts/`;
   - `apps/juris-web/db/schema.ts`, the complete Drizzle chain and journal;
   - the tenant foundation, authorization, tests and Flutter organisation-context implementation;
   - all release workflows and `.openai/hosting.json`.
4. Record the exact starting head/tree, worktree status, remotes, toolchain versions and current Sites observations in a new append-only Phase B completion receipt.
5. If PR #43 has advanced, accept the newer head only after proving it is a clean descendant with no Phase C, production-secret, release-gate or unrelated scope change. Otherwise stop and report the divergence.

Any change made after `ff9c6f4…` invalidates its CI receipts. All mandatory gates must run again on the final exact head.

## 2. Diagnosis and release strategy

The four reported symptoms have different root causes and must be fixed in dependency order.

| Symptom | Root cause | Required correction |
|---|---|---|
| `0016` cannot be registered | GitHub `main`/PR base stops at `0010`, while deployed v62 contains a later dossier/document model and migrations `0011–0015`; Site 69’s source SHA is not present in the GitHub repository | Recover and verify the exact Site 69 source/history, land the missing immutable baseline, then rebase Phase B and register a newly generated/reviewed additive `0016` |
| Live deployment is not immutably tied to Site 69 / `6019e473…` | Saved-version metadata and runtime self-identification correlate, but the historical production deployment ID/status receipt is absent | Obtain a provider-owned deployment receipt that returns `succeeded`, the exact Site 69 version ID, URL and deployment ID; hash and preserve the combined receipt |
| B3–B7 are reference-only | Domain services are exercised mainly by in-memory tests and are not composed into real Worker routes, D1 repositories, OIDC/session, KMS/manifest and receipt adapters | Add one production composition root, durable adapters and guarded routes; use server-resolved actor/tenant/time and atomic versioned writes |
| B8 is incomplete | Organisation state is not a first-class web/Flutter product surface, and caches/localisation/accessibility are not tied to tenant authority | Implement equivalent web and Flutter flows, shared policy-manifest semantics, tenant-keyed caches, full invalidation and EN/RU/WCAG evidence |

Do not try to solve these by renumbering migrations, copying an unverified candidate, trusting a visible version label, adding client-only UI, or calling mocks “production adapters.”

The safe order is:

1. reconcile production and source provenance;
2. recover the v62 baseline and migration chain;
3. rebase Phase B onto that baseline and register the real additive migration;
4. wire B3–B7 into production-shaped server paths;
5. finish B8 on web and Flutter;
6. close review findings and run all exact-head gates;
7. obtain explicit exact-SHA merge and public deployment approvals;
8. merge, rebuild from final `main`, save Site 70, deploy once, and verify production.

## 3. Non-negotiable guardrails

- Keep Phase C upload/quarantine/malware/extraction/OCR/citation execution out of this iteration.
- Keep confidential document mode server-side disabled. Do not create a route that accepts live confidential bytes.
- Preserve this warning in English and Russian on web and Flutter:

  > Confidential document mode is not active. Do not upload privileged, client-identifying, or live production documents. Use only synthetic or properly de-identified material.

- Preserve every v62 dossier/document/evidence/Decision map/task/report/audit/import/export/revision-CAS/PDF/18-route invariant.
- Preserve exact legacy fingerprints and `legacy_personal_pilot` semantics. Never silently assign existing rows to an organisation, reinterpret them as tenant data, or rewrite IDs.
- Rust remains authoritative for canonical case validation and runtime semantics. Do not create a second rules engine.
- Server authorization is authoritative for tenant access. Browser, Flutter and OIDC claims are inputs, never authority.
- AI remains proposal-only and receives no tenant content unless authorization and the later Phase C scan state permit it. In v64, confidential content access stays impossible.
- Packages, policy manifests and formulas remain allowlisted, immutable, versioned data; never execute arbitrary tenant JavaScript.
- Deny by default for missing, malformed, stale, suspended, cross-tenant, unsupported or unverified state.
- Unknown and unauthorized resource identifiers must have indistinguishable private responses.
- Do not log tokens, secrets, private object locators, client identities, document text, filenames, raw prompts or confidential metadata.
- Do not commit credentials or obtain them by searching user files, logs, shell history or environment dumps.
- Do not weaken, remove, rename or skip a release gate to obtain a green result.
- Do not create an app-store distribution. Merging verified mobile source is allowed only at the release gate; store publication requires separate authorization.
- Do not enable production Entra, KMS, R2 or confidential-tenant provisioning without explicit provider/configuration approval. A missing provider configuration must fail closed and display “Not configured.”
- No intermediate public v64 deployment. The only permitted publication is the final exact-SHA release after all gates pass.

## 4. R0 — close the existing review loop before expanding the diff

PR #43 currently has ten open review threads from the pre-fix head: eight P1 and two P2. The code at `ff9c6f4…` contains intended fixes, but the threads are not evidence of closure until the final exact head is independently reviewed.

Required actions:

1. Map each thread to the exact fixing code and discriminating regression test:
   - grant ↔ membership authorization version;
   - export approval ↔ immutable approval receipt and dossier manifest;
   - resource-manifest receipt coverage/digest recomputation;
   - export-request expiry at append and transition;
   - maximum seven-day tenant-session lifetime and stale issuance;
   - independent approval-bound policy activation;
   - one-time atomic export consumption;
   - key-rotation completion evidence;
   - persistable legal-hold actor/target receipt semantics;
   - database-current-time invitation acceptance.
2. Keep every thread open while the baseline rebase and integration work changes the source.
3. After the final exact-head code and security reviews are green, reply to each thread with the final commit, test name and evidence, then resolve it.
4. Zero unresolved P0, P1 or P2 findings is a release gate. A transient review-service error requires retry, not waiver.

## 5. R1 — create an authoritative production-baseline receipt

### 5.1 Required provider-owned evidence

Use the Sites connector directly. Do not substitute repository prose, a screenshot, HTML text, a self-reported runtime constant or a prior chat summary.

Capture and canonicalise:

- `get_site` for project `appgprj_6a88a26d2f808191aa076b9fcd8dbce6`;
- `get_site_version` for the exact opaque Site 69 version ID;
- custom-domain status for `studio.falcon-merlin.com`;
- current structured Worker logs showing the provider script-version ID, `deploymentVersion=69`, `webCommit=6019e473…`, outcome and timestamp;
- the historical production deployment ID from the original deploy result, Sites audit/history, retained release receipt or provider support export;
- `get_deployment_status` for that exact deployment ID, returning:
  - `status=succeeded`;
  - the exact Site 69 version ID;
  - the exact project ID;
  - the production URL;
  - provider deployment ID when present;
  - immutable update timestamp.

Do not guess a deployment ID. If the current API cannot list historical deployments, search only authorized release receipts/audit history or obtain a provider export. Do not redeploy Site 69 merely to manufacture a historical receipt.

### 5.2 Canonical receipt

Create `docs/architecture/v64/PRODUCTION-BASELINE-RECEIPT.json` with a versioned schema and canonical JSON digest. Include:

- project, version and deployment IDs;
- Site version number 69;
- source SHA and saved archive digest/count/size;
- deployment terminal status and timestamps;
- production and custom-domain URLs;
- custom-domain/SSL state;
- runtime script-version ID and structured marker evidence;
- collector identity class and collection timestamp;
- explicit `verified`, `correlated_only` and `unverified` fields;
- SHA-256 over the canonical receipt excluding its own digest field.

Add a validator test that rejects swapped project/version/deployment IDs, a different SHA, missing terminal status, stale domain evidence and a recomputed-but-incomplete receipt.

**Stop condition:** do not mark R1 green, choose a rollback target, mark PR ready, merge or deploy while the exact provider deployment receipt is missing. Correlation is not immutable proof.

## 6. R2 — recover v62 source and the authoritative `0011–0015` chain

### 6.1 Recover from the Sites source repository, not from a candidate folder

1. Obtain a short-lived, repository-scoped Sites source credential for the existing Site. Keep it out of Git config, remotes, files and output; use a per-command authorization header.
2. Clone/fetch the Sites source repository into a separate clean checkout.
3. Resolve exact commit `6019e47346a2bf719a09dc1d874a2fc807f99598`.
4. Verify that its packaged source corresponds to Site 69’s recorded archive:
   - archive hash `3dcfe929…d555`;
   - 320 files;
   - 25,825,280 bytes;
   - matching hosting manifest/project ID;
   - matching migration and build manifests.
5. Inventory and hash exact files for:
   - migrations `0011–0015`;
   - every matching Drizzle snapshot and `_journal.json` entry;
   - `db/schema.ts`;
   - dossier/document repositories, routes, tests and release manifests.
6. Compare the Sites commit ancestry with GitHub base `c088200…`.

### 6.2 Git-history decision

- If `6019e473…` is a genuine descendant of `c088200…`, import the exact missing commit chain without rewriting it, then rebase the Phase B commits onto that exact v62 baseline.
- If it is related but contains generated release-only commits, preserve source identity in an auditable merge/recovery commit and prove byte-level equivalence for every source file.
- If ancestry is unrelated or the source tree cannot be reproduced exactly, stop. Prepare a dedicated baseline-recovery PR; do not paste selected migration files into PR #43 and do not force-push `main`.
- Never edit already-applied migrations `0011–0015`, their snapshots or journal entries. Any correction after them is a new migration.

The recovered baseline may be reviewed/merged without a Site deployment. It must not mutate production by itself.

### 6.3 Register Phase B only after recovery

After the exact v62 baseline is present:

1. Re-run Drizzle generation from the reconciled `db/schema.ts`.
2. Treat current `0016_tenant_control_plane.sql` as an unapplied candidate. Reconcile it with the generated delta and security fixes; replace it only if necessary and record old/new hashes.
3. Register exactly one collision-free `0016` entry plus its matching snapshot. Do not hand-edit history to conceal divergence.
4. Keep the migration additive and compatible with code rollback. No table/column drop, rename, destructive rebuild or data rewrite is allowed in the release migration.
5. Existing rows remain explicitly legacy. Use nullable tenant columns plus database constraints/triggers that require `organization_id` for all newly created tenant-mode records and enforce same-tenant parent/child relationships. Never backfill an organisation ID by inference.
6. Add indexes only for actual tenant-scoped query patterns and verify representative plans. Run `PRAGMA optimize` in the controlled migration/test workflow, not per request.
7. Resolve the frozen lifecycle conflict without changing `organization-contract.v1`:
   - public `organization.status` remains within the frozen enum;
   - represent asynchronous closure in a separate internal `organization_closure_operations.phase` record;
   - while closure is running, public status is `suspended` and authorization fails closed;
   - only verified completion advances the organisation to `closed`;
   - never expose or persist `closing` as a public v1 organisation status.

### 6.4 Mandatory migration tests

The migration gate must cover:

- fresh schema through `0016`;
- exact deployed v61 → v62 chain → `0016`;
- exact Site 69 v62 schema/data fixture → `0016`;
- upgrade with representative legacy rows and zero tenant reassignment;
- rerun rejection/idempotence as defined by the runner;
- late-statement failure with full transaction rollback;
- foreign-key and integrity checks;
- table/index/trigger/FK counts and deterministic schema fingerprint;
- old Site 69 code reading the post-`0016` additive schema for code rollback compatibility;
- migration journal/snapshot/schema consistency;
- no skipped authoritative-fixture test.

`PHASE_B_MIGRATION_FIXTURE_ROOT` must point to the verified Site 69 checkout. A folder marked `unverified_external_dependency` cannot satisfy this gate.

## 7. R3 — implement the production B3–B7 composition root

Keep pure domain functions, but make every live path enter them through one server composition root, for example `TenantServices`, containing explicit interfaces for:

- authenticated identity/session resolution;
- organisation, membership, invitation and dossier-participant repositories;
- current policy/grant/approval pointers;
- tenant resource-manifest verification;
- OIDC discovery/JWKS/state/nonce/PKCE stores;
- KMS/envelope/key-rotation provider boundary;
- compliance-export request/approval/acquisition state;
- append-only security receipt storage;
- trusted clock, ID generation, idempotency and rate limiting.

Provide real D1 adapters for all durable Phase B state. In-memory adapters remain test-only and must be impossible to select in production builds.

### 7.1 Server trust rules

- Resolve actor, organisation, membership, role, policy/grant versions and trusted time server-side.
- Ignore or reject client-provided authoritative IDs, roles, timestamps, approval state and current-pointer versions.
- Scope every statement by `organization_id`; use tenant-bound composite keys and relationships.
- Use conditional version/CAS updates and atomic D1 batches for one-time actions. Verify the affected-row count.
- Make invitation acceptance, policy activation, export acquisition and key-rotation completion single-winner operations under concurrency.
- Bind idempotency keys to actor + organisation + action + resource + authority version.
- Emit a privacy-safe immutable receipt for every allow/deny security decision and state change.
- Return the same external 404/denial envelope for unknown and cross-tenant resources.
- Reject inactive organisation, suspended membership, stale session, stale policy/grant/current pointer and unverified resource manifest before any content read or mutation.
- Use database/provider time for expiry; never allow backdated client timestamps to revive authority.

### 7.2 Required Worker/API surfaces

Implement the smallest coherent Phase B route set, using the repository’s existing route conventions:

- list/create/read supported organisations;
- switch active organisation and rotate session context;
- list/invite/inspect/accept/revoke organisation invitations;
- list/change/suspend/remove memberships within allowed authority;
- list/enrol/change/remove dossier participants and roles;
- inspect/configure an Entra identity connection and complete the guarded OIDC return;
- inspect policies, propose a new immutable revision, request independent approval and activate through the approval-bound operation;
- inspect tenant resource-manifest and key-rotation status without exposing locators or secrets;
- assign/revoke separate compliance-export authority;
- create an export request, collect exact per-dossier owner approvals and acquire it exactly once;
- inspect authorised security/audit receipts.

Do not add document upload, processing, OCR or export-package byte generation. The compliance flow ends at a validated one-time authority/acquisition receipt.

### 7.3 OIDC/Entra adapter

- Use Authorization Code + PKCE and system-browser/top-level return.
- Validate state, nonce, verifier/challenge, exact redirect URI, HTTPS discovery/JWKS, signature, issuer, audience, `tid`, stable `oid/sub`, `exp`, `nbf` and bounded clock skew.
- Bind identity to the exact enabled `organization_identity_connection`; never authorize by email or domain.
- Store state/nonce/code-use and session state durably with TTL and replay rejection.
- Rotate session after return and preserve a same-origin relative `returnTo` to the exact originating Studio route.
- Tokens never enter URLs after callback, local storage, logs, analytics, receipts or crash output.
- When production Entra configuration is absent, routes return a typed unavailable state and UI says “Not configured”; no fallback creates authority.

### 7.4 KMS and resource manifests

- Production code uses a provider interface; deterministic local crypto is test-only.
- Never store plaintext key material in D1, R2, source, receipts or logs.
- Verify organisation/environment/region/resource/key/version/receipt-set bindings before branding a manifest as verified.
- Do not enter key-rotation `completed` or remove the old read key without current immutable evidence proving expected count = rewrapped count, failures = 0, exact old/new versions and matching canonical digests.
- Missing production KMS/EU/provider evidence keeps the tenant manifest inactive and confidential mode disabled; it must not block a safe public v64 UI release if the unavailable feature is visibly and server-side disabled.

## 8. R4 — complete B8 web and Flutter product parity

### 8.1 Web experience

Add a first-class organisation context without displacing the existing dossier information architecture:

- persistent organisation switcher in the authenticated shell;
- organisation overview and lifecycle state;
- members and invitations with role/status/expiry;
- dossier participants and roles `owner | contributor | reviewer | viewer`;
- separate compliance-export authority and owner-approval state;
- SSO connection status and guarded connect/return flow;
- policies, independent approval and activation status;
- resource/key status using non-secret identifiers only;
- tenant security/audit receipt register;
- explicit confidential-mode-disabled warning.

Every empty state must explain why no data exists, what action is allowed, and what remains unavailable until confidential mode is approved. Never advertise document upload in this release.

### 8.2 Flutter experience

Implement equivalent semantic capability in Flutter, not a static mock:

- organisation switcher and current-context banner;
- organisation/membership/invitation/dossier-role screens;
- SSO, policy/approval, compliance authority and audit status;
- system-browser OIDC return into the exact originating screen;
- disabled confidential-document notice;
- network/error/empty/loading/suspended/stale-session states.

Mobile may use different native presentation, but actions, policy decisions, reason codes, versions and fingerprints must match web.

### 8.3 Cache and offline isolation

- Durable truth stays in D1/provider systems, never `localStorage` or Flutter preferences.
- Tenant cache keys include environment + actor + organisation + membership authorization version + policy version + resource identity.
- On organisation switch, sign-out, session rotation, membership/role change, suspension, failed OIDC return or stale-version response:
  1. make the old context unusable immediately;
  2. cancel in-flight requests/subscriptions;
  3. clear in-memory, browser, query, service-worker, Flutter and disk caches for the old context;
  4. clear sensitive navigation/view models;
  5. load the new context only after server confirmation.
- No stale tenant name, counts, records or error detail may flash after a switch.
- Offline tenant content is disabled in Phase B. Flutter stores only minimal non-sensitive context pointers in Keychain/secure storage, with bounded TTL and authority-version floors.

### 8.4 Shared parity manifest and localisation

Create one immutable data-only Phase B product/policy manifest containing:

- action and reason-code catalogue;
- organisation/dossier roles;
- lifecycle and capability states;
- route/API contract versions;
- session and cache policy versions;
- EN/RU message keys;
- product marker `v64`.

Generate or validate web and Flutter assets from the same canonical bytes. Require byte-identical manifest SHA-256 and semantic parity tests. Do not duplicate policy logic in Dart.

All user-visible Phase B strings must exist in English and Russian. Fail tests on missing keys, English fallback in Russian, raw enum leakage or mismatched interpolation.

### 8.5 Accessibility

Meet WCAG 2.2 AA for the new web and Flutter surfaces:

- semantic headings, landmarks, lists, tables and status announcements;
- labelled controls and errors;
- complete keyboard navigation and visible focus;
- focus return after dialogs and failed OIDC;
- 44×44 CSS-pixel / 48×48 dp touch targets where applicable;
- contrast, 200% text enlargement, 320 CSS-pixel reflow and reduced motion;
- screen-reader names for roles, expiry, disabled state and audit status;
- no colour-only status communication.

Run automated axe/widget semantics tests and manual keyboard/screen-reader smoke checks in both languages.

## 9. R5 — integration and adversarial test matrix

Add route-level tests against real D1 adapters and deterministic provider fakes. At minimum prove:

| Area | Required negative and race coverage |
|---|---|
| Tenant isolation | swapped org/dossier/object IDs, cross-tenant joins, pagination/search/cache leakage, guessed locators, mixed-tenant batch, background job/receipt substitution |
| Sessions | missing/stale/replayed session, >7-day lifetime, stale issuance, suspension/reactivation, org switch, authorization-version mismatch |
| Invitations | expired-now, backdated accept, revoked, wrong identity, wrong tenant, changed role, token replay, concurrent double accept |
| Grants and roles | suspend/change/reactivate, stale current pointer, wrong policy version, org role without dossier participation, role downgrade during request |
| Policy activation | proposer = approver, expired/revoked/wrong-tenant approval, stale version, missing receipt, concurrent activations |
| Compliance export | incomplete/duplicate dossier set, wrong owner/manifest/receipt, expired request, consumed/rejected/stale state, concurrent double acquire |
| Key rotation | missing/partial/duplicate/forged/cross-tenant evidence, count mismatch, failure count, stale receipt pointer, retry/resume/rollback |
| Receipts | append mutation/deletion, mixed tenant chain, non-monotonic time, bad predecessor/digest, actor/reviewer collision, invalid target dossier |
| OIDC | state/nonce/PKCE replay, issuer/audience/tid mismatch, JWKS rotation, expired/not-yet-valid token, returnTo injection, token leakage |
| Cache/UI | switch and sign-out during fetch, back navigation, deep link, refresh, offline resume, role revocation, EN/RU and accessibility |

Property/fuzz tests must cover identifier substitution and malformed import boundaries. Do not use real identities, documents, credentials or malware.

## 10. R6 — mandatory final exact-head gates

Run every gate on the final PR head after the last source, test, receipt or documentation change.

### Web and Node

From `apps/juris-web` using the committed lockfile:

```bash
npm run install:ci
npm run lint
npx tsc --noEmit --strict
npm test
npm audit --omit=dev --audit-level=low
npm audit --audit-level=low
```

Additionally require:

- verified production build and current chunk-budget guard;
- fresh + v61 + Site69-v62 + rollback-compat migration tests, with zero skip;
- D1 route/integration and cross-tenant mutation corpus;
- JSON Schema Draft 2020-12 compilation/validation;
- import/export and revision-CAS protection;
- all existing report/PDF structural and visual regression tests;
- auth return to the originating Studio route and successful synthetic workspace save;
- stale-JS-chunk recovery without data loss;
- anonymous PDF generation/download policy test;
- prohibited-content and authoritative secret scan;
- zero production, development or optional dependency vulnerabilities at the configured release threshold.

### Rust and cross-runtime

```bash
cargo fmt --all -- --check
cargo check --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --all-targets --locked
cargo +1.78.0 check --workspace --locked
```

Require all 18 deterministic cross-runtime routes, legacy fingerprints, the nine registry/playbook packages and report-manifest parity to remain green.

### Flutter, Android and iOS

From `apps/juris-mobile`:

```bash
dart format --output=none --set-exit-if-changed lib test integration_test
dart run tool/export_mobile_case_bundle.dart --repo-root ../.. --check
flutter analyze
flutter test
flutter build apk --debug --target-platform android-arm64
flutter build ios --simulator --debug --no-codesign
```

Require:

- organisation UI and cache-isolation tests on Flutter;
- Android packaged Rust bridge verification;
- exact per-slice iOS FFI exports;
- iOS simulator lifecycle and OIDC-return/cache invalidation tests;
- identical canonical Phase B manifest bytes/fingerprint across web and Flutter;
- no app-store package/distribution.

### Hosted GitHub gates

On the same exact head require successful:

- Rust CI;
- Flutter Mobile UI;
- Android Native FFI;
- iOS Native FFI/simulator;
- hosted web/security checks if added;
- Codex code review;
- Codex security review.

All ten historical findings must be mapped, replied to and resolved only after the final review. New findings restart the fix-and-rerun loop.

## 11. R7 — evidence pack and readiness decision

Update `CURRENT_PROGRESS.md` and create/update Phase B evidence with:

- exact base/head/tree and complete commit list;
- Site69 recovery provenance and migration file hashes;
- registered `0016` hash, schema fingerprint and migration results;
- B0–B9 completion matrix with no “reference-only” claim;
- production adapter/route inventory;
- web/Flutter manifest digest;
- every test command, count, workflow URL/ID, conclusion and exact head;
- code/security review IDs and zero unresolved P0/P1/P2;
- production-baseline receipt digest;
- confidential-mode-disabled proof;
- explicit external provider dependencies still inactive;
- rollback procedure and evidence that Site69 code tolerates additive `0016`.

The PR is **not ready** if any of these remains true:

- authoritative migration fixture is skipped;
- Site69 source/history differs from the recovered tree;
- historical deployment ID/status linkage remains missing;
- any production route selects an in-memory adapter;
- any tenant query lacks organisation scope;
- any web/Flutter action has no semantic peer;
- EN/RU or accessibility evidence is incomplete;
- any dependency/security/review/native/parity gate is not green;
- confidential mode or Phase C code becomes reachable.

Only after every item is green, mark PR #43 ready for review and request this exact approval:

> Approve merging PR #43 at exact head `<FINAL_PR_SHA>` after all recorded gates, with confidential document mode remaining disabled and no app-store release.

Do not merge without the approval containing the actual final SHA.

## 12. R8 — merge and prepare the exact production release

After merge approval:

1. Merge using the repository’s normal protected workflow; do not bypass branch protection.
2. Fetch `main` and record the resulting exact `MAIN_SHA` and tree.
3. Verify the main tree equals the reviewed PR tree except for expected merge metadata. If content differs, stop.
4. Run the complete web build/tests and required post-merge CI on `MAIN_SHA`. PR-head success alone is insufficient for deployment when the merge SHA differs.
5. Set one consistent user-facing product marker `v64` and runtime release identity from a single build source. Keep Site version separate from product version.
6. Confirm immediately before saving that the latest saved Site version is still 69. The expected next version is 70. If it is not, stop and reconcile concurrent release activity.
7. Build and package from a clean checkout of exact `MAIN_SHA` using the Sites workflow. The archive must contain the exact generated migration and hosting metadata.
8. Push exact `MAIN_SHA` to the existing Sites source repository using a short-lived per-command credential. Never store the token.
9. Obtain fresh public-deployment approval naming the exact SHA and existing public access:

   > Approve saving and publicly deploying Site 70 at exact main SHA `<MAIN_SHA>` to the existing public access of `studio.falcon-merlin.com`, with automatic code rollback to verified Site 69 on the defined failure conditions; confidential document mode remains disabled.

Saving a version that applies production migrations is part of this approval gate. Do not save or deploy before it.

## 13. R9 — one Site 70 deployment and post-deployment proof

After exact approval:

1. Save exactly one Site version from the unchanged archive and `MAIN_SHA`.
2. Require the save response to return version number 70 and retain its opaque version ID/archive digest.
3. Deploy that exact saved version with `deploy_site_version` because the Site is public.
4. Poll `get_deployment_status` with the returned deployment ID until terminal.
5. Success requires `status=succeeded`, exact Site70 version ID, expected project ID and the literal production URL.
6. Verify without weakening authentication:
   - `studio.falcon-merlin.com` domain and SSL remain active;
   - visible product marker is `v64` in EN/RU;
   - structured Worker events report Site 70 and exact `MAIN_SHA`;
   - zero unhandled exceptions, 5xx and cross-tenant leaks in the observation window;
   - expected anonymous 401/403 and benign missing favicon/robots responses are classified, not counted as product failures;
   - authentication returns to the originating Studio route;
   - one explicitly synthetic, non-identifying workspace save succeeds and produces the expected tenant/audit receipt;
   - anonymous PDF behavior and stale-chunk recovery pass;
   - confidential upload remains unavailable in UI and server routes.
7. Create `PRODUCTION-RELEASE-RECEIPT-v64.json` tying together:
   - main SHA/tree;
   - Site70 version/archive;
   - deployment/provider IDs and terminal status;
   - domain/SSL;
   - runtime script version and structured marker;
   - health/log window and gate evidence;
   - production-baseline receipt digest;
   - canonical receipt digest.

Report the production URL, exact main SHA, Site version, deployment ID, test/workflow evidence, migration fingerprint, remaining disabled external capabilities and rollback state.

## 14. Rollback and fail-closed rules

Rollback immediately to the verified Site69 saved version if Site70 deployment fails, marker/SHA differs, migrations are incompatible, auth/save breaks, tenant isolation fails, any 5xx/security error appears, or confidential routes become reachable.

- Roll back code only by deploying the exact verified Site69 version ID and poll its new deployment to `succeeded`.
- Do not run a destructive down migration. `0016` must be additive and harmless to Site69 code.
- Keep all Phase B and confidential capabilities disabled after rollback.
- Capture the failed Site70 and successful rollback deployment receipts.
- Stop; do not create Site71 or retry production without a new reviewed fix, full gate rerun and new exact-SHA approval.

If Site69’s immutable baseline receipt cannot be completed, rollback is not verified and production release remains blocked. Do not replace that evidence with confidence language.

## 15. Final stop conditions

Stop and report the exact blocker, without merge or deployment, if any of the following occurs:

- Site69 source commit/archive cannot be recovered and matched;
- the provider-owned historical deployment receipt cannot be obtained;
- migration ancestry is unrelated or any applied migration would need rewriting;
- existing data would require silent tenant assignment or destructive conversion;
- an external provider requires a secret/resource change without explicit approval;
- any production route cannot be made deny-by-default and durable;
- any mobile, accessibility, localisation, parity, security, review, migration or dependency gate fails;
- the final PR or main SHA changes after approval;
- Site version 70 is no longer the next version;
- Phase C or confidential upload becomes reachable;
- rollback compatibility is not proven.

Never declare v64 shipped from a saved version, green local tests, a visible marker, or three of four native checks. “Shipped” means: merged exact source, successful exact Site70 production deployment, correct live marker/SHA, green post-deployment health, immutable release receipt, and confidential mode still disabled.
