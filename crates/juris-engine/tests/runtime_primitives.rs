use juris_engine::ScenarioSession;
use juris_scenario_schema::{Effect, MetricId, ScenarioDefinition, ScenarioTime};
use serde_json::json;
use sha2::{Digest, Sha256};

fn definition() -> ScenarioDefinition {
    serde_json::from_value(json!({
        "schema_version": "1.0",
        "metadata": {
            "id": "runtime-primitives",
            "title": "Runtime primitives",
            "summary": "Focused generic runtime fixture",
            "content_version": "1"
        },
        "jurisdiction": {"code": "TEST", "pack_version": "1"},
        "initial_stage": "intake",
        "clock": {"mode": "foreground"},
        "numeric_metrics": {
            "evidence": 80,
            "inactivity_minutes": 0,
            "merits": 10,
            "trust": 100,
            "warnings": 0
        },
        "foreground_metric_rates": {"inactivity_minutes": 1},
        "initial_resources": {"authorized_budget_eur": 1000},
        "deterministic_decisions": [
            {
                "id": "judgment",
                "roll_range": 1,
                "roll_offset": -15,
                "roll_multiplier": 100,
                "score_terms": [
                    {
                        "operand": {"source": "metric", "metric": "evidence"},
                        "multiplier": 20,
                        "condition": {"type": "always"},
                        "maximum": 55
                    },
                    {
                        "operand": {"source": "metric", "metric": "merits"},
                        "multiplier": 20,
                        "condition": {"type": "always"}
                    }
                ],
                "branches": [
                    {
                        "id": "favorable",
                        "minimum_total": -200,
                        "effects": [
                            {"type": "set_flag", "flag": "favorable", "value": true}
                        ]
                    },
                    {
                        "id": "adverse",
                        "maximum_total": -201,
                        "effects": [
                            {"type": "set_flag", "flag": "adverse", "value": true}
                        ]
                    }
                ]
            },
            {
                "id": "seeded",
                "branches": [
                    {
                        "id": "low",
                        "maximum_roll": 49,
                        "effects": [
                            {"type": "set_flag", "flag": "low", "value": true}
                        ]
                    },
                    {
                        "id": "high",
                        "minimum_roll": 50,
                        "effects": [
                            {"type": "set_flag", "flag": "high", "value": true}
                        ]
                    }
                ]
            }
        ],
        "stages": [
            {
                "id": "intake",
                "title": "Intake",
                "kind": "standard",
                "exit_actions": [
                    "paid_work", "decide", "seeded_decide", "reset_idle",
                    "passive_wait", "resolve_message", "reopen_message",
                    "trigger_repeatable_loop", "close"
                ]
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
                "id": "paid_work",
                "title": "Paid work",
                "available_when": {
                    "type": "all",
                    "conditions": [
                        {"type": "stage_is", "stage": "intake"},
                        {
                            "type": "integer_compare",
                            "left": {
                                "source": "resource",
                                "resource": "authorized_budget_eur"
                            },
                            "operator": "greater_than_or_equal",
                            "right": {
                                "source": "resource",
                                "resource": "spend_eur",
                                "offset": 100
                            }
                        }
                    ]
                },
                "effects": [
                    {"type": "add_metric", "metric": "merits", "amount": 5}
                ],
                "time_cost_minutes": 60,
                "cost_eur": 100,
                "billable_minutes": 45,
                "presentation_tags": ["ai"]
            },
            {
                "id": "decide",
                "title": "Decide",
                "available_when": {"type": "stage_is", "stage": "intake"},
                "effects": [
                    {"type": "clamp_metric", "metric": "evidence", "maximum": 55},
                    {"type": "resolve_deterministic_decision", "decision": "judgment"}
                ]
            },
            {
                "id": "seeded_decide",
                "title": "Seeded decision",
                "available_when": {"type": "stage_is", "stage": "intake"},
                "effects": [
                    {"type": "resolve_deterministic_decision", "decision": "seeded"}
                ]
            },
            {
                "id": "reset_idle",
                "title": "Active work",
                "available_when": {"type": "stage_is", "stage": "intake"},
                "effects": [
                    {"type": "set_metric", "metric": "inactivity_minutes", "value": 0}
                ],
                "time_cost_minutes": 480
            },
            {
                "id": "passive_wait",
                "title": "Passive wait",
                "available_when": {"type": "stage_is", "stage": "intake"},
                "repeatability": {"type": "unlimited"}
            },
            {
                "id": "resolve_message",
                "title": "Resolve message",
                "available_when": {"type": "stage_is", "stage": "intake"},
                "effects": [
                    {"type": "resolve_inbox_item", "item": "client_message"}
                ]
            },
            {
                "id": "reopen_message",
                "title": "Reopen message",
                "available_when": {"type": "stage_is", "stage": "intake"},
                "effects": [
                    {"type": "create_inbox_item", "item": "client_message"}
                ]
            },
            {
                "id": "trigger_repeatable_loop",
                "title": "Trigger guarded event loop",
                "available_when": {"type": "stage_is", "stage": "intake"},
                "effects": [
                    {"type": "trigger_event", "event": "repeatable_self_loop"}
                ]
            },
            {
                "id": "close",
                "title": "Close",
                "available_when": {"type": "stage_is", "stage": "intake"},
                "effects": [
                    {"type": "complete_deadline", "deadline": "legal_deadline"},
                    {"type": "set_stage", "stage": "resolved"},
                    {"type": "resolve_outcome", "outcome": "closed"}
                ]
            }
        ],
        "deadlines": [{
            "id": "legal_deadline",
            "title": "Legal deadline",
            "due_at": {"day": 6, "minute_of_day": 0},
            "completion_actions": ["close"],
            "missed_event": "legal_deadline_missed"
        }],
        "inbox_items": [
            {
                "id": "client_message",
                "sender": "Client CEO",
                "subject": "Instructions",
                "body": "Please proceed.",
                "initially_visible": true
            }
        ],
        "events": [
            {
                "id": "passive_wait_elapsed",
                "title": "Passive wait elapsed",
                "kind": "generic",
                "trigger": {"type": "after_action", "action": "passive_wait"},
                "repeatable": true,
                "effects": [
                    {"type": "add_metric", "metric": "inactivity_minutes", "amount": 120}
                ]
            },
            {
                "id": "idle_warning",
                "title": "Idle warning",
                "kind": "generic",
                "trigger": {
                    "type": "metric_threshold_reached",
                    "metric": "inactivity_minutes",
                    "threshold": 180
                },
                "repeatable": true,
                "effects": [
                    {"type": "add_metric", "metric": "warnings", "amount": 1},
                    {"type": "subtract_metric", "metric": "trust", "amount": 10}
                ]
            },
            {
                "id": "idle_escalation",
                "title": "Idle escalation",
                "kind": "generic",
                "trigger": {
                    "type": "metric_threshold_reached",
                    "metric": "inactivity_minutes",
                    "threshold": 300
                },
                "repeatable": true,
                "effects": [
                    {"type": "add_metric", "metric": "warnings", "amount": 1},
                    {"type": "subtract_metric", "metric": "trust", "amount": 10}
                ]
            },
            {
                "id": "idle_termination",
                "title": "Idle termination",
                "kind": "matter_closed",
                "trigger": {
                    "type": "metric_threshold_reached",
                    "metric": "inactivity_minutes",
                    "threshold": 480
                },
                "repeatable": true,
                "effects": [
                    {"type": "add_metric", "metric": "warnings", "amount": 1},
                    {"type": "subtract_metric", "metric": "trust", "amount": 10},
                    {"type": "set_flag", "flag": "idle_closed", "value": true},
                    {"type": "complete_deadline", "deadline": "legal_deadline"},
                    {"type": "set_stage", "stage": "resolved"},
                    {"type": "resolve_outcome", "outcome": "idle_closed"}
                ]
            },
            {
                "id": "repeatable_self_loop",
                "title": "Guarded repeatable self loop",
                "kind": "generic",
                "trigger": {"type": "by_effect"},
                "repeatable": true,
                "effects": [
                    {"type": "trigger_event", "event": "repeatable_self_loop"}
                ]
            },
            {
                "id": "legal_deadline_missed",
                "title": "Legal deadline missed",
                "kind": "matter_closed",
                "trigger": {"type": "deadline_missed", "deadline": "legal_deadline"},
                "effects": [
                    {"type": "miss_deadline", "deadline": "legal_deadline"},
                    {"type": "set_flag", "flag": "deadline_closed", "value": true},
                    {"type": "set_stage", "stage": "resolved"},
                    {"type": "resolve_outcome", "outcome": "closed"}
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
            },
            {
                "id": "idle_closed",
                "title": "Idle closure",
                "summary": "Closed after sustained inactivity",
                "terminal_stage": "resolved",
                "condition": {"type": "flag_equals", "flag": "idle_closed", "value": true}
            }
        ]
    }))
    .expect("runtime primitive fixture must parse")
}

#[test]
fn ordered_metrics_resources_and_sender_are_projected_after_accepted_action() {
    let mut session = ScenarioSession::new(definition(), 7).unwrap();
    let initial = session.snapshot();
    assert_eq!(initial.inbox[0].sender.as_deref(), Some("Client CEO"));

    let paid_action = initial
        .available_actions
        .iter()
        .find(|action| action.id == "paid_work")
        .unwrap();
    assert_eq!(paid_action.presentation_tags, ["ai"]);
    assert_eq!(paid_action.billable_minutes, 45);

    let snapshot = session.dispatch("paid_work").unwrap();
    assert_eq!(snapshot.clock_minutes, 60);
    assert_eq!(snapshot.numeric_metrics.as_ref().unwrap()["merits"], 15);
    let resources = snapshot.resources.unwrap();
    assert_eq!(resources["authorized_budget_eur"], 1_000);
    assert_eq!(resources["spend_eur"], 100);
    assert_eq!(resources["billable_minutes"], 45);
}

#[test]
fn score_terms_clamp_and_stable_seed_decisions_materialize_once() {
    let mut first = ScenarioSession::new(definition(), 20260724).unwrap();
    let mut second = ScenarioSession::new(definition(), 20260724).unwrap();

    let decided = first.dispatch("decide").unwrap();
    assert_eq!(decided.numeric_metrics.as_ref().unwrap()["evidence"], 55);
    assert_eq!(first.diagnostic_flags().get("favorable"), Some(&true));
    assert_eq!(first.diagnostic_flags().get("adverse"), None);
    assert!(decided.flags.is_empty());

    // Legacy `seed % range` arithmetic is not a persistence contract. The
    // generic runtime derives the roll from seed + fingerprint + stable
    // decision ID + occurrence.
    let fingerprint = first.scenario_fingerprint().unwrap();
    let mut hash = Sha256::new();
    hash.update(20260724_u64.to_be_bytes());
    hash.update((fingerprint.len() as u64).to_be_bytes());
    hash.update(fingerprint.as_bytes());
    hash.update(("seeded".len() as u64).to_be_bytes());
    hash.update(b"seeded");
    hash.update(0_u64.to_be_bytes());
    let digest = hash.finalize();
    let expected_roll = u64::from_be_bytes(digest[..8].try_into().unwrap()) % 100;

    let seeded = first.dispatch("seeded_decide").unwrap();
    let expected_flag = if expected_roll <= 49 { "low" } else { "high" };
    assert_eq!(first.diagnostic_flags().get(expected_flag), Some(&true));
    assert!(seeded.flags.is_empty());
    second.dispatch("decide").unwrap();
    second.dispatch("seeded_decide").unwrap();
    assert_eq!(first.snapshot(), second.snapshot());
}

#[test]
fn foreground_threshold_edges_rearm_after_reset_and_ignore_action_time() {
    let mut session = ScenarioSession::new(definition(), 1).unwrap();

    let first_warning = session.advance_time(180).unwrap();
    assert_eq!(
        first_warning.numeric_metrics.as_ref().unwrap()["warnings"],
        1
    );
    assert_eq!(first_warning.numeric_metrics.as_ref().unwrap()["trust"], 90);

    let after_active_work = session.dispatch("reset_idle").unwrap();
    assert_eq!(after_active_work.clock_minutes, 660);
    assert_eq!(
        after_active_work.numeric_metrics.as_ref().unwrap()["inactivity_minutes"],
        0
    );
    assert_eq!(
        after_active_work.numeric_metrics.as_ref().unwrap()["warnings"],
        1
    );

    let second_warning = session.advance_time(180).unwrap();
    assert_eq!(
        second_warning.numeric_metrics.as_ref().unwrap()["warnings"],
        2
    );
    assert_eq!(
        second_warning.numeric_metrics.as_ref().unwrap()["trust"],
        80
    );
    assert!(!session
        .diagnostic_fired_event_ids()
        .iter()
        .any(|id| id == "idle_warning"));
    assert!(second_warning.fired_event_ids.is_empty());
}

#[test]
fn every_foreground_threshold_fires_only_on_its_exact_crossing_edge() {
    let mut session = ScenarioSession::new(definition(), 1).unwrap();

    let before_first = session.advance_time(179).unwrap();
    assert_eq!(
        before_first.numeric_metrics.as_ref().unwrap()["warnings"],
        0
    );
    let first = session.advance_time(1).unwrap();
    assert_eq!(first.numeric_metrics.as_ref().unwrap()["warnings"], 1);

    let before_second = session.advance_time(119).unwrap();
    assert_eq!(
        before_second.numeric_metrics.as_ref().unwrap()["warnings"],
        1
    );
    let second = session.advance_time(1).unwrap();
    assert_eq!(second.numeric_metrics.as_ref().unwrap()["warnings"], 2);

    let before_terminal = session.advance_time(179).unwrap();
    assert_eq!(
        before_terminal.numeric_metrics.as_ref().unwrap()["warnings"],
        2
    );
    let terminal = session.advance_time(1).unwrap();
    assert_eq!(terminal.clock_minutes, 480);
    assert_eq!(terminal.numeric_metrics.as_ref().unwrap()["warnings"], 3);
    assert_eq!(terminal.numeric_metrics.as_ref().unwrap()["trust"], 70);
    assert_eq!(session.diagnostic_flags().get("idle_closed"), Some(&true));
    assert!(terminal.flags.is_empty());
    assert_eq!(terminal.resolved_outcome.as_deref(), Some("idle_closed"));
    assert!(terminal.is_closed);
}

#[test]
fn repeatable_after_action_events_do_not_implicitly_trigger_metric_edges() {
    let mut session = ScenarioSession::new(definition(), 1).unwrap();
    session.dispatch("passive_wait").unwrap();
    let snapshot = session.dispatch("passive_wait").unwrap();

    let metrics = snapshot.numeric_metrics.unwrap();
    assert_eq!(metrics["inactivity_minutes"], 240);
    assert_eq!(metrics["warnings"], 0);
    assert_eq!(metrics["trust"], 100);
    assert!(!session
        .diagnostic_fired_event_ids()
        .iter()
        .any(|id| id == "passive_wait_elapsed"));
    assert!(snapshot.fired_event_ids.is_empty());
}

#[test]
fn recreating_a_stable_inbox_item_reopens_its_resolution_state() {
    let mut session = ScenarioSession::new(definition(), 1).unwrap();
    let resolved = session.dispatch("resolve_message").unwrap();
    assert!(resolved.inbox[0].resolved);

    let reopened = session.dispatch("reopen_message").unwrap();
    assert!(reopened.inbox[0].visible);
    assert!(!reopened.inbox[0].resolved);
}

#[test]
fn repeatable_trigger_event_self_cycle_is_guarded_per_command() {
    let mut session = ScenarioSession::new(definition(), 1).unwrap();
    let snapshot = session.dispatch("trigger_repeatable_loop").unwrap();
    assert!(!snapshot.is_closed);
    assert!(!session
        .diagnostic_fired_event_ids()
        .iter()
        .any(|id| id == "repeatable_self_loop"));
    assert!(snapshot.fired_event_ids.is_empty());
}

#[test]
fn repeatable_metric_event_can_rearm_at_a_later_boundary_in_one_advance() {
    let mut scenario = definition();
    scenario
        .events
        .iter_mut()
        .find(|event| event.id.as_str() == "idle_warning")
        .unwrap()
        .effects
        .push(Effect::SetMetric {
            metric: MetricId::from("inactivity_minutes"),
            value: 0,
        });
    let mut session = ScenarioSession::new(scenario, 1).unwrap();

    let snapshot = session.advance_time(360).unwrap();
    assert_eq!(snapshot.clock_minutes, 360);
    assert_eq!(snapshot.numeric_metrics.as_ref().unwrap()["warnings"], 2);
    assert_eq!(
        snapshot.numeric_metrics.as_ref().unwrap()["inactivity_minutes"],
        0
    );
}

#[test]
fn deadline_consequences_precede_metric_thresholds_at_the_same_minute() {
    let mut scenario = definition();
    scenario.deadlines[0].due_at = ScenarioTime::new(0, 180);
    let mut session = ScenarioSession::new(scenario, 1).unwrap();

    let snapshot = session.advance_time(180).unwrap();
    assert!(snapshot.is_closed);
    assert_eq!(snapshot.resolved_outcome.as_deref(), Some("closed"));
    assert_eq!(
        session.diagnostic_flags().get("deadline_closed"),
        Some(&true)
    );
    assert!(snapshot.flags.is_empty());
    assert_eq!(snapshot.numeric_metrics.as_ref().unwrap()["warnings"], 0);
    assert_eq!(snapshot.numeric_metrics.as_ref().unwrap()["trust"], 100);
}

#[test]
fn replay_reconstructs_generic_projections_without_digest_contract_changes() {
    let definition = definition();
    let mut session = ScenarioSession::new(definition.clone(), 44).unwrap();
    session.dispatch("paid_work").unwrap();
    session.advance_time(180).unwrap();
    let saved = session.save_json().unwrap();
    let restored = ScenarioSession::from_save_json(definition, &saved).unwrap();

    assert_eq!(restored.snapshot(), session.snapshot());
    assert_eq!(restored.save_json().unwrap(), saved);
}

#[test]
fn existing_production_fingerprints_remain_byte_exact() {
    for (encoded, expected) in [
        (
            include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json"),
            "1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8",
        ),
        (
            include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json"),
            "b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261",
        ),
        (
            include_str!("../../../content/cases/goldenshell_recall_at_dawn.scenario.json"),
            "7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4",
        ),
    ] {
        let definition: ScenarioDefinition = serde_json::from_str(encoded).unwrap();
        assert_eq!(
            ScenarioSession::new(definition, 1)
                .unwrap()
                .scenario_fingerprint()
                .unwrap(),
            expected
        );
    }
}
