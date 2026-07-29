use std::path::PathBuf;

use juris_scenario_simulator::{ScenarioDocument, ScenarioSimulator, SimulationStatus};

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

const GREENFIRE_PROTECTED_PATH: &[&str] = &[
    "accept_emergency_mandate",
    "issue_legal_hold",
    "run_conflict_assessment",
    "appoint_separate_director_counsel",
    "notify_insurers",
    "retain_independent_fire_expert",
    "open_controlled_regulator_channel",
    "submit_initial_regulatory_response",
    "coordinate_operational_period",
    "review_preliminary_fire_assessment",
    "establish_response_protocol",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "complete_protected_handoff",
];

const GREENFIRE_COMPROMISED_PATH: &[&str] = &[
    "accept_emergency_mandate",
    "coordinate_operational_period",
    "release_unreviewed_documents",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "complete_compromised_handoff",
];

const GOLDENSHELL_COORDINATED_PATH: &[&str] = &[
    "accept_cooperative_mandate",
    "issue_coordinated_legal_hold",
    "preserve_reference_samples",
    "obtain_blocking_decisions",
    "notify_cleaning_contractor",
    "notify_farm_insurers",
    "coordinate_recall_response",
    "request_product_composition_records",
    "retain_independent_residue_expert",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "review_preliminary_residue_assessment",
    "map_common_and_individual_losses",
    "prepare_protective_attachment_strategy",
    "establish_coordinated_claim_protocol",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "complete_coordinated_handoff",
];

const GOLDENSHELL_FRAGMENTED_PATH: &[&str] = &[
    "accept_cooperative_mandate",
    "authorise_recall_without_reference_samples",
    "prioritise_regulator_claim",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "coordinate_operational_period",
    "complete_fragmented_handoff",
];

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
}

#[test]
fn greenfire_protected_path_is_deterministic() {
    let first = run_scenario_path(greenfire_scenario_path(), GREENFIRE_PROTECTED_PATH);
    let second = run_scenario_path(greenfire_scenario_path(), GREENFIRE_PROTECTED_PATH);

    assert_eq!(first, second);
    assert_eq!(first.status, SimulationStatus::Completed);
    assert_eq!(first.final_state.clock_minutes, 4_440);
    assert_eq!(
        first.final_state.resolved_outcome.as_deref(),
        Some("protected_crisis_position")
    );
    assert!(!first
        .fired_events
        .iter()
        .any(|event| event.ends_with("_missed") || event == "expert_assessment_expired"));
}

#[test]
fn greenfire_compromised_path_records_deadlines_and_expiry() {
    let result = run_scenario_path(greenfire_scenario_path(), GREENFIRE_COMPROMISED_PATH);

    assert_eq!(result.status, SimulationStatus::Completed);
    assert_eq!(result.final_state.clock_minutes, 4_590);
    assert_eq!(
        result.final_state.resolved_outcome.as_deref(),
        Some("compromised_crisis_position")
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
    let first = run_scenario_path(goldenshell_scenario_path(), GOLDENSHELL_COORDINATED_PATH);
    let second = run_scenario_path(goldenshell_scenario_path(), GOLDENSHELL_COORDINATED_PATH);

    assert_eq!(first, second);
    assert_eq!(first.status, SimulationStatus::Completed);
    assert_eq!(first.final_state.clock_minutes, 4_545);
    assert_eq!(
        first.final_state.resolved_outcome.as_deref(),
        Some("coordinated_claim_position")
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
    let result = run_scenario_path(goldenshell_scenario_path(), GOLDENSHELL_FRAGMENTED_PATH);

    assert_eq!(result.status, SimulationStatus::Completed);
    assert_eq!(result.final_state.clock_minutes, 4_710);
    assert_eq!(
        result.final_state.resolved_outcome.as_deref(),
        Some("fragmented_claim_position")
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

    let ready_actions = [
        "accept_cooperative_mandate",
        "retain_independent_residue_expert",
        "coordinate_operational_period",
        "coordinate_operational_period",
    ]
    .map(str::to_owned);
    let ready = ScenarioSimulator::new(
        ScenarioDocument::load(goldenshell_scenario_path()).expect("scenario must load"),
    )
    .expect("simulator must initialize")
    .run_actions(&ready_actions, false)
    .expect("expert work must complete deterministically");
    assert_ne!(
        ready.final_state.flags.get("common_causation_model_built"),
        Some(&true)
    );
    assert!(ready
        .fired_events
        .iter()
        .any(|event| event == "residue_assessment_completed"));

    let reviewed_actions = [
        "accept_cooperative_mandate",
        "retain_independent_residue_expert",
        "coordinate_operational_period",
        "coordinate_operational_period",
        "review_preliminary_residue_assessment",
    ]
    .map(str::to_owned);
    let reviewed = ScenarioSimulator::new(
        ScenarioDocument::load(goldenshell_scenario_path()).expect("scenario must load"),
    )
    .expect("simulator must initialize")
    .run_actions(&reviewed_actions, false)
    .expect("ready expert report must be reviewable");
    assert_eq!(
        reviewed
            .final_state
            .flags
            .get("common_causation_model_built"),
        Some(&true)
    );
}
