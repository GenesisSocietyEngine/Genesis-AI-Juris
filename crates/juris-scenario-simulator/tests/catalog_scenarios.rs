use std::path::PathBuf;

use juris_scenario_simulator::{
    ScenarioDocument, ScenarioSimulator, SimulationCommand, SimulationStatus,
};

fn logistics_scenario_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../content/cases/unpaid_logistics_invoices.scenario.json")
}

fn greenfire_scenario_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../content/cases/greenfire_first_72_hours.scenario.json")
}

fn run_path(actions: &[&str]) -> juris_scenario_simulator::SimulationResult {
    run_scenario_path(logistics_scenario_path(), actions)
}

fn run_scenario_path(
    scenario_path: PathBuf,
    commands: &[&str],
) -> juris_scenario_simulator::SimulationResult {
    let document = ScenarioDocument::load(scenario_path).expect("scenario must load");
    let commands = commands
        .iter()
        .map(|command| {
            command
                .strip_prefix('+')
                .map(|minutes| SimulationCommand::AdvanceTime {
                    minutes: minutes.parse().expect("clock command must be valid"),
                })
                .unwrap_or_else(|| SimulationCommand::Action((*command).to_owned()))
        })
        .collect::<Vec<_>>();

    ScenarioSimulator::new(document)
        .expect("simulator must initialize")
        .run_commands(&commands, true)
        .expect("reference path must reach an outcome")
}

const GREENFIRE_PROTECTED_PATH: &[&str] = &[
    "accept_emergency_mandate",
    "issue_legal_hold",
    "run_conflict_assessment",
    "appoint_separate_director_counsel",
    "notify_insurers",
    "retain_independent_fire_expert",
    "open_controlled_regulator_channel",
    "submit_initial_regulatory_response",
    "+360",
    "review_preliminary_fire_assessment",
    "establish_response_protocol",
    "+360",
    "+360",
    "+360",
    "+360",
    "+360",
    "+360",
    "+360",
    "+360",
    "+360",
    "complete_protected_handoff",
];

const GREENFIRE_COMPROMISED_PATH: &[&str] = &[
    "accept_emergency_mandate",
    "+360",
    "release_unreviewed_documents",
    "+360",
    "+360",
    "+360",
    "+360",
    "+360",
    "+360",
    "+360",
    "+360",
    "+360",
    "+360",
    "+360",
    "complete_compromised_handoff",
];

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

#[test]
fn greenfire_protected_path_is_deterministic() {
    let first = run_scenario_path(greenfire_scenario_path(), GREENFIRE_PROTECTED_PATH);
    let second = run_scenario_path(greenfire_scenario_path(), GREENFIRE_PROTECTED_PATH);

    assert_eq!(first, second);
    assert_eq!(first.status, SimulationStatus::Completed);
    assert_eq!(first.final_state.clock_minutes, 4_440);
    assert_eq!(
        first.final_state.resolved_outcome.as_deref(),
        Some("protected_crisis_position")
    );
    assert!(!first
        .fired_events
        .iter()
        .any(|event| event.ends_with("_missed") || event == "expert_assessment_expired"));
}

#[test]
fn greenfire_compromised_path_records_deadlines_and_expiry() {
    let result = run_scenario_path(greenfire_scenario_path(), GREENFIRE_COMPROMISED_PATH);

    assert_eq!(result.status, SimulationStatus::Completed);
    assert_eq!(result.final_state.clock_minutes, 4_590);
    assert_eq!(
        result.final_state.resolved_outcome.as_deref(),
        Some("compromised_crisis_position")
    );
    for event in [
        "legal_hold_missed",
        "insurance_notice_missed",
        "expert_assessment_expired",
    ] {
        assert!(result.fired_events.iter().any(|item| item == event));
    }
}

#[test]
fn greenfire_handoff_is_unavailable_before_the_window_event() {
    let document = ScenarioDocument::load(greenfire_scenario_path()).expect("scenario must load");
    let actions = ["accept_emergency_mandate", "complete_compromised_handoff"]
        .into_iter()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let error = ScenarioSimulator::new(document)
        .expect("simulator must initialize")
        .run_actions(&actions, false)
        .expect_err("handoff must remain unavailable before minute 4320");

    assert!(matches!(
        error,
        juris_scenario_simulator::SimulationError::ActionUnavailable { .. }
    ));
}
