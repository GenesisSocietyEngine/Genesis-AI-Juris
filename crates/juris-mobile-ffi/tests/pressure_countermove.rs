use std::ffi::{CStr, CString};

use juris_mobile_ffi::{
    juris_mobile_bridge_abi_version, juris_mobile_bridge_execute, juris_mobile_bridge_string_free,
};
use serde_json::{json, Value};

const FIXTURE: &str =
    include_str!("../../juris-engine/tests/fixtures/pressure_countermove_runtime.json");
const GREENFIRE_SCENARIO: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");

fn execute_raw(request: Value) -> String {
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
    encoded
}

fn execute(request: Value) -> Value {
    serde_json::from_str(&execute_raw(request)).unwrap()
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

#[test]
fn existing_execute_symbol_runs_greenfire_production_pressure_lifecycle() {
    assert_eq!(juris_mobile_bridge_abi_version(), 1);
    let created = execute(json!({
        "command": "create_session",
        "scenario": serde_json::from_str::<Value>(GREENFIRE_SCENARIO).unwrap(),
        "seed": 20260729
    }));
    assert_eq!(created["type"], "session_created");
    assert!(created["snapshot"]
        .get("pressure_and_countermove")
        .is_none());
    let original_id = created["session_id"].as_u64().unwrap();

    let accepted_raw = execute_raw(json!({
        "command": "dispatch",
        "session_id": original_id,
        "action_id": "accept_emergency_mandate"
    }));
    assert!(!accepted_raw.contains("regulator_document_request_pressure"));
    assert!(!accepted_raw.contains("regulatory_response_missed"));
    let accepted: Value = serde_json::from_str(&accepted_raw).unwrap();
    assert_eq!(accepted["snapshot"]["clock_minutes"], 30);
    assert!(accepted["snapshot"]
        .get("pressure_and_countermove")
        .is_none());

    let activated_raw = execute_raw(json!({
        "command": "advance_time",
        "session_id": original_id,
        "minutes": 90
    }));
    let activated: Value = serde_json::from_str(&activated_raw).unwrap();
    assert_eq!(
        activated["snapshot"]["pressure_and_countermove"],
        json!({
            "projection_schema_version": 1,
            "active_pressures": [{
                "pressure_id": "regulator_document_request_pressure",
                "source_actor_id": "port_haven_environment_authority",
                "due_at_minute": 2_160,
                "remaining_minutes": 2_040,
                "available_response_action_ids": ["release_unreviewed_documents"]
            }]
        })
    );

    let opened_raw = execute_raw(json!({
        "command": "dispatch",
        "session_id": original_id,
        "action_id": "open_controlled_regulator_channel"
    }));
    let opened: Value = serde_json::from_str(&opened_raw).unwrap();
    assert_eq!(
        opened["snapshot"]["pressure_and_countermove"],
        json!({
            "projection_schema_version": 1,
            "active_pressures": [{
                "pressure_id": "regulator_document_request_pressure",
                "source_actor_id": "port_haven_environment_authority",
                "due_at_minute": 2_160,
                "remaining_minutes": 1_980,
                "available_response_action_ids": [
                    "submit_initial_regulatory_response",
                    "release_unreviewed_documents"
                ]
            }]
        })
    );
    for (phase, raw) in [
        ("activation", &activated_raw),
        ("opened channel", &opened_raw),
    ] {
        for private in [
            "countermove_event_id",
            "regulatory_response_missed",
            "uncontrolled_disclosure",
            "\"effects\"",
        ] {
            assert!(
                !raw.contains(private),
                "{phase} FFI response leaked private pressure internals `{private}`: {raw}"
            );
        }
    }

    let expected_active_snapshot = opened["snapshot"].clone();
    let saved = execute(json!({
        "command": "save_session",
        "session_id": original_id
    }));
    assert_eq!(saved["type"], "session_saved");
    let encoded_save = saved["encoded_save"].as_str().unwrap().to_owned();
    let disposed = execute(json!({
        "command": "dispose_session",
        "session_id": original_id
    }));
    assert_eq!(disposed["disposed"], true);

    let loaded = execute(json!({
        "command": "load_session",
        "scenario": serde_json::from_str::<Value>(GREENFIRE_SCENARIO).unwrap(),
        "encoded_save": encoded_save
    }));
    assert_eq!(loaded["type"], "session_loaded");
    assert_eq!(loaded["snapshot"], expected_active_snapshot);
    let loaded_id = loaded["session_id"].as_u64().unwrap();
    assert_ne!(loaded_id, original_id);

    let responded_raw = execute_raw(json!({
        "command": "dispatch",
        "session_id": loaded_id,
        "action_id": "submit_initial_regulatory_response"
    }));
    let responded: Value = serde_json::from_str(&responded_raw).unwrap();
    assert_eq!(responded["snapshot"]["clock_minutes"], 360);
    assert!(responded["snapshot"]
        .get("pressure_and_countermove")
        .is_none());
    for private in [
        "countermove_event_id",
        "regulatory_response_missed",
        "uncontrolled_disclosure",
        "\"effects\"",
    ] {
        assert!(
            !responded_raw.contains(private),
            "controlled FFI response leaked private pressure internals `{private}`: {responded_raw}"
        );
    }

    let disposed = execute(json!({
        "command": "dispose_session",
        "session_id": loaded_id
    }));
    assert_eq!(disposed["disposed"], true);
}
