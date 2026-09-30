//! Complete native protocol evidence, regenerated and compared in CI.
use juris_mobile_bridge::MobileBridge;
use serde_json::{json, Value};

fn call(bridge: &mut MobileBridge, cases: &mut Vec<Value>, command: Value) -> Value {
    let encoded = command.to_string();
    let response = bridge.execute_json(&encoded);
    assert_eq!(
        Some(response.clone()),
        juris_tax_wasm::execute_tax_json(&encoded)
    );
    let parsed = serde_json::from_str(&response).unwrap();
    cases.push(json!({"request":encoded,"response":response}));
    parsed
}

fn main() {
    let mut bridge = MobileBridge::new();
    let mut cases = Vec::new();
    let capabilities = call(
        &mut bridge,
        &mut cases,
        json!({"command":"tax_capabilities"}),
    );
    assert_eq!(
        capabilities["calculation_version"],
        "tax-economics-2026-09-29"
    );
    let scenario: Value = serde_json::from_str(include_str!(
        "../../../content/cases/unpaid_logistics_invoices.scenario.json"
    ))
    .unwrap();
    let prepared = call(
        &mut bridge,
        &mut cases,
        json!({"command":"tax_prepare", "scenario":scenario,
        "artifact_id":"wasm_probe", "revision":"9007199254740993", "currency":"EUR"}),
    );
    assert_eq!(prepared["type"], "tax_prepared");
    for (schema, original) in [
        (
            "web_amounts_v1",
            include_str!("../../juris-tax-economics/tests/fixtures/adapters/web_amounts_v1.json"),
        ),
        (
            "web_rates_fx_v1",
            include_str!("../../juris-tax-economics/tests/fixtures/adapters/web_rates_fx_v1.json"),
        ),
    ] {
        let imported = call(
            &mut bridge,
            &mut cases,
            json!({"command":"tax_import", "scenario":scenario,
            "artifact_id":"wasm_probe", "revision":"9007199254740993", "schema":schema,
            "original_json":original}),
        );
        assert_eq!(imported["type"], "tax_imported");
        assert_eq!(imported["legacy"]["status"]["status"], "converted");
        assert_eq!(imported["legacy"]["original_json"], original);
    }
    let mut request = prepared["request"].clone();
    request["input"]["baseline_annual_tax_cost"] = json!("25000000");
    request["input"]["optimized_annual_tax_cost"] = json!("20000000");
    request["input"]["implementation_cost"] = json!("100000");
    for _ in 0..25 {
        let result = call(
            &mut bridge,
            &mut cases,
            json!({"command":"tax_calculate", "scenario":scenario,
            "request":request, "bindings":[], "required_component_ids":[]}),
        );
        assert_eq!(result["type"], "tax_calculated");
        assert_eq!(
            result["calculation"]["result"]["recognized_annual_tax_saving"],
            "5000000"
        );
        assert_eq!(
            result["calculation"]["context"]["revision"],
            "9007199254740993"
        );
        assert_eq!(
            result["draft"]["binding_hash_schema"],
            "tax-component-bindings-v1"
        );
    }
    request["input"]["tax_input_basis"] = json!("rates");
    let incomplete = call(
        &mut bridge,
        &mut cases,
        json!({"command":"tax_calculate", "scenario":scenario,
        "request":request, "bindings":[], "required_component_ids":["income"]}),
    );
    assert_eq!(incomplete["type"], "tax_error");
    assert_eq!(bridge.session_count(), 0);
    assert_eq!(cases.len(), 30);
    assert_eq!(
        juris_tax_wasm::execute_tax_json("{\"command\":\"create_session\"}"),
        None
    );
    println!(
        "{}",
        json!({"schema":"juris.tax-runtime-corpus.v1", "cases":cases})
    );
}
