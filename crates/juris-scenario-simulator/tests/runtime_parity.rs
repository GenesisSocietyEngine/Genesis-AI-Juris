use std::{fs, path::PathBuf};

use juris_engine::ScenarioSession;
use juris_scenario_schema::ScenarioDefinition;
use juris_scenario_simulator::{
    ScenarioDocument, ScenarioSimulator, ScenarioTraceCommand, TraceKind,
};
use serde_json::{json, Value};

fn run_both(
    value: Value,
    seed: u64,
    commands: &[ScenarioTraceCommand],
) -> (
    juris_scenario_simulator::SimulationResult,
    juris_engine::MobileScenarioSnapshot,
) {
    let definition: ScenarioDefinition =
        serde_json::from_value(value.clone()).expect("typed scenario must parse");
    let simulated = ScenarioSimulator::new_with_seed(
        ScenarioDocument::from_value(value).expect("document must parse"),
        seed,
    )
    .expect("simulator must initialize")
    .run_commands(commands, false)
    .expect("simulator path must run");
    let mut authoritative =
        ScenarioSession::new(definition, seed).expect("authoritative runtime must initialize");
    for command in commands {
        match command {
            ScenarioTraceCommand::Dispatch { action_id } => {
                authoritative
                    .dispatch(action_id)
                    .expect("authoritative action must run");
            }
            ScenarioTraceCommand::AdvanceTime { minutes } => {
                authoritative
                    .advance_time(*minutes)
                    .expect("authoritative time must advance");
            }
        }
    }
    (simulated, authoritative.snapshot())
}

fn assert_core_parity(
    simulated: &juris_scenario_simulator::SimulationResult,
    authoritative: &juris_engine::MobileScenarioSnapshot,
) {
    assert_eq!(simulated.final_state.stage, authoritative.stage_id);
    assert_eq!(
        simulated.final_state.clock_minutes,
        authoritative.clock_minutes
    );
    assert_eq!(simulated.final_state.flags, authoritative.flags);
    assert_eq!(
        simulated.final_state.numeric_metrics,
        authoritative.numeric_metrics.clone().unwrap_or_default()
    );
    assert_eq!(
        simulated.final_state.resources,
        authoritative.resources.clone().unwrap_or_default()
    );
    assert_eq!(simulated.fired_events, authoritative.fired_event_ids);
    assert_eq!(
        simulated.final_state.resolved_outcome,
        authoritative.resolved_outcome
    );
}

fn parity_scenario() -> Value {
    let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../content/fixtures/authoring/scenario_path_valid.json");
    let mut value: Value =
        serde_json::from_slice(&fs::read(fixture).expect("fixture must be readable"))
            .expect("fixture must parse");

    value["clock"] = json!({"mode": "foreground"});
    value["numeric_metrics"] = json!({
        "decision_score": 0,
        "idle_minutes": 0,
        "warning_count": 0
    });
    value["foreground_metric_rates"] = json!({"idle_minutes": 1});
    value["initial_resources"] = json!({
        "authorized_budget_eur": 10_000,
        "spend_eur": 0,
        "billable_minutes": 0
    });
    value["deterministic_decisions"] = json!([{
        "id": "seeded_score",
        "roll_range": 1,
        "score_terms": [{
            "operand": {"source": "metric", "metric": "decision_score"},
            "multiplier": 2
        }],
        "branches": [{
            "id": "only_branch",
            "minimum_total": 0,
            "effects": [
                {"type": "add_metric", "metric": "decision_score", "amount": 2},
                {"type": "set_flag", "flag": "decision_resolved", "value": true}
            ]
        }]
    }]);

    let first_action = value["actions"]
        .as_array_mut()
        .expect("actions must be an array")
        .first_mut()
        .expect("fixture must contain an action");
    first_action["cost_eur"] = json!(300);
    first_action["billable_minutes"] = json!(20);
    first_action["effects"]
        .as_array_mut()
        .expect("effects must be an array")
        .extend([
            json!({"type": "add_metric", "metric": "decision_score", "amount": 5}),
            json!({"type": "resolve_deterministic_decision", "decision": "seeded_score"}),
        ]);

    value["events"]
        .as_array_mut()
        .expect("events must be an array")
        .push(json!({
            "id": "idle_warning",
            "title": "Idle warning",
            "kind": "generic",
            "trigger": {
                "type": "metric_threshold_reached",
                "metric": "idle_minutes",
                "threshold": 3
            },
            "repeatable": true,
            "effects": [
                {"type": "add_metric", "metric": "warning_count", "amount": 1},
                {"type": "set_metric", "metric": "idle_minutes", "value": 0}
            ]
        }));
    value
}

#[test]
fn simulator_matches_authoritative_engine_for_generic_integer_runtime() {
    let value = parity_scenario();
    let commands = [
        ScenarioTraceCommand::Dispatch {
            action_id: "file_claim".to_owned(),
        },
        ScenarioTraceCommand::AdvanceTime { minutes: 6 },
    ];
    let seed = 42;

    let (simulated, authoritative) = run_both(value, seed, &commands);
    assert_core_parity(&simulated, &authoritative);

    assert_eq!(simulated.final_state.numeric_metrics["decision_score"], 7);
    assert_eq!(simulated.final_state.numeric_metrics["warning_count"], 2);
    assert_eq!(simulated.final_state.numeric_metrics["idle_minutes"], 0);
    assert_eq!(simulated.final_state.resources["spend_eur"], 300);
    assert_eq!(simulated.final_state.resources["billable_minutes"], 20);
    assert_eq!(
        simulated
            .trace
            .iter()
            .filter(|entry| entry.kind == TraceKind::Event && entry.id == "idle_warning")
            .count(),
        2,
        "a reset metric at a later boundary must re-arm its repeatable threshold event"
    );
}

fn inactivity_threshold_scenario() -> Value {
    let mut value = parity_scenario();
    value["numeric_metrics"] = json!({
        "decision_score": 0,
        "idle_minutes": 0,
        "warning_count": 0,
        "first_hits": 0,
        "final_hits": 0,
        "termination_hits": 0
    });
    let events = value["events"]
        .as_array_mut()
        .expect("events must be an array");
    events.retain(|event| event["id"] != "idle_warning");
    events.extend([
        json!({
            "id": "idle_first_warning",
            "title": "First warning",
            "kind": "generic",
            "trigger": {"type": "metric_threshold_reached", "metric": "idle_minutes", "threshold": 180},
            "repeatable": true,
            "effects": [{"type": "add_metric", "metric": "first_hits", "amount": 1}]
        }),
        json!({
            "id": "idle_final_warning",
            "title": "Final warning",
            "kind": "generic",
            "trigger": {"type": "metric_threshold_reached", "metric": "idle_minutes", "threshold": 300},
            "repeatable": true,
            "effects": [{"type": "add_metric", "metric": "final_hits", "amount": 1}]
        }),
        json!({
            "id": "idle_termination",
            "title": "Termination",
            "kind": "generic",
            "trigger": {"type": "metric_threshold_reached", "metric": "idle_minutes", "threshold": 480},
            "repeatable": true,
            "effects": [{"type": "add_metric", "metric": "termination_hits", "amount": 1}]
        }),
    ]);
    value["actions"]
        .as_array_mut()
        .expect("actions must be an array")
        .push(json!({
            "id": "reset_idle",
            "title": "Reset idle clock",
            "available_when": {"type": "stage_is", "stage": "intake"},
            "effects": [{"type": "set_metric", "metric": "idle_minutes", "value": 0}],
            "time_cost_minutes": 30,
            "billable_minutes": 0
        }));
    value["stages"][0]["exit_actions"]
        .as_array_mut()
        .expect("exit actions must be an array")
        .push(json!("reset_idle"));
    value
}

#[test]
fn foreground_threshold_boundaries_and_rearming_match_the_engine() {
    let value = inactivity_threshold_scenario();
    for (minutes, expected) in [
        (179, (0, 0, 0)),
        (180, (1, 0, 0)),
        (300, (1, 1, 0)),
        (480, (1, 1, 1)),
    ] {
        let commands = [ScenarioTraceCommand::AdvanceTime { minutes }];
        let (simulated, authoritative) = run_both(value.clone(), 11, &commands);
        assert_core_parity(&simulated, &authoritative);
        let metrics = &simulated.final_state.numeric_metrics;
        assert_eq!(
            (
                metrics["first_hits"],
                metrics["final_hits"],
                metrics["termination_hits"]
            ),
            expected,
            "unexpected threshold state at minute {minutes}"
        );
    }

    let commands = [
        ScenarioTraceCommand::AdvanceTime { minutes: 180 },
        ScenarioTraceCommand::Dispatch {
            action_id: "reset_idle".to_owned(),
        },
        ScenarioTraceCommand::AdvanceTime { minutes: 180 },
    ];
    let (simulated, authoritative) = run_both(value, 11, &commands);
    assert_core_parity(&simulated, &authoritative);
    assert_eq!(simulated.final_state.clock_minutes, 390);
    assert_eq!(simulated.final_state.numeric_metrics["idle_minutes"], 180);
    assert_eq!(simulated.final_state.numeric_metrics["first_hits"], 2);
    assert_eq!(simulated.final_state.resources["billable_minutes"], 0);
    assert_eq!(
        simulated
            .trace
            .iter()
            .filter(|entry| entry.kind == TraceKind::Event && entry.id == "idle_first_warning")
            .count(),
        2
    );
}

fn same_minute_priority_scenario() -> Value {
    let mut value = inactivity_threshold_scenario();
    value["deadlines"] = json!([{
        "id": "procedural_deadline",
        "title": "Procedural deadline",
        "due_at": {"day": 0, "minute_of_day": 480},
        "completion_actions": ["complete_procedure"],
        "missed_event": "procedural_default"
    }]);
    value["actions"]
        .as_array_mut()
        .expect("actions must be an array")
        .push(json!({
            "id": "complete_procedure",
            "title": "Complete procedure",
            "available_when": {"type": "stage_is", "stage": "intake"},
            "effects": [{"type": "complete_deadline", "deadline": "procedural_deadline"}]
        }));
    value["stages"][0]["exit_actions"]
        .as_array_mut()
        .expect("exit actions must be an array")
        .push(json!("complete_procedure"));
    value["events"]
        .as_array_mut()
        .expect("events must be an array")
        .push(json!({
            "id": "procedural_default",
            "title": "Procedural default",
            "kind": "matter_closed",
            "trigger": {"type": "deadline_missed", "deadline": "procedural_deadline"},
            "effects": [
                {"type": "miss_deadline", "deadline": "procedural_deadline"},
                {"type": "set_flag", "flag": "deadline_won_priority", "value": true},
                {"type": "set_stage", "stage": "resolved"},
                {"type": "resolve_outcome", "outcome": "procedural_default"}
            ]
        }));
    value["outcomes"]
        .as_array_mut()
        .expect("outcomes must be an array")
        .push(json!({
            "id": "procedural_default",
            "title": "Procedural default",
            "summary": "The deadline takes precedence.",
            "terminal_stage": "resolved",
            "condition": {"type": "flag_equals", "flag": "deadline_won_priority", "value": true}
        }));
    for action in value["actions"]
        .as_array_mut()
        .expect("actions must be an array")
    {
        let enters_resolved = action["effects"]
            .as_array()
            .into_iter()
            .flatten()
            .any(|effect| effect["type"] == "set_stage" && effect["stage"] == "resolved");
        if enters_resolved {
            action["effects"]
                .as_array_mut()
                .expect("effects must be an array")
                .insert(
                    0,
                    json!({"type": "complete_deadline", "deadline": "procedural_deadline"}),
                );
        }
    }
    value
}

#[test]
fn same_minute_deadline_precedes_foreground_thresholds() {
    let commands = [ScenarioTraceCommand::AdvanceTime { minutes: 480 }];
    let (simulated, authoritative) = run_both(same_minute_priority_scenario(), 5, &commands);
    assert_core_parity(&simulated, &authoritative);

    assert_eq!(
        simulated.final_state.resolved_outcome.as_deref(),
        Some("procedural_default")
    );
    assert_eq!(simulated.final_state.numeric_metrics["termination_hits"], 0);
    assert!(simulated
        .trace
        .iter()
        .all(|entry| entry.id != "idle_termination"));
}

fn timing_parity_scenario(completion_at_due_allowed: bool) -> Value {
    let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../content/fixtures/authoring/scenario_path_valid.json");
    let mut value: Value =
        serde_json::from_slice(&fs::read(fixture).expect("fixture must be readable"))
            .expect("fixture must parse");

    value["clock"] = json!({"mode": "foreground"});
    value["initial_clock"] = json!({"day": 3, "minute_of_day": 480});
    value["deadlines"] = json!([
        {
            "id": "z_relative_deadline",
            "title": "Relative deadline",
            "due_at": {"day": 3, "minute_of_day": 660},
            "relative_due": {
                "relative_to_deadline": "a_exact_deadline",
                "offset_minutes": 60
            },
            "completion_actions": ["respond_to_relative_deadline"],
            "missed_event": "relative_deadline_missed",
            "completion_at_due_allowed": true
        },
        {
            "id": "a_exact_deadline",
            "title": "Exact deadline",
            "due_at": {"day": 3, "minute_of_day": 600},
            "completion_actions": ["wait_until_exact_deadline"],
            "missed_event": "exact_deadline_missed",
            "completion_at_due_allowed": completion_at_due_allowed
        },
        {
            "id": "activated_relative_deadline",
            "title": "Activated relative deadline",
            "due_at": {"day": 3, "minute_of_day": 510},
            "activation_event": "timed_task_ready",
            "relative_due": {"offset_minutes": 30},
            "completion_actions": ["respond_to_relative_deadline"],
            "missed_event": "activated_deadline_missed",
            "completion_at_due_allowed": true
        }
    ]);
    value["async_tasks"] = json!([{
        "id": "timed_task",
        "title": "Timed task",
        "start_action": "start_timed_task",
        "completion_event": "timed_task_ready",
        "duration_minutes": 10,
        "completion_timing": {"offset_minutes": 100}
    }]);
    value["deterministic_decisions"] = json!([{
        "id": "observe_selected_deadline_before_clock",
        "roll_range": 1,
        "branches": [
            {
                "id": "open_before_clock",
                "condition": {
                    "type": "deadline_status_is",
                    "deadline": "a_exact_deadline",
                    "status": "open"
                },
                "effects": [
                    {"type": "set_flag", "flag": "deadline_open_during_action_effects", "value": true}
                ]
            },
            {
                "id": "completed_before_clock",
                "condition": {
                    "type": "deadline_status_is",
                    "deadline": "a_exact_deadline",
                    "status": "completed"
                },
                "effects": [
                    {"type": "set_flag", "flag": "deadline_completed_during_action_effects", "value": true}
                ]
            }
        ]
    }]);

    let terminal_action = value["actions"]
        .as_array_mut()
        .expect("actions must be an array")
        .iter_mut()
        .find(|action| action["id"] == "accept_judgment")
        .expect("fixture must contain its terminal action");
    let terminal_effects = terminal_action["effects"]
        .as_array_mut()
        .expect("effects must be an array");
    terminal_effects.splice(
        0..0,
        [
            json!({"type": "expire_async_task", "task": "timed_task"}),
            json!({"type": "complete_deadline", "deadline": "z_relative_deadline"}),
            json!({"type": "complete_deadline", "deadline": "a_exact_deadline"}),
            json!({"type": "complete_deadline", "deadline": "activated_relative_deadline"}),
        ],
    );

    let actions = value["actions"]
        .as_array_mut()
        .expect("actions must be an array");
    actions.extend([
        json!({
            "id": "wait_until_exact_deadline",
            "title": "Wait until exact deadline",
            "available_when": {"type": "stage_is", "stage": "intake"},
            "effects": [
                {"type": "resolve_deterministic_decision", "decision": "observe_selected_deadline_before_clock"}
            ],
            "advance_to_deadlines": ["z_relative_deadline", "a_exact_deadline"]
        }),
        json!({
            "id": "respond_to_relative_deadline",
            "title": "Respond to relative deadline",
            "available_when": {"type": "stage_is", "stage": "intake"},
            "effects": []
        }),
        json!({
            "id": "rest_until_next_workday",
            "title": "Rest until next workday",
            "available_when": {"type": "stage_is", "stage": "intake"},
            "effects": [],
            "completion_timing": {
                "calendar_target": {"day_offset": 1, "minute_of_day": 480}
            }
        }),
        json!({
            "id": "start_timed_task",
            "title": "Start timed task",
            "available_when": {"type": "stage_is", "stage": "intake"},
            "effects": [{"type": "start_async_task", "task": "timed_task"}],
            "time_cost_minutes": 60
        }),
        json!({
            "id": "review_timed_task",
            "title": "Review timed task",
            "available_when": {
                "type": "all",
                "conditions": [
                    {"type": "stage_is", "stage": "intake"},
                    {"type": "async_task_status_is", "task": "timed_task", "status": "ready"}
                ]
            },
            "effects": [{"type": "review_async_task", "task": "timed_task"}]
        }),
    ]);
    value["stages"][0]["exit_actions"]
        .as_array_mut()
        .expect("exit actions must be an array")
        .extend([
            json!("wait_until_exact_deadline"),
            json!("respond_to_relative_deadline"),
            json!("rest_until_next_workday"),
            json!("start_timed_task"),
            json!("review_timed_task"),
        ]);

    value["events"]
        .as_array_mut()
        .expect("events must be an array")
        .extend([
            json!({
                "id": "after_wait_observed_completed",
                "title": "After-wait deadline observation",
                "kind": "generic",
                "trigger": {"type": "after_action", "action": "wait_until_exact_deadline"},
                "condition": {
                    "type": "deadline_status_is",
                    "deadline": "a_exact_deadline",
                    "status": "completed"
                },
                "effects": [
                    {"type": "set_flag", "flag": "deadline_completed_before_after_action_event", "value": true}
                ]
            }),
            json!({
                "id": "civil_clock_event",
                "title": "Civil clock event",
                "kind": "generic",
                "trigger": {"type": "at_time", "at": {"day": 3, "minute_of_day": 540}},
                "effects": [{"type": "set_flag", "flag": "civil_clock_event_fired", "value": true}]
            }),
            json!({
                "id": "exact_deadline_missed",
                "title": "Exact deadline missed",
                "kind": "generic",
                "trigger": {"type": "deadline_missed", "deadline": "a_exact_deadline"},
                "effects": [
                    {"type": "miss_deadline", "deadline": "a_exact_deadline"},
                    {"type": "set_flag", "flag": "exact_deadline_missed", "value": true}
                ]
            }),
            json!({
                "id": "relative_deadline_missed",
                "title": "Relative deadline missed",
                "kind": "generic",
                "trigger": {"type": "deadline_missed", "deadline": "z_relative_deadline"},
                "effects": [
                    {"type": "miss_deadline", "deadline": "z_relative_deadline"},
                    {"type": "set_flag", "flag": "relative_deadline_missed", "value": true}
                ]
            }),
            json!({
                "id": "activated_deadline_missed",
                "title": "Activated deadline missed",
                "kind": "generic",
                "trigger": {"type": "deadline_missed", "deadline": "activated_relative_deadline"},
                "effects": [
                    {"type": "miss_deadline", "deadline": "activated_relative_deadline"},
                    {"type": "set_flag", "flag": "activated_deadline_missed", "value": true}
                ]
            }),
            json!({
                "id": "timed_task_ready",
                "title": "Timed task ready",
                "kind": "generic",
                "trigger": {"type": "async_task_completed", "task": "timed_task"},
                "effects": [{"type": "mark_async_task_ready", "task": "timed_task"}]
            }),
        ]);
    value
}

fn deadline_status<'a>(
    snapshot: &'a juris_engine::MobileScenarioSnapshot,
    id: &str,
) -> Option<&'a str> {
    snapshot
        .deadlines
        .iter()
        .find(|deadline| deadline.id == id)
        .and_then(|deadline| deadline.status.as_deref())
}

#[test]
fn exact_due_action_precompletes_only_the_selected_deadline() {
    let commands = [ScenarioTraceCommand::Dispatch {
        action_id: "wait_until_exact_deadline".to_owned(),
    }];
    let (simulated, authoritative) = run_both(timing_parity_scenario(true), 19, &commands);
    assert_core_parity(&simulated, &authoritative);

    assert_eq!(simulated.final_state.clock_minutes, 120);
    assert_eq!(
        simulated.deadline_statuses["a_exact_deadline"].as_deref(),
        Some("completed")
    );
    assert_eq!(
        simulated.deadline_statuses["z_relative_deadline"].as_deref(),
        Some("open")
    );
    assert_eq!(
        deadline_status(&authoritative, "a_exact_deadline"),
        Some("completed")
    );
    assert_eq!(
        deadline_status(&authoritative, "z_relative_deadline"),
        Some("open")
    );
    assert!(simulated.final_state.flags["civil_clock_event_fired"]);
    assert!(simulated.final_state.flags["deadline_open_during_action_effects"]);
    assert!(simulated.final_state.flags["deadline_completed_before_after_action_event"]);
    assert!(!simulated
        .final_state
        .flags
        .contains_key("deadline_completed_during_action_effects"));
    assert!(!simulated
        .final_state
        .flags
        .contains_key("exact_deadline_missed"));
}

#[test]
fn completion_at_due_policy_and_due_plus_one_boundary_match_the_engine() {
    let value = timing_parity_scenario(true);
    let at_due = [ScenarioTraceCommand::AdvanceTime { minutes: 120 }];
    let (simulated, authoritative) = run_both(value.clone(), 19, &at_due);
    assert_core_parity(&simulated, &authoritative);
    assert_eq!(
        simulated.deadline_statuses["a_exact_deadline"].as_deref(),
        Some("open")
    );
    assert_eq!(
        deadline_status(&authoritative, "a_exact_deadline"),
        Some("open")
    );

    let after_due = [ScenarioTraceCommand::AdvanceTime { minutes: 121 }];
    let (simulated, authoritative) = run_both(value, 19, &after_due);
    assert_core_parity(&simulated, &authoritative);
    assert_eq!(
        simulated.deadline_statuses["a_exact_deadline"].as_deref(),
        Some("missed")
    );
    assert_eq!(
        deadline_status(&authoritative, "a_exact_deadline"),
        Some("missed")
    );
    assert!(simulated.final_state.flags["exact_deadline_missed"]);

    let rejected = timing_parity_scenario(false);
    let definition: ScenarioDefinition =
        serde_json::from_value(rejected.clone()).expect("typed scenario must parse");
    let mut authoritative =
        ScenarioSession::new(definition, 19).expect("authoritative runtime must initialize");
    let before = authoritative.snapshot();
    let error = authoritative
        .dispatch("wait_until_exact_deadline")
        .expect_err("exact due must be rejected when the policy is false");
    assert!(matches!(
        error,
        juris_engine::ScenarioRuntimeError::ActionCompletionDeadlineExceeded {
            completion: 120,
            due: 120,
            ..
        }
    ));
    assert_eq!(authoritative.snapshot(), before, "rejection must be atomic");

    let error = ScenarioSimulator::new_with_seed(
        ScenarioDocument::from_value(rejected).expect("document must parse"),
        19,
    )
    .expect("simulator must initialize")
    .run_commands(
        &[ScenarioTraceCommand::Dispatch {
            action_id: "wait_until_exact_deadline".to_owned(),
        }],
        false,
    )
    .expect_err("simulator must enforce the same exact-due policy");
    assert!(matches!(
        error,
        juris_scenario_simulator::SimulationError::ActionCompletionDeadlineExceeded {
            completion: 120,
            due: 120,
            ..
        }
    ));
}

#[test]
fn elapsed_zero_deadline_boundary_is_processed_at_session_start() {
    let mut immediate = timing_parity_scenario(false);
    immediate["deadlines"][1]["due_at"] = json!({"day": 3, "minute_of_day": 480});
    let (simulated, authoritative) = run_both(immediate, 19, &[]);
    assert_core_parity(&simulated, &authoritative);
    assert_eq!(simulated.final_state.clock_minutes, 0);
    assert_eq!(
        simulated.deadline_statuses["a_exact_deadline"].as_deref(),
        Some("missed")
    );
    assert_eq!(
        deadline_status(&authoritative, "a_exact_deadline"),
        Some("missed")
    );
    assert!(simulated.final_state.flags["exact_deadline_missed"]);
    assert!(simulated
        .fired_events
        .iter()
        .any(|event| event == "exact_deadline_missed"));
}

#[test]
fn next_workday_and_relative_async_targets_match_the_engine() {
    let rest = [ScenarioTraceCommand::Dispatch {
        action_id: "rest_until_next_workday".to_owned(),
    }];
    let (simulated, authoritative) = run_both(timing_parity_scenario(true), 23, &rest);
    assert_core_parity(&simulated, &authoritative);
    assert_eq!(simulated.final_state.clock_minutes, 1_440);

    let before_ready = [
        ScenarioTraceCommand::Dispatch {
            action_id: "start_timed_task".to_owned(),
        },
        ScenarioTraceCommand::AdvanceTime { minutes: 99 },
    ];
    let (simulated, authoritative) = run_both(timing_parity_scenario(true), 23, &before_ready);
    assert_core_parity(&simulated, &authoritative);
    assert_eq!(simulated.final_state.clock_minutes, 159);
    assert_eq!(simulated.async_task_statuses["timed_task"], "inprogress");
    assert!(!simulated
        .fired_events
        .iter()
        .any(|event| event == "timed_task_ready"));

    let at_ready = [
        ScenarioTraceCommand::Dispatch {
            action_id: "start_timed_task".to_owned(),
        },
        ScenarioTraceCommand::AdvanceTime { minutes: 100 },
    ];
    let (simulated, authoritative) = run_both(timing_parity_scenario(true), 23, &at_ready);
    assert_core_parity(&simulated, &authoritative);
    assert_eq!(simulated.final_state.clock_minutes, 160);
    assert_eq!(simulated.async_task_statuses["timed_task"], "ready");
    assert!(simulated
        .fired_events
        .iter()
        .any(|event| event == "timed_task_ready"));
    assert_eq!(
        simulated.deadline_statuses["activated_relative_deadline"].as_deref(),
        Some("open")
    );
    assert_eq!(
        deadline_status(&authoritative, "activated_relative_deadline"),
        Some("open")
    );

    let after_activated_due = [
        ScenarioTraceCommand::Dispatch {
            action_id: "start_timed_task".to_owned(),
        },
        ScenarioTraceCommand::AdvanceTime { minutes: 131 },
    ];
    let (simulated, authoritative) =
        run_both(timing_parity_scenario(true), 23, &after_activated_due);
    assert_core_parity(&simulated, &authoritative);
    assert_eq!(simulated.final_state.clock_minutes, 191);
    assert_eq!(
        simulated.deadline_statuses["activated_relative_deadline"].as_deref(),
        Some("missed")
    );
    assert_eq!(
        deadline_status(&authoritative, "activated_relative_deadline"),
        Some("missed")
    );
}
