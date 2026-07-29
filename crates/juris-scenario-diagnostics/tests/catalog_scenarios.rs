use juris_scenario_diagnostics::validate_authoring_semantics;
use juris_scenario_schema::ScenarioDefinition;

const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const GREENFIRE_SCENARIO: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");

#[test]
fn playable_catalog_scenarios_pass_authoring_diagnostics() {
    for (name, encoded) in [
        ("Logistics", LOGISTICS_SCENARIO),
        ("GreenFire", GREENFIRE_SCENARIO),
    ] {
        let scenario: ScenarioDefinition =
            serde_json::from_str(encoded).expect("scenario JSON must deserialize");
        let report = validate_authoring_semantics(&scenario);
        assert!(
            report.is_valid(),
            "expected valid {name} authoring semantics, got diagnostics: {:#?}",
            report.diagnostics()
        );
    }
}
