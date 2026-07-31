use juris_engine::{
    ScenarioCommand, ScenarioSaveEnvelope, ScenarioSaveError, ScenarioSession,
    ScenarioSessionRegistry,
};
use juris_scenario_schema::ScenarioDefinition;
use serde_json::json;

const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const GREENFIRE_SCENARIO: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const GOLDENSHELL_SCENARIO: &str =
    include_str!("../../../content/cases/goldenshell_recall_at_dawn.scenario.json");

fn definition(encoded: &str) -> ScenarioDefinition {
    serde_json::from_str(encoded).expect("canonical scenario must parse")
}

fn assert_round_trip(session: &ScenarioSession, definition: ScenarioDefinition) {
    let encoded = session.save_json().expect("save must serialize");
    let restored = ScenarioSession::from_save_json(definition, &encoded).expect("save must replay");
    assert_eq!(restored.snapshot(), session.snapshot());
    assert_eq!(
        restored.final_state_digest().unwrap(),
        session.final_state_digest().unwrap()
    );
    assert_eq!(restored.command_log(), session.command_log());
}

#[test]
fn empty_command_log_round_trips() {
    let session = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 7).unwrap();
    assert!(session.command_log().is_empty());
    assert_round_trip(&session, definition(LOGISTICS_SCENARIO));
}

#[test]
fn action_driven_logistics_round_trips() {
    let mut session = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 20260725).unwrap();
    session.dispatch("audit_claim_file").unwrap();
    session.dispatch("issue_formal_demand").unwrap();
    assert_round_trip(&session, definition(LOGISTICS_SCENARIO));
}

#[test]
fn foreground_greenfire_round_trips_before_and_after_deadline_miss() {
    let mut session = ScenarioSession::new(definition(GREENFIRE_SCENARIO), 20260729).unwrap();
    session.dispatch("accept_emergency_mandate").unwrap();
    assert!(session
        .snapshot()
        .deadlines
        .iter()
        .any(|deadline| deadline.id == "legal_hold_deadline"
            && deadline.status.as_deref() == Some("open")));
    assert_round_trip(&session, definition(GREENFIRE_SCENARIO));

    session.advance_time(360).unwrap();
    assert!(session
        .snapshot()
        .deadlines
        .iter()
        .any(|deadline| deadline.id == "legal_hold_deadline"
            && deadline.status.as_deref() == Some("missed")));
    assert_round_trip(&session, definition(GREENFIRE_SCENARIO));
}

#[test]
fn foreground_goldenshell_round_trips() {
    let mut session = ScenarioSession::new(definition(GOLDENSHELL_SCENARIO), 20260730).unwrap();
    session.dispatch("accept_cooperative_mandate").unwrap();
    session.dispatch("preserve_reference_samples").unwrap();
    session.advance_time(360).unwrap();
    assert_round_trip(&session, definition(GOLDENSHELL_SCENARIO));
}

#[test]
fn async_completion_replays_across_advance_time() {
    let mut session = ScenarioSession::new(definition(GREENFIRE_SCENARIO), 20260729).unwrap();
    for action in [
        "accept_emergency_mandate",
        "issue_legal_hold",
        "run_conflict_assessment",
        "appoint_separate_director_counsel",
        "notify_insurers",
        "retain_independent_fire_expert",
    ] {
        session.dispatch(action).unwrap();
    }
    let before = session.save_json().unwrap();
    let mut restored =
        ScenarioSession::from_save_json(definition(GREENFIRE_SCENARIO), &before).unwrap();
    restored.advance_time(360).unwrap();
    assert!(restored
        .snapshot()
        .fired_event_ids
        .contains(&"expert_assessment_completed".to_owned()));
    assert_round_trip(&restored, definition(GREENFIRE_SCENARIO));
}

#[test]
fn terminal_session_round_trips() {
    let mut session = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 20260725).unwrap();
    for action in [
        "audit_claim_file",
        "issue_formal_demand",
        "accept_negotiated_payment",
    ] {
        session.dispatch(action).unwrap();
    }
    assert!(session.snapshot().terminal);
    assert_round_trip(&session, definition(LOGISTICS_SCENARIO));
}

#[test]
fn identical_replay_produces_identical_digest() {
    let mut session = ScenarioSession::new(definition(GREENFIRE_SCENARIO), 41).unwrap();
    session.dispatch("accept_emergency_mandate").unwrap();
    session.advance_time(90).unwrap();
    let encoded = session.save_json().unwrap();
    let first = ScenarioSession::from_save_json(definition(GREENFIRE_SCENARIO), &encoded).unwrap();
    let second = ScenarioSession::from_save_json(definition(GREENFIRE_SCENARIO), &encoded).unwrap();
    assert_eq!(
        first.final_state_digest().unwrap(),
        second.final_state_digest().unwrap()
    );
}

#[test]
fn locale_is_not_part_of_the_authoritative_digest() {
    let session = ScenarioSession::new(definition(GOLDENSHELL_SCENARIO), 42).unwrap();
    let digest = session.final_state_digest().unwrap();
    let encoded = session.save_json().unwrap();
    assert!(!encoded.contains("locale"));
    assert_eq!(
        ScenarioSession::from_save_json(definition(GOLDENSHELL_SCENARIO), &encoded)
            .unwrap()
            .final_state_digest()
            .unwrap(),
        digest
    );
}

#[test]
fn corrupted_unknown_schema_and_fingerprint_are_rejected() {
    assert!(matches!(
        ScenarioSession::from_save_json(definition(LOGISTICS_SCENARIO), "{truncated"),
        Err(ScenarioSaveError::InvalidJson(_))
    ));

    let session = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 1).unwrap();
    let mut envelope = session.save_envelope().unwrap();
    envelope.schema_id = "future.command-log".to_owned();
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), envelope).unwrap_err(),
        ScenarioSaveError::UnknownSchema("future.command-log".to_owned())
    );

    let mut envelope = session.save_envelope().unwrap();
    envelope.schema_version = 99;
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), envelope).unwrap_err(),
        ScenarioSaveError::UnknownSchemaVersion(99)
    );

    let mut envelope = session.save_envelope().unwrap();
    envelope.scenario_fingerprint = "0".repeat(64);
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), envelope).unwrap_err(),
        ScenarioSaveError::FingerprintMismatch
    );

    let mut envelope = session.save_envelope().unwrap();
    envelope.runtime_compatibility = "scenario-runtime-v2".to_owned();
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), envelope).unwrap_err(),
        ScenarioSaveError::RuntimeCompatibility("scenario-runtime-v2".to_owned())
    );

    let mut envelope = session.save_envelope().unwrap();
    envelope.scenario_id = "unknown_scenario".to_owned();
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), envelope).unwrap_err(),
        ScenarioSaveError::UnknownScenario("unknown_scenario".to_owned())
    );
}

#[test]
fn unknown_command_action_and_illegal_order_are_rejected() {
    let session = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 1).unwrap();
    let encoded = session.save_json().unwrap().replace(
        "\"commands\":[]",
        "\"commands\":[{\"command\":\"future_command\"}]",
    );
    assert_eq!(
        ScenarioSession::from_save_json(definition(LOGISTICS_SCENARIO), &encoded).unwrap_err(),
        ScenarioSaveError::UnknownCommand("future_command".to_owned())
    );

    let mut unknown_action = session.save_envelope().unwrap();
    unknown_action.commands.push(ScenarioCommand::Dispatch {
        action_id: "missing_action".to_owned(),
    });
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), unknown_action)
            .unwrap_err(),
        ScenarioSaveError::UnknownAction("missing_action".to_owned())
    );

    let mut illegal = session.save_envelope().unwrap();
    illegal.commands.push(ScenarioCommand::Dispatch {
        action_id: "request_judgment".to_owned(),
    });
    assert!(matches!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), illegal),
        Err(ScenarioSaveError::IllegalCommandSequence { index: 0, .. })
    ));
}

#[test]
fn rejected_player_command_is_not_recorded_or_partially_applied() {
    let mut session = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 2).unwrap();
    let before = session.snapshot();
    assert!(session.dispatch("request_judgment").is_err());
    assert!(session.command_log().is_empty());
    assert_eq!(session.snapshot(), before);
}

#[test]
fn invalid_time_advance_and_integrity_mismatch_are_rejected() {
    let session = ScenarioSession::new(definition(GREENFIRE_SCENARIO), 1).unwrap();
    let mut invalid_time = session.save_envelope().unwrap();
    invalid_time
        .commands
        .push(ScenarioCommand::AdvanceTime { minutes: 0 });
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(GREENFIRE_SCENARIO), invalid_time)
            .unwrap_err(),
        ScenarioSaveError::InvalidTimeAdvance(0)
    );

    let mut corrupted_digest = session.save_envelope().unwrap();
    corrupted_digest.final_state_digest = "f".repeat(64);
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(GREENFIRE_SCENARIO), corrupted_digest)
            .unwrap_err(),
        ScenarioSaveError::IntegrityMismatch
    );
}

#[test]
fn failed_load_leaves_existing_registry_session_intact() {
    let mut registry = ScenarioSessionRegistry::new();
    let existing = registry.create(definition(LOGISTICS_SCENARIO), 9).unwrap();
    registry.dispatch(existing, "audit_claim_file").unwrap();
    let before = registry.snapshot(existing).unwrap();

    assert!(registry
        .load_from_json(definition(LOGISTICS_SCENARIO), "{broken")
        .is_err());
    assert_eq!(registry.snapshot(existing).unwrap(), before);
    assert_eq!(registry.len(), 1);
}

#[test]
fn repeated_load_does_not_duplicate_generated_events() {
    let mut original = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 10).unwrap();
    for action in [
        "audit_claim_file",
        "issue_formal_demand",
        "request_judgment",
    ] {
        original.dispatch(action).unwrap();
    }
    let envelope = original.save_envelope().unwrap();
    assert_eq!(envelope.commands.len(), 3);
    assert!(envelope
        .commands
        .iter()
        .all(|command| matches!(command, ScenarioCommand::Dispatch { .. })));
    assert_eq!(
        original.snapshot().fired_event_ids,
        vec!["judgment_for_velmont"]
    );
    let encoded = original.save_json().unwrap();
    let mut registry = ScenarioSessionRegistry::new();
    let first = registry
        .load_from_json(definition(LOGISTICS_SCENARIO), &encoded)
        .unwrap();
    let second = registry
        .load_from_json(definition(LOGISTICS_SCENARIO), &encoded)
        .unwrap();
    let first_snapshot = registry.snapshot(first).unwrap();
    let second_snapshot = registry.snapshot(second).unwrap();
    assert_eq!(first_snapshot, second_snapshot);
    assert_eq!(first_snapshot.fired_event_ids, vec!["judgment_for_velmont"]);
}

#[test]
fn event_budget_guard_remains_active_during_replay() {
    let mut value: serde_json::Value = serde_json::from_str(LOGISTICS_SCENARIO).unwrap();
    let events = value["events"].as_array_mut().unwrap();
    for index in 0..257 {
        events.push(json!({
            "id": format!("budget_event_{index:03}"),
            "title": format!("Budget event {index:03}"),
            "kind": "generic",
            "trigger": {
                "type": "after_action",
                "action": "audit_claim_file"
            },
            "condition": {"type": "always"},
            "effects": []
        }));
    }
    let expanded: ScenarioDefinition = serde_json::from_value(value).unwrap();
    let initial = ScenarioSession::new(expanded.clone(), 11).unwrap();
    let mut envelope: ScenarioSaveEnvelope = initial.save_envelope().unwrap();
    envelope.commands.push(ScenarioCommand::Dispatch {
        action_id: "audit_claim_file".to_owned(),
    });

    let error = ScenarioSession::from_save_envelope(expanded, envelope).unwrap_err();
    assert!(matches!(
        error,
        ScenarioSaveError::IllegalCommandSequence { index: 0, .. }
    ));
    assert!(error.to_string().contains("event limit"));
}
