use juris_engine::{ScenarioRuntimeError, ScenarioSession, ScenarioSessionRegistry};
use juris_scenario_schema::ScenarioDefinition;

const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");

fn logistics_definition() -> ScenarioDefinition {
    serde_json::from_str(LOGISTICS_SCENARIO).expect("Logistics scenario must parse")
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
