use juris_engine::{
    ScenarioRuntimeError, ScenarioSession, PRESSURE_COUNTERMOVE_PROJECTION_SCHEMA_VERSION,
};
use juris_scenario_schema::ScenarioDefinition;
use serde_json::{json, Value};

const FIXTURE: &str = include_str!("fixtures/pressure_countermove_runtime.json");

fn fixture_value() -> Value {
    serde_json::from_str(FIXTURE).expect("pressure fixture JSON must parse")
}

fn definition(value: Value) -> ScenarioDefinition {
    serde_json::from_value(value).expect("pressure fixture must deserialize")
}

fn session() -> ScenarioSession {
    ScenarioSession::new(definition(fixture_value()), 41)
        .expect("pressure fixture must validate and start")
}

#[test]
fn projection_is_omitted_before_activation_and_exposes_no_pressure_ids() {
    let snapshot = session().snapshot();
    assert!(snapshot.pressure_and_countermove.is_none());

    let encoded = serde_json::to_string(&snapshot).unwrap();
    assert!(!encoded.contains("pressure_and_countermove"));
    assert!(!encoded.contains("urgent-demand"));
    assert!(!encoded.contains("opposing-counsel"));
}

#[test]
fn activation_projects_ordered_available_responses_and_game_time() {
    let mut session = session();
    let snapshot = session.dispatch("receive-demand").unwrap();
    let projection = snapshot.pressure_and_countermove.unwrap();

    assert_eq!(
        projection.projection_schema_version,
        PRESSURE_COUNTERMOVE_PROJECTION_SCHEMA_VERSION
    );
    assert_eq!(projection.active_pressures.len(), 1);
    let pressure = &projection.active_pressures[0];
    assert_eq!(pressure.pressure_id, "urgent-demand");
    assert_eq!(pressure.source_actor_id, "opposing-counsel");
    assert_eq!(pressure.due_at_minute, 60);
    assert_eq!(pressure.remaining_minutes, 60);
    assert_eq!(
        pressure.available_response_action_ids,
        ["file-documented-response", "negotiate-extension"]
    );

    let advanced = session.advance_time(10).unwrap();
    assert_eq!(
        advanced.pressure_and_countermove.unwrap().active_pressures[0].remaining_minutes,
        50
    );
}

#[test]
fn available_response_filter_can_be_neutrally_empty() {
    let mut value = fixture_value();
    for action_index in [1, 2] {
        value["actions"][action_index]["available_when"] = json!({
            "type": "all",
            "conditions": [
                {"type": "stage_is", "stage": "active"},
                {"type": "flag_equals", "flag": "never_set", "value": true}
            ]
        });
    }
    let mut session = ScenarioSession::new(definition(value), 41).unwrap();
    let snapshot = session.dispatch("receive-demand").unwrap();

    assert!(
        snapshot.pressure_and_countermove.unwrap().active_pressures[0]
            .available_response_action_ids
            .is_empty()
    );
}

#[test]
fn successful_response_completes_deadline_and_round_trips_without_save_changes() {
    let definition = definition(fixture_value());
    let mut session = ScenarioSession::new(definition.clone(), 41).unwrap();
    session.dispatch("receive-demand").unwrap();
    let snapshot = session.dispatch("file-documented-response").unwrap();

    assert_eq!(snapshot.clock_minutes, 30);
    assert!(snapshot.pressure_and_countermove.is_none());
    assert_eq!(snapshot.deadlines[0].status.as_deref(), Some("completed"));
    assert!(!session.diagnostic_fired_event_ids().contains("countermove"));

    let save = session.save_json().unwrap();
    let save_value: Value = serde_json::from_str(&save).unwrap();
    assert_eq!(save_value.as_object().unwrap().len(), 8);
    assert_eq!(save_value["schema_version"], 1);
    assert_eq!(save_value["runtime_compatibility"], "scenario-runtime-v2");

    let restored = ScenarioSession::from_save_json(definition, &save).unwrap();
    assert_eq!(restored.snapshot(), session.snapshot());
    assert_eq!(
        restored.final_state_digest().unwrap(),
        session.final_state_digest().unwrap()
    );
}

#[test]
fn missed_window_runs_ordinary_countermove_effects_and_large_advance_is_chunk_stable() {
    let mut direct = session();
    direct.dispatch("receive-demand").unwrap();
    let direct_snapshot = direct.advance_time(60).unwrap();

    assert!(direct_snapshot.pressure_and_countermove.is_none());
    assert_eq!(
        direct_snapshot.deadlines[0].status.as_deref(),
        Some("missed")
    );
    assert_eq!(
        direct_snapshot.numeric_metrics.as_ref().unwrap()["countermove_cost"],
        25
    );
    assert!(direct_snapshot
        .inbox
        .iter()
        .any(|item| item.id == "countermove-notice" && item.visible));
    assert!(direct.diagnostic_fired_event_ids().contains("countermove"));

    let mut chunked = session();
    chunked.dispatch("receive-demand").unwrap();
    chunked.advance_time(20).unwrap();
    chunked.advance_time(20).unwrap();
    let chunked_snapshot = chunked.advance_time(20).unwrap();
    assert_eq!(chunked_snapshot, direct_snapshot);
}

#[test]
fn exact_due_policy_rejects_or_accepts_atomically() {
    let mut exclusive_value = fixture_value();
    exclusive_value["actions"][1]["time_cost_minutes"] = json!(60);
    let mut exclusive = ScenarioSession::new(definition(exclusive_value), 41).unwrap();
    exclusive.dispatch("receive-demand").unwrap();
    let before = exclusive.snapshot();
    assert!(matches!(
        exclusive.dispatch("file-documented-response"),
        Err(ScenarioRuntimeError::ActionCompletionDeadlineExceeded {
            completion: 60,
            due: 60,
            ..
        })
    ));
    assert_eq!(exclusive.snapshot(), before);

    let mut inclusive_value = fixture_value();
    inclusive_value["actions"][1]["time_cost_minutes"] = json!(60);
    inclusive_value["deadlines"][0]["completion_at_due_allowed"] = json!(true);
    let mut inclusive = ScenarioSession::new(definition(inclusive_value), 41).unwrap();
    inclusive.dispatch("receive-demand").unwrap();
    let accepted = inclusive.dispatch("file-documented-response").unwrap();
    assert_eq!(accepted.clock_minutes, 60);
    assert_eq!(accepted.deadlines[0].status.as_deref(), Some("completed"));
    assert!(accepted.pressure_and_countermove.is_none());
    assert!(!inclusive
        .diagnostic_fired_event_ids()
        .contains("countermove"));
}

#[test]
fn closed_session_never_projects_pressure() {
    let mut session = session();
    session.dispatch("receive-demand").unwrap();
    session.dispatch("negotiate-extension").unwrap();
    let closed = session.dispatch("close-matter").unwrap();

    assert!(closed.is_closed);
    assert!(closed.pressure_and_countermove.is_none());
}
