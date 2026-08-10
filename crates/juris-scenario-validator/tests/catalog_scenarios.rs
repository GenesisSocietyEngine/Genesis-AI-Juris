use juris_scenario_schema::ScenarioDefinition;
use juris_scenario_validator::validate_scenario;

const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const GREENFIRE_SCENARIO: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const GOLDENSHELL_SCENARIO: &str =
    include_str!("../../../content/cases/goldenshell_recall_at_dawn.scenario.json");
const FAILED_ERP_SCENARIO: &str = include_str!("../../../content/cases/failed_erp.scenario.json");
const DESERT_WATER_SCENARIO: &str =
    include_str!("../../../content/cases/desert_water_groundwater_claim.scenario.json");

#[test]
fn playable_catalog_scenarios_pass_core_validation() {
    for (name, encoded) in [
        ("Failed ERP", FAILED_ERP_SCENARIO),
        ("Logistics", LOGISTICS_SCENARIO),
        ("GreenFire", GREENFIRE_SCENARIO),
        ("GoldenShell", GOLDENSHELL_SCENARIO),
        ("Desert Water", DESERT_WATER_SCENARIO),
    ] {
        let scenario: ScenarioDefinition =
            serde_yaml::from_str(encoded).expect("scenario JSON must deserialize");
        let report = validate_scenario(&scenario);
        assert!(
            report.is_valid(),
            "expected valid {name} scenario, got diagnostics: {:#?}",
            report.diagnostics
        );
    }
}

#[test]
fn greenfire_pressure_pilot_has_the_exact_typed_production_contract() {
    let greenfire: ScenarioDefinition =
        serde_json::from_str(GREENFIRE_SCENARIO).expect("GreenFire scenario must deserialize");

    assert_eq!(greenfire.metadata.content_version, "0.2.0");
    assert_eq!(greenfire.pressure_windows.len(), 1);
    let window = &greenfire.pressure_windows[0];
    assert_eq!(window.id.as_str(), "regulator_document_request_pressure");
    assert_eq!(
        window.source_actor_id.as_str(),
        "port_haven_environment_authority"
    );
    assert_eq!(
        window.activation_event_id.as_str(),
        "regulator_request_received"
    );
    assert_eq!(
        window.response_deadline_id.as_str(),
        "initial_regulatory_response_deadline"
    );
    assert_eq!(
        window
            .response_action_ids
            .iter()
            .map(|id| id.as_str())
            .collect::<Vec<_>>(),
        [
            "submit_initial_regulatory_response",
            "release_unreviewed_documents",
        ]
    );
    assert_eq!(
        window.countermove_event_id.as_str(),
        "regulatory_response_missed"
    );

    assert!(greenfire
        .actors
        .iter()
        .any(|actor| actor.id == window.source_actor_id));
    assert!(greenfire
        .events
        .iter()
        .any(|event| event.id == window.activation_event_id));
    assert!(greenfire
        .events
        .iter()
        .any(|event| event.id == window.countermove_event_id));

    let deadline = greenfire
        .deadlines
        .iter()
        .find(|deadline| deadline.id == window.response_deadline_id)
        .expect("pressure deadline must exist");
    assert_eq!(deadline.due_at.day, 1);
    assert_eq!(deadline.due_at.minute_of_day, 720);
    assert!(!deadline.completion_at_due_allowed);
    assert_eq!(
        deadline.activation_event.as_ref(),
        Some(&window.activation_event_id)
    );
    assert_eq!(
        deadline
            .completion_actions
            .iter()
            .map(|id| id.as_str())
            .collect::<Vec<_>>(),
        [
            "submit_initial_regulatory_response",
            "release_unreviewed_documents",
        ]
    );
    assert_eq!(deadline.missed_event, window.countermove_event_id);

    for action_id in &window.response_action_ids {
        let action = greenfire
            .actions
            .iter()
            .find(|action| action.id == *action_id)
            .expect("pressure response action must exist");
        assert_eq!(action.time_cost_minutes, 180);
        assert!(action.advance_to_deadlines.is_empty());
        assert_eq!(
            action
                .completion_deadlines
                .iter()
                .map(|id| id.as_str())
                .collect::<Vec<_>>(),
            ["initial_regulatory_response_deadline"]
        );
    }

    for (name, encoded) in [
        ("Failed ERP", FAILED_ERP_SCENARIO),
        ("Logistics", LOGISTICS_SCENARIO),
        ("GoldenShell", GOLDENSHELL_SCENARIO),
        ("Desert Water", DESERT_WATER_SCENARIO),
    ] {
        let raw: serde_json::Value = serde_json::from_str(encoded)
            .unwrap_or_else(|error| panic!("{name} raw scenario must deserialize: {error}"));
        assert!(
            raw.get("pressure_windows").is_none(),
            "{name} must preserve default key omission"
        );
        let scenario: ScenarioDefinition = serde_json::from_str(encoded)
            .unwrap_or_else(|error| panic!("{name} scenario must deserialize: {error}"));
        assert!(
            scenario.pressure_windows.is_empty(),
            "{name} must not gain a production pressure window"
        );
    }
}
