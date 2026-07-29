use juris_scenario_diagnostics::{validate_authoring_semantics, AuthoringDiagnosticCode};
use juris_scenario_schema::{Effect, ScenarioDefinition, StageKind};

const FIXTURE: &str =
    include_str!("../../../content/fixtures/authoring/adverse_judgment_with_remedies.json");

fn fixture() -> ScenarioDefinition {
    serde_json::from_str(FIXTURE).expect("lifecycle fixture must parse")
}

#[test]
fn adverse_judgment_and_remedies_exhausted_paths_are_valid() {
    let report = validate_authoring_semantics(&fixture());
    assert!(report.is_valid(), "{:?}", report.diagnostics());
}

#[test]
fn remedy_stage_without_exit_is_diagnosed() {
    let mut scenario = fixture();
    scenario
        .stages
        .iter_mut()
        .find(|stage| stage.kind == StageKind::Cassation)
        .unwrap()
        .exit_actions
        .clear();

    assert!(validate_authoring_semantics(&scenario)
        .contains_code(AuthoringDiagnosticCode::RemedyStageWithoutExit));
}

#[test]
fn premature_outcome_resolution_is_diagnosed() {
    let mut scenario = fixture();
    scenario
        .actions
        .iter_mut()
        .find(|action| action.id.as_str() == "waive_appeal")
        .unwrap()
        .effects
        .retain(|effect| !matches!(effect, Effect::SetStage { .. }));

    assert!(validate_authoring_semantics(&scenario)
        .contains_code(AuthoringDiagnosticCode::PrematureOutcomeResolution));
}
