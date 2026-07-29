# Unpaid Logistics Invoices Scenario v1

## Conversion status

`be_commercial_logistics_001` is the first catalog outline converted into a
canonical `ScenarioDefinition`.

The conversion preserves separate layers:

- `content/catalog/cases/unpaid_logistics_invoices.identity.json` owns stable
  matter identity, fictional parties, caption, and player representation;
- `content/localization/case_catalog.v1.json` owns localized library narrative;
- `content/cases/unpaid_logistics_invoices.scenario.json` owns executable
  stages, actions, events, facts, evidence, and outcomes;
- the generated Flutter bundle reports readiness but does not execute scenario
  rules.

## Deterministic paths

The introductory scenario exposes two complete reference paths after the
invoice and evidence file is audited and a formal demand is issued.

### Negotiated recovery

```text
audit_claim_file
  -> issue_formal_demand
  -> accept_negotiated_payment
  -> negotiated_recovery
```

This path consumes 270 simulated minutes.

### Judgment and enforcement

```text
audit_claim_file
  -> issue_formal_demand
  -> request_judgment
  -> judgment_for_velmont
  -> enforce_judgment
  -> judgment_recovery
```

This path consumes 480 simulated minutes. The judgment event fires exactly
once even though the action has both an explicit trigger and a matching
`after_action` trigger.

## Gate ownership

Repository-level tests load the production scenario rather than a copied
fixture:

- `juris-scenario-validator/tests/catalog_scenarios.rs` proves structural,
  reference, lifecycle, reachability, and terminal integrity;
- `juris-scenario-diagnostics/tests/catalog_scenarios.rs` proves temporal,
  outcome, and remedy integrity;
- `juris-scenario-simulator/tests/catalog_scenarios.rs` proves both paths are
  deterministic and reach their declared outcomes.

The scenario is not yet mobile-playable. The remaining boundary is a generic
Rust snapshot/action bridge capable of loading any validated scenario without
case-specific Flutter gameplay code.
