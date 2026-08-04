use juris_scenario_diagnostics::validate_authoring_semantics;
use juris_scenario_schema::ScenarioDefinition;

const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const GREENFIRE_SCENARIO: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const GOLDENSHELL_SCENARIO: &str =
    include_str!("../../../content/cases/goldenshell_recall_at_dawn.scenario.json");
const FAILED_ERP_SCENARIO: &str = include_str!("../../../content/cases/failed_erp.scenario.json");

#[test]
fn playable_catalog_scenarios_pass_authoring_diagnostics() {
    for (name, encoded) in [
        ("Logistics", LOGISTICS_SCENARIO),
        ("GreenFire", GREENFIRE_SCENARIO),
        ("GoldenShell", GOLDENSHELL_SCENARIO),
        ("Failed ERP", FAILED_ERP_SCENARIO),
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
