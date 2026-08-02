use std::{env, fs, path::Path};

use juris_engine::{ScenarioCommand, ScenarioSession};
use juris_scenario_schema::ScenarioDefinition;
use serde_json::{json, Value};

const LOGISTICS: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const GREENFIRE: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const GREENFIRE_COMPROMISED: &str =
    include_str!("../../../content/traces/greenfire_compromised.commands.json");

fn definition(encoded: &str) -> ScenarioDefinition {
    serde_json::from_str(encoded).expect("historical scenario must parse")
}

fn dispatch_all(session: &mut ScenarioSession, actions: &[&str]) {
    for action in actions {
        session
            .dispatch(action)
            .expect("historical action must run");
    }
}

fn run_trace(session: &mut ScenarioSession, encoded: &str) {
    let commands: Vec<ScenarioCommand> =
        serde_json::from_str(encoded).expect("historical trace must parse");
    for command in commands {
        match command {
            ScenarioCommand::Dispatch { action_id } => {
                session.dispatch(&action_id).expect("trace action must run");
            }
            ScenarioCommand::AdvanceTime { minutes } => {
                session.advance_time(minutes).expect("trace time must run");
            }
        }
    }
}

fn nonterminal_outcome_definition() -> ScenarioDefinition {
    let mut value: Value = serde_json::from_str(LOGISTICS).unwrap();
    let action = value["actions"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .find(|action| action["id"] == "accept_negotiated_payment")
        .unwrap();
    action["effects"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .find(|effect| effect["type"] == "set_stage")
        .unwrap()["stage"] = json!("proceedings");

    let outcome = value["outcomes"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .find(|outcome| outcome["id"] == "negotiated_recovery")
        .unwrap();
    outcome["terminal_stage"] = json!("proceedings");
    outcome["condition"]["conditions"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .find(|condition| condition["type"] == "stage_is")
        .unwrap()["stage"] = json!("proceedings");
    serde_json::from_value(value).unwrap()
}

fn terminal_then_nonterminal_outcome_definition() -> ScenarioDefinition {
    let mut value: Value = serde_json::from_str(LOGISTICS).unwrap();
    let action = value["actions"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .find(|action| action["id"] == "accept_negotiated_payment")
        .unwrap();
    action["effects"]
        .as_array_mut()
        .unwrap()
        .push(json!({"type": "set_stage", "stage": "proceedings"}));
    serde_json::from_value(value).unwrap()
}

fn write(output: &Path, name: &str, encoded: &str) {
    fs::write(output.join(name), format!("{encoded}\n")).unwrap();
}

fn main() {
    let output = env::args().nth(1).expect("usage: probe <output-directory>");
    let output = Path::new(&output);
    fs::create_dir_all(output).unwrap();

    let logistics = definition(LOGISTICS);
    let mut before = ScenarioSession::new(logistics.clone(), 20260725).unwrap();
    dispatch_all(&mut before, &["audit_claim_file", "issue_formal_demand"]);
    write(
        output,
        "06e566a_before_judgment.json",
        &before.save_json().unwrap(),
    );

    let mut judgment_open = before.clone();
    judgment_open.dispatch("request_judgment").unwrap();
    write(
        output,
        "06e566a_winning_judgment_open.json",
        &judgment_open.save_json().unwrap(),
    );

    let mut negotiated = before.clone();
    negotiated.dispatch("accept_negotiated_payment").unwrap();
    write(
        output,
        "06e566a_logistics_terminal_boundary.json",
        &negotiated.save_json().unwrap(),
    );

    let mut enforced = judgment_open;
    enforced.dispatch("enforce_judgment").unwrap();
    write(
        output,
        "06e566a_fully_enforced_win.json",
        &enforced.save_json().unwrap(),
    );

    let greenfire = definition(GREENFIRE);
    let mut losing = ScenarioSession::new(greenfire, 20260729).unwrap();
    run_trace(&mut losing, GREENFIRE_COMPROMISED);
    write(
        output,
        "06e566a_losing_terminal_outcome.json",
        &losing.save_json().unwrap(),
    );

    let mut corrupted_digest = before.save_envelope().unwrap();
    corrupted_digest.final_state_digest = "f".repeat(64);
    write(
        output,
        "06e566a_corrupted_digest.json",
        &corrupted_digest.to_json().unwrap(),
    );
    write(
        output,
        "06e566a_corrupted_json.json",
        "{\"schema_id\":\"genesis.ai-juris.command-log\",\"schema_version\":1,",
    );
    let mut unsupported = before.save_envelope().unwrap();
    unsupported.runtime_compatibility = "scenario-runtime-future".to_owned();
    write(
        output,
        "06e566a_unsupported_marker.json",
        &unsupported.to_json().unwrap(),
    );

    let counterexample = nonterminal_outcome_definition();
    let mut nonterminal = ScenarioSession::new(counterexample.clone(), 20260731).unwrap();
    dispatch_all(
        &mut nonterminal,
        &[
            "audit_claim_file",
            "issue_formal_demand",
            "accept_negotiated_payment",
        ],
    );
    write(
        output,
        "06e566a_nonterminal_outcome.json",
        &nonterminal.save_json().unwrap(),
    );
    write(
        output,
        "06e566a_nonterminal_outcome.scenario.json",
        &serde_json::to_string(&counterexample).unwrap(),
    );

    let ordered_counterexample = terminal_then_nonterminal_outcome_definition();
    let mut terminal_then_nonterminal =
        ScenarioSession::new(ordered_counterexample.clone(), 20260731).unwrap();
    dispatch_all(
        &mut terminal_then_nonterminal,
        &[
            "audit_claim_file",
            "issue_formal_demand",
            "accept_negotiated_payment",
        ],
    );
    write(
        output,
        "06e566a_terminal_then_nonterminal_outcome.json",
        &terminal_then_nonterminal.save_json().unwrap(),
    );
    write(
        output,
        "06e566a_terminal_then_nonterminal_outcome.scenario.json",
        &serde_json::to_string(&ordered_counterexample).unwrap(),
    );
}
