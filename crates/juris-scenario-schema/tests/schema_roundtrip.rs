//! Integration tests for the public schema API.
//!
//! These tests intentionally use YAML from the repository content directory.
//! This proves that the public Rust types and the human-authored scenario
//! format remain compatible.

use juris_scenario_schema::{
    ActionId, Condition, DeterministicDecisionDefinition, Effect, JudicialDecisionInstance,
    JudicialResult, MatterLifecycleStatus, ScenarioClockMode, ScenarioDefinition, StageId,
    StageKind, SCENARIO_SCHEMA_VERSION_V1,
};
use serde_json::json;

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
    assert_eq!(scenario.clock.mode, ScenarioClockMode::ActionDriven);
    assert_eq!(scenario.stages.len(), 2);
    assert_eq!(scenario.actions.len(), 1);
    assert_eq!(scenario.events.len(), 1);
    assert_eq!(scenario.outcomes.len(), 1);
}

#[test]
fn foreground_clock_policy_round_trips_additively() {
    let mut scenario: ScenarioDefinition =
        serde_yaml::from_str(MINIMAL_SCENARIO).expect("minimal YAML must deserialize");
    scenario.clock.mode = ScenarioClockMode::Foreground;

    let encoded = serde_yaml::to_string(&scenario).expect("scenario must serialize");
    let restored: ScenarioDefinition =
        serde_yaml::from_str(&encoded).expect("scenario must deserialize");

    assert_eq!(restored.clock.mode, ScenarioClockMode::Foreground);
    assert!(encoded.contains("clock:\n  mode: foreground"));
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
fn judicial_decision_instances_use_stable_names_and_stage_mapping() {
    for (stage, instance, encoded) in [
        (
            StageKind::Hearing,
            JudicialDecisionInstance::FirstInstance,
            "\"first_instance\"",
        ),
        (
            StageKind::Appeal,
            JudicialDecisionInstance::Appeal,
            "\"appeal\"",
        ),
        (
            StageKind::Cassation,
            JudicialDecisionInstance::Cassation,
            "\"cassation\"",
        ),
    ] {
        assert_eq!(JudicialDecisionInstance::from_stage(stage, None), instance);
        assert_eq!(serde_json::to_string(&instance).unwrap(), encoded);
    }

    assert_eq!(
        JudicialDecisionInstance::from_stage(
            StageKind::Enforcement,
            Some(JudicialDecisionInstance::Appeal),
        ),
        JudicialDecisionInstance::Appeal
    );
    assert_eq!(
        JudicialDecisionInstance::from_stage(
            StageKind::Resolved,
            Some(JudicialDecisionInstance::Cassation),
        ),
        JudicialDecisionInstance::Cassation
    );
    assert_eq!(
        JudicialDecisionInstance::from_stage(StageKind::Enforcement, None),
        JudicialDecisionInstance::FirstInstance
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

#[test]
fn absent_runtime_extensions_do_not_change_serialized_definition_shape() {
    let scenario: ScenarioDefinition =
        serde_yaml::from_str(MINIMAL_SCENARIO).expect("old scenario must deserialize");
    let encoded = serde_json::to_value(&scenario).expect("scenario must serialize");
    let object = encoded.as_object().unwrap();

    for key in [
        "numeric_metrics",
        "foreground_metric_rates",
        "initial_resources",
        "deterministic_decisions",
    ] {
        assert!(!object.contains_key(key), "unexpected additive key {key}");
    }
    let action = encoded["actions"][0].as_object().unwrap();
    for key in ["billable_minutes", "presentation_tags"] {
        assert!(!action.contains_key(key), "unexpected additive key {key}");
    }
}

#[test]
fn absent_inbox_sender_is_omitted_from_the_serialized_shape() {
    let inbox: juris_scenario_schema::InboxItemDefinition = serde_json::from_value(json!({
        "id": "message",
        "subject": "Subject",
        "body": "Body"
    }))
    .unwrap();
    let encoded = serde_json::to_value(inbox).unwrap();
    assert!(!encoded.as_object().unwrap().contains_key("sender"));
}

#[test]
fn deterministic_integer_shapes_round_trip_stably() {
    let decision: DeterministicDecisionDefinition = serde_json::from_value(json!({
        "id": "judgment",
        "roll_range": 31,
        "roll_offset": -15,
        "roll_multiplier": 100,
        "score_terms": [{
            "operand": {"source": "metric", "metric": "evidence"},
            "multiplier": 20,
            "condition": {"type": "always"},
            "maximum": 55
        }],
        "score_divisor": 100,
        "score_offset": 50,
        "branches": [{
            "id": "favorable",
            "condition": {
                "type": "integer_compare",
                "left": {"source": "resource", "resource": "authorized_budget_eur"},
                "operator": "greater_than_or_equal",
                "right": {"source": "resource", "resource": "spend_eur", "offset": 1000}
            },
            "minimum_total": 60,
            "effects": [{"type": "set_flag", "flag": "won", "value": true}]
        }]
    }))
    .expect("extended decision must deserialize");

    let restored: DeterministicDecisionDefinition =
        serde_json::from_value(serde_json::to_value(&decision).unwrap()).unwrap();
    assert_eq!(restored, decision);
}
