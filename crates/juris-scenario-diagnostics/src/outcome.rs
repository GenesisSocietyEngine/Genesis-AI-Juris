use std::collections::{BTreeMap, BTreeSet};

use juris_scenario_schema::{
    Condition, Effect, OutcomeId, ScenarioDefinition, StageDefinition, StageKind,
};

use crate::{
    condition_analysis::{classify, Satisfiability},
    AuthoringDiagnostic, AuthoringDiagnosticCode, AuthoringValidationReport,
};

pub(crate) fn validate_outcome_semantics(
    scenario: &ScenarioDefinition,
    report: &mut AuthoringValidationReport,
) {
    let stages = scenario
        .stages
        .iter()
        .map(|stage| (stage.id.as_str(), stage))
        .collect::<BTreeMap<_, _>>();

    validate_post_judgment_stages(scenario, report);
    validate_remedy_stages(scenario, report);
    validate_terminal_outcome_coverage(scenario, &stages, report);
    validate_outcomes_resolve_at_closure(scenario, &stages, report);
    validate_outcome_producers(scenario, report);
    validate_transition_outcome_cardinality(scenario, report);
    validate_unconditional_outcome_ambiguity(scenario, report);
    validate_outcome_conditions(scenario, report);
    report.sort();
}

fn validate_remedy_stages(scenario: &ScenarioDefinition, report: &mut AuthoringValidationReport) {
    for (index, stage) in scenario.stages.iter().enumerate() {
        if !matches!(
            stage.kind,
            StageKind::PostJudgment
                | StageKind::Appeal
                | StageKind::Cassation
                | StageKind::Enforcement
        ) {
            continue;
        }

        if stage.terminal && stage.kind != StageKind::PostJudgment {
            report.push(AuthoringDiagnostic::error(
                AuthoringDiagnosticCode::TerminalRemedyStage,
                format!("stages[{index}].terminal"),
                format!(
                    "remedy stage `{}` is terminal and would suppress available remedies",
                    stage.id
                ),
                "Keep remedy stages non-terminal and close through a separate resolved stage.",
            ));
        }

        if stage.exit_actions.is_empty() {
            report.push(AuthoringDiagnostic::error(
                AuthoringDiagnosticCode::RemedyStageWithoutExit,
                format!("stages[{index}].exit_actions"),
                format!("remedy stage `{}` has no declared exit action", stage.id),
                "Declare at least one reachable remedy, waiver, exhaustion, settlement, or enforcement-completion action.",
            ));
        }
    }
}

fn validate_outcomes_resolve_at_closure(
    scenario: &ScenarioDefinition,
    stages: &BTreeMap<&str, &StageDefinition>,
    report: &mut AuthoringValidationReport,
) {
    for (collection, index, condition, effects) in
        scenario
            .actions
            .iter()
            .enumerate()
            .map(|(index, action)| {
                (
                    "actions",
                    index,
                    &action.available_when,
                    action.effects.as_slice(),
                )
            })
            .chain(scenario.events.iter().enumerate().map(|(index, event)| {
                ("events", index, &event.condition, event.effects.as_slice())
            }))
    {
        if !effects
            .iter()
            .any(|effect| resolve_outcome(effect).is_some())
        {
            continue;
        }
        let enters_terminal = effects.iter().any(|effect| {
            let Effect::SetStage { stage } = effect else {
                return false;
            };
            stages.get(stage.as_str()).copied().is_some_and(is_terminal)
        }) || condition_targets_terminal(condition, stages);
        if !enters_terminal {
            report.push(AuthoringDiagnostic::error(
                AuthoringDiagnosticCode::PrematureOutcomeResolution,
                format!("{collection}[{index}].effects"),
                "transition resolves the complete scenario outcome without entering a terminal stage",
                "Record an intermediate judicial result with SetJudicialResult; resolve an outcome only when entering a resolved terminal stage.",
            ));
        }
    }
}

fn condition_targets_terminal(
    condition: &Condition,
    stages: &BTreeMap<&str, &StageDefinition>,
) -> bool {
    match condition {
        Condition::StageIs { stage } => {
            stages.get(stage.as_str()).copied().is_some_and(is_terminal)
        }
        Condition::All { conditions } => conditions
            .iter()
            .any(|nested| condition_targets_terminal(nested, stages)),
        Condition::Any { conditions } => {
            !conditions.is_empty()
                && conditions
                    .iter()
                    .all(|nested| condition_targets_terminal(nested, stages))
        }
        Condition::Always
        | Condition::FlagEquals { .. }
        | Condition::FactStatusIs { .. }
        | Condition::EvidenceAvailable { .. }
        | Condition::DeadlineStatusIs { .. }
        | Condition::AsyncTaskStatusIs { .. }
        | Condition::InboxItemResolved { .. }
        | Condition::JudicialResultIs { .. }
        | Condition::Not { .. } => false,
    }
}

fn validate_post_judgment_stages(
    scenario: &ScenarioDefinition,
    report: &mut AuthoringValidationReport,
) {
    for (index, stage) in scenario.stages.iter().enumerate() {
        if stage.kind == StageKind::PostJudgment && stage.terminal {
            report.push(AuthoringDiagnostic::error(
                AuthoringDiagnosticCode::TerminalPostJudgmentStage,
                format!("stages[{index}].terminal"),
                format!(
                    "post-judgment stage `{}` is terminal, which prevents appeal, settlement assessment, or acceptance instructions",
                    stage.id
                ),
                "Keep post-judgment non-terminal and transition to a separate resolved stage only after remedies are exhausted or declined.",
            ));
        }
    }
}

fn validate_terminal_outcome_coverage(
    scenario: &ScenarioDefinition,
    stages: &BTreeMap<&str, &StageDefinition>,
    report: &mut AuthoringValidationReport,
) {
    for (stage_index, stage) in scenario.stages.iter().enumerate() {
        if is_terminal(stage)
            && !scenario
                .outcomes
                .iter()
                .any(|outcome| outcome.terminal_stage == stage.id)
        {
            report.push(AuthoringDiagnostic::error(
                AuthoringDiagnosticCode::TerminalStageWithoutOutcome,
                format!("stages[{stage_index}]"),
                format!("terminal stage `{}` has no assigned outcome", stage.id),
                "Add at least one outcome whose terminal_stage references this stage.",
            ));
        }
    }

    for (outcome_index, outcome) in scenario.outcomes.iter().enumerate() {
        if let Some(stage) = stages.get(outcome.terminal_stage.as_str()).copied() {
            if !is_terminal(stage) {
                report.push(AuthoringDiagnostic::error(
                    AuthoringDiagnosticCode::OutcomeTargetsNonTerminalStage,
                    format!("outcomes[{outcome_index}].terminal_stage"),
                    format!(
                        "outcome `{}` targets non-terminal stage `{}`",
                        outcome.id, outcome.terminal_stage
                    ),
                    "Point outcomes to a terminal/resolved stage, or mark the target as terminal only when no remedies remain.",
                ));
            }
        }
    }
}

fn validate_outcome_producers(
    scenario: &ScenarioDefinition,
    report: &mut AuthoringValidationReport,
) {
    let produced = scenario
        .actions
        .iter()
        .flat_map(|action| action.effects.iter())
        .chain(
            scenario
                .events
                .iter()
                .flat_map(|event| event.effects.iter()),
        )
        .filter_map(resolve_outcome)
        .map(OutcomeId::as_str)
        .collect::<BTreeSet<_>>();

    for (index, outcome) in scenario.outcomes.iter().enumerate() {
        if !produced.contains(outcome.id.as_str()) {
            report.push(AuthoringDiagnostic::error(
                AuthoringDiagnosticCode::OutcomeWithoutProducer,
                format!("outcomes[{index}]"),
                format!(
                    "outcome `{}` is declared but no action or event resolves it",
                    outcome.id
                ),
                "Add Effect::ResolveOutcome to a reachable action or event.",
            ));
        }
    }
}

fn validate_transition_outcome_cardinality(
    scenario: &ScenarioDefinition,
    report: &mut AuthoringValidationReport,
) {
    for (index, action) in scenario.actions.iter().enumerate() {
        validate_effect_set(
            &action.effects,
            format!("actions[{index}].effects"),
            format!("action `{}`", action.id),
            report,
        );
    }

    for (index, event) in scenario.events.iter().enumerate() {
        validate_effect_set(
            &event.effects,
            format!("events[{index}].effects"),
            format!("event `{}`", event.id),
            report,
        );
    }
}

fn validate_effect_set(
    effects: &[Effect],
    path: String,
    owner: String,
    report: &mut AuthoringValidationReport,
) {
    let outcomes = effects
        .iter()
        .filter_map(resolve_outcome)
        .map(OutcomeId::as_str)
        .collect::<BTreeSet<_>>();

    if outcomes.len() > 1 {
        report.push(AuthoringDiagnostic::error(
            AuthoringDiagnosticCode::MultipleOutcomesInTransition,
            path,
            format!(
                "{owner} resolves several competing outcomes in one atomic transition: {}",
                outcomes.into_iter().collect::<Vec<_>>().join(", ")
            ),
            "Resolve exactly one outcome per deterministic transition.",
        ));
    }
}

fn validate_unconditional_outcome_ambiguity(
    scenario: &ScenarioDefinition,
    report: &mut AuthoringValidationReport,
) {
    let mut always_by_stage: BTreeMap<&str, Vec<(usize, &str)>> = BTreeMap::new();

    for (index, outcome) in scenario.outcomes.iter().enumerate() {
        if matches!(outcome.condition, Condition::Always) {
            always_by_stage
                .entry(outcome.terminal_stage.as_str())
                .or_default()
                .push((index, outcome.id.as_str()));
        }
    }

    for (stage, outcomes) in always_by_stage {
        if outcomes.len() > 1 {
            let indexes = outcomes
                .iter()
                .map(|(index, _)| index.to_string())
                .collect::<Vec<_>>()
                .join(", ");
            let ids = outcomes
                .iter()
                .map(|(_, id)| *id)
                .collect::<Vec<_>>()
                .join(", ");

            report.push(AuthoringDiagnostic::error(
                AuthoringDiagnosticCode::AmbiguousUnconditionalOutcomes,
                format!("outcomes[{indexes}]"),
                format!("terminal stage `{stage}` has several unconditional outcomes: {ids}"),
                "Make outcome conditions mutually exclusive or retain one unconditional fallback.",
            ));
        }
    }
}

fn validate_outcome_conditions(
    scenario: &ScenarioDefinition,
    report: &mut AuthoringValidationReport,
) {
    for (index, outcome) in scenario.outcomes.iter().enumerate() {
        if classify(&outcome.condition) == Satisfiability::Never {
            report.push(AuthoringDiagnostic::error(
                AuthoringDiagnosticCode::UnsatisfiableOutcomeCondition,
                format!("outcomes[{index}].condition"),
                format!(
                    "outcome `{}` has a provably contradictory condition",
                    outcome.id
                ),
                "Remove conflicting stage, flag, fact, deadline, or task predicates.",
            ));
        }
    }
}

fn resolve_outcome(effect: &Effect) -> Option<&OutcomeId> {
    match effect {
        Effect::ResolveOutcome { outcome } => Some(outcome),
        _ => None,
    }
}

fn is_terminal(stage: &StageDefinition) -> bool {
    stage.terminal || stage.kind == StageKind::Resolved
}
