# Mobile Case Library & Conversion Contract v1

Commit 11E is the first mobile test checkpoint. It turns the existing case
catalog into a generated Flutter asset and makes the case library the app's
production entrypoint.

## Multiple-scenario architecture

Flutter does not hard-code case captions, topics, clients, roles, difficulty,
or authoring status. The generated mobile bundle contains a list of stable
`case_id` and `scenario_id` records. Adding another case therefore does not
require another case-card widget.

The checked-in source layers are:

1. `content/catalog/catalog.json` — stable catalog identity and scenario path;
2. `content/catalog/cases/*.identity.json` — fictional parties and matter data;
3. `content/localization/case_catalog.v1.json` — localized narrative text and
   runtime metadata;
4. `apps/juris-mobile/tool/export_mobile_case_bundle.dart` — deterministic
   exporter;
5. `apps/juris-mobile/assets/case_catalog/mobile_case_bundle.json` — generated
   mobile bundle.

Run:

```powershell
dart run apps/juris-mobile/tool/export_mobile_case_bundle.dart `
  --repo-root C:\PROJECTS\Genesis-AI-Juris
```

Verify that the generated file is current:

```powershell
dart run apps/juris-mobile/tool/export_mobile_case_bundle.dart `
  --repo-root C:\PROJECTS\Genesis-AI-Juris `
  --check
```

## Case-to-game-scenario pipeline

A case card may exist before the executable game is ready. The mobile bundle
tracks six explicit readiness states:

- matter identity;
- executable scenario definition;
- authoring diagnostics;
- deterministic path simulation;
- authoritative engine runtime;
- generated mobile bundle.

The production library currently contains five `rust_scenario_v1` entries in
deterministic sort order:

1. `be_commercial_failed_erp_001`;
2. `be_commercial_logistics_001`;
3. `greenfire_first_72_hours`;
4. `goldenshell_recall_at_dawn`;
5. `desert_water_groundwater_claim`.

Their canonical scenario JSON is embedded in bundle v4 and validated again
when Rust creates the session. The combined five-case bundle is 622,325 bytes
with SHA-256
`58d90d7cc50b853c395e4defe43579b1c7b5d7f3ae12cb9cfe5ec2e22751c97a`.
`DemoGameRepository` is retained only for historical Failed ERP
characterization tests and is never selected by the production factory.

Run its focused gates:

```powershell
cargo test -p juris-scenario-validator --test catalog_scenarios
cargo test -p juris-scenario-diagnostics --test catalog_scenarios
cargo test -p juris-scenario-simulator --test catalog_scenarios
```

Replay its reference paths:

```powershell
cargo run -p juris-scenario-simulator -- run `
  content/cases/unpaid_logistics_invoices.scenario.json `
  --actions audit_claim_file,issue_formal_demand,accept_negotiated_payment `
  --require-outcome

cargo run -p juris-scenario-simulator -- run `
  content/cases/unpaid_logistics_invoices.scenario.json `
  --actions audit_claim_file,issue_formal_demand,request_judgment,enforce_judgment `
  --require-outcome
```

The authoritative session, JSON protocol, C ABI transport, Dart FFI client, and
Rust-snapshot-to-`GameSnapshot` mapper are implemented by
`juris-engine::ScenarioSession`, `juris-mobile-bridge`, `juris-mobile-ffi`, and
`RustScenarioRepository`. Additional validated scenario files can use the same
mobile screens by declaring `rust_scenario_v1`.

## Localization

Case captions retain fictional party names and procedural order. Topic,
synopsis, client role, legal issues, and library UI labels are localized by
data. English and Russian prove the contract; additional locale records can be
added without changing the selector widgets.
