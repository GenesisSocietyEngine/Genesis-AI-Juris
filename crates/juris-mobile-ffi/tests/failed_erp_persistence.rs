use std::ffi::{CStr, CString};

use juris_mobile_ffi::{
    juris_mobile_bridge_abi_version, juris_mobile_bridge_execute, juris_mobile_bridge_string_free,
};
use serde_json::{json, Value};

const FAILED_ERP_SCENARIO: &str = include_str!("../../../content/cases/failed_erp.scenario.json");
const SETTLEMENT_TRACE: &str =
    include_str!("../../../content/traces/failed_erp_settlement.commands.json");

fn execute(request: Value) -> Value {
    let request = CString::new(request.to_string()).unwrap();
    // SAFETY: `request` is a live NUL-terminated string for this call.
    let response = unsafe { juris_mobile_bridge_execute(request.as_ptr()) };
    assert!(!response.is_null());
    // SAFETY: The native function returned an owned NUL-terminated response.
    let encoded = unsafe { CStr::from_ptr(response) }
        .to_str()
        .expect("FFI response must be UTF-8")
        .to_owned();
    // SAFETY: This is the first and only release of the returned pointer.
    unsafe { juris_mobile_bridge_string_free(response) };
    serde_json::from_str(&encoded).expect("FFI response must be JSON")
}

fn scenario() -> Value {
    serde_json::from_str(FAILED_ERP_SCENARIO).expect("Failed ERP scenario must parse")
}

fn trace() -> Vec<Value> {
    serde_json::from_str(SETTLEMENT_TRACE).expect("settlement trace must parse")
}

fn snapshot(session_id: u64) -> Value {
    execute(json!({"command": "snapshot", "session_id": session_id}))["snapshot"].clone()
}

#[test]
fn failed_erp_save_load_and_atomic_failures_use_the_existing_c_abi() {
    assert_eq!(juris_mobile_bridge_abi_version(), 1);
    let created = execute(json!({
        "command": "create_session",
        "scenario": scenario(),
        "seed": 20_260_724
    }));
    assert_eq!(created["type"], "session_created");
    let active_id = created["session_id"].as_u64().unwrap();

    let commands = trace();
    for command in commands.iter().take(2) {
        let response = execute(json!({
            "command": "dispatch",
            "session_id": active_id,
            "action_id": command["action_id"]
        }));
        assert_eq!(response["type"], "snapshot");
    }
    let before = snapshot(active_id);
    let saved = execute(json!({"command": "save_session", "session_id": active_id}));
    let encoded = saved["encoded_save"].as_str().unwrap().to_owned();

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
        let rejected = execute(json!({
            "command": "load_session",
            "scenario": scenario(),
            "encoded_save": encoded_save
        }));
        assert_eq!(rejected["type"], "error");
        assert_eq!(rejected["code"], expected_code);
        assert_eq!(snapshot(active_id), before);
    }

    let settled = execute(json!({
        "command": "dispatch",
        "session_id": active_id,
        "action_id": commands[2]["action_id"]
    }));
    assert_eq!(settled["snapshot"]["resolved_outcome"], "settlement_64500");

    let loaded = execute(json!({
        "command": "load_session",
        "scenario": scenario(),
        "encoded_save": encoded
    }));
    assert_eq!(loaded["type"], "session_loaded");
    assert_eq!(loaded["snapshot"], before);
    assert_ne!(loaded["session_id"], active_id);
}
