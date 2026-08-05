//! Minimal C ABI used by the Flutter Android and iOS clients.
//!
//! The ABI intentionally exchanges only owned UTF-8 JSON strings. Protocol
//! evolution therefore remains in `juris-mobile-bridge`, while this crate is a
//! thin lifecycle and memory-ownership boundary.

use std::{
    ffi::{c_char, CStr, CString},
    panic::{catch_unwind, AssertUnwindSafe},
    sync::{Mutex, OnceLock},
};

use juris_mobile_bridge::MobileBridge;

static BRIDGE: OnceLock<Mutex<MobileBridge>> = OnceLock::new();

fn bridge() -> &'static Mutex<MobileBridge> {
    BRIDGE.get_or_init(|| Mutex::new(MobileBridge::new()))
}

fn error_json(code: &str, message: &str) -> String {
    serde_json::json!({
        "type": "error",
        "code": code,
        "message": message,
    })
    .to_string()
}

fn response_c_string(response: String) -> *mut c_char {
    CString::new(response)
        .unwrap_or_else(|_| {
            CString::new(error_json(
                "invalid_response",
                "bridge response contained an interior NUL byte",
            ))
            .expect("static bridge error must be a valid C string")
        })
        .into_raw()
}

/// Executes one JSON bridge request.
///
/// The returned string is owned by Rust and must be released exactly once with
/// [`juris_mobile_bridge_string_free`].
///
/// # Safety
///
/// `request` must be a non-null pointer to a valid NUL-terminated byte string
/// for the duration of this call.
#[no_mangle]
pub unsafe extern "C" fn juris_mobile_bridge_execute(request: *const c_char) -> *mut c_char {
    if request.is_null() {
        return response_c_string(error_json(
            "invalid_request_pointer",
            "request pointer must not be null",
        ));
    }

    let result = catch_unwind(AssertUnwindSafe(|| {
        // SAFETY: The caller contract requires a valid NUL-terminated string.
        let encoded = unsafe { CStr::from_ptr(request) };
        let encoded = match encoded.to_str() {
            Ok(value) => value,
            Err(error) => {
                return error_json(
                    "invalid_request_utf8",
                    &format!("request must be valid UTF-8: {error}"),
                );
            }
        };

        match bridge().lock() {
            Ok(mut endpoint) => endpoint.execute_json(encoded),
            Err(_) => error_json(
                "bridge_lock_poisoned",
                "the process bridge is unavailable after an internal failure",
            ),
        }
    }));

    response_c_string(result.unwrap_or_else(|_| {
        error_json(
            "bridge_panic",
            "the native bridge rejected an unexpected internal panic",
        )
    }))
}

/// Releases a response returned by [`juris_mobile_bridge_execute`].
///
/// Passing `null` is a no-op.
///
/// # Safety
///
/// `response` must be null or a pointer returned by
/// [`juris_mobile_bridge_execute`] that has not already been released.
#[no_mangle]
pub unsafe extern "C" fn juris_mobile_bridge_string_free(response: *mut c_char) {
    if response.is_null() {
        return;
    }

    // SAFETY: The caller contract transfers back one pointer created with
    // `CString::into_raw`, exactly once.
    drop(unsafe { CString::from_raw(response) });
}

/// Returns a stable ABI version without allocating memory.
#[no_mangle]
pub extern "C" fn juris_mobile_bridge_abi_version() -> u32 {
    1
}

/// Test-only helper keeps null-pointer behavior observable without requiring a
/// caller to dereference the returned pointer.
#[cfg(test)]
fn execute_null_request() -> String {
    // SAFETY: A null request is explicitly supported and returns an error.
    let response = unsafe { juris_mobile_bridge_execute(std::ptr::null()) };
    // SAFETY: The bridge always returns one valid owned C string.
    let decoded = unsafe { CStr::from_ptr(response) }
        .to_string_lossy()
        .into_owned();
    // SAFETY: `response` has not been released yet.
    unsafe { juris_mobile_bridge_string_free(response) };
    decoded
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    const LOGISTICS_SCENARIO: &str =
        include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
    const GREENFIRE_SCENARIO: &str =
        include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
    const GOLDENSHELL_SCENARIO: &str =
        include_str!("../../../content/cases/goldenshell_recall_at_dawn.scenario.json");
    const REMEDIES_SCENARIO: &str =
        include_str!("../../../content/fixtures/authoring/adverse_judgment_with_remedies.json");
    const DOSSIER_SCENARIO: &str =
        include_str!("../../../content/fixtures/authoring/dossier_projection_v1.json");

    const PRE_REVEAL_SNAPSHOT_SENTINELS: &[&str] = &[
        "sentinel_unknown_fact",
        "SENTINEL UNKNOWN FACT MUST NOT LEAK",
        "СКРЫТЫЙ ФАКТ RU",
        "sentinel_unavailable_evidence",
        "SENTINEL UNAVAILABLE EVIDENCE MUST NOT LEAK",
        "SENTINEL UNAVAILABLE DESCRIPTION MUST NOT LEAK",
        "СКРЫТОЕ ДОКАЗАТЕЛЬСТВО RU",
    ];

    const ALWAYS_HIDDEN_SNAPSHOT_SENTINELS: &[&str] = &[
        "sentinel_inactive_deadline",
        "SENTINEL INACTIVE DEADLINE MUST NOT LEAK",
        "СКРЫТЫЙ СРОК RU",
        "sentinel_inactive_deadline_missed",
        "SENTINEL INACTIVE MISSED EVENT MUST NOT LEAK",
        "sentinel_unfired_event",
        "SENTINEL UNFIRED EVENT MUST NOT LEAK",
        "sentinel_private_flag",
        "sentinel_future_gate",
        "sentinel_future_activation_action",
        "SENTINEL FUTURE ACTION MUST NOT LEAK",
        "SENTINEL FUTURE ACTION DESCRIPTION MUST NOT LEAK",
        "sentinel_future_remedy_action",
        "SENTINEL FUTURE REMEDY MUST NOT LEAK",
        "SENTINEL HIDDEN LOSS OUTCOME",
        "SENTINEL HIDDEN OUTCOME SUMMARY MUST NOT LEAK BEFORE CLOSURE",
    ];

    fn execute_request(request: Value) -> Value {
        let request = CString::new(request.to_string()).expect("request must be a C string");
        // SAFETY: `request` remains a valid C string for the complete call.
        let response = unsafe { juris_mobile_bridge_execute(request.as_ptr()) };
        // SAFETY: The bridge returns a valid owned C string.
        let decoded = unsafe { CStr::from_ptr(response) }
            .to_string_lossy()
            .into_owned();
        // SAFETY: `response` is released exactly once after decoding.
        unsafe { juris_mobile_bridge_string_free(response) };
        serde_json::from_str(&decoded).expect("FFI response must be valid JSON")
    }

    fn assert_snapshot_omits(snapshot: &Value, phase: &str, sentinels: &[&str]) {
        let raw_snapshot = snapshot.to_string();
        for sentinel in sentinels {
            assert!(
                !raw_snapshot.contains(sentinel),
                "{phase} raw FFI snapshot leaked `{sentinel}`: {raw_snapshot}"
            );
        }
    }

    fn assert_projection_ids(projection: &Value, key: &str, expected: &[&str], phase: &str) {
        let mut actual = projection[key]
            .as_array()
            .unwrap_or_else(|| panic!("{phase} `{key}` projection must be an array"))
            .iter()
            .map(|item| {
                item["id"]
                    .as_str()
                    .unwrap_or_else(|| panic!("{phase} `{key}` item must expose an ID"))
                    .to_owned()
            })
            .collect::<Vec<_>>();
        actual.sort();

        let mut expected = expected
            .iter()
            .map(|id| (*id).to_owned())
            .collect::<Vec<_>>();
        expected.sort();
        assert_eq!(actual, expected, "unexpected {phase} `{key}` projection");
    }

    fn assert_player_snapshot_ids(
        snapshot: &Value,
        phase: &str,
        facts: &[&str],
        evidence: &[&str],
        deadlines: &[&str],
        actions: &[&str],
    ) {
        assert_projection_ids(snapshot, "facts", facts, phase);
        assert_projection_ids(snapshot, "evidence", evidence, phase);
        assert_projection_ids(snapshot, "deadlines", deadlines, phase);
        assert_projection_ids(snapshot, "available_actions", actions, phase);
        assert_projection_ids(&snapshot["dossier"], "facts", facts, phase);
        assert_projection_ids(&snapshot["dossier"], "evidence", evidence, phase);
        assert_projection_ids(&snapshot["dossier"], "deadlines", deadlines, phase);
        assert_eq!(
            snapshot["flags"],
            json!({}),
            "{phase} flags must be private"
        );
        assert_eq!(
            snapshot["fired_event_ids"],
            json!([]),
            "{phase} event IDs must be private"
        );
    }

    #[test]
    fn null_request_returns_stable_error_and_abi_is_versioned() {
        assert_eq!(juris_mobile_bridge_abi_version(), 1);
        assert!(execute_null_request().contains("\"invalid_request_pointer\""));
    }

    #[test]
    fn malformed_json_round_trips_through_owned_c_strings() {
        let request = CString::new("{not-json").unwrap();
        // SAFETY: `request` is a valid C string for the complete call.
        let response = unsafe { juris_mobile_bridge_execute(request.as_ptr()) };
        // SAFETY: The bridge returned a valid C string.
        let decoded = unsafe { CStr::from_ptr(response) }
            .to_string_lossy()
            .into_owned();
        // SAFETY: The response is released exactly once.
        unsafe { juris_mobile_bridge_string_free(response) };

        assert!(decoded.contains("\"type\":\"error\""));
        assert!(decoded.contains("\"code\":\"invalid_request\""));
    }

    #[test]
    fn scenario_lifecycle_and_invalid_handles_are_controlled_over_ffi() {
        let scenario: Value =
            serde_json::from_str(LOGISTICS_SCENARIO).expect("scenario fixture must be valid JSON");
        let created = execute_request(json!({
            "command": "create_session",
            "scenario": scenario,
            "seed": 20260725
        }));
        assert_eq!(created["type"], "session_created");
        assert_eq!(created["snapshot"]["stage_id"], "intake");
        let session_id = created["session_id"]
            .as_u64()
            .expect("created session must expose an ID");

        let dispatched = execute_request(json!({
            "command": "dispatch",
            "session_id": session_id,
            "action_id": "audit_claim_file"
        }));
        assert_eq!(dispatched["type"], "snapshot");
        assert_eq!(dispatched["snapshot"]["stage_id"], "pre_action");
        assert_eq!(dispatched["snapshot"]["clock_minutes"], 120);

        let snapshot = execute_request(json!({
            "command": "snapshot",
            "session_id": session_id
        }));
        assert_eq!(snapshot["type"], "snapshot");
        assert_eq!(snapshot["snapshot"]["stage_id"], "pre_action");

        let disposed = execute_request(json!({
            "command": "dispose_session",
            "session_id": session_id
        }));
        assert_eq!(disposed["type"], "session_disposed");
        assert_eq!(disposed["disposed"], true);

        let disposed_again = execute_request(json!({
            "command": "dispose_session",
            "session_id": session_id
        }));
        assert_eq!(disposed_again["type"], "session_disposed");
        assert_eq!(disposed_again["disposed"], false);

        let invalid_handle = execute_request(json!({
            "command": "snapshot",
            "session_id": session_id
        }));
        assert_eq!(invalid_handle["type"], "error");
        assert_eq!(invalid_handle["code"], "unknown_session");
    }

    #[test]
    fn goldenshell_session_starts_through_the_existing_c_abi() {
        let scenario: Value = serde_json::from_str(GOLDENSHELL_SCENARIO)
            .expect("scenario fixture must be valid JSON");
        let created = execute_request(json!({
            "command": "create_session",
            "scenario": scenario,
            "seed": 20260730
        }));

        assert_eq!(created["type"], "session_created");
        assert_eq!(
            created["snapshot"]["scenario_id"],
            "goldenshell_recall_at_dawn"
        );
        assert_eq!(created["snapshot"]["stage_id"], "emergency_intake");
        assert_eq!(
            created["snapshot"]["available_actions"][0]["id"],
            "accept_cooperative_mandate"
        );

        let disposed = execute_request(json!({
            "command": "dispose_session",
            "session_id": created["session_id"]
        }));
        assert_eq!(disposed["type"], "session_disposed");
        assert_eq!(disposed["disposed"], true);
    }

    #[test]
    fn foreground_time_uses_the_existing_execute_symbol() {
        let scenario: Value =
            serde_json::from_str(GREENFIRE_SCENARIO).expect("scenario fixture must be valid JSON");
        let created = execute_request(json!({
            "command": "create_session",
            "scenario": scenario,
            "seed": 20260729
        }));
        let session_id = created["session_id"].as_u64().unwrap();

        let advanced = execute_request(json!({
            "command": "advance_time",
            "session_id": session_id,
            "minutes": 120
        }));
        assert_eq!(advanced["type"], "snapshot");
        assert_eq!(advanced["snapshot"]["clock_minutes"], 120);
        assert_eq!(advanced["snapshot"]["clock_mode"], "foreground");
        assert_eq!(advanced["snapshot"]["flags"], json!({}));
        assert_eq!(advanced["snapshot"]["fired_event_ids"], json!([]));

        let disposed = execute_request(json!({
            "command": "dispose_session",
            "session_id": session_id
        }));
        assert_eq!(disposed["disposed"], true);
    }

    #[test]
    fn action_driven_time_rejection_is_stable_over_ffi() {
        let scenario: Value =
            serde_json::from_str(LOGISTICS_SCENARIO).expect("scenario fixture must be valid JSON");
        let created = execute_request(json!({
            "command": "create_session",
            "scenario": scenario,
            "seed": 20260725
        }));

        let rejected = execute_request(json!({
            "command": "advance_time",
            "session_id": created["session_id"],
            "minutes": 1
        }));
        assert_eq!(rejected["type"], "error");
        assert_eq!(rejected["code"], "clock_advance_unsupported");
    }

    #[test]
    fn command_log_save_load_uses_the_existing_three_symbol_c_abi() {
        assert_eq!(juris_mobile_bridge_abi_version(), 1);
        let scenario: Value =
            serde_json::from_str(LOGISTICS_SCENARIO).expect("scenario fixture must be valid JSON");
        let created = execute_request(json!({
            "command": "create_session",
            "scenario": scenario,
            "seed": 20260725
        }));
        let session_id = created["session_id"].as_u64().unwrap();
        execute_request(json!({
            "command": "dispatch",
            "session_id": session_id,
            "action_id": "audit_claim_file"
        }));

        let saved = execute_request(json!({
            "command": "save_session",
            "session_id": session_id
        }));
        assert_eq!(saved["type"], "session_saved");
        let encoded_save = saved["encoded_save"].as_str().unwrap();
        assert!(encoded_save.contains("\"schema_version\":1"));

        let scenario: Value =
            serde_json::from_str(LOGISTICS_SCENARIO).expect("scenario fixture must be valid JSON");
        let loaded = execute_request(json!({
            "command": "load_session",
            "scenario": scenario,
            "encoded_save": encoded_save
        }));
        assert_eq!(loaded["type"], "session_loaded");
        assert_eq!(loaded["snapshot"]["stage_id"], "pre_action");
        assert_eq!(loaded["snapshot"]["clock_minutes"], 120);
    }

    #[test]
    fn adverse_judgment_snapshot_remains_open_over_ffi() {
        let scenario: Value = serde_json::from_str(REMEDIES_SCENARIO).unwrap();
        let created = execute_request(json!({
            "command": "create_session",
            "scenario": scenario,
            "seed": 20260729
        }));
        let session_id = created["session_id"].as_u64().unwrap();

        for action_id in ["request_judgment", "adverse_trial_judgment"] {
            let response = execute_request(json!({
                "command": "dispatch",
                "session_id": session_id,
                "action_id": action_id
            }));
            assert_eq!(response["type"], "snapshot");
        }

        let snapshot = execute_request(json!({
            "command": "snapshot",
            "session_id": session_id
        }));
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
    }

    #[test]
    fn filtered_snapshot_survives_the_existing_execute_symbol_and_replay() {
        assert_eq!(juris_mobile_bridge_abi_version(), 1);
        let mut scenario: Value =
            serde_json::from_str(DOSSIER_SCENARIO).expect("dossier fixture must be valid JSON");
        scenario["facts"][1]["statement"] =
            json!("SENTINEL UNKNOWN FACT MUST NOT LEAK / СКРЫТЫЙ ФАКТ RU");
        scenario["evidence"][1]["title"] =
            json!("SENTINEL UNAVAILABLE EVIDENCE MUST NOT LEAK / СКРЫТОЕ ДОКАЗАТЕЛЬСТВО RU");
        scenario["deadlines"][1]["title"] =
            json!("SENTINEL INACTIVE DEADLINE MUST NOT LEAK / СКРЫТЫЙ СРОК RU");
        let created = execute_request(json!({
            "command": "create_session",
            "scenario": scenario.clone(),
            "seed": 20260803
        }));

        assert_eq!(created["type"], "session_created");
        assert_eq!(
            created["snapshot"]["dossier"]["projection_schema_version"],
            1
        );
        assert_eq!(
            created["snapshot"]["dossier"]["procedure"]["matter_status"],
            "open"
        );
        let session_id = created["session_id"].as_u64().unwrap();
        assert_snapshot_omits(
            &created["snapshot"],
            "FFI create",
            PRE_REVEAL_SNAPSHOT_SENTINELS,
        );
        assert_snapshot_omits(
            &created["snapshot"],
            "FFI create",
            ALWAYS_HIDDEN_SNAPSHOT_SENTINELS,
        );
        assert_player_snapshot_ids(
            &created["snapshot"],
            "FFI create",
            &["a_known_fact", "z_known_fact"],
            &["a_visible_evidence", "z_visible_evidence"],
            &[],
            &["a_receive_adverse_decision", "z_reveal_record"],
        );

        let revealed = execute_request(json!({
            "command": "dispatch",
            "session_id": session_id,
            "action_id": "z_reveal_record"
        }));
        assert_eq!(revealed["type"], "snapshot");
        assert_snapshot_omits(
            &revealed["snapshot"],
            "FFI reveal",
            ALWAYS_HIDDEN_SNAPSHOT_SENTINELS,
        );
        assert_player_snapshot_ids(
            &revealed["snapshot"],
            "FFI reveal",
            &["a_known_fact", "sentinel_unknown_fact", "z_known_fact"],
            &[
                "a_visible_evidence",
                "sentinel_unavailable_evidence",
                "z_visible_evidence",
            ],
            &[],
            &["a_receive_adverse_decision"],
        );
        let revealed_raw_snapshot = revealed["snapshot"].to_string();
        for disclosed in PRE_REVEAL_SNAPSHOT_SENTINELS {
            assert!(
                revealed_raw_snapshot.contains(disclosed),
                "FFI reveal snapshot omitted disclosed `{disclosed}`: {revealed_raw_snapshot}"
            );
        }

        let snapshot = execute_request(json!({
            "command": "snapshot",
            "session_id": session_id
        }));
        assert_eq!(snapshot["type"], "snapshot");
        assert_snapshot_omits(
            &snapshot["snapshot"],
            "explicit FFI revealed snapshot",
            ALWAYS_HIDDEN_SNAPSHOT_SENTINELS,
        );
        assert_player_snapshot_ids(
            &snapshot["snapshot"],
            "explicit FFI revealed snapshot",
            &["a_known_fact", "sentinel_unknown_fact", "z_known_fact"],
            &[
                "a_visible_evidence",
                "sentinel_unavailable_evidence",
                "z_visible_evidence",
            ],
            &[],
            &["a_receive_adverse_decision"],
        );

        let saved = execute_request(json!({
            "command": "save_session",
            "session_id": session_id
        }));
        assert_eq!(saved["type"], "session_saved");
        let encoded_save = saved["encoded_save"].as_str().unwrap();
        for sentinel in ALWAYS_HIDDEN_SNAPSHOT_SENTINELS {
            assert!(
                !encoded_save.contains(sentinel),
                "FFI command-log save leaked private `{sentinel}`: {encoded_save}"
            );
        }

        let loaded = execute_request(json!({
            "command": "load_session",
            "scenario": scenario,
            "encoded_save": encoded_save
        }));
        assert_eq!(loaded["type"], "session_loaded");
        let loaded_session_id = loaded["session_id"].as_u64().unwrap();
        assert_ne!(loaded_session_id, session_id);
        assert_snapshot_omits(
            &loaded["snapshot"],
            "loaded FFI revealed snapshot",
            ALWAYS_HIDDEN_SNAPSHOT_SENTINELS,
        );
        assert_player_snapshot_ids(
            &loaded["snapshot"],
            "loaded FFI revealed snapshot",
            &["a_known_fact", "sentinel_unknown_fact", "z_known_fact"],
            &[
                "a_visible_evidence",
                "sentinel_unavailable_evidence",
                "z_visible_evidence",
            ],
            &[],
            &["a_receive_adverse_decision"],
        );

        let adverse = execute_request(json!({
            "command": "dispatch",
            "session_id": loaded_session_id,
            "action_id": "a_receive_adverse_decision"
        }));
        assert_eq!(
            adverse["snapshot"]["dossier"]["procedure"]["matter_status"],
            "recoverable"
        );
        assert_snapshot_omits(
            &adverse["snapshot"],
            "post-adverse FFI snapshot",
            ALWAYS_HIDDEN_SNAPSHOT_SENTINELS,
        );
        assert_snapshot_omits(
            &adverse["snapshot"],
            "post-adverse FFI snapshot",
            &["adverse_decision_delivered"],
        );
        assert_player_snapshot_ids(
            &adverse["snapshot"],
            "post-adverse FFI snapshot",
            &["a_known_fact", "sentinel_unknown_fact", "z_known_fact"],
            &[
                "a_visible_evidence",
                "sentinel_unavailable_evidence",
                "z_visible_evidence",
            ],
            &["a_review_deadline", "z_appeal_deadline"],
            &["accept_final_loss", "file_appeal", "preserve_review_rights"],
        );

        let disposed_original = execute_request(json!({
            "command": "dispose_session",
            "session_id": session_id
        }));
        assert_eq!(disposed_original["disposed"], true);
        let disposed_loaded = execute_request(json!({
            "command": "dispose_session",
            "session_id": loaded_session_id
        }));
        assert_eq!(disposed_loaded["disposed"], true);
    }

    #[test]
    fn additive_integer_projections_use_the_existing_execute_symbol() {
        let mut scenario: Value =
            serde_json::from_str(LOGISTICS_SCENARIO).expect("scenario fixture must be valid JSON");
        scenario["numeric_metrics"] = json!({"case_strength": 10});
        scenario["initial_resources"] = json!({
            "authorized_budget_eur": 10000,
            "review_credits": 4
        });
        scenario["actions"][0]["cost_eur"] = json!(125);
        scenario["actions"][0]["billable_minutes"] = json!(75);
        scenario["actions"][0]["effects"]
            .as_array_mut()
            .unwrap()
            .insert(
                0,
                json!({"type": "add_metric", "metric": "case_strength", "amount": 5}),
            );

        let created = execute_request(json!({
            "command": "create_session",
            "scenario": scenario,
            "seed": 20260725
        }));
        assert_eq!(created["type"], "session_created", "{created}");
        assert_eq!(created["snapshot"]["numeric_metrics"]["case_strength"], 10);
        assert_eq!(created["snapshot"]["resources"]["spend_eur"], 0);
        assert_eq!(
            created["snapshot"]["available_actions"][0]["billable_minutes"],
            75
        );
        let session_id = created["session_id"].as_u64().unwrap();

        let dispatched = execute_request(json!({
            "command": "dispatch",
            "session_id": session_id,
            "action_id": "audit_claim_file"
        }));
        assert_eq!(dispatched["type"], "snapshot", "{dispatched}");
        assert_eq!(
            dispatched["snapshot"]["numeric_metrics"]["case_strength"],
            15
        );
        assert_eq!(dispatched["snapshot"]["resources"]["spend_eur"], 125);
        assert_eq!(dispatched["snapshot"]["resources"]["billable_minutes"], 75);

        let disposed = execute_request(json!({
            "command": "dispose_session",
            "session_id": session_id
        }));
        assert_eq!(disposed["disposed"], true);
    }

    #[test]
    fn existing_ffi_snapshot_omits_additive_projection_keys() {
        let scenario: Value =
            serde_json::from_str(LOGISTICS_SCENARIO).expect("scenario fixture must be valid JSON");
        let created = execute_request(json!({
            "command": "create_session",
            "scenario": scenario,
            "seed": 20260725
        }));
        let snapshot = created["snapshot"].as_object().unwrap();

        assert!(!snapshot.contains_key("numeric_metrics"));
        assert!(!snapshot.contains_key("resources"));
        for action in snapshot["available_actions"].as_array().unwrap() {
            assert!(!action.as_object().unwrap().contains_key("billable_minutes"));
        }

        let disposed = execute_request(json!({
            "command": "dispose_session",
            "session_id": created["session_id"]
        }));
        assert_eq!(disposed["disposed"], true);
    }

    #[test]
    fn c_abi_surface_remains_version_one_with_exactly_three_exports() {
        let _: unsafe extern "C" fn(*const c_char) -> *mut c_char = juris_mobile_bridge_execute;
        let _: unsafe extern "C" fn(*mut c_char) = juris_mobile_bridge_string_free;
        let _: extern "C" fn() -> u32 = juris_mobile_bridge_abi_version;
        assert_eq!(juris_mobile_bridge_abi_version(), 1);

        let source = include_str!("lib.rs");
        let exported_symbols = source
            .lines()
            .enumerate()
            .filter(|(_, line)| line.trim() == "#[no_mangle]")
            .map(|(index, _)| {
                let signature = source
                    .lines()
                    .nth(index + 1)
                    .expect("every no_mangle attribute must decorate a symbol");
                signature
                    .split_once("fn ")
                    .and_then(|(_, remainder)| remainder.split_once('('))
                    .map(|(name, _)| name)
                    .expect("every no_mangle symbol must be an extern function")
            })
            .collect::<Vec<_>>();
        assert_eq!(
            exported_symbols,
            [
                "juris_mobile_bridge_execute",
                "juris_mobile_bridge_string_free",
                "juris_mobile_bridge_abi_version"
            ]
        );
    }
}
