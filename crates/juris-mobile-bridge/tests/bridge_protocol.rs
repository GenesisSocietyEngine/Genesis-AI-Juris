use juris_mobile_bridge::{BridgeRequest, BridgeResponse, MobileBridge};
use juris_scenario_schema::ScenarioDefinition;
use serde_json::{json, Value};

const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const GREENFIRE_SCENARIO: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const REMEDIES_SCENARIO: &str =
    include_str!("../../../content/fixtures/authoring/adverse_judgment_with_remedies.json");

fn logistics_definition() -> ScenarioDefinition {
    serde_json::from_str(LOGISTICS_SCENARIO).expect("Logistics scenario must parse")
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
fn json_protocol_keeps_remedies_available_after_adverse_judgment() {
    let mut bridge = MobileBridge::new();
    let scenario: Value = serde_json::from_str(REMEDIES_SCENARIO).unwrap();
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

    for action_id in ["request_judgment", "adverse_trial_judgment"] {
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
    assert_eq!(snapshot["snapshot"]["judicial_result"], "lost");
    assert_eq!(snapshot["snapshot"]["matter_lifecycle"], "post_judgment");
    assert_eq!(snapshot["snapshot"]["is_closed"], false);
    assert_eq!(snapshot["snapshot"]["resolved_outcome"], Value::Null);
    assert!(snapshot["snapshot"]["available_actions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|action| action["id"] == "file_appeal"));

    let appeal: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "dispatch",
                "session_id": session_id,
                "action_id": "file_appeal"
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(appeal["snapshot"]["matter_lifecycle"], "appeal");
    assert_eq!(appeal["snapshot"]["is_closed"], false);
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
        let request = if command == "+360" {
            json!({
                "command": "advance_time",
                "session_id": session_id,
                "minutes": 360
            })
        } else {
            json!({
                "command": "dispatch",
                "session_id": session_id,
                "action_id": command
            })
        };
        let response: Value =
            serde_json::from_str(&bridge.execute_json(&request.to_string())).unwrap();
        assert_ne!(response["type"], "error", "failed command {command}");
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
}

#[test]
fn json_protocol_advances_authoritative_foreground_time() {
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

    let advanced: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "advance_time",
                "session_id": session_id,
                "minutes": 120
            })
            .to_string(),
        ),
    )
    .unwrap();

    assert_eq!(advanced["type"], "snapshot");
    assert_eq!(advanced["snapshot"]["clock_minutes"], 120);
    assert!(advanced["snapshot"]["fired_event_ids"]
        .as_array()
        .unwrap()
        .iter()
        .any(|event| event == "regulator_request_received"));
}
