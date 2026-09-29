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

/// Calculate tax base from components using additive bridge formula
pub fn calculate_tax_base_from_components(
    components: &[TaxBaseComponent],
) -> TaxBaseCalculationResult {
    let mut result = TaxBaseCalculationResult {
        total_taxable_income: 0,
        total_deductible_expense: 0,
        total_non_deductible_addback: 0,
        total_exempt_income: 0,
        total_tax_loss_utilized: 0,
        total_taxable_adjustment: 0,
        total_deductible_adjustment: 0,
        calculated_tax_base: 0,
    };

    for component in components {
        if !component.include_in_calculation {
            continue;
        }

        match component.category {
            TaxBaseComponentCategory::TaxableIncome => {
                result.total_taxable_income += component.signed_amount;
            }
            TaxBaseComponentCategory::DeductibleExpense => {
                result.total_deductible_expense += component.signed_amount;
            }
            TaxBaseComponentCategory::NonDeductibleAddback => {
                result.total_non_deductible_addback += component.signed_amount;
            }
            TaxBaseComponentCategory::ExemptIncome => {
                result.total_exempt_income += component.signed_amount;
            }
            TaxBaseComponentCategory::TaxLossUtilized => {
                result.total_tax_loss_utilized += component.signed_amount;
            }
            TaxBaseComponentCategory::TaxableAdjustment => {
                result.total_taxable_adjustment += component.signed_amount;
            }
            TaxBaseComponentCategory::DeductibleAdjustment => {
                result.total_deductible_adjustment += component.signed_amount;
            }
        }
    }

    // Apply formula: taxable_income - deductible_expense + non_deductible_addback
    //               - exempt_income - tax_loss_utilized + taxable_adjustment - deductible_adjustment
    result.calculated_tax_base = result.total_taxable_income - result.total_deductible_expense
        + result.total_non_deductible_addback
        - result.total_exempt_income
        - result.total_tax_loss_utilized
        + result.total_taxable_adjustment
        - result.total_deductible_adjustment;

    result
}

/// Get effective annual tax base (override priority)
///
/// In derived mode the base is recomputed from the included components rather than
/// read from `derived_annual_tax_base`, which is only a persisted cache and may be
/// stale. Declared missing inputs or an empty component set yield `None`, never a
/// false zero.
pub fn effective_annual_tax_base(model: &TaxEconomicsV2) -> Option<i64> {
    match model.tax_base_mode {
        TaxBaseMode::ManualOverride => model.annual_tax_base_override,
        TaxBaseMode::Derived => {
            let has_included_component = model
                .tax_base_components
                .iter()
                .any(|c| c.include_in_calculation);
            if !model.missing_tax_base_inputs.is_empty() || !has_included_component {
                return None;
            }
            Some(calculate_tax_base_from_components(&model.tax_base_components).calculated_tax_base)
        }
    }
}

/// Apply a basis-point fraction without intermediate overflow (truncates toward zero)
fn apply_bps(amount: i64, bps: i64) -> i64 {
    ((amount as i128 * bps as i128) / 10_000) as i64
}

// ============================================================================
// PART B: BENEFIT CALCULATION ENGINE
// ============================================================================

fn recognized_benefit_amount(item: &TaxBenefitItem, global_realization_bps: u16) -> i64 {
    let realization = item.realization_bps.unwrap_or(global_realization_bps) as i128;
    let probability = item.probability_bps.unwrap_or(10000) as i128;
    ((item.amount as i128 * realization * probability) / (10_000i128 * 10_000i128)) as i64
}

/// Calculate recognized benefits from items with realization and probability
pub fn calculate_recognized_benefits(
    items: &[TaxBenefitItem],
    global_realization_bps: u16,
) -> RecognizedBenefitsResult {
    let mut recurring_annual = 0i64;
    let mut one_off = 0i64;

    for item in items {
        if !item.include_in_base_case {
            continue;
        }

        let net_amount = recognized_benefit_amount(item, global_realization_bps);

        match item.timing {
            BenefitTiming::RecurringAnnual => {
                recurring_annual += net_amount;
            }
            BenefitTiming::OneOff => {
                one_off += net_amount;
            }
        }
    }

    let total_annual = recurring_annual + one_off;

    RecognizedBenefitsResult {
        recurring_annual,
        one_off,
        total_annual,
    }
}

// ============================================================================
// PART C: TAX ECONOMICS CALCULATIONS
// ============================================================================

/// Reason a tax economics calculation cannot be completed
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum TaxEconomicsError {
    /// Rate basis requires an effective annual tax base, which is incomplete
    MissingTaxBase { missing_inputs: Vec<String> },
    /// `tax_input_basis` is neither "rates" nor "amounts"
    UnknownTaxInputBasis { value: String },
    /// A benefit ends before its first possible active month.
    InvalidBenefitWindow { id: String },
}

/// Tax economics calculation result with all intermediate values
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxEconomicsCalculationResult {
    pub effective_annual_tax_base: Option<i64>,
    pub baseline_annual_tax_cost: i64,
    pub optimized_annual_tax_cost: i64,
    pub recognized_annual_tax_saving: i64,
    /// Full-year steady-state recurring benefits, without applying benefit windows.
    pub recognized_recurring_benefits: i64,
    /// Unfiltered total of included one-off benefits, including dates beyond the horizon.
    pub recognized_one_off_benefits: i64,
    /// Full-year steady-state tax and recurring benefit, without applying windows.
    pub gross_recognized_annual_benefit: i64,
    /// Full-year steady-state benefit net of maintenance, without applying windows.
    pub operating_annual_benefit: i64,
    /// Steady-state annual benefit less annualized implementation, without windows.
    pub annualized_net_benefit: i64,
    /// Horizon total applying recurring windows and in-horizon one-off benefits.
    pub lifecycle_net_benefit: i64,
    pub lifecycle_cost: i64,
    pub lifecycle_roi_bps: Option<i32>,
    /// Discounted cash flows applying recurring windows and in-horizon one-offs.
    pub npv: i64,
    /// Whole-month payback using full-year steady-state benefit, without windows.
    pub payback_months: Option<u32>,
}

/// Resolve baseline and optimized annual tax cost for the model's input basis
///
/// "rates" applies both rates to the effective annual tax base (a negative base
/// yields zero tax); "amounts" uses the entered annual costs directly.
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
            let taxable = base.max(0);
            Ok((
                apply_bps(taxable, model.baseline_tax_rate_bps as i64),
                apply_bps(taxable, model.optimized_tax_rate_bps as i64),
            ))
        }
        other => Err(TaxEconomicsError::UnknownTaxInputBasis {
            value: other.to_string(),
        }),
    }
}

/// Calculate complete tax economics with benefits integration
///
/// Implementation cost occurs at t = 0; month m means the end of month m.
/// A one-off benefit occurs at its start month (month 0 is undiscounted) and
/// contributes to NPV and lifecycle totals only when it is within the horizon.
pub fn calculate_tax_economics_v2(
    model: &TaxEconomicsV2,
) -> Result<TaxEconomicsCalculationResult, TaxEconomicsError> {
    // Validate every item, including excluded items, before any calculation.
    for item in &model.benefit_items {
        if item
            .end_month
            .is_some_and(|end| end < item.start_month.max(1))
        {
            return Err(TaxEconomicsError::InvalidBenefitWindow {
                id: item.id.clone(),
            });
        }
    }

    let effective_base = effective_annual_tax_base(model);
    let (baseline_annual_tax_cost, optimized_annual_tax_cost) =
        resolve_annual_tax_costs(model, effective_base)?;

    // Positive savings are haircut by realization; a negative tax effect is carried
    // in full so a worse outcome is never softened.
    let raw_tax_saving = baseline_annual_tax_cost - optimized_annual_tax_cost;
    let recognized_annual_tax_saving = if raw_tax_saving > 0 {
        apply_bps(raw_tax_saving, model.benefit_realization_bps as i64)
    } else {
        raw_tax_saving
    };

    // Recognized benefits from items
    let benefits =
        calculate_recognized_benefits(&model.benefit_items, model.benefit_realization_bps);
    let one_offs: Vec<_> = model
        .benefit_items
        .iter()
        .filter(|item| {
            item.include_in_base_case
                && item.timing == BenefitTiming::OneOff
                && item.start_month <= model.analysis_horizon_months
        })
        .map(|item| {
            (
                item.start_month,
                recognized_benefit_amount(item, model.benefit_realization_bps),
            )
        })
        .collect();
    let in_horizon_one_off_benefits: i64 = one_offs.iter().map(|(_, amount)| amount).sum();
    let recurring: Vec<_> = model
        .benefit_items
        .iter()
        .filter(|item| item.include_in_base_case && item.timing == BenefitTiming::RecurringAnnual)
        .map(|item| {
            (
                item.start_month.max(1),
                item.end_month
                    .unwrap_or(model.analysis_horizon_months)
                    .min(model.analysis_horizon_months),
                recognized_benefit_amount(item, model.benefit_realization_bps),
            )
        })
        .collect();

    // Gross recognized annual benefit = tax saving + recurring benefits
    let gross_recognized_annual_benefit = recognized_annual_tax_saving + benefits.recurring_annual;

    // Operating annual benefit = gross - annual maintenance cost
    let operating_annual_benefit = gross_recognized_annual_benefit - model.annual_maintenance_cost;

    // Annualized net benefit = operating - implementation cost spread over horizon years
    let annualized_implementation =
        (model.implementation_cost * 12) / model.analysis_horizon_months.max(1) as i64;
    let annualized_net_benefit = operating_annual_benefit - annualized_implementation;

    // Combine every annual stream before the single month-to-year division.
    let base_annual_benefit =
        recognized_annual_tax_saving as i128 - model.annual_maintenance_cost as i128;
    let mut horizon_numerator = base_annual_benefit * model.analysis_horizon_months as i128;
    for &(start, end, amount) in &recurring {
        let active_months = if start <= end { end - start + 1 } else { 0 };
        horizon_numerator += amount as i128 * active_months as i128;
    }
    let lifecycle_net_benefit = (horizon_numerator / 12 + in_horizon_one_off_benefits as i128
        - model.implementation_cost as i128
        - model.terminal_tax_or_unwind_cost as i128) as i64;

    // Simple payback in months
    let payback_months = if operating_annual_benefit > 0 {
        u32::try_from((model.implementation_cost * 12) / operating_annual_benefit).ok()
    } else {
        None
    };

    // NPV simplified (discounted monthly)
    let discount_rate = model.annual_discount_rate_bps as f64 / 10000.0;
    let monthly_discount = (1.0 + discount_rate).powf(1.0 / 12.0) - 1.0;
    let monthly_benefit = base_annual_benefit as f64 / 12.0;
    let mut npv = -(model.implementation_cost as f64);
    for month in 1..=model.analysis_horizon_months {
        let discount_factor = 1.0 / (1.0 + monthly_discount).powi(month as i32);
        npv += monthly_benefit * discount_factor;
        for &(start, end, amount) in &recurring {
            if start <= month && month <= end {
                npv += amount as f64 / 12.0 * discount_factor;
            }
        }
    }
    for (month, amount) in one_offs {
        npv += amount as f64 / (1.0 + monthly_discount).powf(month as f64);
    }
    npv -= model.terminal_tax_or_unwind_cost as f64
        / (1.0 + monthly_discount).powf(model.analysis_horizon_months as f64);

    let lifecycle_cost = (model.implementation_cost as i128
        + model.annual_maintenance_cost as i128 * model.analysis_horizon_months as i128 / 12
        + model.terminal_tax_or_unwind_cost as i128) as i64;

    // Lifecycle ROI uses all lifecycle costs, including maintenance and terminal cost.
    let lifecycle_roi_bps = if lifecycle_cost > 0 {
        i32::try_from((lifecycle_net_benefit as i128 * 10_000) / lifecycle_cost as i128).ok()
    } else {
        None
    };

    Ok(TaxEconomicsCalculationResult {
        effective_annual_tax_base: effective_base,
        baseline_annual_tax_cost,
        optimized_annual_tax_cost,
        recognized_annual_tax_saving,
        recognized_recurring_benefits: benefits.recurring_annual,
        recognized_one_off_benefits: benefits.one_off,
        gross_recognized_annual_benefit,
        operating_annual_benefit,
        annualized_net_benefit,
        lifecycle_net_benefit,
        lifecycle_cost,
        lifecycle_roi_bps,
        npv: npv.round() as i64,
        payback_months,
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
pub fn migrate_v1_to_v2(v1: &TaxEconomicsV1) -> TaxEconomicsV2 {
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
        let calc_result = calculate_tax_base_from_components(&v2.tax_base_components);
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

    v2
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

        let result = calculate_tax_base_from_components(&components);
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

        let result = calculate_recognized_benefits(&items, 10000);
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

        let v2 = migrate_v1_to_v2(&v1);
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

        let v2 = migrate_v1_to_v2(&v1);
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

        let v2 = migrate_v1_to_v2(&v1);
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
        assert_eq!(effective_annual_tax_base(&model), Some(1_000_000));
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
        assert_eq!(result.lifecycle_cost, 110_000);
        assert_eq!(result.lifecycle_roi_bps, Some(17_909));
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
        assert_eq!(result.lifecycle_cost, 50_000);
        assert_eq!(result.lifecycle_roi_bps, Some(-9_800));
    }

    #[test]
    fn test_zero_lifecycle_cost_has_no_roi() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.baseline_annual_tax_cost = 10_000;

        let result = calculate_tax_economics_v2(&model).unwrap();
        assert_eq!(result.lifecycle_cost, 0);
        assert_eq!(result.lifecycle_roi_bps, None);
    }

    #[test]
    fn test_negative_lifecycle_cost_has_no_roi() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.implementation_cost = 100;
        model.annual_maintenance_cost = 10;
        model.analysis_horizon_months = 12;
        model.terminal_tax_or_unwind_cost = -111;

        let result = calculate_tax_economics_v2(&model).unwrap();
        assert_eq!(result.lifecycle_cost, -1);
        assert_eq!(result.lifecycle_roi_bps, None);
    }

    #[test]
    fn test_lifecycle_roi_outside_i32_is_none() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.implementation_cost = 1;
        model.baseline_annual_tax_cost = 300_001;
        model.analysis_horizon_months = 12;

        let result = calculate_tax_economics_v2(&model).unwrap();
        assert_eq!(result.lifecycle_cost, 1);
        assert_eq!(result.lifecycle_net_benefit, 300_000);
        assert_eq!(result.lifecycle_roi_bps, None);
    }

    fn benefit_item(
        timing: BenefitTiming,
        amount: i64,
        start_month: u32,
        end_month: Option<u32>,
    ) -> TaxBenefitItem {
        TaxBenefitItem {
            id: "benefit".to_string(),
            label: "Documented benefit".to_string(),
            benefit_type: BenefitType::Other,
            timing,
            amount,
            start_month,
            end_month,
            realization_bps: None,
            probability_bps: None,
            source_node_ids: vec![],
            note: None,
            include_in_base_case: true,
        }
    }

    #[test]
    fn test_npv_discounts_terminal_cost_at_horizon() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.analysis_horizon_months = 12;
        model.annual_discount_rate_bps = 1_000;
        model.terminal_tax_or_unwind_cost = 12_100;

        let result = calculate_tax_economics_v2(&model).unwrap();
        // One year at 10%: -12,100 / 1.1 = -11,000.
        assert!((result.npv as f64 - (-11_000.0)).abs() <= 1.0);
        assert_eq!(result.lifecycle_net_benefit, -12_100);
    }

    #[test]
    fn test_npv_one_off_benefits_at_month_zero_and_twelve() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.analysis_horizon_months = 12;
        model.annual_discount_rate_bps = 1_000;
        model.benefit_items = vec![
            benefit_item(BenefitTiming::OneOff, 48_400, 0, None),
            benefit_item(BenefitTiming::OneOff, 48_400, 12, None),
        ];
        for item in &mut model.benefit_items {
            item.realization_bps = Some(5_000);
            item.probability_bps = Some(5_000);
        }

        let result = calculate_tax_economics_v2(&model).unwrap();
        // Each recognizes 48,400 * 50% * 50% = 12,100;
        // NPV is 12,100 now + 12,100 / 1.1 at month 12 = 23,100.
        assert_eq!(result.recognized_one_off_benefits, 24_200);
        assert_eq!(result.lifecycle_net_benefit, 24_200);
        assert!((result.npv as f64 - 23_100.0).abs() <= 1.0);
    }

    #[test]
    fn test_one_off_beyond_horizon_is_excluded_from_npv_and_lifecycle() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.analysis_horizon_months = 12;
        model.benefit_items = vec![benefit_item(BenefitTiming::OneOff, 12_345, 13, None)];

        let result = calculate_tax_economics_v2(&model).unwrap();
        assert_eq!(result.recognized_one_off_benefits, 12_345);
        assert_eq!(result.lifecycle_net_benefit, 0);
        assert_eq!(result.npv, 0);
    }

    #[test]
    fn test_zero_discount_npv_is_plain_cash_flow_sum() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.analysis_horizon_months = 18;
        model.annual_discount_rate_bps = 0;
        model.baseline_annual_tax_cost = 100_000;
        model.optimized_annual_tax_cost = 70_000;
        model.implementation_cost = 10_000;
        model.annual_maintenance_cost = 5_000;
        model.terminal_tax_or_unwind_cost = 2_000;
        let mut excluded = benefit_item(BenefitTiming::OneOff, 99_999, 0, None);
        excluded.include_in_base_case = false;
        model.benefit_items = vec![
            benefit_item(BenefitTiming::OneOff, 1_000, 0, None),
            benefit_item(BenefitTiming::OneOff, 3_000, 12, None),
            excluded,
        ];

        let result = calculate_tax_economics_v2(&model).unwrap();
        // (30,000 - 5,000) * 18 / 12 + 1,000 + 3,000 - 10,000 - 2,000.
        assert_eq!(result.recognized_one_off_benefits, 4_000);
        assert_eq!(result.lifecycle_net_benefit, 29_500);
        assert_eq!(result.npv, 29_500);
    }

    #[test]
    fn test_full_recurring_window_preserves_3db5edc_lifecycle() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.annual_discount_rate_bps = 0;
        model.implementation_cost = 100;
        model.annual_maintenance_cost = 333;
        model.terminal_tax_or_unwind_cost = 7;

        for horizon in [0, 1, 2, 11, 12, 18, 19, 36, 120] {
            model.analysis_horizon_months = horizon;
            for tax_saving in [-1_000i64, 1_000] {
                model.baseline_annual_tax_cost = tax_saving.max(0);
                model.optimized_annual_tax_cost = (-tax_saving).max(0);
                for start in [0, 1] {
                    for end in [None, Some(horizon.max(1)), Some(horizon + 3)] {
                        model.benefit_items =
                            vec![benefit_item(BenefitTiming::RecurringAnnual, 5, start, end)];
                        let result = calculate_tax_economics_v2(&model).unwrap();
                        // 3db5edc's full-window formula, with all constants inlined.
                        let prior = ((tax_saving + 5 - 333) * horizon as i64) / 12 - 100 - 7;
                        assert_eq!(
                            result.lifecycle_net_benefit, prior,
                            "H={horizon}, tax={tax_saving}, start={start}, end={end:?}"
                        );
                        if horizon == 18 && tax_saving == 1_000 {
                            // (1,000 + 5 - 333) * 18 / 12 - 100 - 7 = 901.
                            // Truncating the base and recurring streams separately gives 900.
                            assert_eq!(result.lifecycle_net_benefit, 901);
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn test_recurring_window_inside_horizon_and_steady_state_fields() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.analysis_horizon_months = 18;
        model.annual_discount_rate_bps = 0;
        model.implementation_cost = 100;
        model.benefit_items = vec![benefit_item(
            BenefitTiming::RecurringAnnual,
            1_201,
            4,
            Some(9),
        )];

        let result = calculate_tax_economics_v2(&model).unwrap();
        // Six active months: 1,201 * 6 / 12 - 100 = 500 after truncation.
        assert_eq!(result.lifecycle_net_benefit, 500);
        // The unrounded total is 600.5 - 100. Binary f64 accumulation can
        // approach that half-cent from either side before the existing round().
        assert!((result.npv as f64 - 500.5).abs() <= 1.0);
        assert_eq!(result.recognized_recurring_benefits, 1_201);
        assert_eq!(result.gross_recognized_annual_benefit, 1_201);
        assert_eq!(result.operating_annual_benefit, 1_201);
        assert_eq!(result.annualized_net_benefit, 1_135);
        assert_eq!(result.payback_months, Some(0));
    }

    #[test]
    fn test_recurring_window_crossing_horizon() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.analysis_horizon_months = 18;
        model.annual_discount_rate_bps = 0;
        model.benefit_items = vec![benefit_item(
            BenefitTiming::RecurringAnnual,
            1_201,
            16,
            Some(30),
        )];

        let result = calculate_tax_economics_v2(&model).unwrap();
        assert_eq!(result.lifecycle_net_benefit, 300); // 1,201 * 3 / 12.
        assert_eq!(result.npv, 300);
    }

    #[test]
    fn test_recurring_open_ended_window_uses_month_end_discounting() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.analysis_horizon_months = 12;
        model.annual_discount_rate_bps = 1_000;
        model.benefit_items = vec![benefit_item(
            BenefitTiming::RecurringAnnual,
            145_200,
            12,
            None,
        )];

        let result = calculate_tax_economics_v2(&model).unwrap();
        assert_eq!(result.lifecycle_net_benefit, 12_100); // Only month 12 is active.
        assert!((result.npv as f64 - 11_000.0).abs() <= 1.0); // 145,200 / 12 / 1.1.
    }

    #[test]
    fn test_recurring_window_beyond_horizon_has_no_cash_flow() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        model.analysis_horizon_months = 18;
        model.benefit_items = vec![benefit_item(
            BenefitTiming::RecurringAnnual,
            1_201,
            19,
            None,
        )];

        let result = calculate_tax_economics_v2(&model).unwrap();
        assert_eq!(result.recognized_recurring_benefits, 1_201);
        assert_eq!(result.lifecycle_net_benefit, 0);
        assert_eq!(result.npv, 0);
    }

    #[test]
    fn test_invalid_benefit_window_precedes_arithmetic_even_when_excluded() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        // This subtraction would overflow if validation did not precede arithmetic.
        model.baseline_annual_tax_cost = i64::MAX;
        model.optimized_annual_tax_cost = -1;
        for timing in [BenefitTiming::RecurringAnnual, BenefitTiming::OneOff] {
            for included in [false, true] {
                let mut item = benefit_item(timing, 1_000, 5, Some(4));
                item.include_in_base_case = included;
                model.benefit_items = vec![item];
                assert_eq!(
                    calculate_tax_economics_v2(&model).unwrap_err(),
                    TaxEconomicsError::InvalidBenefitWindow {
                        id: "benefit".to_string()
                    }
                );
            }
        }
    }

    #[test]
    fn test_zero_end_month_is_invalid_for_every_benefit() {
        let mut model = TaxEconomicsV2::new_default("EUR".to_string());
        for timing in [BenefitTiming::RecurringAnnual, BenefitTiming::OneOff] {
            for included in [false, true] {
                let mut item = benefit_item(timing, 1_000, 0, Some(0));
                item.include_in_base_case = included;
                model.benefit_items = vec![item];
                let error = calculate_tax_economics_v2(&model).unwrap_err();
                assert_eq!(
                    serde_json::to_value(error).unwrap(),
                    serde_json::json!({"code": "invalid_benefit_window", "id": "benefit"})
                );
            }
        }
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
        let result = calculate_recognized_benefits(&items, 10000);
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
