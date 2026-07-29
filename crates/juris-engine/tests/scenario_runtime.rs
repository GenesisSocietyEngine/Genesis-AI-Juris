use juris_engine::{ScenarioRuntimeError, ScenarioSession, ScenarioSessionRegistry};
use juris_scenario_schema::{JudicialResult, MatterLifecycleStatus, ScenarioDefinition};

const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const GREENFIRE_SCENARIO: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const REMEDIES_SCENARIO: &str =
    include_str!("../../../content/fixtures/authoring/adverse_judgment_with_remedies.json");

fn logistics_definition() -> ScenarioDefinition {
    serde_json::from_str(LOGISTICS_SCENARIO).expect("Logistics scenario must parse")
}

fn greenfire_definition() -> ScenarioDefinition {
    serde_json::from_str(GREENFIRE_SCENARIO).expect("GreenFire scenario must parse")
}

fn remedies_definition() -> ScenarioDefinition {
    serde_json::from_str(REMEDIES_SCENARIO).expect("remedies scenario must parse")
}

fn adverse_judgment_session() -> ScenarioSession {
    let mut session =
        ScenarioSession::new(remedies_definition(), 20260729).expect("session must start");
    session.dispatch("request_judgment").unwrap();
    session.dispatch("adverse_trial_judgment").unwrap();
    session
}

#[test]
fn lost_is_not_closed_and_appeal_remains_executable() {
    let mut session = adverse_judgment_session();
    let snapshot = session.snapshot();

    assert_eq!(snapshot.judicial_result, Some(JudicialResult::Lost));
    assert_eq!(
        snapshot.matter_lifecycle,
        MatterLifecycleStatus::PostJudgment
    );
    assert!(!snapshot.is_closed);
    assert!(!snapshot.terminal);
    assert_eq!(snapshot.resolved_outcome, None);
    assert!(snapshot
        .available_actions
        .iter()
        .any(|action| action.id == "file_appeal"));
    assert!(snapshot
        .available_actions
        .iter()
        .any(|action| action.id == "waive_appeal"));

    let appeal = session
        .dispatch("file_appeal")
        .expect("appeal must remain available");
    assert_eq!(appeal.matter_lifecycle, MatterLifecycleStatus::Appeal);
    assert!(!appeal.is_closed);
}

#[test]
fn waiver_and_remedies_exhaustion_close_the_matter() {
    let mut waived = adverse_judgment_session();
    let waived = waived.dispatch("waive_appeal").unwrap();
    assert!(waived.is_closed);
    assert_eq!(waived.resolved_outcome.as_deref(), Some("final_loss"));

    let mut exhausted = adverse_judgment_session();
    for action in [
        "file_appeal",
        "appeal_lost",
        "file_cassation",
        "cassation_rejected",
        "close_after_remedies_exhausted",
    ] {
        exhausted.dispatch(action).unwrap();
    }
    let exhausted = exhausted.snapshot();
    assert!(exhausted.is_closed);
    assert_eq!(exhausted.resolved_outcome.as_deref(), Some("final_loss"));
}

#[test]
fn logistics_negotiated_path_runs_through_the_authoritative_engine() {
    let mut session =
        ScenarioSession::new(logistics_definition(), 20260725).expect("session must start");

    assert_eq!(
        session.snapshot().available_actions[0].id,
        "audit_claim_file"
    );
    session
        .dispatch("audit_claim_file")
        .expect("audit must succeed");
    session
        .dispatch("issue_formal_demand")
        .expect("demand must succeed");
    let snapshot = session
        .dispatch("accept_negotiated_payment")
        .expect("settlement must succeed");

    assert!(snapshot.terminal);
    assert_eq!(snapshot.clock_minutes, 270);
    assert_eq!(
        snapshot.outcome.as_ref().map(|item| item.id.as_str()),
        Some("negotiated_recovery")
    );
    assert!(snapshot.available_actions.is_empty());
}

#[test]
fn logistics_judgment_path_fires_one_event_and_enforces_the_outcome() {
    let mut session =
        ScenarioSession::new(logistics_definition(), 20260725).expect("session must start");

    for action in [
        "audit_claim_file",
        "issue_formal_demand",
        "request_judgment",
    ] {
        session.dispatch(action).expect("path action must succeed");
    }
    let post_judgment = session.snapshot();
    assert_eq!(post_judgment.stage_id, "post_judgment");
    assert_eq!(post_judgment.fired_event_ids, vec!["judgment_for_velmont"]);

    let resolved = session
        .dispatch("enforce_judgment")
        .expect("enforcement must succeed");
    assert_eq!(resolved.clock_minutes, 480);
    assert_eq!(
        resolved.outcome.as_ref().map(|item| item.id.as_str()),
        Some("judgment_recovery")
    );
}

#[test]
fn unavailable_and_post_terminal_actions_are_rejected() {
    let mut session =
        ScenarioSession::new(logistics_definition(), 20260725).expect("session must start");

    assert_eq!(
        session.dispatch("request_judgment"),
        Err(ScenarioRuntimeError::ActionUnavailable(
            "request_judgment".to_owned()
        ))
    );

    for action in [
        "audit_claim_file",
        "issue_formal_demand",
        "accept_negotiated_payment",
    ] {
        session.dispatch(action).expect("path action must succeed");
    }
    assert_eq!(
        session.dispatch("audit_claim_file"),
        Err(ScenarioRuntimeError::ScenarioResolved)
    );
}

#[test]
fn registry_keeps_multiple_scenario_sessions_isolated() {
    let mut registry = ScenarioSessionRegistry::new();
    let first = registry
        .create(logistics_definition(), 7)
        .expect("first session must start");
    let second = registry
        .create(logistics_definition(), 7)
        .expect("second session must start");

    registry
        .dispatch(first, "audit_claim_file")
        .expect("first session action must succeed");

    assert_eq!(registry.snapshot(first).unwrap().stage_id, "pre_action");
    assert_eq!(registry.snapshot(second).unwrap().stage_id, "intake");
    assert_eq!(registry.len(), 2);

    assert!(registry.dispose(first));
    assert_eq!(
        registry.snapshot(first),
        Err(ScenarioRuntimeError::UnknownSession(first.0))
    );
    assert_eq!(registry.len(), 1);
}

#[test]
fn identical_inputs_produce_identical_snapshots() {
    let mut first =
        ScenarioSession::new(logistics_definition(), 99).expect("first session must start");
    let mut second =
        ScenarioSession::new(logistics_definition(), 99).expect("second session must start");

    for action in ["audit_claim_file", "issue_formal_demand"] {
        first.dispatch(action).unwrap();
        second.dispatch(action).unwrap();
    }

    assert_eq!(first.snapshot(), second.snapshot());
    assert_eq!(
        serde_json::to_string(&first.snapshot()).unwrap(),
        serde_json::to_string(&second.snapshot()).unwrap()
    );
}

#[test]
fn greenfire_protected_path_runs_through_the_authoritative_engine() {
    let mut session =
        ScenarioSession::new(greenfire_definition(), 20260729).expect("session must start");
    for command in [
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
    ] {
        if command == "+360" {
            session.advance_time(360).expect("clock must advance");
        } else {
            session.dispatch(command).expect("path action must succeed");
        }
    }
    let snapshot = session.snapshot();
    assert!(snapshot.terminal);
    assert_eq!(snapshot.clock_minutes, 4_440);
    assert_eq!(
        snapshot.outcome.as_ref().map(|item| item.id.as_str()),
        Some("protected_crisis_position")
    );
    assert!(!snapshot
        .fired_event_ids
        .iter()
        .any(|event| event == "expert_assessment_expired"));
}

#[test]
fn greenfire_compromised_path_expires_unreviewed_expert_work() {
    let mut session =
        ScenarioSession::new(greenfire_definition(), 20260729).expect("session must start");
    session.dispatch("accept_emergency_mandate").unwrap();
    session.dispatch("retain_independent_fire_expert").unwrap();
    for _ in 0..12 {
        session.advance_time(360).unwrap();
    }
    let before_handoff = session.snapshot();
    assert!(before_handoff
        .fired_event_ids
        .iter()
        .any(|event| event == "expert_assessment_expired"));
    let result = session
        .dispatch("complete_compromised_handoff")
        .expect("compromised handoff must succeed");
    assert_eq!(
        result.outcome.as_ref().map(|item| item.id.as_str()),
        Some("compromised_crisis_position")
    );
}

#[test]
fn greenfire_handoff_is_unavailable_before_72_hours() {
    let mut session =
        ScenarioSession::new(greenfire_definition(), 20260729).expect("session must start");
    session.dispatch("accept_emergency_mandate").unwrap();
    assert_eq!(
        session.dispatch("complete_compromised_handoff"),
        Err(ScenarioRuntimeError::ActionUnavailable(
            "complete_compromised_handoff".to_owned()
        ))
    );
}

#[test]
fn authoritative_clock_fires_greenfire_events_without_player_actions() {
    let mut session =
        ScenarioSession::new(greenfire_definition(), 20260729).expect("session must start");

    let initial = session.snapshot();
    assert_eq!(initial.clock_minutes, 0);
    assert!(!initial
        .fired_event_ids
        .iter()
        .any(|event| event == "regulator_request_received"));

    let before_request = session.advance_time(119).expect("clock must advance");
    assert_eq!(before_request.clock_minutes, 119);
    assert!(!before_request
        .fired_event_ids
        .iter()
        .any(|event| event == "regulator_request_received"));

    let request = session.advance_time(1).expect("due event must fire");
    assert_eq!(request.clock_minutes, 120);
    assert!(request
        .fired_event_ids
        .iter()
        .any(|event| event == "regulator_request_received"));
    assert!(request
        .inbox
        .iter()
        .any(|item| item.id == "regulator_document_request" && item.visible));
}

#[test]
fn authoritative_clock_is_deterministic_and_stops_after_closure() {
    let mut first =
        ScenarioSession::new(greenfire_definition(), 20260729).expect("session must start");
    let mut second =
        ScenarioSession::new(greenfire_definition(), 20260729).expect("session must start");

    first.dispatch("accept_emergency_mandate").unwrap();
    second.dispatch("accept_emergency_mandate").unwrap();
    assert_eq!(
        first.advance_time(4_290).unwrap(),
        second.advance_time(4_290).unwrap()
    );

    first.dispatch("complete_compromised_handoff").unwrap();
    assert_eq!(
        first.advance_time(1),
        Err(ScenarioRuntimeError::ScenarioResolved)
    );
}
