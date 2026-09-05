use std::collections::{BTreeMap, BTreeSet};

use juris_engine::{ScenarioRuntimeError, ScenarioSession};
use juris_scenario_schema::{
    JudicialDecisionInstance, JudicialResult, MatterLifecycleStatus, ScenarioDefinition,
};
use juris_scenario_simulator::{
    ScenarioDocument, ScenarioSimulator, ScenarioTraceCommand, SimulationResult, SimulationStatus,
};
use serde::Deserialize;

const FAILED_ERP: &str = include_str!("../../../content/cases/failed_erp.scenario.json");
const LIFECYCLE_MATRIX: &str =
    include_str!("../../../content/traces/failed_erp_lifecycle_matrix.json");

#[derive(Debug, Deserialize)]
struct LifecycleMatrix {
    scenario_id: String,
    scenario_fingerprint: String,
    procedural_default_cure: ProceduralDefaultCure,
    cases: Vec<LifecycleCase>,
}

#[derive(Debug, Deserialize)]
struct ProceduralDefaultCure {
    instantiated: bool,
    reason: String,
}

#[derive(Debug, Deserialize)]
struct LifecycleCase {
    id: String,
    seed: u64,
    commands: Vec<ScenarioTraceCommand>,
    expected: ExpectedState,
}

#[derive(Debug, Deserialize)]
struct ExpectedState {
    status: SimulationStatus,
    clock_minutes: u64,
    stage: String,
    judicial_result: Option<JudicialResult>,
    judicial_decision_instance: Option<JudicialDecisionInstance>,
    matter_lifecycle: MatterLifecycleStatus,
    outcome: Option<String>,
    is_closed: bool,
    resources: BTreeMap<String, i64>,
    final_state_digest: String,
    open_deadlines: Vec<String>,
    open_tasks: Vec<String>,
    action_required_inbox: Vec<String>,
}

fn definition() -> ScenarioDefinition {
    serde_json::from_str(FAILED_ERP).expect("Failed ERP scenario must parse")
}

fn matrix() -> LifecycleMatrix {
    serde_json::from_str(LIFECYCLE_MATRIX).expect("lifecycle matrix must parse")
}

fn simulate(seed: u64, commands: &[ScenarioTraceCommand]) -> SimulationResult {
    let document = ScenarioDocument::from_value(
        serde_json::from_str(FAILED_ERP).expect("Failed ERP scenario JSON must parse"),
    )
    .expect("scenario document must load");
    ScenarioSimulator::new_with_seed(document, seed)
        .expect("simulator must initialize")
        .run_commands(commands, false)
        .expect("canonical lifecycle path must execute")
}

fn replay(seed: u64, commands: &[ScenarioTraceCommand]) -> ScenarioSession {
    let mut session =
        ScenarioSession::new(definition(), seed).expect("authoritative session must initialize");
    for command in commands {
        match command {
            ScenarioTraceCommand::Dispatch { action_id } => {
                session
                    .dispatch(action_id)
                    .expect("canonical action must execute");
            }
            ScenarioTraceCommand::AdvanceTime { minutes } => {
                session
                    .advance_time(*minutes)
                    .expect("canonical clock command must execute");
            }
        }
    }
    session
}

fn open_deadlines(result: &SimulationResult) -> Vec<String> {
    result
        .deadline_statuses
        .iter()
        .filter(|(_, status)| status.as_deref() == Some("open"))
        .map(|(id, _)| id.clone())
        .collect()
}

fn open_tasks(result: &SimulationResult) -> Vec<String> {
    result
        .async_task_statuses
        .iter()
        .filter(|(_, status)| matches!(status.as_str(), "in_progress" | "ready"))
        .map(|(id, _)| id.clone())
        .collect()
}

#[test]
fn canonical_lifecycle_matrix_matches_simulator_and_authoritative_runtime() {
    let matrix = matrix();
    assert_eq!(matrix.scenario_id, definition().metadata.id.as_str());
    assert!(
        !matrix.procedural_default_cure.instantiated,
        "the production case must not fabricate a procedural cure"
    );
    assert!(!matrix.procedural_default_cure.reason.trim().is_empty());

    let mut case_ids = BTreeSet::new();
    let mut covered_terminal_outcomes = BTreeSet::new();

    for case in &matrix.cases {
        assert!(case_ids.insert(case.id.as_str()), "duplicate `{}`", case.id);

        let first = simulate(case.seed, &case.commands);
        let second = simulate(case.seed, &case.commands);
        assert_eq!(first, second, "{} must replay deterministically", case.id);

        let mut session = replay(case.seed, &case.commands);
        let snapshot = session.snapshot();
        let expected = &case.expected;

        assert_eq!(
            session.scenario_fingerprint().unwrap(),
            matrix.scenario_fingerprint,
            "{} scenario fingerprint",
            case.id
        );
        assert_eq!(first.status, expected.status, "{} status", case.id);
        assert_eq!(
            first.final_state.clock_minutes, expected.clock_minutes,
            "{} final minute",
            case.id
        );
        assert_eq!(first.final_state.stage, expected.stage, "{} stage", case.id);
        assert_eq!(
            first.final_state.judicial_result, expected.judicial_result,
            "{} judicial result",
            case.id
        );
        assert_eq!(
            first.final_state.judicial_decision_instance, expected.judicial_decision_instance,
            "{} judicial instance",
            case.id
        );
        assert_eq!(
            first.final_state.matter_lifecycle, expected.matter_lifecycle,
            "{} lifecycle",
            case.id
        );
        assert_eq!(
            first.final_state.resolved_outcome, expected.outcome,
            "{} outcome",
            case.id
        );
        assert_eq!(
            first.final_state.is_closed, expected.is_closed,
            "{} closure",
            case.id
        );
        assert_eq!(
            first.final_state.resources, expected.resources,
            "{} resources and spend",
            case.id
        );
        assert_eq!(
            session.final_state_digest().unwrap(),
            expected.final_state_digest,
            "{} authoritative final digest",
            case.id
        );
        assert_eq!(
            open_deadlines(&first),
            expected.open_deadlines,
            "{} open deadlines",
            case.id
        );
        assert_eq!(
            open_tasks(&first),
            expected.open_tasks,
            "{} open async tasks",
            case.id
        );

        let action_required_inbox = snapshot
            .inbox
            .iter()
            .filter(|item| item.visible && item.action_required && !item.resolved)
            .map(|item| item.id.clone())
            .collect::<Vec<_>>();
        assert_eq!(
            action_required_inbox, expected.action_required_inbox,
            "{} unresolved action-required inbox",
            case.id
        );

        assert_eq!(snapshot.clock_minutes, expected.clock_minutes);
        assert_eq!(snapshot.stage_id, expected.stage);
        assert_eq!(snapshot.judicial_result, expected.judicial_result);
        assert_eq!(
            snapshot.judicial_decision_instance,
            expected.judicial_decision_instance
        );
        assert_eq!(snapshot.matter_lifecycle, expected.matter_lifecycle);
        assert_eq!(snapshot.resolved_outcome, expected.outcome);
        assert_eq!(snapshot.is_closed, expected.is_closed);
        assert_eq!(
            snapshot.resources.as_ref(),
            Some(&expected.resources),
            "{} authoritative resources",
            case.id
        );

        if expected.is_closed {
            assert_eq!(expected.status, SimulationStatus::Completed);
            assert!(expected.open_deadlines.is_empty());
            assert!(expected.open_tasks.is_empty());
            assert!(expected.action_required_inbox.is_empty());
            assert!(
                snapshot.available_actions.is_empty(),
                "{} terminal snapshot must expose no action",
                case.id
            );

            let before_snapshot = session.snapshot();
            let before_envelope = session.save_envelope().unwrap();
            let before_digest = session.final_state_digest().unwrap();
            assert_eq!(
                session.dispatch("rest").unwrap_err(),
                ScenarioRuntimeError::ScenarioResolved,
                "{} must reject dispatch after closure",
                case.id
            );
            assert_eq!(
                session.advance_time(1).unwrap_err(),
                ScenarioRuntimeError::ScenarioResolved,
                "{} must reject clock advancement after closure",
                case.id
            );
            assert_eq!(
                session.snapshot(),
                before_snapshot,
                "{} rejected commands must preserve the snapshot",
                case.id
            );
            assert_eq!(
                session.save_envelope().unwrap(),
                before_envelope,
                "{} rejected commands must preserve the command log",
                case.id
            );
            assert_eq!(
                session.final_state_digest().unwrap(),
                before_digest,
                "{} rejected commands must preserve the digest",
                case.id
            );
            covered_terminal_outcomes.insert(
                expected
                    .outcome
                    .as_deref()
                    .expect("every closed matrix case must name its outcome"),
            );
        } else {
            assert_eq!(expected.status, SimulationStatus::InProgress);
            assert_eq!(expected.outcome, None);
        }
    }

    let scenario = definition();
    let defined_outcomes = scenario
        .outcomes
        .iter()
        .map(|outcome| outcome.id.as_str())
        .collect::<BTreeSet<_>>();
    assert_eq!(
        covered_terminal_outcomes, defined_outcomes,
        "the matrix must execute every production terminal outcome"
    );
}

#[test]
fn statement_of_claim_miss_is_the_documented_final_default_boundary() {
    let value: serde_json::Value =
        serde_json::from_str(FAILED_ERP).expect("Failed ERP scenario must parse");
    let event = value["events"]
        .as_array()
        .unwrap()
        .iter()
        .find(|event| event["id"] == "statement_of_claim_missed")
        .expect("statement-of-claim missed event must exist");
    let effects = event["effects"].as_array().unwrap();

    assert!(effects.iter().any(|effect| {
        effect["type"] == "resolve_outcome" && effect["outcome"] == "procedural_default_final"
    }));
    assert!(effects
        .iter()
        .any(|effect| effect["type"] == "set_stage" && effect["stage"] == "resolved"));
    assert!(!matrix().procedural_default_cure.instantiated);
}
