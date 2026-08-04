use std::path::PathBuf;

use juris_scenario_simulator::{
    ScenarioDocument, ScenarioSimulator, ScenarioTraceCommand, SimulationStatus,
};
use serde::Deserialize;

#[derive(Debug, Deserialize, PartialEq, Eq)]
struct ActionEconomics {
    id: String,
    time_cost_minutes: u32,
    cost_eur: u32,
    billable_minutes: u32,
}

#[derive(Debug, Deserialize)]
struct FailedErpActionInventory {
    scenario_id: String,
    legacy_actions: Vec<ActionEconomics>,
    lifecycle_continuations: Vec<ActionEconomics>,
    excluded_dead_aliases: Vec<String>,
}

fn logistics_scenario_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../content/cases/unpaid_logistics_invoices.scenario.json")
}

fn greenfire_scenario_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../content/cases/greenfire_first_72_hours.scenario.json")
}

fn goldenshell_scenario_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../content/cases/goldenshell_recall_at_dawn.scenario.json")
}

fn failed_erp_scenario_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../content/cases/failed_erp.scenario.json")
}

fn run_path(actions: &[&str]) -> juris_scenario_simulator::SimulationResult {
    run_scenario_path(logistics_scenario_path(), actions)
}

fn run_scenario_path(
    scenario_path: PathBuf,
    actions: &[&str],
) -> juris_scenario_simulator::SimulationResult {
    let document = ScenarioDocument::load(scenario_path).expect("scenario must load");
    let actions = actions
        .iter()
        .map(|action| (*action).to_owned())
        .collect::<Vec<_>>();

    ScenarioSimulator::new(document)
        .expect("simulator must initialize")
        .run_actions(&actions, true)
        .expect("reference path must reach an outcome")
}

fn trace_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../content/traces")
        .join(name)
}

fn run_scenario_commands(
    scenario_path: PathBuf,
    commands_path: PathBuf,
) -> juris_scenario_simulator::SimulationResult {
    let document = ScenarioDocument::load(scenario_path).expect("scenario must load");
    let commands: Vec<ScenarioTraceCommand> =
        serde_json::from_slice(&std::fs::read(commands_path).expect("trace must be readable"))
            .expect("trace must parse");

    ScenarioSimulator::new(document)
        .expect("simulator must initialize")
        .run_commands(&commands, true)
        .expect("reference trace must reach an outcome")
}

#[test]
fn failed_erp_preserves_the_executable_legacy_action_inventory() {
    let inventory_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../content/fixtures/failed_erp_legacy_action_inventory.json");
    let inventory: FailedErpActionInventory =
        serde_json::from_slice(&std::fs::read(inventory_path).expect("inventory must be readable"))
            .expect("inventory must parse");
    let definition: serde_json::Value = serde_json::from_slice(
        &std::fs::read(failed_erp_scenario_path()).expect("Failed ERP must be readable"),
    )
    .expect("Failed ERP must parse");

    assert_eq!(definition["metadata"]["id"], inventory.scenario_id);
    let actual = definition
        .get("actions")
        .and_then(serde_json::Value::as_array)
        .expect("Failed ERP actions must be an array")
        .iter()
        .map(|action| ActionEconomics {
            id: action["id"]
                .as_str()
                .expect("action ID must be a string")
                .to_owned(),
            time_cost_minutes: action["time_cost_minutes"].as_u64().unwrap_or(0) as u32,
            cost_eur: action["cost_eur"].as_u64().unwrap_or(0) as u32,
            billable_minutes: action["billable_minutes"].as_u64().unwrap_or(0) as u32,
        })
        .collect::<Vec<_>>();
    let expected = inventory
        .legacy_actions
        .into_iter()
        .chain(inventory.lifecycle_continuations)
        .collect::<Vec<_>>();

    assert_eq!(actual, expected);
    for dead_alias in inventory.excluded_dead_aliases {
        assert!(
            definition["actions"]
                .as_array()
                .expect("Failed ERP actions must be an array")
                .iter()
                .all(|action| action["id"].as_str() != Some(dead_alias.as_str())),
            "dead legacy alias `{dead_alias}` must stay excluded"
        );
    }
}

#[test]
fn logistics_negotiated_recovery_path_is_deterministic() {
    let actions = [
        "audit_claim_file",
        "issue_formal_demand",
        "accept_negotiated_payment",
    ];
    let first = run_path(&actions);
    let second = run_path(&actions);

    assert_eq!(first, second);
    assert_eq!(first.status, SimulationStatus::Completed);
    assert_eq!(first.final_state.stage, "resolved");
    assert_eq!(
        first.final_state.resolved_outcome.as_deref(),
        Some("negotiated_recovery")
    );
    assert_eq!(first.final_state.clock_minutes, 270);
    assert_eq!(first.trace.len(), 3);
    assert!(first.fired_events.is_empty());
}

#[test]
fn logistics_judgment_recovery_path_is_deterministic() {
    let result = run_path(&[
        "audit_claim_file",
        "issue_formal_demand",
        "request_judgment",
        "enforce_judgment",
    ]);

    assert_eq!(result.status, SimulationStatus::Completed);
    assert_eq!(result.final_state.stage, "resolved");
    assert_eq!(
        result.final_state.resolved_outcome.as_deref(),
        Some("judgment_recovery")
    );
    assert_eq!(result.final_state.clock_minutes, 480);
    assert_eq!(result.fired_events, vec!["judgment_for_velmont"]);
    assert_eq!(result.trace.len(), 5);
}

#[test]
fn greenfire_protected_path_is_deterministic() {
    let first = run_scenario_commands(
        greenfire_scenario_path(),
        trace_path("greenfire_protected.commands.json"),
    );
    let second = run_scenario_commands(
        greenfire_scenario_path(),
        trace_path("greenfire_protected.commands.json"),
    );

    assert_eq!(first, second);
    assert_eq!(first.status, SimulationStatus::Completed);
    assert_eq!(first.final_state.clock_minutes, 4_440);
    assert_eq!(
        first.final_state.resolved_outcome.as_deref(),
        Some("protected_crisis_position")
    );
    assert_eq!(first.trace.len(), 26);
    assert_eq!(
        first.fired_events,
        [
            "expert_assessment_completed",
            "handoff_window_opened",
            "mandate_accepted",
            "regulator_request_received",
            "response_protocol_established",
        ]
        .map(str::to_owned)
    );
    assert!(!first
        .fired_events
        .iter()
        .any(|event| event.ends_with("_missed") || event == "expert_assessment_expired"));
}

#[test]
fn greenfire_compromised_path_records_deadlines_and_expiry() {
    let result = run_scenario_commands(
        greenfire_scenario_path(),
        trace_path("greenfire_compromised.commands.json"),
    );

    assert_eq!(result.status, SimulationStatus::Completed);
    assert_eq!(result.final_state.clock_minutes, 4_590);
    assert_eq!(
        result.final_state.resolved_outcome.as_deref(),
        Some("compromised_crisis_position")
    );
    assert_eq!(result.trace.len(), 21);
    assert_eq!(
        result.fired_events,
        [
            "expert_assessment_expired",
            "handoff_window_opened",
            "insurance_notice_missed",
            "legal_hold_missed",
            "mandate_accepted",
            "regulator_request_received",
        ]
        .map(str::to_owned)
    );
    for event in [
        "legal_hold_missed",
        "insurance_notice_missed",
        "expert_assessment_expired",
    ] {
        assert!(result.fired_events.iter().any(|item| item == event));
    }
}

#[test]
fn greenfire_handoff_is_unavailable_before_the_window_event() {
    let document = ScenarioDocument::load(greenfire_scenario_path()).expect("scenario must load");
    let actions = ["accept_emergency_mandate", "complete_compromised_handoff"]
        .into_iter()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let error = ScenarioSimulator::new(document)
        .expect("simulator must initialize")
        .run_actions(&actions, false)
        .expect_err("handoff must remain unavailable before minute 4320");

    assert!(matches!(
        error,
        juris_scenario_simulator::SimulationError::ActionUnavailable { .. }
    ));
}

#[test]
fn goldenshell_coordinated_path_is_deterministic() {
    let first = run_scenario_commands(
        goldenshell_scenario_path(),
        trace_path("goldenshell_coordinated.commands.json"),
    );
    let second = run_scenario_commands(
        goldenshell_scenario_path(),
        trace_path("goldenshell_coordinated.commands.json"),
    );

    assert_eq!(first, second);
    assert_eq!(first.status, SimulationStatus::Completed);
    assert_eq!(first.final_state.clock_minutes, 4_545);
    assert_eq!(
        first.final_state.resolved_outcome.as_deref(),
        Some("coordinated_claim_position")
    );
    assert_eq!(first.trace.len(), 29);
    assert_eq!(
        first.fired_events,
        [
            "claim_protocol_established",
            "contractor_denial_received",
            "cooperative_mandate_accepted",
            "handoff_window_opened",
            "residue_assessment_completed",
            "retailer_recall_demand_received",
        ]
        .map(str::to_owned)
    );
    assert_eq!(
        first.final_state.flags.get("common_causation_model_built"),
        Some(&true)
    );
    assert!(!first
        .fired_events
        .iter()
        .any(|event| event.ends_with("_missed") || event == "residue_assessment_expired"));
}

#[test]
fn goldenshell_fragmented_path_records_missed_notices_and_expiry() {
    let result = run_scenario_commands(
        goldenshell_scenario_path(),
        trace_path("goldenshell_fragmented.commands.json"),
    );

    assert_eq!(result.status, SimulationStatus::Completed);
    assert_eq!(result.final_state.clock_minutes, 4_710);
    assert_eq!(
        result.final_state.resolved_outcome.as_deref(),
        Some("fragmented_claim_position")
    );
    assert_eq!(result.trace.len(), 23);
    assert_eq!(
        result.fired_events,
        [
            "contractor_notice_missed",
            "cooperative_mandate_accepted",
            "handoff_window_opened",
            "insurance_notice_missed",
            "residue_assessment_expired",
            "retailer_recall_demand_received",
            "retailer_recall_missed",
        ]
        .map(str::to_owned)
    );
    for event in [
        "contractor_notice_missed",
        "insurance_notice_missed",
        "retailer_recall_missed",
        "residue_assessment_expired",
    ] {
        assert!(result.fired_events.iter().any(|item| item == event));
    }
}

#[test]
fn goldenshell_handoff_is_unavailable_before_72_hours() {
    let document = ScenarioDocument::load(goldenshell_scenario_path()).expect("scenario must load");
    let actions = ["accept_cooperative_mandate", "complete_fragmented_handoff"]
        .into_iter()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let error = ScenarioSimulator::new(document)
        .expect("simulator must initialize")
        .run_actions(&actions, false)
        .expect_err("handoff must remain unavailable before minute 4320");

    assert!(matches!(
        error,
        juris_scenario_simulator::SimulationError::ActionUnavailable { .. }
    ));
}

#[test]
fn goldenshell_sample_choices_are_mutually_exclusive() {
    for actions in [
        [
            "accept_cooperative_mandate",
            "preserve_reference_samples",
            "authorise_recall_without_reference_samples",
        ],
        [
            "accept_cooperative_mandate",
            "authorise_recall_without_reference_samples",
            "preserve_reference_samples",
        ],
    ] {
        let document =
            ScenarioDocument::load(goldenshell_scenario_path()).expect("scenario must load");
        let actions = actions.map(str::to_owned);
        let error = ScenarioSimulator::new(document)
            .expect("simulator must initialize")
            .run_actions(&actions, false)
            .expect_err("the second mutually exclusive sample action must fail");
        assert!(matches!(
            error,
            juris_scenario_simulator::SimulationError::ActionUnavailable { .. }
        ));
    }
}

#[test]
fn goldenshell_expert_requires_completion_and_explicit_review() {
    let document = ScenarioDocument::load(goldenshell_scenario_path()).expect("scenario must load");
    let early_actions = [
        "accept_cooperative_mandate",
        "retain_independent_residue_expert",
        "review_preliminary_residue_assessment",
    ]
    .map(str::to_owned);
    let early_error = ScenarioSimulator::new(document)
        .expect("simulator must initialize")
        .run_actions(&early_actions, false)
        .expect_err("expert report must not be reviewable before completion");
    assert!(matches!(
        early_error,
        juris_scenario_simulator::SimulationError::ActionUnavailable { .. }
    ));

    let ready_commands = [
        ScenarioTraceCommand::Dispatch {
            action_id: "accept_cooperative_mandate".to_owned(),
        },
        ScenarioTraceCommand::Dispatch {
            action_id: "retain_independent_residue_expert".to_owned(),
        },
        ScenarioTraceCommand::AdvanceTime { minutes: 720 },
    ];
    let ready = ScenarioSimulator::new(
        ScenarioDocument::load(goldenshell_scenario_path()).expect("scenario must load"),
    )
    .expect("simulator must initialize")
    .run_commands(&ready_commands, false)
    .expect("expert work must complete deterministically");
    assert_ne!(
        ready.final_state.flags.get("common_causation_model_built"),
        Some(&true)
    );
    assert!(ready
        .fired_events
        .iter()
        .any(|event| event == "residue_assessment_completed"));

    let reviewed_commands = [
        ScenarioTraceCommand::Dispatch {
            action_id: "accept_cooperative_mandate".to_owned(),
        },
        ScenarioTraceCommand::Dispatch {
            action_id: "retain_independent_residue_expert".to_owned(),
        },
        ScenarioTraceCommand::AdvanceTime { minutes: 720 },
        ScenarioTraceCommand::Dispatch {
            action_id: "review_preliminary_residue_assessment".to_owned(),
        },
    ];
    let reviewed = ScenarioSimulator::new(
        ScenarioDocument::load(goldenshell_scenario_path()).expect("scenario must load"),
    )
    .expect("simulator must initialize")
    .run_commands(&reviewed_commands, false)
    .expect("ready expert report must be reviewable");
    assert_eq!(
        reviewed
            .final_state
            .flags
            .get("common_causation_model_built"),
        Some(&true)
    );
}
