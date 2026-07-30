use juris_engine::{ScenarioRuntimeError, ScenarioSession, ScenarioSessionRegistry};
use juris_scenario_schema::{ScenarioClockMode, ScenarioDefinition};
use serde_json::json;

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
fn snapshot_exposes_backward_compatible_clock_policy() {
    let greenfire = greenfire_definition();
    let goldenshell = goldenshell_definition();
    assert_eq!(
        logistics_definition().clock.mode,
        ScenarioClockMode::ActionDriven
    );
    assert_eq!(greenfire.actions.len(), 13);
    assert_eq!(goldenshell.actions.len(), 17);
    assert_eq!(
        ScenarioSession::new(logistics_definition(), 1)
            .unwrap()
            .snapshot()
            .clock_mode,
        "action_driven"
    );
    assert_eq!(
        ScenarioSession::new(greenfire, 1)
            .unwrap()
            .snapshot()
            .clock_mode,
        "foreground"
    );
    assert_eq!(
        ScenarioSession::new(goldenshell, 1)
            .unwrap()
            .snapshot()
            .clock_mode,
        "foreground"
    );
}

#[test]
fn foreground_advance_contract_rejects_invalid_commands() {
    let mut logistics = ScenarioSession::new(logistics_definition(), 1).unwrap();
    assert_eq!(
        logistics.advance_time(1),
        Err(ScenarioRuntimeError::ClockAdvanceUnsupported)
    );

    let mut greenfire = ScenarioSession::new(greenfire_definition(), 1).unwrap();
    assert_eq!(
        greenfire.advance_time(0),
        Err(ScenarioRuntimeError::InvalidClockAdvance)
    );
    assert_eq!(
        greenfire.advance_time(1_441),
        Err(ScenarioRuntimeError::ClockAdvanceLimitExceeded {
            requested: 1_441,
            maximum: 1_440,
        })
    );
}

#[test]
fn action_cost_and_foreground_time_share_temporal_boundaries() {
    let mut value: serde_json::Value = serde_json::from_str(GREENFIRE_SCENARIO).unwrap();
    value["actions"].as_array_mut().unwrap().push(json!({
        "id": "boundary_processor_test_action",
        "title": "Boundary processor test action",
        "available_when": {"type": "stage_is", "stage": "immediate_response"},
        "effects": [],
        "time_cost_minutes": 360,
        "repeatability": {"type": "unlimited"}
    }));
    value["stages"][1]["exit_actions"]
        .as_array_mut()
        .unwrap()
        .push(json!("boundary_processor_test_action"));
    let definition: ScenarioDefinition = serde_json::from_value(value).unwrap();
    let mut action_driven = ScenarioSession::new(definition.clone(), 11).unwrap();
    let mut foreground = ScenarioSession::new(definition, 11).unwrap();
    action_driven.dispatch("accept_emergency_mandate").unwrap();
    foreground.dispatch("accept_emergency_mandate").unwrap();

    let action_snapshot = action_driven
        .dispatch("boundary_processor_test_action")
        .unwrap();
    let foreground_snapshot = foreground.advance_time(360).unwrap();

    assert_eq!(action_snapshot, foreground_snapshot);
    assert_eq!(foreground_snapshot.clock_minutes, 390);
    assert!(foreground_snapshot
        .fired_event_ids
        .contains(&"regulator_request_received".to_owned()));
    assert!(foreground_snapshot
        .fired_event_ids
        .contains(&"legal_hold_missed".to_owned()));
}

#[test]
fn temporal_categories_use_deterministic_same_minute_priority() {
    let mut value: serde_json::Value = serde_json::from_str(GREENFIRE_SCENARIO).unwrap();
    value["async_tasks"][0]["duration_minutes"] = json!(180);
    value["actions"][0]["effects"]
        .as_array_mut()
        .unwrap()
        .push(json!({
            "type": "start_async_task",
            "task": "preliminary_fire_assessment"
        }));
    value["events"][1]["trigger"]["at"] = json!({"day": 0, "minute_of_day": 180});
    value["events"][1]["effects"] = json!([
        {"type": "set_flag", "flag": "at_time_seen", "value": true}
    ]);
    value["events"][5]["condition"] = json!({
        "type": "flag_equals",
        "flag": "at_time_seen",
        "value": true
    });
    value["events"][5]["effects"]
        .as_array_mut()
        .unwrap()
        .push(json!({
            "type": "set_flag",
            "flag": "async_seen",
            "value": true
        }));
    value["events"][2]["condition"] = json!({
        "type": "flag_equals",
        "flag": "async_seen",
        "value": true
    });
    value["events"][2]["effects"]
        .as_array_mut()
        .unwrap()
        .push(json!({
            "type": "set_flag",
            "flag": "deadline_seen",
            "value": true
        }));
    let definition: ScenarioDefinition = serde_json::from_value(value).unwrap();
    let mut session = ScenarioSession::new(definition, 12).unwrap();

    session.dispatch("accept_emergency_mandate").unwrap();
    let snapshot = session.advance_time(150).unwrap();

    assert_eq!(snapshot.clock_minutes, 180);
    assert_eq!(snapshot.flags.get("at_time_seen"), Some(&true));
    assert_eq!(snapshot.flags.get("async_seen"), Some(&true));
    assert_eq!(snapshot.flags.get("deadline_seen"), Some(&true));
}

#[test]
fn terminal_boundary_stops_a_larger_foreground_advance() {
    let mut value: serde_json::Value = serde_json::from_str(GREENFIRE_SCENARIO).unwrap();
    value["events"][1]["effects"] = json!([
        {"type": "expire_async_task", "task": "preliminary_fire_assessment"},
        {"type": "miss_deadline", "deadline": "legal_hold_deadline"},
        {"type": "miss_deadline", "deadline": "insurance_notice_deadline"},
        {"type": "miss_deadline", "deadline": "initial_regulatory_response_deadline"},
        {"type": "resolve_inbox_item", "item": "managing_director_emergency_call"},
        {"type": "resolve_inbox_item", "item": "legal_hold_required"},
        {"type": "resolve_inbox_item", "item": "insurance_notice_required"},
        {"type": "resolve_inbox_item", "item": "separate_counsel_decision"},
        {"type": "resolve_inbox_item", "item": "regulator_document_request"},
        {"type": "resolve_inbox_item", "item": "expert_report_ready"},
        {"type": "resolve_inbox_item", "item": "seventy_two_hour_handoff"},
        {"type": "set_stage", "stage": "handoff_complete"},
        {"type": "resolve_outcome", "outcome": "compromised_crisis_position"}
    ]);
    value["outcomes"][1]["condition"] = json!({"type": "always"});
    let definition: ScenarioDefinition = serde_json::from_value(value).unwrap();
    let mut session = ScenarioSession::new(definition, 13).unwrap();

    session.dispatch("accept_emergency_mandate").unwrap();
    let snapshot = session.advance_time(1_000).unwrap();

    assert!(snapshot.terminal);
    assert_eq!(snapshot.clock_minutes, 120);
    assert_eq!(
        snapshot.outcome.as_ref().map(|outcome| outcome.id.as_str()),
        Some("compromised_crisis_position")
    );
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
    ] {
        session.dispatch(action).expect("path action must succeed");
    }
    session.advance_time(360).unwrap();
    session
        .dispatch("review_preliminary_fire_assessment")
        .unwrap();
    session.dispatch("establish_response_protocol").unwrap();
    for _ in 0..9 {
        session.advance_time(360).unwrap();
    }
    session.dispatch("complete_protected_handoff").unwrap();
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
    session.advance_time(360).unwrap();
    session.dispatch("release_unreviewed_documents").unwrap();
    for _ in 0..11 {
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
    assert_eq!(result.clock_minutes, 4_590);
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
    ] {
        session.dispatch(action).expect("path action must succeed");
    }
    session.advance_time(720).unwrap();
    for action in [
        "review_preliminary_residue_assessment",
        "map_common_and_individual_losses",
        "prepare_protective_attachment_strategy",
        "establish_coordinated_claim_protocol",
    ] {
        session.dispatch(action).expect("path action must succeed");
    }
    for _ in 0..7 {
        session.advance_time(360).unwrap();
    }
    session.dispatch("complete_coordinated_handoff").unwrap();

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
        session.advance_time(1),
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
    ] {
        session.dispatch(action).expect("path action must succeed");
    }
    for _ in 0..12 {
        session.advance_time(360).unwrap();
    }
    session.dispatch("complete_fragmented_handoff").unwrap();

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
