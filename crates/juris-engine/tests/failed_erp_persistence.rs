use juris_engine::{
    ScenarioCommand, ScenarioSaveEnvelope, ScenarioSaveError, ScenarioSession,
    ScenarioSessionRegistry,
};
use juris_scenario_schema::{JudicialDecisionInstance, ScenarioDefinition};
use serde_json::{json, Value};

const FAILED_ERP_SCENARIO: &str = include_str!("../../../content/cases/failed_erp.scenario.json");
const SETTLEMENT_TRACE: &str =
    include_str!("../../../content/traces/failed_erp_settlement.commands.json");
const PREPARED_LITIGATION_TRACE: &str =
    include_str!("../../../content/traces/failed_erp_prepared_litigation.commands.json");
const REMITTAL_TRACE: &str =
    include_str!("../../../content/traces/failed_erp_remittal.commands.json");
const SETTLEMENT_SEED: u64 = 20_260_724;
const PREPARED_LITIGATION_SEED: u64 = 6;
const REMITTAL_SEED: u64 = 28;
const FAILED_ERP_FINGERPRINT: &str =
    "ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8";

fn definition() -> ScenarioDefinition {
    serde_json::from_str(FAILED_ERP_SCENARIO).expect("Failed ERP scenario must deserialize")
}

fn trace(encoded: &str) -> Vec<ScenarioCommand> {
    serde_json::from_str(encoded).expect("canonical command trace must deserialize")
}

fn replay(seed: u64, commands: &[ScenarioCommand]) -> ScenarioSession {
    let mut session = ScenarioSession::new(definition(), seed).expect("scenario must start");
    for command in commands {
        match command {
            ScenarioCommand::Dispatch { action_id } => {
                session
                    .dispatch(action_id)
                    .unwrap_or_else(|error| panic!("`{action_id}` must replay: {error}"));
            }
            ScenarioCommand::AdvanceTime { minutes } => {
                session
                    .advance_time(*minutes)
                    .unwrap_or_else(|error| panic!("advance_time({minutes}) must replay: {error}"));
            }
        }
    }
    session
}

fn assert_exact_save_round_trip(session: &ScenarioSession) {
    let encoded = session.save_json().expect("save must serialize");
    let restored =
        ScenarioSession::from_save_json(definition(), &encoded).expect("save must replay");

    assert_eq!(restored.snapshot(), session.snapshot());
    assert_eq!(restored.command_log(), session.command_log());
    assert_eq!(
        restored.final_state_digest().unwrap(),
        session.final_state_digest().unwrap()
    );
    assert_eq!(restored.save_json().unwrap(), encoded);
}

#[test]
fn settlement_replay_uses_the_v2_eight_field_save_and_round_trips_exactly() {
    let commands = trace(SETTLEMENT_TRACE);
    let session = replay(SETTLEMENT_SEED, &commands);
    let snapshot = session.snapshot();

    assert_eq!(snapshot.scenario_id, "be_commercial_failed_erp_001");
    assert_eq!(snapshot.clock_minutes, 570);
    assert_eq!(snapshot.stage_id, "resolved");
    assert_eq!(
        snapshot.resolved_outcome.as_deref(),
        Some("settlement_64500")
    );
    assert!(snapshot.is_closed);
    assert_eq!(session.command_log(), commands);
    assert!(snapshot.numeric_metrics.is_some());
    assert!(snapshot.resources.is_some());

    let envelope = session.save_envelope().unwrap();
    assert_eq!(envelope.schema_id, "genesis.ai-juris.command-log");
    assert_eq!(envelope.schema_version, 1);
    assert_eq!(envelope.runtime_compatibility, "scenario-runtime-v2");
    assert_eq!(envelope.scenario_id, "be_commercial_failed_erp_001");
    assert_eq!(envelope.scenario_fingerprint, FAILED_ERP_FINGERPRINT);
    assert_eq!(envelope.commands, commands);
    let encoded = envelope.to_json().unwrap();
    let value: Value = serde_json::from_str(&encoded).unwrap();
    assert_eq!(value.as_object().unwrap().len(), 8);

    assert_exact_save_round_trip(&session);
}

#[test]
fn prepared_litigation_replay_and_save_are_deterministic() {
    let commands = trace(PREPARED_LITIGATION_TRACE);
    let first = replay(PREPARED_LITIGATION_SEED, &commands);
    let second = replay(PREPARED_LITIGATION_SEED, &commands);

    let snapshot = first.snapshot();
    assert_eq!(commands.len(), 26);
    assert_eq!(snapshot.stage_id, "resolved");
    assert_eq!(
        snapshot.resolved_outcome.as_deref(),
        Some("judgment_preserved_after_cassation")
    );
    assert_eq!(snapshot.clock_minutes, 8_640);
    assert!(snapshot.is_closed);

    assert_eq!(first.snapshot(), second.snapshot());
    assert_eq!(first.command_log(), commands);
    assert_eq!(first.save_json().unwrap(), second.save_json().unwrap());
    assert_eq!(
        first.final_state_digest().unwrap(),
        second.final_state_digest().unwrap()
    );
    assert_eq!(
        first.scenario_fingerprint().unwrap(),
        FAILED_ERP_FINGERPRINT
    );
    assert_eq!(
        second.scenario_fingerprint().unwrap(),
        FAILED_ERP_FINGERPRINT
    );
    assert_exact_save_round_trip(&first);
}

#[test]
fn remittal_remains_nonterminal_across_save_reset_load_and_resave() {
    let commands = trace(REMITTAL_TRACE);
    let session = replay(REMITTAL_SEED, &commands);
    let expected_snapshot = session.snapshot();
    let expected_digest = session.final_state_digest().unwrap();
    let encoded = session.save_json().unwrap();

    assert_eq!(commands.len(), 29);
    assert_eq!(expected_snapshot.stage_id, "post_judgment");
    assert_eq!(expected_snapshot.resolved_outcome, None);
    assert_eq!(expected_snapshot.clock_minutes, 10_080);
    assert_eq!(
        expected_snapshot.judicial_decision_instance,
        Some(JudicialDecisionInstance::FirstInstance)
    );
    assert!(!expected_snapshot.is_closed);
    assert_eq!(
        session.scenario_fingerprint().unwrap(),
        FAILED_ERP_FINGERPRINT
    );

    // Dropping the only session is the engine-level reset boundary. Loading
    // must reconstruct every metric/resource/deadline/decision and Dossier
    // projection solely from definition, seed, and ordered commands.
    drop(session);
    let restored = ScenarioSession::from_save_json(definition(), &encoded).unwrap();
    assert_eq!(restored.snapshot(), expected_snapshot);
    assert_eq!(restored.final_state_digest().unwrap(), expected_digest);
    assert_eq!(restored.command_log(), commands);
    assert_eq!(restored.save_json().unwrap(), encoded);
}

#[test]
fn dossier_reveals_only_the_exact_characterized_failed_erp_inventory() {
    let initial = ScenarioSession::new(definition(), SETTLEMENT_SEED).unwrap();
    let dossier = initial.snapshot().dossier;
    assert_eq!(
        dossier
            .facts
            .iter()
            .map(|fact| (fact.id.as_str(), fact.status.as_str()))
            .collect::<Vec<_>>(),
        [
            ("claimed_loss_240000", "alleged"),
            ("contract_in_force", "proven"),
            ("go_live_failure", "alleged"),
        ]
    );
    assert_eq!(
        dossier
            .evidence
            .iter()
            .map(|evidence| {
                (
                    evidence.id.as_str(),
                    evidence.supports_fact_ids.as_slice(),
                    evidence.contradicts_fact_ids.as_slice(),
                )
            })
            .collect::<Vec<_>>(),
        [(
            "erp_implementation_contract",
            ["contract_in_force".to_owned()].as_slice(),
            [].as_slice(),
        )]
    );

    let settlement = trace(SETTLEMENT_TRACE);
    let after_document_reviews = replay(SETTLEMENT_SEED, &settlement[..2]).snapshot().dossier;
    assert_eq!(
        after_document_reviews
            .facts
            .iter()
            .map(|fact| (fact.id.as_str(), fact.status.as_str()))
            .collect::<Vec<_>>(),
        [
            ("acceptance_status", "disputed"),
            ("claimed_loss_240000", "alleged"),
            ("contract_in_force", "proven"),
            ("go_live_failure", "alleged"),
            ("scope_change_responsibility", "disputed"),
            ("supplier_delay_notice", "inferred"),
        ]
    );
    assert_eq!(
        after_document_reviews
            .evidence
            .iter()
            .map(|evidence| (evidence.id.as_str(), evidence.supports_fact_ids.as_slice()))
            .collect::<Vec<_>>(),
        [
            (
                "acceptance_record",
                ["acceptance_status".to_owned()].as_slice()
            ),
            (
                "change_request_register",
                ["scope_change_responsibility".to_owned()].as_slice(),
            ),
            (
                "erp_implementation_contract",
                ["contract_in_force".to_owned()].as_slice(),
            ),
            (
                "project_email_correspondence",
                [
                    "go_live_failure".to_owned(),
                    "supplier_delay_notice".to_owned()
                ]
                .as_slice(),
            ),
        ]
    );

    let prepared = trace(PREPARED_LITIGATION_TRACE);
    let expert_review_index = prepared
        .iter()
        .position(|command| {
            matches!(
                command,
                ScenarioCommand::Dispatch { action_id } if action_id == "review-expert-report"
            )
        })
        .expect("prepared trace must review the expert report");
    let after_expert = replay(PREPARED_LITIGATION_SEED, &prepared[..=expert_review_index]);
    let dossier = after_expert.snapshot().dossier;
    assert_eq!(
        dossier
            .facts
            .iter()
            .map(|fact| (fact.id.as_str(), fact.status.as_str()))
            .collect::<Vec<_>>(),
        [
            ("acceptance_status", "disputed"),
            ("claimed_loss_240000", "alleged"),
            ("contract_in_force", "proven"),
            ("go_live_failure", "alleged"),
            ("loss_causation", "inferred"),
            ("material_supplier_breach", "inferred"),
            ("scope_change_responsibility", "disputed"),
            ("supplier_delay_notice", "inferred"),
        ]
    );
    assert_eq!(
        dossier
            .evidence
            .iter()
            .map(|evidence| (evidence.id.as_str(), evidence.supports_fact_ids.as_slice()))
            .collect::<Vec<_>>(),
        [
            (
                "acceptance_record",
                ["acceptance_status".to_owned()].as_slice()
            ),
            (
                "change_request_register",
                ["scope_change_responsibility".to_owned()].as_slice(),
            ),
            (
                "erp_implementation_contract",
                ["contract_in_force".to_owned()].as_slice(),
            ),
            (
                "independent_expert_report",
                [
                    "loss_causation".to_owned(),
                    "material_supplier_breach".to_owned()
                ]
                .as_slice(),
            ),
            (
                "project_email_correspondence",
                [
                    "go_live_failure".to_owned(),
                    "supplier_delay_notice".to_owned()
                ]
                .as_slice(),
            ),
        ]
    );
    assert!(dossier
        .evidence
        .iter()
        .all(|evidence| evidence.contradicts_fact_ids.is_empty()));
    assert_exact_save_round_trip(&after_expert);
}

#[test]
fn corrupted_and_unsupported_failed_erp_loads_preserve_the_active_registry_session() {
    let commands = trace(SETTLEMENT_TRACE);
    let mut registry = ScenarioSessionRegistry::new();
    let active = registry
        .create(definition(), SETTLEMENT_SEED)
        .expect("active Failed ERP session must start");
    for command in commands.iter().take(2) {
        let ScenarioCommand::Dispatch { action_id } = command else {
            panic!("settlement characterization trace uses dispatch commands")
        };
        registry.dispatch(active, action_id).unwrap();
    }
    let before_snapshot = registry.snapshot(active).unwrap();
    let before_save = registry.save_json(active).unwrap();
    let before_len = registry.len();

    let mut corrupted_digest = ScenarioSaveEnvelope::from_json(&before_save).unwrap();
    corrupted_digest.final_state_digest = "f".repeat(64);
    let corrupted_digest = corrupted_digest.to_json().unwrap();

    let mut unsupported: Value = serde_json::from_str(&before_save).unwrap();
    unsupported["runtime_compatibility"] = json!("scenario-runtime-future");
    unsupported["commands"] = json!([{"command": "future_command"}]);
    let unsupported = serde_json::to_string(&unsupported).unwrap();

    for _ in 0..2 {
        assert!(matches!(
            registry.load_from_json(definition(), "{corrupted"),
            Err(ScenarioSaveError::InvalidJson(_))
        ));
        assert!(matches!(
            registry.load_from_json(definition(), &corrupted_digest),
            Err(ScenarioSaveError::IntegrityMismatch)
        ));
        assert_eq!(
            registry.load_from_json(definition(), &unsupported),
            Err(ScenarioSaveError::RuntimeCompatibility(
                "scenario-runtime-future".to_owned()
            ))
        );

        assert_eq!(registry.snapshot(active).unwrap(), before_snapshot);
        assert_eq!(registry.save_json(active).unwrap(), before_save);
        assert_eq!(registry.len(), before_len);
    }
}
