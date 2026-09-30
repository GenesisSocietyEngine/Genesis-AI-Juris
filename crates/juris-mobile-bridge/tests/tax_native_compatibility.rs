//! Pin native edge behavior before adding the separately strict web boundary.
use juris_mobile_bridge::execute_tax_json;
use serde_json::{json, Value};

fn call(command: Value) -> Value {
    serde_json::from_str(&execute_tax_json(&command.to_string()).unwrap()).unwrap()
}
fn scenario() -> Value {
    serde_json::from_str(include_str!(
        "../../../content/cases/unpaid_logistics_invoices.scenario.json"
    ))
    .unwrap()
}
fn prepare(source: &Value) -> Value {
    call(
        json!({"command":"tax_prepare","scenario":source,"artifact_id":"compat","revision":"0","currency":"EUR"}),
    )
}
fn calculate(source: &Value, request: Value) -> Value {
    call(
        json!({"command":"tax_calculate","scenario":source,"request":request,"bindings":[],"required_component_ids":[]}),
    )
}

#[test]
fn native_prepare_and_import_do_not_validate_source_indexes() {
    for invalid_id in ["duplicate".to_string(), "x".repeat(129)] {
        let mut source = scenario();
        source["facts"][0]["id"] = json!(invalid_id);
        source["facts"][1]["id"] = source["facts"][0]["id"].clone();
        let prepared = prepare(&source);
        assert_eq!(prepared["type"], "tax_prepared");
        assert_eq!(prepared["source"]["fact_ids"][0], invalid_id);
        let imported = call(
            json!({"command":"tax_import","scenario":source,"artifact_id":"compat","revision":"0","schema":"web_amounts_v1","original_json":include_str!("../../juris-tax-economics/tests/fixtures/adapters/web_amounts_v1.json")}),
        );
        assert_eq!(imported["type"], "tax_imported");
        assert_eq!(imported["legacy"]["status"]["status"], "converted");
        assert_eq!(imported["source"], prepared["source"]);
        let failed = calculate(&source, prepared["request"].clone());
        assert_eq!(failed["detail"]["code"], "invalid_binding");
        assert_eq!(failed["detail"]["field"], "source.fact_ids");
    }
}

#[test]
fn native_calculate_preserves_validation_error_precedence() {
    let mut source = scenario();
    let mut request = prepare(&source)["request"].clone();
    source["metadata"]["id"] = json!("x".repeat(129));
    request["transport_protocol"] = json!("unsupported");
    assert_eq!(
        calculate(&source, request)["detail"],
        json!({"code":"boundary","detail":{"code":"unsupported_version","field":"transport_protocol","value":"unsupported"}})
    );

    let mut source = scenario();
    source["facts"][1]["id"] = source["facts"][0]["id"].clone();
    let mut request = prepare(&source)["request"].clone();
    request["context"]["scenario_fingerprint"] = json!("a".repeat(64));
    assert_eq!(
        calculate(&source, request)["detail"],
        json!({"code":"stale_source","field":"request.context"})
    );

    let mut source = scenario();
    let mut request = prepare(&source)["request"].clone();
    source["schema_version"] = json!("future");
    request["transport_protocol"] = json!("unsupported");
    assert_eq!(
        calculate(&source, request)["detail"],
        json!({"code":"boundary","detail":{"code":"unsupported_version","field":"scenario.schema_version","value":"future"}})
    );
}

#[test]
fn native_cross_list_overlap_and_capability_extra_fields_remain_accepted() {
    let mut source = scenario();
    source["evidence"][0]["id"] = source["facts"][0]["id"].clone();
    let request = prepare(&source)["request"].clone();
    assert_eq!(calculate(&source, request)["type"], "tax_calculated");
    assert_eq!(
        call(json!({"command":"tax_capabilities","unexpected":true})),
        call(json!({"command":"tax_capabilities"}))
    );
}
