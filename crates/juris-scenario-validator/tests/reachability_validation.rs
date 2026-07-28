//! Regression tests for static scenario reachability.

use juris_scenario_schema::{
    ActionId, EventDefinition, EventId, EventKind, EventTrigger, OutcomeDefinition, OutcomeId,
    ScenarioDefinition, StageDefinition, StageId, StageKind,
};
use juris_scenario_validator::{validate_scenario, DiagnosticCode};

const MINIMAL_SCENARIO: &str =
    include_str!("../../../content/fixtures/valid/minimal-scenario.yaml");

fn load_minimal_scenario() -> ScenarioDefinition {
    serde_yaml::from_str(MINIMAL_SCENARIO).expect("minimal scenario fixture must deserialize")
}

#[test]
fn minimal_scenario_passes_reachability_validation() {
    let scenario = load_minimal_scenario();
    let report = validate_scenario(&scenario);

    assert!(
        report.is_valid(),
        "expected valid scenario, got diagnostics: {:#?}",
        report.diagnostics
    );
}

#[test]
fn unreachable_stage_is_rejected() {
    let mut scenario = load_minimal_scenario();

    // Marking the isolated stage terminal prevents this test from also
    // producing StageWithoutExit.
    scenario.stages.push(StageDefinition {
        id: StageId::from("isolated-stage"),
        title: "Isolated Stage".to_owned(),
        kind: StageKind::Standard,
        entry_event: None,
        exit_actions: Vec::new(),
        terminal: true,
    });

    let report = validate_scenario(&scenario);

    assert_eq!(report.error_codes(), vec![DiagnosticCode::UnreachableStage]);
}

#[test]
fn non_terminal_stage_without_exit_is_rejected() {
    let mut scenario = load_minimal_scenario();

    // The action still exists and remains reachable through its StageIs
    // condition, but the stage no longer declares any exit action.
    scenario.stages[0].exit_actions.clear();

    let report = validate_scenario(&scenario);

    assert_eq!(report.error_codes(), vec![DiagnosticCode::StageWithoutExit]);
}

#[test]
fn outcome_without_reachable_resolution_is_rejected() {
    let mut scenario = load_minimal_scenario();

    scenario.outcomes.push(OutcomeDefinition {
        id: OutcomeId::from("never-resolved-outcome"),
        title: "Never resolved".to_owned(),
        summary: "No reachable action or event resolves this outcome.".to_owned(),
        terminal_stage: StageId::from("resolved"),
        condition: Default::default(),
    });

    let report = validate_scenario(&scenario);

    assert_eq!(
        report.error_codes(),
        vec![DiagnosticCode::UnreachableOutcome]
    );
}

#[test]
fn by_effect_event_without_triggering_effect_is_rejected() {
    let mut scenario = load_minimal_scenario();

    scenario.events.push(EventDefinition {
        id: EventId::from("orphan-event"),
        title: "Orphan event".to_owned(),
        kind: EventKind::Generic,
        trigger: EventTrigger::ByEffect,
        condition: Default::default(),
        effects: Vec::new(),
    });

    let report = validate_scenario(&scenario);

    assert_eq!(
        report.error_codes(),
        vec![DiagnosticCode::EventWithoutTrigger]
    );
}

#[test]
fn declared_exit_action_is_recognized() {
    let scenario = load_minimal_scenario();

    assert_eq!(
        scenario.stages[0].exit_actions,
        vec![ActionId::from("close-matter")]
    );

    let report = validate_scenario(&scenario);

    assert!(
        report.is_valid(),
        "expected declared exit action to be valid: {:#?}",
        report.diagnostics
    );
}
