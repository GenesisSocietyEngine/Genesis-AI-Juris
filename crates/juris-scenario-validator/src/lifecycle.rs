//! Lifecycle validation for scenario entities.
//!
//! Structural validation proves that references exist. Lifecycle validation
//! proves that active entities have an explicit path to a terminal state.

use crate::{effect_closure::EffectClosure, Diagnostic, DiagnosticCode, ValidationReport};
use juris_scenario_schema::{
    ActionDefinition, ActionId, Effect, EventId, EventKind, EventTrigger, ScenarioDefinition,
    StageKind,
};

/// Enforces lifecycle invariants discovered during mobile playtesting.
pub(crate) fn validate_lifecycle(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    validate_required_inbox_items(scenario, report);
    validate_deadlines(scenario, report);
    validate_async_tasks(scenario, report);
    validate_hearings(scenario, report);
}

/// Every asynchronous task must have:
///
/// 1. a completion event that is triggered by completion of the same task and
///    moves it from `InProgress` to `Ready`;
/// 2. a terminal path that eventually reviews or expires the ready work.
///
/// This prevents delegated reviews and expert reports from remaining
/// permanently `InProgress` or `Ready`.
/// Every hearing stage requires a formal scheduling event and a terminal
/// hearing event.
///
/// This prevents a generated scenario from entering a hearing that was never
/// placed on the calendar, or remaining permanently inside the hearing stage
/// after attendance, judgment, or procedural closure.
fn validate_hearings(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    let hearing_stage_indices: Vec<usize> = scenario
        .stages
        .iter()
        .enumerate()
        .filter_map(|(stage_index, stage)| {
            (stage.kind == StageKind::Hearing).then_some(stage_index)
        })
        .collect();

    // Scenarios without a hearing are not required to define hearing events.
    if hearing_stage_indices.is_empty() {
        return;
    }

    let has_schedule_event = scenario
        .events
        .iter()
        .any(|event| event.kind == EventKind::HearingScheduled);

    let has_terminal_event = scenario.events.iter().any(|event| {
        if event.kind != EventKind::HearingClosed {
            return false;
        }

        event.effects.iter().any(|effect| match effect {
            Effect::SetStage { stage } => scenario
                .stages
                .iter()
                .find(|candidate| candidate.id == *stage)
                .is_some_and(|target| target.kind != StageKind::Hearing),

            Effect::ResolveOutcome { .. } => true,

            _ => false,
        })
    });

    for stage_index in hearing_stage_indices {
        if !has_schedule_event {
            report.push(Diagnostic::error(
                DiagnosticCode::HearingWithoutScheduleEvent,
                format!("stages[{stage_index}]"),
                "a hearing stage requires at least one hearing-scheduled event",
            ));
        }

        if !has_terminal_event {
            report.push(Diagnostic::error(
                DiagnosticCode::HearingWithoutTerminalEvent,
                format!("stages[{stage_index}]"),
                "a hearing stage requires a hearing-closed event that exits \
                 the hearing stage or resolves an outcome",
            ));
        }
    }
}

fn validate_async_tasks(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    for (task_index, task) in scenario.async_tasks.iter().enumerate() {
        // Reference validation reports unknown actions and events separately.
        // Do not create secondary lifecycle diagnostics for missing objects.
        if action_by_id(scenario, &task.start_action).is_none() {
            continue;
        }

        let Some(completion_event) = event_by_id(scenario, &task.completion_event) else {
            continue;
        };

        let completion_trigger_matches = matches!(
            &completion_event.trigger,
            EventTrigger::AsyncTaskCompleted {
                task: referenced_task
            } if referenced_task == &task.id
        );

        let mut completion_closure = EffectClosure::new(scenario);
        completion_closure.add_effects(&completion_event.effects);
        let completion_marks_task_ready = completion_closure.contains(|effect| {
            matches!(
                effect,
                Effect::MarkAsyncTaskReady {
                    task: referenced_task
                } if referenced_task == &task.id
            )
        });

        if !completion_trigger_matches || !completion_marks_task_ready {
            report.push(Diagnostic::error(
                DiagnosticCode::AsyncTaskWithoutCompletionPath,
                format!("async_tasks[{task_index}].completion_event"),
                format!(
                    "completion event `{}` must be triggered by completion \
                     of asynchronous task `{}` and mark that task ready",
                    task.completion_event, task.id
                ),
            ));
        }

        // Unknown optional event references are already reported by Phase 1.
        if task
            .usable_until_event
            .as_ref()
            .is_some_and(|event_id| event_by_id(scenario, event_id).is_none())
            || task
                .expiry_event
                .as_ref()
                .is_some_and(|event_id| event_by_id(scenario, event_id).is_none())
        {
            continue;
        }

        let has_review_path = scenario.actions.iter().any(|action| {
            effects_terminalize_async_task(scenario, &action.effects, task.id.as_str(), false)
        }) || scenario.events.iter().any(|event| {
            effects_terminalize_async_task(scenario, &event.effects, task.id.as_str(), false)
        });

        let has_expiry_path = task
            .expiry_event
            .as_ref()
            .and_then(|event_id| event_by_id(scenario, event_id))
            .is_some_and(|event| {
                effects_terminalize_async_task(scenario, &event.effects, task.id.as_str(), true)
            });

        // A usable-until boundary without an expiry event would leave the task
        // in an ambiguous state after it becomes procedurally irrelevant.
        let usable_boundary_is_complete = task.usable_until_event.is_none() || has_expiry_path;

        if !(has_review_path || has_expiry_path) || !usable_boundary_is_complete {
            report.push(Diagnostic::error(
                DiagnosticCode::AsyncTaskWithoutTerminalBoundary,
                format!("async_tasks[{task_index}]"),
                format!(
                    "asynchronous task `{}` must have a review or expiry \
                     path; a usable-until boundary requires an expiry event",
                    task.id
                ),
            ));
        }
    }
}

/// Checks whether the deterministic effect closure reviews or expires a task.
fn effects_terminalize_async_task(
    scenario: &ScenarioDefinition,
    effects: &[Effect],
    task_id: &str,
    accept_expiry: bool,
) -> bool {
    let matches_terminal_effect = |effect: &Effect| {
        matches!(
            effect,
            Effect::ReviewAsyncTask { task }
                if task.as_str() == task_id
        ) || (accept_expiry
            && matches!(
                effect,
                Effect::ExpireAsyncTask { task }
                    if task.as_str() == task_id
            ))
    };

    let mut closure = EffectClosure::new(scenario);
    closure.add_effects(effects);
    closure.contains(matches_terminal_effect)
}

/// Every action-required Inbox item must eventually be resolved.
///
/// Opening an Inbox item is not enough. Resolution must occur through either:
///
/// - one of the declared resolution actions; or
/// - the declared expiry event.
fn validate_required_inbox_items(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    for (item_index, item) in scenario.inbox_items.iter().enumerate() {
        if !item.action_required {
            continue;
        }

        let action_resolves_item = item.resolution_actions.iter().any(|action_id| {
            scenario
                .actions
                .iter()
                .find(|action| action.id == *action_id)
                .is_some_and(|action| {
                    effects_resolve_inbox_item(scenario, &action.effects, item.id.as_str())
                })
        });

        let expiry_resolves_item = item
            .expiry_event
            .as_ref()
            .and_then(|event_id| event_by_id(scenario, event_id))
            .is_some_and(|event| {
                effects_resolve_inbox_item(scenario, &event.effects, item.id.as_str())
            });

        if !action_resolves_item && !expiry_resolves_item {
            report.push(Diagnostic::error(
                DiagnosticCode::RequiredInboxWithoutResolution,
                format!("inbox_items[{item_index}]"),
                format!(
                    "action-required Inbox item `{}` must have an action or \
                     expiry event that resolves it",
                    item.id
                ),
            ));
        }
    }
}

/// Checks whether the deterministic effect closure resolves an Inbox item.
fn effects_resolve_inbox_item(
    scenario: &ScenarioDefinition,
    effects: &[Effect],
    inbox_item_id: &str,
) -> bool {
    let mut closure = EffectClosure::new(scenario);
    closure.add_effects(effects);
    closure.contains(|effect| {
        matches!(
            effect,
            Effect::ResolveInboxItem { item }
                if item.as_str() == inbox_item_id
        )
    })
}

fn event_by_id<'a>(
    scenario: &'a ScenarioDefinition,
    id: &EventId,
) -> Option<&'a juris_scenario_schema::EventDefinition> {
    scenario.events.iter().find(|event| event.id == *id)
}

fn action_by_id<'a>(
    scenario: &'a ScenarioDefinition,
    id: &ActionId,
) -> Option<&'a ActionDefinition> {
    scenario.actions.iter().find(|action| action.id == *id)
}

/// Every deadline must have two explicit terminal paths:
///
/// - completed through an action or completion event;
/// - missed through the declared missed event.
///
/// This prevents deadlines from remaining permanently open after simulated
/// time passes their due point.
fn validate_deadlines(scenario: &ScenarioDefinition, report: &mut ValidationReport) {
    for (deadline_index, deadline) in scenario.deadlines.iter().enumerate() {
        // Unknown references are already reported by reference validation.
        // Avoid emitting secondary lifecycle diagnostics for missing objects.
        let Some(missed_event) = event_by_id(scenario, &deadline.missed_event) else {
            continue;
        };

        let missed_trigger_matches = matches!(
            &missed_event.trigger,
            EventTrigger::DeadlineMissed {
                deadline: referenced_deadline
            } if referenced_deadline == &deadline.id
        );

        let missed_event_marks_deadline_missed = missed_event.effects.iter().any(|effect| {
            matches!(
                effect,
                Effect::MissDeadline {
                    deadline: referenced_deadline
                } if referenced_deadline == &deadline.id
            )
        });

        if !missed_trigger_matches || !missed_event_marks_deadline_missed {
            report.push(Diagnostic::error(
                DiagnosticCode::DeadlineWithoutMissedPath,
                format!("deadlines[{deadline_index}].missed_event"),
                format!(
                    "missed event `{}` must be triggered by deadline `{}` \
                     being missed and must mark that deadline as missed",
                    deadline.missed_event, deadline.id
                ),
            ));
        }

        // Completion actions are authoritative runtime transitions: accepting
        // a listed action completes the open deadline before temporal miss
        // processing. Scenario content does not need to duplicate that generic
        // rule with a case-specific CompleteDeadline effect.
        let completion_action_closes_deadline = !deadline.completion_actions.is_empty();

        let completion_event_closes_deadline = deadline
            .completion_event
            .as_ref()
            .and_then(|event_id| event_by_id(scenario, event_id))
            .is_some_and(|event| {
                event.effects.iter().any(|effect| {
                    matches!(
                        effect,
                        Effect::CompleteDeadline {
                            deadline: referenced_deadline
                        } if referenced_deadline == &deadline.id
                    )
                })
            });

        if !completion_action_closes_deadline && !completion_event_closes_deadline {
            report.push(Diagnostic::error(
                DiagnosticCode::DeadlineWithoutCompletionPath,
                format!("deadlines[{deadline_index}]"),
                format!(
                    "deadline `{}` must have an action or event that marks \
                     it completed",
                    deadline.id
                ),
            ));
        }
    }
}
