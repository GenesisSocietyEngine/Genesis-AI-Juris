use std::path::PathBuf;

use juris_scenario_schema::{JudicialDecisionInstance, JudicialResult, MatterLifecycleStatus};
use juris_scenario_simulator::{
    ScenarioDocument, ScenarioSimulator, ScenarioTraceCommand, SimulationResult, SimulationStatus,
    TraceKind,
};

fn scenario_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../content/cases/desert_water_groundwater_claim.scenario.json")
}

fn trace_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../content/traces")
        .join(name)
}

fn commands(name: &str) -> Vec<ScenarioTraceCommand> {
    serde_json::from_slice(&std::fs::read(trace_path(name)).expect("trace must be readable"))
        .expect("trace must deserialize")
}

fn run(commands: &[ScenarioTraceCommand], require_outcome: bool) -> SimulationResult {
    ScenarioSimulator::new(
        ScenarioDocument::load(scenario_path()).expect("Desert Water scenario must load"),
    )
    .expect("Desert Water simulator must initialize")
    .run_commands(commands, require_outcome)
    .expect("Desert Water command path must run")
}

fn transition_signature(result: &SimulationResult) -> Vec<(usize, TraceKind, &str)> {
    result
        .trace
        .iter()
        .map(|entry| (entry.sequence, entry.kind, entry.id.as_str()))
        .collect()
}

#[test]
fn coordinated_trace_is_deterministic_and_closes_at_minute_3180() {
    let commands = commands("desert_water_coordinated.commands.json");
    let first = run(&commands, true);
    let second = run(&commands, true);

    assert_eq!(first, second);
    assert_eq!(first.status, SimulationStatus::Completed);
    assert_eq!(first.final_state.stage, "resolved");
    assert_eq!(first.final_state.clock_minutes, 3_180);
    assert_eq!(first.final_state.judicial_result, Some(JudicialResult::Won));
    assert_eq!(
        first.final_state.judicial_decision_instance,
        Some(JudicialDecisionInstance::FirstInstance)
    );
    assert_eq!(
        first.final_state.matter_lifecycle,
        MatterLifecycleStatus::Closed
    );
    assert!(first.final_state.is_closed);
    assert_eq!(
        first.final_state.resolved_outcome.as_deref(),
        Some("credible_source_and_remedy")
    );
    // The trace order is the replay contract. It intentionally records an
    // event before the action that queued it because effects are processed
    // before the action transition itself is appended.
    assert_eq!(
        transition_signature(&first),
        vec![
            (0, TraceKind::Event, "mandate_accepted"),
            (1, TraceKind::Action, "accept_residents_mandate"),
            (2, TraceKind::Action, "commission_defensible_sampling"),
            (
                3,
                TraceKind::Event,
                "operator_preservation_response_received",
            ),
            (4, TraceKind::Action, "demand_plant_record_preservation"),
            (5, TraceKind::Action, "interview_affected_residents"),
            (6, TraceKind::Action, "map_wells_and_exposure_periods"),
            (7, TraceKind::Action, "obtain_regulatory_records"),
            (8, TraceKind::Action, "obtain_cooling_and_disposal_records"),
            (9, TraceKind::Action, "retain_independent_hydrogeologist"),
            (10, TraceKind::Action, "test_alternative_source_defence"),
            (11, TraceKind::Action, "investigate_corporate_notice"),
            (12, TraceKind::Action, "protect_limitation_period"),
            (13, TraceKind::AdvanceTime, "360"),
            (14, TraceKind::Event, "hydrogeology_assessment_completed",),
            (15, TraceKind::AdvanceTime, "90"),
            (
                16,
                TraceKind::Action,
                "review_hydrological_source_assessment",
            ),
            (17, TraceKind::Action, "prepare_expert_evidence"),
            (18, TraceKind::Event, "claim_window_opened"),
            (19, TraceKind::AdvanceTime, "1185"),
            (20, TraceKind::Event, "first_instance_hearing_scheduled"),
            (21, TraceKind::Action, "file_evidence_backed_claim"),
            (
                22,
                TraceKind::Event,
                "favorable_first_instance_judgment_delivered",
            ),
            (
                23,
                TraceKind::Action,
                "receive_supported_first_instance_judgment",
            ),
        ]
    );
    // `fired_events` is a canonical set projection (BTree order), not replay
    // order; pinning both prevents a silent change to either public shape.
    assert_eq!(
        first.fired_events,
        vec![
            "claim_window_opened",
            "favorable_first_instance_judgment_delivered",
            "first_instance_hearing_scheduled",
            "hydrogeology_assessment_completed",
            "mandate_accepted",
            "operator_preservation_response_received",
        ]
    );
    assert_eq!(
        first
            .async_task_statuses
            .get("independent_hydrogeology_assessment")
            .map(String::as_str),
        Some("reviewed")
    );
    assert!(!first
        .fired_events
        .iter()
        .any(|event| event == "hydrogeology_assessment_expired"));
    assert!(!first
        .fired_events
        .iter()
        .any(|event| event.ends_with("_missed")));
}

#[test]
fn compromised_trace_is_deterministic_and_closes_at_minute_3510() {
    let commands = commands("desert_water_compromised.commands.json");
    let first = run(&commands, true);
    let second = run(&commands, true);

    assert_eq!(first, second);
    assert_eq!(first.status, SimulationStatus::Completed);
    assert_eq!(first.final_state.stage, "resolved");
    assert_eq!(first.final_state.clock_minutes, 3_510);
    assert_eq!(
        first.final_state.judicial_result,
        Some(JudicialResult::Lost)
    );
    assert_eq!(
        first.final_state.judicial_decision_instance,
        Some(JudicialDecisionInstance::Appeal)
    );
    assert_eq!(
        first.final_state.matter_lifecycle,
        MatterLifecycleStatus::Closed
    );
    assert!(first.final_state.is_closed);
    assert_eq!(
        first.final_state.resolved_outcome.as_deref(),
        Some("compromised_claim_closed")
    );
    assert_eq!(
        transition_signature(&first),
        vec![
            (0, TraceKind::Event, "mandate_accepted"),
            (1, TraceKind::Action, "accept_residents_mandate"),
            (2, TraceKind::Action, "rely_on_unverified_samples"),
            (3, TraceKind::Action, "interview_affected_residents"),
            (4, TraceKind::Event, "plant_record_preservation_missed",),
            (5, TraceKind::AdvanceTime, "511"),
            (6, TraceKind::Event, "limitation_protection_missed"),
            (7, TraceKind::AdvanceTime, "720"),
            (8, TraceKind::AdvanceTime, "1439"),
            (9, TraceKind::Action, "prepare_incomplete_claim"),
            (10, TraceKind::Event, "first_instance_hearing_scheduled"),
            (11, TraceKind::Action, "file_underdeveloped_claim"),
            (
                12,
                TraceKind::Event,
                "adverse_first_instance_judgment_delivered",
            ),
            (
                13,
                TraceKind::Action,
                "receive_adverse_first_instance_judgment",
            ),
            (14, TraceKind::Event, "appeal_filed"),
            (15, TraceKind::Action, "file_appeal"),
            (16, TraceKind::Event, "adverse_appeal_judgment_delivered",),
            (17, TraceKind::Action, "receive_adverse_appeal_judgment",),
            (18, TraceKind::Event, "matter_closed"),
            (19, TraceKind::Event, "hydrogeology_assessment_expired",),
            (20, TraceKind::Action, "close_after_adverse_appeal"),
        ]
    );
    assert_eq!(
        first.fired_events,
        vec![
            "adverse_appeal_judgment_delivered",
            "adverse_first_instance_judgment_delivered",
            "appeal_filed",
            "first_instance_hearing_scheduled",
            "hydrogeology_assessment_expired",
            "limitation_protection_missed",
            "mandate_accepted",
            "matter_closed",
            "plant_record_preservation_missed",
        ]
    );
    assert_eq!(
        first
            .async_task_statuses
            .get("independent_hydrogeology_assessment")
            .map(String::as_str),
        Some("expired")
    );
}

#[test]
fn adverse_judgments_remain_open_until_explicit_closure() {
    let commands = commands("desert_water_compromised.commands.json");

    let first_instance = run(&commands[..9], false);
    assert_eq!(first_instance.status, SimulationStatus::InProgress);
    assert_eq!(first_instance.final_state.clock_minutes, 3_180);
    assert_eq!(first_instance.final_state.stage, "post_judgment_remedies");
    assert_eq!(
        first_instance.final_state.judicial_result,
        Some(JudicialResult::Lost)
    );
    assert_eq!(
        first_instance.final_state.judicial_decision_instance,
        Some(JudicialDecisionInstance::FirstInstance)
    );
    assert_eq!(
        first_instance.final_state.matter_lifecycle,
        MatterLifecycleStatus::PostJudgment
    );
    assert!(!first_instance.final_state.is_closed);
    assert_eq!(
        first_instance
            .deadline_statuses
            .get("appeal_deadline")
            .and_then(Option::as_deref),
        Some("open")
    );
    assert_eq!(first_instance.final_state.resolved_outcome, None);

    let adverse_appeal = run(&commands[..11], false);
    assert_eq!(adverse_appeal.final_state.clock_minutes, 3_480);
    assert_eq!(adverse_appeal.final_state.stage, "appeal");
    assert_eq!(
        adverse_appeal.final_state.judicial_result,
        Some(JudicialResult::Lost)
    );
    assert_eq!(
        adverse_appeal.final_state.judicial_decision_instance,
        Some(JudicialDecisionInstance::Appeal)
    );
    assert_eq!(
        adverse_appeal.final_state.matter_lifecycle,
        MatterLifecycleStatus::Appeal
    );
    assert!(!adverse_appeal.final_state.is_closed);
    assert_eq!(adverse_appeal.final_state.resolved_outcome, None);
}
