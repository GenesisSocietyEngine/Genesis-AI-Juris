# Mobile Case Library & Conversion Contract v1

Commit 11E is the first mobile test checkpoint. It turns the existing case
catalog into a generated Flutter asset and makes the case library the app's
production entrypoint.

## Multiple-scenario architecture

Flutter does not hard-code case captions, topics, clients, roles, difficulty,
or authoring status. The generated mobile bundle contains a list of stable
`case_id` and `scenario_id` records. Adding a third case therefore does not
require another case-card widget.

The checked-in source layers are:

1. `content/catalog/catalog.json` — stable catalog identity and scenario path;
2. `content/catalog/cases/*.identity.json` — fictional parties and matter data;
3. `content/localization/case_catalog.v1.json` — localized narrative text and
   temporary runtime metadata;
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
tracks five explicit readiness states:

- matter identity;
- executable scenario definition;
- authoring diagnostics;
- deterministic path simulation;
- generated mobile bundle.

The Failed ERP case launches through `demo_failed_erp`. The logistics matter
now has a canonical executable scenario at
`content/cases/unpaid_logistics_invoices.scenario.json`. It passes core
validation, authoring diagnostics, and deterministic simulation for both its
negotiated-recovery and judgment-enforcement paths.

Logistics remains an outline and cannot launch until the generic Rust runtime
bridge is available. This prevents it from accidentally opening ERP gameplay
under the wrong case identity while allowing the mobile conversion sheet to
report that its content gates are genuinely complete.

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

The next runtime milestone replaces the temporary adapter with one generic Rust
snapshot/action bridge. At that point every validated scenario file can use the
same mobile screens.

## Localization

Case captions retain fictional party names and procedural order. Topic,
synopsis, client role, legal issues, and library UI labels are localized by
data. English and Russian prove the contract; additional locale records can be
added without changing the selector widgets.
