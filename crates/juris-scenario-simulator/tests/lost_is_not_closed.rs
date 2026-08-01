use std::path::PathBuf;

use juris_scenario_schema::{JudicialResult, MatterLifecycleStatus};
use juris_scenario_simulator::{ScenarioDocument, ScenarioSimulator, SimulationResult};

fn fixture_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../content/fixtures/authoring/adverse_judgment_with_remedies.json")
}

fn run(actions: &[&str]) -> SimulationResult {
    let document = ScenarioDocument::load(fixture_path()).expect("fixture must load");
    ScenarioSimulator::new(document)
        .expect("simulator must initialize")
        .run_actions(
            &actions
                .iter()
                .map(|action| (*action).to_owned())
                .collect::<Vec<_>>(),
            false,
        )
        .expect("path must succeed")
}

#[test]
fn lost_intermediate_state_is_open_and_deterministic() {
    let actions = ["request_judgment", "adverse_trial_judgment"];
    let first = run(&actions);
    let second = run(&actions);

    assert_eq!(first, second);
    assert_eq!(
        first.final_state.judicial_result,
        Some(JudicialResult::Lost)
    );
    assert_eq!(
        first.final_state.matter_lifecycle,
        MatterLifecycleStatus::PostJudgment
    );
    assert!(!first.final_state.is_closed);
    assert_eq!(first.final_state.resolved_outcome, None);
}

#[test]
fn appeal_success_path_closes_only_after_enforcement() {
    let result = run(&[
        "request_judgment",
        "adverse_trial_judgment",
        "file_appeal",
        "appeal_success",
        "begin_enforcement",
        "complete_enforcement",
    ]);

    assert_eq!(
        result.final_state.judicial_result,
        Some(JudicialResult::Won)
    );
    assert_eq!(
        result.final_state.matter_lifecycle,
        MatterLifecycleStatus::Closed
    );
    assert!(result.final_state.is_closed);
    assert_eq!(
        result.final_state.resolved_outcome.as_deref(),
        Some("appellate_success")
    );
}

#[test]
fn waiver_and_cassation_exhaustion_are_explicit_closure_paths() {
    let waiver = run(&["request_judgment", "adverse_trial_judgment", "waive_appeal"]);
    let exhausted = run(&[
        "request_judgment",
        "adverse_trial_judgment",
        "file_appeal",
        "appeal_lost",
        "file_cassation",
        "cassation_rejected",
        "close_after_remedies_exhausted",
    ]);

    for result in [waiver, exhausted] {
        assert_eq!(
            result.final_state.judicial_result,
            Some(JudicialResult::Lost)
        );
        assert_eq!(
            result.final_state.matter_lifecycle,
            MatterLifecycleStatus::Closed
        );
        assert!(result.final_state.is_closed);
        assert_eq!(
            result.final_state.resolved_outcome.as_deref(),
            Some("final_loss")
        );
    }
}
