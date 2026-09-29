use juris_tax_economics::{
    money::{DecimalSeparator, MoneyCents, MoneyError},
    transport::*,
    TaxEconomicsV2,
};
use serde_json::{json, Value};

const FIXTURE: &str = include_str!("fixtures/transport/eur_dated_input.json");
fn request() -> TaxRequest {
    decode_request(FIXTURE).unwrap()
}
fn encoded_mutation(change: impl FnOnce(&mut Value)) -> String {
    let mut value: Value = serde_json::from_str(FIXTURE).unwrap();
    change(&mut value);
    value.to_string()
}
fn assert_policy(request: TaxRequest, field: &str) {
    assert!(
        matches!(calculate(request), Err(BoundaryError::PolicyRejected { field: actual, .. }) if actual == field)
    );
}
#[test]
fn money_minor_unit_wire_is_exact_across_entire_i64_domain() {
    for value in [
        i64::MIN,
        -9_007_199_254_740_993,
        -1,
        0,
        1,
        9_007_199_254_740_993,
        i64::MAX,
    ] {
        let amount = MoneyCents::new(value);
        let encoded = serde_json::to_string(&amount).unwrap();
        assert_eq!(encoded, format!("\"{value}\""));
        assert_eq!(
            serde_json::from_str::<MoneyCents>(&encoded).unwrap(),
            amount
        );
        assert_eq!(
            MoneyCents::parse_major(&amount.format_major(), DecimalSeparator::Dot).unwrap(),
            amount
        );
    }
}
#[test]
fn money_rejects_noncanonical_minor_units_and_numeric_json() {
    for encoded in [
        "0",
        "1.5",
        "9007199254740993",
        "null",
        "true",
        "\"+1\"",
        "\"01\"",
        "\"-0\"",
        "\"1.0\"",
        "\"1e2\"",
        "\" 1\"",
        "\"\"",
        "\"9223372036854775808\"",
        "\"-9223372036854775809\"",
    ] {
        assert!(
            serde_json::from_str::<MoneyCents>(encoded).is_err(),
            "{encoded}"
        );
    }
}
#[test]
fn selected_decimal_separator_is_exact_and_never_guessed() {
    for (text, separator, expected) in [
        ("250000", DecimalSeparator::Dot, 25_000_000),
        ("250000.01", DecimalSeparator::Dot, 25_000_001),
        ("-0,1", DecimalSeparator::Comma, -10),
        ("-0.00", DecimalSeparator::Dot, 0),
    ] {
        assert_eq!(
            MoneyCents::parse_major(text, separator).unwrap().value(),
            expected
        );
    }
    for text in [
        "1,000.00",
        "1.000,00",
        " 1",
        "1 ",
        "+1",
        "01",
        "1.",
        ".1",
        "1.001",
        "1e3",
        "--1",
        "1,00",
        "１２.３４",
    ] {
        assert!(
            MoneyCents::parse_major(text, DecimalSeparator::Dot).is_err(),
            "{text}"
        );
    }
    assert_eq!(
        MoneyCents::parse_major("92233720368547758.08", DecimalSeparator::Dot),
        Err(MoneyError::OutOfRange)
    );
}
#[test]
fn fixture_round_trip_keeps_all_inputs_including_nulls_and_stale_cache() {
    let dto = request();
    let core: TaxEconomicsV2 = dto.input.clone().into();
    assert_eq!(core.tax_base_components[0].signed_amount, 30_000_000);
    assert_eq!(core.tax_base_components[1].signed_amount, 5_000_000);
    assert_eq!(TaxInput::from(core), dto.input);
    assert_eq!(
        decode_request(&serde_json::to_string(&dto).unwrap()).unwrap(),
        dto
    );
    let wire = serde_json::to_value(dto).unwrap();
    assert_eq!(wire["input"]["implementation_cost"], "120000");
    assert!(wire["input"]["annual_tax_base_override"].is_null());
}
#[test]
fn calculation_uses_core_dates_signs_and_units_without_reimplementation() {
    let result = calculate(request()).unwrap();
    assert_eq!(
        result.result.effective_annual_tax_base,
        Some(MoneyCents::new(25_000_000))
    );
    assert_eq!(result.result.baseline_annual_tax_cost.value(), 5_000_000);
    assert_eq!(result.result.optimized_annual_tax_cost.value(), 2_500_000);
    assert_eq!(result.result.lifecycle_net_benefit.value(), 7_434_000);
    assert_eq!(result.result.npv.value(), 7_434_000);
    assert_eq!(
        result
            .result
            .effective_annual_tax_base
            .unwrap()
            .format_major(),
        "250000.00"
    );
    let encoded = serde_json::to_string(&result).unwrap();
    assert_eq!(
        serde_json::from_str::<TaxSuccess>(&encoded).unwrap(),
        result
    );
    let wire: Value = serde_json::from_str(&encoded).unwrap();
    assert_eq!(wire["result"]["npv"], "7434000");
    assert!(wire["result"]["lifecycle_roi_bps"].is_i64());
    assert_eq!(result.calculation_version, CALCULATION_VERSION);
    assert_eq!(result.context.revision, "0");
}
#[test]
fn version_fields_are_independent_and_required() {
    for field in ["transport_protocol", "input_schema", "application_policy"] {
        let encoded = encoded_mutation(|v| v[field] = json!("future"));
        assert!(
            matches!(decode_request(&encoded), Err(BoundaryError::UnsupportedVersion { field: actual, .. }) if actual == field)
        );
    }
    let encoded = encoded_mutation(|v| {
        v.as_object_mut().unwrap().remove("input_schema");
    });
    assert!(matches!(
        decode_request(&encoded),
        Err(BoundaryError::InvalidPayload { .. })
    ));
}
#[test]
fn unknown_duplicate_fields_and_missing_required_money_are_rejected() {
    for encoded in [
        encoded_mutation(|v| v["extra"] = json!(true)),
        encoded_mutation(|v| v["input"]["extra"] = json!(true)),
        encoded_mutation(|v| {
            v["input"]
                .as_object_mut()
                .unwrap()
                .remove("implementation_cost");
        }),
        FIXTURE.replacen(
            "\"currency\":\"EUR\"",
            "\"currency\":\"EUR\",\"currency\":\"USD\"",
            1,
        ),
        encoded_mutation(|v| v["input"]["implementation_cost"] = json!(120000)),
    ] {
        assert!(matches!(
            decode_request(&encoded),
            Err(BoundaryError::InvalidPayload { .. })
        ));
    }
}
#[test]
fn policy_is_separate_from_core_and_enforced_for_typed_calls() {
    let mut r = request();
    r.input.analysis_horizon_months = 241;
    assert_policy(r, "input.analysis_horizon_months");
    let mut r = request();
    r.input.annual_discount_rate_bps = 5001;
    assert_policy(r, "input.annual_discount_rate_bps");
    let mut r = request();
    r.input.implementation_cost = MoneyCents::new(-MAX_AMOUNT_CENTS - 1);
    assert_policy(r, "input.implementation_cost");
    let mut r = request();
    r.input.currency = "JPY".into();
    assert_policy(r, "input.currency");
    for currency in SUPPORTED_CURRENCIES {
        let mut r = request();
        r.input.currency = (*currency).into();
        assert!(r.validate().is_ok());
    }
}
#[test]
fn request_text_item_and_identity_limits_are_not_silent_truncation() {
    let mut r = request();
    r.input.assumptions = "a".repeat(4001);
    assert_policy(r, "input.assumptions");
    let mut r = request();
    r.input.benefit_items = vec![r.input.benefit_items[0].clone(); 101];
    assert_policy(r, "input");
    let mut r = request();
    r.input
        .tax_base_components
        .push(r.input.tax_base_components[0].clone());
    assert_policy(r, "input.tax_base_components.id");
    let mut r = request();
    r.context.revision = "01".into();
    assert_policy(r, "context.revision");
    let mut r = request();
    r.context.scenario_fingerprint = "A".repeat(64);
    assert_policy(r, "context.scenario_fingerprint");
    let oversized = " ".repeat(MAX_REQUEST_BYTES + 1);
    assert!(
        matches!(decode_request(&oversized), Err(BoundaryError::PolicyRejected { field, .. }) if field == "request")
    );
}
#[test]
fn downside_and_unavailable_values_are_preserved() {
    let mut r = request();
    r.input.tax_input_basis = "amounts".into();
    r.input.baseline_annual_tax_cost = MoneyCents::new(0);
    r.input.optimized_annual_tax_cost = MoneyCents::new(50_000);
    r.input.benefit_realization_bps = 0;
    r.input.benefit_items.clear();
    let result = calculate(r).unwrap().result;
    assert_eq!(result.recognized_annual_tax_saving.value(), -50_000);
    assert!(result.lifecycle_roi_bps.unwrap() < 0);
    assert_eq!(result.payback_months, None);
    let mut r = request();
    r.input.implementation_cost = MoneyCents::new(0);
    r.input.annual_maintenance_cost = MoneyCents::new(0);
    r.input.terminal_tax_or_unwind_cost = MoneyCents::new(0);
    let result = calculate(r).unwrap().result;
    assert_eq!(result.lifecycle_roi_bps, None);
    assert_eq!(
        result.lifecycle_roi_unavailable_reason,
        Some(juris_tax_economics::RoiUnavailableReason::NonPositiveLifecycleCost)
    );
}
#[test]
fn core_error_detail_codes_survive_the_eq_projection() {
    let mut r = request();
    r.input.missing_tax_base_inputs.push("income".into());
    assert!(matches!(
        calculate(r),
        Err(BoundaryError::Calculation {
            detail: CalculationErrorDetail::MissingTaxBase { .. }
        })
    ));
    let mut r = request();
    r.input.tax_input_basis = "unknown".into();
    assert!(matches!(
        calculate(r),
        Err(BoundaryError::Calculation {
            detail: CalculationErrorDetail::UnknownTaxInputBasis { .. }
        })
    ));
    let mut r = request();
    r.input.benefit_items[0].start_month = 0;
    let error = calculate(r).unwrap_err();
    let encoded = serde_json::to_value(&error).unwrap();
    assert_eq!(encoded["detail"]["code"], "invalid_input");
    assert_eq!(encoded["detail"]["field"], "benefit_items.timing");
    assert_eq!(
        serde_json::from_value::<BoundaryError>(encoded).unwrap(),
        error
    );
}
#[test]
fn schema_types_retain_eq_for_existing_bridge_response_compatibility() {
    fn eq<T: Eq>() {}
    eq::<TaxInput>();
    eq::<TaxResult>();
    eq::<TaxRequest>();
    eq::<TaxSuccess>();
    eq::<BoundaryError>();
}

#[test]
fn typed_and_encoded_calls_share_the_total_payload_limit() {
    let mut r = request();
    let template = r.input.benefit_items[0].clone();
    r.input.benefit_items = (0..70)
        .map(|index| {
            let mut item = template.clone();
            item.id = format!("benefit_{index}");
            item.note = Some("a".repeat(4000));
            item
        })
        .collect();
    let encoded = serde_json::to_string(&r).unwrap();
    assert!(encoded.len() > MAX_REQUEST_BYTES);
    assert!(
        matches!(decode_request(&encoded), Err(BoundaryError::PolicyRejected { field, .. }) if field == "request")
    );
    assert_policy(r, "request");
}

#[test]
fn exact_json_byte_limit_counts_escaping_and_multibyte_text() {
    let mut r = request();
    let template = r.input.benefit_items[0].clone();
    r.input.benefit_items = (0..100)
        .map(|index| {
            let mut item = template.clone();
            item.id = format!("benefit_{index}");
            item.note = Some("\né".into());
            item
        })
        .collect();
    let mut remaining = MAX_REQUEST_BYTES - serde_json::to_vec(&r).unwrap().len();
    for item in &mut r.input.benefit_items {
        let note = item.note.as_mut().unwrap();
        let count = remaining.min(4000 - note.chars().count());
        note.push_str(&"a".repeat(count));
        remaining -= count;
    }
    assert_eq!(remaining, 0);
    let encoded = serde_json::to_string(&r).unwrap();
    assert_eq!(encoded.len(), MAX_REQUEST_BYTES);
    assert!(r.validate().is_ok());
    assert!(decode_request(&encoded).is_ok());
    let note = r
        .input
        .benefit_items
        .iter_mut()
        .find_map(|item| {
            item.note
                .as_mut()
                .filter(|note| note.chars().count() < 4000)
        })
        .unwrap();
    note.push('x');
    let encoded = serde_json::to_string(&r).unwrap();
    assert_eq!(encoded.len(), MAX_REQUEST_BYTES + 1);
    assert!(
        matches!(decode_request(&encoded), Err(BoundaryError::PolicyRejected { field, .. }) if field == "request")
    );
    assert_policy(r, "request");
}
#[test]
fn signed_deductible_component_is_not_preflipped_by_the_adapter() {
    let mut r = request();
    r.input.tax_base_components[1].signed_amount = MoneyCents::new(-5_000_000);
    let core: TaxEconomicsV2 = r.input.clone().into();
    assert_eq!(core.tax_base_components[1].signed_amount, -5_000_000);
    assert_eq!(TaxInput::from(core), r.input);
    assert_eq!(
        calculate(r).unwrap().result.effective_annual_tax_base,
        Some(MoneyCents::new(35_000_000))
    );
}
