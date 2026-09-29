//! Versioned pure JSON boundary. Core calculation semantics remain authoritative.
//! No bridge commands, persistence or legacy migration are installed by this module.
use crate::{
    money::MoneyCents, BenefitTiming, BenefitType, RoiUnavailableReason, TaxBaseComponentCategory,
    TaxBaseMode,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub const INPUT_SCHEMA: &str = "tax-economics-input-v2";
pub const RESULT_SCHEMA: &str = "tax-economics-result-v2";
pub const TRANSPORT_PROTOCOL: &str = "tax-economics-json-v1";
pub const CALCULATION_VERSION: &str = "tax-economics-2026-09-29";
pub const APPLICATION_POLICY: &str = "tax-editor-v1";
pub const MAX_REQUEST_BYTES: usize = 262_144;
pub const MAX_ITEMS: usize = 100;
pub const MAX_AMOUNT_CENTS: i64 = 100_000_000_000_000;
pub const SUPPORTED_CURRENCIES: &[&str] = &["EUR", "GBP", "USD"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ComponentInput {
    pub id: String,
    pub label: String,
    pub category: TaxBaseComponentCategory,
    pub signed_amount: MoneyCents,
    pub source_type: String,
    pub source_node_id: Option<String>,
    pub source_field: String,
    pub period: String,
    pub jurisdiction: String,
    pub evidence_status: String,
    pub include_in_calculation: bool,
    pub note: String,
}

impl From<crate::TaxBaseComponent> for ComponentInput {
    fn from(value: crate::TaxBaseComponent) -> Self {
        Self {
            id: value.id,
            label: value.label,
            category: value.category,
            signed_amount: MoneyCents::new(value.signed_amount),
            source_type: value.source_type,
            source_node_id: value.source_node_id,
            source_field: value.source_field,
            period: value.period,
            jurisdiction: value.jurisdiction,
            evidence_status: value.evidence_status,
            include_in_calculation: value.include_in_calculation,
            note: value.note,
        }
    }
}

impl From<ComponentInput> for crate::TaxBaseComponent {
    fn from(value: ComponentInput) -> Self {
        Self {
            id: value.id,
            label: value.label,
            category: value.category,
            signed_amount: value.signed_amount.value(),
            source_type: value.source_type,
            source_node_id: value.source_node_id,
            source_field: value.source_field,
            period: value.period,
            jurisdiction: value.jurisdiction,
            evidence_status: value.evidence_status,
            include_in_calculation: value.include_in_calculation,
            note: value.note,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BenefitInput {
    pub id: String,
    pub label: String,
    pub benefit_type: BenefitType,
    pub timing: BenefitTiming,
    pub amount: MoneyCents,
    pub start_month: u32,
    pub end_month: Option<u32>,
    pub realization_bps: Option<u16>,
    pub probability_bps: Option<u16>,
    pub source_node_ids: Vec<String>,
    pub note: Option<String>,
    pub include_in_base_case: bool,
}

impl From<crate::TaxBenefitItem> for BenefitInput {
    fn from(value: crate::TaxBenefitItem) -> Self {
        Self {
            id: value.id,
            label: value.label,
            benefit_type: value.benefit_type,
            timing: value.timing,
            amount: MoneyCents::new(value.amount),
            start_month: value.start_month,
            end_month: value.end_month,
            realization_bps: value.realization_bps,
            probability_bps: value.probability_bps,
            source_node_ids: value.source_node_ids,
            note: value.note,
            include_in_base_case: value.include_in_base_case,
        }
    }
}

impl From<BenefitInput> for crate::TaxBenefitItem {
    fn from(value: BenefitInput) -> Self {
        Self {
            id: value.id,
            label: value.label,
            benefit_type: value.benefit_type,
            timing: value.timing,
            amount: value.amount.value(),
            start_month: value.start_month,
            end_month: value.end_month,
            realization_bps: value.realization_bps,
            probability_bps: value.probability_bps,
            source_node_ids: value.source_node_ids,
            note: value.note,
            include_in_base_case: value.include_in_base_case,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TaxInput {
    pub kind: String,
    pub currency: String,
    pub tax_input_basis: String,
    pub tax_base_mode: TaxBaseMode,
    pub tax_base_formula_id: String,
    pub tax_base_formula_version: String,
    pub tax_base_components: Vec<ComponentInput>,
    pub derived_annual_tax_base: Option<MoneyCents>,
    pub missing_tax_base_inputs: Vec<String>,
    pub annual_tax_base_override: Option<MoneyCents>,
    pub override_reason: Option<String>,
    pub override_owner: Option<String>,
    pub override_as_of: Option<String>,
    pub baseline_tax_rate_bps: u16,
    pub optimized_tax_rate_bps: u16,
    pub baseline_annual_tax_cost: MoneyCents,
    pub optimized_annual_tax_cost: MoneyCents,
    pub implementation_cost: MoneyCents,
    pub annual_maintenance_cost: MoneyCents,
    pub terminal_tax_or_unwind_cost: MoneyCents,
    pub analysis_horizon_months: u32,
    pub annual_discount_rate_bps: u16,
    pub benefit_realization_bps: u16,
    pub benefit_items: Vec<BenefitInput>,
    pub assumptions: String,
}

impl From<crate::TaxEconomicsV2> for TaxInput {
    fn from(value: crate::TaxEconomicsV2) -> Self {
        Self {
            kind: value.kind,
            currency: value.currency,
            tax_input_basis: value.tax_input_basis,
            tax_base_mode: value.tax_base_mode,
            tax_base_formula_id: value.tax_base_formula_id,
            tax_base_formula_version: value.tax_base_formula_version,
            tax_base_components: value
                .tax_base_components
                .into_iter()
                .map(Into::into)
                .collect(),
            derived_annual_tax_base: value.derived_annual_tax_base.map(MoneyCents::new),
            missing_tax_base_inputs: value.missing_tax_base_inputs,
            annual_tax_base_override: value.annual_tax_base_override.map(MoneyCents::new),
            override_reason: value.override_reason,
            override_owner: value.override_owner,
            override_as_of: value.override_as_of,
            baseline_tax_rate_bps: value.baseline_tax_rate_bps,
            optimized_tax_rate_bps: value.optimized_tax_rate_bps,
            baseline_annual_tax_cost: MoneyCents::new(value.baseline_annual_tax_cost),
            optimized_annual_tax_cost: MoneyCents::new(value.optimized_annual_tax_cost),
            implementation_cost: MoneyCents::new(value.implementation_cost),
            annual_maintenance_cost: MoneyCents::new(value.annual_maintenance_cost),
            terminal_tax_or_unwind_cost: MoneyCents::new(value.terminal_tax_or_unwind_cost),
            analysis_horizon_months: value.analysis_horizon_months,
            annual_discount_rate_bps: value.annual_discount_rate_bps,
            benefit_realization_bps: value.benefit_realization_bps,
            benefit_items: value.benefit_items.into_iter().map(Into::into).collect(),
            assumptions: value.assumptions,
        }
    }
}

impl From<TaxInput> for crate::TaxEconomicsV2 {
    fn from(value: TaxInput) -> Self {
        Self {
            kind: value.kind,
            currency: value.currency,
            tax_input_basis: value.tax_input_basis,
            tax_base_mode: value.tax_base_mode,
            tax_base_formula_id: value.tax_base_formula_id,
            tax_base_formula_version: value.tax_base_formula_version,
            tax_base_components: value
                .tax_base_components
                .into_iter()
                .map(Into::into)
                .collect(),
            derived_annual_tax_base: value.derived_annual_tax_base.map(MoneyCents::value),
            missing_tax_base_inputs: value.missing_tax_base_inputs,
            annual_tax_base_override: value.annual_tax_base_override.map(MoneyCents::value),
            override_reason: value.override_reason,
            override_owner: value.override_owner,
            override_as_of: value.override_as_of,
            baseline_tax_rate_bps: value.baseline_tax_rate_bps,
            optimized_tax_rate_bps: value.optimized_tax_rate_bps,
            baseline_annual_tax_cost: value.baseline_annual_tax_cost.value(),
            optimized_annual_tax_cost: value.optimized_annual_tax_cost.value(),
            implementation_cost: value.implementation_cost.value(),
            annual_maintenance_cost: value.annual_maintenance_cost.value(),
            terminal_tax_or_unwind_cost: value.terminal_tax_or_unwind_cost.value(),
            analysis_horizon_months: value.analysis_horizon_months,
            annual_discount_rate_bps: value.annual_discount_rate_bps,
            benefit_realization_bps: value.benefit_realization_bps,
            benefit_items: value.benefit_items.into_iter().map(Into::into).collect(),
            assumptions: value.assumptions,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TaxResult {
    pub effective_annual_tax_base: Option<MoneyCents>,
    pub baseline_annual_tax_cost: MoneyCents,
    pub optimized_annual_tax_cost: MoneyCents,
    pub recognized_annual_tax_saving: MoneyCents,
    pub recognized_recurring_benefits: MoneyCents,
    pub recognized_one_off_benefits: MoneyCents,
    pub gross_recognized_annual_benefit: MoneyCents,
    pub operating_annual_benefit: MoneyCents,
    pub annualized_net_benefit: MoneyCents,
    pub lifecycle_net_benefit: MoneyCents,
    pub lifecycle_roi_bps: Option<i32>,
    pub lifecycle_roi_unavailable_reason: Option<RoiUnavailableReason>,
    pub npv: MoneyCents,
    pub payback_months: Option<u32>,
}

impl From<crate::TaxEconomicsCalculationResult> for TaxResult {
    fn from(value: crate::TaxEconomicsCalculationResult) -> Self {
        Self {
            effective_annual_tax_base: value.effective_annual_tax_base.map(MoneyCents::new),
            baseline_annual_tax_cost: MoneyCents::new(value.baseline_annual_tax_cost),
            optimized_annual_tax_cost: MoneyCents::new(value.optimized_annual_tax_cost),
            recognized_annual_tax_saving: MoneyCents::new(value.recognized_annual_tax_saving),
            recognized_recurring_benefits: MoneyCents::new(value.recognized_recurring_benefits),
            recognized_one_off_benefits: MoneyCents::new(value.recognized_one_off_benefits),
            gross_recognized_annual_benefit: MoneyCents::new(value.gross_recognized_annual_benefit),
            operating_annual_benefit: MoneyCents::new(value.operating_annual_benefit),
            annualized_net_benefit: MoneyCents::new(value.annualized_net_benefit),
            lifecycle_net_benefit: MoneyCents::new(value.lifecycle_net_benefit),
            lifecycle_roi_bps: value.lifecycle_roi_bps,
            lifecycle_roi_unavailable_reason: value.lifecycle_roi_unavailable_reason,
            npv: MoneyCents::new(value.npv),
            payback_months: value.payback_months,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CalculationContext {
    pub case_id: String,
    pub artifact_id: String,
    /// Canonical nonnegative decimal u64; safe across JavaScript persistence.
    pub revision: String,
    pub scenario_fingerprint: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TaxRequest {
    pub transport_protocol: String,
    pub input_schema: String,
    pub application_policy: String,
    pub context: CalculationContext,
    pub input: TaxInput,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TaxSuccess {
    pub transport_protocol: String,
    pub result_schema: String,
    pub calculation_version: String,
    pub application_policy: String,
    pub context: CalculationContext,
    pub result: TaxResult,
}
/// Deliberate Eq projection, preserving the core's existing codes and fields.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum CalculationErrorDetail {
    MissingTaxBase { missing_inputs: Vec<String> },
    UnknownTaxInputBasis { value: String },
    ArithmeticOverflow { field: String },
    NumericPrecision { field: String },
    InvalidInput { field: String, reason: String },
}
impl From<crate::TaxEconomicsError> for CalculationErrorDetail {
    fn from(value: crate::TaxEconomicsError) -> Self {
        match value {
            crate::TaxEconomicsError::MissingTaxBase { missing_inputs } => {
                Self::MissingTaxBase { missing_inputs }
            }
            crate::TaxEconomicsError::UnknownTaxInputBasis { value } => {
                Self::UnknownTaxInputBasis { value }
            }
            crate::TaxEconomicsError::ArithmeticOverflow { field } => {
                Self::ArithmeticOverflow { field }
            }
            crate::TaxEconomicsError::NumericPrecision { field } => {
                Self::NumericPrecision { field }
            }
            crate::TaxEconomicsError::InvalidInput { field, reason } => {
                Self::InvalidInput { field, reason }
            }
        }
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum BoundaryError {
    InvalidPayload { message: String },
    UnsupportedVersion { field: String, value: String },
    PolicyRejected { field: String, reason: String },
    Calculation { detail: CalculationErrorDetail },
}
fn policy(field: &str, reason: &str) -> BoundaryError {
    BoundaryError::PolicyRejected {
        field: field.into(),
        reason: reason.into(),
    }
}
fn version(field: &str, actual: &str, expected: &str) -> Result<(), BoundaryError> {
    if actual == expected {
        Ok(())
    } else {
        Err(BoundaryError::UnsupportedVersion {
            field: field.into(),
            value: actual.into(),
        })
    }
}
fn text_bound(value: &str, field: &str, max: usize, required: bool) -> Result<(), BoundaryError> {
    if value.chars().count() > max || (required && value.trim().is_empty()) || value.contains('\0')
    {
        return Err(policy(field, "text is empty, too long, or contains NUL"));
    }
    Ok(())
}
fn id(value: &str, field: &str) -> Result<(), BoundaryError> {
    if value.len() > 128 {
        return Err(policy(field, "identifier exceeds 128 UTF-8 bytes"));
    }
    text_bound(value, field, 128, true)
}
fn amount_bound(value: MoneyCents, field: &str) -> Result<(), BoundaryError> {
    if i128::from(value.value()).abs() > i128::from(MAX_AMOUNT_CENTS) {
        return Err(policy(field, "amount exceeds application policy"));
    }
    Ok(())
}
fn optional_text(value: &Option<String>, field: &str, max: usize) -> Result<(), BoundaryError> {
    if let Some(value) = value {
        text_bound(value, field, max, false)?;
    }
    Ok(())
}
fn unique_ids<'a>(values: impl Iterator<Item = &'a str>, field: &str) -> Result<(), BoundaryError> {
    let mut seen = HashSet::new();
    for value in values {
        id(value, field)?;
        if !seen.insert(value) {
            return Err(policy(field, "duplicate identifier"));
        }
    }
    Ok(())
}
/// Counts JSON output without allocating an encoded copy.
struct RequestSize {
    remaining: usize,
    exceeded: bool,
}
impl std::io::Write for RequestSize {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        if bytes.len() > self.remaining {
            self.exceeded = true;
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "request size limit",
            ));
        }
        self.remaining -= bytes.len();
        Ok(bytes.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}
fn encoded_limit(request: &TaxRequest) -> Result<(), BoundaryError> {
    let mut counter = RequestSize {
        remaining: MAX_REQUEST_BYTES,
        exceeded: false,
    };
    if let Err(error) = serde_json::to_writer(&mut counter, request) {
        return if counter.exceeded {
            Err(policy("request", "encoded request exceeds 256 KiB"))
        } else {
            Err(BoundaryError::InvalidPayload {
                message: error.to_string(),
            })
        };
    }
    Ok(())
}

impl TaxRequest {
    /// Validate application policy without narrowing the pure calculator's domain.
    pub fn validate(&self) -> Result<(), BoundaryError> {
        version(
            "transport_protocol",
            &self.transport_protocol,
            TRANSPORT_PROTOCOL,
        )?;
        version("input_schema", &self.input_schema, INPUT_SCHEMA)?;
        version(
            "application_policy",
            &self.application_policy,
            APPLICATION_POLICY,
        )?;
        id(&self.context.case_id, "context.case_id")?;
        id(&self.context.artifact_id, "context.artifact_id")?;
        let revision = &self.context.revision;
        if revision.is_empty()
            || !revision.bytes().all(|v| v.is_ascii_digit())
            || (revision.len() > 1 && revision.starts_with('0'))
            || revision.parse::<u64>().is_err()
        {
            return Err(policy(
                "context.revision",
                "expected a canonical nonnegative u64 decimal string",
            ));
        }
        let fingerprint = &self.context.scenario_fingerprint;
        if fingerprint.len() != 64
            || !fingerprint
                .bytes()
                .all(|v| v.is_ascii_digit() || (b'a'..=b'f').contains(&v))
        {
            return Err(policy(
                "context.scenario_fingerprint",
                "expected lowercase SHA256 hex",
            ));
        }
        let m = &self.input;
        version("input.kind", &m.kind, "tax-economics-v2")?;
        if !SUPPORTED_CURRENCIES.contains(&m.currency.as_str()) {
            return Err(policy("input.currency", "unsupported two-decimal currency"));
        }
        if !(1..=240).contains(&m.analysis_horizon_months) {
            return Err(policy(
                "input.analysis_horizon_months",
                "supported editor range is 1..240",
            ));
        }
        if m.annual_discount_rate_bps > 5000 {
            return Err(policy(
                "input.annual_discount_rate_bps",
                "supported editor range is 0..5000",
            ));
        }
        if m.tax_base_components.len() > MAX_ITEMS
            || m.benefit_items.len() > MAX_ITEMS
            || m.missing_tax_base_inputs.len() > MAX_ITEMS
        {
            return Err(policy("input", "collection exceeds 100 items"));
        }
        text_bound(&m.tax_input_basis, "input.tax_input_basis", 128, true)?;
        id(&m.tax_base_formula_id, "input.tax_base_formula_id")?;
        id(
            &m.tax_base_formula_version,
            "input.tax_base_formula_version",
        )?;
        text_bound(&m.assumptions, "input.assumptions", 4000, false)?;
        optional_text(&m.override_reason, "input.override_reason", 4000)?;
        optional_text(&m.override_owner, "input.override_owner", 128)?;
        optional_text(&m.override_as_of, "input.override_as_of", 128)?;
        // Actual fact/reference validity and author provenance are P1b/P3 concerns.
        for missing in &m.missing_tax_base_inputs {
            text_bound(missing, "input.missing_tax_base_inputs", 256, true)?;
        }
        if let Some(value) = m.derived_annual_tax_base {
            amount_bound(value, "input.derived_annual_tax_base")?;
        }
        if let Some(value) = m.annual_tax_base_override {
            amount_bound(value, "input.annual_tax_base_override")?;
        }
        amount_bound(m.baseline_annual_tax_cost, "input.baseline_annual_tax_cost")?;
        amount_bound(
            m.optimized_annual_tax_cost,
            "input.optimized_annual_tax_cost",
        )?;
        amount_bound(m.implementation_cost, "input.implementation_cost")?;
        amount_bound(m.annual_maintenance_cost, "input.annual_maintenance_cost")?;
        amount_bound(
            m.terminal_tax_or_unwind_cost,
            "input.terminal_tax_or_unwind_cost",
        )?;
        unique_ids(
            m.tax_base_components.iter().map(|v| v.id.as_str()),
            "input.tax_base_components.id",
        )?;
        unique_ids(
            m.benefit_items.iter().map(|v| v.id.as_str()),
            "input.benefit_items.id",
        )?;
        for c in &m.tax_base_components {
            text_bound(&c.label, "component.label", 256, true)?;
            for (field, value) in [
                ("source_type", &c.source_type),
                ("source_field", &c.source_field),
                ("period", &c.period),
                ("jurisdiction", &c.jurisdiction),
                ("evidence_status", &c.evidence_status),
            ] {
                text_bound(value, field, 128, false)?;
            }
            if let Some(node) = &c.source_node_id {
                id(node, "component.source_node_id")?;
            }
            text_bound(&c.note, "component.note", 4000, false)?;
            amount_bound(c.signed_amount, "component.signed_amount")?;
        }
        for b in &m.benefit_items {
            text_bound(&b.label, "benefit.label", 256, true)?;
            optional_text(&b.note, "benefit.note", 4000)?;
            if b.source_node_ids.len() > MAX_ITEMS {
                return Err(policy("benefit.source_node_ids", "too many references"));
            }
            unique_ids(
                b.source_node_ids.iter().map(String::as_str),
                "benefit.source_node_ids",
            )?;
            amount_bound(b.amount, "benefit.amount")?;
        }
        encoded_limit(self)
    }
}
/// Bounds encoded input before allocating DTO collections. Duplicate/unknown
/// fields and numeric money values are rejected by the strict DTO deserializer.
pub fn decode_request(encoded: &str) -> Result<TaxRequest, BoundaryError> {
    if encoded.len() > MAX_REQUEST_BYTES {
        return Err(policy("request", "encoded request exceeds 256 KiB"));
    }
    let request: TaxRequest =
        serde_json::from_str(encoded).map_err(|e| BoundaryError::InvalidPayload {
            message: e.to_string(),
        })?;
    request.validate()?;
    Ok(request)
}
/// Stateless pure adapter; never reads or mutates gameplay sessions or storage.
pub fn calculate(request: TaxRequest) -> Result<TaxSuccess, BoundaryError> {
    request.validate()?;
    let core: crate::TaxEconomicsV2 = request.input.into();
    let result = crate::calculate_tax_economics_v2(&core)
        .map_err(|e| BoundaryError::Calculation { detail: e.into() })?;
    Ok(TaxSuccess {
        transport_protocol: TRANSPORT_PROTOCOL.into(),
        result_schema: RESULT_SCHEMA.into(),
        calculation_version: CALCULATION_VERSION.into(),
        application_policy: APPLICATION_POLICY.into(),
        context: request.context,
        result: result.into(),
    })
}
