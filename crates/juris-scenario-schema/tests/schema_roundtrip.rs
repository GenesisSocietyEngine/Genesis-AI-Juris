//! Integration tests for the public schema API.
//!
//! These tests intentionally use YAML from the repository content directory.
//! This proves that the public Rust types and the human-authored scenario
//! format remain compatible.

use juris_scenario_schema::{
    ActionId, Condition, Effect, JudicialResult, MatterLifecycleStatus, ScenarioDefinition,
    StageId, StageKind, SCENARIO_SCHEMA_VERSION_V1,
};

const MINIMAL_SCENARIO: &str =
    include_str!("../../../content/fixtures/valid/minimal-scenario.yaml");

#[test]
fn minimal_yaml_deserializes_into_scenario_definition() {
    // This test proves that a human-readable YAML scenario can be loaded
    // through the public schema API without depending on engine internals.
    let scenario: ScenarioDefinition =
        serde_yaml::from_str(MINIMAL_SCENARIO).expect("minimal YAML must deserialize");

    assert_eq!(scenario.schema_version, SCENARIO_SCHEMA_VERSION_V1);
    assert_eq!(scenario.metadata.id.as_str(), "minimal-scenario");
    assert_eq!(scenario.initial_stage, StageId::from("intake"));
    assert_eq!(scenario.stages.len(), 2);
    assert_eq!(scenario.actions.len(), 1);
    assert_eq!(scenario.events.len(), 1);
    assert_eq!(scenario.outcomes.len(), 1);
}

#[test]
fn yaml_round_trip_preserves_the_complete_definition() {
    // This test proves that serialization does not discard references,
    // conditions, effects, or typed identifiers.
    //
    // Deterministic runtime behaviour will later depend on the compiled form,
    // but schema round-tripping must preserve the source definition exactly.
    let original: ScenarioDefinition =
        serde_yaml::from_str(MINIMAL_SCENARIO).expect("minimal YAML must deserialize");

    let serialized =
        serde_yaml::to_string(&original).expect("scenario must serialize back to YAML");

    let restored: ScenarioDefinition =
        serde_yaml::from_str(&serialized).expect("serialized YAML must deserialize");

    assert_eq!(restored, original);
}

#[test]
fn typed_identifiers_serialize_as_plain_yaml_scalars() {
    // This test proves that strong Rust typing does not make scenario YAML
    // verbose or implementation-specific.
    let action_id = ActionId::from("request-expert-report");

    let serialized = serde_yaml::to_string(&action_id).expect("typed ID must serialize");

    assert_eq!(serialized.trim(), "request-expert-report");
}

#[test]
fn judicial_result_effect_and_condition_round_trip() {
    let effect = Effect::SetJudicialResult {
        result: JudicialResult::PartiallyWon,
    };
    let condition = Condition::JudicialResultIs {
        result: JudicialResult::Lost,
    };

    let effect_json = serde_json::to_string(&effect).expect("effect must serialize");
    let condition_json = serde_json::to_string(&condition).expect("condition must serialize");

    assert_eq!(
        effect_json,
        r#"{"type":"set_judicial_result","result":"partially_won"}"#
    );
    assert_eq!(
        condition_json,
        r#"{"type":"judicial_result_is","result":"lost"}"#
    );
    assert_eq!(
        serde_json::from_str::<Effect>(&effect_json).expect("effect must deserialize"),
        effect
    );
    assert_eq!(
        serde_json::from_str::<Condition>(&condition_json).expect("condition must deserialize"),
        condition
    );
}

#[test]
fn remedy_stage_kinds_and_lifecycle_use_stable_names() {
    for (kind, lifecycle, expected_kind, expected_lifecycle) in [
        (
            StageKind::Appeal,
            MatterLifecycleStatus::Appeal,
            "\"appeal\"",
            "\"appeal\"",
        ),
        (
            StageKind::Cassation,
            MatterLifecycleStatus::Cassation,
            "\"cassation\"",
            "\"cassation\"",
        ),
        (
            StageKind::Enforcement,
            MatterLifecycleStatus::Enforcement,
            "\"enforcement\"",
            "\"enforcement\"",
        ),
    ] {
        assert_eq!(serde_json::to_string(&kind).unwrap(), expected_kind);
        assert_eq!(
            serde_json::to_string(&lifecycle).unwrap(),
            expected_lifecycle
        );
    }
}

#[test]
fn existing_scenario_without_judicial_result_remains_compatible() {
    let scenario: ScenarioDefinition =
        serde_yaml::from_str(MINIMAL_SCENARIO).expect("old v1 scenario must deserialize");
    assert_eq!(scenario.schema_version, SCENARIO_SCHEMA_VERSION_V1);
}
