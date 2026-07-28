//! Conservative static reachability analysis for scenario definitions.
//!
//! The validator does not execute the scenario. Instead, it computes a
//! deterministic over-approximation of stages, actions, events, tasks,
//! deadlines, and outcomes that may become reachable.
//!
//! Non-stage conditions such as flags, facts, and evidence are treated as
//! potentially satisfiable. This avoids incorrectly rejecting valid branches
//! merely because runtime evidence is not available during static analysis.

use crate::{Diagnostic, DiagnosticCode, ValidationReport};
use juris_scenario_schema::{Condition, Effect, EventTrigger, ScenarioDefinition, StageId};
use std::collections::HashSet;

/// Runs stage, event, and outcome reachability validation.
pub(crate) fn validate_reachability(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    // Structural validation owns missing or invalid initial-stage errors.
    //
    // Reachability requires a valid graph seed. Starting exploration from an
    // unknown stage would generate misleading cascade diagnostics for every
    // otherwise valid stage and outcome.
    let initial_stage_exists = scenario
        .stages
        .iter()
        .any(|stage| stage.id == scenario.initial_stage);

    if !initial_stage_exists {
        return;
    }

    let graph = ReachabilityGraph::build(scenario);

    validate_reachable_stages(scenario, &graph, report);
    validate_stage_exits(scenario, report);
    validate_reachable_outcomes(scenario, &graph, report);
    validate_event_triggers(scenario, report);
}

/// Result of deterministic fixed-point exploration.
#[derive(Debug, Default)]
struct ReachabilityGraph {
    stages: HashSet<String>,
    actions: HashSet<String>,
    events: HashSet<String>,
    async_tasks: HashSet<String>,
    deadlines: HashSet<String>,
    outcomes: HashSet<String>,
}

impl ReachabilityGraph {
    fn build(scenario: &ScenarioDefinition) -> Self {
        let mut graph = Self::default();

        graph
            .stages
            .insert(scenario.initial_stage.as_str().to_owned());

        for deadline in &scenario.deadlines {
            if deadline.activation_event.is_none() {
                graph.deadlines.insert(deadline.id.as_str().to_owned());
            }
        }

        loop {
            let before = graph.total_entries();

            graph.discover_actions(scenario);
            graph.discover_started_tasks(scenario);
            graph.discover_activated_deadlines(scenario);
            graph.discover_events(scenario);
            graph.apply_reachable_effects(scenario);

            if graph.total_entries() == before {
                break;
            }
        }

        graph
    }

    fn total_entries(&self) -> usize {
        self.stages.len()
            + self.actions.len()
            + self.events.len()
            + self.async_tasks.len()
            + self.deadlines.len()
            + self.outcomes.len()
    }

    fn discover_actions(&mut self, scenario: &ScenarioDefinition) {
        for action in &scenario.actions {
            if condition_may_be_true(&action.available_when, &self.stages) {
                self.actions.insert(action.id.as_str().to_owned());
            }
        }
    }

    fn discover_started_tasks(&mut self, scenario: &ScenarioDefinition) {
        for task in &scenario.async_tasks {
            if self.actions.contains(task.start_action.as_str()) {
                self.async_tasks.insert(task.id.as_str().to_owned());
            }
        }
    }

    fn discover_activated_deadlines(&mut self, scenario: &ScenarioDefinition) {
        for deadline in &scenario.deadlines {
            let active = deadline
                .activation_event
                .as_ref()
                .map_or(true, |event| self.events.contains(event.as_str()));

            if active {
                self.deadlines.insert(deadline.id.as_str().to_owned());
            }
        }
    }

    fn discover_events(&mut self, scenario: &ScenarioDefinition) {
        for event in &scenario.events {
            if !condition_may_be_true(&event.condition, &self.stages) {
                continue;
            }

            let trigger_is_reachable = match &event.trigger {
                EventTrigger::ScenarioStart | EventTrigger::AtTime { .. } => true,

                EventTrigger::AfterAction { action } => self.actions.contains(action.as_str()),

                EventTrigger::AfterEvent { event } => self.events.contains(event.as_str()),

                EventTrigger::AsyncTaskCompleted { task } => {
                    self.async_tasks.contains(task.as_str())
                }

                EventTrigger::DeadlineMissed { deadline } => {
                    self.deadlines.contains(deadline.as_str())
                }

                // ByEffect events are added when a reachable action or event
                // contains Effect::TriggerEvent.
                EventTrigger::ByEffect => self.events.contains(event.id.as_str()),
            };

            if trigger_is_reachable {
                self.events.insert(event.id.as_str().to_owned());
            }
        }
    }

    fn apply_reachable_effects(&mut self, scenario: &ScenarioDefinition) {
        let action_effects: Vec<&Effect> = scenario
            .actions
            .iter()
            .filter(|action| self.actions.contains(action.id.as_str()))
            .flat_map(|action| action.effects.iter())
            .collect();

        let event_effects: Vec<&Effect> = scenario
            .events
            .iter()
            .filter(|event| self.events.contains(event.id.as_str()))
            .flat_map(|event| event.effects.iter())
            .collect();

        for effect in action_effects.into_iter().chain(event_effects) {
            match effect {
                Effect::SetStage { stage } => {
                    self.stages.insert(stage.as_str().to_owned());
                }

                Effect::TriggerEvent { event } => {
                    self.events.insert(event.as_str().to_owned());
                }

                Effect::StartAsyncTask { task } => {
                    self.async_tasks.insert(task.as_str().to_owned());
                }

                Effect::CompleteDeadline { deadline } | Effect::MissDeadline { deadline } => {
                    self.deadlines.insert(deadline.as_str().to_owned());
                }

                Effect::ResolveOutcome { outcome } => {
                    self.outcomes.insert(outcome.as_str().to_owned());
                }

                Effect::SetFlag { .. }
                | Effect::SetFactStatus { .. }
                | Effect::MakeEvidenceAvailable { .. }
                | Effect::MarkAsyncTaskReady { .. }
                | Effect::ReviewAsyncTask { .. }
                | Effect::ExpireAsyncTask { .. }
                | Effect::CreateInboxItem { .. }
                | Effect::ResolveInboxItem { .. } => {}
            }
        }
    }
}

/// Determines whether a condition may be satisfied for the currently
/// reachable stages.
///
/// Conditions that depend on runtime facts are treated as potentially true.
/// `Not` is also treated conservatively because static analysis does not know
/// the runtime value of the nested predicate.
fn condition_may_be_true(condition: &Condition, reachable_stages: &HashSet<String>) -> bool {
    match condition {
        Condition::Always => true,

        Condition::StageIs { stage } => reachable_stages.contains(stage.as_str()),

        Condition::All { conditions } => conditions
            .iter()
            .all(|nested| condition_may_be_true(nested, reachable_stages)),

        Condition::Any { conditions } => conditions
            .iter()
            .any(|nested| condition_may_be_true(nested, reachable_stages)),

        Condition::Not { .. } => true,

        Condition::FlagEquals { .. }
        | Condition::FactStatusIs { .. }
        | Condition::EvidenceAvailable { .. }
        | Condition::DeadlineStatusIs { .. }
        | Condition::AsyncTaskStatusIs { .. }
        | Condition::InboxItemResolved { .. } => true,
    }
}

fn validate_reachable_stages(
    scenario: &ScenarioDefinition,
    graph: &ReachabilityGraph,
    report: &mut ValidationReport,
) {
    for (stage_index, stage) in scenario.stages.iter().enumerate() {
        if !graph.stages.contains(stage.id.as_str()) {
            report.push(Diagnostic::error(
                DiagnosticCode::UnreachableStage,
                format!("stages[{stage_index}]"),
                format!(
                    "stage `{}` is not reachable from initial stage `{}`",
                    stage.id, scenario.initial_stage
                ),
            ));
        }
    }
}

/// Every non-terminal stage must expose at least one static exit.
///
/// An exit may be:
///
/// - an action listed in `exit_actions` that changes stage or resolves an
///   outcome;
/// - an automatic event explicitly conditioned on that stage and changing
///   stage or resolving an outcome.
fn validate_stage_exits(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    for (stage_index, stage) in scenario.stages.iter().enumerate() {
        if stage.terminal {
            continue;
        }

        let has_action_exit = stage.exit_actions.iter().any(|action_id| {
            scenario
                .actions
                .iter()
                .find(|action| action.id == *action_id)
                .is_some_and(|action| effects_exit_stage(scenario, &action.effects, &stage.id))
        });

        let has_event_exit = scenario.events.iter().any(|event| {
            condition_mentions_stage(&event.condition, &stage.id)
                && effects_exit_stage(scenario, &event.effects, &stage.id)
        });

        if !has_action_exit && !has_event_exit {
            report.push(Diagnostic::error(
                DiagnosticCode::StageWithoutExit,
                format!("stages[{stage_index}]"),
                format!(
                    "non-terminal stage `{}` has no action or automatic \
                     event that exits the stage or resolves an outcome",
                    stage.id
                ),
            ));
        }
    }
}

fn effects_exit_stage(
    scenario: &ScenarioDefinition,
    effects: &[Effect],
    current_stage: &StageId,
) -> bool {
    if effects.iter().any(|effect| match effect {
        Effect::SetStage { stage } => stage != current_stage,
        Effect::ResolveOutcome { .. } => true,
        _ => false,
    }) {
        return true;
    }

    effects.iter().any(|effect| {
        let Effect::TriggerEvent { event } = effect else {
            return false;
        };

        scenario
            .events
            .iter()
            .find(|candidate| candidate.id == *event)
            .is_some_and(|triggered_event| {
                triggered_event
                    .effects
                    .iter()
                    .any(|triggered_effect| match triggered_effect {
                        Effect::SetStage { stage } => stage != current_stage,
                        Effect::ResolveOutcome { .. } => true,
                        _ => false,
                    })
            })
    })
}

/// Returns true only for a positive, explicit stage condition.
///
/// `Not(StageIs(...))` is deliberately not considered an association with the
/// stage because it means the event applies outside that stage.
fn condition_mentions_stage(condition: &Condition, stage_id: &StageId) -> bool {
    match condition {
        Condition::StageIs { stage } => stage == stage_id,

        Condition::All { conditions } | Condition::Any { conditions } => conditions
            .iter()
            .any(|nested| condition_mentions_stage(nested, stage_id)),

        Condition::Always
        | Condition::Not { .. }
        | Condition::FlagEquals { .. }
        | Condition::FactStatusIs { .. }
        | Condition::EvidenceAvailable { .. }
        | Condition::DeadlineStatusIs { .. }
        | Condition::AsyncTaskStatusIs { .. }
        | Condition::InboxItemResolved { .. } => false,
    }
}

fn validate_reachable_outcomes(
    scenario: &ScenarioDefinition,
    graph: &ReachabilityGraph,
    report: &mut ValidationReport,
) {
    for (outcome_index, outcome) in scenario.outcomes.iter().enumerate() {
        if !graph.outcomes.contains(outcome.id.as_str()) {
            report.push(Diagnostic::error(
                DiagnosticCode::UnreachableOutcome,
                format!("outcomes[{outcome_index}]"),
                format!(
                    "outcome `{}` is never resolved by a reachable action \
                     or event",
                    outcome.id
                ),
            ));
        }
    }
}

fn validate_event_triggers(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    for (event_index, event) in scenario.events.iter().enumerate() {
        if event_has_declared_trigger_path(scenario, event) {
            continue;
        }

        report.push(Diagnostic::error(
            DiagnosticCode::EventWithoutTrigger,
            format!("events[{event_index}].trigger"),
            format!(
                "event `{}` has no scenario action, event, asynchronous \
                 task, or deadline capable of triggering it",
                event.id
            ),
        ));
    }
}

fn event_has_declared_trigger_path(
    scenario: &ScenarioDefinition,
    event: &juris_scenario_schema::EventDefinition,
) -> bool {
    match &event.trigger {
        EventTrigger::ScenarioStart
        | EventTrigger::AtTime { .. }
        | EventTrigger::AfterAction { .. }
        | EventTrigger::AfterEvent { .. } => true,

        EventTrigger::ByEffect => scenario
            .actions
            .iter()
            .flat_map(|action| action.effects.iter())
            .chain(
                scenario
                    .events
                    .iter()
                    .flat_map(|candidate| candidate.effects.iter()),
            )
            .any(|effect| {
                matches!(
                    effect,
                    Effect::TriggerEvent {
                        event: referenced_event
                    } if referenced_event == &event.id
                )
            }),

        EventTrigger::AsyncTaskCompleted { task } => {
            let Some(task_definition) = scenario
                .async_tasks
                .iter()
                .find(|candidate| candidate.id == *task)
            else {
                // Unknown task references are owned by Phase 1 validation.
                return true;
            };

            task_definition.completion_event == event.id
        }

        EventTrigger::DeadlineMissed { deadline } => {
            let Some(deadline_definition) = scenario
                .deadlines
                .iter()
                .find(|candidate| candidate.id == *deadline)
            else {
                // Unknown deadline references are owned by Phase 1 validation.
                return true;
            };

            deadline_definition.missed_event == event.id
        }
    }
}
