//! Regression coverage for deterministic decision and event effect routers.

use juris_scenario_schema::ScenarioDefinition;
use juris_scenario_validator::{validate_scenario, DiagnosticCode};
use serde_json::{json, Value};

const MINIMAL_SCENARIO: &str =
    include_str!("../../../content/fixtures/valid/minimal-scenario.yaml");

fn minimal_value() -> Value {
    let scenario: ScenarioDefinition =
        serde_yaml::from_str(MINIMAL_SCENARIO).expect("minimal scenario must deserialize");
    serde_json::to_value(scenario).expect("minimal scenario must serialize")
}

fn parse(value: Value) -> ScenarioDefinition {
    serde_json::from_value(value).expect("mutated scenario must remain schema-valid")
}

#[test]
fn decision_and_triggered_event_closure_satisfies_generic_validators() {
    let mut value = minimal_value();
    value["actions"][0]["effects"] = json!([
        {"type": "start_async_task", "task": "routed_task"},
        {"type": "resolve_deterministic_decision", "decision": "route_closure"}
    ]);
    value["deterministic_decisions"] = json!([{
        "id": "route_closure",
        "roll_range": 1,
        "branches": [{
            "id": "selected_route",
            "effects": [{"type": "trigger_event", "event": "routed_cleanup"}]
        }]
    }]);
    value["async_tasks"] = json!([{
        "id": "routed_task",
        "title": "Routed task",
        "start_action": "close-matter",
        "completion_event": "routed_task_ready",
        "duration_minutes": 30
    }]);
    value["inbox_items"] = json!([{
        "id": "routed_required_item",
        "subject": "Response required",
        "body": "The selected route resolves this item.",
        "initially_visible": true,
        "action_required": true,
        "resolution_actions": ["close-matter"]
    }]);
    value["events"]
        .as_array_mut()
        .expect("events must be an array")
        .extend([
            json!({
                "id": "routed_cleanup",
                "title": "Routed cleanup",
                "kind": "generic",
                "trigger": {"type": "by_effect"},
                "effects": [
                    {"type": "review_async_task", "task": "routed_task"},
                    {"type": "resolve_inbox_item", "item": "routed_required_item"},
                    {"type": "set_stage", "stage": "resolved"},
                    {"type": "trigger_event", "event": "matter-closed"}
                ]
            }),
            json!({
                "id": "routed_task_ready",
                "title": "Routed task ready",
                "kind": "generic",
                "trigger": {"type": "async_task_completed", "task": "routed_task"},
                "effects": [{"type": "mark_async_task_ready", "task": "routed_task"}]
            }),
        ]);

    let report = validate_scenario(&parse(value));
    assert!(
        report.is_valid(),
        "decision → event closure must satisfy stage exit, event trigger, Inbox resolution, async lifecycle, and terminalization checks: {:#?}",
        report.diagnostics
    );
}

#[test]
fn invalid_decision_cycle_is_traversed_defensively() {
    let mut value = minimal_value();
    value["actions"][0]["effects"]
        .as_array_mut()
        .expect("effects must be an array")
        .push(json!({"type": "resolve_deterministic_decision", "decision": "cycle_a"}));
    value["deterministic_decisions"] = json!([
        {
            "id": "cycle_a",
            "roll_range": 1,
            "branches": [{
                "id": "to_b",
                "effects": [{"type": "resolve_deterministic_decision", "decision": "cycle_b"}]
            }]
        },
        {
            "id": "cycle_b",
            "roll_range": 1,
            "branches": [{
                "id": "to_a",
                "effects": [{"type": "resolve_deterministic_decision", "decision": "cycle_a"}]
            }]
        }
    ]);

    let report = validate_scenario(&parse(value));
    assert!(report
        .error_codes()
        .contains(&DiagnosticCode::InvalidDecisionDefinition));
}

#[test]
fn sibling_decision_branch_cannot_borrow_terminal_outcome() {
    let mut value = minimal_value();
    value["actions"][0]["effects"] = json!([{
        "type": "resolve_deterministic_decision",
        "decision": "terminal_choice"
    }]);
    value["deterministic_decisions"] = json!([{
        "id": "terminal_choice",
        "roll_range": 1,
        "branches": [
            {
                "id": "valid_closure",
                "effects": [
                    {"type": "set_stage", "stage": "resolved"},
                    {"type": "trigger_event", "event": "matter-closed"}
                ]
            },
            {
                "id": "missing_outcome",
                "effects": [{"type": "set_stage", "stage": "resolved"}]
            }
        ]
    }]);

    let report = validate_scenario(&parse(value));
    assert!(report
        .error_codes()
        .contains(&DiagnosticCode::ResolvedWithoutOutcome));
}

#[test]
fn async_expiry_by_effect_is_a_declared_trigger_and_terminalizer() {
    let mut value = minimal_value();
    value["actions"][0]["effects"]
        .as_array_mut()
        .expect("effects must be an array")
        .insert(
            0,
            json!({"type": "start_async_task", "task": "expiring_task"}),
        );
    value["async_tasks"] = json!([{
        "id": "expiring_task",
        "title": "Expiring task",
        "start_action": "close-matter",
        "completion_event": "expiring_task_ready",
        "duration_minutes": 30,
        "usable_until_event": "matter-closed",
        "expiry_event": "expiring_task_expired"
    }]);
    value["events"]
        .as_array_mut()
        .expect("events must be an array")
        .extend([
            json!({
                "id": "expiring_task_ready",
                "title": "Expiring task ready",
                "kind": "generic",
                "trigger": {"type": "async_task_completed", "task": "expiring_task"},
                "effects": [{"type": "mark_async_task_ready", "task": "expiring_task"}]
            }),
            json!({
                "id": "expiring_task_expired",
                "title": "Expiring task expired",
                "kind": "generic",
                "trigger": {"type": "by_effect"},
                "effects": [{"type": "expire_async_task", "task": "expiring_task"}]
            }),
        ]);

    let report = validate_scenario(&parse(value));
    assert!(report.is_valid(), "{:#?}", report.diagnostics);
}
