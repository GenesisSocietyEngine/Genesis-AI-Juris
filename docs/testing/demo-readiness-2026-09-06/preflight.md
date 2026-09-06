# Demo readiness preflight — 6 September 2026

**Entry gate: BLOCKED. No product feature work has started.**

This is the current Demo Readiness checkpoint for the assigned Roman Ulyanov brief. It supersedes old execution directions, while preserving their historical receipts. Read [the live plan](plan.md) before resuming. Observation window: 2026-09-06, approximately 11:09–11:18 UTC. Later external changes require a fresh check.

## Source and preservation

| Item | Observed |
| --- | --- |
| Original checkout | C:\PROJECTS\Genesis-AI-Juris |
| Original branch | feat/professional-product-ui-redesign-pilot-v2 |
| Original SHA | 6ca50f24ab3a763ac80e5cd221c15db4a7592fd8 |
| Original tree | 0290818978f81531878513350383115fa7983504 |
| Pre-existing changes | Modified Cargo.toml and docs/development/CURRENT_PROGRESS.md; untracked .worktrees/ and error.log |
| Remote main, fetched and independently read through GitHub API | e025131d87e35d4364d542acc5c84b6097eb657b |
| Main tree | c47f1951d1573e8f72b6c7e6872239f8beb23c39 |
| PR49 tested head | 57786557f60c01fc7ad48e1cedc8ea5e9fe059aa |
| PR49 tested tree | c47f1951d1573e8f72b6c7e6872239f8beb23c39 — equal to main |
| Isolated integration branch | codex/demo-readiness-canopy-2026-09-06 |
| Isolated checkout | .worktrees/demo-readiness-canopy-2026-09-06, rooted in the main SHA above |
| New implementation | None; this checkpoint adds documentation and sanitized observations only |

The original checkout remains on its original branch and SHA. No reset, clean, stash, historical-PR modification, or alteration of user files occurred. Fetch advanced origin/main from the stale local 280394640f0fc4d2a87e098edd6d34001393c557. The existing sibling Genesis-AI-Juris-v64 checkout is heavily dirty and includes a conflicting, untracked tenant migration; it was inspected read-only and is not the accepted base.

No AGENTS.md was found in the accepted checkout or inspected ancestor directories. CodexToInstructions.md was read. The newly assigned brief overrides its superseded P0/P1 instructions.

## Sites, production and database truth

| Layer | Observation | Scope of proof |
| --- | --- | --- |
| Site project | appgprj_6a88a26d2f808191aa076b9fcd8dbce6 | Reused exact ID from .openai/hosting.json |
| Site | GENESIS: JURIS Web; active; public; current user owner | Live provider read |
| Saved version | 72 | Both list_site_versions and get_site_version |
| Saved version ID | appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_064892d51c548191bc0847f7f30d2004 | Exact opaque provider value |
| Saved source | e025131d87e35d4364d542acc5c84b6097eb657b | Matches main |
| Saved archive SHA-256 | 49f7ac7ec62dea70fa21c970d8148303b42f36c3af42286ef0f6dfd5878591c2 | Provider receipt; 26,245,120 bytes, 336 files; archive not downloaded anew |
| Active deployment ID | NOT VERIFIED | get_site/list_site_versions/get_site_version do not expose it; status tool requires an already-known ID |
| Active deployment status / provider deployment ID | NOT INDEPENDENTLY VERIFIED | PR49 receipt says succeeded but omits deployment ID |
| Active deployment exact server SHA | NOT VERIFIED | Saved source and client labels alone cannot establish current server identity |
| Configured environment revision | 33, updated 2026-09-01T20:03:40.672530+00:00 | Current environment configuration, not active-deployment env revision |
| Configured GENESIS_DEPLOYMENT_VERSION | 69 | Stale relative to saved version72 |
| Configured GENESIS_WEB_COMMIT | 6019e47346a2bf719a09dc1d874a2fc807f99598 | Source of saved version69, not current main |
| Configured GENESIS_PUBLIC_ORIGIN | https://studio.falcon-merlin.com | Matches current live URL |
| Active deployment env_set_revision | NOT VERIFIED | Requires current deployment status receipt |
| Custom domain | studio.falcon-merlin.com; provider, hostname and SSL status active | Read-only custom-domain provider response |
| Custom-domain public HTTP | 200 at 2026-09-06T11:15:33Z | HTML/network observation only |
| Product marker | data-genesis-juris-release="v62" | Current public HTML |
| Visible header copy in HTML | CASE STUDIO · ADVISORY · BETA v0.1.0 | Ambiguous product/build labels persist |
| D1 binding | DB | Live provider overview |
| Migration0019 objects | dossier_organization_bindings and dossier_organization_commitments exist with expected columns; both empty | Live bounded schema/row reads, not a complete migration receipt |
| Full migration journal, trigger/index/FK state and backup | NOT VERIFIED | Available database tools expose table names and bounded rows, not arbitrary SQL/schema inspection |

The database overview returned 50 exact table names, ending at dossier_status_application_commitments, with omitted_tables=0 and truncated=false. This does not establish that the other organization tables, migration journal or triggers are absent. Do not guess omitted identifiers in read_database_table_rows or claim full migration verification from two tables.

[PR49's release receipt](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/49#issuecomment-5553065966) records version72 succeeded and post-rollout organization tables. This is historical owner-reported deployment evidence, independently corroborated today for saved source and two live tables. Its active-deployment relationship is still unproven. P1 is main-integrated and exact-main CI-tested; full active server/database/browser activation is not yet established.

The configured labels have an identified code consumer: app/server-observability.ts:68–69. If the current Worker uses revision33, its telemetry identifies version69/source6019. This conditional inference is not proof that version69 is actually deployed.

Do not display "Professional Beta · Product v62 · Build 72" as verified until saved receipt, active deployment and domain probes reconcile.

## Rollback position

Saved version71 points to 5a5ce9b1afc3130c6c1dc55ccdc967902033f929; version70 points to 83c97a78547c131570df1b752814353ba0cb1fdb. These are historical versions, not approved compatible rollback targets for the P1 database.

Migration0019 adds immutable organization bindings, atomic binding/root requirements, membership and revision guards, lifecycle dual approval, and retained audit receipts. Its BEFORE INSERT guard means a pre-P1 application may fail new dossier creation even with empty organization tables. Once populated, old readers also lack current organization revocation/suspension scope checks. Thus "additive migration" does not establish old-application compatibility.

The safe strategy is forward repair on a verified P1-compatible source, retaining the tables, private objects, immutable history and audit. For a future Canopy candidate, saved version72 is the proposed same-schema fallback only after its active server/environment identity and supported journeys pass. There is currently **no independently accepted rollback target**.

Never redeploy Site63/70 on the strength of old runbook text, drop tables, or reapply migration0019 blindly. Any actual environment repair, route disablement, migration or deployment is a separately approved action.

## Hosted checks on the accepted base

All five workflows were re-read for head e025131d87e35d4364d542acc5c84b6097eb657b; all are completed/success:

| Workflow | Run | Evidence |
| --- | --- | --- |
| Root Web and PDF | 33976692995 | [Exact-main run](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/33976692995) |
| Rust CI | 33976692978 | [Exact-main run](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/33976692978) |
| Flutter Mobile UI | 33976692984 | [Exact-main run](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/33976692984) |
| Android Native FFI | 33976692960 | [Exact-main run](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/33976692960) |
| iOS Native FFI | 33976693017 | [Exact-main run](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/33976693017) |

Exact-main logs independently confirm:
- Web: 544 tests, 544 passed, 0 failed, 0 skipped; both audits reported 0 vulnerabilities.
- PDF: 47 PDFs, 702 pages, 702 PNG renders; frozen 55-PNG baseline passed. Baseline hash fbcc9a03d8a26b7076aa2504ac1adf28c28a4196806c9e2849bb6a6aba12f8bb.
- Flutter: 278 passed, 12 skipped. These skips are not passes.
- Build, strict typecheck, parity lock and lint steps succeeded.
- No full build, application tests or reports were re-run locally for this documentation-only checkpoint. No new human visual review is claimed.

## Exact-source reproduction contract

Use the current five workflow files, not commands copied from a dirty sibling checkout.

- Node 22.23.2 (.node-version), npm10.9.8 (.github/workflows/web.yml).
- Linux web: npm run install:ci; npm run typecheck; npm run parity:lock; npm run lint; npm test; npm audit --audit-level=low; npm audit --omit=dev --audit-level=low.
- npm test invokes the verified production build, followed by node --experimental-sqlite --import tsx --test tests/rendered-html.test.mjs tests/*.test.ts.
- Focused P1: node --experimental-sqlite --import tsx --test tests/p1-organization-erp.test.ts tests/dossier-persistence.test.ts.
- PDF: Windows win32/x64, pinned Poppler25.07.0 from .github/scripts/install-pdf-tools.ps1; npm.cmd ci and npm.cmd run reports:verify -- .artifacts/v62-report-qa. Preserve the existing baseline; REPORT_PDF_UPDATE_VISUAL_BASELINE must stay unset.
- Rust1.95.0: cargo fmt --all -- --check; cargo check --workspace --locked; cargo clippy --workspace --all-targets --locked -- -D warnings; cargo test --workspace --locked. MSRV check: cargo +1.78.0 check --workspace --locked.
- Flutter3.44.8 / Dart3.12.2, from apps/juris-mobile: flutter pub get --enforce-lockfile; check unchanged pubspec.lock; dart format --output=none --set-exit-if-changed lib test integration_test tool; dart run tool/export_mobile_case_bundle.dart --repo-root ../.. --check; flutter analyze; flutter test.
- Android/iOS require the exact workflow-native build, library/slice export checks and supported simulator/device steps in .github/workflows/android-native.yml and ios-native.yml.

scripts/verify-release.sh is a historical split-checkout umbrella requiring a locked older mobile checkout and Android device. It does not replace exact-main CI, browser or real-phone acceptance.

## Open work and historical instructions

GitHub read on this date found open PRs #44, #43, #32, #5, #4 and #2; issue #39. No PR, issue, review, branch or label was modified remotely. In particular, #43/#44/#32 are not merge shortcuts.

Historical directions to preserve but not execute:
- CodexToInstructions.md: old P1 branch/head, pre-final f74ce2f checks, unreleased claims and prior recovery instructions.
- CURRENT_PROGRESS.md: PR47/Site70 frontmatter, PR49 draft and P1-not-deployed prose.
- P1-ORGANIZATIONS-ERP-2026-09-05.md: "No production migration has been applied" was a pre-release checkpoint.
- V62-OPERATIONS-RUNBOOK.md and app/operations-runbook.ts: Site63 rollback advice is not accepted for the P1 database.
- BETA v0.1.0, product v62, playbook versions and saved build numbers identify different things.

## Acceptance and artifact inventory

| Category | Status at this handoff |
| --- | --- |
| Implemented | Local preflight, live plan and sanitized evidence; isolated exact-main branch |
| Reused / inspected | Existing organization/dossier APIs, migration contract, hosted full gates, ERP acceptance inventory |
| Tested | Previously executed exact-main hosted results verified above; local documentation hygiene only |
| Visually inspected | No fresh browser or PDF visual inspection |
| Deployed | No action in this sprint; active publication independently unverified |
| Observed with users | 0 cold-user observations; no metrics claimed |
| P1 two-user authenticated path | NOT RUN; synthetic identities pending, connected Chrome/Edge unavailable |
| Browser hydration / auth return / private denial / keyboard / 200% / EN/RU | NOT VERIFIED in browser |
| Phone/browser handoff | NOT RUN |
| Canopy fixture D01–D09 and immutable versions | NOT CREATED; awaiting P0 entry gate |
| Canopy scenarios / anchors / reports / reset | NOT IMPLEMENTED or tested |
| Reliability | 0/10 candidate runs executed; not 10 failures |
| PDF/JSON, backup video, screenshots | No accepted Canopy artifacts; no recording fabricated |
| Presenter script / frames / pilot hypothesis | Pending P5; this checkpoint is not a meeting package |
| Signature Crop | Not started; optional primary-case gate remains closed |
| ERP fallback | Existing docs/testing/erp-pilot-2026-09-05/ inventory inspected: three Markdown sources, D365 studio draft, existing failed_erp case/scenario. Hosted API tests are green; no new browser/fallback rehearsal. Preserve those fixture semantics. |

Sanitized provider/GitHub observations are in evidence.json. Artifact checksums are in SHA256SUMS.txt; no token, cookie, signed URL, private browser state, raw recording or oversized binary belongs in this checkpoint. The final local commit/SHA/tree is recorded in the handoff outside these self-referential files.

## Exact blockers and resumption

1. **P0-01 — active deployment identity unavailable.** Obtain the current deployment ID from the Site publication history or a provider receipt. Read get_deployment_status using that exact ID; record version_id, status, provider_deployment_id, env_set_revision and URL. Do not substitute the historical Site70 ID.
2. **P0-02 — configured release identity is stale.** Once P0-01 proves active version72/sourcee025, prepare the bounded change GENESIS_DEPLOYMENT_VERSION=72 and GENESIS_WEB_COMMIT=e025131d87e35d4364d542acc5c84b6097eb657b, preserving all other variables. Obtain the brief's explicit environment/deployment approval immediately before applying the reviewed action. No change is authorized by elapsed time or this proposed payload.
3. **P0-03 — full production migration and rollback acceptance incomplete.** Use supported provider schema/migration/backup inspection to confirm journal0019, all expected objects and guard/consistency state. Do not manually modify DB data. Select and verify the P1-compatible recovery position.
4. **P1-01 — supported browser/identity setup unavailable.** CUA inventory returned no browsers; Chrome and Edge tab creation each returned "Browser is not available". This is a controller-availability result, not a browser product failure. Two synthetic identities and connected browsers are needed after P0.
5. **P5-01 — actual humans/device required.** Three people who did not build the feature and the presentation phone/device must participate before those acceptance rows can pass. Agents or synthetic transcripts cannot substitute.

Stop follows the assigned brief sections3,8/P0,18 and20, not an inferred skill approval rule. All unaffected read-only checks and documentation were completed. No approval to push, update PRs, merge, apply migrations, change environment or deploy has been requested or consumed.
