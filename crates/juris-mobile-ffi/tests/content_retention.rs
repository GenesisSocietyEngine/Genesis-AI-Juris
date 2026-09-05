use std::ffi::{CStr, CString};

use juris_mobile_ffi::{
    juris_mobile_bridge_abi_version, juris_mobile_bridge_execute, juris_mobile_bridge_string_free,
};
use serde_json::{json, Value};

const ARCHIVED_GREENFIRE: &str = include_str!(
    "../../../content/archive/greenfire_first_72_hours/0.1.0/greenfire_first_72_hours.scenario.json"
);
const HISTORICAL_SAVE: &str = include_str!(
    "../../juris-engine/tests/fixtures/persistence/06e566a_losing_terminal_outcome.json"
);
const HISTORICAL_FINGERPRINT: &str =
    "b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261";

fn execute(request: Value) -> Value {
    let request = CString::new(request.to_string()).unwrap();
    // SAFETY: `request` remains a live NUL-terminated string for this call.
    let response = unsafe { juris_mobile_bridge_execute(request.as_ptr()) };
    assert!(!response.is_null());
    // SAFETY: The FFI returned an owned NUL-terminated response.
    let encoded = unsafe { CStr::from_ptr(response) }
        .to_str()
        .expect("FFI response must be UTF-8")
        .to_owned();
    // SAFETY: This is the first and only release of this response pointer.
    unsafe { juris_mobile_bridge_string_free(response) };
    serde_json::from_str(&encoded).expect("FFI response must be JSON")
}

fn archived_definition() -> Value {
    serde_json::from_str(ARCHIVED_GREENFIRE).expect("archived scenario must parse")
}

#[test]
fn c_abi_v1_round_trips_a_historical_definition_without_identity_promotion() {
    assert_eq!(juris_mobile_bridge_abi_version(), 1);
    assert!(archived_definition().get("pressure_windows").is_none());
    let loaded = execute(json!({
        "command": "load_session",
        "scenario": archived_definition(),
        "encoded_save": HISTORICAL_SAVE
    }));
    assert_eq!(loaded["type"], "session_loaded");
    assert_eq!(
        loaded["snapshot"]["resolved_outcome"],
        "compromised_crisis_position"
    );
    assert!(loaded["snapshot"].get("pressure_windows").is_none());
    let session_id = loaded["session_id"].as_u64().unwrap();

    let inspected = execute(json!({
        "command": "inspect_save",
        "encoded_save": HISTORICAL_SAVE
    }));
    assert_eq!(inspected["type"], "save_inspected");
    assert_eq!(inspected["scenario_id"], "greenfire_first_72_hours");
    assert_eq!(inspected["scenario_fingerprint"], HISTORICAL_FINGERPRINT);

    let mut unsupported: Value = serde_json::from_str(HISTORICAL_SAVE).unwrap();
    unsupported["runtime_compatibility"] = json!("scenario-runtime-future");
    unsupported["scenario_id"] = json!("absent_scenario");
    unsupported["scenario_fingerprint"] = json!("f".repeat(64));
    unsupported["commands"][0]["command"] = json!("future_command");
    let rejected = execute(json!({
        "command": "inspect_save",
        "encoded_save": unsupported.to_string()
    }));
    assert_eq!(rejected["code"], "incompatible_runtime");
    let active_after_inspection = execute(json!({"command": "snapshot", "session_id": session_id}));
    assert_eq!(active_after_inspection["snapshot"], loaded["snapshot"]);

    let saved = execute(json!({"command": "save_session", "session_id": session_id}));
    let encoded_save = saved["encoded_save"].as_str().unwrap().to_owned();
    let envelope: Value = serde_json::from_str(&encoded_save).unwrap();
    assert_eq!(envelope.as_object().unwrap().len(), 8);
    assert_eq!(envelope["runtime_compatibility"], "scenario-runtime-v2");
    assert_eq!(envelope["scenario_fingerprint"], HISTORICAL_FINGERPRINT);

    let mut unknown = envelope.clone();
    unknown["scenario_fingerprint"] = json!("f".repeat(64));
    let rejected = execute(json!({
        "command": "load_session",
        "scenario": archived_definition(),
        "encoded_save": unknown.to_string()
    }));
    assert_eq!(rejected["code"], "scenario_fingerprint_mismatch");
    let active = execute(json!({"command": "snapshot", "session_id": session_id}));
    assert_eq!(active["snapshot"], loaded["snapshot"]);

    let reloaded = execute(json!({
        "command": "load_session",
        "scenario": archived_definition(),
        "encoded_save": encoded_save
    }));
    assert_eq!(reloaded["snapshot"], loaded["snapshot"]);
}
