//! Regression tests for structural and reference validation.

use juris_scenario_schema::{
    ActionId, Effect, EventDefinition, EventId, EventKind, EventTrigger, MetricId,
    ScenarioDefinition, ScenarioTime, StageId,
};
use juris_scenario_validator::{validate_scenario, DiagnosticCode};
use serde_json::json;

const MINIMAL_SCENARIO: &str =
    include_str!("../../../content/fixtures/valid/minimal-scenario.yaml");

fn load_minimal_scenario() -> ScenarioDefinition {
    serde_yaml::from_str(MINIMAL_SCENARIO).expect("minimal scenario fixture must deserialize")
}

#[test]
fn minimal_scenario_passes_phase_one_validation() {
    let scenario = load_minimal_scenario();
    let report = validate_scenario(&scenario);

    assert!(
        report.is_valid(),
        "expected valid scenario, got diagnostics: {:#?}",
        report.diagnostics
    );
}

#[test]
fn duplicate_action_id_is_rejected() {
    let mut scenario = load_minimal_scenario();
    scenario.actions.push(scenario.actions[0].clone());

    let report = validate_scenario(&scenario);

    assert_eq!(report.error_codes(), vec![DiagnosticCode::DuplicateId]);
}

#[test]
fn unsupported_schema_version_is_rejected() {
    let mut scenario = load_minimal_scenario();
    scenario.schema_version = "999.0".to_owned();

    let report = validate_scenario(&scenario);

    assert_eq!(
        report.error_codes(),
        vec![DiagnosticCode::UnsupportedSchemaVersion]
    );
}

#[test]
fn missing_initial_stage_is_rejected() {
    let mut scenario = load_minimal_scenario();
    scenario.initial_stage = StageId::from("missing-stage");

    let report = validate_scenario(&scenario);

    assert_eq!(
        report.error_codes(),
        vec![DiagnosticCode::MissingInitialStage]
    );
}

#[test]
fn unknown_stage_reference_in_effect_is_rejected() {
    let mut scenario = load_minimal_scenario();

    scenario.actions[0].effects.push(Effect::SetStage {
        stage: StageId::from("unknown-stage"),
    });

    let report = validate_scenario(&scenario);

    assert_eq!(
        report.error_codes(),
        vec![DiagnosticCode::UnknownStageReference]
    );
}

#[test]
fn unknown_action_reference_in_stage_is_rejected() {
    let mut scenario = load_minimal_scenario();

    scenario.stages[0]
        .exit_actions
        .push(ActionId::from("unknown-action"));

    let report = validate_scenario(&scenario);

    assert_eq!(
        report.error_codes(),
        vec![DiagnosticCode::UnknownActionReference]
    );
}

#[test]
fn unknown_metric_reference_is_rejected() {
    let mut scenario = load_minimal_scenario();
    scenario.actions[0].effects.push(Effect::AddMetric {
        metric: MetricId::from("missing_metric"),
        amount: 1,
    });

    assert_eq!(
        validate_scenario(&scenario).error_codes(),
        vec![DiagnosticCode::UnknownMetricReference]
    );
}

#[test]
fn invalid_foreground_metric_rate_is_rejected() {
    let mut scenario = load_minimal_scenario();
    scenario
        .numeric_metrics
        .insert(MetricId::from("inactivity"), 0);
    scenario
        .foreground_metric_rates
        .insert(MetricId::from("inactivity"), 0);

    assert_eq!(
        validate_scenario(&scenario).error_codes(),
        vec![DiagnosticCode::InvalidForegroundMetricRate]
    );
}

#[test]
fn repeatable_absolute_time_event_is_rejected() {
    let mut scenario = load_minimal_scenario();
    scenario.events.push(EventDefinition {
        id: EventId::from("repeatable_absolute_time"),
        title: "Invalid repeatable absolute time".to_owned(),
        kind: EventKind::Generic,
        trigger: EventTrigger::AtTime {
            at: ScenarioTime::new(0, 30),
        },
        repeatable: true,
        condition: Default::default(),
        effects: Vec::new(),
    });

    assert_eq!(
        validate_scenario(&scenario).error_codes(),
        vec![DiagnosticCode::InvalidRepeatableEventTrigger]
    );
}

#[test]
fn invalid_deterministic_decision_is_rejected() {
    let mut scenario = load_minimal_scenario();
    scenario.deterministic_decisions.push(
        serde_json::from_value(json!({
            "id": "invalid",
            "roll_range": 0,
            "score_divisor": 0,
            "branches": []
        }))
        .unwrap(),
    );

    assert_eq!(
        validate_scenario(&scenario).error_codes(),
        vec![DiagnosticCode::InvalidDecisionDefinition]
    );
}
