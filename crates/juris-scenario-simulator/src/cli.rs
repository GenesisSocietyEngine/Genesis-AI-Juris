use std::{
    collections::{BTreeMap, BTreeSet},
    ffi::OsString,
    path::PathBuf,
};

use crate::{ScenarioDocument, ScenarioSimulator, SimulationError, SimulationResult};

/// Runs the CLI from arguments excluding the executable name.
pub fn run_cli<I>(arguments: I) -> Result<String, SimulationError>
where
    I: IntoIterator<Item = OsString>,
{
    let mut arguments = arguments.into_iter();
    let Some(command) = arguments.next() else {
        return Ok(help_text().to_owned());
    };
    let command = unicode(command)?;

    match command.as_str() {
        "help" | "--help" | "-h" => Ok(help_text().to_owned()),
        "inspect" => inspect(arguments),
        "run" => run(arguments),
        _ => Err(SimulationError::UnexpectedArgument { argument: command }),
    }
}

/// Static help text for scripts and tests.
#[must_use]
pub fn help_text() -> &'static str {
    "juris-scenario-simulator v1\n\n\
Usage:\n\
  juris-scenario-simulator inspect <scenario.json>\n\
  juris-scenario-simulator run <scenario.json> --actions id1,id2 [--require-outcome] [--max-auto-events N] [--json]"
}

fn inspect<I>(mut arguments: I) -> Result<String, SimulationError>
where
    I: Iterator<Item = OsString>,
{
    let path = arguments.next().ok_or(SimulationError::MissingArgument {
        argument: "scenario path",
    })?;
    if let Some(extra) = arguments.next() {
        return Err(SimulationError::UnexpectedArgument {
            argument: unicode(extra)?,
        });
    }

    let document = ScenarioDocument::load(PathBuf::from(path))?;
    let root = document.root();

    Ok(format!(
        "Scenario ID: {}\nInitial stage: {}\nStages: {}\nActions: {}\nEvents: {}\nOutcomes: {}",
        document.scenario_id(),
        document.initial_stage(),
        count(root, "stages"),
        count(root, "actions"),
        count(root, "events"),
        count(root, "outcomes")
    ))
}

fn run<I>(mut arguments: I) -> Result<String, SimulationError>
where
    I: Iterator<Item = OsString>,
{
    let path = arguments.next().ok_or(SimulationError::MissingArgument {
        argument: "scenario path",
    })?;
    let options = parse_options(arguments)?;

    let actions = options
        .values
        .get("actions")
        .map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .map(str::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let max_auto_events = match options.values.get("max-auto-events") {
        Some(value) => {
            let parsed =
                value
                    .parse::<usize>()
                    .map_err(|_| SimulationError::InvalidPositiveInteger {
                        option: "--max-auto-events".to_owned(),
                        value: value.clone(),
                    })?;
            if parsed == 0 {
                return Err(SimulationError::InvalidPositiveInteger {
                    option: "--max-auto-events".to_owned(),
                    value: value.clone(),
                });
            }
            parsed
        }
        None => 256,
    };

    let document = ScenarioDocument::load(PathBuf::from(path))?;
    let mut simulator = ScenarioSimulator::new(document)?;
    simulator.set_max_auto_events(max_auto_events);
    let result = simulator.run_actions(&actions, options.flags.contains("require-outcome"))?;

    if options.flags.contains("json") {
        serde_json::to_string_pretty(&result)
            .map_err(|source| SimulationError::Serialization { source })
    } else {
        Ok(render_text(&result))
    }
}

#[derive(Default)]
struct ParsedOptions {
    values: BTreeMap<String, String>,
    flags: BTreeSet<String>,
}

fn parse_options<I>(arguments: I) -> Result<ParsedOptions, SimulationError>
where
    I: IntoIterator<Item = OsString>,
{
    let mut parsed = ParsedOptions::default();
    let mut arguments = arguments.into_iter();

    while let Some(raw) = arguments.next() {
        let option = unicode(raw)?;
        if !option.starts_with("--") {
            return Err(SimulationError::UnexpectedArgument { argument: option });
        }
        let name = option.trim_start_matches("--").to_owned();

        if name == "require-outcome" || name == "json" {
            if !parsed.flags.insert(name.clone()) {
                return Err(SimulationError::DuplicateOption {
                    option: format!("--{name}"),
                });
            }
            continue;
        }

        if name != "actions" && name != "max-auto-events" {
            return Err(SimulationError::UnknownOption {
                option: format!("--{name}"),
            });
        }

        let value = arguments
            .next()
            .ok_or_else(|| SimulationError::MissingOptionValue {
                option: format!("--{name}"),
            })?;
        let value = unicode(value)?;
        if parsed.values.insert(name.clone(), value).is_some() {
            return Err(SimulationError::DuplicateOption {
                option: format!("--{name}"),
            });
        }
    }

    Ok(parsed)
}

fn render_text(result: &SimulationResult) -> String {
    let outcome = result
        .final_state
        .resolved_outcome
        .as_deref()
        .unwrap_or("<none>");

    format!(
        "Scenario: {}\nStatus: {:?}\nStage: {}\nClock minutes: {}\nOutcome: {}\nTransitions: {}\nFired events: {}",
        result.scenario_id,
        result.status,
        result.final_state.stage,
        result.final_state.clock_minutes,
        outcome,
        result.trace.len(),
        result.fired_events.join(", ")
    )
}

fn count(root: &serde_json::Value, field: &str) -> usize {
    root.get(field)
        .and_then(serde_json::Value::as_array)
        .map(Vec::len)
        .unwrap_or(0)
}

fn unicode(value: OsString) -> Result<String, SimulationError> {
    value
        .into_string()
        .map_err(|_| SimulationError::NonUnicodeArgument)
}
