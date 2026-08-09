use juris_mobile_bridge::MobileBridge;
use serde_json::{json, Value};

const CURRENT_GREENFIRE: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const ARCHIVED_GREENFIRE: &str = include_str!(
    "../../../content/archive/greenfire_first_72_hours/0.1.0/greenfire_first_72_hours.scenario.json"
);
const HISTORICAL_SAVE: &str = include_str!(
    "../../juris-engine/tests/fixtures/persistence/06e566a_losing_terminal_outcome.json"
);
const HISTORICAL_FINGERPRINT: &str =
    "b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261";

fn execute(bridge: &mut MobileBridge, request: Value) -> Value {
    serde_json::from_str(&bridge.execute_json(&request.to_string()))
        .expect("bridge response must be JSON")
}

fn definition(encoded: &str) -> Value {
    serde_json::from_str(encoded).expect("scenario must parse")
}

#[test]
fn save_inspection_preserves_parser_precedence_without_allocating_a_session() {
    let mut bridge = MobileBridge::new();
    let current = execute(
        &mut bridge,
        json!({
            "command": "create_session",
            "scenario": definition(CURRENT_GREENFIRE),
            "seed": 20260729
        }),
    );
    let current_id = current["session_id"].as_u64().unwrap();
    let current_snapshot = current["snapshot"].clone();
    assert_eq!(bridge.session_count(), 1);

    let inspected = execute(
        &mut bridge,
        json!({
            "command": "inspect_save",
            "encoded_save": HISTORICAL_SAVE
        }),
    );
    assert_eq!(inspected["type"], "save_inspected");
    assert_eq!(inspected["scenario_id"], "greenfire_first_72_hours");
    assert_eq!(inspected["scenario_fingerprint"], HISTORICAL_FINGERPRINT);
    assert_eq!(bridge.session_count(), 1);

    let mut unsupported: Value = serde_json::from_str(HISTORICAL_SAVE).unwrap();
    unsupported["runtime_compatibility"] = json!("scenario-runtime-future");
    unsupported["scenario_id"] = json!("absent_scenario");
    unsupported["scenario_fingerprint"] = json!("f".repeat(64));
    unsupported["commands"][0]["command"] = json!("future_command");

    for (encoded_save, code) in [
        (unsupported.to_string(), "incompatible_runtime"),
        (
            {
                unsupported["runtime_compatibility"] = json!("scenario-runtime-v1");
                unsupported.to_string()
            },
            "unknown_save_command",
        ),
        ("{malformed".to_owned(), "invalid_save_json"),
    ] {
        let rejected = execute(
            &mut bridge,
            json!({
                "command": "inspect_save",
                "encoded_save": encoded_save
            }),
        );
        assert_eq!(rejected["type"], "error");
        assert_eq!(rejected["code"], code);
        assert_eq!(bridge.session_count(), 1);
        let active = execute(
            &mut bridge,
            json!({"command": "snapshot", "session_id": current_id}),
        );
        assert_eq!(active["snapshot"], current_snapshot);
    }
}

#[test]
fn raw_bridge_loads_retained_content_and_rejects_unknown_identity_atomically() {
    let mut bridge = MobileBridge::new();
    assert!(definition(ARCHIVED_GREENFIRE)
        .get("pressure_windows")
        .is_none());
    let current = execute(
        &mut bridge,
        json!({
            "command": "create_session",
            "scenario": definition(CURRENT_GREENFIRE),
            "seed": 20260729
        }),
    );
    let current_id = current["session_id"].as_u64().unwrap();
    assert_eq!(bridge.session_count(), 1);

    let loaded = execute(
        &mut bridge,
        json!({
            "command": "load_session",
            "scenario": definition(ARCHIVED_GREENFIRE),
            "encoded_save": HISTORICAL_SAVE
        }),
    );
    assert_eq!(loaded["type"], "session_loaded");
    assert_eq!(
        loaded["snapshot"]["resolved_outcome"],
        "compromised_crisis_position"
    );
    assert!(loaded["snapshot"].get("pressure_windows").is_none());
    let historical_id = loaded["session_id"].as_u64().unwrap();
    assert_ne!(historical_id, current_id);
    assert_eq!(bridge.session_count(), 2);

    let saved = execute(
        &mut bridge,
        json!({"command": "save_session", "session_id": historical_id}),
    );
    let encoded_save = saved["encoded_save"].as_str().unwrap().to_owned();
    let envelope: Value = serde_json::from_str(&encoded_save).unwrap();
    assert_eq!(envelope.as_object().unwrap().len(), 8);
    assert_eq!(envelope["runtime_compatibility"], "scenario-runtime-v2");
    assert_eq!(envelope["scenario_fingerprint"], HISTORICAL_FINGERPRINT);

    let disposed = execute(
        &mut bridge,
        json!({"command": "dispose_session", "session_id": historical_id}),
    );
    assert_eq!(disposed["disposed"], true);
    assert_eq!(bridge.session_count(), 1);

    let reloaded = execute(
        &mut bridge,
        json!({
            "command": "load_session",
            "scenario": definition(ARCHIVED_GREENFIRE),
            "encoded_save": encoded_save
        }),
    );
    assert_eq!(reloaded["snapshot"], loaded["snapshot"]);
    let reloaded_id = reloaded["session_id"].as_u64().unwrap();
    assert_eq!(bridge.session_count(), 2);

    let mut unknown: Value = serde_json::from_str(HISTORICAL_SAVE).unwrap();
    unknown["scenario_fingerprint"] = json!("f".repeat(64));
    for (candidate, code) in [
        (unknown.to_string(), "scenario_fingerprint_mismatch"),
        ("{malformed".to_owned(), "invalid_save_json"),
    ] {
        let rejected = execute(
            &mut bridge,
            json!({
                "command": "load_session",
                "scenario": definition(ARCHIVED_GREENFIRE),
                "encoded_save": candidate
            }),
        );
        assert_eq!(rejected["type"], "error");
        assert_eq!(rejected["code"], code);
        assert_eq!(bridge.session_count(), 2);
        let active = execute(
            &mut bridge,
            json!({"command": "snapshot", "session_id": reloaded_id}),
        );
        assert_eq!(active["snapshot"], reloaded["snapshot"]);
    }
}
