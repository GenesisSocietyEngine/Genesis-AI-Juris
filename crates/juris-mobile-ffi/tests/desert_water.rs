use std::ffi::{CStr, CString};

use juris_mobile_ffi::{
    juris_mobile_bridge_abi_version, juris_mobile_bridge_execute, juris_mobile_bridge_string_free,
};
use serde_json::{json, Value};

const DESERT_WATER_SCENARIO: &str =
    include_str!("../../../content/cases/desert_water_groundwater_claim.scenario.json");
const COORDINATED_TRACE: &str =
    include_str!("../../../content/traces/desert_water_coordinated.commands.json");

fn execute(request: Value) -> Value {
    let request = CString::new(request.to_string()).expect("request must not contain NUL");
    // SAFETY: request remains a valid NUL-terminated C string for the call.
    let response = unsafe { juris_mobile_bridge_execute(request.as_ptr()) };
    // SAFETY: the native boundary returns one valid owned C string.
    let encoded = unsafe { CStr::from_ptr(response) }
        .to_string_lossy()
        .into_owned();
    // SAFETY: response is returned exactly once and has not been freed.
    unsafe { juris_mobile_bridge_string_free(response) };
    serde_json::from_str(&encoded).expect("FFI response must be JSON")
}

#[test]
fn coordinated_desert_water_path_uses_the_unchanged_c_abi() {
    assert_eq!(juris_mobile_bridge_abi_version(), 1);
    let scenario: Value = serde_json::from_str(DESERT_WATER_SCENARIO).unwrap();
    let commands: Vec<Value> = serde_json::from_str(COORDINATED_TRACE).unwrap();
    let created = execute(json!({
        "command": "create_session",
        "scenario": scenario,
        "seed": 20260804
    }));
    assert_eq!(created["type"], "session_created");
    let session_id = created["session_id"].as_u64().unwrap();

    let mut last = Value::Null;
    for command in commands {
        let mut request = command;
        request["session_id"] = json!(session_id);
        last = execute(request.clone());
        assert_ne!(last["type"], "error", "failed command {request}: {last}");
    }

    assert_eq!(
        last["snapshot"]["scenario_id"],
        "desert_water_groundwater_claim"
    );
    assert_eq!(last["snapshot"]["clock_minutes"], 3_180);
    assert_eq!(last["snapshot"]["stage_id"], "resolved");
    assert_eq!(last["snapshot"]["judicial_result"], "won");
    assert_eq!(
        last["snapshot"]["judicial_decision_instance"],
        "first_instance"
    );
    assert_eq!(last["snapshot"]["matter_lifecycle"], "closed");
    assert_eq!(last["snapshot"]["is_closed"], true);
    assert_eq!(
        last["snapshot"]["outcome"]["id"],
        "credible_source_and_remedy"
    );
}
