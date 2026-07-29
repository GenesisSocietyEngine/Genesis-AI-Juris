use juris_scenario_diagnostics::validate_authoring_semantics;
use juris_scenario_schema::ScenarioDefinition;

const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");

#[test]
fn logistics_catalog_scenario_passes_authoring_diagnostics() {
    let scenario: ScenarioDefinition =
        serde_json::from_str(LOGISTICS_SCENARIO).expect("scenario JSON must deserialize");
    let report = validate_authoring_semantics(&scenario);

    assert!(
        report.is_valid(),
        "expected valid Logistics authoring semantics, got diagnostics: {:#?}",
        report.diagnostics()
    );
}
