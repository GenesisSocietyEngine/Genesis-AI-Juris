# V64 Phase B reconstruction evidence and blocker register

Status: **meaningful isolated reconstruction; PR remains draft and is not
ready for merge, release, deployment, or confidential activation**

Recorded at: `2026-09-02T17:40:58Z`

Repository: `GenesisSocietyEngine/Genesis-AI-Juris`

Pull request: `#43`, branch `codex/v64-phase-b-tenant-foundation`

## Identity and recovery provenance

- Phase A development base: `c088200138332cd212b87e266746ea85b53a2f77`.
- Instruction-only predecessor: `6feb611b70a79f41bc87e25a6d469490cf8ba71c`.
- Amended instruction head and reconstruction parent:
  `fef5a27fd86d4978c522adb0e5f1526d00c9da66`, tree
  `b4d6bb60abb2b4de2722a923734b2cac3501d3d6`.
- Original reconstructed implementation checkpoint:
  `0efcefd5cbf313cdf55509f24b30de7759fdacab`, tree
  `8a26c1383e694e08a5411c87742cb094d7f16098`.
- Evidence checkpoint: `88416e0791942d75a92f92ac04d1accbb9f26a27`,
  tree `581cf28eb5bcc04806b0d070d620021b5f32512a`.
- Hosted-review correction checkpoint:
  `9cb539af63a034d3a614535aa6f362455ce06fce`, tree
  `f50439d0cc1f4906261daf881483669c91f842b2`.

The reported commits beginning `7a971f4`, `7384945`, `c34500f`, and `8fc5797`
were absent from GitHub and every available local object, ref, reflog, worktree,
and Codex artifact. The branch therefore contains new, attributable commits;
no match to an unavailable object is claimed:

| Order | Commit | Tree | Subject |
|---|---|---|---|
| 1 | `42b7cb4d2ebb236090986544fac508ebc4fcef9c` | `ef54b464313d60d174e9b9994c51fe1fcbe405fb` | `docs(v64): reconstruct Phase B discovery receipt` |
| 2 | `7f18100e7964a9aede53ccbf7861542ce5c8c87a` | `ac674927d639c129761a3574d91e56ef6e9b51e2` | `feat(mobile): isolate organization context switching` |
| 3 | `f1553a67ec2d6ad1cc01313280bc3f1b0d1f0bcd` | `ee3b985f0442f799cc4cf83b67a0e17c10e82d7b` | `fix(mobile): revoke stale organization authority immediately` |
| 4 | `98409fc650c0fa17e1403112eaf2408a9f13c44d` | `f292f6bb458a71e44660f5f34ba4931f858a56d3` | `fix(mobile): retain organization version floors` |
| 5 | `dabab4065693a90e14ed33d90d8c58e892f47d78` | `fecc48d55c938c4aceaffb567eb4b8e96234ca93` | `fix(mobile): harden tenant invalidation races` |
| 6 | `0efcefd5cbf313cdf55509f24b30de7759fdacab` | `8a26c1383e694e08a5411c87742cb094d7f16098` | `feat(v64): reconstruct protected tenant foundation` |
| 7 | `88416e0791942d75a92f92ac04d1accbb9f26a27` | `581cf28eb5bcc04806b0d070d620021b5f32512a` | `docs(v64): record reconstructed Phase B evidence` |
| 8 | `9cb539af63a034d3a614535aa6f362455ce06fce` | `f50439d0cc1f4906261daf881483669c91f842b2` | `fix(v64): bind export and receipt authority` |

At the implementation checkpoint, the clean diff against `fef5a27` is 12
files, 8,564 insertions, and one deletion: three reference server modules, one
branch-only migration, two web test files, one role/action policy manifest, two
Flutter organization-context files, three discovery/rollback/progress files.
The evidence carrier is an additional documentation-only descendant.
At the hosted-review correction checkpoint, the clean cumulative diff against
`fef5a27` is 13 files, 9,142 insertions, and one deletion. The correction binds
the export requester to the authenticated authority, rejects malformed and
sparse approval inputs, partitions receipt state by organization, and shares
strict receipt semantics between append and verification.

## B0-B9 status

| Slice | Status | Implemented evidence and remaining acceptance gap |
|---|---|---|
| B0 | **Partial** | Truthful recovery provenance, frozen-input blob identities, discovery receipt, contract-to-code matrix, and read-only production observations exist. The live deployment cannot yet be cryptographically linked to saved Site version 69 and its source archive. |
| B1 | **Partial** | The branch-only `0016_tenant_control_plane.sql` candidate defines 21 tables, 32 indexes, 66 triggers, and 32 foreign keys with lifecycle, membership, invitation, grant, manifest, rotation, approval, and append-only receipt invariants. It is deliberately unregistered until the authoritative migration chain and the frozen public lifecycle/`closing` conflict are resolved. |
| B2 | **Blocked** | No placeholder data plane was invented. The exact base lacks the authoritative v62 dossier/document graph, so composite tenant binding, repository constraints, cache/search/job/locator isolation, and full resource coverage are absent. |
| B3 | **Partial** | A typed deny-by-default policy decision point, machine-readable role/action policy, dossier participation checks, separate compliance authority, freshness checks, and adversarial tests exist. Production API routes and the missing B2 repositories do not consume it. |
| B4 | **Partial** | Reference lifecycle, digest-only invitation, membership, grant, compliance-authority, and owner-approval logic is present with negative and concurrency tests. Export authorization binds `requestedByActorId` to the authenticated grant actor and requires a structurally valid, exact, unique owner-approval dossier set. Production APIs/durable adapters, authoritative dossier-owner binding, and lifecycle-contract resolution remain absent. |
| B5 | **Partial** | A local production-shaped PKCE/OIDC transaction and callback boundary checks state, nonce, redirect/origin, browser/tab correlation, stable identity, replay, freshness, and connection enablement. Real discovery, JWKS/signature/token exchange, secure cookie/session integration, durable CAS, and system-browser return are not implemented. |
| B6 | **Partial** | Strict tenant-resource manifest verification, a local envelope-encryption boundary, key-version binding, and a resumable rotation state machine exist. Production KMS/provider adapters, durable application wiring, EU residency, backup/restore, and provisioning receipts remain unverified. |
| B7 | **Partial** | Privacy-safe chained receipt logic, append-only SQL guards, version bindings, races, and selected tenant-substitution tests exist. In-memory listing, verification, sequence/digest state, append queues, and monotonic timestamps are explicitly partitioned by organization; strict append/verify validation rejects malformed and cross-tenant chains, including interleaved concurrency. There is no production append adapter or complete B2-wide property/mutation corpus for every required object, search, cache, pagination, job, notification, and locator path. |
| B8 | **Partial** | The Flutter organization coordinator clears context and enforces independent authorization/session floors across switches, revocation, policy/membership invalidation, failures, and sign-out races. It is not wired into production UI/cache stores; web organization UI, shared-manifest parity, OIDC return, redaction, accessibility, and EN/RU evidence are missing. |
| B9 | **Blocked** | Focused and broad local gates are green at the hosted-review correction source. Hosted security review was clean at `88416e0`; hosted code review raised two P1s, both corrected at `9cb539a` with discriminating regressions and a subsequent independent local review reporting no P0/P1. Exact correction/final pushed-head Rust/Flutter/Android/iOS checks and code/security rereviews remain pending. The production-only dependency audit is clean, but a supplemental full dependency-tree audit now reports 15 dev/optional advisories. An authoritative secret scan, true Draft 2020-12 schema compilation, full accessibility/parity gates, and the architectural gaps above also remain outstanding. |

This is not a claim that Phase B is complete. In particular, B2 is an
architecture dependency for the production wiring and full isolation proof
required by B3-B8.

## Migration receipts

The additive migration was executed only against fresh local in-memory SQLite
databases. It was not registered in `db/schema.ts` or the Drizzle journal and
was never applied to production.

| Candidate input | Chain fingerprint | Result |
|---|---|---|
| Exact PR base through `0010` | `cd93cd3e186945bc37b972d70e7e3ab6f5046fdab5686f0dc2ce0e43a2c4ecdb` | `integrity_check=ok`; zero foreign-key violations; zero rows seeded into the 21 B1 tables; final schema fingerprint matched |
| External v61 source candidate | `9ef229da8013ce5d44bd617dcf2c434ed3d6016dca63e95e1db60929f7f74710` | `unverified_external_dependency`; `integrity_check=ok`; zero foreign-key violations; zero rows seeded into the 21 B1 tables; final schema fingerprint matched |
| External v62 source candidate | `94225c669fb0594918dca5cfec0d1279e12d0eb16a419a3c3c3fad0b263348bc` | `unverified_external_dependency`; `integrity_check=ok`; zero foreign-key violations; zero rows seeded into the 21 B1 tables; final schema fingerprint matched |

- Normalized Phase B migration SHA-256:
  `eac3f234ec19e96e8b2966e174e034757160ee60731373404c49963629e07f53`.
- Deterministic resulting schema SHA-256:
  `0ac5fc3ce151f2d46b838cb603deca8dc7a2aa47e3ee9588d11174f790d6fbbe`.
- Resulting counts: 21 tables, 32 indexes, 66 triggers, and 32 foreign keys.
- Rollback/resume and evidence-preserving downgrade guidance:
  `docs/architecture/v64/PHASE-B-MIGRATION-ROLLBACK.md`.

The v61 and v62 inputs are source candidates, not production backup, restore,
deployment, or rollback receipts. Registration remains blocked by the missing
authoritative `0011`-`0015` history and the absence of B2 aggregates on the
exact base. The read-only fixture source candidate was observed at
`bfca01b03e2ef572291ce6847e7b5f23e6be48e9`; it remains labelled
`unverified_external_dependency`.

## Local verification

The web gates below ran against the source represented by hosted-review
correction checkpoint `9cb539af63a034d3a614535aa6f362455ce06fce`.
Flutter, Android, and Rust files were unchanged by that correction; their local
receipts remain from implementation checkpoint `0efcefd5`. Later evidence
changes are documentation-only.

### Web and server

| Command | Result |
|---|---|
| committed-lockfile `npm ci` in the short-path validation clone | PASS; 510 packages installed |
| `npm run lint` | PASS; zero diagnostics |
| strict TypeScript `tsc --noEmit --strict` | PASS; zero diagnostics |
| focused Node Phase B foundation and migration tests with both read-only external fixture candidates enabled | PASS; 37/37 |
| `npm test` | PASS; verified production build completed all five stages and the complete suite passed 140/140 |
| `npm audit --omit=dev --json` | PASS; zero production vulnerabilities across 20 production dependencies |
| supplemental `npm audit --audit-level=low` | FAIL; unchanged lockfile currently reports 15 dev/optional findings: 11 high and 4 moderate; suggested complete remediation includes breaking or out-of-range upgrades |

The committed `npm run install:ci` wrapper is Linux-specific (`flock` and
`/proc`) and cannot execute on this Windows host. Direct committed-lockfile
`npm ci` is the local fallback receipt; a hosted Linux exact-head receipt is
still required. No dedicated hosted web/security workflow exists in this
branch.

### Flutter and Android

| Command or check | Result |
|---|---|
| `dart format --output=none --set-exit-if-changed lib/organization_context.dart test/organization_context_test.dart` | PASS; `Formatted 2 files (0 changed)` |
| `dart run tool/export_mobile_case_bundle.dart --repo-root <clone> --check` | PASS; deterministic and current |
| `flutter analyze` | PASS; zero issues |
| `flutter test` | PASS; 290/290 |
| `flutter build apk --debug --no-pub` | PASS |
| APK receipt | 168,131,710 bytes; SHA-256 `7a6853fd07052057d06ae017a390e3675a67110dc488601899c50c2ed750689e` |
| Android FFI namespace | PASS; exactly `juris_mobile_bridge_abi_version`, `juris_mobile_bridge_execute`, and `juris_mobile_bridge_string_free` in each of `arm64-v8a`, `armeabi-v7a`, and `x86_64` |

The focused organization-context suite also passed 15/15. Apple tooling is not
available on this Windows host, so the exact-head iOS build, per-slice FFI
audit, Simulator lifecycle, Keychain, and cache receipts must come from hosted
CI.

### Rust, patch hygiene, and review

- `cargo fmt --all -- --check`: PASS.
- `cargo clippy --workspace --all-targets --locked -- -D warnings`: PASS.
- `cargo test --workspace --all-targets --locked`: PASS; 359 tests, zero
  failures.
- `cargo +1.78.0 check --workspace --locked`: PASS.
- `git diff --check`: PASS.
- Supplemental added-file credential-pattern scan: no apparent embedded
  credential. This is not an authoritative secret-scanner receipt.
- Independent narrow security/code audit: no unresolved P0/P1 after fixes for
  receipt input capture and strict semantics, per-organization chaining,
  authenticated export requester and approval-set binding, legal-hold binding,
  OIDC and manifest/invitation time-of-check/time-of-use boundaries, and mobile
  invalidation races.
- Hosted security review at `88416e0`: clean; no security issue reported
  (`issuecomment-5513321128`).
- Hosted code review at `88416e0`: P1 export-requester binding thread
  `PRRT_kwDOTiwDjc6emg8r` (`discussion_r3916633722`) and P1 organization receipt
  partition thread `PRRT_kwDOTiwDjc6emg8y` (`discussion_r3916633736`). Both are
  corrected at `9cb539a`; exact correction/final-head replies, thread resolution,
  and rereviews are pending publication.

## Production reconciliation

Read-only hosting evidence identifies project
`appgprj_6a88a26d2f808191aa076b9fcd8dbce6` as active and its latest saved version
as 69. Saved version 69 reports source SHA
`6019e47346a2bf719a09dc1d874a2fc807f99598`; its source archive is a 320-file,
25,825,280-byte tar with SHA-256
`3dcfe92950c2e5e0f99d7f638f0f66633397c5c25e62ac9e065cc8e27255d555`.
The live URL `https://studio.falcon-merlin.com` returned HTTPS 200 with title
`Falcon-Merlin Case Studio` and marker `v62`; it did not contain a `v61`
marker. Recent worker-log inspection returned no events in the observed
60-minute window.

The available read-only API does not provide an exact linkage proving that the
live deployment is saved version 69 and the archived source SHA above.
Therefore the expected line is strongly corroborated but not an authoritative
deployment-to-version receipt. Ready-for-merge, rollback selection, release,
deployment, production provisioning, and confidential activation remain
blocked.

## Scope and safety receipt

- No workflow, release gate, hosting configuration, package lock, app-store,
  native project, production configuration, or frozen Phase A schema changed.
- No Phase C document/upload/quarantine/scanning/extraction/OCR aggregate or
  execution path was implemented. Upload, extraction, and OCR actions are
  denied; `isUploadClassificationPermitted` always returns `false`.
- No production D1/R2/KMS/Entra/email resource, identity configuration, secret,
  Site version, deployment, or app-store state was created or mutated.
- No real client data, identity, credential, confidential document, or malware
  was used. Fixtures are deterministic, synthetic, and de-identified.
- Confidential document mode remains disabled. SQL guards reject approved
  confidential activation.

> Confidential document mode is not active. Do not upload privileged,
> client-identifying, or live production documents. Use only synthetic or
> properly de-identified material.

## Remaining blockers and unverified dependencies

1. Obtain the authoritative v61/v62 migration history and data-plane schema;
   implement B2 tenant bindings and register the migration without collision.
2. Resolve the frozen public lifecycle enum versus internal `closing` state
   through an approved ADR/new contract version or a compatible persistence
   design.
3. Wire B3-B7 through production routes and durable tenant repositories, OIDC
   session/CAS, KMS/provider, and append-only receipt adapters, then prove the
   complete B2-wide isolation corpus.
4. Implement factual web/Flutter organization UI, browser/deep-link return,
   cache/redaction controls, shared policy-manifest parity, accessibility, and
   EN/RU coverage without starting Phase C.
5. Add or run real Draft 2020-12 schema validation, authoritative prohibited
   content/secret scanning, parity/manifest, import/export/revision, full 18
   route, accessibility, and other mandatory Phase B gates on the final head.
6. Obtain exact correction/final pushed-head hosted Rust, Flutter, Android, and
   iOS receipts plus hosted Codex and dedicated security rereview. Prior hosted
   security and Rust/Flutter/Android evidence at `88416e0` is superseded by the
   correction head.
7. Obtain an authoritative read-only live-deployment-to-Site-69/source-SHA and
   current observability receipt.
8. Keep Entra, EU D1/R2 namespaces, KMS/key rotation, email delivery,
   compliance/DPA/subprocessor, penetration-test, restore, and support evidence
   labelled `unverified_external_dependency`; no mock is production evidence.
9. Reconcile the 15 current dev/optional dependency advisories through a
   separately reviewed lockfile/toolchain update. Production dependencies audit
   clean; this Phase B branch does not alter the frozen lockfile or release gates.

PR `#43` must remain draft. No merge approval is requested by this receipt.
