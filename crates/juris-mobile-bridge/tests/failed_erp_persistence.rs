use juris_mobile_bridge::MobileBridge;
use serde_json::{json, Value};

const FAILED_ERP_SCENARIO: &str = include_str!("../../../content/cases/failed_erp.scenario.json");
const SETTLEMENT_TRACE: &str =
    include_str!("../../../content/traces/failed_erp_settlement.commands.json");
const SEED: u64 = 20_260_724;

fn scenario() -> Value {
    serde_json::from_str(FAILED_ERP_SCENARIO).expect("Failed ERP scenario must parse")
}

fn trace() -> Vec<Value> {
    serde_json::from_str(SETTLEMENT_TRACE).expect("settlement trace must parse")
}

fn execute(bridge: &mut MobileBridge, request: Value) -> Value {
    serde_json::from_str(&bridge.execute_json(&request.to_string()))
        .expect("bridge response must be JSON")
}

fn create(bridge: &mut MobileBridge) -> u64 {
    let response = execute(
        bridge,
        json!({
            "command": "create_session",
            "scenario": scenario(),
            "seed": SEED
        }),
    );
    assert_eq!(response["type"], "session_created");
    response["session_id"].as_u64().unwrap()
}

fn dispatch_trace_prefix(bridge: &mut MobileBridge, session_id: u64, count: usize) -> Value {
    let mut response = Value::Null;
    for command in trace().into_iter().take(count) {
        response = execute(
            bridge,
            json!({
                "command": "dispatch",
                "session_id": session_id,
                "action_id": command["action_id"]
            }),
        );
        assert_eq!(response["type"], "snapshot");
    }
    response
}

fn save(bridge: &mut MobileBridge, session_id: u64) -> String {
    let response = execute(
        bridge,
        json!({"command": "save_session", "session_id": session_id}),
    );
    assert_eq!(response["type"], "session_saved");
    response["encoded_save"].as_str().unwrap().to_owned()
}

fn snapshot(bridge: &mut MobileBridge, session_id: u64) -> Value {
    execute(
        bridge,
        json!({"command": "snapshot", "session_id": session_id}),
    )["snapshot"]
        .clone()
}

#[test]
fn failed_erp_save_load_round_trip_crosses_the_json_bridge_without_projection_loss() {
    let mut bridge = MobileBridge::new();
    let original_id = create(&mut bridge);
    let original_response = dispatch_trace_prefix(&mut bridge, original_id, 3);
    assert_eq!(
        original_response["snapshot"]["resolved_outcome"],
        "settlement_64500"
    );

    let encoded = save(&mut bridge, original_id);
    let envelope: Value = serde_json::from_str(&encoded).unwrap();
    assert_eq!(envelope["schema_id"], "genesis.ai-juris.command-log");
    assert_eq!(envelope["schema_version"], 1);
    assert_eq!(envelope["runtime_compatibility"], "scenario-runtime-v2");
    assert_eq!(envelope.as_object().unwrap().len(), 8);

    let loaded = execute(
        &mut bridge,
        json!({
            "command": "load_session",
            "scenario": scenario(),
            "encoded_save": encoded
        }),
    );
    assert_eq!(loaded["type"], "session_loaded");
    let loaded_id = loaded["session_id"].as_u64().unwrap();
    assert_ne!(loaded_id, original_id);
    assert_eq!(loaded["snapshot"], original_response["snapshot"]);
    assert_eq!(save(&mut bridge, loaded_id), encoded);
    assert_eq!(bridge.session_count(), 2);
}

#[test]
fn failed_erp_bridge_load_failures_are_controlled_and_leave_the_session_usable() {
    let mut bridge = MobileBridge::new();
    let active_id = create(&mut bridge);
    dispatch_trace_prefix(&mut bridge, active_id, 2);
    let before = snapshot(&mut bridge, active_id);
    let encoded = save(&mut bridge, active_id);

    let mut corrupted: Value = serde_json::from_str(&encoded).unwrap();
    corrupted["final_state_digest"] = json!("f".repeat(64));
    let corrupted = serde_json::to_string(&corrupted).unwrap();

    let mut unsupported: Value = serde_json::from_str(&encoded).unwrap();
    unsupported["runtime_compatibility"] = json!("scenario-runtime-future");
    unsupported["commands"] = json!([{"command": "future_command"}]);
    let unsupported = serde_json::to_string(&unsupported).unwrap();

    for (encoded_save, expected_code) in [
        ("{corrupted".to_owned(), "invalid_save_json"),
        (corrupted, "save_integrity_mismatch"),
        (unsupported, "incompatible_runtime"),
    ] {
        for _ in 0..2 {
            let response = execute(
                &mut bridge,
                json!({
                    "command": "load_session",
                    "scenario": scenario(),
                    "encoded_save": encoded_save
                }),
            );
            assert_eq!(response["type"], "error");
            assert_eq!(response["code"], expected_code);
            assert_eq!(bridge.session_count(), 1);
            assert_eq!(snapshot(&mut bridge, active_id), before);
            assert_eq!(save(&mut bridge, active_id), encoded);
        }
    }

    let final_command = trace().remove(2);
    let settled = execute(
        &mut bridge,
        json!({
            "command": "dispatch",
            "session_id": active_id,
            "action_id": final_command["action_id"]
        }),
    );
    assert_eq!(settled["snapshot"]["resolved_outcome"], "settlement_64500");
}
