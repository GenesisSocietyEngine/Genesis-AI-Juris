use juris_engine::{ScenarioRuntimeError, ScenarioSession, ScenarioSessionRegistry};
use juris_scenario_schema::ScenarioDefinition;

const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const GREENFIRE_SCENARIO: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const GOLDENSHELL_SCENARIO: &str =
    include_str!("../../../content/cases/goldenshell_recall_at_dawn.scenario.json");

fn logistics_definition() -> ScenarioDefinition {
    serde_json::from_str(LOGISTICS_SCENARIO).expect("Logistics scenario must parse")
}

fn greenfire_definition() -> ScenarioDefinition {
    serde_json::from_str(GREENFIRE_SCENARIO).expect("GreenFire scenario must parse")
}

fn goldenshell_definition() -> ScenarioDefinition {
    serde_json::from_str(GOLDENSHELL_SCENARIO).expect("GoldenShell scenario must parse")
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
    for action in [
        "accept_emergency_mandate",
        "issue_legal_hold",
        "run_conflict_assessment",
        "appoint_separate_director_counsel",
        "notify_insurers",
        "retain_independent_fire_expert",
        "open_controlled_regulator_channel",
        "submit_initial_regulatory_response",
        "coordinate_operational_period",
        "review_preliminary_fire_assessment",
        "establish_response_protocol",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "complete_protected_handoff",
    ] {
        session.dispatch(action).expect("path action must succeed");
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
        session.dispatch("coordinate_operational_period").unwrap();
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
fn goldenshell_coordinated_path_runs_through_the_authoritative_engine() {
    let mut session =
        ScenarioSession::new(goldenshell_definition(), 20260730).expect("session must start");
    for action in [
        "accept_cooperative_mandate",
        "issue_coordinated_legal_hold",
        "preserve_reference_samples",
        "obtain_blocking_decisions",
        "notify_cleaning_contractor",
        "notify_farm_insurers",
        "coordinate_recall_response",
        "request_product_composition_records",
        "retain_independent_residue_expert",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "review_preliminary_residue_assessment",
        "map_common_and_individual_losses",
        "prepare_protective_attachment_strategy",
        "establish_coordinated_claim_protocol",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "complete_coordinated_handoff",
    ] {
        session.dispatch(action).expect("path action must succeed");
    }

    let snapshot = session.snapshot();
    assert!(snapshot.terminal);
    assert_eq!(snapshot.clock_minutes, 4_545);
    assert_eq!(
        snapshot.outcome.as_ref().map(|item| item.id.as_str()),
        Some("coordinated_claim_position")
    );
    assert!(snapshot.available_actions.is_empty());
    assert!(snapshot
        .evidence
        .iter()
        .any(|item| { item.id == "preliminary_residue_assessment_report" && item.available }));
    assert!(snapshot.facts.iter().any(|item| {
        item.id == "common_source_with_farm_specific_variation" && item.status == "inferred"
    }));
    assert_eq!(
        session.dispatch("coordinate_operational_period"),
        Err(ScenarioRuntimeError::ScenarioResolved)
    );
}

#[test]
fn goldenshell_fragmented_path_runs_through_the_authoritative_engine() {
    let mut session =
        ScenarioSession::new(goldenshell_definition(), 20260730).expect("session must start");
    for action in [
        "accept_cooperative_mandate",
        "authorise_recall_without_reference_samples",
        "prioritise_regulator_claim",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "complete_fragmented_handoff",
    ] {
        session.dispatch(action).expect("path action must succeed");
    }

    let snapshot = session.snapshot();
    assert!(snapshot.terminal);
    assert_eq!(snapshot.clock_minutes, 4_710);
    assert_eq!(
        snapshot.outcome.as_ref().map(|item| item.id.as_str()),
        Some("fragmented_claim_position")
    );
    for deadline in [
        "contractor_notice_deadline",
        "insurance_notice_deadline",
        "retailer_recall_deadline",
    ] {
        assert!(snapshot
            .deadlines
            .iter()
            .any(|item| { item.id == deadline && item.status.as_deref() == Some("missed") }));
    }
}

#[test]
fn goldenshell_seed_and_trace_are_deterministic_and_sessions_are_isolated() {
    let mut registry = ScenarioSessionRegistry::new();
    let first = registry
        .create(goldenshell_definition(), 20260730)
        .expect("first session must start");
    let second = registry
        .create(goldenshell_definition(), 20260730)
        .expect("second session must start");

    for action in ["accept_cooperative_mandate", "preserve_reference_samples"] {
        registry
            .dispatch(first, action)
            .expect("first session action must succeed");
    }

    assert_eq!(registry.snapshot(first).unwrap().clock_minutes, 150);
    assert_eq!(registry.snapshot(second).unwrap().clock_minutes, 0);
    registry
        .dispatch(second, "accept_cooperative_mandate")
        .expect("second session action must succeed");
    registry
        .dispatch(second, "preserve_reference_samples")
        .expect("second session action must succeed");
    assert_eq!(
        registry.snapshot(first).unwrap(),
        registry.snapshot(second).unwrap()
    );
}
