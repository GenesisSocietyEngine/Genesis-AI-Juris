use juris_mobile_bridge::{BridgeRequest, BridgeResponse, MobileBridge};
use juris_scenario_schema::ScenarioDefinition;
use serde_json::{json, Value};

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

#[test]
fn decoded_protocol_creates_dispatches_and_disposes_a_session() {
    let mut bridge = MobileBridge::new();
    let created = bridge.execute(BridgeRequest::CreateSession {
        scenario: Box::new(logistics_definition()),
        seed: 20260725,
    });
    let BridgeResponse::SessionCreated {
        session_id,
        snapshot,
    } = created
    else {
        panic!("expected session_created response");
    };
    assert_eq!(snapshot.stage_id, "intake");

    let response = bridge.execute(BridgeRequest::Dispatch {
        session_id,
        action_id: "audit_claim_file".to_owned(),
    });
    let BridgeResponse::Snapshot { snapshot, .. } = response else {
        panic!("expected snapshot response");
    };
    assert_eq!(snapshot.stage_id, "pre_action");

    assert_eq!(
        bridge.execute(BridgeRequest::DisposeSession { session_id }),
        BridgeResponse::SessionDisposed {
            session_id,
            disposed: true
        }
    );
    assert_eq!(bridge.session_count(), 0);
}

#[test]
fn decoded_protocol_advances_foreground_time_across_boundaries() {
    let mut bridge = MobileBridge::new();
    let BridgeResponse::SessionCreated { session_id, .. } =
        bridge.execute(BridgeRequest::CreateSession {
            scenario: Box::new(greenfire_definition()),
            seed: 20260729,
        })
    else {
        panic!("expected session_created response");
    };
    bridge.execute(BridgeRequest::Dispatch {
        session_id,
        action_id: "accept_emergency_mandate".to_owned(),
    });

    let response = bridge.execute(BridgeRequest::AdvanceTime {
        session_id,
        minutes: 360,
    });
    let BridgeResponse::Snapshot { snapshot, .. } = response else {
        panic!("expected snapshot response");
    };

    assert_eq!(snapshot.clock_minutes, 390);
    assert_eq!(snapshot.clock_mode, "foreground");
    assert!(snapshot
        .fired_event_ids
        .contains(&"regulator_request_received".to_owned()));
    assert!(snapshot
        .fired_event_ids
        .contains(&"legal_hold_missed".to_owned()));
}

#[test]
fn clock_protocol_returns_stable_policy_and_validation_errors() {
    let mut bridge = MobileBridge::new();
    let BridgeResponse::SessionCreated { session_id, .. } =
        bridge.execute(BridgeRequest::CreateSession {
            scenario: Box::new(logistics_definition()),
            seed: 1,
        })
    else {
        panic!("expected session_created response");
    };

    for (request, expected) in [
        (
            BridgeRequest::AdvanceTime {
                session_id,
                minutes: 1,
            },
            "clock_advance_unsupported",
        ),
        (
            BridgeRequest::AdvanceTime {
                session_id: 999,
                minutes: 1,
            },
            "unknown_session",
        ),
    ] {
        let BridgeResponse::Error { code, .. } = bridge.execute(request) else {
            panic!("expected error response");
        };
        assert_eq!(code, expected);
    }

    let BridgeResponse::SessionCreated {
        session_id: foreground_id,
        ..
    } = bridge.execute(BridgeRequest::CreateSession {
        scenario: Box::new(greenfire_definition()),
        seed: 1,
    })
    else {
        panic!("expected session_created response");
    };
    let BridgeResponse::Error { code, .. } = bridge.execute(BridgeRequest::AdvanceTime {
        session_id: foreground_id,
        minutes: 0,
    }) else {
        panic!("expected error response");
    };
    assert_eq!(code, "invalid_clock_advance");
}

#[test]
fn json_protocol_runs_the_logistics_judgment_path() {
    let mut bridge = MobileBridge::new();
    let scenario: Value = serde_json::from_str(LOGISTICS_SCENARIO).unwrap();
    let created: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "create_session",
                "scenario": scenario,
                "seed": 20260725
            })
            .to_string(),
        ),
    )
    .unwrap();
    let session_id = created["session_id"].as_u64().unwrap();

    for action_id in [
        "audit_claim_file",
        "issue_formal_demand",
        "request_judgment",
        "enforce_judgment",
    ] {
        let response: Value = serde_json::from_str(
            &bridge.execute_json(
                &json!({
                    "command": "dispatch",
                    "session_id": session_id,
                    "action_id": action_id
                })
                .to_string(),
            ),
        )
        .unwrap();
        assert_ne!(response["type"], "error");
    }

    let final_snapshot: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "snapshot",
                "session_id": session_id
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(final_snapshot["snapshot"]["terminal"], true);
    assert_eq!(
        final_snapshot["snapshot"]["outcome"]["id"],
        "judgment_recovery"
    );
}

#[test]
fn malformed_and_unavailable_commands_return_stable_errors() {
    let mut bridge = MobileBridge::new();
    let malformed: Value =
        serde_json::from_str(&bridge.execute_json("{not json")).expect("response must be JSON");
    assert_eq!(malformed["type"], "error");
    assert_eq!(malformed["code"], "invalid_request");

    let unavailable = bridge.execute(BridgeRequest::Dispatch {
        session_id: 999,
        action_id: "audit_claim_file".to_owned(),
    });
    let BridgeResponse::Error { code, .. } = unavailable else {
        panic!("expected error response");
    };
    assert_eq!(code, "unknown_session");
}

#[test]
fn json_protocol_runs_the_greenfire_protected_path() {
    let mut bridge = MobileBridge::new();
    let scenario: Value = serde_json::from_str(GREENFIRE_SCENARIO).unwrap();
    let created: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "create_session",
                "scenario": scenario,
                "seed": 20260729
            })
            .to_string(),
        ),
    )
    .unwrap();
    let session_id = created["session_id"].as_u64().unwrap();

    for action_id in [
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
        let response: Value = serde_json::from_str(
            &bridge.execute_json(
                &json!({
                    "command": "dispatch",
                    "session_id": session_id,
                    "action_id": action_id
                })
                .to_string(),
            ),
        )
        .unwrap();
        assert_ne!(response["type"], "error", "failed action {action_id}");
    }

    let snapshot: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "snapshot",
                "session_id": session_id
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(
        snapshot["snapshot"]["outcome"]["id"],
        "protected_crisis_position"
    );
    assert_eq!(snapshot["snapshot"]["clock_minutes"], 4_440);
    assert_eq!(snapshot["snapshot"]["clock_mode"], "foreground");

    let after_terminal: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "advance_time",
                "session_id": session_id,
                "minutes": 1
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(after_terminal["type"], "error");
    assert_eq!(after_terminal["code"], "scenario_resolved");
}

#[test]
fn json_protocol_runs_the_goldenshell_coordinated_path() {
    let mut bridge = MobileBridge::new();
    let scenario: Value = serde_json::from_str(GOLDENSHELL_SCENARIO).unwrap();
    let created: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "create_session",
                "scenario": scenario,
                "seed": 20260730
            })
            .to_string(),
        ),
    )
    .unwrap();
    let session_id = created["session_id"].as_u64().unwrap();

    for action_id in [
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
        let response: Value = serde_json::from_str(
            &bridge.execute_json(
                &json!({
                    "command": "dispatch",
                    "session_id": session_id,
                    "action_id": action_id
                })
                .to_string(),
            ),
        )
        .unwrap();
        assert_ne!(response["type"], "error", "failed action {action_id}");
    }

    let snapshot: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "snapshot",
                "session_id": session_id
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(
        snapshot["snapshot"]["outcome"]["id"],
        "coordinated_claim_position"
    );
    assert_eq!(snapshot["snapshot"]["clock_minutes"], 4_545);
    assert_eq!(snapshot["snapshot"]["terminal"], true);
    assert_eq!(
        snapshot["snapshot"]["available_actions"]
            .as_array()
            .unwrap()
            .len(),
        0
    );
}
