use std::collections::BTreeMap;

use juris_engine::ScenarioSession;
use juris_scenario_schema::{JudicialDecisionInstance, ScenarioDefinition};
use juris_scenario_simulator::{
    ScenarioDocument, ScenarioSimulator, ScenarioTraceCommand, SimulationStatus, TraceKind,
};
use serde_json::json;
use serde_json::Value;

const FAILED_ERP: &str = include_str!("../../../content/cases/failed_erp.scenario.json");
const SETTLEMENT_TRACE: &str =
    include_str!("../../../content/traces/failed_erp_settlement.commands.json");
const PREPARED_LITIGATION_TRACE: &str =
    include_str!("../../../content/traces/failed_erp_prepared_litigation.commands.json");
const REMITTAL_TRACE: &str =
    include_str!("../../../content/traces/failed_erp_remittal.commands.json");

fn scenario() -> Value {
    serde_json::from_str(FAILED_ERP).expect("Failed ERP scenario must parse")
}

const WEAK_LITIGATION_TO_CLIENT_BRIEF: [&str; 10] = [
    "accept-immediately",
    "request-documents",
    "reject-settlement",
    "commence-proceedings",
    "prepare-statement-of-claim",
    "prepare-evidence-bundle",
    "wait-until-hearing",
    "attend-hearing",
    "rest",
    "inform-client-judgment",
];

fn assert_terminal_action_parity(
    value: Value,
    seed: u64,
    prefix: &[&str],
    terminal_action: &str,
    expected_minutes: u64,
    expected_outcome: &str,
) {
    let mut actions = prefix.iter().map(|id| (*id).to_owned()).collect::<Vec<_>>();
    actions.push(terminal_action.to_owned());
    let simulated = ScenarioSimulator::new_with_seed(
        ScenarioDocument::from_value(value.clone()).expect("scenario must load"),
        seed,
    )
    .expect("simulator must initialize")
    .run_actions(&actions, true)
    .expect("terminal action path must complete");
    let terminal_trace = simulated
        .trace
        .iter()
        .find(|entry| entry.kind == TraceKind::Action && entry.id == terminal_action)
        .expect("terminal action must be traced");
    assert_eq!(
        terminal_trace.state_after.clock_minutes - terminal_trace.state_before.clock_minutes,
        expected_minutes,
        "simulator must charge the complete terminal action duration"
    );

    let definition: ScenarioDefinition =
        serde_json::from_value(value).expect("typed scenario must parse");
    let mut authoritative =
        ScenarioSession::new(definition, seed).expect("authoritative runtime must initialize");
    for action in prefix {
        authoritative
            .dispatch(action)
            .unwrap_or_else(|error| panic!("authoritative `{action}` must execute: {error}"));
    }
    let clock_before = authoritative.snapshot().clock_minutes;
    authoritative
        .dispatch(terminal_action)
        .expect("authoritative terminal action must execute");
    let authoritative_flags = authoritative.diagnostic_flags().clone();
    let authoritative = authoritative.snapshot();
    assert_eq!(
        authoritative.clock_minutes - clock_before,
        expected_minutes,
        "authoritative runtime must charge the complete terminal action duration"
    );

    assert_eq!(
        simulated.final_state.clock_minutes,
        authoritative.clock_minutes
    );
    assert_eq!(simulated.final_state.stage, authoritative.stage_id);
    assert_eq!(
        simulated.final_state.resolved_outcome.as_deref(),
        Some(expected_outcome)
    );
    assert_eq!(
        simulated.final_state.resolved_outcome,
        authoritative.resolved_outcome
    );
    assert_eq!(simulated.final_state.flags, authoritative_flags);
    assert!(authoritative.flags.is_empty());
    assert_eq!(
        simulated.final_state.numeric_metrics,
        authoritative
            .numeric_metrics
            .expect("metrics must be projected")
    );
    assert_eq!(
        simulated.final_state.resources,
        authoritative
            .resources
            .expect("resources must be projected")
    );
    assert!(simulated.final_state.is_closed && authoritative.is_closed);
    assert!(simulated
        .deadline_statuses
        .values()
        .all(|status| status.as_deref() != Some("open")));
    assert!(simulated
        .async_task_statuses
        .values()
        .all(|status| status != "in_progress" && status != "ready"));
    assert!(authoritative
        .deadlines
        .iter()
        .all(|deadline| deadline.status.as_deref() != Some("open")));
    assert!(authoritative
        .inbox
        .iter()
        .filter(|item| item.action_required)
        .all(|item| item.resolved));
}

fn force_appeal_dismissal(value: &mut Value) {
    let decision = value["deterministic_decisions"]
        .as_array_mut()
        .expect("deterministic decisions must be an array")
        .iter_mut()
        .find(|decision| decision["id"].as_str() == Some("appeal_disposition_roll"))
        .expect("appeal disposition decision must exist");
    for branch in decision["branches"]
        .as_array_mut()
        .expect("appeal disposition branches must be an array")
    {
        match branch["id"].as_str() {
            Some("appeal_allowed") => branch["minimum_roll"] = json!(100),
            Some("appeal_dismissed") => branch["maximum_roll"] = json!(99),
            _ => {}
        }
    }
}

fn force_weak_cassation_grounds(value: &mut Value) {
    let decision = value["deterministic_decisions"]
        .as_array_mut()
        .expect("deterministic decisions must be an array")
        .iter_mut()
        .find(|decision| decision["id"].as_str() == Some("cassation_grounds_assessment"))
        .expect("cassation grounds decision must exist");
    for branch in decision["branches"]
        .as_array_mut()
        .expect("cassation grounds branches must be an array")
    {
        match branch["id"].as_str() {
            Some("grounds_viable") => branch["minimum_total"] = json!(10_000),
            Some("grounds_weak") => branch["maximum_total"] = json!(9_999),
            _ => {}
        }
    }
}

#[test]
fn accepting_first_instance_judgment_charges_full_duration_before_closure() {
    assert_terminal_action_parity(
        scenario(),
        0,
        &WEAK_LITIGATION_TO_CLIENT_BRIEF,
        "accept-judgment-and-close",
        30,
        "first_instance_adverse_final",
    );
}

#[test]
fn declining_appeal_authorization_charges_full_duration_before_closure() {
    let mut value = scenario();
    value["numeric_metrics"]["client_trust"] = json!(0);
    let mut prefix = WEAK_LITIGATION_TO_CLIENT_BRIEF.to_vec();
    prefix.push("prepare-appeal-advice");
    assert_terminal_action_parity(
        value,
        0,
        &prefix,
        "seek-client-appeal-authorization",
        30,
        "first_instance_adverse_final",
    );
}

#[test]
fn accepting_appellate_judgment_charges_full_duration_before_closure() {
    let mut value = scenario();
    force_appeal_dismissal(&mut value);
    let mut prefix = WEAK_LITIGATION_TO_CLIENT_BRIEF.to_vec();
    prefix.extend([
        "prepare-appeal-advice",
        "seek-client-appeal-authorization",
        "file-appeal",
        "await-appeal-decision",
    ]);
    assert_terminal_action_parity(
        value,
        0,
        &prefix,
        "accept-appellate-judgment",
        30,
        "appeal_loss_final",
    );
}

#[test]
fn declining_cassation_authorization_charges_full_duration_before_closure() {
    let mut value = scenario();
    force_appeal_dismissal(&mut value);
    force_weak_cassation_grounds(&mut value);
    let mut prefix = WEAK_LITIGATION_TO_CLIENT_BRIEF.to_vec();
    prefix.extend([
        "prepare-appeal-advice",
        "seek-client-appeal-authorization",
        "file-appeal",
        "await-appeal-decision",
        "assess-cassation-grounds",
    ]);
    assert_terminal_action_parity(
        value,
        0,
        &prefix,
        "seek-client-cassation-authorization",
        30,
        "appeal_loss_final",
    );
}

fn decision<'a>(scenario: &'a Value, id: &str) -> &'a Value {
    scenario["deterministic_decisions"]
        .as_array()
        .expect("deterministic decisions must be an array")
        .iter()
        .find(|decision| decision["id"].as_str() == Some(id))
        .unwrap_or_else(|| panic!("decision `{id}` must exist"))
}

fn branch<'a>(decision: &'a Value, id: &str) -> &'a Value {
    decision["branches"]
        .as_array()
        .expect("decision branches must be an array")
        .iter()
        .find(|branch| branch["id"].as_str() == Some(id))
        .unwrap_or_else(|| panic!("branch `{id}` must exist"))
}

fn metric_multipliers(decision: &Value) -> BTreeMap<&str, i64> {
    decision["score_terms"]
        .as_array()
        .expect("score terms must be an array")
        .iter()
        .filter_map(|term| {
            Some((
                term["operand"]["metric"].as_str()?,
                term["multiplier"].as_i64()?,
            ))
        })
        .collect()
}

#[test]
fn first_instance_fixed_point_edges_match_dart_rounding() {
    let scenario = scenario();
    let judgment = decision(&scenario, "first_instance_judgment");

    // The approved generic hash supplies the deterministic variance, replacing
    // the legacy `seed % n` algorithm. Multiplying that roll by 100 lets the
    // definition compare the unrounded weighted record exactly.
    assert_eq!(judgment["roll_range"], 31);
    assert_eq!(judgment["roll_offset"], -15);
    assert_eq!(judgment["roll_multiplier"], 100);

    let favorable = branch(judgment, "claim_substantially_upheld");
    let mixed = branch(judgment, "mixed_result");
    let dismissed = branch(judgment, "claim_dismissed");
    assert_eq!(favorable["minimum_total"], 5_950);
    assert_eq!(mixed["minimum_total"], 4_950);
    assert_eq!(mixed["maximum_total"], 5_949);
    assert_eq!(dismissed["maximum_total"], 4_949);

    // Dart rounded the positive weighted value before comparing it with 60
    // and 50. Fixed-point comparison at x.50 is exactly equivalent: 59.49
    // remains mixed, 59.50 becomes favorable; 49.49 is dismissed and 49.50
    // becomes mixed.
    for (scaled, expected) in [
        (4_949, "claim_dismissed"),
        (4_950, "mixed_result"),
        (5_949, "mixed_result"),
        (5_950, "claim_substantially_upheld"),
    ] {
        let actual = if scaled >= favorable["minimum_total"].as_i64().unwrap() {
            "claim_substantially_upheld"
        } else if scaled <= dismissed["maximum_total"].as_i64().unwrap() {
            "claim_dismissed"
        } else {
            "mixed_result"
        };
        assert_eq!(actual, expected, "fixed-point score {scaled}");
    }
}

#[test]
fn appeal_and_cassation_thresholds_preserve_executable_formulas() {
    let scenario = scenario();

    let appeal_grounds = decision(&scenario, "appeal_grounds_assessment");
    assert_eq!(
        metric_multipliers(appeal_grounds),
        BTreeMap::from([
            ("ethics", 20),
            ("evidence", 20),
            ("merits", 25),
            ("procedure", 35),
        ])
    );
    assert_eq!(
        branch(appeal_grounds, "grounds_viable")["minimum_total"],
        4_450
    );
    assert_eq!(
        branch(appeal_grounds, "grounds_weak")["maximum_total"],
        4_449
    );

    let appeal_record = decision(&scenario, "appeal_record_assessment");
    assert_eq!(
        metric_multipliers(appeal_record),
        BTreeMap::from([
            ("client_trust", 10),
            ("ethics", 10),
            ("evidence", 25),
            ("merits", 20),
            ("procedure", 35),
        ])
    );
    assert_eq!(
        branch(appeal_record, "record_sufficient")["minimum_total"],
        4_950
    );
    assert_eq!(
        branch(appeal_record, "record_insufficient")["maximum_total"],
        4_949
    );
    let appeal_roll = decision(&scenario, "appeal_disposition_roll");
    assert_eq!(branch(appeal_roll, "appeal_allowed")["minimum_roll"], 70);
    assert_eq!(branch(appeal_roll, "appeal_dismissed")["maximum_roll"], 69);

    let cassation_grounds = decision(&scenario, "cassation_grounds_assessment");
    assert_eq!(
        metric_multipliers(cassation_grounds),
        BTreeMap::from([("ethics", 25), ("merits", 20), ("procedure", 55)])
    );
    assert_eq!(
        branch(cassation_grounds, "grounds_viable")["minimum_total"],
        3_950
    );
    assert_eq!(
        branch(cassation_grounds, "grounds_weak")["maximum_total"],
        3_949
    );

    let counterparty = decision(&scenario, "counterparty_review_choice");
    assert_eq!(
        branch(counterparty, "counterparty_files_cassation")["maximum_roll"],
        34
    );
    assert_eq!(
        branch(counterparty, "judgment_becomes_final")["minimum_roll"],
        35
    );

    let cassation = decision(&scenario, "cassation_disposition");
    assert_eq!(
        branch(cassation, "claimant_judgment_quashed_and_remitted")["maximum_roll"],
        29
    );
    assert_eq!(
        branch(cassation, "counterparty_challenge_dismissed")["maximum_roll"],
        74
    );
    assert_eq!(
        branch(cassation, "limited_review_admitted")["minimum_roll"],
        75
    );

    let limited = decision(&scenario, "limited_review_final_disposition");
    assert_eq!(
        branch(limited, "challenge_finally_dismissed")["maximum_roll"],
        74
    );
    assert_eq!(
        branch(limited, "judgment_quashed_and_remitted")["minimum_roll"],
        75
    );
}

#[test]
fn rest_processes_workday_transition_before_recovery_and_inactivity_policy() {
    let mut scenario = scenario();
    scenario["initial_stage"] = json!("judgment_pending");
    scenario["numeric_metrics"]["inactivity_minutes"] = json!(120);
    // This isolates only the rest/workday causal chain. The production path
    // tests exercise real deadline activation; unrelated initially-open
    // deadlines must not manufacture an unreachable synthetic transition.
    scenario["deadlines"] = json!([]);
    scenario["async_tasks"] = json!([]);

    let result = ScenarioSimulator::new_with_seed(
        ScenarioDocument::from_value(scenario).expect("fixture must load"),
        20_260_724,
    )
    .expect("simulator must initialize")
    .run_actions(&["rest".to_owned()], false)
    .expect("rest must execute");

    assert_eq!(result.final_state.stage, "post_judgment");
    assert_eq!(result.final_state.numeric_metrics["fatigue"], 0);
    assert_eq!(
        result.final_state.numeric_metrics["inactivity_minutes"],
        240
    );
    assert_eq!(
        result.final_state.numeric_metrics["client_warning_level"],
        0
    );

    let workday = result
        .trace
        .iter()
        .position(|entry| entry.kind == TraceKind::Event && entry.id == "workday_update")
        .expect("workday update must fire");
    let recovery = result
        .trace
        .iter()
        .position(|entry| entry.kind == TraceKind::Event && entry.id == "rest_recovery_applied")
        .expect("rest recovery must fire");
    assert!(
        workday < recovery,
        "workday transition must precede recovery"
    );
    assert!(!result
        .final_state
        .flags
        .contains_key("client_engagement_terminated"));
}

#[test]
fn canonical_settlement_trace_is_deterministic_and_economic_projection_is_exact() {
    let commands: Vec<ScenarioTraceCommand> =
        serde_json::from_str(SETTLEMENT_TRACE).expect("settlement trace must parse");
    let run = || {
        ScenarioSimulator::new_with_seed(
            ScenarioDocument::from_value(scenario()).expect("scenario must load"),
            20_260_724,
        )
        .expect("simulator must initialize")
        .run_commands(&commands, true)
        .expect("settlement trace must complete")
    };
    let first = run();
    let second = run();

    assert_eq!(first, second);
    assert_eq!(first.status, SimulationStatus::Completed);
    assert_eq!(first.final_state.stage, "resolved");
    assert_eq!(first.final_state.clock_minutes, 570);
    assert_eq!(
        first.final_state.resolved_outcome.as_deref(),
        Some("settlement_64500")
    );
    assert_eq!(first.final_state.resources["award_eur"], 64_500);
    assert_eq!(first.final_state.resources["spend_eur"], 2_350);
    assert_eq!(first.final_state.resources["billable_minutes"], 540);
    assert_eq!(first.trace.len(), 9);
    assert_eq!(
        first.deadline_statuses["partner_brief_deadline"].as_deref(),
        Some("missed")
    );
    assert_eq!(
        first.deadline_statuses["preservation_deadline"].as_deref(),
        Some("completed")
    );
    assert_eq!(
        first.deadline_statuses["settlement_offer_deadline"].as_deref(),
        Some("completed")
    );
    assert!(first
        .deadline_statuses
        .values()
        .all(|status| status.as_deref() != Some("open")));
    assert!(first.final_state.is_closed);
}

#[test]
fn prepared_litigation_trace_matches_authoritative_engine_at_exact_due_boundaries() {
    let value = scenario();
    let commands: Vec<ScenarioTraceCommand> =
        serde_json::from_str(PREPARED_LITIGATION_TRACE).expect("litigation trace must parse");
    let simulated = ScenarioSimulator::new_with_seed(
        ScenarioDocument::from_value(value.clone()).expect("scenario must load"),
        6,
    )
    .expect("simulator must initialize")
    .run_commands(&commands, true)
    .expect("prepared litigation trace must complete");

    let definition: ScenarioDefinition =
        serde_json::from_value(value).expect("typed scenario must parse");
    let mut authoritative =
        ScenarioSession::new(definition, 6).expect("authoritative runtime must initialize");
    for command in &commands {
        match command {
            ScenarioTraceCommand::Dispatch { action_id } => {
                authoritative
                    .dispatch(action_id)
                    .expect("authoritative action must execute");
            }
            ScenarioTraceCommand::AdvanceTime { minutes } => {
                authoritative
                    .advance_time(*minutes)
                    .expect("authoritative time must advance");
            }
        }
    }
    let authoritative_flags = authoritative.diagnostic_flags().clone();
    let authoritative_fired_event_ids = authoritative
        .diagnostic_fired_event_ids()
        .iter()
        .cloned()
        .collect::<Vec<_>>();
    let authoritative = authoritative.snapshot();

    assert_eq!(simulated.status, SimulationStatus::Completed);
    assert_eq!(simulated.final_state.stage, "resolved");
    assert_eq!(simulated.final_state.clock_minutes, 8_640);
    assert_eq!(
        simulated.final_state.resolved_outcome.as_deref(),
        Some("judgment_preserved_after_cassation")
    );
    assert_eq!(simulated.trace.len(), 52);
    assert_eq!(
        simulated.deadline_statuses["hearing_schedule_deadline"].as_deref(),
        Some("completed")
    );
    assert!(!simulated
        .fired_events
        .iter()
        .any(|id| id == "hearing_schedule_missed"));

    assert_eq!(simulated.final_state.stage, authoritative.stage_id);
    assert_eq!(
        simulated.final_state.clock_minutes,
        authoritative.clock_minutes
    );
    assert_eq!(simulated.final_state.flags, authoritative_flags);
    assert!(authoritative.flags.is_empty());
    assert_eq!(
        simulated.final_state.numeric_metrics,
        authoritative
            .numeric_metrics
            .expect("metrics must be projected")
    );
    assert_eq!(
        simulated.final_state.resources,
        authoritative
            .resources
            .expect("resources must be projected")
    );
    assert_eq!(simulated.fired_events, authoritative_fired_event_ids);
    assert!(authoritative.fired_event_ids.is_empty());
    assert_eq!(
        simulated.final_state.resolved_outcome,
        authoritative.resolved_outcome
    );
    let hearing = authoritative
        .deadlines
        .iter()
        .find(|deadline| deadline.id == "hearing_schedule_deadline")
        .expect("hearing deadline must be projected");
    assert_eq!(hearing.due_at_minutes, 5_880);
    assert_eq!(hearing.status.as_deref(), Some("completed"));
}

#[test]
fn admitted_review_and_remittal_remain_open_and_return_to_first_instance() {
    let commands: Vec<ScenarioTraceCommand> =
        serde_json::from_str(REMITTAL_TRACE).expect("remittal trace must parse");
    let run = |commands: &[ScenarioTraceCommand]| {
        ScenarioSimulator::new_with_seed(
            ScenarioDocument::from_value(scenario()).expect("scenario must load"),
            28,
        )
        .expect("simulator must initialize")
        .run_commands(commands, false)
        .expect("remittal commands must execute")
    };

    let admitted = run(&commands[..26]);
    assert_eq!(admitted.status, SimulationStatus::InProgress);
    assert_eq!(admitted.final_state.stage, "limited_cassation_review");
    assert_eq!(admitted.final_state.clock_minutes, 8_640);
    assert_eq!(admitted.final_state.resolved_outcome, None);
    assert!(!admitted.final_state.is_closed);

    let remitted = run(&commands[..27]);
    assert_eq!(remitted.status, SimulationStatus::InProgress);
    assert_eq!(remitted.final_state.stage, "remitted_rehearing");
    assert_eq!(remitted.final_state.clock_minutes, 8_640);
    assert_eq!(remitted.final_state.resolved_outcome, None);
    assert!(!remitted.final_state.is_closed);

    let first = run(&commands);
    let second = run(&commands);
    assert_eq!(first, second);
    assert_eq!(first.status, SimulationStatus::InProgress);
    assert_eq!(first.final_state.stage, "post_judgment");
    assert_eq!(first.final_state.clock_minutes, 10_080);
    assert_eq!(first.trace.len(), 62);
    assert_eq!(first.final_state.resolved_outcome, None);
    assert!(!first.final_state.is_closed);
    assert_eq!(
        first.final_state.judicial_decision_instance,
        Some(JudicialDecisionInstance::FirstInstance)
    );
    for expected in [
        "limited_cassation_review_admitted",
        "judgment_quashed_and_remitted",
        "remitted_rehearing_concluded",
        "first_instance_judgment_issued",
    ] {
        assert!(
            first.trace.iter().any(|entry| entry.id == expected),
            "remittal trace must include `{expected}`"
        );
    }
}
