//! Regression tests for scenario lifecycle validation.

use juris_scenario_schema::{
    ActionId, AsyncTaskDefinition, AsyncTaskId, DeadlineDefinition, DeadlineId, Effect,
    EventDefinition, EventId, EventKind, EventTrigger, InboxItemDefinition, InboxItemId,
    ScenarioDefinition, ScenarioTime, StageDefinition, StageId, StageKind,
};
use juris_scenario_validator::{validate_scenario, DiagnosticCode};

const MINIMAL_SCENARIO: &str =
    include_str!("../../../content/fixtures/valid/minimal-scenario.yaml");

fn load_minimal_scenario() -> ScenarioDefinition {
    serde_yaml::from_str(MINIMAL_SCENARIO).expect("minimal scenario fixture must deserialize")
}

#[test]
fn hearing_without_schedule_event_is_rejected() {
    // The hearing stage is reachable and has a valid closing event.
    // The only intentional defect is the absence of a formal
    // HearingScheduled event.
    let mut scenario = load_minimal_scenario();
    let hearing_stage = StageId::from("enterprise-court-hearing");
    let hearing_opened_event = EventId::from("hearing-opened");

    scenario.stages.push(StageDefinition {
        id: hearing_stage.clone(),
        title: "Enterprise Court Hearing".to_owned(),
        kind: StageKind::Hearing,
        entry_event: Some(hearing_opened_event.clone()),
        exit_actions: vec![ActionId::from("close-matter")],
        terminal: false,
    });

    // This makes the hearing stage reachable without satisfying the separate
    // requirement for a formal HearingScheduled event.
    scenario.events.push(EventDefinition {
        id: hearing_opened_event.clone(),
        title: "Hearing opened".to_owned(),
        kind: EventKind::HearingOpened,
        trigger: EventTrigger::AtTime {
            at: ScenarioTime::new(3, 540),
        },
        condition: Default::default(),
        effects: vec![Effect::SetStage {
            stage: hearing_stage,
        }],
    });

    scenario.events.push(EventDefinition {
        id: EventId::from("hearing-closed"),
        title: "Hearing closed".to_owned(),
        kind: EventKind::HearingClosed,
        trigger: EventTrigger::AfterEvent {
            event: hearing_opened_event,
        },
        condition: Default::default(),
        effects: vec![Effect::SetStage {
            stage: StageId::from("resolved"),
        }],
    });

    let report = validate_scenario(&scenario);

    assert_eq!(
        report.error_codes(),
        vec![DiagnosticCode::HearingWithoutScheduleEvent]
    );
}

#[test]
fn hearing_without_terminal_event_is_rejected() {
    // The hearing is formally scheduled and the schedule event makes the
    // hearing stage reachable. The only intentional defect is that no
    // HearingClosed event exits the hearing stage.
    let mut scenario = load_minimal_scenario();
    let hearing_stage = StageId::from("enterprise-court-hearing");

    scenario.stages.push(StageDefinition {
        id: hearing_stage.clone(),
        title: "Enterprise Court Hearing".to_owned(),
        kind: StageKind::Hearing,
        entry_event: Some(EventId::from("hearing-scheduled")),
        exit_actions: vec![ActionId::from("close-matter")],
        terminal: false,
    });

    scenario.events.push(EventDefinition {
        id: EventId::from("hearing-scheduled"),
        title: "Hearing scheduled".to_owned(),
        kind: EventKind::HearingScheduled,
        trigger: EventTrigger::AtTime {
            at: ScenarioTime::new(3, 540),
        },
        condition: Default::default(),
        effects: vec![Effect::SetStage {
            stage: hearing_stage,
        }],
    });

    let report = validate_scenario(&scenario);

    assert_eq!(
        report.error_codes(),
        vec![DiagnosticCode::HearingWithoutTerminalEvent]
    );
}

#[test]
fn hearing_with_schedule_and_terminal_events_is_valid() {
    let mut scenario = load_minimal_scenario();

    let hearing_stage = StageId::from("enterprise-court-hearing");
    let hearing_scheduled_event = EventId::from("hearing-scheduled");

    scenario.stages.push(StageDefinition {
        id: hearing_stage.clone(),
        title: "Enterprise Court Hearing".to_owned(),
        kind: StageKind::Hearing,
        entry_event: Some(hearing_scheduled_event.clone()),
        exit_actions: vec![ActionId::from("close-matter")],
        terminal: false,
    });

    // The timed event is independently reachable and moves the scenario into
    // the hearing stage.
    scenario.events.push(EventDefinition {
        id: hearing_scheduled_event.clone(),
        title: "Hearing scheduled".to_owned(),
        kind: EventKind::HearingScheduled,
        trigger: EventTrigger::AtTime {
            at: ScenarioTime::new(3, 540),
        },
        condition: Default::default(),
        effects: vec![Effect::SetStage {
            stage: hearing_stage,
        }],
    });

    // Closing the hearing enters the terminal stage and triggers the existing
    // matter-closed event, which resolves the fixture's successful outcome.
    scenario.events.push(EventDefinition {
        id: EventId::from("hearing-closed"),
        title: "Hearing closed".to_owned(),
        kind: EventKind::HearingClosed,
        trigger: EventTrigger::AfterEvent {
            event: hearing_scheduled_event,
        },
        condition: Default::default(),
        effects: vec![
            Effect::SetStage {
                stage: StageId::from("resolved"),
            },
            Effect::TriggerEvent {
                event: EventId::from("matter-closed"),
            },
        ],
    });

    let report = validate_scenario(&scenario);

    assert!(
        report.is_valid(),
        "expected valid hearing lifecycle, got: {:#?}",
        report.diagnostics
    );
}

#[test]
fn async_task_without_completion_path_is_rejected() {
    // The task has a valid review path, isolating this test to the defective
    // completion event.
    let mut scenario = load_minimal_scenario();
    let task_id = AsyncTaskId::from("junior-review");

    scenario.actions[0].effects.push(Effect::ReviewAsyncTask {
        task: task_id.clone(),
    });

    scenario.events.push(EventDefinition {
        id: EventId::from("junior-review-completed"),
        title: "Junior review completed".to_owned(),
        kind: EventKind::Generic,

        // Incorrect: completion events for asynchronous tasks must use
        // AsyncTaskCompleted and identify the same task.
        trigger: EventTrigger::AfterAction {
            action: ActionId::from("close-matter"),
        },

        condition: Default::default(),

        // Incorrect: this event does not mark the task Ready.
        effects: Vec::new(),
    });

    scenario.async_tasks.push(AsyncTaskDefinition {
        id: task_id,
        title: "Junior document review".to_owned(),
        start_action: ActionId::from("close-matter"),
        completion_event: EventId::from("junior-review-completed"),
        duration_minutes: 120,
        usable_until_event: None,
        expiry_event: None,
    });

    let report = validate_scenario(&scenario);

    assert_eq!(
        report.error_codes(),
        vec![DiagnosticCode::AsyncTaskWithoutCompletionPath]
    );
}

#[test]
fn async_task_without_terminal_boundary_is_rejected() {
    // The completion path is valid, but the resulting Ready task can never be
    // reviewed or expired.
    let mut scenario = load_minimal_scenario();
    let task_id = AsyncTaskId::from("expert-report");

    scenario.events.push(EventDefinition {
        id: EventId::from("expert-report-completed"),
        title: "Expert report completed".to_owned(),
        kind: EventKind::Generic,
        trigger: EventTrigger::AsyncTaskCompleted {
            task: task_id.clone(),
        },
        condition: Default::default(),
        effects: vec![Effect::MarkAsyncTaskReady {
            task: task_id.clone(),
        }],
    });

    scenario.async_tasks.push(AsyncTaskDefinition {
        id: task_id,
        title: "Independent expert report".to_owned(),
        start_action: ActionId::from("close-matter"),
        completion_event: EventId::from("expert-report-completed"),
        duration_minutes: 240,
        usable_until_event: None,
        expiry_event: None,
    });

    let report = validate_scenario(&scenario);

    assert_eq!(
        report.error_codes(),
        vec![DiagnosticCode::AsyncTaskWithoutTerminalBoundary]
    );
}

#[test]
fn async_task_with_completion_and_review_paths_is_valid() {
    let mut scenario = load_minimal_scenario();
    let task_id = AsyncTaskId::from("valid-expert-report");

    scenario.actions[0].effects.push(Effect::ReviewAsyncTask {
        task: task_id.clone(),
    });

    scenario.events.push(EventDefinition {
        id: EventId::from("valid-expert-report-completed"),
        title: "Valid expert report completed".to_owned(),
        kind: EventKind::Generic,
        trigger: EventTrigger::AsyncTaskCompleted {
            task: task_id.clone(),
        },
        condition: Default::default(),
        effects: vec![Effect::MarkAsyncTaskReady {
            task: task_id.clone(),
        }],
    });

    scenario.async_tasks.push(AsyncTaskDefinition {
        id: task_id,
        title: "Valid independent expert report".to_owned(),
        start_action: ActionId::from("close-matter"),
        completion_event: EventId::from("valid-expert-report-completed"),
        duration_minutes: 180,
        usable_until_event: None,
        expiry_event: None,
    });

    let report = validate_scenario(&scenario);

    assert!(
        report.is_valid(),
        "expected valid asynchronous lifecycle, got: {:#?}",
        report.diagnostics
    );
}

#[test]

fn deadline_without_completion_path_is_rejected() {
    // The missed path is valid, but no action or completion event marks the
    // deadline as completed.
    let mut scenario = load_minimal_scenario();
    let deadline_id = DeadlineId::from("risk-brief-deadline");

    scenario.events.push(EventDefinition {
        id: EventId::from("risk-brief-deadline-missed"),
        title: "Risk brief deadline missed".to_owned(),
        kind: EventKind::Generic,
        trigger: EventTrigger::DeadlineMissed {
            deadline: deadline_id.clone(),
        },
        condition: Default::default(),
        effects: vec![Effect::MissDeadline {
            deadline: deadline_id.clone(),
        }],
    });

    scenario.deadlines.push(DeadlineDefinition {
        id: deadline_id,
        title: "Submit partner risk brief".to_owned(),
        due_at: ScenarioTime::new(2, 720),
        activation_event: None,
        completion_actions: Vec::new(),
        completion_event: None,
        missed_event: EventId::from("risk-brief-deadline-missed"),
    });

    let report = validate_scenario(&scenario);

    assert_eq!(
        report.error_codes(),
        vec![DiagnosticCode::DeadlineWithoutCompletionPath]
    );
}
#[test]
fn deadline_without_missed_path_is_rejected() {
    // The completion path is valid, but the missed event does not mark the
    // deadline as missed.
    let mut scenario = load_minimal_scenario();
    let deadline_id = DeadlineId::from("preservation-deadline");

    scenario.actions[0].effects.push(Effect::CompleteDeadline {
        deadline: deadline_id.clone(),
    });

    scenario.events.push(EventDefinition {
        id: EventId::from("preservation-deadline-missed"),
        title: "Preservation deadline missed".to_owned(),
        kind: EventKind::Generic,
        trigger: EventTrigger::DeadlineMissed {
            deadline: deadline_id.clone(),
        },
        condition: Default::default(),
        effects: Vec::new(),
    });

    scenario.deadlines.push(DeadlineDefinition {
        id: deadline_id,
        title: "Preserve relevant evidence".to_owned(),
        due_at: ScenarioTime::new(1, 600),
        activation_event: None,
        completion_actions: vec![ActionId::from("close-matter")],
        completion_event: None,
        missed_event: EventId::from("preservation-deadline-missed"),
    });

    let report = validate_scenario(&scenario);

    assert_eq!(
        report.error_codes(),
        vec![DiagnosticCode::DeadlineWithoutMissedPath]
    );
}
#[test]
fn required_inbox_item_without_resolution_is_rejected() {
    // This reproduces the defect where an ACTION REQUIRED message remained
    // active even though no action or expiry event could resolve it.
    let mut scenario = load_minimal_scenario();

    scenario.inbox_items.push(InboxItemDefinition {
        id: InboxItemId::from("orphan-required-message"),
        subject: "Client response required".to_owned(),
        body: "The player must respond, but no resolution path exists.".to_owned(),
        created_by_event: None,
        initially_visible: true,
        action_required: true,
        resolution_actions: Vec::new(),
        expiry_event: None,
    });

    let report = validate_scenario(&scenario);

    assert_eq!(
        report.error_codes(),
        vec![DiagnosticCode::RequiredInboxWithoutResolution]
    );
}
