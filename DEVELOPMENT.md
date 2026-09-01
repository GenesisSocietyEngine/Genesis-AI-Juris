# Local development

## Prerequisites

1. Git
2. VS Code
3. Rust installed through rustup
4. VS Code extension: rust-analyzer

Verify:

```powershell
git --version
rustup --version
rustc --version
cargo --version
code --version
```

## Quality commands

```powershell
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

## Project rule

Do not let an LLM or UI mutate `CaseState` directly. Convert intent into a `DecisionId`, validate it through `Simulation::available_decisions`, and apply it with `Simulation::apply`.

## v62 isolated milestone development — 2026-09-01

The v62 Professional Report Graph Pagination & Document Flow milestone starts from immutable v61 release evidence:

- web source `8bd10594bc01e5a45183a743396ac24b7aeaf321`;
- mobile `main` source `29f862649dea378cfe3d4e145f5e396bf6d4c6ff`, whose tree matches gated mobile head `3dff6146a1b8bbfdf37cf9751ffb157ffb2da4f8`;
- production marker `v61` at Site version 63 and deployment `appgdep_6a95f0f1a25881918a3d534044ebfd4d`.

Site version 63 is the rollback target. v62 work must remain isolated until every gate is green on exact reviewed heads.

### Architecture boundary

`ReportModel` schema 1 and the legacy semantic renderer `1.0.0` remain the content and fingerprint baseline. v62 adds `ReportGraphLayoutModel` as a deterministic presentation projection with layout schema 1, layout algorithm `1.1.0`, and layout renderer `2.1.0`. Pagination, page assignments, measured boxes, and off-page connectors must not enter the canonical case or alter `ReportModel` content fingerprints, route hashes, evidence, rules, decisions, or outcomes.

Rust remains authoritative for case validation and runtime semantics. Flutter may parse and validate immutable report packages and mirror layout semantics, but it is not a second rules engine. AI changes remain proposal-only and require explicit acceptance.

The mobile parity boundary currently includes:

- `contracts/report-profiles.v1.json` and the byte-identical Flutter asset;
- `contracts/report-manifest.v1.json` and the byte-identical Flutter asset;
- `ReportContract`, which rejects unknown IDs or versions, duplicate entries, invalid profile bindings, and incomplete coverage;
- exactly nine case packages, 19 report profiles, and 22 declared output bindings;
- report model schema 1, semantic renderer `1.0.0`, layout schema 1, layout algorithm `1.1.0`, and layout renderer `2.1.0`.

The mobile presentation mirror now also includes:

- immutable `ReportGraphLayoutInput` and `ReportGraphLayoutModel` values;
- exact-source 2048-UPM Roboto Regular/Medium advances, exhaustive positive
  shaping allowances, and maximum outline-ink reservations;
- integer-micrometre A4 portrait frames, whole-layer pagination, at most three lanes, and whole-node placement;
- deterministic weak components, longest-parent topological layers, and recorded cyclic repair;
- Unicode-scalar measurement, cluster-safe wrapping, and full-detail references without ellipsis;
- same-page edge anchors plus paired, compact `C###:OUT` / `C###:IN`
  continuity connectors with seven deterministic route lanes per page side;
- complete node, adjacency, connector, root, terminal, and disconnected-component text records;
- canonical layout serialization and SHA-256 fingerprints identical to the web evaluator for all seven locked fixture families.

The two report-graph assets are byte-pinned:

- `report-graph-font-metrics.v1.json`: SHA-256 `dce864593f4230771a0466e73eec1f7f2cf3a1024bcc83580975d4e1fefe7dda`;
- `report-graph-layout-fixtures.v1.json`: SHA-256 `7f71a976872aa7266a7c360529430b9bdc6c2978368917bc0d61c0e3a33e249f`;
- `report-manifest.v1.json`: SHA-256 `261ff3984e2e73a52f1bf672f94a7e6b0312c1f5d5a228b5e372ec5c885de5f3`.

This contract still does not claim that Flutter renders professional PDF bytes. Flutter mirrors the deterministic presentation semantics and may consume the model, while the v62 web renderer remains responsible for the release PDF.

### Required v62 quality commands

```powershell
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cd apps/juris-mobile
flutter analyze
flutter test
```

The focused report-contract test is:

```powershell
flutter test test/report_contract_test.dart
```

The focused layout-parity test is:

```powershell
flutter test --no-pub test/report_graph_layout_test.dart
```

On deeply nested Windows worktrees, Flutter's automatic pub step can fail while enumerating a generated iOS Swift-package path even after `flutter pub get` has resolved the lock. Run subsequent analysis and tests with `--no-pub` against that resolved lock, or use a temporary short drive mapping. Any mapping is a tooling workaround only and must be removed after the command.

### v62 mobile layout verification receipts

- `dart format` over the five layout sources and parity test: completed.
- `dart analyze` over the layout sources and test: no issues.
- `flutter pub get` from a temporary repository-root `R:` mapping: succeeded; the mapping was removed.
- `flutter analyze --no-pub`: no issues found.
- `flutter test test/report_contract_test.dart test/report_graph_layout_test.dart`: 15 tests passed.
- `flutter test --no-pub`: 258 tests passed.
- Exact release-script probe with `--manifest`, `--font-metrics`, and
  `--fixtures`: seven fixture fingerprints passed, including 200 nodes and 187
  cross-page connector pairs.
- All seven locked web fixtures match exact node-page assignments, compact connector records, and layout fingerprints, including Bhopal, deep, wide, disconnected, cyclic repair, long EN/RU Unicode content, and the 200-node stress graph.
- Rust source and authoritative runtime semantics were not changed by this mobile presentation work.

### Release restrictions

No public v62 deployment is permitted until strict web checks, the complete PDF structural and visual suite, exact web/Flutter layout-fixture parity, Rust and Flutter gates, Android and iOS lifecycle/package gates, all 18 routes, anonymous production PDF verification, authenticated workspace save, stale-chunk recovery, security audit, and post-deployment observability are green. Obtain explicit approval immediately before the one final public deployment. Do not create an app-store distribution without separate explicit authorization.

### v62 release-candidate verification - 2026-09-01

The mobile candidate is source-stable and has passed every locally executable
platform gate: all 113 Dart files are formatted, Flutter analysis is clean, all
258 Flutter tests pass, Rust formatting and Clippy with warnings denied pass,
the complete locked Rust workspace test matrix passes, and all 12 Android native
persistence scenarios pass on `emulator-5554`. The temporary Windows drive
mapping used for long-path Flutter commands was removed after each run.

The exact mobile commit, push, and four hosted Android/Flutter/iOS/Rust receipts
remain release-boundary work. No app-store artifact or production deployment is
claimed by these local results.
