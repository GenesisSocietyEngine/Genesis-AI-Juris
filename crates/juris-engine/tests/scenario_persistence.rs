use juris_engine::{
    ScenarioCommand, ScenarioSaveEnvelope, ScenarioSaveError, ScenarioSession,
    ScenarioSessionRegistry,
};
use juris_scenario_schema::{
    JudicialDecisionInstance, JudicialResult, MatterLifecycleStatus, ScenarioDefinition,
};
use serde_json::json;

const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const GREENFIRE_SCENARIO: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const GOLDENSHELL_SCENARIO: &str =
    include_str!("../../../content/cases/goldenshell_recall_at_dawn.scenario.json");
const REMEDIES_SCENARIO: &str =
    include_str!("../../../content/fixtures/authoring/adverse_judgment_with_remedies.json");
const V1_BEFORE_JUDGMENT: &str = include_str!("fixtures/persistence/06e566a_before_judgment.json");
const V1_WINNING_JUDGMENT_OPEN: &str =
    include_str!("fixtures/persistence/06e566a_winning_judgment_open.json");
const V1_LOSING_TERMINAL_OUTCOME: &str =
    include_str!("fixtures/persistence/06e566a_losing_terminal_outcome.json");
const V1_LOGISTICS_TERMINAL_BOUNDARY: &str =
    include_str!("fixtures/persistence/06e566a_logistics_terminal_boundary.json");
const V1_FULLY_ENFORCED_WIN: &str =
    include_str!("fixtures/persistence/06e566a_fully_enforced_win.json");
const V1_CORRUPTED_DIGEST: &str =
    include_str!("fixtures/persistence/06e566a_corrupted_digest.json");
const V1_CORRUPTED_JSON: &str = include_str!("fixtures/persistence/06e566a_corrupted_json.json");
const V1_UNSUPPORTED_MARKER: &str =
    include_str!("fixtures/persistence/06e566a_unsupported_marker.json");
const V1_NONTERMINAL_OUTCOME: &str =
    include_str!("fixtures/persistence/06e566a_nonterminal_outcome.json");
const V1_NONTERMINAL_OUTCOME_DEFINITION: &str =
    include_str!("fixtures/persistence/06e566a_nonterminal_outcome.scenario.json");
const V1_TERMINAL_THEN_NONTERMINAL_OUTCOME: &str =
    include_str!("fixtures/persistence/06e566a_terminal_then_nonterminal_outcome.json");
const V1_TERMINAL_THEN_NONTERMINAL_OUTCOME_DEFINITION: &str =
    include_str!("fixtures/persistence/06e566a_terminal_then_nonterminal_outcome.scenario.json");
const PR10_LOST_BUT_OPEN: &str = include_str!("fixtures/persistence/0c8c2cc_lost_but_open.json");
const PR10_APPEAL_SUCCESS_ENFORCED: &str =
    include_str!("fixtures/persistence/0c8c2cc_appeal_success_enforced.json");
const PR10_APPEAL_CASSATION_EXHAUSTED: &str =
    include_str!("fixtures/persistence/0c8c2cc_appeal_cassation_exhausted.json");
const PR10_EXPLICITLY_CLOSED: &str =
    include_str!("fixtures/persistence/0c8c2cc_explicitly_closed.json");

fn definition(encoded: &str) -> ScenarioDefinition {
    serde_json::from_str(encoded).expect("canonical scenario must parse")
}

fn assert_round_trip(session: &ScenarioSession, definition: ScenarioDefinition) {
    let encoded = session.save_json().expect("save must serialize");
    let restored = ScenarioSession::from_save_json(definition, &encoded).expect("save must replay");
    assert_eq!(restored.snapshot(), session.snapshot());
    assert_eq!(
        restored.final_state_digest().unwrap(),
        session.final_state_digest().unwrap()
    );
    assert_eq!(restored.command_log(), session.command_log());
}

fn assert_registry_load_failure_is_atomic(
    registry: &mut ScenarioSessionRegistry,
    existing: juris_engine::ScenarioSessionId,
    load_definition: ScenarioDefinition,
    encoded: &str,
    assert_error: impl Fn(&ScenarioSaveError),
) {
    let before = registry.snapshot(existing).unwrap();
    let before_len = registry.len();
    let error = registry
        .load_from_json(load_definition, encoded)
        .unwrap_err();
    assert_error(&error);
    assert_eq!(registry.snapshot(existing).unwrap(), before);
    assert_eq!(registry.len(), before_len);
}

fn assert_v1_migrates(
    definition: ScenarioDefinition,
    encoded: &str,
    expected_v1_digest: &str,
    expected_v2_digest: &str,
) -> ScenarioSession {
    let historical = ScenarioSaveEnvelope::from_json(encoded.trim_end()).unwrap();
    assert_eq!(historical.schema_id, "genesis.ai-juris.command-log");
    assert_eq!(historical.schema_version, 1);
    assert_eq!(historical.runtime_compatibility, "scenario-runtime-v1");
    assert_eq!(historical.final_state_digest, expected_v1_digest);

    let restored = ScenarioSession::from_save_envelope(definition.clone(), historical.clone())
        .expect("eligible historical save must migrate");
    let migrated = restored.save_envelope().unwrap();
    assert_eq!(migrated.schema_id, historical.schema_id);
    assert_eq!(migrated.schema_version, historical.schema_version);
    assert_eq!(migrated.runtime_compatibility, "scenario-runtime-v2");
    assert_eq!(migrated.scenario_id, historical.scenario_id);
    assert_eq!(
        migrated.scenario_fingerprint,
        historical.scenario_fingerprint
    );
    assert_eq!(migrated.seed, historical.seed);
    assert_eq!(migrated.commands, historical.commands);
    assert_eq!(migrated.final_state_digest, expected_v2_digest);
    assert_ne!(migrated.final_state_digest, historical.final_state_digest);

    let replayed = ScenarioSession::from_save_envelope(definition, migrated.clone())
        .expect("migrated v2 save must replay");
    assert_eq!(replayed.snapshot(), restored.snapshot());
    assert_eq!(replayed.command_log(), restored.command_log());
    assert_eq!(replayed.save_envelope().unwrap(), migrated);
    restored
}

#[test]
fn new_saves_use_v2_without_changing_the_eight_field_envelope() {
    let session = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 7).unwrap();
    let envelope = session.save_envelope().unwrap();
    assert_eq!(envelope.schema_id, "genesis.ai-juris.command-log");
    assert_eq!(envelope.schema_version, 1);
    assert_eq!(envelope.runtime_compatibility, "scenario-runtime-v2");

    let value: serde_json::Value = serde_json::from_str(&envelope.to_json().unwrap()).unwrap();
    assert_eq!(value.as_object().unwrap().len(), 8);
}

#[test]
fn real_pre_lifecycle_v1_golden_saves_migrate_and_resave_as_v2() {
    let logistics = [
        (
            V1_BEFORE_JUDGMENT,
            "8a11800b59477890eb67040600e169e9b168861a70f083be1b0e7c080ff88000",
            "74c7fc78d76985f62865af33d9490d9ab6755f7c32ba8a8ccf437edb7c465702",
        ),
        (
            V1_WINNING_JUDGMENT_OPEN,
            "f1d5331a75f0bee21b54a0f70f6171a00d55927e64a44d1404c139f3c4d8e027",
            "a676b7758bee2f6a4a88ecbe77671db67f8dd8b16f1d41c806a3ad9737590cc8",
        ),
        (
            V1_LOGISTICS_TERMINAL_BOUNDARY,
            "b125c2ed1f3c501594b52b52deb8a8cc16f41e8e355b9bf9aec83b4b2ed2fe31",
            "139239e001417ae563e270128864a512e88c0ff535a498e15b000731b8ca5bfe",
        ),
        (
            V1_FULLY_ENFORCED_WIN,
            "c8db4897cfe2a0b76e8f37b290f5dcb9232c5b583a0bb96d5303275d2d03254c",
            "e25e1eeb36249c1b7da0fe7a947f29ed3363ce7dac0357a110951c49bb738ac3",
        ),
    ];
    for (encoded, v1_digest, v2_digest) in logistics {
        assert_v1_migrates(
            definition(LOGISTICS_SCENARIO),
            encoded,
            v1_digest,
            v2_digest,
        );
    }
    let losing = assert_v1_migrates(
        definition(GREENFIRE_SCENARIO),
        V1_LOSING_TERMINAL_OUTCOME,
        "f048a70b6abe0cfc67682c2ac4968ce03e27dee9f647bcefc19e26b77ec7ab04",
        "432a3ca4688f2d452a96326872e2058d9a1b2109c4b5f3be24b6b9666cc428ec",
    );
    assert!(losing.snapshot().is_closed);
    assert_eq!(
        losing.snapshot().resolved_outcome.as_deref(),
        Some("compromised_crisis_position")
    );
}

#[test]
fn real_pr10_v1_golden_saves_use_the_pr10_digest_and_gain_authoritative_instance() {
    let cases = [
        (
            PR10_LOST_BUT_OPEN,
            "6ed63c77b392647860e06fd316e5e8c57a9ab1c2998fcbbdfe67ccdcdfae536a",
            "5aeab7f3c80b9e3b773a7cfe49f1e2cf9e6e1103d9bcdb669f95afdcd08bfab8",
            JudicialDecisionInstance::FirstInstance,
            false,
        ),
        (
            PR10_APPEAL_SUCCESS_ENFORCED,
            "77a8863ade21a3c79f86967c364c6e6731d9abccef98379d16e46f838b319524",
            "82d8fbab3ab20b98693f32504b2f3be8ca5b510f6e6ef6514ff3df83bdea74ce",
            JudicialDecisionInstance::Appeal,
            true,
        ),
        (
            PR10_APPEAL_CASSATION_EXHAUSTED,
            "7efcc35800508d0fe283ffec00d56549ca8624aabc99d7019ea7865213d35918",
            "d9b10c3087ec048d91d8f0049844ed64b067535360b1ff9d030dac97353413ae",
            JudicialDecisionInstance::Cassation,
            true,
        ),
        (
            PR10_EXPLICITLY_CLOSED,
            "0b852ea37474847a262c4c6f8586ff6435c36d35bec51941fd6fdee9fc759c66",
            "d477fe5a632d5ab2c7355511aacd253e21e48e4a27b37f8d61a190b8f47dda66",
            JudicialDecisionInstance::FirstInstance,
            true,
        ),
    ];
    for (encoded, v1_digest, v2_digest, expected_instance, expected_closed) in cases {
        let restored =
            assert_v1_migrates(definition(REMEDIES_SCENARIO), encoded, v1_digest, v2_digest);
        let snapshot = restored.snapshot();
        assert_eq!(snapshot.judicial_decision_instance, Some(expected_instance));
        assert_eq!(snapshot.is_closed, expected_closed);
    }
}

#[test]
fn incompatible_v1_is_rejected_at_the_runtime_boundary_without_registry_effects() {
    let counterexample = definition(V1_NONTERMINAL_OUTCOME_DEFINITION);
    let envelope = ScenarioSaveEnvelope::from_json(V1_NONTERMINAL_OUTCOME.trim_end()).unwrap();
    assert_eq!(
        ScenarioSession::from_save_envelope(counterexample.clone(), envelope).unwrap_err(),
        ScenarioSaveError::RuntimeCompatibility("scenario-runtime-v1".to_owned())
    );
    let ordered_counterexample = definition(V1_TERMINAL_THEN_NONTERMINAL_OUTCOME_DEFINITION);
    assert!(
        juris_scenario_validator::validate_scenario(&ordered_counterexample).is_valid(),
        "the compatibility preflight must be stricter than the current validator's any-terminal-target rule"
    );
    let ordered_envelope =
        ScenarioSaveEnvelope::from_json(V1_TERMINAL_THEN_NONTERMINAL_OUTCOME.trim_end()).unwrap();
    assert_eq!(
        ordered_envelope.final_state_digest,
        "f7118812912dfb37fe8cb4d7c2f9060af363138c4d1ece1072c14768b978559e"
    );
    assert_eq!(
        ScenarioSession::from_save_envelope(ordered_counterexample.clone(), ordered_envelope)
            .unwrap_err(),
        ScenarioSaveError::RuntimeCompatibility("scenario-runtime-v1".to_owned())
    );

    let mut registry = ScenarioSessionRegistry::new();
    let existing = registry
        .create(definition(LOGISTICS_SCENARIO), 20260731)
        .unwrap();
    registry.dispatch(existing, "audit_claim_file").unwrap();
    let future_runtime_and_command = V1_UNSUPPORTED_MARKER.replacen(
        "{\"command\":\"dispatch\",\"action_id\":\"audit_claim_file\"}",
        "{\"command\":\"future_command\"}",
        1,
    );
    for _ in 0..2 {
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            V1_CORRUPTED_JSON,
            |error| assert!(matches!(error, ScenarioSaveError::InvalidJson(_))),
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            V1_CORRUPTED_DIGEST.trim_end(),
            |error| assert_eq!(error, &ScenarioSaveError::IntegrityMismatch),
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            V1_UNSUPPORTED_MARKER.trim_end(),
            |error| {
                assert_eq!(
                    error,
                    &ScenarioSaveError::RuntimeCompatibility("scenario-runtime-future".to_owned())
                );
            },
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            &future_runtime_and_command,
            |error| {
                assert_eq!(
                    error,
                    &ScenarioSaveError::RuntimeCompatibility("scenario-runtime-future".to_owned())
                );
            },
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            ordered_counterexample.clone(),
            V1_TERMINAL_THEN_NONTERMINAL_OUTCOME.trim_end(),
            |error| {
                assert_eq!(
                    error,
                    &ScenarioSaveError::RuntimeCompatibility("scenario-runtime-v1".to_owned())
                );
            },
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            counterexample.clone(),
            V1_NONTERMINAL_OUTCOME.trim_end(),
            |error| {
                assert_eq!(
                    error,
                    &ScenarioSaveError::RuntimeCompatibility("scenario-runtime-v1".to_owned())
                );
            },
        );
    }
}

#[test]
fn every_controlled_load_failure_keeps_the_existing_registry_session_atomic() {
    let mut registry = ScenarioSessionRegistry::new();
    let existing = registry
        .create(definition(LOGISTICS_SCENARIO), 20260731)
        .unwrap();
    registry.dispatch(existing, "audit_claim_file").unwrap();

    let baseline = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 1)
        .unwrap()
        .save_envelope()
        .unwrap();

    let mut unknown_schema = baseline.clone();
    unknown_schema.schema_id = "future.command-log".to_owned();
    let unknown_schema = unknown_schema.to_json().unwrap();

    let mut unknown_version = baseline.clone();
    unknown_version.schema_version = 99;
    let unknown_version = unknown_version.to_json().unwrap();

    let mut unknown_runtime = baseline.clone();
    unknown_runtime.runtime_compatibility = "scenario-runtime-future".to_owned();
    let unknown_runtime = unknown_runtime.to_json().unwrap();

    let mut unknown_scenario = baseline.clone();
    unknown_scenario.scenario_id = "unknown_scenario".to_owned();
    let unknown_scenario = unknown_scenario.to_json().unwrap();

    let mut fingerprint_mismatch = baseline.clone();
    fingerprint_mismatch.scenario_fingerprint = "0".repeat(64);
    let fingerprint_mismatch = fingerprint_mismatch.to_json().unwrap();

    let unknown_command = baseline.to_json().unwrap().replace(
        "\"commands\":[]",
        "\"commands\":[{\"command\":\"future_command\"}]",
    );

    let mut unknown_action = baseline.clone();
    unknown_action.commands.push(ScenarioCommand::Dispatch {
        action_id: "missing_action".to_owned(),
    });
    let unknown_action = unknown_action.to_json().unwrap();

    let mut invalid_time = baseline.clone();
    invalid_time
        .commands
        .push(ScenarioCommand::AdvanceTime { minutes: 0 });
    let invalid_time = invalid_time.to_json().unwrap();

    let mut illegal_sequence = baseline.clone();
    illegal_sequence.commands.push(ScenarioCommand::Dispatch {
        action_id: "request_judgment".to_owned(),
    });
    let illegal_sequence = illegal_sequence.to_json().unwrap();

    let mut integrity_mismatch = baseline;
    integrity_mismatch.final_state_digest = "f".repeat(64);
    let integrity_mismatch = integrity_mismatch.to_json().unwrap();

    for _ in 0..2 {
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            "{broken",
            |error| assert!(matches!(error, ScenarioSaveError::InvalidJson(_))),
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            &unknown_schema,
            |error| {
                assert_eq!(
                    error,
                    &ScenarioSaveError::UnknownSchema("future.command-log".to_owned())
                );
            },
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            &unknown_version,
            |error| assert_eq!(error, &ScenarioSaveError::UnknownSchemaVersion(99)),
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            &unknown_runtime,
            |error| {
                assert_eq!(
                    error,
                    &ScenarioSaveError::RuntimeCompatibility("scenario-runtime-future".to_owned())
                );
            },
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            &unknown_scenario,
            |error| {
                assert_eq!(
                    error,
                    &ScenarioSaveError::UnknownScenario("unknown_scenario".to_owned())
                );
            },
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            &fingerprint_mismatch,
            |error| assert_eq!(error, &ScenarioSaveError::FingerprintMismatch),
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            &unknown_command,
            |error| {
                assert_eq!(
                    error,
                    &ScenarioSaveError::UnknownCommand("future_command".to_owned())
                );
            },
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            &unknown_action,
            |error| {
                assert_eq!(
                    error,
                    &ScenarioSaveError::UnknownAction("missing_action".to_owned())
                );
            },
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            &invalid_time,
            |error| assert_eq!(error, &ScenarioSaveError::InvalidTimeAdvance(0)),
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            &illegal_sequence,
            |error| {
                assert!(matches!(
                    error,
                    ScenarioSaveError::IllegalCommandSequence { index: 0, .. }
                ));
            },
        );
        assert_registry_load_failure_is_atomic(
            &mut registry,
            existing,
            definition(LOGISTICS_SCENARIO),
            &integrity_mismatch,
            |error| assert_eq!(error, &ScenarioSaveError::IntegrityMismatch),
        );
    }
}

#[test]
fn historical_corruption_and_unknown_marker_keep_controlled_errors() {
    assert!(matches!(
        ScenarioSession::from_save_json(definition(LOGISTICS_SCENARIO), V1_CORRUPTED_JSON),
        Err(ScenarioSaveError::InvalidJson(_))
    ));
    assert_eq!(
        ScenarioSession::from_save_json(
            definition(LOGISTICS_SCENARIO),
            V1_CORRUPTED_DIGEST.trim_end()
        )
        .unwrap_err(),
        ScenarioSaveError::IntegrityMismatch
    );
    assert_eq!(
        ScenarioSession::from_save_json(
            definition(LOGISTICS_SCENARIO),
            V1_UNSUPPORTED_MARKER.trim_end()
        )
        .unwrap_err(),
        ScenarioSaveError::RuntimeCompatibility("scenario-runtime-future".to_owned())
    );
}

#[test]
fn empty_command_log_round_trips() {
    let session = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 7).unwrap();
    assert!(session.command_log().is_empty());
    assert_round_trip(&session, definition(LOGISTICS_SCENARIO));
}

#[test]
fn action_driven_logistics_round_trips() {
    let mut session = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 20260725).unwrap();
    session.dispatch("audit_claim_file").unwrap();
    session.dispatch("issue_formal_demand").unwrap();
    assert_round_trip(&session, definition(LOGISTICS_SCENARIO));
}

#[test]
fn foreground_greenfire_round_trips_before_and_after_deadline_miss() {
    let mut session = ScenarioSession::new(definition(GREENFIRE_SCENARIO), 20260729).unwrap();
    session.dispatch("accept_emergency_mandate").unwrap();
    assert!(session
        .snapshot()
        .deadlines
        .iter()
        .any(|deadline| deadline.id == "legal_hold_deadline"
            && deadline.status.as_deref() == Some("open")));
    assert_round_trip(&session, definition(GREENFIRE_SCENARIO));

    session.advance_time(360).unwrap();
    assert!(session
        .snapshot()
        .deadlines
        .iter()
        .any(|deadline| deadline.id == "legal_hold_deadline"
            && deadline.status.as_deref() == Some("missed")));
    assert_round_trip(&session, definition(GREENFIRE_SCENARIO));
}

#[test]
fn foreground_goldenshell_round_trips() {
    let mut session = ScenarioSession::new(definition(GOLDENSHELL_SCENARIO), 20260730).unwrap();
    session.dispatch("accept_cooperative_mandate").unwrap();
    session.dispatch("preserve_reference_samples").unwrap();
    session.advance_time(360).unwrap();
    assert_round_trip(&session, definition(GOLDENSHELL_SCENARIO));
}

#[test]
fn adverse_judgment_and_remedy_state_round_trip_without_closing() {
    let mut session = ScenarioSession::new(definition(REMEDIES_SCENARIO), 20260729).unwrap();
    session.dispatch("request_judgment").unwrap();
    session.dispatch("adverse_trial_judgment").unwrap();

    let snapshot = session.snapshot();
    assert_eq!(snapshot.judicial_result, Some(JudicialResult::Lost));
    assert_eq!(
        snapshot.matter_lifecycle,
        MatterLifecycleStatus::PostJudgment
    );
    assert!(!snapshot.is_closed);
    assert!(snapshot
        .available_actions
        .iter()
        .any(|action| action.id == "file_appeal"));
    assert_round_trip(&session, definition(REMEDIES_SCENARIO));

    let encoded = session.save_json().unwrap();
    let mut restored =
        ScenarioSession::from_save_json(definition(REMEDIES_SCENARIO), &encoded).unwrap();
    restored.dispatch("file_appeal").unwrap();
    assert_eq!(
        restored.snapshot().matter_lifecycle,
        MatterLifecycleStatus::Appeal
    );
    assert_round_trip(&restored, definition(REMEDIES_SCENARIO));
}

#[test]
fn repeated_remedy_load_does_not_duplicate_generated_events() {
    let mut session = ScenarioSession::new(definition(REMEDIES_SCENARIO), 20260729).unwrap();
    session.dispatch("request_judgment").unwrap();
    session.dispatch("adverse_trial_judgment").unwrap();
    let encoded = session.save_json().unwrap();

    let first = ScenarioSession::from_save_json(definition(REMEDIES_SCENARIO), &encoded).unwrap();
    let second = ScenarioSession::from_save_json(definition(REMEDIES_SCENARIO), &encoded).unwrap();

    assert_eq!(first.snapshot(), second.snapshot());
    assert_eq!(
        first.snapshot().fired_event_ids,
        vec!["adverse_judgment_delivered", "hearing_scheduled"]
    );
    assert_eq!(first.command_log().len(), 2);
    assert_eq!(second.command_log().len(), 2);
}

#[test]
fn async_completion_replays_across_advance_time() {
    let mut session = ScenarioSession::new(definition(GREENFIRE_SCENARIO), 20260729).unwrap();
    for action in [
        "accept_emergency_mandate",
        "issue_legal_hold",
        "run_conflict_assessment",
        "appoint_separate_director_counsel",
        "notify_insurers",
        "retain_independent_fire_expert",
    ] {
        session.dispatch(action).unwrap();
    }
    let before = session.save_json().unwrap();
    let mut restored =
        ScenarioSession::from_save_json(definition(GREENFIRE_SCENARIO), &before).unwrap();
    restored.advance_time(360).unwrap();
    assert!(restored
        .snapshot()
        .fired_event_ids
        .contains(&"expert_assessment_completed".to_owned()));
    assert_round_trip(&restored, definition(GREENFIRE_SCENARIO));
}

#[test]
fn terminal_session_round_trips() {
    let mut session = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 20260725).unwrap();
    for action in [
        "audit_claim_file",
        "issue_formal_demand",
        "accept_negotiated_payment",
    ] {
        session.dispatch(action).unwrap();
    }
    assert!(session.snapshot().terminal);
    assert_round_trip(&session, definition(LOGISTICS_SCENARIO));
}

#[test]
fn identical_replay_produces_identical_digest() {
    let mut session = ScenarioSession::new(definition(GREENFIRE_SCENARIO), 41).unwrap();
    session.dispatch("accept_emergency_mandate").unwrap();
    session.advance_time(90).unwrap();
    let encoded = session.save_json().unwrap();
    let first = ScenarioSession::from_save_json(definition(GREENFIRE_SCENARIO), &encoded).unwrap();
    let second = ScenarioSession::from_save_json(definition(GREENFIRE_SCENARIO), &encoded).unwrap();
    assert_eq!(
        first.final_state_digest().unwrap(),
        second.final_state_digest().unwrap()
    );
}

#[test]
fn locale_is_not_part_of_the_authoritative_digest() {
    let session = ScenarioSession::new(definition(GOLDENSHELL_SCENARIO), 42).unwrap();
    let digest = session.final_state_digest().unwrap();
    let encoded = session.save_json().unwrap();
    assert!(!encoded.contains("locale"));
    assert_eq!(
        ScenarioSession::from_save_json(definition(GOLDENSHELL_SCENARIO), &encoded)
            .unwrap()
            .final_state_digest()
            .unwrap(),
        digest
    );
}

#[test]
fn corrupted_unknown_schema_and_fingerprint_are_rejected() {
    assert!(matches!(
        ScenarioSession::from_save_json(definition(LOGISTICS_SCENARIO), "{truncated"),
        Err(ScenarioSaveError::InvalidJson(_))
    ));

    let session = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 1).unwrap();
    let mut envelope = session.save_envelope().unwrap();
    envelope.schema_id = "future.command-log".to_owned();
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), envelope).unwrap_err(),
        ScenarioSaveError::UnknownSchema("future.command-log".to_owned())
    );

    let mut envelope = session.save_envelope().unwrap();
    envelope.schema_version = 99;
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), envelope).unwrap_err(),
        ScenarioSaveError::UnknownSchemaVersion(99)
    );

    let mut envelope = session.save_envelope().unwrap();
    envelope.scenario_fingerprint = "0".repeat(64);
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), envelope).unwrap_err(),
        ScenarioSaveError::FingerprintMismatch
    );

    let mut envelope = session.save_envelope().unwrap();
    envelope.runtime_compatibility = "scenario-runtime-v3".to_owned();
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), envelope).unwrap_err(),
        ScenarioSaveError::RuntimeCompatibility("scenario-runtime-v3".to_owned())
    );

    let mut envelope = session.save_envelope().unwrap();
    envelope.scenario_id = "unknown_scenario".to_owned();
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), envelope).unwrap_err(),
        ScenarioSaveError::UnknownScenario("unknown_scenario".to_owned())
    );
}

#[test]
fn unknown_command_action_and_illegal_order_are_rejected() {
    let session = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 1).unwrap();
    let encoded = session.save_json().unwrap().replace(
        "\"commands\":[]",
        "\"commands\":[{\"command\":\"future_command\"}]",
    );
    assert_eq!(
        ScenarioSession::from_save_json(definition(LOGISTICS_SCENARIO), &encoded).unwrap_err(),
        ScenarioSaveError::UnknownCommand("future_command".to_owned())
    );

    // Runtime compatibility owns the payload grammar. A future marker must be
    // selected before this runtime attempts to interpret its future command.
    let future_runtime = encoded.replace("scenario-runtime-v2", "scenario-runtime-future");
    assert_eq!(
        ScenarioSession::from_save_json(definition(LOGISTICS_SCENARIO), &future_runtime)
            .unwrap_err(),
        ScenarioSaveError::RuntimeCompatibility("scenario-runtime-future".to_owned())
    );

    let mut unknown_action = session.save_envelope().unwrap();
    unknown_action.commands.push(ScenarioCommand::Dispatch {
        action_id: "missing_action".to_owned(),
    });
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), unknown_action)
            .unwrap_err(),
        ScenarioSaveError::UnknownAction("missing_action".to_owned())
    );

    let mut illegal = session.save_envelope().unwrap();
    illegal.commands.push(ScenarioCommand::Dispatch {
        action_id: "request_judgment".to_owned(),
    });
    assert!(matches!(
        ScenarioSession::from_save_envelope(definition(LOGISTICS_SCENARIO), illegal),
        Err(ScenarioSaveError::IllegalCommandSequence { index: 0, .. })
    ));
}

#[test]
fn rejected_player_command_is_not_recorded_or_partially_applied() {
    let mut session = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 2).unwrap();
    let before = session.snapshot();
    assert!(session.dispatch("request_judgment").is_err());
    assert!(session.command_log().is_empty());
    assert_eq!(session.snapshot(), before);
}

#[test]
fn invalid_time_advance_and_integrity_mismatch_are_rejected() {
    let session = ScenarioSession::new(definition(GREENFIRE_SCENARIO), 1).unwrap();
    let mut invalid_time = session.save_envelope().unwrap();
    invalid_time
        .commands
        .push(ScenarioCommand::AdvanceTime { minutes: 0 });
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(GREENFIRE_SCENARIO), invalid_time)
            .unwrap_err(),
        ScenarioSaveError::InvalidTimeAdvance(0)
    );

    let mut corrupted_digest = session.save_envelope().unwrap();
    corrupted_digest.final_state_digest = "f".repeat(64);
    assert_eq!(
        ScenarioSession::from_save_envelope(definition(GREENFIRE_SCENARIO), corrupted_digest)
            .unwrap_err(),
        ScenarioSaveError::IntegrityMismatch
    );
}

#[test]
fn failed_load_leaves_existing_registry_session_intact() {
    let mut registry = ScenarioSessionRegistry::new();
    let existing = registry.create(definition(LOGISTICS_SCENARIO), 9).unwrap();
    registry.dispatch(existing, "audit_claim_file").unwrap();
    let before = registry.snapshot(existing).unwrap();

    assert!(registry
        .load_from_json(definition(LOGISTICS_SCENARIO), "{broken")
        .is_err());
    assert_eq!(registry.snapshot(existing).unwrap(), before);
    assert_eq!(registry.len(), 1);
}

#[test]
fn repeated_load_does_not_duplicate_generated_events() {
    let mut original = ScenarioSession::new(definition(LOGISTICS_SCENARIO), 10).unwrap();
    for action in [
        "audit_claim_file",
        "issue_formal_demand",
        "request_judgment",
    ] {
        original.dispatch(action).unwrap();
    }
    let envelope = original.save_envelope().unwrap();
    assert_eq!(envelope.commands.len(), 3);
    assert!(envelope
        .commands
        .iter()
        .all(|command| matches!(command, ScenarioCommand::Dispatch { .. })));
    assert_eq!(
        original.snapshot().fired_event_ids,
        vec!["judgment_for_velmont"]
    );
    let encoded = original.save_json().unwrap();
    let mut registry = ScenarioSessionRegistry::new();
    let first = registry
        .load_from_json(definition(LOGISTICS_SCENARIO), &encoded)
        .unwrap();
    let second = registry
        .load_from_json(definition(LOGISTICS_SCENARIO), &encoded)
        .unwrap();
    let first_snapshot = registry.snapshot(first).unwrap();
    let second_snapshot = registry.snapshot(second).unwrap();
    assert_eq!(first_snapshot, second_snapshot);
    assert_eq!(first_snapshot.fired_event_ids, vec!["judgment_for_velmont"]);
}

#[test]
fn event_budget_guard_remains_active_during_replay() {
    let mut value: serde_json::Value = serde_json::from_str(LOGISTICS_SCENARIO).unwrap();
    let events = value["events"].as_array_mut().unwrap();
    for index in 0..257 {
        events.push(json!({
            "id": format!("budget_event_{index:03}"),
            "title": format!("Budget event {index:03}"),
            "kind": "generic",
            "trigger": {
                "type": "after_action",
                "action": "audit_claim_file"
            },
            "condition": {"type": "always"},
            "effects": []
        }));
    }
    let expanded: ScenarioDefinition = serde_json::from_value(value).unwrap();
    let initial = ScenarioSession::new(expanded.clone(), 11).unwrap();
    let mut envelope: ScenarioSaveEnvelope = initial.save_envelope().unwrap();
    envelope.commands.push(ScenarioCommand::Dispatch {
        action_id: "audit_claim_file".to_owned(),
    });

    let error = ScenarioSession::from_save_envelope(expanded, envelope).unwrap_err();
    assert!(matches!(
        error,
        ScenarioSaveError::IllegalCommandSequence { index: 0, .. }
    ));
    assert!(error.to_string().contains("event limit"));
}
