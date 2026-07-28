//! Static validation of terminal-stage closure.
//!
//! The validator does not execute runtime state. It verifies that each
//! declarative transition into a terminal stage closes obligations that may
//! still be actionable and resolves an outcome assigned to that stage.
//!
//! Earlier validation phases remain authoritative for malformed structures,
//! references, lifecycle definitions, and graph reachability. Terminal-state
//! analysis therefore runs only after those phases have produced no errors,
//! avoiding misleading cascade diagnostics.

use crate::{Diagnostic, DiagnosticCode, ValidationReport};
use juris_scenario_schema::{
    ActionId, AsyncTaskId, AsyncTaskStatus, Condition, DeadlineId, DeadlineStatus, Effect, EventId,
    EventTrigger, InboxItemId, ScenarioDefinition, StageDefinition, StageId, StageKind,
};
use std::collections::HashSet;

/// Validates closure properties of every transition into a terminal stage.
pub(crate) fn validate_terminal_state(
    scenario: &ScenarioDefinition,
    report: &mut ValidationReport,
) {
    // Terminal analysis depends on valid structure, references, lifecycle
    // definitions, and reachability. Do not add secondary diagnostics when an
    // earlier phase has already identified a primary defect.
    if !report.is_valid() {
        return;
    }

    if !scenario.stages.iter().any(is_terminal_stage) {
        return;
    }

    validate_terminal_transitions(scenario, report);
    validate_terminal_action_availability(scenario, report);
}

fn validate_terminal_transitions(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    for (action_index, action) in scenario.actions.iter().enumerate() {
        validate_terminal_transition(
            scenario,
            &action.available_when,
            &action.effects,
            Some(&action.id),
            None,
            &format!("actions[{action_index}].effects"),
            report,
        );
    }

    for (event_index, event) in scenario.events.iter().enumerate() {
        validate_terminal_transition(
            scenario,
            &event.condition,
            &event.effects,
            None,
            Some(&event.id),
            &format!("events[{event_index}].effects"),
            report,
        );
    }
}

#[allow(clippy::too_many_arguments)]
fn validate_terminal_transition(
    scenario: &ScenarioDefinition,
    condition: &Condition,
    effects: &[Effect],
    source_action: Option<&ActionId>,
    source_event: Option<&EventId>,
    path: &str,
    report: &mut ValidationReport,
) {
    let terminal_targets = terminal_stage_targets(scenario, effects);

    if terminal_targets.is_empty() {
        return;
    }

    let target_names = terminal_targets
        .iter()
        .map(|stage| stage.id.as_str())
        .collect::<Vec<_>>()
        .join(", ");

    let chain = TransitionChain::build(scenario, effects, source_action, source_event);

    validate_terminal_tasks(
        scenario,
        condition,
        effects,
        source_action,
        &chain,
        path,
        &target_names,
        report,
    );

    validate_terminal_deadlines(
        scenario,
        condition,
        effects,
        &chain,
        path,
        &target_names,
        report,
    );

    validate_terminal_inbox(
        scenario,
        condition,
        effects,
        &chain,
        path,
        &target_names,
        report,
    );

    for terminal_stage in terminal_targets {
        if !chain.resolves_outcome_for_stage(scenario, effects, &terminal_stage.id) {
            report.push(Diagnostic::error(
                DiagnosticCode::ResolvedWithoutOutcome,
                path.to_owned(),
                format!(
                    "transition enters terminal stage `{}` without resolving an outcome assigned to that stage",
                    terminal_stage.id
                ),
            ));
        }
    }
}

/// A task is safe at resolution when it is proven safe by the transition
/// condition, or reviewed/expired by the deterministic transition chain.
#[allow(clippy::too_many_arguments)]
fn validate_terminal_tasks(
    scenario: &ScenarioDefinition,
    condition: &Condition,
    root_effects: &[Effect],
    source_action: Option<&ActionId>,
    chain: &TransitionChain,
    path: &str,
    target_names: &str,
    report: &mut ValidationReport,
) {
    for task in &scenario.async_tasks {
        let closes_task = chain.contains_effect(scenario, root_effects, &|effect| {
            matches!(
                effect,
                Effect::ReviewAsyncTask {
                    task: referenced_task
                } | Effect::ExpireAsyncTask {
                    task: referenced_task
                } if referenced_task == &task.id
            )
        });

        let starts_task = source_action == Some(&task.start_action)
            || chain.contains_effect(scenario, root_effects, &|effect| {
                matches!(
                    effect,
                    Effect::StartAsyncTask {
                        task: referenced_task
                    } if referenced_task == &task.id
                )
            });

        let condition_proves_safe = condition_guarantees_task_safe(condition, &task.id);

        if !closes_task && (starts_task || !condition_proves_safe) {
            report.push(Diagnostic::error(
                DiagnosticCode::ResolvedWithPendingTask,
                path.to_owned(),
                format!(
                    "transition into terminal stage(s) `{target_names}` may leave asynchronous task `{}` in progress or ready",
                    task.id
                ),
            ));
        }
    }
}

/// Deadlines active at scenario start, activated in the transition, or proven
/// open by the transition condition must be completed or missed before the
/// scenario enters a terminal stage.
#[allow(clippy::too_many_arguments)]
fn validate_terminal_deadlines(
    scenario: &ScenarioDefinition,
    condition: &Condition,
    root_effects: &[Effect],
    chain: &TransitionChain,
    path: &str,
    target_names: &str,
    report: &mut ValidationReport,
) {
    for deadline in &scenario.deadlines {
        let closes_deadline = chain.contains_effect(scenario, root_effects, &|effect| {
            matches!(
                effect,
                Effect::CompleteDeadline {
                    deadline: referenced_deadline
                } | Effect::MissDeadline {
                    deadline: referenced_deadline
                } if referenced_deadline == &deadline.id
            )
        });

        let activated_during_transition = deadline
            .activation_event
            .as_ref()
            .is_some_and(|event| chain.contains_event(event));

        let active_at_scenario_start = deadline.activation_event.is_none();
        let condition_proves_open =
            condition_guarantees_deadline_status(condition, &deadline.id, DeadlineStatus::Open);
        let condition_proves_closed = condition_guarantees_deadline_closed(condition, &deadline.id);

        let unsafe_terminal_state = if activated_during_transition {
            !closes_deadline
        } else if active_at_scenario_start || condition_proves_open {
            !closes_deadline && !condition_proves_closed
        } else {
            false
        };

        if unsafe_terminal_state {
            report.push(Diagnostic::error(
                DiagnosticCode::ResolvedWithOpenDeadline,
                path.to_owned(),
                format!(
                    "transition into terminal stage(s) `{target_names}` may leave deadline `{}` open",
                    deadline.id
                ),
            ));
        }
    }
}

/// Required Inbox items visible at scenario start or created during the
/// terminal transition must be resolved or expired before resolution.
#[allow(clippy::too_many_arguments)]
fn validate_terminal_inbox(
    scenario: &ScenarioDefinition,
    condition: &Condition,
    root_effects: &[Effect],
    chain: &TransitionChain,
    path: &str,
    target_names: &str,
    report: &mut ValidationReport,
) {
    for item in scenario
        .inbox_items
        .iter()
        .filter(|item| item.action_required)
    {
        let resolved_by_effect = chain.contains_effect(scenario, root_effects, &|effect| {
            matches!(
                effect,
                Effect::ResolveInboxItem {
                    item: referenced_item
                } if referenced_item == &item.id
            )
        });

        let expired_in_chain = item
            .expiry_event
            .as_ref()
            .is_some_and(|event| chain.contains_event(event));
        let closed_in_chain = resolved_by_effect || expired_in_chain;

        let created_by_effect = chain.contains_effect(scenario, root_effects, &|effect| {
            matches!(
                effect,
                Effect::CreateInboxItem {
                    item: referenced_item
                } if referenced_item == &item.id
            )
        });
        let created_by_event = item
            .created_by_event
            .as_ref()
            .is_some_and(|event| chain.contains_event(event));
        let created_during_transition = created_by_effect || created_by_event;

        let visible_at_scenario_start = item.created_by_event.is_none() || item.initially_visible;
        let condition_proves_resolved = condition_guarantees_inbox_resolved(condition, &item.id);

        let unsafe_terminal_state = if created_during_transition {
            !closed_in_chain
        } else if visible_at_scenario_start {
            !closed_in_chain && !condition_proves_resolved
        } else {
            false
        };

        if unsafe_terminal_state {
            report.push(Diagnostic::error(
                DiagnosticCode::ResolvedWithRequiredInbox,
                path.to_owned(),
                format!(
                    "transition into terminal stage(s) `{target_names}` may leave required Inbox item `{}` unresolved",
                    item.id
                ),
            ));
        }
    }
}

/// A terminal stage must not expose further executable actions.
fn validate_terminal_action_availability(
    scenario: &ScenarioDefinition,
    report: &mut ValidationReport,
) {
    let terminal_stages = scenario
        .stages
        .iter()
        .filter(|stage| is_terminal_stage(stage))
        .collect::<Vec<_>>();

    for (action_index, action) in scenario.actions.iter().enumerate() {
        let available_terminal_stages = terminal_stages
            .iter()
            .filter(|stage| condition_may_be_true_in_stage(&action.available_when, &stage.id))
            .map(|stage| stage.id.as_str())
            .collect::<Vec<_>>();

        if available_terminal_stages.is_empty() {
            continue;
        }

        report.push(Diagnostic::error(
            DiagnosticCode::ResolvedWithAvailableAction,
            format!("actions[{action_index}].available_when"),
            format!(
                "action `{}` may remain available in terminal stage(s) `{}`",
                action.id,
                available_terminal_stages.join(", ")
            ),
        ));
    }
}

fn terminal_stage_targets<'a>(
    scenario: &'a ScenarioDefinition,
    effects: &[Effect],
) -> Vec<&'a StageDefinition> {
    let mut seen = HashSet::new();
    let mut targets = Vec::new();

    for effect in effects {
        let Effect::SetStage { stage } = effect else {
            continue;
        };

        let Some(stage_definition) = scenario
            .stages
            .iter()
            .find(|candidate| candidate.id == *stage)
        else {
            continue;
        };

        if is_terminal_stage(stage_definition)
            && seen.insert(stage_definition.id.as_str().to_owned())
        {
            targets.push(stage_definition);
        }
    }

    targets
}

fn is_terminal_stage(stage: &StageDefinition) -> bool {
    stage.terminal || stage.kind == StageKind::Resolved
}

/// Deterministic events causally attached to one root action or event.
#[derive(Debug, Default)]
struct TransitionChain {
    event_ids: HashSet<String>,
}

impl TransitionChain {
    fn build(
        scenario: &ScenarioDefinition,
        root_effects: &[Effect],
        source_action: Option<&ActionId>,
        source_event: Option<&EventId>,
    ) -> Self {
        let mut chain = Self::default();
        let mut pending_events = Vec::new();

        if let Some(event) = source_event {
            pending_events.push(event.as_str().to_owned());
        }

        if let Some(action) = source_action {
            for event in &scenario.events {
                if matches!(
                    &event.trigger,
                    EventTrigger::AfterAction {
                        action: trigger_action
                    } if trigger_action == action
                ) {
                    pending_events.push(event.id.as_str().to_owned());
                }
            }
        }

        add_triggered_events(root_effects, &mut pending_events);

        while let Some(event_id) = pending_events.pop() {
            if !chain.event_ids.insert(event_id.clone()) {
                continue;
            }

            let Some(event) = scenario
                .events
                .iter()
                .find(|candidate| candidate.id.as_str() == event_id.as_str())
            else {
                continue;
            };

            add_triggered_events(&event.effects, &mut pending_events);

            for dependent_event in &scenario.events {
                if matches!(
                    &dependent_event.trigger,
                    EventTrigger::AfterEvent {
                        event: trigger_event
                    } if trigger_event == &event.id
                ) {
                    pending_events.push(dependent_event.id.as_str().to_owned());
                }
            }
        }

        chain
    }

    fn contains_event(&self, event: &EventId) -> bool {
        self.event_ids.contains(event.as_str())
    }

    fn contains_effect<F>(
        &self,
        scenario: &ScenarioDefinition,
        root_effects: &[Effect],
        predicate: &F,
    ) -> bool
    where
        F: Fn(&Effect) -> bool,
    {
        if root_effects.iter().any(predicate) {
            return true;
        }

        self.event_ids.iter().any(|event_id| {
            scenario
                .events
                .iter()
                .find(|event| event.id.as_str() == event_id.as_str())
                .is_some_and(|event| event.effects.iter().any(predicate))
        })
    }

    fn resolves_outcome_for_stage(
        &self,
        scenario: &ScenarioDefinition,
        root_effects: &[Effect],
        terminal_stage: &StageId,
    ) -> bool {
        self.contains_effect(scenario, root_effects, &|effect| {
            let Effect::ResolveOutcome { outcome } = effect else {
                return false;
            };

            scenario.outcomes.iter().any(|definition| {
                definition.id == *outcome && definition.terminal_stage == *terminal_stage
            })
        })
    }
}

fn add_triggered_events(effects: &[Effect], pending_events: &mut Vec<String>) {
    for effect in effects {
        if let Effect::TriggerEvent { event } = effect {
            pending_events.push(event.as_str().to_owned());
        }
    }
}

/// Logical implication helper for positive condition atoms.
fn condition_guarantees<F>(condition: &Condition, atom: &F) -> bool
where
    F: Fn(&Condition) -> bool,
{
    if atom(condition) {
        return true;
    }

    match condition {
        Condition::All { conditions } => conditions
            .iter()
            .any(|nested| condition_guarantees(nested, atom)),

        Condition::Any { conditions } => {
            !conditions.is_empty()
                && conditions
                    .iter()
                    .all(|nested| condition_guarantees(nested, atom))
        }

        Condition::Always
        | Condition::StageIs { .. }
        | Condition::FlagEquals { .. }
        | Condition::FactStatusIs { .. }
        | Condition::EvidenceAvailable { .. }
        | Condition::DeadlineStatusIs { .. }
        | Condition::AsyncTaskStatusIs { .. }
        | Condition::InboxItemResolved { .. }
        | Condition::Not { .. } => false,
    }
}

fn condition_guarantees_task_safe(condition: &Condition, task_id: &AsyncTaskId) -> bool {
    condition_guarantees(condition, &|nested| {
        let Condition::AsyncTaskStatusIs { task, status } = nested else {
            return false;
        };

        task == task_id
            && matches!(
                *status,
                AsyncTaskStatus::NotStarted | AsyncTaskStatus::Reviewed | AsyncTaskStatus::Expired
            )
    })
}

fn condition_guarantees_deadline_closed(condition: &Condition, deadline_id: &DeadlineId) -> bool {
    condition_guarantees(condition, &|nested| {
        let Condition::DeadlineStatusIs { deadline, status } = nested else {
            return false;
        };

        deadline == deadline_id
            && matches!(*status, DeadlineStatus::Completed | DeadlineStatus::Missed)
    })
}

fn condition_guarantees_deadline_status(
    condition: &Condition,
    deadline_id: &DeadlineId,
    required_status: DeadlineStatus,
) -> bool {
    condition_guarantees(condition, &|nested| {
        matches!(
            nested,
            Condition::DeadlineStatusIs { deadline, status }
                if deadline == deadline_id && *status == required_status
        )
    })
}

fn condition_guarantees_inbox_resolved(condition: &Condition, item_id: &InboxItemId) -> bool {
    condition_guarantees(condition, &|nested| {
        matches!(
            nested,
            Condition::InboxItemResolved { item } if item == item_id
        )
    })
}

/// Returns whether a condition can evaluate to true in a given stage.
fn condition_may_be_true_in_stage(condition: &Condition, stage_id: &StageId) -> bool {
    match condition {
        Condition::Always => true,
        Condition::StageIs { stage } => stage == stage_id,
        Condition::All { conditions } => conditions
            .iter()
            .all(|nested| condition_may_be_true_in_stage(nested, stage_id)),
        Condition::Any { conditions } => conditions
            .iter()
            .any(|nested| condition_may_be_true_in_stage(nested, stage_id)),
        Condition::Not { condition } => condition_may_be_false_in_stage(condition, stage_id),
        Condition::FlagEquals { .. }
        | Condition::FactStatusIs { .. }
        | Condition::EvidenceAvailable { .. }
        | Condition::DeadlineStatusIs { .. }
        | Condition::AsyncTaskStatusIs { .. }
        | Condition::InboxItemResolved { .. } => true,
    }
}

fn condition_may_be_false_in_stage(condition: &Condition, stage_id: &StageId) -> bool {
    match condition {
        Condition::Always => false,
        Condition::StageIs { stage } => stage != stage_id,
        Condition::All { conditions } => conditions
            .iter()
            .any(|nested| condition_may_be_false_in_stage(nested, stage_id)),
        Condition::Any { conditions } => conditions
            .iter()
            .all(|nested| condition_may_be_false_in_stage(nested, stage_id)),
        Condition::Not { condition } => condition_may_be_true_in_stage(condition, stage_id),
        Condition::FlagEquals { .. }
        | Condition::FactStatusIs { .. }
        | Condition::EvidenceAvailable { .. }
        | Condition::DeadlineStatusIs { .. }
        | Condition::AsyncTaskStatusIs { .. }
        | Condition::InboxItemResolved { .. } => true,
    }
}
