use juris_scenario_diagnostics::validate_authoring_semantics;
use juris_scenario_schema::ScenarioDefinition;

const DESERT_WATER_SCENARIO: &str =
    include_str!("../../../content/cases/desert_water_groundwater_claim.scenario.json");

#[test]
fn desert_water_passes_complete_authoring_diagnostics() {
    let scenario: ScenarioDefinition =
        serde_json::from_str(DESERT_WATER_SCENARIO).expect("Desert Water scenario must parse");
    let report = validate_authoring_semantics(&scenario);

    assert!(
        report.is_valid(),
        "Desert Water authoring diagnostics: {:#?}",
        report.diagnostics()
    );
}
