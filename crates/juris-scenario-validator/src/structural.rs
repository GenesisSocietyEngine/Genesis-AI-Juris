//! Structural validation independent of cross-reference traversal.

use crate::{Diagnostic, DiagnosticCode, ScenarioIndex, ValidationReport};
use juris_scenario_schema::{
    Effect, EventTrigger, RelativeTimeDefinition, ScenarioDefinition, ScenarioTime, StageKind,
    SCENARIO_SCHEMA_VERSION_V1,
};
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
    validate_stage_lifecycle_contract(scenario, report);
    validate_extended_runtime_contract(scenario, report);

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

    validate_id_collection(
        "numeric_metrics",
        scenario.numeric_metrics.keys().map(|id| id.as_str()),
        report,
    );

    validate_id_collection(
        "initial_resources",
        scenario.initial_resources.keys().map(|id| id.as_str()),
        report,
    );

    validate_id_collection(
        "deterministic_decisions",
        scenario
            .deterministic_decisions
            .iter()
            .map(|item| item.id.as_str()),
        report,
    );

    for (decision_index, decision) in scenario.deterministic_decisions.iter().enumerate() {
        validate_id_collection(
            &format!("deterministic_decisions[{decision_index}].branches"),
            decision.branches.iter().map(|branch| branch.id.as_str()),
            report,
        );
    }
}

fn validate_extended_runtime_contract(
    scenario: &ScenarioDefinition,
    report: &mut ValidationReport,
) {
    validate_timing_contract(scenario, report);
    for (metric, rate) in &scenario.foreground_metric_rates {
        if *rate <= 0 {
            report.push(Diagnostic::error(
                DiagnosticCode::InvalidForegroundMetricRate,
                format!("foreground_metric_rates.{}", metric.as_str()),
                "foreground metric rates must be positive",
            ));
        }
    }
    for (index, action) in scenario.actions.iter().enumerate() {
        for (effect_index, effect) in action.effects.iter().enumerate() {
            validate_integer_effect(
                effect,
                &format!("actions[{index}].effects[{effect_index}]"),
                report,
            );
        }
    }
    for (index, event) in scenario.events.iter().enumerate() {
        if event.repeatable
            && matches!(
                event.trigger,
                juris_scenario_schema::EventTrigger::AtTime { .. }
            )
        {
            report.push(Diagnostic::error(
                DiagnosticCode::InvalidRepeatableEventTrigger,
                format!("events[{index}].repeatable"),
                "at_time is a one-shot absolute trigger and cannot be repeatable",
            ));
        }
        for (effect_index, effect) in event.effects.iter().enumerate() {
            validate_integer_effect(
                effect,
                &format!("events[{index}].effects[{effect_index}]"),
                report,
            );
        }
    }
    for (decision_index, decision) in scenario.deterministic_decisions.iter().enumerate() {
        let path = format!("deterministic_decisions[{decision_index}]");
        if decision.roll_range == 0 || decision.score_divisor <= 0 || decision.branches.is_empty() {
            report.push(Diagnostic::error(
                DiagnosticCode::InvalidDecisionDefinition,
                &path,
                "a decision requires a positive roll range, positive score divisor, and at least one branch",
            ));
        }
        for (term_index, term) in decision.score_terms.iter().enumerate() {
            if term
                .minimum
                .zip(term.maximum)
                .is_some_and(|(minimum, maximum)| minimum > maximum)
            {
                report.push(Diagnostic::error(
                    DiagnosticCode::InvalidDecisionDefinition,
                    format!("{path}.score_terms[{term_index}]"),
                    "score-term minimum cannot exceed maximum",
                ));
            }
        }
        for (branch_index, branch) in decision.branches.iter().enumerate() {
            let branch_path = format!("{path}.branches[{branch_index}]");
            if branch
                .minimum_roll
                .zip(branch.maximum_roll)
                .is_some_and(|(minimum, maximum)| minimum > maximum)
                || branch
                    .minimum_total
                    .zip(branch.maximum_total)
                    .is_some_and(|(minimum, maximum)| minimum > maximum)
            {
                report.push(Diagnostic::error(
                    DiagnosticCode::InvalidDecisionDefinition,
                    &branch_path,
                    "decision branch minimum cannot exceed maximum",
                ));
            }
            for (effect_index, effect) in branch.effects.iter().enumerate() {
                if matches!(effect, Effect::ResolveDeterministicDecision { .. }) {
                    report.push(Diagnostic::error(
                        DiagnosticCode::InvalidDecisionDefinition,
                        format!("{branch_path}.effects[{effect_index}]"),
                        "decision branches cannot recursively resolve another decision",
                    ));
                }
                validate_integer_effect(
                    effect,
                    &format!("{branch_path}.effects[{effect_index}]"),
                    report,
                );
            }
        }
    }
}

fn validate_timing_contract(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    if let Some(initial_clock) = scenario.initial_clock {
        validate_scenario_time("initial_clock", initial_clock, report);
    }
    let baseline = scenario.initial_clock.map(scenario_time_minutes);

    for (index, action) in scenario.actions.iter().enumerate() {
        if let Some(timing) = &action.completion_timing {
            validate_relative_timing(
                timing,
                &format!("actions[{index}].completion_timing"),
                report,
            );
        }
    }
    for (index, deadline) in scenario.deadlines.iter().enumerate() {
        validate_scenario_time(
            &format!("deadlines[{index}].due_at"),
            deadline.due_at,
            report,
        );
        if baseline.is_some_and(|baseline| scenario_time_minutes(deadline.due_at) < baseline) {
            report.push(Diagnostic::error(
                DiagnosticCode::InvalidScenarioTime,
                format!("deadlines[{index}].due_at"),
                "an authored civil deadline cannot precede initial_clock",
            ));
        }
        if let Some(timing) = &deadline.relative_due {
            validate_relative_timing(timing, &format!("deadlines[{index}].relative_due"), report);
        }
    }
    for (index, task) in scenario.async_tasks.iter().enumerate() {
        if let Some(timing) = &task.completion_timing {
            validate_relative_timing(
                timing,
                &format!("async_tasks[{index}].completion_timing"),
                report,
            );
        }
    }
    for (index, event) in scenario.events.iter().enumerate() {
        if let EventTrigger::AtTime { at } = event.trigger {
            validate_scenario_time(&format!("events[{index}].trigger.at"), at, report);
            if baseline.is_some_and(|baseline| scenario_time_minutes(at) < baseline) {
                report.push(Diagnostic::error(
                    DiagnosticCode::InvalidScenarioTime,
                    format!("events[{index}].trigger.at"),
                    "a civil at_time event cannot precede initial_clock",
                ));
            }
        }
    }

    // Runtime resolution follows stable IDs, not array order. Cycles have no
    // authoritative anchor and are rejected before session construction.
    for (index, deadline) in scenario.deadlines.iter().enumerate() {
        let mut seen = HashSet::new();
        let mut current = Some(deadline.id.as_str());
        while let Some(id) = current {
            if !seen.insert(id) {
                report.push(Diagnostic::error(
                    DiagnosticCode::InvalidScenarioTime,
                    format!("deadlines[{index}].relative_due.relative_to_deadline"),
                    format!("relative deadline dependency cycle reaches `{id}`"),
                ));
                break;
            }
            current = scenario
                .deadlines
                .iter()
                .find(|candidate| candidate.id.as_str() == id)
                .and_then(|candidate| candidate.relative_due.as_ref())
                .and_then(|timing| timing.relative_to_deadline.as_ref())
                .map(|id| id.as_str());
        }

        if deadline.activation_event.is_none() {
            let mut current = deadline
                .relative_due
                .as_ref()
                .and_then(|timing| timing.relative_to_deadline.as_ref())
                .map(|id| id.as_str());
            while let Some(id) = current {
                let Some(anchor) = scenario
                    .deadlines
                    .iter()
                    .find(|candidate| candidate.id.as_str() == id)
                else {
                    break;
                };
                if anchor.relative_due.is_some() && anchor.activation_event.is_some() {
                    report.push(Diagnostic::error(
                        DiagnosticCode::InvalidScenarioTime,
                        format!("deadlines[{index}].relative_due.relative_to_deadline"),
                        format!(
                            "initially active relative deadline cannot depend on later-activated relative deadline `{id}`"
                        ),
                    ));
                    break;
                }
                current = anchor
                    .relative_due
                    .as_ref()
                    .and_then(|timing| timing.relative_to_deadline.as_ref())
                    .map(|id| id.as_str());
            }
        }
    }
}

fn validate_relative_timing(
    timing: &RelativeTimeDefinition,
    path: &str,
    report: &mut ValidationReport,
) {
    if let Some(calendar) = timing.calendar_target {
        if calendar.minute_of_day >= 1_440 {
            report.push(Diagnostic::error(
                DiagnosticCode::InvalidScenarioTime,
                format!("{path}.calendar_target.minute_of_day"),
                "minute_of_day must be below 1440",
            ));
        }
    }
    if let Some(not_before) = timing.not_before {
        validate_scenario_time(&format!("{path}.not_before"), not_before, report);
    }
}

fn validate_scenario_time(path: &str, time: ScenarioTime, report: &mut ValidationReport) {
    if time.minute_of_day >= 1_440 {
        report.push(Diagnostic::error(
            DiagnosticCode::InvalidScenarioTime,
            format!("{path}.minute_of_day"),
            "minute_of_day must be below 1440",
        ));
    }
}

fn scenario_time_minutes(time: ScenarioTime) -> u64 {
    u64::from(time.day) * 1_440 + u64::from(time.minute_of_day)
}

fn validate_integer_effect(effect: &Effect, path: &str, report: &mut ValidationReport) {
    let invalid_amount = matches!(
        effect,
        Effect::AddMetric { amount, .. }
            | Effect::SubtractMetric { amount, .. }
            | Effect::AddResource { amount, .. }
            | Effect::SubtractResource { amount, .. }
            if *amount < 0
    );
    let invalid_clamp = matches!(
        effect,
        Effect::ClampMetric { minimum, maximum, .. }
            if minimum.is_none() && maximum.is_none()
                || minimum.zip(*maximum).is_some_and(|(minimum, maximum)| minimum > maximum)
    );
    if invalid_amount || invalid_clamp {
        report.push(Diagnostic::error(
            DiagnosticCode::InvalidIntegerEffect,
            path,
            "integer deltas must be non-negative and clamp bounds must be ordered",
        ));
    }
}

fn validate_stage_lifecycle_contract(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    for (index, stage) in scenario.stages.iter().enumerate() {
        if stage.kind == StageKind::Resolved && !stage.terminal {
            report.push(Diagnostic::error(
                DiagnosticCode::ResolvedStageNotTerminal,
                format!("stages[{index}].terminal"),
                format!("resolved stage `{}` must be terminal", stage.id),
            ));
        }

        if stage.terminal && stage.kind != StageKind::Resolved {
            report.push(Diagnostic::error(
                DiagnosticCode::TerminalStageNotResolved,
                format!("stages[{index}].kind"),
                format!(
                    "terminal stage `{}` must use the resolved stage kind",
                    stage.id
                ),
            ));
        }

        if matches!(
            stage.kind,
            StageKind::PostJudgment
                | StageKind::Appeal
                | StageKind::Cassation
                | StageKind::Enforcement
        ) && stage.terminal
        {
            report.push(Diagnostic::error(
                DiagnosticCode::RemedyStageTerminal,
                format!("stages[{index}].terminal"),
                format!("remedy stage `{}` must remain nonterminal", stage.id),
            ));
        }

        if stage.terminal && !stage.exit_actions.is_empty() {
            report.push(Diagnostic::error(
                DiagnosticCode::TerminalStageHasExitActions,
                format!("stages[{index}].exit_actions"),
                format!("terminal stage `{}` must not expose exit actions", stage.id),
            ));
        }
    }
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

    for (index, outcome) in scenario.outcomes.iter().enumerate() {
        let Some(target) = scenario
            .stages
            .iter()
            .find(|stage| stage.id == outcome.terminal_stage)
        else {
            // Reference validation owns unknown stage diagnostics.
            continue;
        };

        if !(target.terminal || target.kind == StageKind::Resolved) {
            report.push(Diagnostic::error(
                DiagnosticCode::OutcomeResolvedBeforeTerminalStage,
                format!("outcomes[{index}].terminal_stage"),
                format!(
                    "outcome `{}` must target a terminal resolved stage, not `{}`",
                    outcome.id, target.id
                ),
            ));
        }
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
