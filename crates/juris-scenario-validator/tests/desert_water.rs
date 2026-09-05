use juris_scenario_schema::{ScenarioClockMode, ScenarioDefinition};
use juris_scenario_validator::validate_scenario;

const DESERT_WATER_SCENARIO: &str =
    include_str!("../../../content/cases/desert_water_groundwater_claim.scenario.json");

fn definition() -> ScenarioDefinition {
    serde_json::from_str(DESERT_WATER_SCENARIO).expect("Desert Water scenario must deserialize")
}

#[test]
fn desert_water_passes_core_validation_with_the_frozen_inventory() {
    let scenario = definition();
    let report = validate_scenario(&scenario);

    assert!(
        report.is_valid(),
        "Desert Water core diagnostics: {:#?}",
        report.diagnostics
    );
    assert_eq!(
        scenario.metadata.id.as_str(),
        "desert_water_groundwater_claim"
    );
    assert_eq!(scenario.clock.mode, ScenarioClockMode::Foreground);
    assert_eq!(scenario.actors.len(), 9);
    assert_eq!(scenario.stages.len(), 8);
    assert_eq!(scenario.facts.len(), 10);
    assert_eq!(scenario.evidence.len(), 13);
    assert_eq!(scenario.actions.len(), 27);
    assert_eq!(scenario.deadlines.len(), 5);
    assert_eq!(scenario.async_tasks.len(), 1);
    assert_eq!(scenario.inbox_items.len(), 10);
    assert_eq!(scenario.events.len(), 17);
    assert_eq!(scenario.outcomes.len(), 2);
    assert!(scenario
        .actions
        .iter()
        .all(|action| action.time_cost_minutes > 0 && action.cost_eur > 0));
    assert!(scenario
        .deadlines
        .iter()
        .all(|deadline| deadline.due_at.minute_of_day < 1_440));
}
