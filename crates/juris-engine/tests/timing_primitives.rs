use juris_engine::{ScenarioRuntimeError, ScenarioSession};
use juris_scenario_schema::ScenarioDefinition;
use serde_json::{json, Value};

fn base_value() -> Value {
    json!({
        "schema_version": "1.0",
        "metadata": {
            "id": "timing-primitives",
            "title": "Timing primitives",
            "summary": "Generic civil and relative timing fixture",
            "content_version": "1"
        },
        "jurisdiction": {"code": "TEST", "pack_version": "1"},
        "initial_stage": "open",
        "clock": {"mode": "foreground"},
        "initial_clock": {"day": 0, "minute_of_day": 480},
        "initial_resources": {"authorized_budget_eur": 1000},
        "stages": [
            {
                "id": "open",
                "title": "Open",
                "kind": "standard",
                "exit_actions": ["work", "close"]
            },
            {
                "id": "resolved",
                "title": "Resolved",
                "kind": "resolved",
                "terminal": true
            }
        ],
        "actions": [
            {
                "id": "work",
                "title": "Do the work",
                "available_when": {"type": "stage_is", "stage": "open"},
                "effects": [
                    {"type": "set_flag", "flag": "worked", "value": true}
                ],
                "cost_eur": 100,
                "billable_minutes": 30,
                "completion_deadlines": ["legal_deadline"],
                "repeatability": {"type": "unlimited"}
            },
            {
                "id": "close",
                "title": "Close",
                "available_when": {"type": "stage_is", "stage": "open"},
                "effects": [
                    {"type": "complete_deadline", "deadline": "legal_deadline"},
                    {"type": "set_stage", "stage": "resolved"},
                    {"type": "resolve_outcome", "outcome": "closed"}
                ]
            }
        ],
        "deadlines": [
            {
                "id": "legal_deadline",
                "title": "Legal deadline",
                "due_at": {"day": 0, "minute_of_day": 900},
                "completion_at_due_allowed": true,
                "completion_actions": ["work"],
                "missed_event": "legal_deadline_missed"
            }
        ],
        "async_tasks": [],
        "inbox_items": [],
        "events": [
            {
                "id": "legal_deadline_missed",
                "title": "Legal deadline missed",
                "kind": "generic",
                "trigger": {"type": "deadline_missed", "deadline": "legal_deadline"},
                "condition": {"type": "always"},
                "effects": [
                    {"type": "miss_deadline", "deadline": "legal_deadline"},
                    {"type": "set_flag", "flag": "deadline_missed", "value": true}
                ]
            }
        ],
        "outcomes": [
            {
                "id": "closed",
                "title": "Closed",
                "summary": "Closed",
                "terminal_stage": "resolved",
                "condition": {"type": "stage_is", "stage": "resolved"}
            }
        ]
    })
}

fn definition(value: Value) -> ScenarioDefinition {
    serde_json::from_value(value).expect("timing fixture must deserialize")
}

fn deadline_status(session: &ScenarioSession, id: &str) -> Option<String> {
    session
        .snapshot()
        .deadlines
        .into_iter()
        .find(|deadline| deadline.id == id)
        .and_then(|deadline| deadline.status)
}

#[test]
fn civil_initial_clock_starts_elapsed_at_zero_and_converts_static_due() {
    let session = ScenarioSession::new(definition(base_value()), 1).unwrap();
    let snapshot = session.snapshot();

    assert_eq!(snapshot.clock_minutes, 0);
    assert_eq!(snapshot.deadlines[0].due_at_minutes, 420);
}

#[test]
fn invalid_relative_placeholder_before_baseline_is_rejected_before_snapshot() {
    let mut value = base_value();
    value["deadlines"][0]["due_at"] = json!({"day": 0, "minute_of_day": 0});
    value["deadlines"][0]["relative_due"] = json!({"offset_minutes": 60});

    assert!(matches!(
        ScenarioSession::new(definition(value), 1),
        Err(ScenarioRuntimeError::InvalidScenario(message))
            if message.contains("SCN010_INVALID_SCENARIO_TIME")
    ));
}

#[test]
fn initially_active_relative_deadline_rejects_inactive_relative_anchor() {
    let mut value = base_value();
    value["deadlines"][0]["relative_due"] = json!({"relative_to_deadline": "inactive_anchor"});
    value["deadlines"].as_array_mut().unwrap().push(json!({
        "id": "inactive_anchor",
        "title": "Inactive relative anchor",
        "due_at": {"day": 0, "minute_of_day": 960},
        "relative_due": {"offset_minutes": 60},
        "activation_event": "activate_anchor",
        "completion_actions": ["work"],
        "missed_event": "inactive_anchor_missed"
    }));
    value["events"].as_array_mut().unwrap().extend([
        json!({
            "id": "activate_anchor",
            "title": "Activate anchor",
            "kind": "generic",
            "trigger": {"type": "by_effect"},
            "condition": {"type": "always"},
            "effects": []
        }),
        json!({
            "id": "inactive_anchor_missed",
            "title": "Inactive anchor missed",
            "kind": "generic",
            "trigger": {"type": "deadline_missed", "deadline": "inactive_anchor"},
            "condition": {"type": "always"},
            "effects": [{"type": "miss_deadline", "deadline": "inactive_anchor"}]
        }),
    ]);
    value["actions"][0]["effects"]
        .as_array_mut()
        .unwrap()
        .push(json!({"type": "trigger_event", "event": "activate_anchor"}));
    value["actions"][1]["effects"]
        .as_array_mut()
        .unwrap()
        .insert(
            1,
            json!({"type": "complete_deadline", "deadline": "inactive_anchor"}),
        );

    assert!(matches!(
        ScenarioSession::new(definition(value), 1),
        Err(ScenarioRuntimeError::InvalidScenario(message))
            if message.contains("SCN010_INVALID_SCENARIO_TIME")
    ));
}

#[test]
fn civil_and_relative_calendar_targets_project_elapsed_completion_minutes() {
    let mut same_day = base_value();
    same_day["actions"][0]["completion_timing"] =
        json!({"calendar_target": {"day_offset": 0, "minute_of_day": 1050}});
    same_day["actions"][0]["completion_deadlines"] = json!([]);
    let mut session = ScenarioSession::new(definition(same_day), 1).unwrap();
    let action = session
        .snapshot()
        .available_actions
        .into_iter()
        .find(|action| action.id == "work")
        .unwrap();
    assert_eq!(action.completion_at_minutes, Some(570));
    assert_eq!(session.dispatch("work").unwrap().clock_minutes, 570);

    let mut next_day = base_value();
    next_day["actions"][0]["completion_timing"] =
        json!({"calendar_target": {"day_offset": 1, "minute_of_day": 480}});
    next_day["actions"][0]["completion_deadlines"] = json!([]);
    let session = ScenarioSession::new(definition(next_day), 1).unwrap();
    let action = session
        .snapshot()
        .available_actions
        .into_iter()
        .find(|action| action.id == "work")
        .unwrap();
    assert_eq!(action.completion_at_minutes, Some(1_440));
}

#[test]
fn inclusive_due_accepts_exact_completion_and_rejects_due_plus_one_atomically() {
    let mut exact = ScenarioSession::new(definition(base_value()), 1).unwrap();
    let at_due = exact.advance_time(420).unwrap();
    assert_eq!(at_due.deadlines[0].status.as_deref(), Some("open"));
    assert!(at_due
        .available_actions
        .iter()
        .any(|action| action.id == "work"));
    let completed = exact.dispatch("work").unwrap();
    assert_eq!(completed.clock_minutes, 420);
    assert_eq!(
        deadline_status(&exact, "legal_deadline").as_deref(),
        Some("completed")
    );

    let mut late_value = base_value();
    late_value["actions"][0]["time_cost_minutes"] = json!(1);
    let mut late = ScenarioSession::new(definition(late_value), 1).unwrap();
    late.advance_time(420).unwrap();
    assert!(!late
        .snapshot()
        .available_actions
        .iter()
        .any(|action| action.id == "work"));
    let before_snapshot = late.snapshot();
    let before_save = late.save_json().unwrap();
    assert!(matches!(
        late.dispatch("work"),
        Err(ScenarioRuntimeError::ActionCompletionDeadlineExceeded {
            completion: 421,
            due: 420,
            ..
        })
    ));
    assert_eq!(late.snapshot(), before_snapshot);
    assert_eq!(late.save_json().unwrap(), before_save);
}

#[test]
fn legacy_deadline_policy_misses_at_the_due_minute() {
    let mut value = base_value();
    value["deadlines"][0]["completion_at_due_allowed"] = json!(false);
    let mut session = ScenarioSession::new(definition(value), 1).unwrap();

    let snapshot = session.advance_time(420).unwrap();
    assert_eq!(snapshot.deadlines[0].status.as_deref(), Some("missed"));
    assert_eq!(snapshot.flags.get("deadline_missed"), Some(&true));
}

#[test]
fn legacy_deadline_at_elapsed_zero_is_processed_during_session_creation() {
    let mut value = base_value();
    value["deadlines"][0]["due_at"] = json!({"day": 0, "minute_of_day": 480});
    value["deadlines"][0]["completion_at_due_allowed"] = json!(false);

    let session = ScenarioSession::new(definition(value), 1).unwrap();
    let snapshot = session.snapshot();
    assert_eq!(snapshot.clock_minutes, 0);
    assert_eq!(snapshot.deadlines[0].status.as_deref(), Some("missed"));
    assert_eq!(snapshot.flags.get("deadline_missed"), Some(&true));
}

#[test]
fn advance_to_multiple_open_deadlines_completes_only_the_earliest_target() {
    let mut value = base_value();
    value["actions"][0]["completion_deadlines"] = json!([]);
    value["actions"][0]["advance_to_deadlines"] = json!(["later_deadline", "legal_deadline"]);
    value["actions"][0]["effects"]
        .as_array_mut()
        .unwrap()
        .push(json!({"type": "trigger_event", "event": "observe_open_during_effects"}));
    value["deadlines"].as_array_mut().unwrap().push(json!({
        "id": "later_deadline",
        "title": "Later deadline",
        "due_at": {"day": 0, "minute_of_day": 1000},
        "completion_at_due_allowed": true,
        "completion_actions": ["work"],
        "missed_event": "later_deadline_missed"
    }));
    value["events"].as_array_mut().unwrap().push(json!({
        "id": "later_deadline_missed",
        "title": "Later deadline missed",
        "kind": "generic",
        "trigger": {"type": "deadline_missed", "deadline": "later_deadline"},
        "condition": {"type": "always"},
        "effects": [{"type": "miss_deadline", "deadline": "later_deadline"}]
    }));
    value["events"].as_array_mut().unwrap().push(json!({
        "id": "observe_open_during_effects",
        "title": "Observe open during effects",
        "kind": "generic",
        "trigger": {"type": "by_effect"},
        "condition": {
            "type": "deadline_status_is",
            "deadline": "legal_deadline",
            "status": "open"
        },
        "effects": [
            {"type": "set_flag", "flag": "deadline_open_during_effects", "value": true}
        ]
    }));
    value["actions"][1]["effects"]
        .as_array_mut()
        .unwrap()
        .insert(
            1,
            json!({"type": "complete_deadline", "deadline": "later_deadline"}),
        );

    let mut session = ScenarioSession::new(definition(value), 1).unwrap();
    let action = session
        .snapshot()
        .available_actions
        .into_iter()
        .find(|action| action.id == "work")
        .unwrap();
    assert_eq!(action.completion_at_minutes, Some(420));

    let snapshot = session.dispatch("work").unwrap();
    assert_eq!(snapshot.clock_minutes, 420);
    assert_eq!(
        deadline_status(&session, "legal_deadline").as_deref(),
        Some("completed")
    );
    assert_eq!(
        deadline_status(&session, "later_deadline").as_deref(),
        Some("open")
    );
    assert_eq!(
        snapshot.flags.get("deadline_open_during_effects"),
        Some(&true)
    );
    assert!(!snapshot.flags.contains_key("deadline_missed"));
}

#[test]
fn initial_relative_deadline_resolution_is_independent_of_array_order() {
    let mut value = base_value();
    value["deadlines"].as_array_mut().unwrap().insert(
        0,
        json!({
            "id": "relative_deadline",
            "title": "Relative deadline",
            "due_at": {"day": 0, "minute_of_day": 960},
            "relative_due": {
                "relative_to_deadline": "legal_deadline",
                "offset_minutes": 60
            },
            "completion_at_due_allowed": true,
            "completion_actions": ["work"],
            "missed_event": "relative_deadline_missed"
        }),
    );
    value["events"].as_array_mut().unwrap().push(json!({
        "id": "relative_deadline_missed",
        "title": "Relative deadline missed",
        "kind": "generic",
        "trigger": {"type": "deadline_missed", "deadline": "relative_deadline"},
        "condition": {"type": "always"},
        "effects": [{"type": "miss_deadline", "deadline": "relative_deadline"}]
    }));
    value["actions"][1]["effects"]
        .as_array_mut()
        .unwrap()
        .insert(
            1,
            json!({"type": "complete_deadline", "deadline": "relative_deadline"}),
        );

    let session = ScenarioSession::new(definition(value), 1).unwrap();
    let relative = session
        .snapshot()
        .deadlines
        .into_iter()
        .find(|deadline| deadline.id == "relative_deadline")
        .unwrap();
    assert_eq!(relative.due_at_minutes, 480);
}

#[test]
fn repeatable_activation_recomputes_relative_due_from_action_completion_anchor() {
    let mut value = base_value();
    value["stages"][0]["exit_actions"]
        .as_array_mut()
        .unwrap()
        .push(json!("activate"));
    value["actions"].as_array_mut().unwrap().push(json!({
        "id": "activate",
        "title": "Activate",
        "available_when": {"type": "stage_is", "stage": "open"},
        "effects": [{"type": "trigger_event", "event": "deadline_activated"}],
        "time_cost_minutes": 10,
        "repeatability": {"type": "unlimited"}
    }));
    value["deadlines"].as_array_mut().unwrap().push(json!({
        "id": "relative_deadline",
        "title": "Relative deadline",
        "due_at": {"day": 0, "minute_of_day": 600},
        "relative_due": {"offset_minutes": 60},
        "completion_at_due_allowed": true,
        "activation_event": "deadline_activated",
        "completion_actions": ["work"],
        "missed_event": "relative_deadline_missed"
    }));
    value["events"].as_array_mut().unwrap().extend([
        json!({
            "id": "deadline_activated",
            "title": "Deadline activated",
            "kind": "generic",
            "trigger": {"type": "by_effect"},
            "repeatable": true,
            "condition": {"type": "always"},
            "effects": []
        }),
        json!({
            "id": "relative_deadline_missed",
            "title": "Relative deadline missed",
            "kind": "generic",
            "trigger": {"type": "deadline_missed", "deadline": "relative_deadline"},
            "condition": {"type": "always"},
            "effects": [{"type": "miss_deadline", "deadline": "relative_deadline"}]
        }),
    ]);
    value["actions"][1]["effects"]
        .as_array_mut()
        .unwrap()
        .insert(
            1,
            json!({"type": "complete_deadline", "deadline": "relative_deadline"}),
        );

    let mut session = ScenarioSession::new(definition(value), 1).unwrap();
    session.dispatch("activate").unwrap();
    let first_due = session
        .snapshot()
        .deadlines
        .into_iter()
        .find(|deadline| deadline.id == "relative_deadline")
        .unwrap();
    assert_eq!(first_due.due_at_minutes, 70);

    session.advance_time(50).unwrap();
    session.dispatch("activate").unwrap();
    let second_due = session
        .snapshot()
        .deadlines
        .into_iter()
        .find(|deadline| deadline.id == "relative_deadline")
        .unwrap();
    assert_eq!(second_due.due_at_minutes, 130);
    assert_eq!(second_due.status.as_deref(), Some("open"));
}

#[test]
fn async_completion_honors_forward_calendar_target() {
    let mut value = base_value();
    value["stages"][0]["exit_actions"]
        .as_array_mut()
        .unwrap()
        .extend([json!("start_task"), json!("review_task")]);
    value["actions"].as_array_mut().unwrap().extend([
        json!({
            "id": "start_task",
            "title": "Start task",
            "available_when": {"type": "stage_is", "stage": "open"},
            "effects": [{"type": "start_async_task", "task": "report"}],
            "time_cost_minutes": 10
        }),
        json!({
            "id": "review_task",
            "title": "Review task",
            "available_when": {
                "type": "all",
                "conditions": [
                    {"type": "stage_is", "stage": "open"},
                    {"type": "async_task_status_is", "task": "report", "status": "ready"}
                ]
            },
            "effects": [{"type": "review_async_task", "task": "report"}]
        }),
    ]);
    value["actions"][1]["effects"]
        .as_array_mut()
        .unwrap()
        .insert(1, json!({"type": "expire_async_task", "task": "report"}));
    value["async_tasks"].as_array_mut().unwrap().push(json!({
        "id": "report",
        "title": "Report",
        "start_action": "start_task",
        "completion_event": "report_ready",
        "duration_minutes": 60,
        "completion_timing": {
            "calendar_target": {"day_offset": 1, "minute_of_day": 480}
        }
    }));
    value["events"].as_array_mut().unwrap().push(json!({
        "id": "report_ready",
        "title": "Report ready",
        "kind": "generic",
        "trigger": {"type": "async_task_completed", "task": "report"},
        "condition": {"type": "always"},
        "effects": [{"type": "mark_async_task_ready", "task": "report"}]
    }));

    let mut session = ScenarioSession::new(definition(value), 1).unwrap();
    assert_eq!(session.dispatch("start_task").unwrap().clock_minutes, 10);
    let before = session.advance_time(1_429).unwrap();
    assert!(!before.fired_event_ids.iter().any(|id| id == "report_ready"));
    let ready = session.advance_time(1).unwrap();
    assert_eq!(ready.clock_minutes, 1_440);
    assert!(ready.fired_event_ids.iter().any(|id| id == "report_ready"));
    assert!(ready
        .available_actions
        .iter()
        .any(|action| action.id == "review_task"));
}

#[test]
fn civil_at_time_event_precedes_legacy_deadline_miss_at_same_elapsed_minute() {
    let mut value = base_value();
    value["deadlines"][0]["completion_at_due_allowed"] = json!(false);
    value["events"][0]["condition"] =
        json!({"type": "flag_equals", "flag": "at_time_seen", "value": true});
    value["events"].as_array_mut().unwrap().insert(
        0,
        json!({
            "id": "civil_at_time",
            "title": "Civil at time",
            "kind": "generic",
            "trigger": {"type": "at_time", "at": {"day": 0, "minute_of_day": 900}},
            "condition": {"type": "always"},
            "effects": [{"type": "set_flag", "flag": "at_time_seen", "value": true}]
        }),
    );

    let mut session = ScenarioSession::new(definition(value), 1).unwrap();
    let snapshot = session.advance_time(420).unwrap();
    assert_eq!(snapshot.flags.get("at_time_seen"), Some(&true));
    assert_eq!(snapshot.flags.get("deadline_missed"), Some(&true));
}
