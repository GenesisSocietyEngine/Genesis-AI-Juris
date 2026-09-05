use juris_mobile_bridge::MobileBridge;
use serde_json::{json, Value};

const DESERT_WATER_SCENARIO: &str =
    include_str!("../../../content/cases/desert_water_groundwater_claim.scenario.json");
const COMPROMISED_TRACE: &str =
    include_str!("../../../content/traces/desert_water_compromised.commands.json");

fn execute(bridge: &mut MobileBridge, request: Value) -> Value {
    serde_json::from_str(&bridge.execute_json(&request.to_string()))
        .expect("bridge response must be JSON")
}

fn execute_commands(bridge: &mut MobileBridge, session_id: u64, commands: &[Value]) -> Value {
    let mut last = Value::Null;
    for command in commands {
        let mut request = command.clone();
        request["session_id"] = json!(session_id);
        last = execute(bridge, request.clone());
        assert_ne!(last["type"], "error", "failed command {request}: {last}");
    }
    last
}

#[test]
fn desert_water_loss_save_load_appeal_and_closure_cross_the_existing_bridge() {
    let scenario: Value = serde_json::from_str(DESERT_WATER_SCENARIO).unwrap();
    let commands: Vec<Value> = serde_json::from_str(COMPROMISED_TRACE).unwrap();
    let mut bridge = MobileBridge::new();
    let created = execute(
        &mut bridge,
        json!({
            "command": "create_session",
            "scenario": scenario,
            "seed": 20260804
        }),
    );
    assert_eq!(created["type"], "session_created");
    assert_eq!(
        created["snapshot"]["scenario_id"],
        "desert_water_groundwater_claim"
    );
    let session_id = created["session_id"].as_u64().unwrap();

    let lost = execute_commands(&mut bridge, session_id, &commands[..9]);
    assert_eq!(lost["snapshot"]["clock_minutes"], 3_180);
    assert_eq!(lost["snapshot"]["stage_id"], "post_judgment_remedies");
    assert_eq!(lost["snapshot"]["judicial_result"], "lost");
    assert_eq!(
        lost["snapshot"]["judicial_decision_instance"],
        "first_instance"
    );
    assert_eq!(lost["snapshot"]["matter_lifecycle"], "post_judgment");
    assert_eq!(lost["snapshot"]["is_closed"], false);
    assert_eq!(lost["snapshot"]["outcome"], Value::Null);
    assert_eq!(
        lost["snapshot"]["dossier"]["procedure"]["matter_status"],
        "recoverable"
    );
    let appeal = lost["snapshot"]["dossier"]["deadlines"]
        .as_array()
        .unwrap()
        .iter()
        .find(|deadline| deadline["id"] == "appeal_deadline")
        .expect("appeal deadline must be carried by the bridge");
    assert_eq!(appeal["status"], "open");
    assert_eq!(appeal["remedies"].as_array().unwrap().len(), 1);
    assert_eq!(appeal["remedies"][0]["action_id"], "file_appeal");

    let saved = execute(
        &mut bridge,
        json!({"command": "save_session", "session_id": session_id}),
    );
    assert_eq!(saved["type"], "session_saved");
    let encoded_save = saved["encoded_save"].as_str().unwrap();
    let envelope: Value = serde_json::from_str(encoded_save).unwrap();
    assert_eq!(envelope.as_object().unwrap().len(), 8);
    assert_eq!(envelope["runtime_compatibility"], "scenario-runtime-v2");
    assert!(envelope.get("dossier").is_none());

    let scenario: Value = serde_json::from_str(DESERT_WATER_SCENARIO).unwrap();
    let loaded = execute(
        &mut bridge,
        json!({
            "command": "load_session",
            "scenario": scenario,
            "encoded_save": encoded_save
        }),
    );
    assert_eq!(loaded["type"], "session_loaded");
    assert_eq!(loaded["snapshot"], lost["snapshot"]);
    let loaded_id = loaded["session_id"].as_u64().unwrap();

    let closed = execute_commands(&mut bridge, loaded_id, &commands[9..]);
    assert_eq!(closed["snapshot"]["clock_minutes"], 3_510);
    assert_eq!(closed["snapshot"]["stage_id"], "resolved");
    assert_eq!(closed["snapshot"]["judicial_result"], "lost");
    assert_eq!(closed["snapshot"]["judicial_decision_instance"], "appeal");
    assert_eq!(closed["snapshot"]["matter_lifecycle"], "closed");
    assert_eq!(closed["snapshot"]["is_closed"], true);
    assert_eq!(
        closed["snapshot"]["outcome"]["id"],
        "compromised_claim_closed"
    );

    for request in [
        json!({
            "command": "dispatch",
            "session_id": loaded_id,
            "action_id": "accept_residents_mandate"
        }),
        json!({
            "command": "advance_time",
            "session_id": loaded_id,
            "minutes": 1
        }),
    ] {
        let rejected = execute(&mut bridge, request);
        assert_eq!(rejected["type"], "error");
        assert_eq!(rejected["code"], "scenario_resolved");
    }
}
