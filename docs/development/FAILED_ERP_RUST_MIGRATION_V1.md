---
document_type: development_checkpoint
project: "GENESIS: JURIS"
checkpoint: failed_erp_authoritative_rust_v1
status: merged
branch: refactor/failed-erp-authoritative-rust
base_commit: 3c27eb2782a61662d7ceffbd19e5434bce389470
implementation_head: 6a27e53549b06911e81fe8c9a61eae3e814fca30
publication_pr: 14
published_head: 0aa393096f1e9be4458070d3d53d739c1f8483c0
merge_commit: 3cfa3066b64f36b92f3a77a30ec4a070e74860ed
scenario_id: be_commercial_failed_erp_001
scenario_fingerprint: ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8
last_updated: 2026-08-04
---

# Failed ERP Authoritative Rust Migration v1

## Status and stop boundary

Failed ERP is implementation-complete, published through PR #14 at exact head
`0aa393096f1e9be4458070d3d53d739c1f8483c0`, and merged into `main` by
`3cfa3066b64f36b92f3a77a30ec4a070e74860ed`. It is catalogue position 1 in
the combined five-case production catalogue and uses the same generic
`ScenarioDefinition v1` Rust runtime as Logistics, GreenFire, GoldenShell, and
Desert Water.

No tag, release, or APK asset was created for the Failed ERP merge. PR #4 was
not modified or closed. Snapshot Visibility Hardening, Pressure & Countermove
Runtime, Legal Theory, and later roadmap work were not started.

Desert Water is rebased locally on the PR #14 merge and remains unpublished on
`feat/desert-water-case`. The recovery ref
`backup/desert-water-pre-failed-erp` still points exactly to original head
`44e565b22c52a4c3a3e69b2c137353b7771fcf77`.

## Repository and intentional commits

The migration branch and merge base are:

- branch: `refactor/failed-erp-authoritative-rust`;
- exact base and merge base:
  `3c27eb2782a61662d7ceffbd19e5434bce389470`;
- implementation HEAD before this documentation commit:
  `6a27e53549b06911e81fe8c9a61eae3e814fca30`.

The migration consists of seven completed commits:

1. `f898d09232b51aa1d7bdcce0208ed7a93a76462b` —
   `docs/test: characterize legacy Failed ERP behavior`.
2. `a26bb58d5d0ca7a5dc0149011206fd261874978f` —
   `feat(runtime): add generic deterministic metrics and resource projection`.
3. `8442b9bf42f2ac03c5a4e25f7bc005e543e3ee33` —
   `feat(runtime): add relative timing and completion deadline constraints`.
4. `e61d68a6bf88556f7aeded3239b16a297341ef2c` —
   `feat(scenarios): migrate Failed ERP to authoritative Rust`.
5. `33dc65f3ff1c6d042a2787fc54de9045126e7b74` —
   `refactor(mobile): remove Failed ERP Dart gameplay authority`.
6. `6a27e53549b06911e81fe8c9a61eae3e814fca30` —
   `test: cover Failed ERP replay dossier persistence and Android lifecycle`.
7. `0aa393096f1e9be4458070d3d53d739c1f8483c0` —
   `docs: record Failed ERP Rust migration checkpoint`.

PR #14 preserved all seven intentional commits and merged them normally in
`3cfa3066b64f36b92f3a77a30ec4a070e74860ed`.

## Behavioral authority and approved corrections

`DemoGameRepository` was characterized before replacement because it was the
behavior users actually played. The old
`content/cases/failed_erp.json` template remains migration provenance and does
not override observed behavior. In particular, the production settlement is
EUR 64,500, not the template's EUR 60,000.

Parity preserves:

- Asteron Systems NV as claimant/buyer and player client;
- Northbridge Consulting BV as defendant/supplier;
- catalogue position 1 and sort order 10;
- public case and scenario ID `be_commercial_failed_erp_001`;
- EUR 240,000 claimed loss;
- the 37 executable legacy actions, their order, economics, score rules, and
  deterministic decision formulas;
- action availability driven by merits, evidence, procedure, leverage,
  ethics, trust, fatigue, and strain;
- valid monotonic event timing and the substantive player-facing outcomes.

The following authorized defect corrections are explicit and tested:

- the erroneous Northbridge player-client identity is corrected to Asteron;
- `failed-erp-implementation` is not a production runtime or persistence
  alias;
- displayed 30-minute terminal actions consume their full 30 minutes before
  closure;
- time is forward-only, rolls across midnight, and processes every crossed
  boundary;
- opt-in procedural completion must occur by the deadline; exact-due
  completion succeeds and due-plus-one is rejected atomically;
- Rust projects spend, budget, billable time, and metrics instead of Flutter
  substituting zero values or elapsed clock time;
- adverse decisions remain open while an executable remedy exists;
- limited cassation review and remittal are non-terminal;
- exactly two zero-time continuation actions were added to avoid legally open
  dead ends: `continue-limited-cassation-review` and
  `continue-remitted-rehearing`;
- the complete gameplay presentation has EN/RU overlays with identical stable
  IDs and ordering.

The legacy Dart repository remains in source control only as a characterization
fixture for historical widget and parity tests. The production catalogue,
`CaseRuntimeFactory`, and `JurisApp` no longer import or select it.

## Generic runtime extensions

No generic Rust source, JSON bridge source, C ABI source, or Flutter mapper
contains a branch for `be_commercial_failed_erp_001`.

The optional, ID-agnostic additions are:

- a civil `initial_clock` baseline while snapshots retain elapsed minute zero;
- canonically ordered integer `numeric_metrics`, `foreground_metric_rates`,
  and `initial_resources`;
- generic integer conditions and set/add resource and metric effects;
- per-action `cost_eur` and `billable_minutes`;
- explicit deterministic decisions resolved once by an ordinary effect from
  stable seed, scenario fingerprint, and decision ID inputs;
- forward-only `RelativeTimeDefinition` targets for deadlines, tasks, events,
  and action completion;
- opt-in `completion_deadlines` with per-deadline
  `completion_at_due_allowed` behavior;
- generic semantic presentation tags and projected Inbox resolution action
  IDs, so Flutter does not parse localized titles or case-specific IDs;
- a cycle-safe deterministic effect closure in validation, including
  branch-correlated terminal analysis.

Existing scenario JSON omits these optional fields and therefore serializes
and fingerprints exactly as before. Metrics, resource totals, resolved timing,
and deterministic-decision caches are replay-derived. They are projected in
snapshots but are intentionally excluded from the existing final-state digest.
Branch decisions still materialize through digest-covered flags, stages,
deadlines, judicial state, and outcomes.

## Production scenario inventory

The production definition contains:

- 21 stages;
- 39 actions: 37 characterized legacy actions plus 2 lifecycle corrections;
- 13 deterministic decisions;
- 9 deadlines;
- 2 asynchronous tasks;
- 34 Inbox definitions;
- 66 events;
- 9 terminal outcomes;
- 12 actors;
- 8 facts and 5 evidence items;
- 19 integer metrics and 5 resource keys.

The first authoritative Failed ERP fingerprint is:

`ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8`

There was no earlier authoritative Failed ERP fingerprint to preserve.

## Canonical traces and lifecycle matrix

Three checked-in canonical command traces provide the principal handoff paths:

| Path | Seed | Commands / transitions | Final minute | Final state | Resources: budget / award / billable / costs / spend | Final digest |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Settlement | 20260724 | 3 / 9 | 570 | closed; `settlement_64500` | 25000 / 64500 / 540 / 0 / 2350 | `fd77a45422e4abd7f141fc7b1db767524ebf48d9674bd25c21354fb7a2b8c029` |
| Prepared litigation | 6 | 26 / 52 | 8640 | closed; `judgment_preserved_after_cassation` | 50000 / 220800 / 2940 / 18000 / 28200 | `f25604fc0225d7ac5a7e98d192ce3b82114970158a3662aee7575b128430ca0c` |
| Remittal | 28 | 29 / 62 | 10080 | open `post_judgment`; no outcome | 50000 / 0 / 2940 / 0 / 28200 | `268f27867fd1f45a417c0e999819165bd79f76a74f3ab2e65ee075e193cbc34a` |

`content/traces/failed_erp_lifecycle_matrix.json` records the exact seed,
ordered commands, minute, stage, result, decision instance, lifecycle,
outcome, resources, digest, open deadlines/tasks, and action-required Inbox
set for 18 explicit states:

- 10 closed traces cover every one of the 9 declared terminal outcome IDs;
- 8 open traces cover first-instance win/mixed/loss, appeal loss, limited
  review, claimant remittal, counterparty remittal, and return to first
  instance;
- every closed trace has zero available actions, open deadlines, active tasks,
  or unresolved action-required Inbox items;
- dispatch and time advance after closure both return `scenario_resolved` and
  preserve snapshot, command log, save envelope, and digest;
- the characterized statement-of-claim miss is the final cure-expiry boundary.
  No executable cure existed in the legacy game, so no fictional cure action
  was added.

The settlement deadline at Day 2 17:30 and statement deadline at Day 4 17:00
remain static because the executable Dart behavior hard-coded those dates.
Generic relative timing is used only where the characterized behavior was
actually relative.

## Dossier v1

The authoritative fact inventory is exactly:

- `contract_in_force`;
- `go_live_failure`;
- `claimed_loss_240000`;
- `scope_change_responsibility`;
- `supplier_delay_notice`;
- `acceptance_status`;
- `material_supplier_breach`;
- `loss_causation`.

The authoritative evidence inventory is exactly:

- `erp_implementation_contract`;
- `change_request_register`;
- `project_email_correspondence`;
- `acceptance_record`;
- `independent_expert_report`.

Initially, only the first three facts and the ERP contract are present. The
document-review actions reveal the change register, correspondence, acceptance
record, and their related facts. Reviewing the completed expert work reveals
the expert report, material breach, and causation. Unknown facts and evidence,
including their IDs, are absent. Relationships are emitted only when both ends
are visible. Save/load re-derives the exact sorted projection without storing
or duplicating Dossier state.

## Persistence and compatibility

The legacy Dart Failed ERP repository advertised no persistence API, accepted
no save store, and had no serializer or command log. Consequently there is no
supported legacy Failed ERP save to migrate and no heuristic importer was
added.

New Failed ERP saves use the existing contracts unchanged:

- schema ID `genesis.ai-juris.command-log`;
- envelope schema version 1;
- exactly eight envelope fields;
- runtime marker `scenario-runtime-v2`;
- definition fingerprint validation;
- existing final-state digest profile;
- only accepted `dispatch` and `advance_time` commands.

Settlement, prepared-litigation, remittal, and expert-review saves reproduce an
equal snapshot, command log, Dossier, digest, and byte-identical re-save. Bad
JSON, corrupted digest, and unsupported runtime markers return controlled
errors before a new session is published; the existing Rust registry and
Flutter `GameSnapshot` remain usable and unchanged.

## Existing production compatibility at the migration checkpoint

The three Rust scenario identities that pre-dated this migration remained
byte-exact:

| Catalogue position | Scenario | Fingerprint | Canonical paths |
| ---: | --- | --- | --- |
| 2 | `be_commercial_logistics_001` | `1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8` | `negotiated_recovery`: minute 270 / 3 transitions; `judgment_recovery`: minute 480 / 5 transitions |
| 3 | `greenfire_first_72_hours` | `b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261` | protected: minute 4440 / 26; compromised: minute 4590 / 21 |
| 4 | `goldenshell_recall_at_dawn` | `7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4` | coordinated: minute 4545 / 29; fragmented: minute 4710 / 23 |

Their definitions, fingerprints, traces, outcomes, costs, deadlines, final
minutes, digests, and relative catalogue order are unchanged.

The Failed-ERP-only four-case production bundle changed as expected:

- previous SHA-256:
  `8d9db2e75c5cac14df95073843cc5a0775df8d17323fb434c688a8854a012835`;
- current SHA-256:
  `afe93194de58761fe534a1b818968bc7a2b5bd931eba597ab03a06561733baf1`;
- current size: 479,920 bytes.

## Later combined five-case state

After PR #14 merged, the preserved Desert Water work was rebased locally. The
combined catalogue is:

| Sort | Scenario | Fingerprint | Canonical paths |
| ---: | --- | --- | --- |
| 10 | `be_commercial_failed_erp_001` | `ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8` | settlement: 570; prepared litigation: 8640; remittal open: 10080 |
| 20 | `be_commercial_logistics_001` | `1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8` | negotiated: 270; judgment: 480 |
| 30 | `greenfire_first_72_hours` | `b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261` | protected: 4440; compromised: 4590 |
| 40 | `goldenshell_recall_at_dawn` | `7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4` | coordinated: 4545; fragmented: 4710 |
| 50 | `desert_water_groundwater_claim` | `636e7b78ddccf01b23476e53ab77f3c8b0c82406be7c567afbd9f1edc41a28af` | coordinated: 3180; compromised: 3510 |

The deterministic combined bundle is 622,325 bytes with SHA-256
`58d90d7cc50b853c395e4defe43579b1c7b5d7f3ae12cb9cfe5ec2e22751c97a`.
Neither the Failed-ERP-only hash above nor the parked Desert-on-release hash is
the combined artifact.

Rebase validation exposed a validator analysis defect, not a scenario/runtime
defect. Commit `d7a52d836f4f51b9c510af38513bcb2722cbd6a2` preserves the condition of the
single event that owns an expanded terminal transition while keeping ambiguous
multi-terminal chains conservative. It changes no production scenario,
runtime execution, persistence, digest, bridge, FFI, or ABI contract.

Android acceptance then exposed stale x86_64 native output because Gradle did
not track changes in transitive Rust crates. Commit
`de7ac065d095a0e268e14961b4b74edd754cf52e` tracks workspace crate
manifests/sources and the native build script, and corrects Desert UI clock
assertions to the shared 08:00 presentation baseline. It changes no scenario,
runtime, persistence, digest, bridge, FFI, or ABI contract.

Final combined local results:

- Rust 1.78, formatting, current workspace check, and Clippy with warnings
  denied passed; full Rust workspace 312/312; focused engine 100, bridge 16,
  FFI 14, simulator 56, validator 49, diagnostics 28, and production catalogue
  integration 14 all passed;
- Dart format checked 49 files with 0 changes; Flutter analysis found no
  issues; Flutter unit/widget suite 133/133;
- final debug APK:
  `apps/juris-mobile/build/app/outputs/flutter-apk/app-debug.apk`,
  187,596,640 bytes, SHA-256
  `689b95b0da9f47bbe385bad9312a74b7625ad23860c0ea63113882f1611e3053`;
- Android 17 / API 37 (`Pixel`, `emulator-5554`, x86_64, 1080x1920) native
  integration 7/7, including Failed ERP and production Desert Water; the
  ordinary app displayed the five-case catalogue, opened Desert Water, returned
  to the catalogue, and remained running for owner playtesting;
- C ABI version 1; the exact stripped APK libraries for `armeabi-v7a`,
  `arm64-v8a`, and `x86_64` each dynamically export only
  `juris_mobile_bridge_execute`, `juris_mobile_bridge_string_free`, and
  `juris_mobile_bridge_abi_version`.

## Failed ERP checkpoint local validation evidence

All gates were run on the frozen scenario and implementation:

- Rust 1.78: `cargo +1.78.0 check --workspace --locked` passed;
- `cargo fmt --all -- --check` passed;
- `cargo check --workspace --locked` passed;
- `cargo clippy --workspace --all-targets --locked -- -D warnings` passed;
- full Rust workspace: 293 passed, 0 failed, 0 ignored;
- focused totals: engine 92, bridge 15, FFI 13, simulator 53,
  validator 45, diagnostics 27, case catalogue 14;
- Failed ERP formula/economic parity: 10/10;
- explicit lifecycle matrix: 2/2 tests over 18 manifest paths;
- deterministic bundle exporter `--check` passed;
- Dart format: 48 files, 0 changes;
- Flutter analysis: no issues;
- full Flutter unit/widget suite: 130 passed, 0 failed;
- `git diff --check` passed.

## Failed ERP checkpoint Android and native ABI evidence

The Failed ERP production acceptance test passed 1/1 on `emulator-5554`,
Android 17 / API 37. It exercised the real mobile asset, Rust Android library,
JSON bridge, C ABI, repository, mapper, and RU presentation.

The test proved:

- position-1 catalogue launch creates the Asteron claimant Rust session;
- RU matter, stage, action, outcome, and Dossier presentation uses the same
  stable authority as EN;
- `run-conflict-check` and `request-documents` produce exact spend, billable
  time, stage transition, and Dossier reveals;
- the v2 save has exactly eight fields;
- save -> reset -> load -> save is byte-identical;
- malformed load preserves the exact live Flutter snapshot and the session
  remains executable;
- `future-settle` reaches the EUR 64,500 settlement and authoritative closure.

The current unsigned debug APK was built for all production Android ABIs:

- size: 97,983,130 bytes;
- SHA-256:
  `501b84a01f96b425d25acb2f7e4174f03a39080b1ba94da851f43a707ed280fd`.

C ABI version remains 1. `llvm-nm` found exactly the same three named exports
in `armeabi-v7a`, `arm64-v8a`, and `x86_64`:

- `juris_mobile_bridge_execute`;
- `juris_mobile_bridge_string_free`;
- `juris_mobile_bridge_abi_version`.

No fourth native symbol or Failed ERP-specific native function was added.

## Remaining risks and deferred work

- `DemoGameRepository` and its older widget tests remain as historical
  characterization infrastructure. They are not reachable from the production
  catalogue or runtime factory. Deleting or rewriting that broad legacy test
  harness is a separate cleanup, not part of this migration.
- The old `juris-content` prototype still loads
  `content/cases/failed_erp.json` under `failed-erp-implementation`. That model
  is outside the production ScenarioSession/mobile catalogue and is not a save
  alias. Consolidating or deleting the prototype requires a separate audit so
  unrelated legacy CLI/domain behavior is not silently removed.
- The existing top-level snapshot arrays retain their compatibility behavior.
  Only the nested Dossier has the disclosure-safe absence contract; Snapshot
  Visibility Hardening remains deferred.
- PR #14 publication supplied the separate hosted Rust, Flutter, and iOS
  validation for exact Failed ERP head `0aa3930`. The unpublished combined
  Desert branch has no later hosted result.
- Desert Water is rebased as catalogue position 5 and the fresh combined local
  Rust/Flutter/APK/Android results above are complete. The branch remains
  unpublished during owner playtesting.
- The API 37 AVD showed slow post-install startup, one transient ADB offline
  state during recovery, and one Android `system` ANR dialog after repeated
  native runs. Choosing `Wait` recovered without an app crash or data wipe; AVD
  performance remains an environmental risk, not a waived product gate.

## Next authorized decision point

The combined branch is at its clean local-review stop and the ordinary
production application and Android API 37 emulator are running for owner
playtesting. The next action requires explicit publication authorization. Do
not push or open a PR for Desert Water, create a tag or release, delete the
backup ref, modify PR #4, or start a later roadmap phase without explicit
authorization.
