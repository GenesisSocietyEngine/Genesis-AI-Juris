//! Regression tests for structural and reference validation.

use juris_scenario_schema::{
    ActionId, DeadlineDefinition, DeadlineId, Effect, EventDefinition, EventId, EventKind,
    EventTrigger, MetricId, RelativeTimeDefinition, ScenarioDefinition, ScenarioTime, StageId,
};
use juris_scenario_validator::{validate_scenario, DiagnosticCode};
use serde_json::json;

const MINIMAL_SCENARIO: &str =
    include_str!("../../../content/fixtures/valid/minimal-scenario.yaml");

fn load_minimal_scenario() -> ScenarioDefinition {
    serde_yaml::from_str(MINIMAL_SCENARIO).expect("minimal scenario fixture must deserialize")
}

fn load_timing_scenario() -> ScenarioDefinition {
    let mut scenario = load_minimal_scenario();
    scenario.initial_clock = Some(ScenarioTime::new(0, 480));
    scenario.deadlines.push(DeadlineDefinition {
        id: DeadlineId::from("relative_deadline"),
        title: "Relative deadline".to_owned(),
        due_at: ScenarioTime::new(0, 900),
        relative_due: Some(RelativeTimeDefinition {
            offset_minutes: 420,
            ..RelativeTimeDefinition::default()
        }),
        completion_at_due_allowed: true,
        activation_event: None,
        completion_actions: vec![ActionId::from("close-matter")],
        completion_event: None,
        missed_event: EventId::from("relative_deadline_missed"),
    });
    scenario.events.push(EventDefinition {
        id: EventId::from("relative_deadline_missed"),
        title: "Relative deadline missed".to_owned(),
        kind: EventKind::Generic,
        trigger: EventTrigger::DeadlineMissed {
            deadline: DeadlineId::from("relative_deadline"),
        },
        repeatable: false,
        condition: Default::default(),
        effects: vec![Effect::MissDeadline {
            deadline: DeadlineId::from("relative_deadline"),
        }],
    });
    scenario
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

#[test]
fn relative_deadline_placeholder_before_civil_baseline_is_rejected() {
    let mut scenario = load_timing_scenario();
    let deadline = &mut scenario.deadlines[0];
    assert!(deadline.relative_due.is_some());
    deadline.due_at = ScenarioTime::new(0, 0);

    let report = validate_scenario(&scenario);
    assert!(report
        .error_codes()
        .contains(&DiagnosticCode::InvalidScenarioTime));
}

#[test]
fn initially_active_relative_deadline_cannot_materialize_later_activated_relative_anchor() {
    let mut scenario = load_timing_scenario();
    scenario.actions[0].effects.push(Effect::TriggerEvent {
        event: EventId::from("activate_inactive_anchor"),
    });
    scenario.deadlines.push(DeadlineDefinition {
        id: DeadlineId::from("inactive_anchor"),
        title: "Inactive relative anchor".to_owned(),
        due_at: ScenarioTime::new(0, 960),
        relative_due: Some(RelativeTimeDefinition {
            offset_minutes: 60,
            ..RelativeTimeDefinition::default()
        }),
        completion_at_due_allowed: true,
        activation_event: Some(EventId::from("activate_inactive_anchor")),
        completion_actions: vec![ActionId::from("close-matter")],
        completion_event: None,
        missed_event: EventId::from("inactive_anchor_missed"),
    });
    scenario.events.extend([
        EventDefinition {
            id: EventId::from("activate_inactive_anchor"),
            title: "Activate inactive anchor".to_owned(),
            kind: EventKind::Generic,
            trigger: EventTrigger::ByEffect,
            repeatable: false,
            condition: Default::default(),
            effects: Vec::new(),
        },
        EventDefinition {
            id: EventId::from("inactive_anchor_missed"),
            title: "Inactive anchor missed".to_owned(),
            kind: EventKind::Generic,
            trigger: EventTrigger::DeadlineMissed {
                deadline: DeadlineId::from("inactive_anchor"),
            },
            repeatable: false,
            condition: Default::default(),
            effects: vec![Effect::MissDeadline {
                deadline: DeadlineId::from("inactive_anchor"),
            }],
        },
    ]);
    scenario.deadlines[0]
        .relative_due
        .as_mut()
        .expect("fixture deadline must be relative")
        .relative_to_deadline = Some(DeadlineId::from("inactive_anchor"));

    let report = validate_scenario(&scenario);
    assert!(report
        .error_codes()
        .contains(&DiagnosticCode::InvalidScenarioTime));
}
