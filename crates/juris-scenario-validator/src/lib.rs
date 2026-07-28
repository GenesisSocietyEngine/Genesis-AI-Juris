//! Validation pipeline for declarative AI Juris scenarios.
//!
//! Generated or manually authored scenarios must pass this validator before
//! the authoritative simulation engine may compile them.

#![forbid(unsafe_code)]

mod diagnostic;
mod index;
mod lifecycle;
mod references;
mod structural;

pub use diagnostic::{Diagnostic, DiagnosticCode, Severity, ValidationReport};

use index::ScenarioIndex;
use juris_scenario_schema::ScenarioDefinition;
use lifecycle::validate_lifecycle;
use references::validate_references;
use structural::validate_structural;

/// Validates structural integrity and all ScenarioDefinition v1 references.
///
/// Diagnostics are sorted by stable code and logical source path so repeated
/// validation of identical content produces deterministic output.
pub fn validate_scenario(scenario: &ScenarioDefinition) -> ValidationReport {
    let index = ScenarioIndex::new(scenario);
    let mut report = ValidationReport::default();

    validate_structural(scenario, &index, &mut report);
    validate_references(scenario, &index, &mut report);
    validate_lifecycle(scenario, &mut report);

    report.diagnostics.sort_by(|left, right| {
        left.code
            .as_str()
            .cmp(right.code.as_str())
            .then_with(|| left.path.cmp(&right.path))
    });

    report
}
