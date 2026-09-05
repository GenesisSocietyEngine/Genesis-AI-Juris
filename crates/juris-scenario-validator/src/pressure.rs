//! Validation for the composed pressure-window contract.

use crate::{Diagnostic, DiagnosticCode, ScenarioIndex, ValidationReport};
use juris_scenario_schema::ScenarioDefinition;
use std::collections::HashSet;

pub(crate) fn validate_pressure_windows(
    scenario: &ScenarioDefinition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
) {
    for (window_index, window) in scenario.pressure_windows.iter().enumerate() {
        let path = format!("pressure_windows[{window_index}]");
        require_reference(
            index.has_actor(window.source_actor_id.as_str()),
            DiagnosticCode::UnknownActorReference,
            format!("{path}.source_actor_id"),
            "actor",
            window.source_actor_id.as_str(),
            report,
        );
        require_reference(
            index.has_event(window.activation_event_id.as_str()),
            DiagnosticCode::UnknownEventReference,
            format!("{path}.activation_event_id"),
            "event",
            window.activation_event_id.as_str(),
            report,
        );
        require_reference(
            index.has_deadline(window.response_deadline_id.as_str()),
            DiagnosticCode::UnknownDeadlineReference,
            format!("{path}.response_deadline_id"),
            "deadline",
            window.response_deadline_id.as_str(),
            report,
        );
        require_reference(
            index.has_event(window.countermove_event_id.as_str()),
            DiagnosticCode::UnknownEventReference,
            format!("{path}.countermove_event_id"),
            "event",
            window.countermove_event_id.as_str(),
            report,
        );

        if window.response_action_ids.is_empty() {
            invalid(
                format!("{path}.response_action_ids"),
                "a pressure window requires at least one ordered response action",
                report,
            );
        }
        let mut response_ids = HashSet::new();
        for (action_index, action_id) in window.response_action_ids.iter().enumerate() {
            require_reference(
                index.has_action(action_id.as_str()),
                DiagnosticCode::UnknownActionReference,
                format!("{path}.response_action_ids[{action_index}]"),
                "action",
                action_id.as_str(),
                report,
            );
            if !response_ids.insert(action_id.as_str()) {
                invalid(
                    format!("{path}.response_action_ids[{action_index}]"),
                    format!("duplicate response action `{action_id}`"),
                    report,
                );
            }
        }

        if window.activation_event_id == window.countermove_event_id {
            invalid(
                format!("{path}.countermove_event_id"),
                "activation and countermove events must be distinct",
                report,
            );
        }

        let Some(deadline) = scenario
            .deadlines
            .iter()
            .find(|deadline| deadline.id == window.response_deadline_id)
        else {
            continue;
        };

        if deadline.activation_event.as_ref() != Some(&window.activation_event_id) {
            invalid(
                format!("{path}.activation_event_id"),
                format!(
                    "pressure activation must equal activation_event of deadline `{}`",
                    deadline.id
                ),
                report,
            );
        }
        if deadline.missed_event != window.countermove_event_id {
            invalid(
                format!("{path}.countermove_event_id"),
                format!(
                    "pressure countermove must equal missed_event of deadline `{}`",
                    deadline.id
                ),
                report,
            );
        }

        for (action_index, action_id) in window.response_action_ids.iter().enumerate() {
            let response_path = format!("{path}.response_action_ids[{action_index}]");
            if !deadline
                .completion_actions
                .iter()
                .any(|candidate| candidate == action_id)
            {
                invalid(
                    &response_path,
                    format!(
                        "response action `{action_id}` must be a completion action of deadline `{}`",
                        deadline.id
                    ),
                    report,
                );
            }

            let Some(action) = scenario
                .actions
                .iter()
                .find(|action| action.id == *action_id)
            else {
                continue;
            };
            let binds_deadline = action
                .completion_deadlines
                .iter()
                .chain(action.advance_to_deadlines.iter())
                .any(|candidate| candidate == &deadline.id);
            if !binds_deadline {
                invalid(
                    response_path,
                    format!(
                        "response action `{action_id}` must name deadline `{}` in completion_deadlines or advance_to_deadlines",
                        deadline.id
                    ),
                    report,
                );
            }
        }
    }
}

fn require_reference(
    exists: bool,
    code: DiagnosticCode,
    path: String,
    kind: &str,
    id: &str,
    report: &mut ValidationReport,
) {
    if !exists {
        report.push(Diagnostic::error(
            code,
            path,
            format!("unknown {kind} reference `{id}`"),
        ));
    }
}

fn invalid(path: impl Into<String>, message: impl Into<String>, report: &mut ValidationReport) {
    report.push(Diagnostic::error(
        DiagnosticCode::InvalidPressureWindowDefinition,
        path,
        message,
    ));
}
