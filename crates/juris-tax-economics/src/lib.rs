//! # Juris Tax Economics v2
//!
//! CODEX: Tax Economics v2 and Actionable Graph Diagnostics
//!
//! This crate implements a complete upgrade to the tax economics system, replacing
//! property-specific coupling with case-dependent derivation, explicit benefits modeling,
//! and actionable graph integrity diagnostics.
//!
//! ## Key Components
//!
//! ### Part A: Taxable-Base Derivation Framework
//! - Case-dependent annual taxable base derived from case facts
//! - Generic additive bridge formula supporting all tax case types
//! - Case-type strategies (rental property, IP/operating-model, financing, acquisition)
//! - Controlled manual override with documented reason
//!
//! ### Part B: Explicit Benefits Model
//! - TaxBenefitItem with 8 benefit types
//! - Item-level realization and probability support
//! - Prevents double-counting with tax savings
//! - Recurring and one-off benefit timing
//!
//! ### Part C: Tax Economics V2 Schema
//! - Versioned model with v1 migration support
//! - Null-based incomplete derivation (not false zeros)
//! - Complete calculation chain with transparent intermediate values
//!
//! ### Part D: Actionable Graph Integrity Diagnostics
//! - Structured diagnostic output with actionable suggestions
//! - Distinguishes orphan nodes from disconnected components
//! - Directed reachability analysis from Triggers
//! - Repair direction hints
//!
//! ## FFI Module
//! The `ffi` module exposes all core functionality as C-callable interfaces for Flutter/Dart integration.

pub mod ffi;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Part A & C: Tax base component with signed amount and source tracking
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TaxBaseComponent {
    pub id: String,
    pub label: String,
    pub category: TaxBaseComponentCategory,
    pub signed_amount: i64, // in cents to avoid floating point
    pub source_type: String,
    pub source_node_id: Option<String>,
    pub source_field: String,
    pub period: String,
    pub jurisdiction: String,
    pub evidence_status: String,
    pub include_in_calculation: bool,
    pub note: String,
}

/// Part A & C: Component categories per CODEX
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum TaxBaseComponentCategory {
    TaxableIncome,
    DeductibleExpense,
    NonDeductibleAddback,
    ExemptIncome,
    TaxLossUtilized,
    TaxableAdjustment,
    DeductibleAdjustment,
}

impl TaxBaseComponentCategory {
    pub fn sign_multiplier(&self) -> i32 {
        match self {
            Self::TaxableIncome => 1,
            Self::DeductibleExpense => -1,
            Self::NonDeductibleAddback => 1,
            Self::ExemptIncome => -1,
            Self::TaxLossUtilized => -1,
            Self::TaxableAdjustment => 1,
            Self::DeductibleAdjustment => -1,
        }
    }
}

/// Part B: Benefit line item with timing and realization control
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TaxBenefitItem {
    pub id: String,
    pub label: String,
    pub benefit_type: BenefitType,
    pub timing: BenefitTiming,
    pub amount: i64, // in cents
    pub start_month: u32,
    pub end_month: Option<u32>,
    pub realization_bps: Option<u16>, // basis points (0-10000)
    pub probability_bps: Option<u16>, // basis points (0-10000)
    pub source_node_ids: Vec<String>,
    pub note: Option<String>,
    pub include_in_base_case: bool,
}

/// Part B: Benefit types per CODEX
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum BenefitType {
    ComplianceSaving,
    OperatingCostSaving,
    AdviserCostSaving,
    WorkingCapital,
    RevenueUplift,
    AvoidedControversyCost,
    OneOffBenefit,
    Other,
}

/// Part B: Benefit timing
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BenefitTiming {
    RecurringAnnual,
    OneOff,
}

/// Part A & C: Tax base derivation mode
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaxBaseMode {
    Derived,
    ManualOverride,
}

/// Part C: Tax Economics v2 - Complete versioned model
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TaxEconomicsV2 {
    pub kind: String,            // "tax-economics-v2"
    pub currency: String,        // ISO 4217
    pub tax_input_basis: String, // "rates" | "amounts"

    // Part A: Tax Base Derivation
    pub tax_base_mode: TaxBaseMode,
    pub tax_base_formula_id: String,
    pub tax_base_formula_version: String,
    pub tax_base_components: Vec<TaxBaseComponent>,
    pub derived_annual_tax_base: Option<i64>, // None = incomplete, not false zero
    pub missing_tax_base_inputs: Vec<String>,
    pub annual_tax_base_override: Option<i64>,
    pub override_reason: Option<String>,
    pub override_owner: Option<String>,
    pub override_as_of: Option<String>,

    // Part C: Tax Amounts & Costs
    pub baseline_tax_rate_bps: u16,
    pub optimized_tax_rate_bps: u16,
    pub baseline_annual_tax_cost: i64,
    pub optimized_annual_tax_cost: i64,
    pub implementation_cost: i64,
    pub annual_maintenance_cost: i64,
    pub terminal_tax_or_unwind_cost: i64,
    pub analysis_horizon_months: u32,
    pub annual_discount_rate_bps: u16,
    pub benefit_realization_bps: u16,

    // Part B: Explicit Benefits
    pub benefit_items: Vec<TaxBenefitItem>,

    // Documentation
    pub assumptions: String,
}

impl TaxEconomicsV2 {
    /// Create a new default v2 model for generic tax advisory
    pub fn new_default(currency: String) -> Self {
        Self {
            kind: "tax-economics-v2".to_string(),
            currency,
            tax_input_basis: "amounts".to_string(),
            tax_base_mode: TaxBaseMode::Derived,
            tax_base_formula_id: "generic-tax-advisory".to_string(),
            tax_base_formula_version: "1.0".to_string(),
            tax_base_components: Vec::new(),
            derived_annual_tax_base: None,
            missing_tax_base_inputs: vec!["No components defined".to_string()],
            annual_tax_base_override: None,
            override_reason: None,
            override_owner: None,
            override_as_of: None,
            baseline_tax_rate_bps: 0,
            optimized_tax_rate_bps: 0,
            baseline_annual_tax_cost: 0,
            optimized_annual_tax_cost: 0,
            implementation_cost: 0,
            annual_maintenance_cost: 0,
            terminal_tax_or_unwind_cost: 0,
            analysis_horizon_months: 120,
            annual_discount_rate_bps: 800,  // 8% default
            benefit_realization_bps: 10000, // 100% default
            benefit_items: Vec::new(),
            assumptions: String::new(),
        }
    }
}

/// Part D: Structured graph integrity diagnostic
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IntegrityDiagnostic {
    pub code: String,
    pub severity: DiagnosticSeverity,
    pub summary: String,
    pub node_ids: Vec<String>,
    pub link_ids: Vec<String>,
    pub trigger_ids: Option<Vec<String>>,
    pub suggested_action: Option<String>,
}

/// Part D: Diagnostic severity level
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticSeverity {
    Warning,
    Error,
}

/// Part A: Tax-base derivation strategy definition
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TaxBaseDerivationStrategy {
    pub id: String,
    pub version: String,
    pub label: String,
    pub description: String,
    pub required_source_types: Vec<String>,
    pub required_fields: Vec<DerivationField>,
    pub component_definitions: Vec<ComponentDefinition>,
    pub formula_description: String,
}

/// Part A: Field definition for strategy
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DerivationField {
    pub id: String,
    pub label: String,
    pub description: String,
    pub field_type: String, // "amount" | "percentage" | "node_reference"
    pub required: bool,
    pub default_value: Option<String>,
}

/// Part A: Component definition for strategy
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ComponentDefinition {
    pub component_id: String,
    pub category: TaxBaseComponentCategory,
    pub label: String,
    pub source_field: String,
    pub sign: i32, // 1 or -1
}

/// Part A: Tax-base calculation result with bridge
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TaxBaseCalculationResult {
    pub total_taxable_income: i64,
    pub total_deductible_expense: i64,
    pub total_non_deductible_addback: i64,
    pub total_exempt_income: i64,
    pub total_tax_loss_utilized: i64,
    pub total_taxable_adjustment: i64,
    pub total_deductible_adjustment: i64,
    pub calculated_tax_base: i64,
}

/// Part B: Recognized benefits calculation result
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecognizedBenefitsResult {
    pub recurring_annual: i64,
    pub one_off: i64,
    pub total_annual: i64,
}

// ============================================================================
// PART A: TAX BASE CALCULATION ENGINE
// ============================================================================

/// All public numeric helpers return typed errors; intermediate sums use i128.
fn overflow(field: &str) -> TaxEconomicsError {
    TaxEconomicsError::ArithmeticOverflow {
        field: field.to_string(),
    }
}
fn amount(value: i128, field: &str) -> Result<i64, TaxEconomicsError> {
    i64::try_from(value).map_err(|_| overflow(field))
}
fn add(a: i128, b: i128, field: &str) -> Result<i128, TaxEconomicsError> {
    a.checked_add(b).ok_or_else(|| overflow(field))
}
fn mul(a: i128, b: i128, field: &str) -> Result<i128, TaxEconomicsError> {
    a.checked_mul(b).ok_or_else(|| overflow(field))
}
fn invalid(field: &str, reason: &str) -> TaxEconomicsError {
    TaxEconomicsError::InvalidInput {
        field: field.to_string(),
        reason: reason.to_string(),
    }
}
fn fraction(value: u16, field: &str) -> Result<(), TaxEconomicsError> {
    if value > 10_000 {
        return Err(invalid(field, "must be between 0 and 10000 basis points"));
    }
    Ok(())
}

/// Category totals and the signed bridge must all fit the published i64 schema.
pub fn calculate_tax_base_from_components(
    components: &[TaxBaseComponent],
) -> Result<TaxBaseCalculationResult, TaxEconomicsError> {
    let mut totals = [0i128; 7];
    for component in components.iter().filter(|c| c.include_in_calculation) {
        let index = match component.category {
            TaxBaseComponentCategory::TaxableIncome => 0,
            TaxBaseComponentCategory::DeductibleExpense => 1,
            TaxBaseComponentCategory::NonDeductibleAddback => 2,
            TaxBaseComponentCategory::ExemptIncome => 3,
            TaxBaseComponentCategory::TaxLossUtilized => 4,
            TaxBaseComponentCategory::TaxableAdjustment => 5,
            TaxBaseComponentCategory::DeductibleAdjustment => 6,
        };
        totals[index] = add(
            totals[index],
            i128::from(component.signed_amount),
            "tax_base_components",
        )?;
    }
    let mut base = 0i128;
    for (value, sign) in totals.iter().zip([1, -1, 1, -1, -1, 1, -1]) {
        base = add(
            base,
            mul(*value, sign, "calculated_tax_base")?,
            "calculated_tax_base",
        )?;
    }
    Ok(TaxBaseCalculationResult {
        total_taxable_income: amount(totals[0], "total_taxable_income")?,
        total_deductible_expense: amount(totals[1], "total_deductible_expense")?,
        total_non_deductible_addback: amount(totals[2], "total_non_deductible_addback")?,
        total_exempt_income: amount(totals[3], "total_exempt_income")?,
        total_tax_loss_utilized: amount(totals[4], "total_tax_loss_utilized")?,
        total_taxable_adjustment: amount(totals[5], "total_taxable_adjustment")?,
        total_deductible_adjustment: amount(totals[6], "total_deductible_adjustment")?,
        calculated_tax_base: amount(base, "calculated_tax_base")?,
    })
}

/// Recompute derived inputs; a persisted cache never overrides source components.
pub fn effective_annual_tax_base(model: &TaxEconomicsV2) -> Result<Option<i64>, TaxEconomicsError> {
    match model.tax_base_mode {
        TaxBaseMode::ManualOverride => Ok(model.annual_tax_base_override),
        TaxBaseMode::Derived => {
            if !model.missing_tax_base_inputs.is_empty()
                || !model
                    .tax_base_components
                    .iter()
                    .any(|c| c.include_in_calculation)
            {
                return Ok(None);
            }
            Ok(Some(
                calculate_tax_base_from_components(&model.tax_base_components)?.calculated_tax_base,
            ))
        }
    }
}

/// Fractions truncate toward zero once after the complete item product.
fn recognized_item(item: &TaxBenefitItem, global: u16) -> Result<i64, TaxEconomicsError> {
    let realization = item.realization_bps.unwrap_or(global);
    let probability = item.probability_bps.unwrap_or(10_000);
    fraction(realization, "benefit_items.realization_bps")?;
    fraction(probability, "benefit_items.probability_bps")?;
    let product = mul(
        i128::from(item.amount),
        i128::from(realization),
        "benefit_items.amount",
    )?;
    amount(
        mul(product, i128::from(probability), "benefit_items.amount")? / 100_000_000,
        "benefit_items.amount",
    )
}

/// Nominal run-rate totals; dated inclusion is applied by the lifecycle calculation.
pub fn calculate_recognized_benefits(
    items: &[TaxBenefitItem],
    global_realization_bps: u16,
) -> Result<RecognizedBenefitsResult, TaxEconomicsError> {
    fraction(global_realization_bps, "benefit_realization_bps")?;
    let mut recurring = 0i128;
    let mut one_off = 0i128;
    for item in items.iter().filter(|i| i.include_in_base_case) {
        let net = i128::from(recognized_item(item, global_realization_bps)?);
        match item.timing {
            BenefitTiming::RecurringAnnual => recurring = add(recurring, net, "recurring_annual")?,
            BenefitTiming::OneOff => one_off = add(one_off, net, "one_off")?,
        }
    }
    Ok(RecognizedBenefitsResult {
        recurring_annual: amount(recurring, "recurring_annual")?,
        one_off: amount(one_off, "one_off")?,
        total_annual: amount(add(recurring, one_off, "total_annual")?, "total_annual")?,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum TaxEconomicsError {
    MissingTaxBase { missing_inputs: Vec<String> },
    UnknownTaxInputBasis { value: String },
    ArithmeticOverflow { field: String },
    NumericPrecision { field: String },
    InvalidInput { field: String, reason: String },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RoiUnavailableReason {
    NonPositiveLifecycleCost,
    OutOfRange,
}

/// Annual fields remain run rates. Lifecycle and NPV apply the dated schedule.
/// Legacy result JSON missing required tax-cost fields must be recomputed from its model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxEconomicsCalculationResult {
    pub effective_annual_tax_base: Option<i64>,
    pub baseline_annual_tax_cost: i64,
    pub optimized_annual_tax_cost: i64,
    pub recognized_annual_tax_saving: i64,
    pub recognized_recurring_benefits: i64,
    pub recognized_one_off_benefits: i64,
    pub gross_recognized_annual_benefit: i64,
    pub operating_annual_benefit: i64,
    pub annualized_net_benefit: i64,
    pub lifecycle_net_benefit: i64,
    pub lifecycle_roi_bps: Option<i32>,
    pub lifecycle_roi_unavailable_reason: Option<RoiUnavailableReason>,
    pub npv: i64,
    /// Simple undiscounted run-rate estimate; not a dated cash-flow break-even promise.
    pub payback_months: Option<u32>,
}

fn resolve_annual_tax_costs(
    model: &TaxEconomicsV2,
    base: Option<i64>,
) -> Result<(i64, i64), TaxEconomicsError> {
    match model.tax_input_basis.as_str() {
        "amounts" => Ok((
            model.baseline_annual_tax_cost,
            model.optimized_annual_tax_cost,
        )),
        "rates" => {
            let base = base.ok_or_else(|| TaxEconomicsError::MissingTaxBase {
                missing_inputs: if model.missing_tax_base_inputs.is_empty() {
                    vec!["annual_tax_base".to_string()]
                } else {
                    model.missing_tax_base_inputs.clone()
                },
            })?;
            let taxable = i128::from(base.max(0));
            Ok((
                amount(
                    mul(
                        taxable,
                        i128::from(model.baseline_tax_rate_bps),
                        "baseline_annual_tax_cost",
                    )? / 10_000,
                    "baseline_annual_tax_cost",
                )?,
                amount(
                    mul(
                        taxable,
                        i128::from(model.optimized_tax_rate_bps),
                        "optimized_annual_tax_cost",
                    )? / 10_000,
                    "optimized_annual_tax_cost",
                )?,
            ))
        }
        other => Err(TaxEconomicsError::UnknownTaxInputBasis {
            value: other.to_string(),
        }),
    }
}

/// Stable geometric sum of end-of-month discount factors, O(1) for any u32 horizon.
fn discounted_months(start: u32, end: u32, log_monthly: f64) -> f64 {
    let count = f64::from(end - start + 1);
    (-f64::from(start) * log_monthly).exp() * (-count * log_monthly).exp_m1()
        / (-log_monthly).exp_m1()
}

/// A sorted sweep aggregates ALL overlapping monthly cash flows before discounting.
/// Coefficients are twelfths of a cent, so annual accrual never rounds per month.
fn cash_event(
    events: &mut std::collections::BTreeMap<u64, i128>,
    at: u64,
    value: i128,
) -> Result<(), TaxEconomicsError> {
    let existing = events.get(&at).copied().unwrap_or(0);
    events.insert(at, add(existing, value, "npv_cashflows")?);
    Ok(())
}
fn cash_interval(
    events: &mut std::collections::BTreeMap<u64, i128>,
    start: u32,
    end: u32,
    annual: i128,
) -> Result<(), TaxEconomicsError> {
    cash_event(events, u64::from(start), annual)?;
    cash_event(events, u64::from(end) + 1, -annual)
}

fn scheduled_npv(
    events: &std::collections::BTreeMap<u64, i128>,
    implementation: i64,
    log_monthly: f64,
) -> Result<i64, TaxEconomicsError> {
    let mut previous = 1u64;
    let mut annual = 0i128;
    let mut sum = 0.0f64;
    let mut compensation = 0.0f64;
    let mut absolute_flow = 0.0f64;
    for (&at, &delta) in events {
        if at > previous && annual != 0 {
            let start = u32::try_from(previous).map_err(|_| overflow("npv_cashflows"))?;
            let end = u32::try_from(at - 1).map_err(|_| overflow("npv_cashflows"))?;
            let present = annual as f64 / 12.0 * discounted_months(start, end, log_monthly);
            absolute_flow += present.abs();
            // Reserve >8 precision guard bits beyond whole cents for transcendental
            // discount factors and accumulation. Reject extremes rather than invent cents.
            if !present.is_finite() || absolute_flow >= 17_592_186_044_416.0 {
                return Err(TaxEconomicsError::NumericPrecision {
                    field: "npv".to_string(),
                });
            }
            // Neumaier summation, after exact deterministic schedule aggregation.
            let next = sum + present;
            compensation += if sum.abs() >= present.abs() {
                (sum - next) + present
            } else {
                (present - next) + sum
            };
            sum = next;
        }
        annual = add(annual, delta, "npv_cashflows")?;
        previous = at;
    }
    let discounted = sum + compensation;
    if !discounted.is_finite() {
        return Err(overflow("npv"));
    }
    // The discounted portion is precision-bounded; keep the time-zero i64 exact.
    let integer = discounted.trunc() as i128;
    let fraction = discounted.fract();
    let mut combined = integer - i128::from(implementation);
    // Truncation toward zero applies to the final total, not separately to signs.
    if combined > 0 && fraction < 0.0 {
        combined -= 1;
    }
    if combined < 0 && fraction > 0.0 {
        combined += 1;
    }
    amount(combined, "npv")
}

pub fn calculate_tax_economics_v2(
    model: &TaxEconomicsV2,
) -> Result<TaxEconomicsCalculationResult, TaxEconomicsError> {
    let horizon = model.analysis_horizon_months;
    if horizon == 0 {
        return Err(invalid("analysis_horizon_months", "must be positive"));
    }
    fraction(model.benefit_realization_bps, "benefit_realization_bps")?;
    let effective_base = effective_annual_tax_base(model)?;
    let (baseline, optimized) = resolve_annual_tax_costs(model, effective_base)?;
    let raw = i128::from(baseline) - i128::from(optimized);
    let tax = amount(
        if raw > 0 {
            mul(
                raw,
                i128::from(model.benefit_realization_bps),
                "recognized_annual_tax_saving",
            )? / 10_000
        } else {
            raw
        },
        "recognized_annual_tax_saving",
    )?;
    let benefits =
        calculate_recognized_benefits(&model.benefit_items, model.benefit_realization_bps)?;
    let gross = amount(
        i128::from(tax) + i128::from(benefits.recurring_annual),
        "gross_recognized_annual_benefit",
    )?;
    let operating = amount(
        i128::from(gross) - i128::from(model.annual_maintenance_cost),
        "operating_annual_benefit",
    )?;
    let annualized = amount(
        i128::from(operating) - i128::from(model.implementation_cost) * 12 / i128::from(horizon),
        "annualized_net_benefit",
    )?;

    // Keep undiscounted cash flows in twelfths of a cent until the final division.
    let base_annual = i128::from(tax) - i128::from(model.annual_maintenance_cost);
    let mut lifecycle_twelfths = mul(base_annual, i128::from(horizon), "lifecycle_net_benefit")?;
    let log_monthly = (f64::from(model.annual_discount_rate_bps) / 10_000.0).ln_1p() / 12.0;
    let mut events = std::collections::BTreeMap::new();
    cash_interval(&mut events, 1, horizon, base_annual)?;
    for item in model
        .benefit_items
        .iter()
        .filter(|i| i.include_in_base_case)
    {
        if item.start_month == 0 || item.end_month.is_some_and(|end| end < item.start_month) {
            return Err(invalid(
                "benefit_items.timing",
                "start_month must be positive and end_month must be at least start_month",
            ));
        }
        if item.start_month > horizon {
            continue;
        }
        let net = recognized_item(item, model.benefit_realization_bps)?;
        let end = item.end_month.unwrap_or(horizon).min(horizon);
        let contribution = match item.timing {
            BenefitTiming::RecurringAnnual => {
                cash_interval(&mut events, item.start_month, end, i128::from(net))?;
                mul(
                    i128::from(net),
                    i128::from(end - item.start_month + 1),
                    "lifecycle_net_benefit",
                )?
            }
            BenefitTiming::OneOff => {
                cash_interval(
                    &mut events,
                    item.start_month,
                    item.start_month,
                    i128::from(net) * 12,
                )?;
                i128::from(net) * 12
            }
        };
        lifecycle_twelfths = add(lifecycle_twelfths, contribution, "lifecycle_net_benefit")?;
    }
    lifecycle_twelfths = add(
        lifecycle_twelfths,
        -i128::from(model.implementation_cost) * 12
            - i128::from(model.terminal_tax_or_unwind_cost) * 12,
        "lifecycle_net_benefit",
    )?;
    let lifecycle = amount(lifecycle_twelfths / 12, "lifecycle_net_benefit")?;
    cash_interval(
        &mut events,
        horizon,
        horizon,
        -i128::from(model.terminal_tax_or_unwind_cost) * 12,
    )?;
    let npv = if log_monthly == 0.0 {
        lifecycle
    } else {
        scheduled_npv(&events, model.implementation_cost, log_monthly)?
    };
    let cost_twelfths = (i128::from(model.implementation_cost)
        + i128::from(model.terminal_tax_or_unwind_cost))
        * 12
        + i128::from(model.annual_maintenance_cost) * i128::from(horizon);
    let (roi, roi_reason) = if cost_twelfths <= 0 {
        (None, Some(RoiUnavailableReason::NonPositiveLifecycleCost))
    } else {
        match i32::try_from(mul(lifecycle_twelfths, 10_000, "lifecycle_roi_bps")? / cost_twelfths) {
            Ok(value) => (Some(value), None),
            Err(_) => (None, Some(RoiUnavailableReason::OutOfRange)),
        }
    };
    let payback = if operating > 0 && model.implementation_cost >= 0 {
        Some(
            u32::try_from(i128::from(model.implementation_cost) * 12 / i128::from(operating))
                .map_err(|_| overflow("payback_months"))?,
        )
    } else {
        None
    };
    Ok(TaxEconomicsCalculationResult {
        effective_annual_tax_base: effective_base,
        baseline_annual_tax_cost: baseline,
        optimized_annual_tax_cost: optimized,
        recognized_annual_tax_saving: tax,
        recognized_recurring_benefits: benefits.recurring_annual,
        recognized_one_off_benefits: benefits.one_off,
        gross_recognized_annual_benefit: gross,
        operating_annual_benefit: operating,
        annualized_net_benefit: annualized,
        lifecycle_net_benefit: lifecycle,
        lifecycle_roi_bps: roi,
        lifecycle_roi_unavailable_reason: roi_reason,
        npv,
        payback_months: payback,
    })
}

// ============================================================================
// PART D: GRAPH INTEGRITY DIAGNOSTICS
// ============================================================================

/// Simple graph node for diagnostics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub node_type: String, // "trigger", "decision", "outcome", etc.
    pub title: String,
}

/// Simple graph link
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphLink {
    pub id: String,
    pub from: String,
    pub to: String,
}

/// Analyze complete graph integrity
pub fn analyze_graph_integrity(
    nodes: &[GraphNode],
    links: &[GraphLink],
) -> Vec<IntegrityDiagnostic> {
    let mut diagnostics = Vec::new();

    // 1. Detect orphan nodes (zero degree)
    diagnostics.extend(detect_orphan_nodes(nodes, links));

    // 2. Validate relationships exist
    let validation_result = validate_relationships(links, nodes);
    diagnostics.extend(validation_result.invalid_links);

    // 3. Detect disconnected components
    let valid_links = &validation_result.valid_links;
    diagnostics.extend(detect_disconnected_graph(valid_links, nodes));

    diagnostics
}

/// Detect orphan nodes (no incoming or outgoing links)
fn detect_orphan_nodes(nodes: &[GraphNode], links: &[GraphLink]) -> Vec<IntegrityDiagnostic> {
    let mut orphans = Vec::new();

    for node in nodes {
        let has_link = links.iter().any(|l| l.from == node.id || l.to == node.id);
        if !has_link && node.node_type != "trigger" {
            orphans.push(node.id.clone());
        }
    }

    if !orphans.is_empty() {
        vec![IntegrityDiagnostic {
            code: "orphan_node".to_string(),
            severity: DiagnosticSeverity::Warning,
            summary: format!(
                "{} nodes have no incoming or outgoing relationships",
                orphans.len()
            ),
            node_ids: orphans,
            link_ids: Vec::new(),
            trigger_ids: None,
            suggested_action: Some(
                "Connect these nodes to other nodes or delete them if they are not needed"
                    .to_string(),
            ),
        }]
    } else {
        Vec::new()
    }
}

/// Validation result for relationships
struct ValidationResult {
    valid_links: Vec<GraphLink>,
    invalid_links: Vec<IntegrityDiagnostic>,
}

/// Validate that all relationship endpoints exist
fn validate_relationships(links: &[GraphLink], nodes: &[GraphNode]) -> ValidationResult {
    let node_ids: std::collections::HashSet<_> = nodes.iter().map(|n| &n.id).collect();
    let mut valid_links = Vec::new();
    let mut invalid_link_ids = Vec::new();

    for link in links {
        if !node_ids.contains(&link.from) || !node_ids.contains(&link.to) {
            invalid_link_ids.push(link.id.clone());
        } else {
            valid_links.push(link.clone());
        }
    }

    let invalid_links = if !invalid_link_ids.is_empty() {
        vec![IntegrityDiagnostic {
            code: "invalid_relationship".to_string(),
            severity: DiagnosticSeverity::Error,
            summary: format!(
                "{} relationship(s) reference non-existent node(s)",
                invalid_link_ids.len()
            ),
            node_ids: Vec::new(),
            link_ids: invalid_link_ids,
            trigger_ids: None,
            suggested_action: Some("Delete or repair these relationships".to_string()),
        }]
    } else {
        Vec::new()
    };

    ValidationResult {
        valid_links,
        invalid_links,
    }
}

/// Detect disconnected graph components (unreachable from Trigger)
fn detect_disconnected_graph(links: &[GraphLink], nodes: &[GraphNode]) -> Vec<IntegrityDiagnostic> {
    // Build adjacency list
    let mut adjacency: HashMap<String, Vec<String>> = HashMap::new();
    for node in nodes {
        adjacency.insert(node.id.clone(), Vec::new());
    }
    for link in links {
        adjacency
            .entry(link.from.clone())
            .or_default()
            .push(link.to.clone());
    }

    // Find all triggers
    let trigger_ids: Vec<_> = nodes
        .iter()
        .filter(|n| n.node_type == "trigger")
        .map(|n| n.id.clone())
        .collect();

    if trigger_ids.is_empty() {
        return vec![IntegrityDiagnostic {
            code: "disconnected_graph".to_string(),
            severity: DiagnosticSeverity::Error,
            summary: "No Trigger node exists; the case cannot be played".to_string(),
            node_ids: Vec::new(),
            link_ids: Vec::new(),
            trigger_ids: None,
            suggested_action: Some("Add a Trigger node to start the case".to_string()),
        }];
    }

    // BFS from each trigger to find reachable nodes
    let mut reachable = std::collections::HashSet::new();
    for trigger_id in &trigger_ids {
        bfs_reachable(trigger_id, &adjacency, &mut reachable);
    }

    // Find unreachable nodes
    let unreachable: Vec<_> = nodes
        .iter()
        .filter(|n| !reachable.contains(&n.id))
        .map(|n| n.id.clone())
        .collect();

    if !unreachable.is_empty() {
        vec![IntegrityDiagnostic {
            code: "disconnected_graph".to_string(),
            severity: DiagnosticSeverity::Warning,
            summary: format!(
                "{} node(s) are not reachable from a Trigger via forward relationships",
                unreachable.len()
            ),
            node_ids: unreachable,
            link_ids: Vec::new(),
            trigger_ids: Some(trigger_ids),
            suggested_action: Some(
                "Create a forward relationship from a Trigger or connected node to reach these nodes"
                    .to_string(),
            ),
        }]
    } else {
        Vec::new()
    }
}

/// BFS to find all nodes reachable from start
fn bfs_reachable(
    start: &str,
    adjacency: &HashMap<String, Vec<String>>,
    reachable: &mut std::collections::HashSet<String>,
) {
    let mut queue = vec![start.to_string()];
    reachable.insert(start.to_string());

    while let Some(current) = queue.pop() {
        if let Some(neighbors) = adjacency.get(&current) {
            for neighbor in neighbors {
                if !reachable.contains(neighbor) {
                    reachable.insert(neighbor.clone());
                    queue.push(neighbor.clone());
                }
            }
        }
    }
}

/// Check if graph is healthy for playability
pub fn is_graph_healthy(nodes: &[GraphNode], links: &[GraphLink]) -> bool {
    let diagnostics = analyze_graph_integrity(nodes, links);
    !diagnostics
        .iter()
        .any(|d| d.severity == DiagnosticSeverity::Error)
}

// ============================================================================
// V1 MIGRATION SUPPORT
// ============================================================================

/// Simplified v1 model for migration testing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxEconomicsV1 {
    pub kind: String, // "tax-economics-v1"
    pub currency: String,
    pub gross_annual_rent: Option<i64>,
    pub rental_property_expenses: Option<i64>,
    pub annual_loan_interest: Option<i64>,
    pub derived_annual_tax_base: Option<i64>,
    pub baseline_tax_rate_bps: u16,
    pub optimized_tax_rate_bps: u16,
    pub baseline_annual_tax_cost: i64,
    pub optimized_annual_tax_cost: i64,
    pub implementation_cost: i64,
    pub annual_maintenance_cost: i64,
    pub terminal_tax_or_unwind_cost: i64,
    pub analysis_horizon_months: u32,
    pub annual_discount_rate_bps: u16,
    pub benefit_realization_bps: u16,
    pub assumptions: String,
}

/// Migrate v1 model to v2 with property-specific logic
pub fn migrate_v1_to_v2(v1: &TaxEconomicsV1) -> Result<TaxEconomicsV2, TaxEconomicsError> {
    let mut v2 = TaxEconomicsV2 {
        kind: "tax-economics-v2".to_string(),
        currency: v1.currency.clone(),
        tax_input_basis: "amounts".to_string(),
        tax_base_mode: TaxBaseMode::Derived,
        tax_base_formula_id: "rental-property-legacy".to_string(),
        tax_base_formula_version: "1.0".to_string(),
        tax_base_components: Vec::new(),
        derived_annual_tax_base: None,
        missing_tax_base_inputs: Vec::new(),
        annual_tax_base_override: None,
        override_reason: None,
        override_owner: None,
        override_as_of: None,
        baseline_tax_rate_bps: v1.baseline_tax_rate_bps,
        optimized_tax_rate_bps: v1.optimized_tax_rate_bps,
        baseline_annual_tax_cost: v1.baseline_annual_tax_cost,
        optimized_annual_tax_cost: v1.optimized_annual_tax_cost,
        implementation_cost: v1.implementation_cost,
        annual_maintenance_cost: v1.annual_maintenance_cost,
        terminal_tax_or_unwind_cost: v1.terminal_tax_or_unwind_cost,
        analysis_horizon_months: v1.analysis_horizon_months,
        annual_discount_rate_bps: v1.annual_discount_rate_bps,
        benefit_realization_bps: v1.benefit_realization_bps,
        benefit_items: Vec::new(),
        assumptions: v1.assumptions.clone(),
    };

    // Check if v1 has complete property inputs
    let has_complete_property_inputs = v1.gross_annual_rent.is_some()
        && v1.rental_property_expenses.is_some()
        && v1.annual_loan_interest.is_some();

    if has_complete_property_inputs {
        // Migrate as derived components using rental-property formula
        v2.tax_base_components = vec![
            TaxBaseComponent {
                id: "v1_gross_rent".to_string(),
                label: "Gross Annual Rent (from v1)".to_string(),
                category: TaxBaseComponentCategory::TaxableIncome,
                signed_amount: v1.gross_annual_rent.unwrap_or(0),
                source_type: "migrated_v1".to_string(),
                source_node_id: None,
                source_field: "gross_annual_rent".to_string(),
                period: "2026".to_string(),
                jurisdiction: "US".to_string(),
                evidence_status: "migrated".to_string(),
                include_in_calculation: true,
                note: "Migrated from tax-economics-v1".to_string(),
            },
            TaxBaseComponent {
                id: "v1_expenses".to_string(),
                label: "Rental Property Expenses (from v1)".to_string(),
                category: TaxBaseComponentCategory::DeductibleExpense,
                signed_amount: v1.rental_property_expenses.unwrap_or(0),
                source_type: "migrated_v1".to_string(),
                source_node_id: None,
                source_field: "rental_property_expenses".to_string(),
                period: "2026".to_string(),
                jurisdiction: "US".to_string(),
                evidence_status: "migrated".to_string(),
                include_in_calculation: true,
                note: "Migrated from tax-economics-v1".to_string(),
            },
            TaxBaseComponent {
                id: "v1_interest".to_string(),
                label: "Annual Loan Interest (from v1)".to_string(),
                category: TaxBaseComponentCategory::DeductibleExpense,
                signed_amount: v1.annual_loan_interest.unwrap_or(0),
                source_type: "migrated_v1".to_string(),
                source_node_id: None,
                source_field: "annual_loan_interest".to_string(),
                period: "2026".to_string(),
                jurisdiction: "US".to_string(),
                evidence_status: "migrated".to_string(),
                include_in_calculation: true,
                note: "Migrated from tax-economics-v1".to_string(),
            },
        ];

        // Calculate derived base
        let calc_result = calculate_tax_base_from_components(&v2.tax_base_components)?;
        v2.derived_annual_tax_base = Some(calc_result.calculated_tax_base);
    } else if let Some(base) = v1.derived_annual_tax_base {
        if base != 0 {
            // Non-zero base without complete inputs: migrate as manual override
            v2.tax_base_mode = TaxBaseMode::ManualOverride;
            v2.annual_tax_base_override = Some(base);
            v2.override_reason =
                Some("Migrated from tax-economics-v1 (property inputs incomplete)".to_string());
            v2.override_owner = Some("migration".to_string());
            v2.override_as_of = Some("2026-09-01".to_string());
            v2.missing_tax_base_inputs = vec![
                "gross_annual_rent".to_string(),
                "rental_property_expenses".to_string(),
                "annual_loan_interest".to_string(),
            ];
        } else {
            // Zero base with incomplete inputs: migrate as null + missing inputs list
            v2.derived_annual_tax_base = None;
            v2.missing_tax_base_inputs = vec![
                "gross_annual_rent".to_string(),
                "rental_property_expenses".to_string(),
                "annual_loan_interest".to_string(),
            ];
        }
    } else {
        // No base at all: mark as incomplete
        v2.derived_annual_tax_base = None;
        v2.missing_tax_base_inputs =
            vec!["No property inputs or tax base defined in v1".to_string()];
    }

    Ok(v2)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tax_base_calculation_bridge() {
        let components = vec![
            TaxBaseComponent {
                id: "1".to_string(),
                label: "Operating Profit".to_string(),
                category: TaxBaseComponentCategory::TaxableIncome,
                signed_amount: 1_000_000,
                source_type: "case_fact".to_string(),
                source_node_id: Some("n1".to_string()),
                source_field: "operating_profit".to_string(),
                period: "2026".to_string(),
                jurisdiction: "US".to_string(),
                evidence_status: "estimated".to_string(),
                include_in_calculation: true,
                note: "Base operating profit".to_string(),
            },
            TaxBaseComponent {
                id: "2".to_string(),
                label: "Deductible Interest".to_string(),
                category: TaxBaseComponentCategory::DeductibleExpense,
                signed_amount: 100_000,
                source_type: "case_fact".to_string(),
                source_node_id: Some("n2".to_string()),
                source_field: "interest_paid".to_string(),
                period: "2026".to_string(),
                jurisdiction: "US".to_string(),
                evidence_status: "estimated".to_string(),
                include_in_calculation: true,
                note: "Annual interest expense".to_string(),
            },
        ];

        let result = calculate_tax_base_from_components(&components).unwrap();
        assert_eq!(result.calculated_tax_base, 900_000);
    }

    #[test]
    fn test_benefit_calculation_with_realization() {
        let items = vec![TaxBenefitItem {
            id: "b1".to_string(),
            label: "Operating Cost Saving".to_string(),
            benefit_type: BenefitType::OperatingCostSaving,
            timing: BenefitTiming::RecurringAnnual,
            amount: 100_000,
            start_month: 1,
            end_month: None,
            realization_bps: Some(8000), // 80%
            probability_bps: None,
            source_node_ids: vec!["n3".to_string()],
            note: Some("Cost reduction".to_string()),
            include_in_base_case: true,
        }];

        let result = calculate_recognized_benefits(&items, 10000).unwrap();
        assert_eq!(result.recurring_annual, 80_000);
    }

    #[test]
    fn test_orphan_detection() {
        let nodes = vec![
            GraphNode {
                id: "t1".to_string(),
                node_type: "trigger".to_string(),
                title: "Start".to_string(),
            },
            GraphNode {
                id: "d1".to_string(),
                node_type: "decision".to_string(),
                title: "Choose Path".to_string(),
            },
            GraphNode {
                id: "orphan".to_string(),
                node_type: "outcome".to_string(),
                title: "Disconnected".to_string(),
            },
        ];

        let links = vec![GraphLink {
            id: "l1".to_string(),
            from: "t1".to_string(),
            to: "d1".to_string(),
        }];

        let diagnostics = analyze_graph_integrity(&nodes, &links);
        let orphan_diagnostic = diagnostics
            .iter()
            .find(|d| d.code == "orphan_node")
            .unwrap();
        assert_eq!(orphan_diagnostic.node_ids, vec!["orphan"]);
    }

    #[test]
    fn test_disconnected_component() {
        let nodes = vec![
            GraphNode {
                id: "t1".to_string(),
                node_type: "trigger".to_string(),
                title: "Start".to_string(),
            },
            GraphNode {
                id: "d1".to_string(),
                node_type: "decision".to_string(),
                title: "Choice".to_string(),
            },
            GraphNode {
                id: "isolated".to_string(),
                node_type: "decision".to_string(),
                title: "Isolated".to_string(),
            },
            GraphNode {
                id: "connected_to_isolated".to_string(),
                node_type: "outcome".to_string(),
                title: "Unreachable".to_string(),
            },
        ];

        let links = vec![
            GraphLink {
                id: "l1".to_string(),
                from: "t1".to_string(),
                to: "d1".to_string(),
            },
            GraphLink {
                id: "l2".to_string(),
                from: "isolated".to_string(),
                to: "connected_to_isolated".to_string(),
            },
        ];

        let diagnostics = analyze_graph_integrity(&nodes, &links);
        let disconnected_diagnostic = diagnostics
            .iter()
            .find(|d| d.code == "disconnected_graph")
            .unwrap();
        assert!(disconnected_diagnostic
            .node_ids
            .contains(&"isolated".to_string()));
        assert!(disconnected_diagnostic
            .node_ids
            .contains(&"connected_to_isolated".to_string()));
    }

    #[test]
    fn test_v2_model_creation() {
        let model = TaxEconomicsV2::new_default("USD".to_string());
        assert_eq!(model.kind, "tax-economics-v2");
        assert_eq!(model.currency, "USD");
        assert_eq!(model.tax_base_mode, TaxBaseMode::Derived);
        assert_eq!(model.derived_annual_tax_base, None);
        assert!(!model.missing_tax_base_inputs.is_empty());
    }

    #[test]
    fn test_migration_complete_property_inputs() {
        // F1.1: Rental-property case reproduces valid v1 result after migration
        let v1 = TaxEconomicsV1 {
            kind: "tax-economics-v1".to_string(),
            currency: "USD".to_string(),
            gross_annual_rent: Some(100_000),
            rental_property_expenses: Some(20_000),
            annual_loan_interest: Some(15_000),
            derived_annual_tax_base: Some(65_000),
            baseline_tax_rate_bps: 2100,
            optimized_tax_rate_bps: 1500,
            baseline_annual_tax_cost: 13_650,
            optimized_annual_tax_cost: 9_750,
            implementation_cost: 50_000,
            annual_maintenance_cost: 2_000,
            terminal_tax_or_unwind_cost: 5_000,
            analysis_horizon_months: 120,
            annual_discount_rate_bps: 800,
            benefit_realization_bps: 10000,
            assumptions: "Standard rental property analysis".to_string(),
        };

        let v2 = migrate_v1_to_v2(&v1).unwrap();
        assert_eq!(v2.kind, "tax-economics-v2");
        assert_eq!(v2.currency, "USD");
        assert_eq!(v2.tax_base_mode, TaxBaseMode::Derived);
        assert_eq!(v2.derived_annual_tax_base, Some(65_000));
        assert_eq!(v2.tax_base_components.len(), 3);
        assert_eq!(v2.baseline_annual_tax_cost, 13_650);
        assert_eq!(v2.optimized_annual_tax_cost, 9_750);
    }

    #[test]
    fn test_migration_nonzero_base_incomplete_inputs() {
        // F1.2: Aurora/IP case (non-zero base without property inputs → manual override)
        let v1 = TaxEconomicsV1 {
            kind: "tax-economics-v1".to_string(),
            currency: "USD".to_string(),
            gross_annual_rent: None,
            rental_property_expenses: None,
            annual_loan_interest: None,
            derived_annual_tax_base: Some(500_000), // Non-zero but no property inputs
            baseline_tax_rate_bps: 2100,
            optimized_tax_rate_bps: 1500,
            baseline_annual_tax_cost: 105_000,
            optimized_annual_tax_cost: 75_000,
            implementation_cost: 100_000,
            annual_maintenance_cost: 5_000,
            terminal_tax_or_unwind_cost: 10_000,
            analysis_horizon_months: 120,
            annual_discount_rate_bps: 800,
            benefit_realization_bps: 10000,
            assumptions: "IP operating model".to_string(),
        };

        let v2 = migrate_v1_to_v2(&v1).unwrap();
        assert_eq!(v2.tax_base_mode, TaxBaseMode::ManualOverride);
        assert_eq!(v2.annual_tax_base_override, Some(500_000));
        assert!(v2
            .override_reason
            .as_ref()
            .unwrap()
            .contains("Migrated from tax-economics-v1"));
        assert_eq!(v2.missing_tax_base_inputs.len(), 3);
    }

    #[test]
    fn test_migration_zero_base_incomplete_inputs() {
        // F1.3: Incomplete required inputs produce null + complete missing-input list
        let v1 = TaxEconomicsV1 {
            kind: "tax-economics-v1".to_string(),
            currency: "USD".to_string(),
            gross_annual_rent: None,
            rental_property_expenses: None,
            annual_loan_interest: None,
            derived_annual_tax_base: Some(0), // Zero base
            baseline_tax_rate_bps: 0,
            optimized_tax_rate_bps: 0,
            baseline_annual_tax_cost: 0,
            optimized_annual_tax_cost: 0,
            implementation_cost: 0,
            annual_maintenance_cost: 0,
            terminal_tax_or_unwind_cost: 0,
            analysis_horizon_months: 120,
            annual_discount_rate_bps: 800,
            benefit_realization_bps: 10000,
            assumptions: String::new(),
        };

        let v2 = migrate_v1_to_v2(&v1).unwrap();
        assert_eq!(v2.tax_base_mode, TaxBaseMode::Derived);
        assert_eq!(v2.derived_annual_tax_base, None); // Not false zero
        assert!(!v2.missing_tax_base_inputs.is_empty());
    }

    #[test]
    fn test_manual_override_persistence() {
        // F1.4: Manual override survives recalculation, save, export and re-import
        let mut model = TaxEconomicsV2::new_default("USD".to_string());
        model.tax_base_mode = TaxBaseMode::ManualOverride;
        model.annual_tax_base_override = Some(1_000_000);
        model.override_reason = Some("Aurora case IP restructuring".to_string());
        model.override_owner = Some("tax_analyst".to_string());
        model.override_as_of = Some("2026-09-01".to_string());

        // Recalculate (should not erase override)
        let _result = calculate_tax_economics_v2(&model).unwrap();

        // Override still exists
        assert_eq!(effective_annual_tax_base(&model).unwrap(), Some(1_000_000));
        assert!(model.override_reason.is_some());

        // Serialize and deserialize (JSON round-trip simulation)
        let json_str = serde_json::to_string(&model).unwrap();
        let restored: TaxEconomicsV2 = serde_json::from_str(&json_str).unwrap();

        // Override persists
        assert_eq!(restored.annual_tax_base_override, Some(1_000_000));
        assert_eq!(
            restored.override_reason,
            Some("Aurora case IP restructuring".to_string())
        );
    }

    #[test]
    fn test_benefit_double_counting_prevention() {
        // F2.1: Additional recurring benefit increases annual benefit exactly once
        let mut model = TaxEconomicsV2::new_default("USD".to_string());
        model.baseline_annual_tax_cost = 100_000;
        model.optimized_annual_tax_cost = 70_000;
        model.benefit_items = vec![TaxBenefitItem {
            id: "b1".to_string(),
            label: "Compliance Saving".to_string(),
            benefit_type: BenefitType::ComplianceSaving,
            timing: BenefitTiming::RecurringAnnual,
            amount: 15_000,
            start_month: 1,
            end_month: None,
            realization_bps: Some(9000),
            probability_bps: None,
            source_node_ids: vec![],
            note: None,
            include_in_base_case: true,
        }];

        let result = calculate_tax_economics_v2(&model).unwrap();
        let tax_saving = 30_000; // (100k - 70k) × 100%
        let recurring_benefits = 13_500; // 15k × 90%
        assert_eq!(result.recognized_annual_tax_saving, tax_saving);
        assert_eq!(result.recognized_recurring_benefits, recurring_benefits);
        assert_eq!(
            result.gross_recognized_annual_benefit,
            tax_saving + recurring_benefits
        );
        // No double-counting: tax saving + recurring = exactly 43,500
    }

    #[test]
    fn test_negative_tax_effect_preservation() {
        // F2.6: Negative tax saving remains negative
        let mut model = TaxEconomicsV2::new_default("USD".to_string());
        model.baseline_annual_tax_cost = 50_000;
        model.optimized_annual_tax_cost = 80_000; // Optimized > baseline (negative effect)
        model.benefit_items = vec![];

        model.benefit_realization_bps = 5000;

        let result = calculate_tax_economics_v2(&model).unwrap();
        // 50k - 80k = -30k, carried in full: realization does not soften a loss
        assert_eq!(result.recognized_annual_tax_saving, -30_000);
        assert_eq!(result.operating_annual_benefit, -30_000);
        assert_eq!(result.payback_months, None);
    }

    fn component(
        id: &str,
        category: TaxBaseComponentCategory,
        signed_amount: i64,
    ) -> TaxBaseComponent {
        TaxBaseComponent {
            id: id.to_string(),
            label: id.to_string(),
            category,
            signed_amount,
            source_type: "case_fact".to_string(),
            source_node_id: None,
            source_field: id.to_string(),
            period: "2026".to_string(),
            jurisdiction: "BE".to_string(),
            evidence_status: "estimated".to_string(),
            include_in_calculation: true,
            note: String::new(),
        }
    }

    fn rates_model() -> TaxEconomicsV2 {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.tax_input_basis = "rates".to_string();
        model.missing_tax_base_inputs = Vec::new();
        model.tax_base_components = vec![
            component("income", TaxBaseComponentCategory::TaxableIncome, 1_000_000),
            component(
                "expense",
                TaxBaseComponentCategory::DeductibleExpense,
                200_000,
            ),
        ];
        model.baseline_tax_rate_bps = 2500;
        model.optimized_tax_rate_bps = 2000;
        model
    }

    #[test]
    fn test_rates_basis_uses_derived_base() {
        let mut model = rates_model();
        // Entered amounts and a stale cache must not override the derivation
        model.baseline_annual_tax_cost = 999;
        model.optimized_annual_tax_cost = 1;
        model.derived_annual_tax_base = Some(42);

        let result = calculate_tax_economics_v2(&model).unwrap();
        assert_eq!(result.effective_annual_tax_base, Some(800_000));
        assert_eq!(result.baseline_annual_tax_cost, 200_000); // 800k × 25%
        assert_eq!(result.optimized_annual_tax_cost, 160_000); // 800k × 20%
        assert_eq!(result.recognized_annual_tax_saving, 40_000);
    }

    #[test]
    fn test_rates_basis_uses_manual_override() {
        let mut model = rates_model();
        model.tax_base_mode = TaxBaseMode::ManualOverride;
        model.annual_tax_base_override = Some(400_000);

        let result = calculate_tax_economics_v2(&model).unwrap();
        assert_eq!(result.baseline_annual_tax_cost, 100_000);
        assert_eq!(result.optimized_annual_tax_cost, 80_000);
    }

    #[test]
    fn test_rates_basis_incomplete_base_is_error_not_zero() {
        let mut model = rates_model();
        model.missing_tax_base_inputs = vec!["operating_profit".to_string()];

        assert_eq!(
            calculate_tax_economics_v2(&model).unwrap_err(),
            TaxEconomicsError::MissingTaxBase {
                missing_inputs: vec!["operating_profit".to_string()]
            }
        );

        model.missing_tax_base_inputs = Vec::new();
        model.tax_base_components.clear();
        assert!(matches!(
            calculate_tax_economics_v2(&model),
            Err(TaxEconomicsError::MissingTaxBase { .. })
        ));
    }

    #[test]
    fn test_unknown_input_basis_rejected() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.tax_input_basis = "guess".to_string();
        assert_eq!(
            calculate_tax_economics_v2(&model).unwrap_err(),
            TaxEconomicsError::UnknownTaxInputBasis {
                value: "guess".to_string()
            }
        );
    }

    #[test]
    fn test_implementation_annualized_over_years_and_maintenance_once() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.baseline_annual_tax_cost = 100_000;
        model.optimized_annual_tax_cost = 70_000;
        model.implementation_cost = 50_000;
        model.annual_maintenance_cost = 5_000;
        model.terminal_tax_or_unwind_cost = 10_000;
        model.analysis_horizon_months = 120;
        model.benefit_items = vec![TaxBenefitItem {
            id: "one_off".to_string(),
            label: "Refund".to_string(),
            benefit_type: BenefitType::OneOffBenefit,
            timing: BenefitTiming::OneOff,
            amount: 7_000,
            start_month: 1,
            end_month: None,
            realization_bps: None,
            probability_bps: None,
            source_node_ids: vec![],
            note: None,
            include_in_base_case: true,
        }];

        let result = calculate_tax_economics_v2(&model).unwrap();
        assert_eq!(result.operating_annual_benefit, 25_000); // 30k - 5k
        assert_eq!(result.annualized_net_benefit, 20_000); // 25k - 50k / 10 years
                                                           // 25k × 10 years + 7k - 50k - 10k; maintenance is not subtracted again
        assert_eq!(result.lifecycle_net_benefit, 197_000);
        assert_eq!(result.lifecycle_roi_bps, Some(17_909)); // 197k / (50k + 50k + 10k)
        assert_eq!(result.payback_months, Some(24));
    }

    #[test]
    fn test_negative_lifecycle_reports_negative_roi() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.baseline_annual_tax_cost = 10_000;
        model.optimized_annual_tax_cost = 9_000;
        model.implementation_cost = 50_000;
        model.analysis_horizon_months = 12;

        let result = calculate_tax_economics_v2(&model).unwrap();
        assert_eq!(result.lifecycle_net_benefit, -49_000);
        assert_eq!(result.lifecycle_roi_bps, Some(-9_800));
    }

    #[test]
    fn test_large_benefit_amount_does_not_overflow() {
        let items = vec![TaxBenefitItem {
            id: "big".to_string(),
            label: "Big".to_string(),
            benefit_type: BenefitType::RevenueUplift,
            timing: BenefitTiming::RecurringAnnual,
            amount: 1_000_000_000_000, // 10 bn in cents
            start_month: 1,
            end_month: None,
            realization_bps: Some(5000),
            probability_bps: Some(5000),
            source_node_ids: vec![],
            note: None,
            include_in_base_case: true,
        }];
        let result = calculate_recognized_benefits(&items, 10000).unwrap();
        assert_eq!(result.recurring_annual, 250_000_000_000);
    }

    #[test]
    fn test_orphan_vs_disconnected_distinction() {
        // F3.1 & F3.2: Orphan vs disconnected component distinction
        let nodes = vec![
            GraphNode {
                id: "t1".to_string(),
                node_type: "trigger".to_string(),
                title: "Trigger".to_string(),
            },
            GraphNode {
                id: "d1".to_string(),
                node_type: "decision".to_string(),
                title: "Decision".to_string(),
            },
            GraphNode {
                id: "component1".to_string(),
                node_type: "outcome".to_string(),
                title: "Component Node 1".to_string(),
            },
            GraphNode {
                id: "component2".to_string(),
                node_type: "outcome".to_string(),
                title: "Component Node 2".to_string(),
            },
        ];

        let links = vec![
            GraphLink {
                id: "l1".to_string(),
                from: "t1".to_string(),
                to: "d1".to_string(),
            },
            GraphLink {
                id: "l2".to_string(),
                from: "component1".to_string(),
                to: "component2".to_string(),
            },
        ];

        let diagnostics = analyze_graph_integrity(&nodes, &links);

        // Should report disconnected_graph with component1 and component2
        let disconnected = diagnostics.iter().find(|d| d.code == "disconnected_graph");
        assert!(disconnected.is_some());
        assert!(disconnected
            .unwrap()
            .node_ids
            .contains(&"component1".to_string()));
        assert!(disconnected
            .unwrap()
            .node_ids
            .contains(&"component2".to_string()));

        // Should NOT report orphan_node (component1 has an outgoing link)
        let orphan = diagnostics.iter().find(|d| d.code == "orphan_node");
        assert!(orphan.is_none());
    }
}
