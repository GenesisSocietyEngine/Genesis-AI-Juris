use std::path::PathBuf;

use thiserror::Error;

/// Deterministic failures exposed by document loading, simulation, and CLI use.
#[derive(Debug, Error)]
pub enum SimulationError {
    #[error("unable to read {path:?}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("invalid JSON in {path:?}")]
    Json {
        path: PathBuf,
        #[source]
        source: serde_json::Error,
    },

    #[error("scenario document does not conform to ScenarioDefinition v1")]
    InvalidScenarioDocument {
        #[source]
        source: serde_json::Error,
    },

    #[error("scenario document is missing required field `{field}`")]
    MissingField { field: String },

    #[error("scenario field `{field}` has the wrong JSON type; expected {expected}")]
    WrongFieldType {
        field: String,
        expected: &'static str,
    },

    #[error("duplicate {kind} ID `{id}`")]
    DuplicateId { kind: &'static str, id: String },

    #[error("unknown stage `{stage}`")]
    UnknownStage { stage: String },

    #[error("unknown action `{action}`")]
    UnknownAction { action: String },

    #[error("unknown event `{event}`")]
    UnknownEvent { event: String },

    #[error("unknown outcome `{outcome}`")]
    UnknownOutcome { outcome: String },

    #[error("action `{action}` is not an exit action of stage `{stage}`")]
    ActionNotAllowedByStage { action: String, stage: String },

    #[error("action `{action}` is unavailable in the current state")]
    ActionUnavailable { action: String },

    #[error("cannot execute action `{action}` after terminal stage `{stage}`")]
    ActionAfterTerminal { action: String, stage: String },

    #[error("unsupported condition type `{condition_type}` at {path}")]
    UnsupportedCondition {
        condition_type: String,
        path: String,
    },

    #[error("unsupported effect type `{effect_type}` at {path}")]
    UnsupportedEffect { effect_type: String, path: String },

    #[error("unsupported event trigger type `{trigger_type}` at {path}")]
    UnsupportedEventTrigger { trigger_type: String, path: String },

    #[error("invalid condition at {path}; missing or invalid field `{field}`")]
    InvalidCondition { path: String, field: String },

    #[error("invalid effect at {path}; missing or invalid field `{field}`")]
    InvalidEffect { path: String, field: String },

    #[error("invalid event trigger at {path}; missing or invalid field `{field}`")]
    InvalidEventTrigger { path: String, field: String },

    #[error("simulation clock overflow while applying `{owner}`")]
    ClockOverflow { owner: String },

    #[error("foreground clock advancement is not enabled for this scenario")]
    ClockAdvanceUnsupported,

    #[error("clock advancement must be greater than zero minutes")]
    InvalidClockAdvance,

    #[error("clock advancement of {requested} minutes exceeds the per-command limit of {maximum}")]
    ClockAdvanceLimitExceeded { requested: u32, maximum: u32 },

    #[error("transition `{owner}` attempts to resolve several outcomes: {outcomes}")]
    MultipleOutcomes { owner: String, outcomes: String },

    #[error("outcome `{outcome}` condition is false in the resulting state")]
    OutcomeConditionFalse { outcome: String },

    #[error("outcome `{outcome}` targets stage `{expected}`, but current stage is `{actual}`")]
    OutcomeStageMismatch {
        outcome: String,
        expected: String,
        actual: String,
    },

    #[error("outcome `{new_outcome}` conflicts with already resolved outcome `{existing}`")]
    ConflictingOutcome {
        existing: String,
        new_outcome: String,
    },

    #[error("automatic event limit {limit} exceeded; possible event cycle")]
    AutomaticEventLimitExceeded { limit: usize },

    #[error("terminal stage `{stage}` was reached without resolving an outcome")]
    TerminalWithoutOutcome { stage: String },

    #[error("simulation ended without an outcome while --require-outcome was requested")]
    OutcomeRequired,

    #[error("missing required CLI argument `{argument}`")]
    MissingArgument { argument: &'static str },

    #[error("unknown CLI option `{option}`")]
    UnknownOption { option: String },

    #[error("CLI option `{option}` requires a value")]
    MissingOptionValue { option: String },

    #[error("CLI option `{option}` was supplied more than once")]
    DuplicateOption { option: String },

    #[error("CLI options `{first}` and `{second}` cannot be used together")]
    ConflictingOptions { first: String, second: String },

    #[error("invalid positive integer `{value}` for option `{option}`")]
    InvalidPositiveInteger { option: String, value: String },

    #[error("unexpected positional CLI argument `{argument}`")]
    UnexpectedArgument { argument: String },

    #[error("CLI argument is not valid Unicode")]
    NonUnicodeArgument,

    #[error("unable to serialize simulation output")]
    Serialization {
        #[source]
        source: serde_json::Error,
    },
}
