use std::{fs, path::PathBuf, process::Command};

use juris_scenario_simulator::{
    ScenarioDocument, ScenarioSimulator, SimulationError, SimulationStatus, TraceKind,
};
use serde_json::{json, Value};

fn repository_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn fixture_path() -> PathBuf {
    repository_root().join("content/fixtures/authoring/scenario_path_valid.json")
}

fn fixture_value() -> Value {
    let bytes = fs::read(fixture_path()).expect("fixture must be readable");
    serde_json::from_slice(&bytes).expect("fixture must parse")
}

fn run(
    value: Value,
    actions: &[&str],
) -> Result<juris_scenario_simulator::SimulationResult, SimulationError> {
    let document = ScenarioDocument::from_value(value)?;
    let actions = actions
        .iter()
        .map(|item| (*item).to_owned())
        .collect::<Vec<_>>();
    ScenarioSimulator::new(document)?.run_actions(&actions, false)
}

#[test]
fn reference_path_reaches_the_explicit_outcome() {
    let result = run(
        fixture_value(),
        &["file_claim", "prepare_hearing", "accept_judgment"],
    )
    .expect("reference path must succeed");

    assert_eq!(result.status, SimulationStatus::Completed);
    assert_eq!(result.final_state.stage, "resolved");
    assert_eq!(
        result.final_state.resolved_outcome.as_deref(),
        Some("judgment_accepted")
    );
    assert_eq!(result.final_state.clock_minutes, 270);
}

#[test]
fn identical_action_paths_produce_identical_replay_traces() {
    let first = run(
        fixture_value(),
        &["file_claim", "prepare_hearing", "accept_judgment"],
    )
    .expect("first run must succeed");
    let second = run(
        fixture_value(),
        &["file_claim", "prepare_hearing", "accept_judgment"],
    )
    .expect("second run must succeed");

    assert_eq!(first, second);
}

#[test]
fn unknown_action_is_rejected() {
    let error = run(fixture_value(), &["unknown_action"]).expect_err("unknown action must fail");

    assert!(matches!(error, SimulationError::UnknownAction { .. }));
}

#[test]
fn action_outside_the_current_stage_is_rejected() {
    let error =
        run(fixture_value(), &["prepare_hearing"]).expect_err("wrong-stage action must fail");

    assert!(matches!(
        error,
        SimulationError::ActionNotAllowedByStage { .. }
    ));
}

#[test]
fn conditionally_unavailable_action_is_rejected() {
    let mut value = fixture_value();
    value["stages"][0]["exit_actions"] = json!(["prepare_hearing"]);

    let error = run(value, &["prepare_hearing"]).expect_err("unavailable action must fail");

    assert!(matches!(error, SimulationError::ActionUnavailable { .. }));
}

#[test]
fn action_time_cost_advances_the_typed_clock() {
    let result = run(fixture_value(), &["file_claim"]).expect("first action must succeed");

    assert_eq!(result.final_state.clock_minutes, 60);
    assert_eq!(result.status, SimulationStatus::InProgress);
}

#[test]
fn automatic_event_fires_once_when_also_triggered_explicitly() {
    let result =
        run(fixture_value(), &["file_claim", "prepare_hearing"]).expect("path must succeed");

    assert_eq!(result.fired_events, vec!["judgment".to_owned()]);
    assert_eq!(
        result
            .trace
            .iter()
            .filter(|entry| entry.kind == TraceKind::Event)
            .count(),
        1
    );
}

#[test]
fn due_at_time_event_fires_after_clock_advances() {
    let mut value = fixture_value();
    value["events"] = json!([
        {
            "id": "clock_event",
            "title": "Clock event",
            "kind": "generic",
            "trigger": {
                "type": "at_time",
                "at": {"day": 0, "minute_of_day": 60}
            },
            "effects": [
                {"type": "set_flag", "flag": "clock_event_fired", "value": true}
            ]
        }
    ]);

    let result = run(value, &["file_claim"]).expect("clock event must fire");

    assert_eq!(
        result.final_state.flags.get("clock_event_fired"),
        Some(&true)
    );
    assert_eq!(result.fired_events, vec!["clock_event".to_owned()]);
}

#[test]
fn outcome_condition_is_checked_after_transition_effects() {
    let result = run(
        fixture_value(),
        &["file_claim", "prepare_hearing", "accept_judgment"],
    )
    .expect("outcome condition must see stage and flag effects");

    assert_eq!(
        result.final_state.flags.get("judgment_accepted"),
        Some(&true)
    );
}

#[test]
fn false_outcome_condition_rejects_resolution() {
    let mut value = fixture_value();
    value["outcomes"][0]["condition"] = json!({
        "type": "flag_equals",
        "flag": "never_set",
        "value": true
    });

    let error = run(value, &["file_claim", "prepare_hearing", "accept_judgment"])
        .expect_err("false outcome condition must fail");

    assert!(matches!(
        error,
        SimulationError::OutcomeConditionFalse { .. }
    ));
}

#[test]
fn one_transition_cannot_resolve_multiple_outcomes() {
    let mut value = fixture_value();
    value["outcomes"]
        .as_array_mut()
        .expect("outcomes must be an array")
        .push(json!({
            "id": "second_outcome",
            "title": "Second",
            "summary": "Second outcome.",
            "terminal_stage": "resolved",
            "condition": {"type": "always"}
        }));
    value["actions"][2]["effects"]
        .as_array_mut()
        .expect("effects must be an array")
        .push(json!({
            "type": "resolve_outcome",
            "outcome": "second_outcome"
        }));

    let error = run(value, &["file_claim", "prepare_hearing", "accept_judgment"])
        .expect_err("multiple outcomes must fail");

    assert!(matches!(error, SimulationError::MultipleOutcomes { .. }));
}

#[test]
fn unsupported_condition_is_not_silently_ignored() {
    let mut value = fixture_value();
    value["actions"][0]["available_when"] = json!({
        "type": "money_at_least",
        "amount": 50
    });

    let error = run(value, &["file_claim"]).expect_err("unsupported condition must fail");

    assert!(matches!(
        error,
        SimulationError::UnsupportedCondition { .. }
    ));
}

#[test]
fn unsupported_effect_is_not_silently_ignored() {
    let mut value = fixture_value();
    value["actions"][0]["effects"] = json!([
        {"type": "add_money", "amount": 50}
    ]);

    let error = run(value, &["file_claim"]).expect_err("unsupported effect must fail");

    assert!(matches!(error, SimulationError::UnsupportedEffect { .. }));
}

#[test]
fn terminal_stage_without_outcome_is_rejected() {
    let mut value = fixture_value();
    value["actions"][2]["effects"] = json!([
        {"type": "set_stage", "stage": "resolved"}
    ]);

    let error = run(value, &["file_claim", "prepare_hearing", "accept_judgment"])
        .expect_err("terminal stage without outcome must fail");

    assert!(matches!(
        error,
        SimulationError::TerminalWithoutOutcome { .. }
    ));
}

#[test]
fn require_outcome_rejects_incomplete_paths() {
    let document = ScenarioDocument::from_value(fixture_value()).expect("document must parse");
    let error = ScenarioSimulator::new(document)
        .expect("simulator must initialize")
        .run_actions(&["file_claim".to_owned()], true)
        .expect_err("incomplete path must fail");

    assert!(matches!(error, SimulationError::OutcomeRequired));
}

#[test]
fn cli_runs_the_reference_path() {
    let executable = env!("CARGO_BIN_EXE_juris-scenario-simulator");
    let output = Command::new(executable)
        .arg("run")
        .arg(fixture_path())
        .arg("--actions")
        .arg("file_claim,prepare_hearing,accept_judgment")
        .arg("--require-outcome")
        .output()
        .expect("CLI must execute");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("Outcome: judgment_accepted"));
}

#[test]
fn cli_json_trace_is_machine_readable() {
    let executable = env!("CARGO_BIN_EXE_juris-scenario-simulator");
    let output = Command::new(executable)
        .arg("run")
        .arg(fixture_path())
        .arg("--actions")
        .arg("file_claim,prepare_hearing,accept_judgment")
        .arg("--json")
        .output()
        .expect("CLI must execute");

    assert!(output.status.success());
    let decoded: Value = serde_json::from_slice(&output.stdout).expect("CLI output must be JSON");
    assert_eq!(decoded["status"], "completed");
}
