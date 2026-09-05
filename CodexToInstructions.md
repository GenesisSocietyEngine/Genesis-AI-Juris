# Genesis: Juris — Codex instructions for 5 September 2026

## Outcome and scope

**Prepared:** 2026-09-05, from a read-only GitHub and Sites audit.  
**Repository:** GenesisSocietyEngine/Genesis-AI-Juris  
**Planning track:** v64 integration recovery, followed by Protected Tenant Foundation.  
**Product language:** English by default; preserve Russian parity.  
**Today's deliverable:** one reviewable implementation PR that restores the complete source tree and reproducible CI while preserving the recovered Site 69 web baseline.

Turn an unstructured professional matter into a **versioned, explainable, testable and reusable decision package**.

Matter/Dossier functionality already exists in the recovered web source. Do not restart the August dossier MVP or repeat v60/v61 implementation. The immediate task is to restore integration integrity, then finish tenant isolation around that existing functionality.

This file is an execution brief. Publishing this instruction-only draft PR does not implement the recovery or start a Codex run. When assigned the execution task, proceed through discovery, reversible implementation, local commits and a reviewable implementation draft PR under the existing repository permissions. Preserve action-specific merge/deployment boundaries; an approval for an old exact head is not approval for a new release.

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
| Scope | No Phase C activation, confidential uploads, production resource/secret changes or deployment |

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

Today's successful output is an integrated, reviewable candidate, not a promise to complete all of Phase B and deploy by tonight.

Provide:

1. Starting/final SHA and tree, PR URL, exact restored paths/source receipts and a concise implementation summary.
2. A matrix with PASS / FAIL / BLOCKED / NOT RUN, command, toolchain, tested SHA/tree, run/artifact links and remaining gaps.
3. Updated current progress and roadmap entries that supersede stale v53/v61/v62 headlines without rewriting historical receipts.
4. A P1 backlog tied to actual routes/adapters, not a generic list of features already present.
5. The ERP pilot checklist and synthetic fixture locations.
6. The precise next release action, if ready, tied to the actual saved candidate and applicable authorization.

No product merge, Site save/deployment, production data migration, identity/secret change, confidential-data activation, app-store distribution or public release claim follows merely from this planning document.

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
