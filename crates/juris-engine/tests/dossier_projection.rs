use std::collections::BTreeSet;

use juris_engine::{
    DossierMatterStatus, ScenarioSession, ScenarioSessionRegistry,
    DOSSIER_PROJECTION_SCHEMA_VERSION,
};
use juris_scenario_schema::{
    JudicialDecisionInstance, JudicialResult, MatterLifecycleStatus, ScenarioDefinition,
};

const DOSSIER_SCENARIO: &str =
    include_str!("../../../content/fixtures/authoring/dossier_projection_v1.json");

fn definition() -> ScenarioDefinition {
    serde_json::from_str(DOSSIER_SCENARIO).expect("dossier fixture must parse")
}

fn visibility_definition() -> ScenarioDefinition {
    let mut value: serde_json::Value =
        serde_json::from_str(DOSSIER_SCENARIO).expect("dossier fixture must parse");

    value["actors"] = serde_json::json!([
        {
            "id": "sentinel_known_actor",
            "name": "Known actor EN / Известный участник RU",
            "role": "client",
            "description": "Known actor metadata EN / Известные данные участника RU"
        },
        {
            "id": "sentinel_hidden_actor",
            "name": "SENTINEL HIDDEN ACTOR EN / СКРЫТЫЙ УЧАСТНИК RU",
            "role": "witness",
            "description": "SENTINEL HIDDEN ACTOR DESCRIPTION / СКРЫТОЕ ОПИСАНИЕ"
        }
    ]);
    value["facts"][0]["related_actors"] = serde_json::json!(["sentinel_known_actor"]);
    value["facts"][1]["related_actors"] = serde_json::json!(["sentinel_hidden_actor"]);
    value["facts"][1]["statement"] =
        serde_json::json!("SENTINEL UNKNOWN FACT EN / СКРЫТЫЙ ФАКТ RU");
    value["evidence"][1]["title"] =
        serde_json::json!("SENTINEL UNAVAILABLE EVIDENCE EN / СКРЫТОЕ ДОКАЗАТЕЛЬСТВО RU");
    value["deadlines"][1]["title"] =
        serde_json::json!("SENTINEL INACTIVE DEADLINE EN / СКРЫТЫЙ СРОК RU");

    value["inbox_items"] = serde_json::json!([
        {
            "id": "sentinel_visible_inbox",
            "sender": "Known sender EN / Известный отправитель RU",
            "subject": "Known message EN / Известное сообщение RU",
            "body": "Known body EN / Известный текст RU",
            "initially_visible": true,
            "action_required": true,
            "resolution_actions": ["z_reveal_record"]
        },
        {
            "id": "sentinel_hidden_inbox",
            "sender": "SENTINEL HIDDEN SENDER / СКРЫТЫЙ ОТПРАВИТЕЛЬ",
            "subject": "SENTINEL HIDDEN SUBJECT / СКРЫТАЯ ТЕМА",
            "body": "SENTINEL HIDDEN BODY / СКРЫТЫЙ ТЕКСТ",
            "created_by_event": "sentinel_inbox_revealed",
            "action_required": false,
            "resolution_actions": ["sentinel_future_activation_action"]
        }
    ]);
    value["async_tasks"] = serde_json::json!([
        {
            "id": "sentinel_started_task",
            "title": "SENTINEL STARTED TASK EN / ЗАПУЩЕННАЯ ЗАДАЧА RU",
            "start_action": "z_reveal_record",
            "completion_event": "sentinel_started_task_completed",
            "duration_minutes": 5
        },
        {
            "id": "sentinel_hidden_task",
            "title": "SENTINEL HIDDEN TASK EN / СКРЫТАЯ ЗАДАЧА RU",
            "start_action": "sentinel_future_activation_action",
            "completion_event": "sentinel_hidden_task_completed",
            "duration_minutes": 5
        }
    ]);

    let reveal = value["actions"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .find(|action| action["id"] == "z_reveal_record")
        .unwrap();
    reveal["available_when"] = serde_json::json!({
        "type": "all",
        "conditions": [
            {"type": "stage_is", "stage": "investigation"},
            {
                "type": "async_task_status_is",
                "task": "sentinel_started_task",
                "status": "not_started"
            }
        ]
    });
    let reveal_effects = reveal["effects"].as_array_mut().unwrap();
    reveal_effects.push(serde_json::json!({
        "type": "start_async_task",
        "task": "sentinel_started_task"
    }));
    reveal_effects.push(serde_json::json!({
        "type": "resolve_inbox_item",
        "item": "sentinel_visible_inbox"
    }));
    reveal_effects.push(serde_json::json!({
        "type": "trigger_event",
        "event": "sentinel_inbox_revealed"
    }));

    let future_action = value["actions"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .find(|action| action["id"] == "sentinel_future_activation_action")
        .unwrap();
    future_action["effects"]
        .as_array_mut()
        .unwrap()
        .push(serde_json::json!({
            "type": "start_async_task",
            "task": "sentinel_hidden_task"
        }));

    value["actions"]
        .as_array_mut()
        .unwrap()
        .push(serde_json::json!({
                "id": "review_started_task",
                "title": "Review disclosed work",
                "available_when": {
                    "type": "all",
                    "conditions": [
                        {"type": "stage_is", "stage": "investigation"},
                        {
                            "type": "async_task_status_is",
                            "task": "sentinel_started_task",
                            "status": "ready"
                        }
                    ]
                },
            "effects": [{"type": "review_async_task", "task": "sentinel_started_task"}],
            "time_cost_minutes": 1
        }));
    value["actions"]
        .as_array_mut()
        .unwrap()
        .push(serde_json::json!({
            "id": "review_hidden_task",
            "title": "SENTINEL HIDDEN TASK REVIEW MUST NOT LEAK",
            "available_when": {
                "type": "all",
                "conditions": [
                    {"type": "stage_is", "stage": "post_judgment"},
                    {
                        "type": "async_task_status_is",
                        "task": "sentinel_hidden_task",
                        "status": "ready"
                    }
                ]
            },
            "effects": [{"type": "review_async_task", "task": "sentinel_hidden_task"}],
            "time_cost_minutes": 1
        }));
    let investigation_actions = value["stages"][0]["exit_actions"].as_array_mut().unwrap();
    investigation_actions.push(serde_json::json!("review_started_task"));
    value["stages"][1]["exit_actions"]
        .as_array_mut()
        .unwrap()
        .push(serde_json::json!("review_hidden_task"));

    for terminal_action_id in [
        "accept_final_loss",
        "close_after_expiry",
        "resolve_appeal_and_close",
    ] {
        let terminal_action = value["actions"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|action| action["id"] == terminal_action_id)
            .unwrap();
        let effects = terminal_action["effects"].as_array_mut().unwrap();
        effects.insert(
            0,
            serde_json::json!({
                "type": "resolve_inbox_item",
                "item": "sentinel_visible_inbox"
            }),
        );
        effects.insert(
            0,
            serde_json::json!({
                "type": "expire_async_task",
                "task": "sentinel_hidden_task"
            }),
        );
        effects.insert(
            0,
            serde_json::json!({
                "type": "expire_async_task",
                "task": "sentinel_started_task"
            }),
        );
    }

    value["events"].as_array_mut().unwrap().extend([
        serde_json::json!({
            "id": "sentinel_inbox_revealed",
            "title": "Reveal message internally",
            "kind": "generic",
            "trigger": {"type": "by_effect"},
            "effects": [{"type": "create_inbox_item", "item": "sentinel_hidden_inbox"}]
        }),
        serde_json::json!({
            "id": "sentinel_started_task_completed",
            "title": "Started work completed internally",
            "kind": "generic",
            "trigger": {
                "type": "async_task_completed",
                "task": "sentinel_started_task"
            },
            "effects": [{
                "type": "mark_async_task_ready",
                "task": "sentinel_started_task"
            }]
        }),
        serde_json::json!({
            "id": "sentinel_hidden_task_completed",
            "title": "Hidden work completed internally",
            "kind": "generic",
            "trigger": {
                "type": "async_task_completed",
                "task": "sentinel_hidden_task"
            },
            "effects": [{
                "type": "mark_async_task_ready",
                "task": "sentinel_hidden_task"
            }]
        }),
    ]);

    serde_json::from_value(value).expect("synthetic visibility definition must parse")
}

fn adverse_session(seed: u64) -> ScenarioSession {
    let mut session = ScenarioSession::new(definition(), seed).expect("fixture must validate");
    session.dispatch("z_reveal_record").unwrap();
    session.dispatch("a_receive_adverse_decision").unwrap();
    session
}

#[test]
fn focused_fixture_passes_the_complete_scenario_validator() {
    let report = juris_scenario_validator::validate_scenario(&definition());
    assert!(
        report.is_valid(),
        "dossier fixture diagnostics: {:#?}",
        report.diagnostics
    );
}

#[test]
fn projection_omits_unknown_and_future_authoring_state() {
    let session = ScenarioSession::new(definition(), 101).unwrap();
    let snapshot = session.snapshot();
    let dossier = &snapshot.dossier;

    assert_eq!(
        dossier.projection_schema_version,
        DOSSIER_PROJECTION_SCHEMA_VERSION
    );
    assert_eq!(dossier.procedure.stage_id, "investigation");
    assert_eq!(dossier.procedure.clock_minutes, 0);
    assert_eq!(dossier.procedure.matter_status, DossierMatterStatus::Open);
    assert_eq!(
        dossier.procedure.matter_lifecycle,
        MatterLifecycleStatus::Active
    );
    assert!(!dossier.procedure.is_closed);
    assert_eq!(dossier.judicial_result, None);
    assert_eq!(dossier.judicial_decision_instance, None);
    assert_eq!(
        dossier
            .facts
            .iter()
            .map(|fact| fact.id.as_str())
            .collect::<Vec<_>>(),
        ["a_known_fact", "z_known_fact"]
    );
    assert_eq!(
        dossier
            .evidence
            .iter()
            .map(|evidence| evidence.id.as_str())
            .collect::<Vec<_>>(),
        ["a_visible_evidence", "z_visible_evidence"]
    );
    let registry_extract = dossier
        .evidence
        .iter()
        .find(|evidence| evidence.id == "z_visible_evidence")
        .unwrap();
    assert_eq!(registry_extract.supports_fact_ids, ["z_known_fact"]);
    assert_eq!(registry_extract.contradicts_fact_ids, ["a_known_fact"]);
    assert!(dossier.deadlines.is_empty());
    assert_eq!(dossier.outcome, None);

    let encoded = serde_json::to_string(dossier).unwrap();
    for sentinel in [
        "sentinel_unknown_fact",
        "SENTINEL UNKNOWN FACT MUST NOT LEAK",
        "sentinel_unavailable_evidence",
        "SENTINEL UNAVAILABLE EVIDENCE MUST NOT LEAK",
        "SENTINEL UNAVAILABLE DESCRIPTION MUST NOT LEAK",
        "sentinel_inactive_deadline",
        "SENTINEL INACTIVE DEADLINE MUST NOT LEAK",
        "sentinel_unfired_event",
        "SENTINEL UNFIRED EVENT MUST NOT LEAK",
        "sentinel_private_flag",
        "sentinel_future_gate",
        "sentinel_future_activation_action",
        "SENTINEL FUTURE ACTION MUST NOT LEAK",
        "sentinel_future_remedy_action",
        "SENTINEL FUTURE REMEDY MUST NOT LEAK",
        "final_loss",
        "SENTINEL HIDDEN LOSS OUTCOME",
        "SENTINEL HIDDEN OUTCOME SUMMARY MUST NOT LEAK BEFORE CLOSURE",
    ] {
        assert!(
            !encoded.contains(sentinel),
            "dossier leaked hidden sentinel `{sentinel}`: {encoded}"
        );
    }
}

#[test]
fn reveal_is_additive_and_prior_snapshot_remains_immutable() {
    let mut session = ScenarioSession::new(definition(), 102).unwrap();
    let before = session.snapshot();

    let after = session.dispatch("z_reveal_record").unwrap();

    assert_eq!(
        before
            .dossier
            .facts
            .iter()
            .map(|fact| fact.id.as_str())
            .collect::<Vec<_>>(),
        ["a_known_fact", "z_known_fact"]
    );
    assert_eq!(
        before
            .dossier
            .evidence
            .iter()
            .map(|evidence| evidence.id.as_str())
            .collect::<Vec<_>>(),
        ["a_visible_evidence", "z_visible_evidence"]
    );
    assert_eq!(
        after
            .dossier
            .facts
            .iter()
            .map(|fact| fact.id.as_str())
            .collect::<Vec<_>>(),
        ["a_known_fact", "sentinel_unknown_fact", "z_known_fact"]
    );
    assert_eq!(
        after
            .dossier
            .evidence
            .iter()
            .map(|evidence| evidence.id.as_str())
            .collect::<Vec<_>>(),
        [
            "a_visible_evidence",
            "sentinel_unavailable_evidence",
            "z_visible_evidence"
        ]
    );
    let registry_extract = after
        .dossier
        .evidence
        .iter()
        .find(|evidence| evidence.id == "z_visible_evidence")
        .unwrap();
    assert_eq!(
        registry_extract.supports_fact_ids,
        ["sentinel_unknown_fact", "z_known_fact"]
    );

    let encoded = serde_json::to_string(&after.dossier).unwrap();
    assert!(encoded.contains("sentinel_unknown_fact"));
    assert!(encoded.contains("sentinel_unavailable_evidence"));
    for private in [
        "sentinel_private_flag",
        "sentinel_future_gate",
        "sentinel_inactive_deadline",
        "sentinel_unfired_event",
        "sentinel_future_activation_action",
        "sentinel_future_remedy_action",
        "final_loss",
    ] {
        assert!(!encoded.contains(private), "leaked `{private}`: {encoded}");
    }
}

#[test]
fn identical_seed_and_command_log_produce_identical_sorted_projection() {
    let first = adverse_session(103);
    let second = adverse_session(103);

    assert_eq!(first.command_log(), second.command_log());
    assert_eq!(first.snapshot().dossier, second.snapshot().dossier);

    let dossier = first.snapshot().dossier;
    assert_eq!(dossier.procedure.stage_id, "post_judgment");
    assert_eq!(dossier.procedure.clock_minutes, 30);
    assert_eq!(
        dossier.procedure.matter_lifecycle,
        MatterLifecycleStatus::PostJudgment
    );
    assert_eq!(
        dossier.procedure.matter_status,
        DossierMatterStatus::Recoverable
    );
    assert_eq!(dossier.judicial_result, Some(JudicialResult::Lost));
    assert_eq!(
        dossier.judicial_decision_instance,
        Some(JudicialDecisionInstance::FirstInstance)
    );
    assert_eq!(
        dossier
            .deadlines
            .iter()
            .map(|deadline| (deadline.id.as_str(), deadline.due_at_minutes))
            .collect::<Vec<_>>(),
        [("a_review_deadline", 240), ("z_appeal_deadline", 300)]
    );
    assert_eq!(
        dossier.deadlines[0]
            .remedies
            .iter()
            .map(|remedy| remedy.action_id.as_str())
            .collect::<Vec<_>>(),
        ["file_appeal", "preserve_review_rights"]
    );
    assert_eq!(
        dossier.deadlines[1]
            .remedies
            .iter()
            .map(|remedy| remedy.action_id.as_str())
            .collect::<Vec<_>>(),
        ["file_appeal"]
    );
    assert_eq!(dossier.deadlines[0].remedies[0].cost_eur, 1_800);
    assert_eq!(dossier.deadlines[0].remedies[0].time_cost_minutes, 60);
    assert_eq!(dossier.outcome, None);

    let mut tied_definition = definition();
    tied_definition
        .deadlines
        .iter_mut()
        .find(|deadline| deadline.id.as_str() == "z_appeal_deadline")
        .unwrap()
        .due_at
        .minute_of_day = 240;
    let mut tied = ScenarioSession::new(tied_definition, 103).unwrap();
    tied.dispatch("z_reveal_record").unwrap();
    tied.dispatch("a_receive_adverse_decision").unwrap();
    assert_eq!(
        tied.snapshot()
            .dossier
            .deadlines
            .iter()
            .map(|deadline| deadline.id.as_str())
            .collect::<Vec<_>>(),
        ["a_review_deadline", "z_appeal_deadline"],
        "stable deadline ID must break equal-due-time ties"
    );
}

#[test]
fn completed_and_missed_deadlines_remove_remedies_deterministically() {
    let mut completed = adverse_session(104);
    let snapshot = completed.dispatch("preserve_review_rights").unwrap();
    assert_eq!(snapshot.dossier.deadlines[0].status, "completed");
    assert!(snapshot.dossier.deadlines[0].remedies.is_empty());
    assert_eq!(snapshot.dossier.deadlines[1].status, "open");
    assert_eq!(
        snapshot.dossier.procedure.matter_status,
        DossierMatterStatus::Recoverable
    );

    let appealed = completed.dispatch("file_appeal").unwrap();
    assert_eq!(appealed.dossier.procedure.stage_id, "appeal");
    assert!(appealed
        .dossier
        .deadlines
        .iter()
        .all(|deadline| deadline.status == "completed" && deadline.remedies.is_empty()));
    assert_eq!(
        appealed.dossier.procedure.matter_status,
        DossierMatterStatus::Open
    );
    assert_eq!(appealed.judicial_result, Some(JudicialResult::Lost));
    assert_eq!(
        appealed.dossier.judicial_decision_instance,
        Some(JudicialDecisionInstance::FirstInstance)
    );

    let closed = completed.dispatch("resolve_appeal_and_close").unwrap();
    assert_eq!(
        closed.dossier.procedure.matter_status,
        DossierMatterStatus::Closed
    );
    assert_eq!(
        closed.dossier.procedure.matter_lifecycle,
        MatterLifecycleStatus::Closed
    );
    assert!(closed.dossier.procedure.is_closed);
    assert_eq!(closed.dossier.judicial_result, Some(JudicialResult::Won));
    assert_eq!(
        closed.dossier.judicial_decision_instance,
        Some(JudicialDecisionInstance::Appeal)
    );
    assert_eq!(
        closed
            .dossier
            .outcome
            .as_ref()
            .map(|outcome| outcome.id.as_str()),
        Some("recovered_on_appeal")
    );

    let mut missed = adverse_session(105);
    let expired = missed.advance_time(270).unwrap();
    assert_eq!(expired.clock_minutes, 300);
    assert!(expired
        .dossier
        .deadlines
        .iter()
        .all(|deadline| deadline.status == "missed" && deadline.remedies.is_empty()));
    assert_eq!(
        expired.dossier.procedure.matter_status,
        DossierMatterStatus::Open
    );
    assert_eq!(expired.dossier.outcome, None);

    let closed = missed.dispatch("close_after_expiry").unwrap();
    assert_eq!(
        closed.dossier.procedure.matter_status,
        DossierMatterStatus::Closed
    );
    assert_eq!(closed.dossier.judicial_result, Some(JudicialResult::Lost));
    assert_eq!(
        closed.dossier.judicial_decision_instance,
        Some(JudicialDecisionInstance::FirstInstance)
    );
    assert_eq!(
        closed
            .dossier
            .outcome
            .as_ref()
            .map(|outcome| outcome.id.as_str()),
        Some("final_loss")
    );
}

#[test]
fn save_load_rederives_the_exact_dossier_without_digest_or_duplicate_effects() {
    let session = adverse_session(106);
    let before = session.snapshot().dossier;
    let digest_before_snapshot = session.final_state_digest().unwrap();
    let _ = session.snapshot();
    assert_eq!(
        session.final_state_digest().unwrap(),
        digest_before_snapshot
    );

    let encoded = session.save_json().unwrap();
    let envelope: serde_json::Value = serde_json::from_str(&encoded).unwrap();
    assert_eq!(envelope.as_object().unwrap().len(), 8);
    assert!(envelope.get("dossier").is_none());
    assert_eq!(
        session.final_state_digest().unwrap(),
        digest_before_snapshot
    );

    let restored = ScenarioSession::from_save_json(definition(), &encoded).unwrap();
    assert_eq!(restored.snapshot().dossier, before);
    assert_eq!(
        restored.final_state_digest().unwrap(),
        digest_before_snapshot
    );

    let mut registry = ScenarioSessionRegistry::new();
    let first = registry.load_from_json(definition(), &encoded).unwrap();
    let second = registry.load_from_json(definition(), &encoded).unwrap();
    let first_dossier = registry.snapshot(first).unwrap().dossier;
    let second_dossier = registry.snapshot(second).unwrap().dossier;
    assert_eq!(first_dossier, before);
    assert_eq!(second_dossier, before);

    let fact_ids = first_dossier
        .facts
        .iter()
        .map(|fact| fact.id.as_str())
        .collect::<BTreeSet<_>>();
    let evidence_ids = first_dossier
        .evidence
        .iter()
        .map(|evidence| evidence.id.as_str())
        .collect::<BTreeSet<_>>();
    let deadline_ids = first_dossier
        .deadlines
        .iter()
        .map(|deadline| deadline.id.as_str())
        .collect::<BTreeSet<_>>();
    assert_eq!(fact_ids.len(), first_dossier.facts.len());
    assert_eq!(evidence_ids.len(), first_dossier.evidence.len());
    assert_eq!(deadline_ids.len(), first_dossier.deadlines.len());
}

#[test]
fn complete_player_snapshot_is_visibility_safe_and_replay_stable() {
    let definition = visibility_definition();
    let report = juris_scenario_validator::validate_scenario(&definition);
    assert!(
        report.is_valid(),
        "visibility fixture diagnostics: {:#?}",
        report.diagnostics
    );

    let mut session = ScenarioSession::new(definition.clone(), 107).unwrap();
    let initial = session.snapshot();
    let initial_bytes = serde_json::to_vec(&initial).unwrap();
    let initial_digest = session.final_state_digest().unwrap();

    assert_eq!(
        initial
            .facts
            .iter()
            .map(|fact| fact.id.as_str())
            .collect::<Vec<_>>(),
        ["z_known_fact", "a_known_fact"]
    );
    assert_eq!(
        initial
            .evidence
            .iter()
            .map(|evidence| evidence.id.as_str())
            .collect::<Vec<_>>(),
        ["z_visible_evidence", "a_visible_evidence"]
    );
    assert!(initial.deadlines.is_empty());
    assert_eq!(
        initial
            .inbox
            .iter()
            .map(|item| item.id.as_str())
            .collect::<Vec<_>>(),
        ["sentinel_visible_inbox"]
    );
    assert_eq!(initial.inbox[0].resolution_action_ids, ["z_reveal_record"]);
    assert!(initial.flags.is_empty());
    assert!(initial.fired_event_ids.is_empty());

    let initial_json = String::from_utf8(initial_bytes.clone()).unwrap();
    for hidden in [
        "sentinel_unknown_fact",
        "СКРЫТЫЙ ФАКТ RU",
        "sentinel_unavailable_evidence",
        "СКРЫТОЕ ДОКАЗАТЕЛЬСТВО RU",
        "sentinel_inactive_deadline",
        "СКРЫТЫЙ СРОК RU",
        "sentinel_hidden_inbox",
        "СКРЫТАЯ ТЕМА",
        "sentinel_hidden_actor",
        "СКРЫТЫЙ УЧАСТНИК RU",
        "sentinel_known_actor",
        "Известный участник RU",
        "sentinel_hidden_task",
        "СКРЫТАЯ ЗАДАЧА RU",
        "sentinel_started_task",
        "ЗАПУЩЕННАЯ ЗАДАЧА RU",
        "sentinel_future_activation_action",
        "sentinel_unfired_event",
        "sentinel_private_flag",
    ] {
        assert!(
            !initial_json.contains(hidden),
            "initial player snapshot leaked `{hidden}`: {initial_json}"
        );
    }

    assert_eq!(
        serde_json::to_vec(&session.snapshot()).unwrap(),
        initial_bytes
    );
    assert_eq!(session.final_state_digest().unwrap(), initial_digest);

    let initial_save = session.save_json().unwrap();
    let restored_initial =
        ScenarioSession::from_save_json(definition.clone(), &initial_save).unwrap();
    assert_eq!(
        serde_json::to_vec(&restored_initial.snapshot()).unwrap(),
        initial_bytes
    );
    assert_eq!(
        restored_initial.final_state_digest().unwrap(),
        initial_digest
    );

    let revealed = session.dispatch("z_reveal_record").unwrap();
    let revealed_bytes = serde_json::to_vec(&revealed).unwrap();
    let revealed_digest = session.final_state_digest().unwrap();
    assert_eq!(
        revealed
            .facts
            .iter()
            .map(|fact| fact.id.as_str())
            .collect::<Vec<_>>(),
        ["z_known_fact", "sentinel_unknown_fact", "a_known_fact"]
    );
    assert_eq!(
        revealed
            .evidence
            .iter()
            .map(|evidence| evidence.id.as_str())
            .collect::<Vec<_>>(),
        [
            "z_visible_evidence",
            "sentinel_unavailable_evidence",
            "a_visible_evidence"
        ]
    );
    assert_eq!(
        revealed
            .inbox
            .iter()
            .map(|item| item.id.as_str())
            .collect::<Vec<_>>(),
        ["sentinel_visible_inbox", "sentinel_hidden_inbox"]
    );
    assert!(revealed.inbox[1].resolution_action_ids.is_empty());
    assert!(revealed.flags.is_empty());
    assert!(revealed.fired_event_ids.is_empty());

    let revealed_json = String::from_utf8(revealed_bytes.clone()).unwrap();
    for disclosed in [
        "sentinel_unknown_fact",
        "СКРЫТЫЙ ФАКТ RU",
        "sentinel_unavailable_evidence",
        "СКРЫТОЕ ДОКАЗАТЕЛЬСТВО RU",
        "sentinel_hidden_inbox",
        "СКРЫТАЯ ТЕМА",
    ] {
        assert!(
            revealed_json.contains(disclosed),
            "authoritative reveal omitted `{disclosed}`: {revealed_json}"
        );
    }
    for still_hidden in [
        "sentinel_hidden_actor",
        "СКРЫТЫЙ УЧАСТНИК RU",
        "sentinel_known_actor",
        "Известный участник RU",
        "sentinel_hidden_task",
        "СКРЫТАЯ ЗАДАЧА RU",
        "sentinel_started_task",
        "ЗАПУЩЕННАЯ ЗАДАЧА RU",
        "sentinel_future_activation_action",
        "sentinel_unfired_event",
        "sentinel_private_flag",
        "sentinel_inactive_deadline",
    ] {
        assert!(
            !revealed_json.contains(still_hidden),
            "revealed player snapshot leaked `{still_hidden}`: {revealed_json}"
        );
    }

    assert_eq!(
        serde_json::to_vec(&session.snapshot()).unwrap(),
        revealed_bytes
    );
    assert_eq!(session.final_state_digest().unwrap(), revealed_digest);

    let revealed_save = session.save_json().unwrap();
    let restored_revealed = ScenarioSession::from_save_json(definition, &revealed_save).unwrap();
    assert_eq!(restored_revealed.command_log(), session.command_log());
    assert_eq!(
        serde_json::to_vec(&restored_revealed.snapshot()).unwrap(),
        revealed_bytes
    );
    assert_eq!(
        restored_revealed.final_state_digest().unwrap(),
        revealed_digest
    );
}
