//! Authoring diagnostics for deterministic legal scenarios.
//!
//! This crate complements the structural, reference, lifecycle, reachability,
//! and terminal validators already present in the workspace. Commit 11C adds
//! diagnostics that require semantic interpretation of typed scenario time,
//! outcome production, and post-judgment lifecycle intent.
//!
//! Design lessons encoded here:
//!
//! - formatted UI dates never control simulation;
//! - deadlines cannot activate after they are due;
//! - deadline-miss events must reference the deadline they close;
//! - asynchronous work cannot have zero duration or expire before its usable
//!   boundary;
//! - terminal stages require produced outcomes;
//! - one transition cannot resolve several competing outcomes;
//! - post-judgment is not terminal merely because first instance was lost;
//! - fixed-time appeal and cassation events cannot precede the judgments on
//!   which they depend.

mod condition_analysis;
mod diagnostic;
mod outcome;
mod temporal;

pub use diagnostic::{
    AuthoringDiagnostic, AuthoringDiagnosticCode, AuthoringSeverity, AuthoringValidationReport,
};
use juris_scenario_schema::ScenarioDefinition;

/// Runs Commit 11C temporal and outcome diagnostics.
///
/// Core scenario validation should still run as the earlier gate. These
/// diagnostics intentionally avoid duplicating structural reference checks.
#[must_use]
pub fn validate_authoring_semantics(scenario: &ScenarioDefinition) -> AuthoringValidationReport {
    let mut report = AuthoringValidationReport::default();
    temporal::validate_temporal_coherence(scenario, &mut report);
    outcome::validate_outcome_semantics(scenario, &mut report);
    report
}
