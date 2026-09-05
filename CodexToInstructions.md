# Genesis: Juris — Codex instructions for 5 September 2026

## Active P1 implementation — organizations and synthetic ERP journeys

The owner assigned P1 implementation after the completed recovery. Continue on
`codex/p1-organizations-erp-2026-09-05`, based on main
`5a5ce9b1afc3130c6c1dc55ccdc967902033f929` (includes the PR #48 readability update).
Do not restart P0 or merge the stale PR #43 layout.

Read [P1 implementation and remaining gates](docs/development/P1-ORGANIZATIONS-ERP-2026-09-05.md)
and the [ERP acceptance packet](docs/testing/erp-pilot-2026-09-05/README.md).
The implementation now includes durable organization membership, immutable
dossier bindings, invitations, independent lifecycle approval, request and
transaction authorization, scoped web selection and mobile browser navigation.
Migration `0019_p1_organization_scope.sql` is additive; migrations through 0018,
the dependency lock and hosting configuration remain unchanged.

The five ERP journeys now have executable evidence through **real API handlers
and isolated D1/R2**, including real play-session decisions, PDF generation and
reviewer approval. This supersedes "NOT RUN" only for those automated checks.
Authenticated browser journeys, real-phone checks and professional trials are
still pending. The initial preview displayed the organization shell but remained
on loading; do not mark browser interaction or EN/RU behavior as verified from
server HTML alone. Resolve this gate on the candidate before a feature release.

This is the existing **synthetic/de-identified validation plane**. It does not
activate confidential ingestion or implement the approved dedicated EU D1/R2
plane, production Entra/JWKS verification, external KMS, tenant manifests, durable
key rotation or compliance export. The imported PR #43 modules for those areas
are reference implementations, not production adapters. Keep those capabilities
off until separately configured, integrated and tested.

Next execution: inspect the implementation PR and exact commit's required
Rust/Flutter/Android/iOS/web/PDF jobs; fix failures on that branch; complete the
authenticated desktop/phone acceptance matrix. Keep source, tests and hosted
release receipts distinct. The present assignment authorizes implementation and
a reviewable draft PR; the prior P0 release authority does not deploy this new
feature. No production migration or feature release is claimed by this checkpoint.

## Current checkpoint — P0 recovery released, publication blocker resolved

**Reverified on 5 September 2026 against GitHub and the native Sites provider.**
This checkpoint supersedes the historical recovery instructions below, including
the old cloud-task statements that publication is blocked and P0c is pending.
Do not restore the source again, reopen PR #47, or deploy another copy of this
release in response to that old task result.

| Item | Verified state |
| --- | --- |
| Recovery implementation | PR #47 merged on 2026-09-05 at 10:35:41 UTC |
| Released source | `83c97a78547c131570df1b752814353ba0cb1fdb` |
| Released source tree | `777d1111fa3f7d3442b5eecfcade2205487cf6bc` |
| P0a / P0b | Restored source and deterministic CI published and merged |
| P0c technical release gates | All five required workflows passed on the released source; deployment confirmed |
| Sites version | 70, built from that exact released source |
| Deployment status | `succeeded`, re-read from the provider |
| Live Studio | https://genesis-juris-web.maxim-hayan.chatgpt.site |
| Next engineering milestone | P1 Protected Tenant Foundation, scoped in section 6 |

The authoritative [release receipt](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/47#issuecomment-5551289624)
contains exact workflow, artifact, version and deployment IDs. The cloud task's
local P0b commit `5c848d4bcff38cc82f8a4489c068b9fc73b39ef5` was recovered as
published commit `4d585cc94fd9010a5ab970fae60eaf16c7f3c0a9`, with the same tree
`47004d47d87bdf116eede1b87e280c64a94f12aa`. The subsequent PDF correction is
`5875dec8552eb53ece46ffc130cd1344f3804bd0`. Do not try to push the obsolete local
commit onto the already-merged recovery branch.

Verification limits remain explicit: Flutter's 12 Windows pixel-golden tests
were platform-skipped on Linux, not passed. The separate Windows PDF job did
pass its unchanged 55-PNG baseline for the 47-PDF / 702-page corpus. The five
synthetic ERP journeys are prepared acceptance specifications, still **NOT RUN**
as browser/user trials. P1 tenant/OIDC completion, confidential-data activation,
Phase C and app-store distribution are not part of this completed recovery.

Start future assigned work from the freshly observed `main` that contains the
released commit. Later documentation commits can advance `main` without changing
the source deployed as version 70. Keep the current checkout, tested revision and
deployed revision separate; never label their different SHAs as a source mismatch
without first checking ancestry and the actual changed paths.

### Publication handoff when a cloud runner lacks GitHub access

1. Read this checkpoint and live PR state before acting on a historical task
   result. Record the starting SHA/tree, branch, working-tree status and available
   publication capabilities. Missing `origin`, unauthenticated `gh`, denied direct
   network access or an absent `make_pr` tool describe that runner only.
2. Use an available, authorized GitHub connector or the established authenticated
   Git transport. Never add credentials to repository files or remote URLs,
   disable proxy controls, or keep retrying the same rejected network route.
3. If that runner has no supported publication path, commit the bounded work and
   produce a binary-capable full-index patch or Git bundle for the explicit
   starting commit through the final commit. Provide the base/head/tree, changed
   paths, artifact SHA-256 and an accessible artifact or task link. Report the
   exact limitation; do not stop with only "cannot push" or claim publication.
4. The owning coordinator can recover that artifact through the connected GitHub
   environment. Verify its checksum, provenance and resulting tree against the
   task receipt in an isolated checkout, then publish to the actual open task PR.
   If another writer changed its base, reconcile and record a new candidate/tree
   and verification rather than overwriting the branch or reusing old results.
5. Run mandatory hosted gates on the published candidate and retain exact-source
   results. A bot acknowledgment, local commit, green checks on another head or
   saved Site version is not evidence of a successful deployment.

This handoff does not expand release authorization or start a concurrent cloud
task. Ordinary source recovery/publication follows the assigned scope. A new
feature release must meet its own gates and existing owner authorization.

## Historical execution instructions — completed recovery release

The remaining sections preserve the approved scope, history and P1 backlog.
Their restore/fix/merge/deploy steps describe work completed by PR #47; the current
checkpoint above governs continuation. They do not authorize a duplicate release.

## Approved release continuation — 5 September 2026

This section records the execution authority used for the completed bounded recovery release. It superseded earlier no-merge/no-deploy wording **only for that release**. The owner asked to fix the failed checks, provide revised instructions, deploy the agreed version and monitor progress. Interpret the voice-input word “диплом” in that release request as deployment.

### Current checkpoint and actual failure

- PR #47 contains P0a at `3fbbcf4f26fd29b9d1acdb6641ab7b8625471f21` and the recovered P0b patch at `4d585cc94fd9010a5ab970fae60eaf16c7f3c0a9`.
- P0b's tree `47004d47d87bdf116eede1b87e280c64a94f12aa` exactly matches the completed cloud task. Its local commit could not push; the coordinating agent published it through GitHub. Do not request another inaccessible local commit or claim an unpushed task result is deployed.
- The failed web job `101287555490` ran all 496 tests successfully. Its actual failure was `pdfinfo 24.02.0` versus the required `25.07.0`. Node 20 deprecation was a warning, not the failure.
- The approved visual baseline also requires `win32/x64` and canonical `.artifacts/v62-report-qa` paths. A Linux package upgrade alone does not satisfy that baseline.
- Fix the CI environment: Linux web/build/audits plus a required Windows PDF job using the checksum-pinned Poppler 25.07.0 package. Keep the existing 47-PDF corpus, structural checks, page selection, hashes and visual baseline unchanged.
- Create diagnostics before setup, retain them outside the verifier's cleaned output directory and explicitly upload the bounded hidden artifact paths. Do not weaken failed steps or hide an absent artifact.
- Pin maintained Node 24 action releases and checkout the actual PR head in every workflow. Keep application Node 22.23.2/npm 10.9.8 distinct from the action's own Node runtime.

### Execute to the authorized release

1. Continue on PR #47. Publish the scoped fix and this amended brief, with explicit provenance and a clean source tree.
2. Require green final-head Rust/MSRV, Flutter, Android, iOS, Linux web/build/496 tests/audits and Windows 47-PDF/unchanged visual-baseline jobs. Inspect PDF artifacts for Bhopal and bilingual stress coverage. Never transfer old-head PASS to a new head.
3. Preserve root web, all nine packages, Rust authority, human-reviewed AI, immutable source versions, frozen migrations through 0018, hosting bindings and the synthetic/de-identified restriction.
4. Merge the tested recovery PR using an expected-head check when every release gate is met. Reconcile a changed main before merging. Verify the resulting main source/tree and post-merge checks.
5. Publish the exact approved source to the **existing public Site** `appgprj_6a88a26d2f808191aa076b9fcd8dbce6` at studio.falcon-merlin.com using Sites. Determine its returned next version; do not invent a Site or a version number. Keep GitHub source, Sites source, build/archive and saved version attributable to the same source.
6. Deploy the saved version and retain the provider's succeeded receipt, deployment ID, source commit and literal production URL. A saved version or CI pass is not deployment.
7. Update the PR with actual verification/release receipts and the precise remaining P1 scope. Monitoring reports meaningful failures, new commits and the confirmed release; it must not start a concurrent implementation or deployment.

### Boundaries that remain in force

This is integration recovery around the existing Site 69 dossier/Studio functionality. It does not complete the Protected Tenant Foundation from PR #43 or activate new tenant/OIDC/confidential ingestion features. Do not merge PR #43/#44, rewrite migrations, provision confidential infrastructure, change identity/secrets, add case types, refresh visual baselines, enable Phase C or distribute an app-store build.

P1 remains the separate tenant-completion milestone after the recovery release. The ERP pilot packet/checklist prepared under `docs/testing/erp-pilot-2026-09-05/` is a synthetic acceptance specification, not evidence of five completed professional trials.

If a required gate is genuinely blocked, preserve the published candidate and exact failing evidence. Continue independent fixes and reporting. Do not claim a release and do not request generic permission that the owner has already given.

## Execution amendment after the failed cloud run

**Updated:** 2026-09-05. The first GitHub-triggered cloud request ended with "Codex couldn't complete this request. Try again later." No implementation commit or new branch was published by that attempt. The response does not establish a cause; do not infer a code defect, quota issue or image dependency.

Execute P0 as durable checkpoints:

1. **P0a — source restoration:** publish a separate implementation branch/PR with verified native/shared source and inherited CI restored from the reachable historical commit. Keep the root web baseline and frozen migrations. Record exact object identities; do not call inherited floating-toolchain workflows final release evidence.
2. **P0b — build integration and deterministic CI:** work on the P0a implementation PR. Inspect current failures, fix only actual path/toolchain/lock problems, add web/PDF CI and publish a bounded commit before broader verification.
3. **P0c — final candidate evidence:** complete the required exact-head gates and ERP pilot checklist; keep unavailable gates explicitly blocked.

Read the current PR and its checkpoint receipt first. Continue from a verified published checkpoint; do not restore the same files repeatedly. If P0a was already completed by the coordinating agent, start at P0b.

Use committed repository content and accessible Git history as task inputs. The owner's screenshot merely shows the generic failure. No chat scratch image, local attachment path or missing image is required for source recovery.

For the cloud continuation, update the existing implementation branch using the integration's supported write path. A separate additional PR is unnecessary once that implementation PR exists. If the runner cannot publish, preserve its patch and report the exact publishing limitation; do not imply a successful push.

The full P0 acceptance requirements below remain unchanged. Splitting checkpoints does not turn a partial result, absent test or generic bot acknowledgment into release readiness. The later approved release continuation above authorizes the tested recovery merge/deployment. Confidential activation and Phase C remain outside this execution.

## Outcome and scope

**Prepared:** 2026-09-05, from a read-only GitHub and Sites audit.  
**Repository:** GenesisSocietyEngine/Genesis-AI-Juris  
**Planning track:** v64 integration recovery, followed by Protected Tenant Foundation.  
**Product language:** English by default; preserve Russian parity.  
**Today's deliverable:** a tested recovery candidate, amended instructions and a verified deployment of that exact source to the existing Studio, preserving the recovered Site 69 application baseline.

Turn an unstructured professional matter into a **versioned, explainable, testable and reusable decision package**.

Matter/Dossier functionality already exists in the recovered web source. Do not restart the August dossier MVP or repeat v60/v61 implementation. The immediate task is to restore integration integrity, then finish tenant isolation around that existing functionality.

This file is an execution brief. Publishing this instruction-only draft PR does not implement the recovery or start a Codex run. When assigned the execution task, proceed through discovery, reversible implementation, local commits and a reviewable implementation draft PR under the existing repository permissions. The owner's later release request authorizes the scoped corrected candidate after all mandatory gates; unrelated feature releases remain separate.

## 1. Verified starting observations

These are dated observations, not fabricated invariants. Re-fetch them before execution.

| Item | Observation on 2026-09-05 |
| --- | --- |
| GitHub main | `280394640f0fc4d2a87e098edd6d34001393c557` |
| Main tree | `d3e14e34db68830f4eb73fc84bc27bce5713577c` |
| PR #45 | Merged 2026-09-04 13:48:45 UTC |
| Approved PR #45 head | `fd7a227385b9674466c08fe98a685a36911696c0` |
| Previous main / native and contract recovery source | `c088200138332cd212b87e266746ea85b53a2f77` |
| Imported Site source | `6019e47346a2bf719a09dc1d874a2fc807f99598` |
| Immutable provenance merge | `48227d0af54d7f5c117f3d29311f399602fe1933` |
| PR #43 | Open, draft, reported non-mergeable |
| Actual PR #43 head | `2f6e545b70a39c3fda4aa3b71ca380799e7c52a8` |
| PR #44 | Open draft, alternative recovery approach; not a second implementation baseline |
| Site | Active; latest saved version 69, source `6019e47346a2bf719a09dc1d874a2fc807f99598` |
| Main Actions/check runs | Zero workflow runs and zero check runs returned for the audited main SHA |
| Current web migration chain | Through `0018_low_calypso.sql`; includes `0016_polite_sentinels.sql` |
| Previously mentioned local recovery head | `4fea303eccb64401b2c8871166d6f5ac16946cdd` is not retrievable from GitHub: API returned no commit found |

The GitHub main tree contains the web application at repository root. It currently lacks `Cargo.toml`, `Cargo.lock`, `crates/`, `apps/juris-mobile/`, shared `contracts/`, and `.github/workflows/`. These remain in earlier Git history; their absence from HEAD does not imply loss of that history.

PR #45 reports 496/496 web tests, zero dependency audit findings and web parity at its exact head. These are prior validation receipts, not newly executed checks in this planning audit. Hosted Rust/mobile evidence on other SHAs must not be represented as CI for current main.

Sites confirms saved-source identity and an active site, but the reads used here did not return an immutable historical Site 69 deployment ID/status receipt. Latest saved version does not, on its own, prove which deployment served a request. Do not turn this into a claimed deployment proof.

## 2. What exists, and what remains incomplete

| Capability | Source evidence | Assessment |
| --- | --- | --- |
| Guided Studio, nine case-type/playbook packages, AI graph proposals | `app/StudioGuidedWizard.tsx`, registry/playbook JSON, Studio AI modules | Existing web baseline; preserve and regress |
| Dossier lifecycle and readiness | `app/dossier-contract.v1.json`, `app/dossier-readiness*.ts`, transition routes | Implemented source, not a greenfield task |
| Documents, immutable versions and participant roles | Dossier document/version routes, R2 coordinator, participant routes | Existing pilot implementation |
| Evidence, human-reviewed AI proposals, snapshots and governed outputs | Evidence/proposal/snapshot/output routes and corresponding server modules | Existing implementation; do not label every feature production-verified without receipts |
| Matter UI | `app/matters/MattersClient.tsx` and view model | Real API-connected workspace; complete current UX acceptance later |
| Portrait graph pagination | `app/report-graph-layout.ts`, `app/report-graph-pdf.ts`, v62 graph document and tests | Implemented; verify regressions instead of rebuilding |
| PDF/DOCX input analysis | Upload policy returns `not_extractable` / `PARSER_NOT_APPROVED`; TXT/Markdown have deterministic UTF-8 extraction | File retention is not successful PDF/DOCX analysis; OCR remains deferred |
| Tenant foundation | PR #43 has 21 changed files, including tenant/OIDC modules, policy, tests and Flutter context coordinator | Substantive code exists, but Phase B is incomplete |
| Tenant persistence and production wiring | PR #43 evidence: B2 blocked; B3–B7 reference implementations; B8 integration incomplete | Complete only after source/CI recovery |
| Confidential client documents | Existing synthetic/de-identified pilot restriction; no verified confidential activation | Remains outside this task |
| Commercial readiness | No user-test, payment or retention evidence was established by this audit | Prepare a controlled ERP pilot after the technical acceptance gate |

Dossier Scenario A uses route-level integration with Miniflare D1/R2; other scenario tests include pure-domain checks. This is useful engineering evidence, but it is not five independent browser journeys or five professional-user trials.

## 3. Revised plan

| Order | Work package | Exit evidence |
| --- | --- | --- |
| P0 — today | Restore complete repository composition and reproducible CI | One implementation draft PR; exact source receipt; web, Rust, mobile and PDF gates with honest statuses |
| P1 — next, after P0 | Integrate Protected Tenant Foundation into existing dossier routes and storage | Forward-only migration; real durable adapters; tenant denial tests; usable web/Flutter organization flows |
| P2 — after P1 / applicable pilot gate | Verify one ERP incident & solution dossier end to end | Create → source versions → evidence → decision graph → review → PDF/JSON → reopen; five recorded journeys |
| P3 — following week, readiness permitting | Observed professional pilot | Five target professionals, measured completion and report-preparation time, actionable feedback |
| Later, separately gated | Confidential ingestion, PDF/DOCX extraction/OCR, governance activation and enterprise operations | Dedicated implementation and privacy/security evidence, not an expanded claim for the pilot |

Use one ERP flagship first. Legal/tax and training remain secondary regression/content tracks; do not add more case types today. Quantitative commercial targets remain hypotheses until measured. Do not publish private founder pricing, ARR goals, partner names or equity strategy.

## 4. P0 execution — restore the complete baseline

### 4.1 Preflight and reconciliation

1. Fetch current main and PR metadata; record repository, worktree, HEAD, tree, parent SHAs, applicable AGENTS.md, locks and tools.
2. Keep all pre-existing user changes. Use an isolated worktree/branch; do not force-push, rewrite recovery commits or erase work.
3. If main advanced, inspect the delta. A reviewed, ordinary descendant or this instruction-only commit is not automatically an error. Re-anchor evidence to the actual starting commit. Stop only the affected operation if unrelated or conflicting changes make the source ambiguous.
4. Resolve the reported `4fea303...` from an actual local checkout or attributable bundle if available. Verify its parents and changed paths before reuse. If unavailable, reconstruct an explicitly new restoration from reachable GitHub history. Do not fabricate the old SHA or spend the day repeatedly searching for an inaccessible commit.
5. Keep a compact reconciliation ledger: source SHA, source path/blob/mode, target path, decision and reason. Record collisions, not just successful copies.
6. Read the original Phase A contracts and v64 architecture documents from `c088200...` because current main no longer contains them. Preserve the accepted security boundary and deterministic Rust authority.

### 4.2 Composition decision

Prefer the smallest additive integration from `2803946...`:

- Keep the recovered web application at root for this restoration.
- Restore Rust workspace manifests/lock/toolchain, crates, canonical content, Flutter/mobile, shared contracts, required native scripts and CI from verified `c088200...` history.
- Restore relevant architecture/progress documentation without replacing current web documentation or this newer daily directive with stale copies.
- Do **not** copy old `apps/juris-web` over the recovered root web app or introduce a second writable web implementation.
- Audit dotfile collisions, especially Git attributes/ignores; changes must preserve LF bytes and web build behavior.
- Exclude old generated `dist/` build output from indiscriminate restoration. If a tracked artifact is an actual source input, document and validate that specific dependency.
- Preserve the recovered web files and PR #45 dependency remediation. Do not bring back the older PR #43 package lock wholesale.
- Document how the parity scripts resolve web root, mobile root and exact heads. Change only paths needed for the chosen composition.
- Do not replace or relax the immutable PR #45 provenance verifier to make it accept a different integration tree. It remains a verifier for its historical approved scope; add a separate integration receipt/check if needed.

If root web plus the restored native workspace exposes a real tool dependency conflict, document and solve it in this PR with a minimal path/build adjustment. A repository-wide web relocation is a separately reviewed topology change, not today's default.

### 4.3 Migration preservation

For P0, do not change application migrations.

- Keep the recovered SQL, snapshots and journal through 0018 byte-identical.
- Explicitly mark the PR #43 `0016_tenant_control_plane.sql` as an unregistered colliding candidate.
- The next available slot at audit time is 0019. Recheck the journal when P1 begins.
- P1 must regenerate/reconcile a forward-only migration against the recovered dossier schema, not merely rename the old SQL.
- Never invent duplicate dossier aggregates or edit a migration already used by a saved/released baseline.
- Backfill must not infer organization authority from email domains or free-text profile fields.

### 4.4 Reproducible tools and CI

Restore existing gates and add the missing web/PDF gates in the implementation PR. Do not weaken branch protection, exclude failing paths, fabricate status contexts or mark skipped evidence PASS.

Known tool issues to resolve:

- The old Rust workflow uses floating stable and omits `--locked` from most quality commands. Pin a verified working Rust toolchain, retain the documented Rust 1.78 MSRV check and use locked dependency resolution throughout.
- Flutter jobs currently follow floating stable with ordinary `pub get`. Earlier passing evidence identifies Flutter 3.44.8 / Dart 3.12.2, while later 3.47.2 introduced formatter, lock and golden changes. Verify the SDK against committed locks and fixtures; record the chosen exact SDK revision consistently across UI/Android/iOS jobs.
- Require lock enforcement and unchanged lockfile checks. Do not refresh legacy goldens or mass-format 97 files to conceal toolchain drift.
- Retain the recovered package-lock and deliberate dependency overrides. PR #45 recorded Node 22.23.2 / npm 10.9.8; verify available reproducible versions and record them. Use the repository install wrapper on Linux; identify a platform fallback honestly.
- PDF CI must execute the existing report verification path with Poppler text extraction/rendering and publish relevant test artifacts. Merely generating a PDF is insufficient.

Capture the checked-out SHA and tree inside each job. Distinguish pull-request merge-ref results, direct head results and later post-merge results. Required checks on the final implementation head must be attributable; old PR #44/#45 runs are supporting history only.

## 5. P0 acceptance matrix

Discover repository commands and reuse them rather than inventing parallel test systems.

| Gate | Required evidence |
| --- | --- |
| Composition | Web baseline preserved except reviewed tooling/path deltas; required Rust/mobile/contracts/workflows present; clean scoped diff |
| Web | Strict typecheck, lint, build and complete existing test suite; no silently dropped tests |
| Dependencies | Lock-driven install, unchanged tracked locks, full and production audit results with stated scope |
| Rust | `cargo fmt --all -- --check`; locked check/Clippy/tests; warnings denied; documented MSRV preserved |
| Flutter | Exact SDK/revision; lock enforcement; no-write format, analyze, full tests, deterministic bundle check |
| Native | Existing Android and iOS build/FFI/lifecycle gates on the candidate; simulator evidence described as simulator evidence |
| Cross-runtime | All nine registry/playbook packages and the existing 18-route matrix agree with exact restored source references |
| PDF | Whole A4 portrait nodes; measured wrapping; semantic paired connectors; node/edge register; Bhopal and bilingual cyclic stress renders inspected |
| Existing UX | New empty draft starts at Step 1; same-tab sign-in/save; stale chunk recovers once; anonymous local PDF remains available |
| Migrations | Frozen recovered chain unchanged; no accidental registration of PR #43's colliding 0016 |
| Scope | No Phase C activation, confidential uploads or identity/secret changes; deploy only the verified recovery source to the existing Site |

Do focused checks during implementation and one complete required gate sequence on the final candidate. Broaden or rerun only for changed code, a concrete remaining failure or a required final-head gate.

If hosted checks cannot run, return the exact missing capability with reproducible local evidence and preserve a draft PR. Missing checks are BLOCKED, not PASS. Continue independent local verification and the pilot acceptance specification; do not stop all useful work on a provider metadata limitation.

## 6. P1 handoff — tenant completion after P0

Keep PR #43 as reference until its integration strategy is explicit. Do not directly merge its old root layout and stale lockfile into recovered main.

Preferred follow-on: a clean descendant branch of the integrated baseline, selectively bringing forward attributable Phase B changes. Preserve PR #43 history; do not close/delete or force-update PR #43/#44 as routine cleanup.

| Phase B gap | Required follow-on implementation |
| --- | --- |
| B1/B2 migration and tenant binding | Generate after current journal max; bind existing dossiers, document versions, assertions, packages, outputs, jobs, locators and audit to trusted tenant authority; test fresh and upgrade paths |
| B3/B4 policy and lifecycle | One server composition entry; durable repositories; server-resolved actor, tenant and time; transactions/CAS; invitations and organization/dossier roles remain distinct |
| B5 OIDC | Verify discovery/JWKS/signatures/token exchange and secure session integration; preserve state/nonce/PKCE/replay protection and original browser/tab return |
| B6 resource/key boundary | Real adapter interfaces and failure behavior; durable manifests/rotation where in scope; unavailable provider configuration stays feature-off, without simulated enterprise-readiness claims |
| B7 receipts/isolation | Persist authoritative receipts; deny cross-tenant object, search, pagination, cache, upload, download, job and export access; test revocation and stale authority |
| B8 web/mobile | Organization selection, invites, membership and actionable errors integrated into real UI; tenant-keyed cache invalidation; EN/RU and accessibility checks |

Resolve the frozen organization lifecycle versus internal `closing` state explicitly: either make it a private operational state with a validated projection or propose a versioned contract amendment. Never silently expand a frozen public enum.

Organization roles do not replace dossier roles. Compliance-export authority stays separate from ordinary owner/contributor/reviewer/viewer rights. AI proposals cannot grant access or become accepted evidence without professional review.

## 7. Pilot acceptance specification to prepare today

Prepare the checklist and synthetic fixtures now; execute browser/user acceptance when the integrated build is ready. Build on existing tests rather than duplicating their logic.

Use one ERP incident & solution dossier, for example a synthetic D365 batch/reconciliation incident, with three to five clearly synthetic documents, an expected evidence map, two solution alternatives and a controlled report.

| Journey | Observable result |
| --- | --- |
| 1. Create and resume | Create dossier, set lifecycle and missing inputs, sign in/save, reopen the exact state |
| 2. Source versions | Add a source and revised version; old evidence remains attributable; new information updates readiness and report freshness |
| 3. Reviewed decision | Inspect a source anchor, review AI/manual proposal, connect accepted evidence to a versioned graph, generate snapshot-bound output |
| 4. Roles and isolation | Reviewer approval succeeds only for an authorized current output; viewer/foreign participant access is denied; later organization tests use two actual test tenants |
| 5. Export and restore | Portrait PDF, JSON/manifest and reopened package preserve references; repeat anonymous legacy PDF; check the supported phone workflow |

Show lifecycle status and computed readiness separately. Preserve the current navigation direction: My cases / Templates / Documents / Tasks & reviews / Reports; inside a dossier, Overview / Documents / Evidence / Decision map / Tasks / Reports / Audit. Hashes, schema IDs and technical receipts belong in Developer View or explicit audit details.

Record actual duration, assistance needed, errors, ability to locate the controlling evidence and whether the reviewer understands the report. A useful first pilot target is 4/5 completed journeys without a blocking defect and no unauthorized access; repeat-use intent and about 25% less review/report preparation time are hypotheses to measure, not claimed benefits.

No autonomous outreach or real customer-data upload is included in this instruction.

## 8. Delivery and release boundaries

The current successful output includes the verified recovery deployment authorized above. Phase B remains a separate milestone and must not be presented as complete.

Provide:

1. Starting/final SHA and tree, PR URL, exact restored paths/source receipts and a concise implementation summary.
2. A matrix with PASS / FAIL / BLOCKED / NOT RUN, command, toolchain, tested SHA/tree, run/artifact links and remaining gaps.
3. Updated current progress and roadmap entries that supersede stale v53/v61/v62 headlines without rewriting historical receipts.
4. A P1 backlog tied to actual routes/adapters, not a generic list of features already present.
5. The ERP pilot checklist and synthetic fixture locations.
6. The precise next release action, if ready, tied to the actual saved candidate and applicable authorization.

The owner's later request authorizes the recovery merge and Sites save/deployment after all mandatory gates. Production data migrations, identity/secret changes, confidential-data activation and app-store distribution remain outside scope. Claim a public release only after the provider confirms it succeeded.

Do not invent Site 70 or a new product version. Read the available version state when the later release is actually requested. A future successful deployment produces its own prospective provider receipt and cannot retroactively prove the missing Site 69 deployment. Preserve the historical evidence gap and the existing release gate; it does not prevent reversible source restoration.

Avoid another approval loop for ordinary discovery, isolated fixes and verification already within the assigned task. If a genuinely external permission or unavailable provider is the only blocker, finish the reviewable result first and name that specific remaining action.

## 9. Source references

- [Audited main tree](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/tree/280394640f0fc4d2a87e098edd6d34001393c557)
- [PR #45 recovery and validation receipts](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/45)
- [PR #43 tenant foundation](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/43)
- [PR #43 Phase B evidence at the observed head](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/blob/2f6e545b70a39c3fda4aa3b71ca380799e7c52a8/docs/architecture/v64/PHASE-B-EVIDENCE.md)
- [Earlier complete source for restoration](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/tree/c088200138332cd212b87e266746ea85b53a2f77)
- [Current Matter UI](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/blob/280394640f0fc4d2a87e098edd6d34001393c557/app/matters/MattersClient.tsx)
- [Current input extraction policy](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/blob/280394640f0fc4d2a87e098edd6d34001393c557/app/dossier-security.ts)
- [Current dossier acceptance tests](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/blob/280394640f0fc4d2a87e098edd6d34001393c557/tests/dossier-e2e.test.ts)

The source audit inspected repository objects, code, tests and receipts; it did not rerun the application suite, simulate a production deployment or observe real professional users.
