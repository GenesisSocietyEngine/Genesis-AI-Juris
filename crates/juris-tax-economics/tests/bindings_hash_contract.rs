use juris_tax_economics::{
    adapters::{
        bindings::{
            bind_components, BindingDraft, ComponentBinding, CurrentSource, BINDING_HASH_SCHEMA,
        },
        calculate_authoring, AdapterError,
    },
    hashing::{canonical_input_bytes, input_hash},
    money::MoneyCents,
    transport::{decode_request, TaxRequest},
    TaxBaseComponentCategory,
};
const FIXTURE: &str = include_str!("fixtures/transport/eur_dated_input.json");
fn request() -> TaxRequest {
    decode_request(FIXTURE).unwrap()
}
fn source() -> CurrentSource {
    CurrentSource {
        case_id: request().context.case_id,
        scenario_fingerprint: "a".repeat(64),
        fact_ids: vec![
            "fact_income".into(),
            "fact_expense".into(),
            "fact_benefit".into(),
        ],
        reference_ids: vec![],
    }
}
fn bindings() -> Vec<ComponentBinding> {
    request()
        .input
        .tax_base_components
        .into_iter()
        .map(|c| ComponentBinding {
            component_id: c.id,
            label: c.label,
            category: c.category,
            amount: c.signed_amount,
            currency: "EUR".into(),
            fact_id: c.source_node_id.unwrap(),
            source_field: c.source_field,
            scenario_fingerprint: "a".repeat(64),
            period: None,
            jurisdiction: None,
            note: c.note,
            include_in_calculation: true,
            confirmed: true,
            confirmation_owner: Some("synthetic_owner".into()),
            confirmation_as_of: Some("2026-09-29".into()),
        })
        .collect()
}
fn required() -> Vec<String> {
    vec!["income".into(), "expense".into()]
}
fn draft(b: &[ComponentBinding]) -> BindingDraft {
    bind_components(&request(), &source(), &required(), b).unwrap()
}
#[test]
fn confirmed_values_replace_stale_cache_and_apply_category_sign_once() {
    let result = draft(&bindings());
    assert_eq!(result.request.input.derived_annual_tax_base, None);
    assert_eq!(
        result.request.input.tax_base_components[0].note,
        bindings()[0].note
    );
    assert_eq!(
        result.request.input.tax_base_components[0].period,
        "unknown"
    );
    assert!(result.missing_inputs.is_empty());
    let output = calculate_authoring(result.request).unwrap();
    assert_eq!(
        output.result.effective_annual_tax_base,
        Some(MoneyCents::new(25_000_000))
    );
    let mut values = bindings();
    assert_eq!(
        values[1].category,
        TaxBaseComponentCategory::DeductibleExpense
    );
    values[1].amount = MoneyCents::new(-5_000_000);
    assert_eq!(
        calculate_authoring(draft(&values).request)
            .unwrap()
            .result
            .effective_annual_tax_base,
        Some(MoneyCents::new(35_000_000))
    );
}
#[test]
fn unfinished_required_binding_survives_roundtrip_and_prevents_partial_rates() {
    let mut values = bindings();
    values[1].confirmed = false;
    values[1].confirmation_owner = Some("partially typed owner".into());
    values[1].confirmation_as_of = Some("2026-".into());
    let result = draft(&values);
    assert_eq!(result.bindings, values);
    assert_eq!(result.required_component_ids, required());
    assert_eq!(result.missing_inputs, ["expense"]);
    let encoded = serde_json::to_string(&result).unwrap();
    assert_eq!(
        serde_json::from_str::<BindingDraft>(&encoded).unwrap(),
        result
    );
    assert!(calculate_authoring(result.request).is_err());
    let missing = draft(&values[..1]);
    assert_eq!(missing.missing_inputs, ["expense"]);
    assert!(calculate_authoring(missing.request).is_err());
}
#[test]
fn excluded_nonrequired_unconfirmed_binding_is_retained_without_blocking() {
    let mut values = bindings();
    values[1].confirmed = false;
    values[1].include_in_calculation = false;
    values[1].confirmation_owner = None;
    values[1].confirmation_as_of = None;
    let result = bind_components(&request(), &source(), &["income".into()], &values).unwrap();
    assert_eq!(result.bindings, values);
    assert!(result.missing_inputs.is_empty());
    assert_eq!(
        calculate_authoring(result.request)
            .unwrap()
            .result
            .effective_annual_tax_base,
        Some(MoneyCents::new(30_000_000))
    );
    let required_but_excluded = draft(&values);
    assert_eq!(required_but_excluded.missing_inputs, ["expense"]);
}
#[test]
fn stale_or_ambiguous_identity_fails_atomically() {
    let original = request();
    let snapshot = original.clone();
    let mut stale = source();
    stale.scenario_fingerprint = "b".repeat(64);
    assert!(matches!(
        bind_components(&original, &stale, &required(), &bindings()),
        Err(AdapterError::StaleSource { .. })
    ));
    stale = source();
    stale.case_id = "another_case".into();
    assert!(bind_components(&original, &stale, &required(), &bindings()).is_err());
    for mutate in 0..5 {
        let mut values = bindings();
        match mutate {
            0 => values[1].scenario_fingerprint = "c".repeat(64),
            1 => values[1].fact_id = "missing_fact".into(),
            2 => values[1].component_id = values[0].component_id.clone(),
            3 => {
                values[1].fact_id = values[0].fact_id.clone();
                values[1].source_field = values[0].source_field.clone();
            }
            _ => values[1].currency = "USD".into(),
        }
        assert!(bind_components(&original, &source(), &required(), &values).is_err());
    }
    assert_eq!(original, snapshot);
}
#[test]
fn current_index_checks_existing_benefit_references_too() {
    let mut current = source();
    current.fact_ids.retain(|id| id != "fact_benefit");
    assert!(bind_components(&request(), &current, &required(), &bindings()).is_err());
    current.reference_ids.push("fact_benefit".into());
    let result = bind_components(&request(), &current, &required(), &bindings()).unwrap();
    assert_eq!(
        result.request.input.benefit_items,
        request().input.benefit_items
    );
    current.reference_ids.push("fact_benefit".into());
    assert!(bind_components(&request(), &current, &required(), &bindings()).is_err());
    let mut current = source();
    current.fact_ids.push("fact_income".into());
    assert!(bind_components(&request(), &current, &required(), &bindings()).is_err());
    let mut current = source();
    current.reference_ids = vec!["x".into(); 10_001];
    assert!(bind_components(&request(), &current, &required(), &bindings()).is_err());
}
#[test]
fn provenance_is_required_only_when_confirmed_and_bounded_in_partial_drafts() {
    let mut values = bindings();
    values[0].confirmation_owner = None;
    assert!(bind_components(&request(), &source(), &required(), &values).is_err());
    values[0].confirmed = false;
    assert!(bind_components(&request(), &source(), &required(), &values).is_ok());
    values[0].confirmation_owner = Some("x".repeat(129));
    assert!(bind_components(&request(), &source(), &required(), &values).is_err());
    values[0].confirmation_owner = Some("owner".into());
    values[0].confirmation_as_of = Some("x".repeat(129));
    assert!(bind_components(&request(), &source(), &required(), &values).is_err());
    values[0].confirmed = true;
    values[0].confirmation_as_of = Some("2026-02-30".into());
    assert!(bind_components(&request(), &source(), &required(), &values).is_err());
}
#[test]
fn maximum_note_is_preserved_and_provenance_has_separate_versioned_hash() {
    let mut values = bindings();
    values[0].note = "x".repeat(4000);
    let a = draft(&values);
    assert_eq!(a.request.input.tax_base_components[0].note, values[0].note);
    assert_eq!(a.binding_hash_schema, BINDING_HASH_SCHEMA);
    assert_eq!(BINDING_HASH_SCHEMA, "tax-component-bindings-v1");
    values[0].confirmation_owner = Some("another_owner".into());
    let b = draft(&values);
    assert_eq!(a.input_hash, b.input_hash);
    assert_ne!(a.binding_hash, b.binding_hash);
    // Previously concatenating note + owner + date admitted ambiguous provenance.
    let mut first = bindings();
    first[0].note = "N".into();
    first[0].confirmation_owner = Some("O\nConfirmation owner: P".into());
    let mut second = bindings();
    second[0].note = "N\nConfirmation owner: O".into();
    second[0].confirmation_owner = Some("P".into());
    let former_encoding = |b: &ComponentBinding| {
        format!(
            "{}\nConfirmation owner: {}\nConfirmation as-of: {}",
            b.note,
            b.confirmation_owner.as_deref().unwrap(),
            b.confirmation_as_of.as_deref().unwrap()
        )
    };
    assert_eq!(former_encoding(&first[0]), former_encoding(&second[0]));
    assert_ne!(draft(&first).binding_hash, draft(&second).binding_hash);
    assert_eq!(draft(&first).bindings, first);
    assert_eq!(draft(&second).bindings, second);
}
#[test]
fn hash_matches_independent_golden_and_canonicalizes_json_representation() {
    let original = request();
    assert_eq!(
        input_hash(&original).unwrap(),
        "666fac28820e1df818df3b0c2ece03b86b916f9ecd33f11c02ee116e53b40a3a"
    );
    let value: serde_json::Value = serde_json::from_str(FIXTURE).unwrap();
    let pretty = serde_json::to_string_pretty(&value).unwrap();
    let reparsed = decode_request(&pretty).unwrap();
    assert_eq!(
        canonical_input_bytes(&original).unwrap(),
        canonical_input_bytes(&reparsed).unwrap()
    );
    assert!(String::from_utf8(canonical_input_bytes(&original).unwrap()).unwrap()
        .starts_with("{\"input_schema\":\"tax-economics-input-v2\",\"application_policy\":\"tax-editor-v1\",\"scenario_fingerprint\":"));
}
#[test]
fn calculation_hash_changes_for_input_source_and_order_but_not_artifact_revision() {
    let original = request();
    let expected = input_hash(&original).unwrap();
    let mut changed = original.clone();
    changed.context.revision = "42".into();
    changed.context.artifact_id = "copy".into();
    assert_eq!(input_hash(&changed).unwrap(), expected);
    changed = original.clone();
    changed.input.implementation_cost = MoneyCents::new(120_001);
    assert_ne!(input_hash(&changed).unwrap(), expected);
    changed = original.clone();
    changed.context.scenario_fingerprint = "b".repeat(64);
    assert_ne!(input_hash(&changed).unwrap(), expected);
    changed = original.clone();
    changed.input.tax_base_components.reverse();
    assert_ne!(input_hash(&changed).unwrap(), expected);
}
