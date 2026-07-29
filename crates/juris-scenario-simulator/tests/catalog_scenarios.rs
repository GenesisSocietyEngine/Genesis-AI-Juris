use std::path::PathBuf;

use juris_scenario_simulator::{ScenarioDocument, ScenarioSimulator, SimulationStatus};

fn logistics_scenario_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../content/cases/unpaid_logistics_invoices.scenario.json")
}

fn run_path(actions: &[&str]) -> juris_scenario_simulator::SimulationResult {
    let document = ScenarioDocument::load(logistics_scenario_path()).expect("scenario must load");
    let actions = actions
        .iter()
        .map(|action| (*action).to_owned())
        .collect::<Vec<_>>();

    ScenarioSimulator::new(document)
        .expect("simulator must initialize")
        .run_actions(&actions, true)
        .expect("reference path must reach an outcome")
}

#[test]
fn logistics_negotiated_recovery_path_is_deterministic() {
    let actions = [
        "audit_claim_file",
        "issue_formal_demand",
        "accept_negotiated_payment",
    ];
    let first = run_path(&actions);
    let second = run_path(&actions);

    assert_eq!(first, second);
    assert_eq!(first.status, SimulationStatus::Completed);
    assert_eq!(first.final_state.stage, "resolved");
    assert_eq!(
        first.final_state.resolved_outcome.as_deref(),
        Some("negotiated_recovery")
    );
    assert_eq!(first.final_state.clock_minutes, 270);
}

#[test]
fn logistics_judgment_recovery_path_is_deterministic() {
    let result = run_path(&[
        "audit_claim_file",
        "issue_formal_demand",
        "request_judgment",
        "enforce_judgment",
    ]);

    assert_eq!(result.status, SimulationStatus::Completed);
    assert_eq!(result.final_state.stage, "resolved");
    assert_eq!(
        result.final_state.resolved_outcome.as_deref(),
        Some("judgment_recovery")
    );
    assert_eq!(result.final_state.clock_minutes, 480);
    assert_eq!(result.fired_events, vec!["judgment_for_velmont"]);
}
