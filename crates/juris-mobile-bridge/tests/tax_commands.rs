use juris_mobile_bridge::MobileBridge;
use serde_json::{json, Value};
fn call(bridge: &mut MobileBridge, value: Value) -> Value {
    serde_json::from_str(&bridge.execute_json(&value.to_string())).unwrap()
}
fn scenario() -> Value {
    serde_json::from_str(include_str!(
        "../../../content/cases/unpaid_logistics_invoices.scenario.json"
    ))
    .unwrap()
}
fn prepared(bridge: &mut MobileBridge) -> Value {
    call(bridge, json!({"command":"tax_prepare","scenario":scenario(),"artifact_id":"tax_test","revision":"0","currency":"EUR"}))["request"].clone()
}
fn calculate(bridge: &mut MobileBridge, request: Value) -> Value {
    call(
        bridge,
        json!({"command":"tax_calculate","scenario":scenario(),"request":request,"bindings":[],"required_component_ids":[]}),
    )
}
#[test]
fn tax_commands_are_stateless_and_preserve_gameplay() {
    let mut bridge = MobileBridge::new();
    let created = call(
        &mut bridge,
        json!({"command":"create_session","scenario":scenario(),"seed":54}),
    );
    let id = created["session_id"].clone();
    let before = call(
        &mut bridge,
        json!({"command":"save_session","session_id":id}),
    );
    assert_eq!(
        call(&mut bridge, json!({"command":"tax_capabilities"}))["transport_protocol"],
        "tax-economics-json-v1"
    );
    let mut request = prepared(&mut bridge);
    request["input"]["baseline_annual_tax_cost"] = json!("25000000");
    request["input"]["optimized_annual_tax_cost"] = json!("20000000");
    request["input"]["implementation_cost"] = json!("100000");
    for _ in 0..50 {
        let result = calculate(&mut bridge, request.clone());
        assert_eq!(result["type"], "tax_calculated");
        assert_eq!(
            result["calculation"]["result"]["recognized_annual_tax_saving"],
            "5000000"
        );
        assert_eq!(
            result["draft"]["binding_hash_schema"],
            "tax-component-bindings-v1"
        );
    }
    assert_eq!(
        before,
        call(
            &mut bridge,
            json!({"command":"save_session","session_id":id})
        )
    );
    assert_eq!(bridge.session_count(), 1);
}
#[test]
fn errors_remain_typed_and_incomplete_is_not_zero() {
    let mut bridge = MobileBridge::new();
    let mut request = prepared(&mut bridge);
    request["input"]["tax_input_basis"] = json!("rates");
    let missing = calculate(&mut bridge, request.clone());
    assert_eq!(missing["type"], "tax_error");
    assert_eq!(
        missing["detail"]["detail"]["detail"]["code"],
        "missing_tax_base"
    );
    assert!(missing.get("calculation").is_none());
    request["context"]["scenario_fingerprint"] = json!("a".repeat(64));
    assert_eq!(
        calculate(&mut bridge, request)["detail"]["code"],
        "stale_source"
    );
    let mut request = prepared(&mut bridge);
    request["input"]["currency"] = json!("JPY");
    assert_eq!(
        calculate(&mut bridge, request)["detail"]["detail"]["code"],
        "policy_rejected"
    );
    let mut request = prepared(&mut bridge);
    request["input_schema"] = json!("future");
    assert_eq!(
        calculate(&mut bridge, request)["detail"]["detail"]["code"],
        "unsupported_version"
    );
    let mut request = prepared(&mut bridge);
    request["input"]["implementation_cost"] = json!(1.25);
    assert_eq!(
        calculate(&mut bridge, request)["detail"]["detail"]["code"],
        "invalid_payload"
    );
}
#[test]
fn raw_limit_and_manual_provenance_are_enforced() {
    let mut bridge = MobileBridge::new();
    let mut request = prepared(&mut bridge);
    request["input"]["tax_base_mode"] = json!("manual_override");
    request["input"]["annual_tax_base_override"] = json!("25000000");
    assert_eq!(
        calculate(&mut bridge, request)["detail"]["code"],
        "missing_override_provenance"
    );
    let result = call(
        &mut bridge,
        json!({"command":"tax_import","scenario":scenario(),"artifact_id":"tax_test","revision":"0","schema":"web_amounts_v1","original_json":" ".repeat(262144)}),
    );
    assert_eq!(result["detail"]["detail"]["field"], "payload");
    assert_eq!(
        call(&mut bridge, json!({"command":"not_a_command"}))["code"],
        "invalid_request"
    );
}

#[test]
fn confirmed_derived_and_manual_bindings_retain_the_full_draft() {
    let mut bridge = MobileBridge::new();
    let mut request = prepared(&mut bridge);
    request["input"]["tax_input_basis"] = json!("rates");
    request["input"]["baseline_tax_rate_bps"] = json!(2000);
    request["input"]["optimized_tax_rate_bps"] = json!(1000);
    let binding = json!({"component_id":"income","label":"Income","category":"taxable_income","amount":"25000000","currency":"EUR","fact_id":scenario()["facts"][0]["id"],"source_field":"annual_income","scenario_fingerprint":request["context"]["scenario_fingerprint"],"period":null,"jurisdiction":null,"note":"preserved","include_in_calculation":true,"confirmed":true,"confirmation_owner":"Synthetic tester","confirmation_as_of":"2026-09-29"});
    let result = call(
        &mut bridge,
        json!({"command":"tax_calculate","scenario":scenario(),"request":request,"bindings":[binding],"required_component_ids":["income"]}),
    );
    assert_eq!(result["type"], "tax_calculated");
    assert_eq!(
        result["calculation"]["result"]["effective_annual_tax_base"],
        "25000000"
    );
    let mut unfinished = binding;
    unfinished["confirmed"] = json!(false);
    unfinished["include_in_calculation"] = json!(false);
    unfinished["confirmation_owner"] = Value::Null;
    request["input"]["tax_base_mode"] = json!("manual_override");
    request["input"]["annual_tax_base_override"] = json!("10000000");
    request["input"]["override_reason"] = json!("Explicit aggregate");
    request["input"]["override_owner"] = json!("Synthetic tester");
    request["input"]["override_as_of"] = json!("2026-09-29");
    let result = call(
        &mut bridge,
        json!({"command":"tax_calculate","scenario":scenario(),"request":request,"bindings":[unfinished],"required_component_ids":[]}),
    );
    assert_eq!(result["type"], "tax_calculated");
    assert_eq!(
        result["calculation"]["result"]["effective_annual_tax_base"],
        "10000000"
    );
    assert_eq!(result["draft"]["bindings"][0]["confirmed"], false);
}
