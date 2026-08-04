use juris_mobile_bridge::{BridgeRequest, BridgeResponse, MobileBridge};
use juris_scenario_schema::ScenarioDefinition;
use serde_json::{json, Value};

const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const GREENFIRE_SCENARIO: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const GOLDENSHELL_SCENARIO: &str =
    include_str!("../../../content/cases/goldenshell_recall_at_dawn.scenario.json");
const GREENFIRE_PROTECTED_TRACE: &str =
    include_str!("../../../content/traces/greenfire_protected.commands.json");
const GOLDENSHELL_COORDINATED_TRACE: &str =
    include_str!("../../../content/traces/goldenshell_coordinated.commands.json");
const REMEDIES_SCENARIO: &str =
    include_str!("../../../content/fixtures/authoring/adverse_judgment_with_remedies.json");
const DOSSIER_SCENARIO: &str =
    include_str!("../../../content/fixtures/authoring/dossier_projection_v1.json");

fn logistics_definition() -> ScenarioDefinition {
    serde_json::from_str(LOGISTICS_SCENARIO).expect("Logistics scenario must parse")
}

fn greenfire_definition() -> ScenarioDefinition {
    serde_json::from_str(GREENFIRE_SCENARIO).expect("GreenFire scenario must parse")
}

fn extended_projection_scenario() -> Value {
    json!({
        "schema_version": "1.0",
        "metadata": {
            "id": "bridge_projection_fixture",
            "title": "Bridge projection fixture",
            "summary": "Exercises additive integer projections over the JSON bridge.",
            "content_version": "1"
        },
        "jurisdiction": {
            "code": "BE",
            "pack_version": "test-1"
        },
        "initial_stage": "intake",
        "numeric_metrics": {
            "case_strength": 40
        },
        "initial_resources": {
            "authorized_budget_eur": 25000,
            "review_credits": 2
        },
        "stages": [
            {
                "id": "intake",
                "title": "Intake",
                "kind": "standard",
                "exit_actions": ["perform_review"]
            },
            {
                "id": "review",
                "title": "Review",
                "kind": "standard",
                "exit_actions": ["overflow_metric", "close_matter"]
            },
            {
                "id": "resolved",
                "title": "Resolved",
                "kind": "resolved",
                "terminal": true
            }
        ],
        "actions": [
            {
                "id": "perform_review",
                "title": "Perform review",
                "available_when": {"type": "stage_is", "stage": "intake"},
                "effects": [
                    {"type": "add_metric", "metric": "case_strength", "amount": 7},
                    {"type": "add_resource", "resource": "review_credits", "amount": 3},
                    {"type": "set_stage", "stage": "review"}
                ],
                "time_cost_minutes": 90,
                "cost_eur": 350,
                "billable_minutes": 60
            },
            {
                "id": "overflow_metric",
                "title": "Overflow metric",
                "available_when": {"type": "stage_is", "stage": "review"},
                "effects": [
                    {"type": "add_resource", "resource": "review_credits", "amount": 100},
                    {"type": "add_metric", "metric": "case_strength", "amount": i64::MAX}
                ],
                "time_cost_minutes": 15,
                "cost_eur": 999,
                "billable_minutes": 999,
                "repeatability": {"type": "unlimited"}
            },
            {
                "id": "close_matter",
                "title": "Close matter",
                "available_when": {"type": "stage_is", "stage": "review"},
                "effects": [
                    {"type": "set_stage", "stage": "resolved"},
                    {"type": "trigger_event", "event": "matter_closed"}
                ],
                "time_cost_minutes": 5,
                "cost_eur": 150,
                "billable_minutes": 30
            }
        ],
        "events": [{
            "id": "matter_closed",
            "title": "Matter closed",
            "kind": "matter_closed",
            "trigger": {"type": "by_effect"},
            "condition": {"type": "stage_is", "stage": "resolved"},
            "effects": [{"type": "resolve_outcome", "outcome": "successful_closure"}]
        }],
        "outcomes": [{
            "id": "successful_closure",
            "title": "Successful closure",
            "summary": "The projection fixture completed.",
            "terminal_stage": "resolved",
            "condition": {"type": "stage_is", "stage": "resolved"}
        }]
    })
}

fn execute_trace(bridge: &mut MobileBridge, session_id: u64, encoded: &str) {
    let commands: Vec<Value> = serde_json::from_str(encoded).unwrap();
    for mut command in commands {
        command["session_id"] = json!(session_id);
        let response: Value =
            serde_json::from_str(&bridge.execute_json(&command.to_string())).unwrap();
        assert_ne!(response["type"], "error", "failed command {command}");
    }
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
fn json_protocol_projects_and_atomically_updates_generic_integer_state() {
    let mut bridge = MobileBridge::new();
    let created: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "create_session",
                "scenario": extended_projection_scenario(),
                "seed": 17
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(created["type"], "session_created", "{created}");
    assert_eq!(created["snapshot"]["numeric_metrics"]["case_strength"], 40);
    assert_eq!(
        created["snapshot"]["resources"],
        json!({
            "authorized_budget_eur": 25000,
            "billable_minutes": 0,
            "review_credits": 2,
            "spend_eur": 0
        })
    );
    assert_eq!(
        created["snapshot"]["available_actions"][0]["billable_minutes"],
        60
    );
    let session_id = created["session_id"].as_u64().unwrap();

    let reviewed: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "dispatch",
                "session_id": session_id,
                "action_id": "perform_review"
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(reviewed["type"], "snapshot", "{reviewed}");
    assert_eq!(reviewed["snapshot"]["stage_id"], "review");
    assert_eq!(reviewed["snapshot"]["clock_minutes"], 90);
    assert_eq!(reviewed["snapshot"]["numeric_metrics"]["case_strength"], 47);
    assert_eq!(reviewed["snapshot"]["resources"]["review_credits"], 5);
    assert_eq!(reviewed["snapshot"]["resources"]["spend_eur"], 350);
    assert_eq!(reviewed["snapshot"]["resources"]["billable_minutes"], 60);

    let before_rejection = reviewed["snapshot"].clone();
    let rejected: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "dispatch",
                "session_id": session_id,
                "action_id": "overflow_metric"
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(rejected["type"], "error", "{rejected}");
    assert_eq!(rejected["code"], "integer_overflow");

    let after_rejection: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "snapshot",
                "session_id": session_id
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(after_rejection["snapshot"], before_rejection);

    let closed: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "dispatch",
                "session_id": session_id,
                "action_id": "close_matter"
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(closed["type"], "snapshot", "{closed}");
    assert_eq!(closed["snapshot"]["terminal"], true);
    assert_eq!(closed["snapshot"]["clock_minutes"], 95);
    assert_eq!(closed["snapshot"]["resources"]["spend_eur"], 500);
    assert_eq!(closed["snapshot"]["resources"]["billable_minutes"], 90);
}

#[test]
fn existing_scenario_snapshot_omits_additive_projection_keys() {
    let mut bridge = MobileBridge::new();
    let created: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "create_session",
                "scenario": serde_json::from_str::<Value>(LOGISTICS_SCENARIO).unwrap(),
                "seed": 20260725
            })
            .to_string(),
        ),
    )
    .unwrap();
    let snapshot = created["snapshot"].as_object().unwrap();

    assert!(!snapshot.contains_key("numeric_metrics"));
    assert!(!snapshot.contains_key("resources"));
    for action in snapshot["available_actions"].as_array().unwrap() {
        assert!(!action.as_object().unwrap().contains_key("billable_minutes"));
    }
}

#[test]
fn json_protocol_saves_and_loads_a_fresh_replayed_session() {
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
    let original_id = created["session_id"].as_u64().unwrap();
    for action_id in ["audit_claim_file", "issue_formal_demand"] {
        let response: Value = serde_json::from_str(
            &bridge.execute_json(
                &json!({
                    "command": "dispatch",
                    "session_id": original_id,
                    "action_id": action_id
                })
                .to_string(),
            ),
        )
        .unwrap();
        assert_ne!(response["type"], "error");
    }

    let saved: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "save_session",
                "session_id": original_id
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(saved["type"], "session_saved");
    let encoded_save = saved["encoded_save"].as_str().unwrap();
    let save: Value = serde_json::from_str(encoded_save).unwrap();
    assert_eq!(save["schema_id"], "genesis.ai-juris.command-log");
    assert_eq!(save["schema_version"], 1);
    assert_eq!(save["commands"].as_array().unwrap().len(), 2);

    let scenario: Value = serde_json::from_str(LOGISTICS_SCENARIO).unwrap();
    let loaded: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "load_session",
                "scenario": scenario,
                "encoded_save": encoded_save
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(loaded["type"], "session_loaded");
    assert_ne!(loaded["session_id"], original_id);
    assert_eq!(loaded["snapshot"]["stage_id"], "proceedings");
    assert_eq!(loaded["snapshot"]["clock_minutes"], 180);
    assert_eq!(bridge.session_count(), 2);
}

#[test]
fn failed_json_load_keeps_the_existing_session_intact() {
    let mut bridge = MobileBridge::new();
    let BridgeResponse::SessionCreated { session_id, .. } =
        bridge.execute(BridgeRequest::CreateSession {
            scenario: Box::new(logistics_definition()),
            seed: 17,
        })
    else {
        panic!("expected session_created response");
    };
    bridge.execute(BridgeRequest::Dispatch {
        session_id,
        action_id: "audit_claim_file".to_owned(),
    });
    let before = bridge.execute(BridgeRequest::Snapshot { session_id });

    let response = bridge.execute(BridgeRequest::LoadSession {
        scenario: Box::new(logistics_definition()),
        encoded_save: "{truncated".to_owned(),
    });
    let BridgeResponse::Error { code, .. } = response else {
        panic!("expected controlled load error");
    };
    assert_eq!(code, "invalid_save_json");
    assert_eq!(bridge.session_count(), 1);
    assert_eq!(
        bridge.execute(BridgeRequest::Snapshot { session_id }),
        before
    );
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
    assert_eq!(
        snapshot["snapshot"]["judicial_decision_instance"],
        "first_instance"
    );
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
    assert_eq!(
        appeal["snapshot"]["judicial_decision_instance"],
        "first_instance"
    );
    assert_eq!(appeal["snapshot"]["is_closed"], false);

    let appeal_decision: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "dispatch",
                "session_id": session_id,
                "action_id": "appeal_success"
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(
        appeal_decision["snapshot"]["judicial_decision_instance"],
        "appeal"
    );
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

    execute_trace(&mut bridge, session_id, GREENFIRE_PROTECTED_TRACE);

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

    execute_trace(&mut bridge, session_id, GOLDENSHELL_COORDINATED_TRACE);

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

#[test]
fn json_protocol_carries_the_filtered_authoritative_dossier_additively() {
    let mut bridge = MobileBridge::new();
    let scenario: Value = serde_json::from_str(DOSSIER_SCENARIO).unwrap();
    let created: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "create_session",
                "scenario": scenario,
                "seed": 20260803
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(created["type"], "session_created");
    assert_eq!(
        created["snapshot"]["dossier"]["projection_schema_version"],
        1
    );
    assert_eq!(
        created["snapshot"]["dossier"]["procedure"]["matter_status"],
        "open"
    );
    let initial_dossier = created["snapshot"]["dossier"].to_string();
    for sentinel in [
        "sentinel_unknown_fact",
        "sentinel_unavailable_evidence",
        "sentinel_inactive_deadline",
        "sentinel_unfired_event",
        "sentinel_private_flag",
        "sentinel_future_activation_action",
        "sentinel_future_remedy_action",
        "final_loss",
    ] {
        assert!(
            !initial_dossier.contains(sentinel),
            "bridge dossier leaked `{sentinel}`: {initial_dossier}"
        );
    }

    let session_id = created["session_id"].as_u64().unwrap();
    let revealed: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "dispatch",
                "session_id": session_id,
                "action_id": "z_reveal_record"
            })
            .to_string(),
        ),
    )
    .unwrap();
    let revealed_dossier = revealed["snapshot"]["dossier"].to_string();
    assert!(revealed_dossier.contains("sentinel_unknown_fact"));
    assert!(revealed_dossier.contains("sentinel_unavailable_evidence"));
    assert!(!revealed_dossier.contains("sentinel_private_flag"));
    assert!(!revealed_dossier.contains("sentinel_unfired_event"));

    let adverse: Value = serde_json::from_str(
        &bridge.execute_json(
            &json!({
                "command": "dispatch",
                "session_id": session_id,
                "action_id": "a_receive_adverse_decision"
            })
            .to_string(),
        ),
    )
    .unwrap();
    assert_eq!(
        adverse["snapshot"]["dossier"]["procedure"]["matter_status"],
        "recoverable"
    );
    assert_eq!(adverse["snapshot"]["dossier"]["judicial_result"], "lost");
    assert_eq!(
        adverse["snapshot"]["dossier"]["judicial_decision_instance"],
        "first_instance"
    );
    assert_eq!(
        adverse["snapshot"]["dossier"]["deadlines"][0]["id"],
        "a_review_deadline"
    );
}
