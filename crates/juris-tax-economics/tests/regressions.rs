use juris_tax_economics::*;
use std::ffi::{CStr, CString};

fn model() -> TaxEconomicsV2 {
    let mut model = TaxEconomicsV2::new_default("EUR".into());
    model.analysis_horizon_months = 12;
    model.annual_discount_rate_bps = 0;
    model
}
fn benefit(amount: i64, timing: BenefitTiming, start: u32, end: Option<u32>) -> TaxBenefitItem {
    TaxBenefitItem {
        id: "fixture".into(),
        label: "Synthetic".into(),
        benefit_type: BenefitType::Other,
        timing,
        amount,
        start_month: start,
        end_month: end,
        realization_bps: None,
        probability_bps: None,
        source_node_ids: vec![],
        note: None,
        include_in_base_case: true,
    }
}
fn component(amount: i64, category: TaxBaseComponentCategory) -> TaxBaseComponent {
    TaxBaseComponent {
        id: "synthetic".into(),
        label: "Synthetic".into(),
        category,
        signed_amount: amount,
        source_type: "fixture".into(),
        source_node_id: None,
        source_field: "amount".into(),
        period: "annual".into(),
        jurisdiction: "BE".into(),
        evidence_status: "fixture".into(),
        include_in_calculation: true,
        note: String::new(),
    }
}
fn assert_overflow(result: Result<TaxEconomicsCalculationResult, TaxEconomicsError>, field: &str) {
    assert_eq!(
        result.unwrap_err(),
        TaxEconomicsError::ArithmeticOverflow {
            field: field.into()
        }
    );
}

#[test]
fn reported_annualization_overflow_is_removed() {
    let mut m = model();
    m.implementation_cost = 768_614_336_404_564_651;
    let result = calculate_tax_economics_v2(&m).unwrap();
    assert_eq!(result.annualized_net_benefit, -m.implementation_cost);
    assert_eq!(result.lifecycle_net_benefit, -m.implementation_cost);
    assert_eq!(result.npv, -m.implementation_cost);
}
#[test]
fn one_off_npv_is_paid_once_at_its_start_month() {
    let mut m = model();
    m.benefit_items
        .push(benefit(10_000, BenefitTiming::OneOff, 1, None));
    let result = calculate_tax_economics_v2(&m).unwrap();
    assert_eq!(result.lifecycle_net_benefit, 10_000);
    assert_eq!(result.npv, 10_000);
    m.annual_discount_rate_bps = 1000;
    m.benefit_items[0].amount = 12_100;
    m.benefit_items[0].start_month = 12;
    m.benefit_items[0].end_month = Some(12);
    assert!((calculate_tax_economics_v2(&m).unwrap().npv - 11_000).abs() <= 1);
}
#[test]
fn recurring_dates_are_inclusive_and_clipped_to_horizon() {
    let mut m = model();
    m.benefit_items
        .push(benefit(12_000, BenefitTiming::RecurringAnnual, 4, Some(6)));
    let r = calculate_tax_economics_v2(&m).unwrap();
    assert_eq!(r.lifecycle_net_benefit, 3000);
    assert_eq!(r.npv, 3000);
    assert_eq!(r.recognized_recurring_benefits, 12_000); // nominal run rate preserved
    m.benefit_items[0].start_month = 12;
    m.benefit_items[0].end_month = Some(24);
    assert_eq!(
        calculate_tax_economics_v2(&m)
            .unwrap()
            .lifecycle_net_benefit,
        1000
    );
}
#[test]
fn future_benefits_do_not_enter_lifecycle_or_npv() {
    let mut m = model();
    m.benefit_items = vec![
        benefit(12_000, BenefitTiming::RecurringAnnual, 13, None),
        benefit(10_000, BenefitTiming::OneOff, 13, None),
    ];
    let r = calculate_tax_economics_v2(&m).unwrap();
    assert_eq!((r.lifecycle_net_benefit, r.npv), (0, 0));
}
#[test]
fn invalid_timing_is_a_typed_error() {
    for (start, end) in [(0, None), (2, Some(1)), (1, Some(0))] {
        let mut m = model();
        m.benefit_items
            .push(benefit(100, BenefitTiming::OneOff, start, end));
        assert!(matches!(
            calculate_tax_economics_v2(&m),
            Err(TaxEconomicsError::InvalidInput { .. })
        ));
    }
    let mut m = model();
    m.analysis_horizon_months = 0;
    assert!(matches!(
        calculate_tax_economics_v2(&m),
        Err(TaxEconomicsError::InvalidInput { .. })
    ));
}
#[test]
fn terminal_cost_is_discounted_at_horizon_month() {
    let mut m = model();
    m.terminal_tax_or_unwind_cost = 12_100;
    m.annual_discount_rate_bps = 1000;
    let r = calculate_tax_economics_v2(&m).unwrap();
    assert_eq!(r.lifecycle_net_benefit, -12_100);
    assert!((r.npv + 11_000).abs() <= 1);
}
#[test]
fn roi_uses_total_lifecycle_cost_and_preserves_negative_results() {
    let mut m = model();
    m.baseline_annual_tax_cost = 20_000;
    m.implementation_cost = 5000;
    m.annual_maintenance_cost = 2000;
    m.terminal_tax_or_unwind_cost = 3000;
    let r = calculate_tax_economics_v2(&m).unwrap();
    assert_eq!(r.lifecycle_net_benefit, 10_000);
    assert_eq!(r.lifecycle_roi_bps, Some(10_000));
    assert_eq!(r.lifecycle_roi_unavailable_reason, None);
    m.baseline_annual_tax_cost = 0;
    assert_eq!(
        calculate_tax_economics_v2(&m).unwrap().lifecycle_roi_bps,
        Some(-10_000)
    );
}
#[test]
fn roi_works_without_implementation_cost_when_other_costs_exist() {
    let mut m = model();
    m.baseline_annual_tax_cost = 2000;
    m.annual_maintenance_cost = 1000;
    assert_eq!(
        calculate_tax_economics_v2(&m).unwrap().lifecycle_roi_bps,
        Some(10_000)
    );
}
#[test]
fn roi_unavailability_is_explicit_for_range_and_nonpositive_costs() {
    let mut m = model();
    m.implementation_cost = 1;
    m.benefit_items
        .push(benefit(300_001, BenefitTiming::OneOff, 1, None));
    let r = calculate_tax_economics_v2(&m).unwrap();
    assert_eq!(r.lifecycle_net_benefit, 300_000);
    assert_eq!(r.lifecycle_roi_bps, None);
    assert_eq!(
        r.lifecycle_roi_unavailable_reason,
        Some(RoiUnavailableReason::OutOfRange)
    );
    let json = serde_json::to_value(r).unwrap();
    assert_eq!(json["lifecycle_roi_unavailable_reason"], "out_of_range");
    for cost in [0, -1] {
        m.implementation_cost = cost;
        let r = calculate_tax_economics_v2(&m).unwrap();
        assert_eq!(r.lifecycle_roi_bps, None);
        assert_eq!(
            r.lifecycle_roi_unavailable_reason,
            Some(RoiUnavailableReason::NonPositiveLifecycleCost)
        );
    }
}
#[test]
fn representability_failures_are_not_wrapped_or_silently_missing() {
    let mut m = model();
    m.baseline_annual_tax_cost = i64::MAX;
    m.optimized_annual_tax_cost = i64::MIN;
    assert_overflow(
        calculate_tax_economics_v2(&m),
        "recognized_annual_tax_saving",
    );
    let mut m = model();
    m.implementation_cost = i64::MAX;
    m.analysis_horizon_months = 1;
    assert_overflow(calculate_tax_economics_v2(&m), "annualized_net_benefit");
    let mut m = model();
    m.implementation_cost = 5_000_000_000;
    m.baseline_annual_tax_cost = 1;
    assert_overflow(calculate_tax_economics_v2(&m), "payback_months");
    let mut m = model();
    m.baseline_annual_tax_cost = i64::MAX / 2;
    m.analysis_horizon_months = 36;
    assert_overflow(calculate_tax_economics_v2(&m), "lifecycle_net_benefit");
}
#[test]
fn derived_component_and_benefit_sum_overflows_are_typed() {
    let components = vec![
        component(i64::MAX, TaxBaseComponentCategory::TaxableIncome),
        component(1, TaxBaseComponentCategory::TaxableIncome),
    ];
    assert!(matches!(
        calculate_tax_base_from_components(&components),
        Err(TaxEconomicsError::ArithmeticOverflow { .. })
    ));
    let mut m = model();
    m.tax_base_components = components;
    m.missing_tax_base_inputs.clear();
    assert!(matches!(
        effective_annual_tax_base(&m),
        Err(TaxEconomicsError::ArithmeticOverflow { .. })
    ));
    let items = vec![
        benefit(i64::MAX, BenefitTiming::OneOff, 1, None),
        benefit(1, BenefitTiming::OneOff, 1, None),
    ];
    assert!(matches!(
        calculate_recognized_benefits(&items, 10_000),
        Err(TaxEconomicsError::ArithmeticOverflow { .. })
    ));
}
#[test]
fn full_existing_horizon_and_discount_types_remain_supported() {
    let mut m = model();
    m.analysis_horizon_months = u32::MAX;
    m.annual_discount_rate_bps = u16::MAX;
    m.benefit_items
        .push(benefit(10, BenefitTiming::OneOff, u32::MAX, None));
    let r = calculate_tax_economics_v2(&m).unwrap();
    assert_eq!(r.lifecycle_net_benefit, 10);
    assert_eq!(r.npv, 0);
}
#[test]
fn no_monthly_rounding_loss_and_zero_rate_npv_equals_lifecycle() {
    for annual in [-1, 1] {
        let mut m = model();
        m.benefit_items
            .push(benefit(annual, BenefitTiming::RecurringAnnual, 1, None));
        let r = calculate_tax_economics_v2(&m).unwrap();
        assert_eq!((r.lifecycle_net_benefit, r.npv), (annual, annual));
        m.analysis_horizon_months = 6;
        let r = calculate_tax_economics_v2(&m).unwrap();
        assert_eq!((r.lifecycle_net_benefit, r.npv), (0, 0));
        m.annual_discount_rate_bps = 100;
        assert_eq!(calculate_tax_economics_v2(&m).unwrap().npv, 0);
    }
}
#[test]
fn signed_item_realization_policy_and_global_fraction_validation() {
    let mut item = benefit(-101, BenefitTiming::OneOff, 1, None);
    item.realization_bps = Some(5000);
    item.probability_bps = Some(5000);
    assert_eq!(
        calculate_recognized_benefits(&[item], 10_000)
            .unwrap()
            .one_off,
        -25
    );
    assert!(matches!(
        calculate_recognized_benefits(&[], 10_001),
        Err(TaxEconomicsError::InvalidInput { .. })
    ));
}
#[test]
fn negative_tax_effect_is_never_reduced_by_realization() {
    let mut m = model();
    m.optimized_annual_tax_cost = 100;
    m.benefit_realization_bps = 0;
    assert_eq!(
        calculate_tax_economics_v2(&m)
            .unwrap()
            .recognized_annual_tax_saving,
        -100
    );
}
#[test]
fn old_result_json_is_rejected_and_input_model_recomputes() {
    let m = model();
    let r = calculate_tax_economics_v2(&m).unwrap();
    let mut json = serde_json::to_value(r).unwrap();
    json.as_object_mut()
        .unwrap()
        .remove("baseline_annual_tax_cost");
    assert!(serde_json::from_value::<TaxEconomicsCalculationResult>(json).is_err());
    let restored =
        serde_json::from_str::<TaxEconomicsV2>(&serde_json::to_string(&m).unwrap()).unwrap();
    assert_eq!(calculate_tax_economics_v2(&restored).unwrap().npv, 0);
}
fn ffi_json(
    call: impl FnOnce(*const std::os::raw::c_char) -> *mut std::os::raw::c_char,
    value: serde_json::Value,
) -> serde_json::Value {
    let input = CString::new(value.to_string()).unwrap();
    let output = call(input.as_ptr());
    assert!(!output.is_null());
    let parsed = serde_json::from_str(unsafe { CStr::from_ptr(output) }.to_str().unwrap()).unwrap();
    ffi::juris_free_string(output);
    parsed
}
#[test]
fn ffi_calculation_errors_keep_the_typed_envelope() {
    let mut m = model();
    m.tax_input_basis = "rates".into();
    let r = ffi_json(
        |p| ffi::juris_calculate_tax_economics(p),
        serde_json::to_value(&m).unwrap(),
    );
    assert!(r["error"].is_string());
    assert_eq!(r["detail"]["code"], "missing_tax_base");
    m.tax_input_basis = "unknown".into();
    let r = ffi_json(
        |p| ffi::juris_calculate_tax_economics(p),
        serde_json::to_value(&m).unwrap(),
    );
    assert_eq!(r["detail"]["code"], "unknown_tax_input_basis");
    m.tax_input_basis = "amounts".into();
    m.implementation_cost = i64::MAX;
    m.analysis_horizon_months = 1;
    let r = ffi_json(
        |p| ffi::juris_calculate_tax_economics(p),
        serde_json::to_value(&m).unwrap(),
    );
    assert_eq!(r["detail"]["code"], "arithmetic_overflow");
    m.analysis_horizon_months = 0;
    let r = ffi_json(
        |p| ffi::juris_calculate_tax_economics(p),
        serde_json::to_value(&m).unwrap(),
    );
    assert_eq!(r["detail"]["code"], "invalid_input");
}
#[test]
fn ffi_helpers_report_overflow_without_crossing_abi_with_a_panic() {
    let components = vec![
        component(i64::MAX, TaxBaseComponentCategory::TaxableIncome),
        component(1, TaxBaseComponentCategory::TaxableIncome),
    ];
    let r = ffi_json(
        |p| ffi::juris_calculate_tax_base(p),
        serde_json::to_value(components).unwrap(),
    );
    assert_eq!(r["detail"]["code"], "arithmetic_overflow");
    let items = vec![
        benefit(i64::MAX, BenefitTiming::OneOff, 1, None),
        benefit(1, BenefitTiming::OneOff, 1, None),
    ];
    let r = ffi_json(
        |p| ffi::juris_calculate_recognized_benefits(p, 10_000),
        serde_json::to_value(items).unwrap(),
    );
    assert_eq!(r["detail"]["code"], "arithmetic_overflow");
}

#[test]
fn large_immediate_cashflow_remains_exact_at_nonzero_discount() {
    let mut m = model();
    m.implementation_cost = 768_614_336_404_564_651;
    m.annual_discount_rate_bps = 800;
    assert_eq!(
        calculate_tax_economics_v2(&m).unwrap().npv,
        -m.implementation_cost
    );
}
#[test]
fn discounted_extreme_precision_is_explicit_not_silent() {
    let mut m = model();
    m.benefit_items
        .push(benefit(i64::MAX, BenefitTiming::OneOff, 1, None));
    m.annual_discount_rate_bps = 1;
    assert!(matches!(
        calculate_tax_economics_v2(&m),
        Err(TaxEconomicsError::NumericPrecision { .. })
    ));
    let r = ffi_json(
        |p| ffi::juris_calculate_tax_economics(p),
        serde_json::to_value(m).unwrap(),
    );
    assert_eq!(r["detail"]["code"], "numeric_precision");
}
#[test]
fn same_date_huge_offsets_are_aggregated_before_discount_and_order_invariant() {
    let mut expected = None;
    for values in [
        [i64::MAX, 10_000, -i64::MAX],
        [i64::MAX, -i64::MAX, 10_000],
        [10_000, -i64::MAX, i64::MAX],
    ] {
        let mut m = model();
        m.annual_discount_rate_bps = 1;
        m.benefit_items = values
            .into_iter()
            .map(|v| benefit(v, BenefitTiming::OneOff, 1, None))
            .collect();
        let r = calculate_tax_economics_v2(&m).unwrap();
        assert_eq!(r.lifecycle_net_benefit, 10_000);
        assert_eq!(r.npv, 9999);
        if let Some(prior) = expected {
            assert_eq!(r.npv, prior);
        }
        expected = Some(r.npv);
    }
}
#[test]
fn ffi_effective_base_and_migration_also_report_overflow() {
    let mut m = model();
    m.missing_tax_base_inputs.clear();
    m.tax_base_components = vec![
        component(i64::MAX, TaxBaseComponentCategory::TaxableIncome),
        component(1, TaxBaseComponentCategory::TaxableIncome),
    ];
    let r = ffi_json(
        |p| ffi::juris_effective_annual_tax_base(p),
        serde_json::to_value(m).unwrap(),
    );
    assert_eq!(r["detail"]["code"], "arithmetic_overflow");
    let v1 = serde_json::json!({
        "kind":"tax-economics-v1", "currency":"EUR", "gross_annual_rent":i64::MAX,
        "rental_property_expenses":-1, "annual_loan_interest":0, "derived_annual_tax_base":null,
        "baseline_tax_rate_bps":0, "optimized_tax_rate_bps":0, "baseline_annual_tax_cost":0,
        "optimized_annual_tax_cost":0, "implementation_cost":0, "annual_maintenance_cost":0,
        "terminal_tax_or_unwind_cost":0, "analysis_horizon_months":12,
        "annual_discount_rate_bps":0, "benefit_realization_bps":10000, "assumptions":"synthetic"
    });
    let r = ffi_json(|p| ffi::juris_migrate_v1_to_v2(p), v1);
    assert_eq!(r["detail"]["code"], "arithmetic_overflow");
}

#[test]
fn exact_year_end_terminal_examples_remain_exact() {
    for (terminal, expected) in [(11_000, -10_000), (12_100, -11_000)] {
        let mut m = model();
        m.terminal_tax_or_unwind_cost = terminal;
        m.annual_discount_rate_bps = 1000;
        assert_eq!(calculate_tax_economics_v2(&m).unwrap().npv, expected);
    }
}
#[test]
fn overlapping_recurring_tax_and_maintenance_cancel_before_discount() {
    let mut m = model();
    m.analysis_horizon_months = 24;
    m.baseline_annual_tax_cost = i64::MAX;
    m.annual_maintenance_cost = i64::MAX;
    m.annual_discount_rate_bps = 1;
    m.benefit_items = vec![
        benefit(i64::MAX, BenefitTiming::RecurringAnnual, 1, Some(12)),
        benefit(-i64::MAX, BenefitTiming::RecurringAnnual, 1, Some(6)),
        benefit(-i64::MAX, BenefitTiming::RecurringAnnual, 7, Some(12)),
        benefit(i64::MAX, BenefitTiming::RecurringAnnual, 25, None),
        benefit(10_000, BenefitTiming::OneOff, 1, None),
    ];
    // Nominal run rates still fit and each dated six-month interval cancels exactly.
    let r = calculate_tax_economics_v2(&m).unwrap();
    assert_eq!(r.lifecycle_net_benefit, 10_000);
    assert_eq!(r.npv, 9999);
}

#[test]
fn canonical_web_fixture_agrees_after_currency_to_cents_conversion() {
    // Executed canonical app/tax-economics.ts blob 1c26baab49eb9c2160b8587748ceca4566ae4e9b.
    // Web: EUR100000 baseline, EUR70000 optimized, EUR50000 implementation,
    // EUR5000 maintenance, EUR10000 terminal, 120 months, 8%, full realization.
    let mut m = model();
    m.baseline_annual_tax_cost = 10_000_000;
    m.optimized_annual_tax_cost = 7_000_000;
    m.implementation_cost = 5_000_000;
    m.annual_maintenance_cost = 500_000;
    m.terminal_tax_or_unwind_cost = 1_000_000;
    m.analysis_horizon_months = 120;
    m.annual_discount_rate_bps = 800;
    let r = calculate_tax_economics_v2(&m).unwrap();
    assert_eq!(r.recognized_annual_tax_saving, 3_000_000);
    assert_eq!(r.operating_annual_benefit, 2_500_000);
    assert_eq!(r.annualized_net_benefit, 2_000_000);
    assert_eq!(r.lifecycle_net_benefit, 19_000_000);
    assert_eq!(r.payback_months, Some(24));
    assert!((r.npv as f64 - 119_185.545_097_184_28 * 100.0).abs() < 1.0);
    assert!((f64::from(r.lifecycle_roi_bps.unwrap()) - 172.727_272_727_272_72 * 100.0).abs() < 1.0);
}
