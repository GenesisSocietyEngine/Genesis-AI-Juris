//! Validation of every typed cross-reference in ScenarioDefinition v1.

use crate::{Diagnostic, DiagnosticCode, ScenarioIndex, ValidationReport};
use juris_scenario_schema::{Condition, Effect, EventTrigger, ScenarioDefinition};

pub(crate) fn validate_references(
    scenario: &ScenarioDefinition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
) {
    validate_fact_references(scenario, index, report);
    validate_evidence_references(scenario, index, report);
    validate_stage_references(scenario, index, report);
    validate_action_references(scenario, index, report);
    validate_deadline_references(scenario, index, report);
    validate_async_task_references(scenario, index, report);
    validate_inbox_references(scenario, index, report);
    validate_event_references(scenario, index, report);
    validate_outcome_references(scenario, index, report);
}

fn validate_fact_references(
    scenario: &ScenarioDefinition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
) {
    for (fact_index, fact) in scenario.facts.iter().enumerate() {
        for (actor_index, actor) in fact.related_actors.iter().enumerate() {
            require_reference(
                index.has_actor(actor.as_str()),
                DiagnosticCode::UnknownActorReference,
                format!("facts[{fact_index}].related_actors[{actor_index}]"),
                "actor",
                actor.as_str(),
                report,
            );
        }
    }
}

fn validate_evidence_references(
    scenario: &ScenarioDefinition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
) {
    for (evidence_index, evidence) in scenario.evidence.iter().enumerate() {
        for (fact_index, fact) in evidence.supports_facts.iter().enumerate() {
            require_reference(
                index.has_fact(fact.as_str()),
                DiagnosticCode::UnknownFactReference,
                format!("evidence[{evidence_index}].supports_facts[{fact_index}]"),
                "fact",
                fact.as_str(),
                report,
            );
        }

        for (fact_index, fact) in evidence.contradicts_facts.iter().enumerate() {
            require_reference(
                index.has_fact(fact.as_str()),
                DiagnosticCode::UnknownFactReference,
                format!("evidence[{evidence_index}].contradicts_facts[{fact_index}]"),
                "fact",
                fact.as_str(),
                report,
            );
        }
    }
}

fn validate_stage_references(
    scenario: &ScenarioDefinition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
) {
    for (stage_index, stage) in scenario.stages.iter().enumerate() {
        if let Some(event) = &stage.entry_event {
            require_reference(
                index.has_event(event.as_str()),
                DiagnosticCode::UnknownEventReference,
                format!("stages[{stage_index}].entry_event"),
                "event",
                event.as_str(),
                report,
            );
        }

        for (action_index, action) in stage.exit_actions.iter().enumerate() {
            require_reference(
                index.has_action(action.as_str()),
                DiagnosticCode::UnknownActionReference,
                format!("stages[{stage_index}].exit_actions[{action_index}]"),
                "action",
                action.as_str(),
                report,
            );
        }
    }
}

fn validate_action_references(
    scenario: &ScenarioDefinition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
) {
    for (action_index, action) in scenario.actions.iter().enumerate() {
        validate_condition(
            &action.available_when,
            index,
            report,
            &format!("actions[{action_index}].available_when"),
        );

        for (effect_index, effect) in action.effects.iter().enumerate() {
            validate_effect(
                effect,
                index,
                report,
                &format!("actions[{action_index}].effects[{effect_index}]"),
            );
        }
    }
}

fn validate_deadline_references(
    scenario: &ScenarioDefinition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
) {
    for (deadline_index, deadline) in scenario.deadlines.iter().enumerate() {
        if let Some(event) = &deadline.activation_event {
            require_reference(
                index.has_event(event.as_str()),
                DiagnosticCode::UnknownEventReference,
                format!("deadlines[{deadline_index}].activation_event"),
                "event",
                event.as_str(),
                report,
            );
        }

        for (action_index, action) in deadline.completion_actions.iter().enumerate() {
            require_reference(
                index.has_action(action.as_str()),
                DiagnosticCode::UnknownActionReference,
                format!("deadlines[{deadline_index}].completion_actions[{action_index}]"),
                "action",
                action.as_str(),
                report,
            );
        }

        if let Some(event) = &deadline.completion_event {
            require_reference(
                index.has_event(event.as_str()),
                DiagnosticCode::UnknownEventReference,
                format!("deadlines[{deadline_index}].completion_event"),
                "event",
                event.as_str(),
                report,
            );
        }

        require_reference(
            index.has_event(deadline.missed_event.as_str()),
            DiagnosticCode::UnknownEventReference,
            format!("deadlines[{deadline_index}].missed_event"),
            "event",
            deadline.missed_event.as_str(),
            report,
        );
    }
}

fn validate_async_task_references(
    scenario: &ScenarioDefinition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
) {
    for (task_index, task) in scenario.async_tasks.iter().enumerate() {
        require_reference(
            index.has_action(task.start_action.as_str()),
            DiagnosticCode::UnknownActionReference,
            format!("async_tasks[{task_index}].start_action"),
            "action",
            task.start_action.as_str(),
            report,
        );

        require_reference(
            index.has_event(task.completion_event.as_str()),
            DiagnosticCode::UnknownEventReference,
            format!("async_tasks[{task_index}].completion_event"),
            "event",
            task.completion_event.as_str(),
            report,
        );

        if let Some(event) = &task.usable_until_event {
            require_reference(
                index.has_event(event.as_str()),
                DiagnosticCode::UnknownEventReference,
                format!("async_tasks[{task_index}].usable_until_event"),
                "event",
                event.as_str(),
                report,
            );
        }

        if let Some(event) = &task.expiry_event {
            require_reference(
                index.has_event(event.as_str()),
                DiagnosticCode::UnknownEventReference,
                format!("async_tasks[{task_index}].expiry_event"),
                "event",
                event.as_str(),
                report,
            );
        }
    }
}

fn validate_inbox_references(
    scenario: &ScenarioDefinition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
) {
    for (item_index, item) in scenario.inbox_items.iter().enumerate() {
        if let Some(event) = &item.created_by_event {
            require_reference(
                index.has_event(event.as_str()),
                DiagnosticCode::UnknownEventReference,
                format!("inbox_items[{item_index}].created_by_event"),
                "event",
                event.as_str(),
                report,
            );
        }

        for (action_index, action) in item.resolution_actions.iter().enumerate() {
            require_reference(
                index.has_action(action.as_str()),
                DiagnosticCode::UnknownActionReference,
                format!("inbox_items[{item_index}].resolution_actions[{action_index}]"),
                "action",
                action.as_str(),
                report,
            );
        }

        if let Some(event) = &item.expiry_event {
            require_reference(
                index.has_event(event.as_str()),
                DiagnosticCode::UnknownEventReference,
                format!("inbox_items[{item_index}].expiry_event"),
                "event",
                event.as_str(),
                report,
            );
        }
    }
}

fn validate_event_references(
    scenario: &ScenarioDefinition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
) {
    for (event_index, event) in scenario.events.iter().enumerate() {
        validate_event_trigger(
            &event.trigger,
            index,
            report,
            &format!("events[{event_index}].trigger"),
        );

        validate_condition(
            &event.condition,
            index,
            report,
            &format!("events[{event_index}].condition"),
        );

        for (effect_index, effect) in event.effects.iter().enumerate() {
            validate_effect(
                effect,
                index,
                report,
                &format!("events[{event_index}].effects[{effect_index}]"),
            );
        }
    }
}

fn validate_outcome_references(
    scenario: &ScenarioDefinition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
) {
    for (outcome_index, outcome) in scenario.outcomes.iter().enumerate() {
        require_reference(
            index.has_stage(outcome.terminal_stage.as_str()),
            DiagnosticCode::UnknownStageReference,
            format!("outcomes[{outcome_index}].terminal_stage"),
            "stage",
            outcome.terminal_stage.as_str(),
            report,
        );

        validate_condition(
            &outcome.condition,
            index,
            report,
            &format!("outcomes[{outcome_index}].condition"),
        );
    }
}

fn validate_condition(
    condition: &Condition,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
    path: &str,
) {
    match condition {
        Condition::Always | Condition::FlagEquals { .. } | Condition::JudicialResultIs { .. } => {}

        Condition::StageIs { stage } => require_reference(
            index.has_stage(stage.as_str()),
            DiagnosticCode::UnknownStageReference,
            format!("{path}.stage"),
            "stage",
            stage.as_str(),
            report,
        ),

        Condition::FactStatusIs { fact, .. } => require_reference(
            index.has_fact(fact.as_str()),
            DiagnosticCode::UnknownFactReference,
            format!("{path}.fact"),
            "fact",
            fact.as_str(),
            report,
        ),

        Condition::EvidenceAvailable { evidence } => require_reference(
            index.has_evidence(evidence.as_str()),
            DiagnosticCode::UnknownEvidenceReference,
            format!("{path}.evidence"),
            "evidence",
            evidence.as_str(),
            report,
        ),

        Condition::DeadlineStatusIs { deadline, .. } => require_reference(
            index.has_deadline(deadline.as_str()),
            DiagnosticCode::UnknownDeadlineReference,
            format!("{path}.deadline"),
            "deadline",
            deadline.as_str(),
            report,
        ),

        Condition::AsyncTaskStatusIs { task, .. } => require_reference(
            index.has_async_task(task.as_str()),
            DiagnosticCode::UnknownAsyncTaskReference,
            format!("{path}.task"),
            "asynchronous task",
            task.as_str(),
            report,
        ),

        Condition::InboxItemResolved { item } => require_reference(
            index.has_inbox_item(item.as_str()),
            DiagnosticCode::UnknownInboxItemReference,
            format!("{path}.item"),
            "Inbox item",
            item.as_str(),
            report,
        ),

        Condition::All { conditions } | Condition::Any { conditions } => {
            for (condition_index, nested) in conditions.iter().enumerate() {
                validate_condition(
                    nested,
                    index,
                    report,
                    &format!("{path}.conditions[{condition_index}]"),
                );
            }
        }

        Condition::Not { condition } => {
            validate_condition(condition, index, report, &format!("{path}.condition"));
        }
    }
}

fn validate_effect(
    effect: &Effect,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
    path: &str,
) {
    match effect {
        Effect::SetStage { stage } => require_reference(
            index.has_stage(stage.as_str()),
            DiagnosticCode::UnknownStageReference,
            format!("{path}.stage"),
            "stage",
            stage.as_str(),
            report,
        ),

        Effect::SetFlag { .. } | Effect::SetJudicialResult { .. } => {}

        Effect::SetFactStatus { fact, .. } => require_reference(
            index.has_fact(fact.as_str()),
            DiagnosticCode::UnknownFactReference,
            format!("{path}.fact"),
            "fact",
            fact.as_str(),
            report,
        ),

        Effect::MakeEvidenceAvailable { evidence } => require_reference(
            index.has_evidence(evidence.as_str()),
            DiagnosticCode::UnknownEvidenceReference,
            format!("{path}.evidence"),
            "evidence",
            evidence.as_str(),
            report,
        ),

        Effect::StartAsyncTask { task }
        | Effect::MarkAsyncTaskReady { task }
        | Effect::ReviewAsyncTask { task }
        | Effect::ExpireAsyncTask { task } => require_reference(
            index.has_async_task(task.as_str()),
            DiagnosticCode::UnknownAsyncTaskReference,
            format!("{path}.task"),
            "asynchronous task",
            task.as_str(),
            report,
        ),

        Effect::CompleteDeadline { deadline } | Effect::MissDeadline { deadline } => {
            require_reference(
                index.has_deadline(deadline.as_str()),
                DiagnosticCode::UnknownDeadlineReference,
                format!("{path}.deadline"),
                "deadline",
                deadline.as_str(),
                report,
            )
        }

        Effect::CreateInboxItem { item } | Effect::ResolveInboxItem { item } => require_reference(
            index.has_inbox_item(item.as_str()),
            DiagnosticCode::UnknownInboxItemReference,
            format!("{path}.item"),
            "Inbox item",
            item.as_str(),
            report,
        ),

        Effect::TriggerEvent { event } => require_reference(
            index.has_event(event.as_str()),
            DiagnosticCode::UnknownEventReference,
            format!("{path}.event"),
            "event",
            event.as_str(),
            report,
        ),

        Effect::ResolveOutcome { outcome } => require_reference(
            index.has_outcome(outcome.as_str()),
            DiagnosticCode::UnknownOutcomeReference,
            format!("{path}.outcome"),
            "outcome",
            outcome.as_str(),
            report,
        ),
    }
}

fn validate_event_trigger(
    trigger: &EventTrigger,
    index: &ScenarioIndex,
    report: &mut ValidationReport,
    path: &str,
) {
    match trigger {
        EventTrigger::ScenarioStart | EventTrigger::AtTime { .. } | EventTrigger::ByEffect => {}

        EventTrigger::AfterAction { action } => require_reference(
            index.has_action(action.as_str()),
            DiagnosticCode::UnknownActionReference,
            format!("{path}.action"),
            "action",
            action.as_str(),
            report,
        ),

        EventTrigger::AfterEvent { event } => require_reference(
            index.has_event(event.as_str()),
            DiagnosticCode::UnknownEventReference,
            format!("{path}.event"),
            "event",
            event.as_str(),
            report,
        ),

        EventTrigger::AsyncTaskCompleted { task } => require_reference(
            index.has_async_task(task.as_str()),
            DiagnosticCode::UnknownAsyncTaskReference,
            format!("{path}.task"),
            "asynchronous task",
            task.as_str(),
            report,
        ),

        EventTrigger::DeadlineMissed { deadline } => require_reference(
            index.has_deadline(deadline.as_str()),
            DiagnosticCode::UnknownDeadlineReference,
            format!("{path}.deadline"),
            "deadline",
            deadline.as_str(),
            report,
        ),
    }
}

fn require_reference(
    exists: bool,
    code: DiagnosticCode,
    path: impl Into<String>,
    entity_kind: &str,
    id: &str,
    report: &mut ValidationReport,
) {
    if !exists {
        report.push(Diagnostic::error(
            code,
            path,
            format!("unknown {entity_kind} reference `{id}`"),
        ));
    }
}
