use juris_mobile_ffi::{juris_mobile_bridge_execute, juris_mobile_bridge_string_free};
use serde_json::{json, Value};
use std::ffi::{CStr, CString};
fn call(request: Value) -> Value {
    let request = CString::new(request.to_string()).unwrap();
    let pointer = unsafe { juris_mobile_bridge_execute(request.as_ptr()) };
    assert!(!pointer.is_null());
    let response = unsafe { CStr::from_ptr(pointer) }
        .to_string_lossy()
        .into_owned();
    unsafe { juris_mobile_bridge_string_free(pointer) };
    serde_json::from_str(&response).unwrap()
}
#[test]
fn allocated_tax_success_and_error_responses_are_freed() {
    let scenario: Value = serde_json::from_str(include_str!(
        "../../../content/cases/unpaid_logistics_invoices.scenario.json"
    ))
    .unwrap();
    for _ in 0..100 {
        let prepared = call(
            json!({"command":"tax_prepare","scenario":scenario,"artifact_id":"ffi_tax","revision":"0","currency":"EUR"}),
        );
        let mut request = prepared["request"].clone();
        let result = call(
            json!({"command":"tax_calculate","scenario":scenario,"request":request,"bindings":[],"required_component_ids":[]}),
        );
        assert_eq!(result["type"], "tax_calculated");
        request["input"]["tax_input_basis"] = json!("rates");
        let failed = call(
            json!({"command":"tax_calculate","scenario":scenario,"request":request,"bindings":[],"required_component_ids":[]}),
        );
        assert_eq!(failed["type"], "tax_error");
    }
}
