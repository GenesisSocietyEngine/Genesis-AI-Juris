//! Full responses for the web descriptor protocol, independent of native scenarios.
use juris_mobile_bridge::execute_tax_json;
use serde_json::{json, Value};

fn call(cases: &mut Vec<Value>, name: &str, command: Value) -> Value {
    let request = command.to_string();
    let response = execute_tax_json(&request).expect("web command");
    assert_eq!(
        Some(response.clone()),
        juris_tax_wasm::execute_tax_json(&request)
    );
    let parsed = serde_json::from_str(&response).unwrap();
    cases.push(json!({"name":name,"request":request,"response":response}));
    parsed
}
fn main() {
    let fixture: Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/tax-runtime/web-source.json"
    ))
    .unwrap();
    let source = fixture["descriptor"].clone();
    let mut cases = Vec::new();
    let capability = call(
        &mut cases,
        "capabilities",
        json!({"command":"tax_web_capabilities"}),
    );
    assert_eq!(capability["source_schema"], "web-studio-tax-source-v1");
    let prepared = call(
        &mut cases,
        "prepare",
        json!({"command":"tax_web_prepare","source":source,"artifact_id":"web_probe","revision":"9007199254740993","currency":"EUR"}),
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
        let response = call(
            &mut cases,
            schema,
            json!({"command":"tax_web_import","source":source,"artifact_id":"web_probe","revision":"9007199254740993","schema":schema,"original_json":original}),
        );
        assert_eq!(response["legacy"]["status"]["status"], "converted");
        assert_eq!(response["legacy"]["original_json"], original);
    }
    let unavailable = call(
        &mut cases,
        "unavailable-import",
        json!({"command":"tax_web_import","source":source,"artifact_id":"web_probe","revision":"0","schema":"web_amounts_v1","original_json":" { \"future\": true } "}),
    );
    assert_eq!(unavailable["legacy"]["status"]["status"], "unavailable");
    let mut request = prepared["request"].clone();
    request["input"]["baseline_annual_tax_cost"] = json!("25000000");
    request["input"]["optimized_annual_tax_cost"] = json!("20000000");
    request["input"]["implementation_cost"] = json!("100000");
    let command = |request: &Value, bindings: Value, required: Value| json!({"command":"tax_web_calculate","source":source,"request":request,"bindings":bindings,"required_component_ids":required});
    let amounts = call(
        &mut cases,
        "amounts",
        command(&request, json!([]), json!([])),
    );
    assert_eq!(
        amounts["calculation"]["result"]["recognized_annual_tax_saving"],
        "5000000"
    );
    let mut downside = request.clone();
    downside["input"]["optimized_annual_tax_cost"] = json!("30000000");
    let result = call(
        &mut cases,
        "negative-tax-effect",
        command(&downside, json!([]), json!([])),
    );
    assert_eq!(
        result["calculation"]["result"]["recognized_annual_tax_saving"],
        "-5000000"
    );
    let mut timed = request.clone();
    timed["input"]["analysis_horizon_months"] = json!(18);
    timed["input"]["benefit_items"] = json!([{"id":"one_off","label":"Reviewed timing","benefit_type":"compliance_saving","timing":"one_off","amount":"1200","start_month":18,"end_month":null,"realization_bps":10000,"probability_bps":10000,"source_node_ids":["evidence_1"],"note":"retained","include_in_base_case":true}]);
    assert_eq!(
        call(
            &mut cases,
            "dated-benefit",
            command(&timed, json!([]), json!([]))
        )["type"],
        "tax_calculated"
    );
    request["input"]["tax_input_basis"] = json!("rates");
    request["input"]["baseline_tax_rate_bps"] = json!(2000);
    request["input"]["optimized_tax_rate_bps"] = json!(1000);
    let binding = json!({"component_id":"income","label":"Confirmed income","category":"taxable_income","amount":"25000000","currency":"EUR","fact_id":"fact_z","source_field":"annual_income","scenario_fingerprint":source["scenario_fingerprint"],"period":"2026","jurisdiction":"GB","note":"exact note","include_in_calculation":true,"confirmed":true,"confirmation_owner":"Synthetic reviewer","confirmation_as_of":"2026-09-30"});
    assert_eq!(
        call(
            &mut cases,
            "rates-derived",
            command(&request, json!([binding]), json!(["income"]))
        )["calculation"]["result"]["effective_annual_tax_base"],
        "25000000"
    );
    let mut unfinished = binding.clone();
    unfinished["confirmed"] = json!(false);
    let missing = call(
        &mut cases,
        "incomplete-binding",
        command(&request, json!([unfinished]), json!(["income"])),
    );
    assert_eq!(missing["type"], "tax_error");
    assert_eq!(missing["draft"]["bindings"][0]["confirmed"], false);
    request["input"]["tax_base_mode"] = json!("manual_override");
    request["input"]["annual_tax_base_override"] = json!("10000000");
    assert_eq!(
        call(
            &mut cases,
            "missing-manual-provenance",
            command(&request, json!([]), json!([]))
        )["detail"]["code"],
        "missing_override_provenance"
    );
    request["input"]["override_reason"] = json!("Explicit aggregate");
    request["input"]["override_owner"] = json!("Synthetic reviewer");
    request["input"]["override_as_of"] = json!("2026-09-30");
    assert_eq!(
        call(
            &mut cases,
            "manual-override",
            command(&request, json!([]), json!([]))
        )["calculation"]["result"]["effective_annual_tax_base"],
        "10000000"
    );
    request["context"]["scenario_fingerprint"] = json!("a".repeat(64));
    assert_eq!(
        call(
            &mut cases,
            "stale-context",
            command(&request, json!([]), json!([]))
        )["detail"]["code"],
        "stale_source"
    );
    for (field, value) in [
        ("source_schema", json!("future")),
        ("fact_ids", json!(["z", "a"])),
        ("reference_ids", json!(["same", "same"])),
        ("reference_ids", json!(["fact_a"])),
        ("case_id", json!("x".repeat(129))),
    ] {
        let mut changed = source.clone();
        changed[field] = value;
        assert_eq!(
            call(
                &mut cases,
                field,
                json!({"command":"tax_web_prepare","source":changed,"artifact_id":"web_probe","revision":"0","currency":"EUR"})
            )["type"],
            "tax_error"
        );
    }
    assert_eq!(
        call(
            &mut cases,
            "strict-capability",
            json!({"command":"tax_web_capabilities","extra":true})
        )["detail"]["detail"]["code"],
        "invalid_payload"
    );
    assert_eq!(cases.len(), 19);
    println!(
        "{}",
        json!({"schema":"juris.tax-web-corpus.v1","cases":cases})
    );
}
