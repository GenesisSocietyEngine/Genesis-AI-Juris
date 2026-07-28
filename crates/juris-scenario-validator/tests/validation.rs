//! Regression tests for structural and reference validation.

use juris_scenario_schema::{ActionId, Effect, ScenarioDefinition, StageId};
use juris_scenario_validator::{validate_scenario, DiagnosticCode};

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
