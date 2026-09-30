use juris_mobile_bridge::execute_tax_json;
use serde_json::{json, Value};

fn source() -> Value {
    serde_json::from_str::<Value>(include_str!(
        "../../../tests/fixtures/tax-runtime/web-source.json"
    ))
    .unwrap()["descriptor"]
        .clone()
}
fn raw(encoded: &str) -> Option<Value> {
    execute_tax_json(encoded).map(|s| serde_json::from_str(&s).unwrap())
}
fn call(command: Value) -> Value {
    raw(&command.to_string()).unwrap()
}
fn prepare(source: Value) -> Value {
    call(
        json!({"command":"tax_web_prepare","source":source,"artifact_id":"web_test","revision":"9007199254740993","currency":"EUR"}),
    )
}
fn calculate(source: Value, request: Value) -> Value {
    call(
        json!({"command":"tax_web_calculate","source":source,"request":request,"bindings":[],"required_component_ids":[]}),
    )
}

#[test]
fn web_commands_use_real_web_identity_and_shared_rust_calculation() {
    let source = source();
    let prepared = prepare(source.clone());
    assert_eq!(prepared["type"], "tax_prepared");
    assert_eq!(prepared["source_schema"], "web-studio-tax-source-v1");
    let mut request = prepared["request"].clone();
    assert_eq!(request["context"]["case_id"], "web_tax_contract");
    request["input"]["baseline_annual_tax_cost"] = json!("25000000");
    request["input"]["optimized_annual_tax_cost"] = json!("20000000");
    let result = calculate(source.clone(), request.clone());
    assert_eq!(result["type"], "tax_calculated");
    assert_eq!(
        result["calculation"]["result"]["recognized_annual_tax_saving"],
        "5000000"
    );
    assert_eq!(
        result["calculation"]["context"]["revision"],
        "9007199254740993"
    );
    request["input"]["tax_input_basis"] = json!("rates");
    assert_eq!(
        calculate(source.clone(), request.clone())["detail"]["detail"]["detail"]["code"],
        "missing_tax_base"
    );
    request["context"]["scenario_fingerprint"] = json!("a".repeat(64));
    assert_eq!(
        calculate(source, request)["detail"],
        json!({"code":"stale_source","field":"request.context"})
    );
}

#[test]
fn new_capability_and_all_envelopes_reject_unknown_or_duplicate_fields() {
    assert_eq!(
        call(json!({"command":"tax_web_capabilities"}))["source_schema"],
        "web-studio-tax-source-v1"
    );
    for encoded in [
        r#"{"command":"tax_web_capabilities","extra":true}"#,
        r#"{"command":"tax_web_capabilities","extra":true,"extra":false}"#,
    ] {
        assert_eq!(
            raw(encoded).unwrap()["detail"]["detail"]["code"],
            "invalid_payload"
        );
    }
    // The shared tag reader rejects ambiguous command tags before dispatch.
    assert_eq!(
        raw(r#"{"command":"tax_web_capabilities","command":"tax_web_capabilities"}"#),
        None
    );
    let encoded = json!({"command":"tax_web_prepare","source":source(),"artifact_id":"x","revision":"0","currency":"EUR"}).to_string();
    assert_eq!(
        raw(&encoded.replacen(
            "\"currency\":\"EUR\"",
            "\"currency\":\"EUR\",\"currency\":\"GBP\"",
            1
        ))
        .unwrap()["detail"]["detail"]["code"],
        "invalid_payload"
    );
    let mut changed = source();
    changed["graph"] = json!({});
    assert_eq!(
        prepare(changed)["detail"]["detail"]["code"],
        "invalid_payload"
    );
    let mut command: Value = serde_json::from_str(&encoded).unwrap();
    command["scenario"] = json!({});
    assert_eq!(call(command)["detail"]["detail"]["code"], "invalid_payload");
    for field in ["web_tax_contract", "fact_a", "evidence_1"] {
        let malformed = encoded.replace(field, "\\ud800");
        assert_eq!(
            raw(&malformed).unwrap()["detail"]["detail"]["code"],
            "invalid_payload"
        );
    }
}

#[test]
fn every_web_operation_checks_schema_identity_and_sorted_bounded_index() {
    let request = prepare(source())["request"].clone();
    for (field, value) in [
        ("source_schema", json!("future")),
        ("case_id", json!("x".repeat(129))),
        ("scenario_fingerprint", json!("A".repeat(64))),
        ("fact_ids", json!(["z", "a"])),
        ("reference_ids", json!(["same", "same"])),
        ("reference_ids", json!(["fact_a"])),
        ("fact_ids", json!(["x".repeat(129)])),
        ("fact_ids", json!([""])),
    ] {
        let mut changed = source();
        changed[field] = value;
        let prepared = prepare(changed.clone());
        assert_eq!(prepared["type"], "tax_error", "{field}");
        assert_eq!(
            calculate(changed.clone(), request.clone())["detail"],
            prepared["detail"]
        );
        let imported = call(
            json!({"command":"tax_web_import","source":changed,"artifact_id":"x","revision":"0","schema":"web_amounts_v1","original_json":"{}"}),
        );
        assert_eq!(imported["detail"], prepared["detail"]);
    }
    let mut source = source();
    source["case_id"] = json!("Ω".repeat(64));
    assert_eq!(prepare(source.clone())["type"], "tax_prepared");
    source["case_id"] = json!("Ω".repeat(65));
    assert_eq!(prepare(source)["type"], "tax_error");
}

#[test]
fn web_payload_count_and_revision_limits_remain_rust_owned() {
    let oversized = json!({"command":"tax_web_capabilities","padding":"x".repeat(262144)});
    assert_eq!(call(oversized)["detail"]["detail"]["field"], "payload");
    let mut source = source();
    source["fact_ids"] = json!((0..10001).map(|id| format!("f{id:05}")).collect::<Vec<_>>());
    assert_eq!(prepare(source)["detail"]["field"], "bindings");
    for revision in ["01", "-1", "18446744073709551616"] {
        let command = json!({"command":"tax_web_prepare","source":self::source(),"artifact_id":"x","revision":revision,"currency":"EUR"});
        assert_eq!(
            call(command)["detail"]["detail"]["field"],
            "context.revision"
        );
    }
}
