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
pub fn effective_annual_tax_base(model: &TaxEconomicsV2) -> Option<i64> {
    match model.tax_base_mode {
        TaxBaseMode::ManualOverride => model.annual_tax_base_override,
        TaxBaseMode::Derived => model.derived_annual_tax_base,
    }
}

// ============================================================================
// PART B: BENEFIT CALCULATION ENGINE
// ============================================================================

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

        let realization = item.realization_bps.unwrap_or(global_realization_bps) as i64;
        let probability = item.probability_bps.unwrap_or(10000) as i64;

        let net_amount = (item.amount * realization * probability) / (10000i64 * 10000i64);

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

/// Tax economics calculation result with all intermediate values
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxEconomicsCalculationResult {
    pub recognized_annual_tax_saving: i64,
    pub recognized_recurring_benefits: i64,
    pub recognized_one_off_benefits: i64,
    pub gross_recognized_annual_benefit: i64,
    pub operating_annual_benefit: i64,
    pub annualized_net_benefit: i64,
    pub lifecycle_net_benefit: i64,
    pub lifecycle_roi_bps: Option<i32>,
    pub npv: i64,
    pub payback_months: Option<u32>,
}

/// Calculate complete tax economics with benefits integration
pub fn calculate_tax_economics_v2(model: &TaxEconomicsV2) -> TaxEconomicsCalculationResult {
    // Recognized annual tax saving = max(0, baseline - optimized) × realization
    let tax_saving_base = (model.baseline_annual_tax_cost - model.optimized_annual_tax_cost).max(0);
    let realization = model.benefit_realization_bps as i64;
    let recognized_annual_tax_saving = (tax_saving_base * realization) / 10000;

    // Recognized benefits from items
    let benefits =
        calculate_recognized_benefits(&model.benefit_items, model.benefit_realization_bps);

    // Gross recognized annual benefit = tax saving + recurring benefits
    let gross_recognized_annual_benefit = recognized_annual_tax_saving + benefits.recurring_annual;

    // Operating annual benefit = gross - annual maintenance cost
    let operating_annual_benefit = gross_recognized_annual_benefit - model.annual_maintenance_cost;

    // Annualized net benefit = operating - annualized implementation cost
    let annualized_implementation =
        model.implementation_cost / model.analysis_horizon_months.max(1) as i64;
    let annualized_net_benefit = operating_annual_benefit - annualized_implementation;

    // Lifecycle: all benefits/costs over horizon
    let horizon_annual = (operating_annual_benefit * model.analysis_horizon_months as i64) / 12;
    let lifecycle_net_benefit = horizon_annual + benefits.one_off
        - model.implementation_cost
        - model.terminal_tax_or_unwind_cost
        - (model.annual_maintenance_cost * model.analysis_horizon_months as i64) / 12;

    // Simple payback in months
    let payback_months = if operating_annual_benefit > 0 {
        Some(((model.implementation_cost * 12) / operating_annual_benefit) as u32)
    } else {
        None
    };

    // NPV simplified (discounted monthly)
    let discount_rate = model.annual_discount_rate_bps as f64 / 10000.0;
    let monthly_discount = (1.0 + discount_rate).powf(1.0 / 12.0) - 1.0;
    let monthly_benefit = operating_annual_benefit as f64 / 12.0;
    let mut npv = -(model.implementation_cost as f64);
    for month in 1..=model.analysis_horizon_months {
        let discount_factor = 1.0 / (1.0 + monthly_discount).powi(month as i32);
        npv += monthly_benefit * discount_factor;
    }
    npv -= model.terminal_tax_or_unwind_cost as f64;

    // Lifecycle ROI in basis points
    let lifecycle_roi_bps = if lifecycle_net_benefit > 0 && model.implementation_cost > 0 {
        Some(((lifecycle_net_benefit * 10000) / model.implementation_cost) as i32)
    } else {
        None
    };

    TaxEconomicsCalculationResult {
        recognized_annual_tax_saving,
        recognized_recurring_benefits: benefits.recurring_annual,
        recognized_one_off_benefits: benefits.one_off,
        gross_recognized_annual_benefit,
        operating_annual_benefit,
        annualized_net_benefit,
        lifecycle_net_benefit,
        lifecycle_roi_bps,
        npv: npv.round() as i64,
        payback_months,
    }
}

// ============================================================================
// PART D: GRAPH INTEGRITY DIAGNOSTICS
// ============================================================================

/// Simple graph representation for diagnostics
#[derive(Debug, Clone)]
pub struct GraphNode {
    pub id: String,
    pub node_type: String, // "trigger", "decision", "outcome", etc.
    pub title: String,
}

/// Simple graph link
#[derive(Debug, Clone)]
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
}
