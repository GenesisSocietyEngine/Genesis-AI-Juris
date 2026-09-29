//! Confirmed structured monetary facts, pinned to the caller's current source.
//! The caller supplies the authoritative fact index/fingerprint; no prose is parsed.
use super::{bounded, invalid_binding, valid_date, AdapterError};
use crate::{
    hashing::{input_hash, serialized_hash},
    money::MoneyCents,
    transport::{ComponentInput, TaxRequest, MAX_ITEMS},
    TaxBaseComponentCategory, TaxBaseMode,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CurrentSource {
    pub case_id: String,
    pub scenario_fingerprint: String,
    pub fact_ids: Vec<String>,
    #[serde(default)]
    pub reference_ids: Vec<String>,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ComponentBinding {
    pub component_id: String,
    pub label: String,
    pub category: TaxBaseComponentCategory,
    pub amount: MoneyCents,
    pub currency: String,
    pub fact_id: String,
    pub source_field: String,
    pub scenario_fingerprint: String,
    pub period: Option<String>,
    pub jurisdiction: Option<String>,
    pub note: String,
    pub include_in_calculation: bool,
    /// A fact's legal status is not confirmation of the monetary extraction.
    pub confirmed: bool,
    pub confirmation_owner: Option<String>,
    pub confirmation_as_of: Option<String>,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BindingDraft {
    pub request: TaxRequest,
    pub input_hash: String,
    pub missing_inputs: Vec<String>,
    pub bindings: Vec<ComponentBinding>,
    pub required_component_ids: Vec<String>,
    pub binding_hash_schema: String,
    pub binding_hash: String,
}
pub const BINDING_HASH_SCHEMA: &str = "tax-component-bindings-v1";
#[derive(Serialize)]
struct BindingIdentity<'a> {
    schema: &'static str,
    source: &'a CurrentSource,
    required_component_ids: &'a [String],
    bindings: &'a [ComponentBinding],
}
fn identifier(value: &str, field: &str) -> Result<(), AdapterError> {
    bounded(value, field, 128)?;
    if value.len() > 128 {
        return Err(invalid_binding(field, "identifier exceeds 128 UTF-8 bytes"));
    }
    Ok(())
}
fn fingerprint(value: &str, field: &str) -> Result<(), AdapterError> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err(invalid_binding(field, "expected lowercase SHA256 hex"));
    }
    Ok(())
}
/// Atomic pure replacement: failures return no partially edited input and never mutate the original.
/// Missing/unconfirmed required amounts produce an incomplete draft; rates cannot calculate it.
pub fn bind_components(
    original: &TaxRequest,
    current: &CurrentSource,
    required_component_ids: &[String],
    bindings: &[ComponentBinding],
) -> Result<BindingDraft, AdapterError> {
    original.validate()?;
    identifier(&current.case_id, "source.case_id")?;
    fingerprint(&current.scenario_fingerprint, "source.scenario_fingerprint")?;
    if original.context.case_id != current.case_id
        || original.context.scenario_fingerprint != current.scenario_fingerprint
    {
        return Err(AdapterError::StaleSource {
            field: "request.context".into(),
        });
    }
    if bindings.len() > MAX_ITEMS
        || required_component_ids.len() > MAX_ITEMS
        || current
            .fact_ids
            .len()
            .saturating_add(current.reference_ids.len())
            > 10_000
    {
        return Err(invalid_binding(
            "bindings",
            "collection exceeds source/binding policy",
        ));
    }
    let mut facts = HashSet::new();
    for fact in &current.fact_ids {
        identifier(fact, "source.fact_ids")?;
        if !facts.insert(fact.as_str()) {
            return Err(invalid_binding(
                "source.fact_ids",
                "duplicate fact identifier",
            ));
        }
    }
    let mut references = HashSet::new();
    for reference in &current.reference_ids {
        identifier(reference, "source.reference_ids")?;
        if !references.insert(reference.as_str()) {
            return Err(invalid_binding(
                "source.reference_ids",
                "duplicate reference",
            ));
        }
    }
    for benefit in &original.input.benefit_items {
        for reference in &benefit.source_node_ids {
            if !facts.contains(reference.as_str()) && !references.contains(reference.as_str()) {
                return Err(invalid_binding(
                    "benefit.source_node_ids",
                    "reference is absent from current source",
                ));
            }
        }
    }
    let mut required = HashSet::new();
    for component in required_component_ids {
        identifier(component, "required_component_ids")?;
        if !required.insert(component.as_str()) {
            return Err(invalid_binding(
                "required_component_ids",
                "duplicate required component",
            ));
        }
    }
    let mut identifiers = HashSet::new();
    let mut anchors = HashSet::new();
    let mut fulfilled = HashSet::new();
    let mut components = Vec::new();
    let mut missing = Vec::new();
    for b in bindings {
        identifier(&b.component_id, "component_id")?;
        identifier(&b.fact_id, "fact_id")?;
        identifier(&b.source_field, "source_field")?;
        bounded(&b.label, "label", 256)?;
        if b.note.chars().count() > 4000 || b.note.contains('\0') {
            return Err(invalid_binding(
                "note",
                "binding note exceeds 4000 characters or contains NUL",
            ));
        }
        if !identifiers.insert(b.component_id.as_str()) {
            return Err(invalid_binding("component_id", "duplicate component"));
        }
        if !anchors.insert((b.fact_id.as_str(), b.source_field.as_str())) {
            return Err(invalid_binding(
                "source_field",
                "one monetary source anchor cannot be counted twice",
            ));
        }
        if b.scenario_fingerprint != current.scenario_fingerprint {
            return Err(AdapterError::StaleSource {
                field: b.component_id.clone(),
            });
        }
        if !facts.contains(b.fact_id.as_str()) {
            return Err(invalid_binding(
                "fact_id",
                "fact is absent from current source",
            ));
        }
        if b.currency != original.input.currency {
            return Err(invalid_binding(
                "currency",
                "binding currency differs; no implicit FX conversion",
            ));
        }
        for (field, value) in [("period", &b.period), ("jurisdiction", &b.jurisdiction)] {
            if let Some(value) = value {
                bounded(value, field, 128)?;
            }
        }
        if i128::from(b.amount.value()).abs() > i128::from(crate::transport::MAX_AMOUNT_CENTS) {
            return Err(invalid_binding(
                "amount",
                "binding amount exceeds application policy",
            ));
        }
        for (field, value) in [
            ("confirmation_owner", &b.confirmation_owner),
            ("confirmation_as_of", &b.confirmation_as_of),
        ] {
            if let Some(value) = value {
                if value.chars().count() > 128 || value.contains('\0') {
                    return Err(invalid_binding(
                        field,
                        "optional provenance exceeds 128 characters or contains NUL",
                    ));
                }
            }
        }
        if !b.confirmed {
            if b.include_in_calculation || required.contains(b.component_id.as_str()) {
                missing.push(b.component_id.clone());
            }
            continue;
        }
        let owner = b.confirmation_owner.as_deref().ok_or_else(|| {
            invalid_binding("confirmation_owner", "confirmed amount requires an owner")
        })?;
        bounded(owner, "confirmation_owner", 128)?;
        let as_of = b.confirmation_as_of.as_deref().ok_or_else(|| {
            invalid_binding(
                "confirmation_as_of",
                "confirmed amount requires an as-of date",
            )
        })?;
        if !valid_date(as_of) {
            return Err(invalid_binding(
                "confirmation_as_of",
                "expected an actual YYYY-MM-DD date",
            ));
        }
        if b.include_in_calculation {
            fulfilled.insert(b.component_id.as_str());
        }
        components.push(ComponentInput {
            id: b.component_id.clone(),
            label: b.label.clone(),
            category: b.category,
            signed_amount: b.amount,
            source_type: "confirmed_monetary_binding".into(),
            source_node_id: Some(b.fact_id.clone()),
            source_field: b.source_field.clone(),
            period: b.period.clone().unwrap_or_else(|| "unknown".into()),
            jurisdiction: b.jurisdiction.clone().unwrap_or_else(|| "unknown".into()),
            evidence_status: "amount_confirmed".into(),
            include_in_calculation: b.include_in_calculation,
            note: b.note.clone(),
        });
    }
    for component in required_component_ids {
        if !fulfilled.contains(component.as_str()) {
            missing.push(component.clone());
        }
    }
    if missing.is_empty()
        && components
            .iter()
            .all(|component| !component.include_in_calculation)
    {
        missing.push("tax_base_components".into());
    }
    missing.sort();
    missing.dedup();
    let mut request = original.clone();
    request.input.tax_base_mode = TaxBaseMode::Derived;
    request.input.tax_base_formula_id = "confirmed-monetary-components".into();
    request.input.tax_base_formula_version = "1".into();
    request.input.tax_base_components = components;
    request.input.derived_annual_tax_base = None;
    request.input.missing_tax_base_inputs = missing.clone();
    request.input.annual_tax_base_override = None;
    request.input.override_reason = None;
    request.input.override_owner = None;
    request.input.override_as_of = None;
    let hash = input_hash(&request)?;
    let binding_hash = serialized_hash(&BindingIdentity {
        schema: BINDING_HASH_SCHEMA,
        source: current,
        required_component_ids,
        bindings,
    })?;
    Ok(BindingDraft {
        request,
        input_hash: hash,
        missing_inputs: missing,
        bindings: bindings.to_vec(),
        required_component_ids: required_component_ids.to_vec(),
        binding_hash_schema: BINDING_HASH_SCHEMA.into(),
        binding_hash,
    })
}
