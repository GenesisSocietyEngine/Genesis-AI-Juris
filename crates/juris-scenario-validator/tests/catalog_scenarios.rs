use juris_scenario_schema::ScenarioDefinition;
use juris_scenario_validator::validate_scenario;

const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const GREENFIRE_SCENARIO: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");

#[test]
fn playable_catalog_scenarios_pass_core_validation() {
    for (name, encoded) in [
        ("Logistics", LOGISTICS_SCENARIO),
        ("GreenFire", GREENFIRE_SCENARIO),
    ] {
        let scenario: ScenarioDefinition =
            serde_yaml::from_str(encoded).expect("scenario JSON must deserialize");
        let report = validate_scenario(&scenario);
        assert!(
            report.is_valid(),
            "expected valid {name} scenario, got diagnostics: {:#?}",
            report.diagnostics
        );
    }
}
