//! Pure authoring adapters; originals remain separate from calculation inputs.
pub mod bindings;
pub mod legacy;

use crate::{
    transport::{self, BoundaryError, TaxInput, TaxRequest, TaxSuccess},
    TaxBaseMode,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum AdapterError {
    InvalidLegacy { field: String, reason: String },
    MissingLegacyInputs { fields: Vec<String> },
    InvalidBinding { field: String, reason: String },
    StaleSource { field: String },
    MissingOverrideProvenance { fields: Vec<String> },
    Boundary { detail: BoundaryError },
}
impl From<BoundaryError> for AdapterError {
    fn from(detail: BoundaryError) -> Self {
        Self::Boundary { detail }
    }
}
pub(crate) fn invalid_binding(field: &str, reason: &str) -> AdapterError {
    AdapterError::InvalidBinding {
        field: field.into(),
        reason: reason.into(),
    }
}
pub(crate) fn bounded(value: &str, field: &str, max: usize) -> Result<(), AdapterError> {
    if value.trim().is_empty() || value.chars().count() > max || value.contains('\0') {
        Err(invalid_binding(field, "required bounded nonempty text"))
    } else {
        Ok(())
    }
}
pub(crate) fn valid_date(value: &str) -> bool {
    if value.len() != 10
        || value.as_bytes()[4] != b'-'
        || value.as_bytes()[7] != b'-'
        || !value
            .bytes()
            .enumerate()
            .all(|(i, b)| i == 4 || i == 7 || b.is_ascii_digit())
    {
        return false;
    }
    let year = value[..4].parse::<u32>().unwrap_or(0);
    let month = value[5..7].parse::<u32>().unwrap_or(0);
    let day = value[8..].parse::<u32>().unwrap_or(0);
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) => 29,
        2 => 28,
        _ => 0,
    };
    year > 0 && day > 0 && day <= days
}
/// An imported aggregate may be retained as a draft with unknown provenance.
/// User-authored manual overrides require actual reason, owner and date.
pub fn validate_override_provenance(input: &TaxInput) -> Result<(), AdapterError> {
    if input.tax_base_mode != TaxBaseMode::ManualOverride {
        return Ok(());
    }
    let mut missing = Vec::new();
    for (field, value) in [
        ("override_reason", &input.override_reason),
        ("override_owner", &input.override_owner),
        ("override_as_of", &input.override_as_of),
    ] {
        if value.as_ref().map_or(true, |text| text.trim().is_empty()) {
            missing.push(field.into());
        }
    }
    if input.annual_tax_base_override.is_none() {
        missing.push("annual_tax_base_override".into());
    }
    if !missing.is_empty() {
        return Err(AdapterError::MissingOverrideProvenance { fields: missing });
    }
    bounded(
        input.override_reason.as_deref().unwrap_or(""),
        "override_reason",
        4000,
    )?;
    bounded(
        input.override_owner.as_deref().unwrap_or(""),
        "override_owner",
        128,
    )?;
    if !valid_date(input.override_as_of.as_deref().unwrap_or("")) {
        return Err(invalid_binding(
            "override_as_of",
            "expected an actual YYYY-MM-DD date",
        ));
    }
    Ok(())
}
/// Authoring entry point with provenance governance, separate from the raw core.
pub fn calculate_authoring(request: TaxRequest) -> Result<TaxSuccess, AdapterError> {
    request.validate()?;
    validate_override_provenance(&request.input)?;
    transport::calculate(request).map_err(Into::into)
}
