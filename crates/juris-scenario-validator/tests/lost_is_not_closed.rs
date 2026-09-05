use juris_scenario_schema::{Effect, ScenarioDefinition, StageKind};
use juris_scenario_validator::{validate_scenario, DiagnosticCode};

const FIXTURE: &str =
    include_str!("../../../content/fixtures/authoring/adverse_judgment_with_remedies.json");

fn fixture() -> ScenarioDefinition {
    serde_json::from_str(FIXTURE).expect("lifecycle fixture must parse")
}

#[test]
fn adverse_judgment_and_all_remedy_stages_are_valid() {
    let scenario = fixture();
    let report = validate_scenario(&scenario);

    assert!(report.is_valid(), "{:?}", report.diagnostics);
    assert!(scenario.stages.iter().any(|stage| {
        stage.kind == StageKind::PostJudgment
            && !stage.terminal
            && stage
                .exit_actions
                .iter()
                .any(|action| action.as_str() == "file_appeal")
            && stage
                .exit_actions
                .iter()
                .any(|action| action.as_str() == "waive_appeal")
    }));
}

#[test]
fn remedy_stages_cannot_be_terminal() {
    for kind in [
        StageKind::PostJudgment,
        StageKind::Appeal,
        StageKind::Cassation,
        StageKind::Enforcement,
    ] {
        let mut scenario = fixture();
        let stage = scenario
            .stages
            .iter_mut()
            .find(|stage| stage.kind == kind)
            .expect("fixture must contain remedy stage");
        stage.terminal = true;

        let report = validate_scenario(&scenario);
        assert!(
            report
                .error_codes()
                .contains(&DiagnosticCode::RemedyStageTerminal),
            "{kind:?}: {:?}",
            report.diagnostics
        );
    }
}

#[test]
fn resolved_and_terminal_stage_contract_is_explicit() {
    let mut unresolved = fixture();
    unresolved
        .stages
        .iter_mut()
        .find(|stage| stage.kind == StageKind::Resolved)
        .unwrap()
        .terminal = false;
    assert!(validate_scenario(&unresolved)
        .error_codes()
        .contains(&DiagnosticCode::ResolvedStageNotTerminal));

    let mut exposed = fixture();
    exposed
        .stages
        .iter_mut()
        .find(|stage| stage.kind == StageKind::Resolved)
        .unwrap()
        .exit_actions
        .push("request_judgment".into());
    assert!(validate_scenario(&exposed)
        .error_codes()
        .contains(&DiagnosticCode::TerminalStageHasExitActions));
}

#[test]
fn nonterminal_transition_cannot_resolve_complete_outcome() {
    let mut scenario = fixture();
    let waiver = scenario
        .actions
        .iter_mut()
        .find(|action| action.id.as_str() == "waive_appeal")
        .unwrap();
    waiver
        .effects
        .retain(|effect| !matches!(effect, Effect::SetStage { .. }));

    assert!(validate_scenario(&scenario)
        .error_codes()
        .contains(&DiagnosticCode::OutcomeResolvedBeforeTerminalStage));
}

#[test]
fn complete_outcome_cannot_target_a_nonterminal_remedy_stage() {
    let mut scenario = fixture();
    scenario.outcomes[0].terminal_stage = "post_judgment_remedies".into();

    assert!(validate_scenario(&scenario)
        .error_codes()
        .contains(&DiagnosticCode::OutcomeResolvedBeforeTerminalStage));
}

#[test]
fn final_cassation_loss_may_resolve_the_terminal_outcome() {
    let scenario = fixture();
    let closure = scenario
        .actions
        .iter()
        .find(|action| action.id.as_str() == "close_after_remedies_exhausted")
        .unwrap();

    assert!(closure
        .effects
        .iter()
        .any(|effect| matches!(effect, Effect::ResolveOutcome { .. })));
    assert!(validate_scenario(&scenario).is_valid());
}
