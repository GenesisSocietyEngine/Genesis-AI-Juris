use juris_engine::{
    RetainedScenarioDefinition, ScenarioCommand, ScenarioContentInventory,
    ScenarioContentInventoryError, ScenarioSaveEnvelope, ScenarioSaveError, ScenarioSession,
    ScenarioSessionRegistry,
};
use juris_scenario_schema::ScenarioDefinition;
use sha2::{Digest, Sha256};

const CURRENT_GREENFIRE: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const ARCHIVED_GREENFIRE: &str = include_str!(
    "../../../content/archive/greenfire_first_72_hours/0.1.0/greenfire_first_72_hours.scenario.json"
);
const LOGISTICS: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const HISTORICAL_GREENFIRE_SAVE: &str =
    include_str!("fixtures/persistence/06e566a_losing_terminal_outcome.json");
const CURRENT_GREENFIRE_FINGERPRINT: &str =
    "173140f010723c50f580fe9fd4e91417d3a20f51ca0b5315d94e900c1bde2438";
const ARCHIVED_GREENFIRE_FINGERPRINT: &str =
    "b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261";
const ARCHIVED_GREENFIRE_SOURCE_SHA256: &str =
    "a0237b3260d184d114eb79ad3fcf019d9b4cf540012e2fefb7478002162ef82c";

fn definition(encoded: &str) -> ScenarioDefinition {
    serde_json::from_str(encoded).expect("scenario fixture must parse")
}

fn retained(definition: ScenarioDefinition) -> RetainedScenarioDefinition {
    RetainedScenarioDefinition {
        scenario_id: "greenfire_first_72_hours".to_owned(),
        content_version: "0.1.0".to_owned(),
        scenario_fingerprint: ARCHIVED_GREENFIRE_FINGERPRINT.to_owned(),
        definition,
    }
}

fn production_inventory() -> ScenarioContentInventory {
    ScenarioContentInventory::try_new(
        vec![definition(CURRENT_GREENFIRE)],
        vec![retained(definition(ARCHIVED_GREENFIRE))],
    )
    .expect("production archive must be valid")
}

#[test]
fn archived_greenfire_is_byte_exact_and_recomputes_the_pinned_identity() {
    let current = definition(CURRENT_GREENFIRE);
    let archived = definition(ARCHIVED_GREENFIRE);
    assert_ne!(ARCHIVED_GREENFIRE.as_bytes(), CURRENT_GREENFIRE.as_bytes());
    assert_eq!(current.metadata.content_version, "0.2.0");
    assert_eq!(current.pressure_windows.len(), 1);
    assert_eq!(archived.metadata.content_version, "0.1.0");
    assert!(archived.pressure_windows.is_empty());
    assert_eq!(
        format!("{:x}", Sha256::digest(ARCHIVED_GREENFIRE.as_bytes())),
        ARCHIVED_GREENFIRE_SOURCE_SHA256
    );

    let inventory = production_inventory();
    assert_eq!(inventory.current_count(), 1);
    assert_eq!(inventory.retained_count(), 1);

    let envelope = ScenarioSaveEnvelope::from_json(HISTORICAL_GREENFIRE_SAVE).unwrap();
    assert_eq!(
        envelope.scenario_fingerprint,
        ARCHIVED_GREENFIRE_FINGERPRINT
    );
    let resolved = inventory.resolve_envelope(&envelope).unwrap();
    assert_eq!(resolved, &archived);
    let session = ScenarioSession::new(resolved.clone(), envelope.seed).unwrap();
    assert_eq!(
        session.scenario_fingerprint().unwrap(),
        ARCHIVED_GREENFIRE_FINGERPRINT
    );
}

#[test]
fn exact_lookup_is_order_independent_and_current_creation_uses_current_role() {
    let greenfire = definition(CURRENT_GREENFIRE);
    let logistics = definition(LOGISTICS);
    let first = ScenarioContentInventory::try_new(
        vec![greenfire.clone(), logistics.clone()],
        vec![retained(definition(ARCHIVED_GREENFIRE))],
    )
    .unwrap();
    let second = ScenarioContentInventory::try_new(
        vec![logistics, greenfire],
        vec![retained(definition(ARCHIVED_GREENFIRE))],
    )
    .unwrap();
    let envelope = ScenarioSaveEnvelope::from_json(HISTORICAL_GREENFIRE_SAVE).unwrap();
    assert_eq!(
        first.resolve_envelope(&envelope).unwrap(),
        second.resolve_envelope(&envelope).unwrap()
    );

    let mut sessions = ScenarioSessionRegistry::new();
    let id = first
        .create_current(&mut sessions, "greenfire_first_72_hours", 20260729)
        .unwrap();
    sessions.dispatch(id, "accept_emergency_mandate").unwrap();
    let active = sessions.dispatch(id, "issue_legal_hold").unwrap();
    let pressure = active
        .pressure_and_countermove
        .as_ref()
        .expect("current GreenFire must project active production pressure");
    assert_eq!(pressure.active_pressures.len(), 1);
    assert_eq!(
        pressure.active_pressures[0].pressure_id,
        "regulator_document_request_pressure"
    );
    assert_eq!(pressure.active_pressures[0].due_at_minute, 2_160);
    assert_eq!(pressure.active_pressures[0].remaining_minutes, 2_040);

    let encoded = sessions.save_json(id).unwrap();
    let saved = ScenarioSaveEnvelope::from_json(&encoded).unwrap();
    assert_eq!(saved.runtime_compatibility, "scenario-runtime-v2");
    assert_eq!(saved.scenario_fingerprint, CURRENT_GREENFIRE_FINGERPRINT);
    assert_eq!(sessions.len(), 1);
    assert!(sessions.dispose(id));
    assert!(sessions.is_empty());

    let restored = first.load_from_json(&mut sessions, &encoded).unwrap();
    assert_eq!(sessions.snapshot(restored).unwrap(), active);
    let responded = sessions
        .dispatch(restored, "release_unreviewed_documents")
        .unwrap();
    assert!(responded.pressure_and_countermove.is_none());

    assert_eq!(
        first.create_current(&mut sessions, "retained_only", 1),
        Err(ScenarioContentInventoryError::UnknownCurrentScenario(
            "retained_only".to_owned()
        ))
    );
}

#[test]
fn duplicate_and_mismatched_inventory_entries_fail_deterministically() {
    let current = definition(CURRENT_GREENFIRE);
    assert_eq!(
        ScenarioContentInventory::try_new(vec![current.clone(), current.clone()], Vec::new())
            .unwrap_err(),
        ScenarioContentInventoryError::DuplicateCurrentScenario(
            "greenfire_first_72_hours".to_owned()
        )
    );

    assert!(matches!(
        ScenarioContentInventory::try_new(
            vec![current],
            vec![
                retained(definition(ARCHIVED_GREENFIRE)),
                retained(definition(ARCHIVED_GREENFIRE)),
            ],
        )
        .unwrap_err(),
        ScenarioContentInventoryError::ConflictingIdentity { .. }
    ));

    let mut wrong_pin = retained(definition(ARCHIVED_GREENFIRE));
    wrong_pin.scenario_fingerprint = "0".repeat(64);
    assert!(matches!(
        ScenarioContentInventory::try_new(Vec::new(), vec![wrong_pin]).unwrap_err(),
        ScenarioContentInventoryError::RetainedFingerprintMismatch { .. }
    ));
}

#[test]
fn unknown_identity_and_wrong_candidate_fail_without_registry_mutation() {
    let inventory = production_inventory();
    let mut sessions = ScenarioSessionRegistry::new();
    let existing = inventory
        .create_current(&mut sessions, "greenfire_first_72_hours", 99)
        .unwrap();
    let before = sessions.snapshot(existing).unwrap();

    let mut unknown_scenario = ScenarioSaveEnvelope::from_json(HISTORICAL_GREENFIRE_SAVE).unwrap();
    unknown_scenario.scenario_id = "unknown_scenario".to_owned();
    assert_eq!(
        inventory
            .load_from_json(&mut sessions, &unknown_scenario.to_json().unwrap())
            .unwrap_err(),
        ScenarioSaveError::UnknownScenario("unknown_scenario".to_owned())
    );

    let mut unknown_fingerprint =
        ScenarioSaveEnvelope::from_json(HISTORICAL_GREENFIRE_SAVE).unwrap();
    unknown_fingerprint.scenario_fingerprint = "f".repeat(64);
    assert_eq!(
        inventory
            .load_from_json(&mut sessions, &unknown_fingerprint.to_json().unwrap())
            .unwrap_err(),
        ScenarioSaveError::FingerprintMismatch
    );
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions.snapshot(existing).unwrap(), before);

    assert_eq!(
        ScenarioSession::from_save_json(definition(LOGISTICS), HISTORICAL_GREENFIRE_SAVE,)
            .unwrap_err(),
        ScenarioSaveError::UnknownScenario("greenfire_first_72_hours".to_owned())
    );
}

#[test]
fn synthetic_future_current_never_replays_an_old_save_under_new_content() {
    let old = definition(ARCHIVED_GREENFIRE);
    let old_session = ScenarioSession::new(old.clone(), 20260729).unwrap();
    let old_save = old_session.save_json().unwrap();

    let mut newer = old.clone();
    newer.metadata.content_version = "0.2.0-test".to_owned();
    newer
        .metadata
        .summary
        .push_str(" Synthetic current definition.");
    let newer_fingerprint = ScenarioSession::new(newer.clone(), 20260729)
        .unwrap()
        .scenario_fingerprint()
        .unwrap();
    assert_ne!(newer_fingerprint, ARCHIVED_GREENFIRE_FINGERPRINT);

    let inventory = ScenarioContentInventory::try_new(vec![newer], vec![retained(old)]).unwrap();
    let mut sessions = ScenarioSessionRegistry::new();

    let current_id = inventory
        .create_current(&mut sessions, "greenfire_first_72_hours", 20260729)
        .unwrap();
    let current_save =
        ScenarioSaveEnvelope::from_json(&sessions.save_json(current_id).unwrap()).unwrap();
    assert_eq!(current_save.scenario_fingerprint, newer_fingerprint);

    let historical_id = inventory.load_from_json(&mut sessions, &old_save).unwrap();
    let historical_resave =
        ScenarioSaveEnvelope::from_json(&sessions.save_json(historical_id).unwrap()).unwrap();
    assert_eq!(
        historical_resave.scenario_fingerprint,
        ARCHIVED_GREENFIRE_FINGERPRINT
    );
    assert_eq!(historical_resave.commands, Vec::<ScenarioCommand>::new());

    let mut unknown = historical_resave;
    unknown.scenario_fingerprint = "1".repeat(64);
    let before_len = sessions.len();
    assert_eq!(
        inventory
            .load_from_json(&mut sessions, &unknown.to_json().unwrap())
            .unwrap_err(),
        ScenarioSaveError::FingerprintMismatch
    );
    assert_eq!(sessions.len(), before_len);
}
