//! Regression tests for terminal-state closure validation.

use juris_scenario_schema::{
    ActionDefinition, ActionId, ActionRepeatability, AsyncTaskDefinition, AsyncTaskId,
    AsyncTaskStatus, Condition, DeadlineDefinition, DeadlineId, Effect, EventDefinition, EventId,
    EventKind, EventTrigger, InboxItemDefinition, InboxItemId, ScenarioDefinition, ScenarioTime,
};
use juris_scenario_validator::{validate_scenario, DiagnosticCode};

const MINIMAL_SCENARIO: &str =
    include_str!("../../../content/fixtures/valid/minimal-scenario.yaml");

fn load_minimal_scenario() -> ScenarioDefinition {
    serde_yaml::from_str(MINIMAL_SCENARIO).expect("minimal scenario fixture must deserialize")
}

fn assert_has_error(scenario: &ScenarioDefinition, expected: DiagnosticCode) {
    let report = validate_scenario(scenario);
    let codes = report.error_codes();

    assert!(
        codes.contains(&expected),
        "expected {expected:?}, got diagnostics: {:#?}",
        report.diagnostics
    );
}

#[test]
fn minimal_scenario_passes_terminal_validation() {
    let scenario = load_minimal_scenario();
    let report = validate_scenario(&scenario);

    assert!(
        report.is_valid(),
        "expected valid minimal terminal lifecycle: {:#?}",
        report.diagnostics
    );
}

#[test]
fn resolved_with_pending_task_is_rejected() {
    let mut scenario = load_minimal_scenario();
    let task_id = AsyncTaskId::from("pending-review");

    scenario.actions.push(ActionDefinition {
        id: ActionId::from("start-pending-review"),
        title: "Start pending review".to_owned(),
        description: None,
        available_when: Condition::StageIs {
            stage: scenario.initial_stage.clone(),
        },
        effects: vec![Effect::StartAsyncTask {
            task: task_id.clone(),
        }],
        time_cost_minutes: 5,
        repeatability: ActionRepeatability::Once,
    });

    scenario.actions.push(ActionDefinition {
        id: ActionId::from("review-pending-work"),
        title: "Review pending work".to_owned(),
        description: None,
        available_when: Condition::All {
            conditions: vec![
                Condition::StageIs {
                    stage: scenario.initial_stage.clone(),
                },
                Condition::AsyncTaskStatusIs {
                    task: task_id.clone(),
                    status: AsyncTaskStatus::Ready,
                },
            ],
        },
        effects: vec![Effect::ReviewAsyncTask {
            task: task_id.clone(),
        }],
        time_cost_minutes: 5,
        repeatability: ActionRepeatability::Once,
    });

    scenario.events.push(EventDefinition {
        id: EventId::from("pending-review-completed"),
        title: "Pending review completed".to_owned(),
        kind: EventKind::Generic,
        trigger: EventTrigger::AsyncTaskCompleted {
            task: task_id.clone(),
        },
        condition: Condition::Always,
        effects: vec![Effect::MarkAsyncTaskReady {
            task: task_id.clone(),
        }],
    });

    scenario.async_tasks.push(AsyncTaskDefinition {
        id: task_id,
        title: "Pending review".to_owned(),
        start_action: ActionId::from("start-pending-review"),
        completion_event: EventId::from("pending-review-completed"),
        duration_minutes: 60,
        usable_until_event: None,
        expiry_event: None,
    });

    assert_has_error(&scenario, DiagnosticCode::ResolvedWithPendingTask);
}

#[test]
fn resolved_with_open_deadline_is_rejected() {
    let mut scenario = load_minimal_scenario();
    let deadline_id = DeadlineId::from("open-terminal-deadline");

    scenario.actions.push(ActionDefinition {
        id: ActionId::from("complete-terminal-deadline"),
        title: "Complete terminal deadline".to_owned(),
        description: None,
        available_when: Condition::StageIs {
            stage: scenario.initial_stage.clone(),
        },
        effects: vec![Effect::CompleteDeadline {
            deadline: deadline_id.clone(),
        }],
        time_cost_minutes: 5,
        repeatability: ActionRepeatability::Once,
    });

    scenario.events.push(EventDefinition {
        id: EventId::from("terminal-deadline-missed"),
        title: "Terminal deadline missed".to_owned(),
        kind: EventKind::Generic,
        trigger: EventTrigger::DeadlineMissed {
            deadline: deadline_id.clone(),
        },
        condition: Condition::Always,
        effects: vec![Effect::MissDeadline {
            deadline: deadline_id.clone(),
        }],
    });

    scenario.deadlines.push(DeadlineDefinition {
        id: deadline_id,
        title: "Open terminal deadline".to_owned(),
        due_at: ScenarioTime::new(2, 600),
        activation_event: None,
        completion_actions: vec![ActionId::from("complete-terminal-deadline")],
        completion_event: None,
        missed_event: EventId::from("terminal-deadline-missed"),
    });

    assert_has_error(&scenario, DiagnosticCode::ResolvedWithOpenDeadline);
}

#[test]
fn resolved_with_required_inbox_is_rejected() {
    let mut scenario = load_minimal_scenario();
    let item_id = InboxItemId::from("required-terminal-message");

    scenario.actions.push(ActionDefinition {
        id: ActionId::from("resolve-terminal-message"),
        title: "Resolve terminal message".to_owned(),
        description: None,
        available_when: Condition::StageIs {
            stage: scenario.initial_stage.clone(),
        },
        effects: vec![Effect::ResolveInboxItem {
            item: item_id.clone(),
        }],
        time_cost_minutes: 5,
        repeatability: ActionRepeatability::Once,
    });

    scenario.inbox_items.push(InboxItemDefinition {
        id: item_id,
        subject: "Required response".to_owned(),
        body: "A response is required before closure.".to_owned(),
        created_by_event: None,
        initially_visible: true,
        action_required: true,
        resolution_actions: vec![ActionId::from("resolve-terminal-message")],
        expiry_event: None,
    });

    assert_has_error(&scenario, DiagnosticCode::ResolvedWithRequiredInbox);
}

#[test]
fn resolved_with_available_action_is_rejected() {
    let mut scenario = load_minimal_scenario();
    scenario.actions[0].available_when = Condition::Always;

    assert_has_error(&scenario, DiagnosticCode::ResolvedWithAvailableAction);
}

#[test]
fn resolved_without_outcome_is_rejected() {
    let mut scenario = load_minimal_scenario();

    // Keep the outcome statically reachable through an independent event, but
    // remove it from the deterministic close-matter transition chain.
    scenario.events[0].effects.clear();
    scenario.events.push(EventDefinition {
        id: EventId::from("independent-outcome-resolution"),
        title: "Independent outcome resolution".to_owned(),
        kind: EventKind::Generic,
        trigger: EventTrigger::ScenarioStart,
        condition: Condition::Always,
        effects: vec![Effect::ResolveOutcome {
            outcome: scenario.outcomes[0].id.clone(),
        }],
    });

    assert_has_error(&scenario, DiagnosticCode::ResolvedWithoutOutcome);
}
