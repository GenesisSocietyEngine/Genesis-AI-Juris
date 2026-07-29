use std::{fs, path::PathBuf, process::Command};

use juris_scenario_diagnostics::{validate_authoring_semantics, AuthoringDiagnosticCode};
use juris_scenario_schema::ScenarioDefinition;
use serde_json::{json, Value};

fn repository_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn fixture_value() -> Value {
    let path = repository_root().join("content/fixtures/authoring/temporal_outcome_valid.json");
    let bytes = fs::read(path).expect("valid fixture must be readable");
    serde_json::from_slice(&bytes).expect("valid fixture JSON must parse")
}

fn scenario(value: Value) -> ScenarioDefinition {
    serde_json::from_value(value).expect("mutated fixture must remain schema-valid")
}

fn report(value: Value) -> juris_scenario_diagnostics::AuthoringValidationReport {
    validate_authoring_semantics(&scenario(value))
}

fn push(array: &mut Value, value: Value) {
    // Optional collections may be omitted from compact reference fixtures.
    // Serde JSON indexing represents a missing field as Value::Null, so the
    // test mutation helper initializes that field before appending.
    if array.is_null() {
        *array = json!([]);
    }

    array
        .as_array_mut()
        .expect("fixture field must be an array")
        .push(value);
}

#[test]
fn reference_fixture_passes_temporal_and_outcome_diagnostics() {
    let report = report(fixture_value());

    assert!(report.is_valid(), "{:#?}", report.diagnostics());
    assert!(report.diagnostics().is_empty());
}

#[test]
fn invalid_minute_of_day_is_rejected_for_events() {
    let mut value = fixture_value();
    push(
        &mut value["events"],
        json!({
            "id": "invalid_time",
            "title": "Invalid time",
            "kind": "generic",
            "trigger": {
                "type": "at_time",
                "at": {"day": 1, "minute_of_day": 1440}
            }
        }),
    );

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::InvalidScenarioTime));
}

#[test]
fn deadline_cannot_activate_after_it_is_due() {
    let mut value = fixture_value();
    push(
        &mut value["events"],
        json!({
            "id": "deadline_activation",
            "title": "Deadline activation",
            "kind": "generic",
            "trigger": {
                "type": "at_time",
                "at": {"day": 3, "minute_of_day": 600}
            }
        }),
    );
    push(
        &mut value["events"],
        json!({
            "id": "deadline_missed",
            "title": "Deadline missed",
            "kind": "generic",
            "trigger": {
                "type": "deadline_missed",
                "deadline": "filing_deadline"
            }
        }),
    );
    push(
        &mut value["deadlines"],
        json!({
            "id": "filing_deadline",
            "title": "Filing deadline",
            "due_at": {"day": 2, "minute_of_day": 600},
            "activation_event": "deadline_activation",
            "completion_actions": ["file_claim"],
            "missed_event": "deadline_missed"
        }),
    );

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::DeadlineActivatesAfterDue));
}

#[test]
fn fixed_completion_event_cannot_follow_deadline() {
    let mut value = fixture_value();
    push(
        &mut value["events"],
        json!({
            "id": "deadline_completion",
            "title": "Deadline completion",
            "kind": "generic",
            "trigger": {
                "type": "at_time",
                "at": {"day": 3, "minute_of_day": 600}
            }
        }),
    );
    push(
        &mut value["events"],
        json!({
            "id": "deadline_missed",
            "title": "Deadline missed",
            "kind": "generic",
            "trigger": {
                "type": "deadline_missed",
                "deadline": "filing_deadline"
            }
        }),
    );
    push(
        &mut value["deadlines"],
        json!({
            "id": "filing_deadline",
            "title": "Filing deadline",
            "due_at": {"day": 2, "minute_of_day": 600},
            "completion_actions": ["file_claim"],
            "completion_event": "deadline_completion",
            "missed_event": "deadline_missed"
        }),
    );

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::DeadlineCompletionAfterDue));
}

#[test]
fn deadline_missed_event_must_reference_the_same_deadline() {
    let mut value = fixture_value();
    push(
        &mut value["events"],
        json!({
            "id": "wrong_missed_event",
            "title": "Wrong missed event",
            "kind": "generic",
            "trigger": {"type": "after_action", "action": "file_claim"}
        }),
    );
    push(
        &mut value["deadlines"],
        json!({
            "id": "filing_deadline",
            "title": "Filing deadline",
            "due_at": {"day": 2, "minute_of_day": 600},
            "completion_actions": ["file_claim"],
            "missed_event": "wrong_missed_event"
        }),
    );

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::DeadlineMissTriggerMismatch));
}

#[test]
fn async_task_duration_must_be_positive() {
    let mut value = fixture_value();
    push(
        &mut value["async_tasks"],
        json!({
            "id": "expert_report",
            "title": "Expert report",
            "start_action": "file_claim",
            "completion_event": "judgment",
            "duration_minutes": 0
        }),
    );

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::ZeroDurationAsyncTask));
}

#[test]
fn async_task_expiry_cannot_precede_usable_boundary() {
    let mut value = fixture_value();
    push(
        &mut value["events"],
        json!({
            "id": "usable_boundary",
            "title": "Usable boundary",
            "kind": "generic",
            "trigger": {
                "type": "at_time",
                "at": {"day": 4, "minute_of_day": 600}
            }
        }),
    );
    push(
        &mut value["events"],
        json!({
            "id": "expiry",
            "title": "Expiry",
            "kind": "generic",
            "trigger": {
                "type": "at_time",
                "at": {"day": 3, "minute_of_day": 600}
            }
        }),
    );
    push(
        &mut value["async_tasks"],
        json!({
            "id": "expert_report",
            "title": "Expert report",
            "start_action": "file_claim",
            "completion_event": "judgment",
            "duration_minutes": 60,
            "usable_until_event": "usable_boundary",
            "expiry_event": "expiry"
        }),
    );

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::TaskExpiryBeforeUsableBoundary));
}

#[test]
fn terminal_stage_requires_an_outcome() {
    let mut value = fixture_value();
    value["outcomes"] = json!([]);

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::TerminalStageWithoutOutcome));
}

#[test]
fn outcome_cannot_target_non_terminal_stage() {
    let mut value = fixture_value();
    value["outcomes"][0]["terminal_stage"] = json!("post_judgment");

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::OutcomeTargetsNonTerminalStage));
}

#[test]
fn declared_outcome_requires_a_producer() {
    let mut value = fixture_value();
    value["actions"][1]["effects"] = json!([
        {"type": "set_stage", "stage": "resolved"}
    ]);

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::OutcomeWithoutProducer));
}

#[test]
fn one_transition_cannot_resolve_competing_outcomes() {
    let mut value = fixture_value();
    push(
        &mut value["outcomes"],
        json!({
            "id": "second_outcome",
            "title": "Second outcome",
            "summary": "Competing outcome.",
            "terminal_stage": "resolved",
            "condition": {
                "type": "flag_equals",
                "flag": "second",
                "value": true
            }
        }),
    );
    push(
        &mut value["actions"][1]["effects"],
        json!({"type": "resolve_outcome", "outcome": "second_outcome"}),
    );

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::MultipleOutcomesInTransition));
}

#[test]
fn several_unconditional_outcomes_for_one_stage_are_ambiguous() {
    let mut value = fixture_value();
    value["outcomes"][0]["condition"] = json!({"type": "always"});
    push(
        &mut value["outcomes"],
        json!({
            "id": "second_outcome",
            "title": "Second outcome",
            "summary": "Competing unconditional outcome.",
            "terminal_stage": "resolved",
            "condition": {"type": "always"}
        }),
    );

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::AmbiguousUnconditionalOutcomes));
}

#[test]
fn contradictory_outcome_condition_is_rejected() {
    let mut value = fixture_value();
    value["outcomes"][0]["condition"] = json!({
        "type": "all",
        "conditions": [
            {"type": "stage_is", "stage": "intake"},
            {"type": "stage_is", "stage": "post_judgment"}
        ]
    });

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::UnsatisfiableOutcomeCondition));
}

#[test]
fn post_judgment_stage_must_remain_open_for_remedies() {
    let mut value = fixture_value();
    value["stages"][1]["terminal"] = json!(true);

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::TerminalPostJudgmentStage));
}

#[test]
fn fixed_time_appeal_cannot_precede_fixed_time_judgment() {
    let mut value = fixture_value();
    value["events"][0]["trigger"] = json!({
        "type": "at_time",
        "at": {"day": 4, "minute_of_day": 600}
    });
    push(
        &mut value["events"],
        json!({
            "id": "appeal",
            "title": "Appeal",
            "kind": "appeal",
            "trigger": {
                "type": "at_time",
                "at": {"day": 3, "minute_of_day": 600}
            }
        }),
    );

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::AppealScheduledBeforeJudgment));
}

#[test]
fn fixed_time_cassation_cannot_precede_appeal_or_judgment() {
    let mut value = fixture_value();
    value["events"][0]["trigger"] = json!({
        "type": "at_time",
        "at": {"day": 4, "minute_of_day": 600}
    });
    push(
        &mut value["events"],
        json!({
            "id": "appeal",
            "title": "Appeal",
            "kind": "appeal",
            "trigger": {
                "type": "at_time",
                "at": {"day": 5, "minute_of_day": 600}
            }
        }),
    );
    push(
        &mut value["events"],
        json!({
            "id": "cassation",
            "title": "Cassation",
            "kind": "cassation",
            "trigger": {
                "type": "at_time",
                "at": {"day": 3, "minute_of_day": 600}
            }
        }),
    );

    let report = report(value);

    assert!(report.contains_code(AuthoringDiagnosticCode::CassationScheduledBeforeAppeal));
    assert!(report.contains_code(AuthoringDiagnosticCode::CassationScheduledBeforeJudgment));
}

#[test]
fn cli_accepts_the_reference_fixture() {
    let executable = env!("CARGO_BIN_EXE_juris-scenario-diagnostics");
    let fixture = repository_root().join("content/fixtures/authoring/temporal_outcome_valid.json");

    let output = Command::new(executable)
        .arg("validate")
        .arg(fixture)
        .output()
        .expect("CLI must execute");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        String::from_utf8_lossy(&output.stdout).contains("PASS temporal and outcome diagnostics")
    );
}
