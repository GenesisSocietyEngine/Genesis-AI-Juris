use juris_scenario_schema::ScenarioDefinition;
use juris_scenario_validator::validate_scenario;

const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");

#[test]
fn logistics_catalog_scenario_passes_core_validation() {
    let scenario: ScenarioDefinition =
        serde_yaml::from_str(LOGISTICS_SCENARIO).expect("scenario JSON must deserialize");
    let report = validate_scenario(&scenario);

    assert!(
        report.is_valid(),
        "expected valid Logistics scenario, got diagnostics: {:#?}",
        report.diagnostics
    );
}
