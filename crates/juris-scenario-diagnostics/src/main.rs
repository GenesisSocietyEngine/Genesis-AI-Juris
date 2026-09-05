use std::{env, fs, path::PathBuf};

use juris_scenario_diagnostics::validate_authoring_semantics;
use juris_scenario_schema::ScenarioDefinition;

fn main() {
    let mut arguments = env::args_os().skip(1);
    let Some(command) = arguments.next() else {
        print_help();
        return;
    };

    if command == "help" || command == "--help" || command == "-h" {
        print_help();
        return;
    }

    if command != "validate" {
        eprintln!("error: unknown command `{}`", command.to_string_lossy());
        std::process::exit(2);
    }

    let Some(path) = arguments.next() else {
        eprintln!("error: validate requires a scenario JSON path");
        std::process::exit(2);
    };

    let json_output = arguments.any(|argument| argument == "--json");
    let path = PathBuf::from(path);

    let bytes = match fs::read(&path) {
        Ok(bytes) => bytes,
        Err(error) => {
            eprintln!("error: unable to read {}: {error}", path.display());
            std::process::exit(2);
        }
    };

    let scenario: ScenarioDefinition = match serde_json::from_slice(&bytes) {
        Ok(scenario) => scenario,
        Err(error) => {
            eprintln!(
                "error: invalid scenario JSON in {}: {error}",
                path.display()
            );
            std::process::exit(2);
        }
    };

    let report = validate_authoring_semantics(&scenario);

    if json_output {
        match serde_json::to_string_pretty(&report) {
            Ok(json) => println!("{json}"),
            Err(error) => {
                eprintln!("error: unable to encode diagnostics: {error}");
                std::process::exit(2);
            }
        }
    } else if report.diagnostics().is_empty() {
        println!("PASS temporal and outcome diagnostics");
    } else {
        for diagnostic in report.diagnostics() {
            println!(
                "{} {:?} {}\n  {}\n  Suggestion: {}",
                diagnostic.code,
                diagnostic.severity,
                diagnostic.path,
                diagnostic.message,
                diagnostic.suggestion
            );
        }
        println!(
            "Summary: {} error(s), {} warning(s)",
            report.error_count(),
            report.warning_count()
        );
    }

    if !report.is_valid() {
        std::process::exit(1);
    }
}

fn print_help() {
    println!(
        "juris-scenario-diagnostics v1\n\nUsage:\n  juris-scenario-diagnostics validate <scenario.json> [--json]"
    );
}
