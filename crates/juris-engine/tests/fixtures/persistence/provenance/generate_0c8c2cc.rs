use std::{env, fs, path::Path};

use juris_engine::ScenarioSession;
use juris_scenario_schema::ScenarioDefinition;

const REMEDIES: &str =
    include_str!("../../../content/fixtures/authoring/adverse_judgment_with_remedies.json");

fn write(output: &Path, name: &str, actions: &[&str]) {
    let definition: ScenarioDefinition = serde_json::from_str(REMEDIES).unwrap();
    let mut session = ScenarioSession::new(definition, 20260729).unwrap();
    for action in actions {
        session
            .dispatch(action)
            .expect("historical action must run");
    }
    fs::write(
        output.join(name),
        format!("{}\n", session.save_json().unwrap()),
    )
    .unwrap();
}

fn main() {
    let output = env::args().nth(1).expect("usage: probe <output-directory>");
    let output = Path::new(&output);
    fs::create_dir_all(output).unwrap();

    write(
        output,
        "0c8c2cc_lost_but_open.json",
        &["request_judgment", "adverse_trial_judgment"],
    );
    write(
        output,
        "0c8c2cc_appeal_success_enforced.json",
        &[
            "request_judgment",
            "adverse_trial_judgment",
            "file_appeal",
            "appeal_success",
            "begin_enforcement",
            "complete_enforcement",
        ],
    );
    write(
        output,
        "0c8c2cc_appeal_cassation_exhausted.json",
        &[
            "request_judgment",
            "adverse_trial_judgment",
            "file_appeal",
            "appeal_lost",
            "file_cassation",
            "cassation_rejected",
            "close_after_remedies_exhausted",
        ],
    );
    write(
        output,
        "0c8c2cc_explicitly_closed.json",
        &["request_judgment", "adverse_trial_judgment", "waive_appeal"],
    );
}
