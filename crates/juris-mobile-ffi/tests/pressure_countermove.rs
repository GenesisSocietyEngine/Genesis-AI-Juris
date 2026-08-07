use std::ffi::{CStr, CString};

use juris_mobile_ffi::{
    juris_mobile_bridge_abi_version, juris_mobile_bridge_execute, juris_mobile_bridge_string_free,
};
use serde_json::{json, Value};

const FIXTURE: &str =
    include_str!("../../juris-engine/tests/fixtures/pressure_countermove_runtime.json");

fn execute(request: Value) -> Value {
    let request = CString::new(request.to_string()).unwrap();
    // SAFETY: `request` is a live NUL-terminated string for this call.
    let response = unsafe { juris_mobile_bridge_execute(request.as_ptr()) };
    assert!(!response.is_null());
    // SAFETY: The native function returned an owned NUL-terminated response.
    let encoded = unsafe { CStr::from_ptr(response) }
        .to_string_lossy()
        .into_owned();
    // SAFETY: `response` came from the bridge and has not been freed.
    unsafe { juris_mobile_bridge_string_free(response) };
    serde_json::from_str(&encoded).unwrap()
}

#[test]
fn existing_three_symbol_c_abi_carries_pressure_projection() {
    assert_eq!(juris_mobile_bridge_abi_version(), 1);
    let scenario: Value = serde_json::from_str(FIXTURE).unwrap();
    let created = execute(json!({
        "command": "create_session",
        "scenario": scenario,
        "seed": 73
    }));
    assert_eq!(created["type"], "session_created");
    assert!(created["snapshot"]
        .get("pressure_and_countermove")
        .is_none());
    let session_id = created["session_id"].as_u64().unwrap();

    let activated = execute(json!({
        "command": "dispatch",
        "session_id": session_id,
        "action_id": "receive-demand"
    }));
    assert_eq!(
        activated["snapshot"]["pressure_and_countermove"]["projection_schema_version"],
        1
    );
    assert_eq!(
        activated["snapshot"]["pressure_and_countermove"]["active_pressures"][0]
            ["available_response_action_ids"],
        json!(["file-documented-response", "negotiate-extension"])
    );

    let missed = execute(json!({
        "command": "advance_time",
        "session_id": session_id,
        "minutes": 60
    }));
    assert!(missed["snapshot"].get("pressure_and_countermove").is_none());
    assert_eq!(
        missed["snapshot"]["numeric_metrics"]["countermove_cost"],
        25
    );
}
