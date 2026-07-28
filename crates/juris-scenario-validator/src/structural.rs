//! Structural validation independent of cross-reference traversal.

use crate::{Diagnostic, DiagnosticCode, ScenarioIndex, ValidationReport};
use juris_scenario_schema::{ScenarioDefinition, SCENARIO_SCHEMA_VERSION_V1};
use std::collections::HashSet;

pub(crate) fn validate_structural(
    scenario: &ScenarioDefinition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
) {
    validate_schema_version(scenario, report);
    validate_metadata_id(scenario, report);
    validate_initial_stage(scenario, index, report);
    validate_outcomes(scenario, report);

    validate_id_collection(
        "actors",
        scenario.actors.iter().map(|item| item.id.as_str()),
        report,
    );

    validate_id_collection(
        "facts",
        scenario.facts.iter().map(|item| item.id.as_str()),
        report,
    );

    validate_id_collection(
        "evidence",
        scenario.evidence.iter().map(|item| item.id.as_str()),
        report,
    );

    validate_id_collection(
        "stages",
        scenario.stages.iter().map(|item| item.id.as_str()),
        report,
    );

    validate_id_collection(
        "actions",
        scenario.actions.iter().map(|item| item.id.as_str()),
        report,
    );

    validate_id_collection(
        "deadlines",
        scenario.deadlines.iter().map(|item| item.id.as_str()),
        report,
    );

    validate_id_collection(
        "async_tasks",
        scenario.async_tasks.iter().map(|item| item.id.as_str()),
        report,
    );

    validate_id_collection(
        "inbox_items",
        scenario.inbox_items.iter().map(|item| item.id.as_str()),
        report,
    );

    validate_id_collection(
        "events",
        scenario.events.iter().map(|item| item.id.as_str()),
        report,
    );

    validate_id_collection(
        "outcomes",
        scenario.outcomes.iter().map(|item| item.id.as_str()),
        report,
    );
}

fn validate_schema_version(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    if scenario.schema_version != SCENARIO_SCHEMA_VERSION_V1 {
        report.push(Diagnostic::error(
            DiagnosticCode::UnsupportedSchemaVersion,
            "schema_version",
            format!(
                "unsupported schema version `{}`; expected `{}`",
                scenario.schema_version, SCENARIO_SCHEMA_VERSION_V1
            ),
        ));
    }
}

fn validate_metadata_id(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    if scenario.metadata.id.is_empty() {
        report.push(Diagnostic::error(
            DiagnosticCode::EmptyId,
            "metadata.id",
            "scenario metadata ID must not be empty",
        ));
    }
}

fn validate_initial_stage(
    scenario: &ScenarioDefinition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
) {
    if scenario.initial_stage.is_empty() {
        report.push(Diagnostic::error(
            DiagnosticCode::EmptyId,
            "initial_stage",
            "initial stage ID must not be empty",
        ));
    }

    if !index.has_stage(scenario.initial_stage.as_str()) {
        report.push(Diagnostic::error(
            DiagnosticCode::MissingInitialStage,
            "initial_stage",
            format!("initial stage `{}` does not exist", scenario.initial_stage),
        ));
    }
}

fn validate_outcomes(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    if scenario.outcomes.is_empty() {
        report.push(Diagnostic::error(
            DiagnosticCode::NoOutcomes,
            "outcomes",
            "a playable scenario must define at least one terminal outcome",
        ));
    }
}

fn validate_id_collection<'a>(
    collection: &str,
    ids: impl Iterator<Item = &'a str>,
    report: &mut ValidationReport,
) {
    let mut seen = HashSet::new();

    for (index, id) in ids.enumerate() {
        let path = format!("{collection}[{index}].id");

        if id.is_empty() {
            report.push(Diagnostic::error(
                DiagnosticCode::EmptyId,
                &path,
                format!("{collection} ID must not be empty"),
            ));
        }

        if !seen.insert(id.to_owned()) {
            report.push(Diagnostic::error(
                DiagnosticCode::DuplicateId,
                path,
                format!("duplicate {collection} ID `{id}`"),
            ));
        }
    }
}
