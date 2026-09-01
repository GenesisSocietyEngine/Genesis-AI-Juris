# GENESIS: JURIS v60/v61 release candidate — Platform stabilization and release readiness

## Release identity

This release candidate supersedes the earlier v0.6.0-alpha.1 checkpoint and
relabels the integrated product build as a proper v60/v61 candidate for
validation and deployment preparation.

The product is a release candidate, not a signed production Android or iOS
binary. The current tracked metadata is:

- Tag / release candidate: `v60-v61-rc.1`
- Flutter product version: `60.0.0+61`
- Rust workspace version: `60.0.0`

This is the release-candidate identity for the current GENESIS: JURIS product
source baseline and is intended to make the product state explicit before the
final deployment cutover.

## Included in the candidate

- Deterministic mobile bundle validation and authoritative fingerprint checks.
- Integrated Rust runtime, FFI boundary, and mobile-shell parity checks.
- Stable authoring, scenario, and publication integrity safeguards.
- Web deployment posture through ChatGPT Sites with the production-grade review
  and validation gates already defined in the repo.

## Verification expectations

The repository validates this candidate through the same gates already defined in
CI:

- Rust: `cargo fmt --all -- --check && cargo check --workspace && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace`
- Flutter: `cd apps/juris-mobile && flutter pub get && flutter analyze && flutter test`

## Deployment status

This is a release candidate for deployment preparation. It is not presented as a
final staged production binary or a signed store release.

## Included

- Persistent command-log save/load with `scenario-runtime-v2` compatibility,
  narrowly proven migration of compatible historical v1 saves, and controlled
  rejection of incompatible or unsupported saves without replacing the active
  Rust or Flutter session.
- Authoritative Matter Lifecycle in which judicial result and closure are
  independent, loss does not imply closure, remedies and their deadlines are
  Rust-owned, and explicit closure rejects later dispatch and time advance.
- Rust-owned `judicial_decision_instance` across runtime, bridge, persistence,
  deterministic digest, and EN/RU presentation.
- Authoritative Dossier Projection with Procedure, Facts, Evidence, and
  Deadlines/remedies, canonical ordering, disclosure-safe omission inside the
  nested dossier, and no parallel mutable state machine.
- EN/RU presentation parity by stable ID without localized-text inference.
- C ABI version `1` with exactly the existing three exports:
  `juris_mobile_bridge_execute`, `juris_mobile_bridge_string_free`, and
  `juris_mobile_bridge_abi_version`.

## Production catalogue at release preparation

The authoritative catalogue contains exactly four entries in deterministic
relative order. The first entry is the established legacy Dart demo and has no
`ScenarioDefinition` fingerprint or canonical Rust command trace; absence of
those two identities is preserved rather than represented by a fabricated
hash or runtime result.

| Position (`sort_order`) | Stable scenario/case ID | Public EN title | Public RU title | Canonical fingerprint | Deterministic canonical traces and final minutes |
|---|---|---|---|---|---|
| 1 (`10`) | `be_commercial_failed_erp_001` | Asteron Systems NV v. Northbridge Consulting BV — Failed ERP Implementation | Asteron Systems NV v. Northbridge Consulting BV — Неудачное внедрение ERP | Not applicable: legacy `demo_failed_erp` Dart adapter | Not applicable: no authoritative Rust scenario trace/final minute |
| 2 (`20`) | `be_commercial_logistics_001` | Velmont Logistics SA v. Orbis Retail Belgium NV — Unpaid Logistics Invoices | Velmont Logistics SA v. Orbis Retail Belgium NV — Неоплаченные логистические счета | `1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8` | `negotiated_recovery` at minute `270`; `judgment_recovery` at minute `480` |
| 3 (`30`) | `greenfire_first_72_hours` | Port Haven Environmental Authority v. GreenFire Industrial Solutions B.V. — The First 72 Hours | Port Haven Environmental Authority v. GreenFire Industrial Solutions B.V. — Первые 72 часа | `b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261` | `protected_crisis_position` at minute `4440`; `compromised_crisis_position` at minute `4590` |
| 4 (`40`) | `goldenshell_recall_at_dawn` (`case_id`: `nl_food_safety_goldenshell_001`) | GoldenShell Producers Cooperative U.A. v. MiteGuard Services V.O.F. — Contaminated Egg Supply Chain | GoldenShell Producers Cooperative U.A. v. MiteGuard Services V.O.F. — Загрязнение цепочки поставок яиц | `7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4` | `coordinated_claim_position` at minute `4545`; `fragmented_claim_position` at minute `4710` |

All four catalogue identities and their relative ordering are unchanged by
this release preparation. The three Rust scenario fingerprints, canonical
traces, outcomes, final minutes, content, balance, costs, actions, and
deadlines are unchanged. The legacy Failed ERP adapter identity and behavior
are also unchanged.

## Verification evidence

- Rust workspace: `217/217` tests passed, including engine, bridge, FFI,
  persistence, lifecycle, and Dossier coverage.
- Flutter: `113/113` tests passed; analysis reported no issues.
- Android native integration: `5/5` paths passed on Android 17 / API 37.
- Android acceptance covered reveal, adverse-but-open recovery, save/reset/load,
  remedy completion, explicit closure, and post-closure command rejection.
- Hosted iOS run
  [30858517073](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/30858517073)
  checked out exact merge SHA
  `9d1ad87961cabd61571fa59e1432d5c70c6d450c`, built the Rust static library
  and Runner, verified the three required native exports, booted an iPhone 16
  Pro Simulator, and completed the native Logistics lifecycle.
- Deterministic mobile-bundle SHA-256 remained
  `8d9db2e75c5cac14df95073843cc5a0775df8d17323fb434c688a8854a012835`.
- The unsigned validation APK was 192,458,673 bytes with SHA-256
  `9d402919ca9232ba255edafadbdce5c129bf4d31dc13bf93e49f34d8e5aedbdc`.
  It is not attached or presented as a production binary.

## Known risks

- Legacy top-level snapshot arrays may enumerate hidden definition-backed
  entities. Only the nested Dossier projection has the disclosure-safe
  omission contract.
- The additive nested Dossier member may require tolerant handling by external
  consumers that incorrectly assume a closed JSON object shape.
- Failed ERP remains a legacy Dart catalogue case rather than an authoritative
  Rust `ScenarioDefinition`; it therefore has no Rust fingerprint or canonical
  runtime trace to preserve.
- This is an alpha source checkpoint. No signed Android or iOS distribution
  artifact exists.

## Next checkpoint

Desert Water is planned as catalogue position five. Its isolated branch must
preserve all four pre-existing catalogue identities and relative ordering; it
must not invent a Rust fingerprint or canonical runtime trace for the legacy
Failed ERP case.
