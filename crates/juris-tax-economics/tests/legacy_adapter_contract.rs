use juris_tax_economics::{
    adapters::{
        calculate_authoring,
        legacy::{import_legacy, ImportStatus, LegacyDraft, LegacySchema},
        validate_override_provenance, AdapterError,
    },
    money::MoneyCents,
    transport::{self, CalculationContext},
};
use serde_json::{json, Value};
const OLD: &str = include_str!("fixtures/adapters/web_amounts_v1.json");
const CURRENT: &str = include_str!("fixtures/adapters/web_rates_fx_v1.json");
fn context() -> CalculationContext {
    CalculationContext {
        case_id: "synthetic_case".into(),
        artifact_id: "synthetic_analysis".into(),
        revision: "1".into(),
        scenario_fingerprint: "a".repeat(64),
    }
}
fn converted(schema: LegacySchema, source: &str) -> LegacyDraft {
    let record = import_legacy(schema, source.into(), context());
    match record.status {
        ImportStatus::Converted { draft } => *draft,
        other => panic!("{other:?}"),
    }
}
fn unavailable(schema: LegacySchema, source: &str) -> AdapterError {
    let record = import_legacy(schema, source.into(), context());
    assert_eq!(record.original_json, source);
    assert_eq!(record.original_sha256.len(), 64);
    match record.status {
        ImportStatus::Unavailable { reason } => reason,
        other => panic!("{other:?}"),
    }
}
fn change(source: &str, field: &str, value: Value) -> String {
    let mut parsed: Value = serde_json::from_str(source).unwrap();
    parsed[field] = value;
    parsed.to_string()
}
#[test]
fn amounts_import_preserves_units_horizon_assumptions_and_absent_base() {
    let draft = converted(LegacySchema::WebAmountsV1, OLD);
    let m = &draft.request.input;
    assert_eq!(m.tax_input_basis, "amounts");
    assert_eq!(m.baseline_annual_tax_cost.value(), 5_000_000);
    assert_eq!(m.optimized_annual_tax_cost.value(), 3_000_000);
    assert_eq!(m.implementation_cost.value(), 100_000);
    assert_eq!(m.annual_maintenance_cost.value(), 20_000);
    assert_eq!(m.terminal_tax_or_unwind_cost.value(), 50_000);
    assert_eq!(m.analysis_horizon_months, 18);
    assert_eq!(
        m.assumptions,
        "  Synthetic legacy assumptions preserved verbatim.  "
    );
    assert_eq!(m.annual_tax_base_override, None);
    assert_eq!(m.derived_annual_tax_base, None);
    assert_eq!(draft.fx_json, None);
    assert_eq!(
        calculate_authoring(draft.request)
            .unwrap()
            .result
            .effective_annual_tax_base,
        None
    );
}
#[test]
fn current_import_preserves_saved_base_and_raw_fx_without_reconversion_or_approval() {
    let draft = converted(LegacySchema::WebRatesFxV1, CURRENT);
    assert_eq!(
        draft.request.input.annual_tax_base_override,
        Some(MoneyCents::new(25_000_000))
    );
    assert_eq!(
        draft.request.input.baseline_annual_tax_cost.value(),
        5_000_000
    );
    assert!(draft.request.input.tax_base_components.is_empty());
    assert_eq!(draft.request.input.override_owner, None);
    assert_eq!(draft.request.input.override_as_of, None);
    assert_eq!(
        draft.missing_override_provenance,
        ["override_owner", "override_as_of"]
    );
    assert_eq!(draft.fx_json.as_deref(), Some("{\"provider\":\"ECB\", \"sourceCurrency\":\"GBP\", \"targetCurrency\":\"EUR\", \"rate\":1.2300e+0, \"asOf\":\"2026-09-29\"}"));
    assert!(matches!(
        calculate_authoring(draft.request),
        Err(AdapterError::MissingOverrideProvenance { .. })
    ));
}
#[test]
fn import_is_idempotent_and_variant_selection_is_explicit() {
    for (schema, source) in [
        (LegacySchema::WebAmountsV1, OLD),
        (LegacySchema::WebRatesFxV1, CURRENT),
    ] {
        let first = import_legacy(schema, source.into(), context());
        assert_eq!(first, import_legacy(schema, source.into(), context()));
        assert_eq!(first.original_json, source);
    }
    unavailable(LegacySchema::WebAmountsV1, CURRENT);
    unavailable(LegacySchema::WebRatesFxV1, OLD);
    unavailable(
        LegacySchema::WebRatesFxV1,
        &change(CURRENT, "taxInputBasis", json!("surprise")),
    );
    unavailable(
        LegacySchema::WebAmountsV1,
        &change(OLD, "kind", json!("tax-economics-v2")),
    );
}
#[test]
fn rates_missing_or_null_inputs_are_not_factual_zero() {
    for field in ["annualTaxBase", "baselineTaxRateBps", "optimizedTaxRateBps"] {
        assert!(matches!(
            unavailable(
                LegacySchema::WebRatesFxV1,
                &change(CURRENT, field, Value::Null)
            ),
            AdapterError::MissingLegacyInputs { .. }
        ));
        let mut value: Value = serde_json::from_str(CURRENT).unwrap();
        value.as_object_mut().unwrap().remove(field);
        assert!(matches!(
            unavailable(LegacySchema::WebRatesFxV1, &value.to_string()),
            AdapterError::MissingLegacyInputs { .. }
        ));
    }
    let draft = converted(
        LegacySchema::WebRatesFxV1,
        &change(CURRENT, "annualTaxBase", json!(0)),
    );
    assert_eq!(
        draft.request.input.annual_tax_base_override,
        Some(MoneyCents::new(0))
    );
}
#[test]
fn current_amounts_optional_unused_fields_remain_explicitly_unavailable() {
    let mut value: Value = serde_json::from_str(CURRENT).unwrap();
    value["taxInputBasis"] = json!("amounts");
    for field in [
        "annualTaxBase",
        "baselineTaxRateBps",
        "optimizedTaxRateBps",
        "assumptions",
    ] {
        value.as_object_mut().unwrap().remove(field);
    }
    let draft = converted(LegacySchema::WebRatesFxV1, &value.to_string());
    assert_eq!(draft.unavailable_legacy_fields.len(), 4);
    assert_eq!(draft.request.input.annual_tax_base_override, None);
    assert!(calculate_authoring(draft.request).is_ok());
    let draft = converted(
        LegacySchema::WebRatesFxV1,
        &change(CURRENT, "taxInputBasis", json!("amounts")),
    );
    assert!(draft.inactive_tax_base.is_some());
    assert!(draft.missing_override_provenance.is_empty());
    assert!(calculate_authoring(draft.request).is_ok());
}
#[test]
fn exact_integral_legacy_number_tokens_never_use_float() {
    for token in ["1000", "1e3", "1000.0", "100000e-2"] {
        let source = OLD.replace(
            "\"implementationCost\":1000",
            &format!("\"implementationCost\":{token}"),
        );
        assert_eq!(
            converted(LegacySchema::WebAmountsV1, &source)
                .request
                .input
                .implementation_cost
                .value(),
            100_000
        );
    }
    let source = OLD.replace("\"implementationCost\":1000", "\"implementationCost\":-0");
    assert_eq!(
        converted(LegacySchema::WebAmountsV1, &source)
            .request
            .input
            .implementation_cost
            .value(),
        0
    );
    for token in [
        "0.5",
        "1000000000000.00001",
        "0.99999999999999999999",
        "-1",
        "1000000000001",
        "9007199254740993",
        "1e999999999",
        "1e-9999999",
        "\"1000\"",
    ] {
        let source = OLD.replace(
            "\"implementationCost\":1000",
            &format!("\"implementationCost\":{token}"),
        );
        unavailable(LegacySchema::WebAmountsV1, &source);
    }
    let draft = converted(
        LegacySchema::WebAmountsV1,
        &change(OLD, "implementationCost", json!(1_000_000_000_000u64)),
    );
    assert_eq!(
        draft.request.input.implementation_cost.value(),
        100_000_000_000_000
    );
}
#[test]
fn unsupported_duplicate_and_unknown_content_is_preserved_without_partial_success() {
    for source in [
        OLD.replace(
            "\"currency\":\"EUR\"",
            "\"currency\":\"EUR\",\"currency\":\"USD\"",
        ),
        change(OLD, "future", json!({"preserve":"yes"})),
        change(OLD, "currency", json!("JPY")),
        change(OLD, "assumptions", json!("x".repeat(4001))),
        change(OLD, "analysisHorizonMonths", json!(0)),
        "{broken original".into(),
        " ".repeat(transport::MAX_REQUEST_BYTES + 1),
    ] {
        unavailable(LegacySchema::WebAmountsV1, &source);
    }
}
#[test]
fn fx_metadata_is_bounded_validated_and_remains_historical() {
    for rate in ["0", "-1", "1000000.01", "1e7", "1e999", "\"1.23\""] {
        unavailable(
            LegacySchema::WebRatesFxV1,
            &CURRENT.replace("1.2300e+0", rate),
        );
    }
    for rate in ["1e-38", "1000000", "1.000000e6"] {
        converted(
            LegacySchema::WebRatesFxV1,
            &CURRENT.replace("1.2300e+0", rate),
        );
    }
    unavailable(
        LegacySchema::WebRatesFxV1,
        &CURRENT.replace("2026-09-29", "2026-02-30"),
    );
    let changed = CURRENT.replace("1.2300e+0", "2.0");
    let first = import_legacy(LegacySchema::WebRatesFxV1, CURRENT.into(), context());
    let second = import_legacy(LegacySchema::WebRatesFxV1, changed, context());
    assert_ne!(first.original_sha256, second.original_sha256);
    let (ImportStatus::Converted { draft: a }, ImportStatus::Converted { draft: b }) =
        (first.status, second.status)
    else {
        panic!()
    };
    assert_eq!(a.input_hash, b.input_hash); // This is not an original/artifact integrity hash.
    assert_ne!(a.fx_json, b.fx_json);
}
#[test]
fn explicit_manual_override_requires_actual_complete_provenance() {
    let mut draft = converted(LegacySchema::WebRatesFxV1, CURRENT);
    draft.request.input.override_reason = Some("Confirmed retained aggregate after review".into());
    draft.request.input.override_owner = Some("synthetic_reviewer".into());
    draft.request.input.override_as_of = Some("2026-02-30".into());
    assert!(validate_override_provenance(&draft.request.input).is_err());
    draft.request.input.override_as_of = Some("2024-02-29".into());
    assert!(calculate_authoring(draft.request.clone()).is_ok());
    draft.request.input.override_reason = Some(" ".into());
    assert!(validate_override_provenance(&draft.request.input).is_err());
}

#[test]
fn amounts_import_retains_zero_and_nonzero_inactive_bases_without_blocking() {
    let mut prior_hash = None;
    for major in [0, 250_000] {
        let source = CURRENT
            .replace(
                "\"taxInputBasis\":\"rates\"",
                "\"taxInputBasis\":\"amounts\"",
            )
            .replace(
                "\"annualTaxBase\":250000",
                &format!("\"annualTaxBase\":{major}"),
            );
        let record = import_legacy(LegacySchema::WebRatesFxV1, source.clone(), context());
        assert_eq!(record.original_json, source);
        assert_eq!(
            record,
            import_legacy(LegacySchema::WebRatesFxV1, source, context())
        );
        let ImportStatus::Converted { draft } = &record.status else {
            panic!()
        };
        let candidate = draft.inactive_tax_base.as_ref().unwrap();
        assert_eq!(candidate.amount.value(), major * 100);
        assert_eq!(candidate.currency, "EUR");
        assert_eq!(candidate.source_original_sha256, record.original_sha256);
        assert_eq!(
            candidate.provenance,
            juris_tax_economics::adapters::legacy::LegacyBaseProvenance::Unknown
        );
        assert_eq!(draft.request.input.annual_tax_base_override, None);
        assert_eq!(draft.request.input.derived_annual_tax_base, None);
        assert!(draft.request.input.tax_base_components.is_empty());
        assert_eq!(draft.request.input.override_owner, None);
        assert_eq!(draft.request.input.override_as_of, None);
        assert!(draft.missing_override_provenance.is_empty());
        assert_eq!(
            draft.fx_json,
            converted(LegacySchema::WebRatesFxV1, CURRENT).fx_json
        );
        let roundtrip = serde_json::to_string(&record).unwrap();
        assert_eq!(
            serde_json::from_str::<juris_tax_economics::adapters::legacy::LegacyImport>(&roundtrip)
                .unwrap(),
            record
        );
        let output = calculate_authoring(draft.request.clone()).unwrap();
        assert_eq!(output.result.baseline_annual_tax_cost.value(), 5_000_000);
        assert_eq!(output.result.optimized_annual_tax_cost.value(), 3_000_000);
        assert_eq!(output.result.effective_annual_tax_base, None);
        if let Some(previous) = prior_hash {
            assert_eq!(draft.input_hash, previous);
        }
        prior_hash = Some(draft.input_hash.clone());
    }
}
#[test]
fn inactive_base_never_activates_on_bare_basis_or_currency_toggle() {
    let source = change(CURRENT, "taxInputBasis", json!("amounts"));
    let mut draft = converted(LegacySchema::WebRatesFxV1, &source);
    let candidate = draft.inactive_tax_base.clone().unwrap();
    draft.request.input.currency = "USD".into();
    assert_eq!(draft.inactive_tax_base.as_ref().unwrap().currency, "EUR");
    draft.request.input.tax_input_basis = "rates".into();
    assert!(matches!(
        calculate_authoring(draft.request.clone()),
        Err(AdapterError::Boundary {
            detail: transport::BoundaryError::Calculation {
                detail: transport::CalculationErrorDetail::MissingTaxBase { .. }
            }
        })
    ));
    draft.request.input.currency = candidate.currency;
    draft.request.input.tax_base_mode = juris_tax_economics::TaxBaseMode::ManualOverride;
    draft.request.input.annual_tax_base_override = Some(candidate.amount);
    draft.request.input.missing_tax_base_inputs.clear();
    draft.request.input.override_reason = Some("User chose retained aggregate after review".into());
    assert!(matches!(
        calculate_authoring(draft.request.clone()),
        Err(AdapterError::MissingOverrideProvenance { .. })
    ));
    draft.request.input.override_owner = Some("synthetic_reviewer".into());
    draft.request.input.override_as_of = Some("2026-09-29".into());
    assert_eq!(
        calculate_authoring(draft.request)
            .unwrap()
            .result
            .effective_annual_tax_base,
        Some(candidate.amount)
    );
}
#[test]
fn inactive_metadata_does_not_turn_absent_rates_or_base_into_confirmed_zero() {
    let mut value: Value = serde_json::from_str(CURRENT).unwrap();
    value["taxInputBasis"] = json!("amounts");
    for field in ["baselineTaxRateBps", "optimizedTaxRateBps"] {
        value.as_object_mut().unwrap().remove(field);
    }
    let mut draft = converted(LegacySchema::WebRatesFxV1, &value.to_string());
    assert!(draft.inactive_tax_base.is_some());
    assert_eq!(
        draft.unavailable_legacy_fields,
        ["baselineTaxRateBps", "optimizedTaxRateBps"]
    );
    assert!(calculate_authoring(draft.request.clone()).is_ok());
    draft.request.input.tax_input_basis = "rates".into();
    assert!(matches!(
        calculate_authoring(draft.request),
        Err(AdapterError::Boundary {
            detail: transport::BoundaryError::Calculation {
                detail: transport::CalculationErrorDetail::MissingTaxBase { .. }
            }
        })
    ));
    for state in [None, Some(Value::Null)] {
        if let Some(null) = state {
            value["annualTaxBase"] = null;
        } else {
            value.as_object_mut().unwrap().remove("annualTaxBase");
        }
        let draft = converted(LegacySchema::WebRatesFxV1, &value.to_string());
        assert_eq!(draft.inactive_tax_base, None);
        assert!(draft
            .unavailable_legacy_fields
            .contains(&"annualTaxBase".into()));
        assert!(calculate_authoring(draft.request).is_ok());
    }
}
