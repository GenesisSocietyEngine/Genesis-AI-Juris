//! Versioned, replay-based persistence for declarative scenario sessions.
//!
//! A save contains initialization data plus accepted player commands. Runtime
//! state is deliberately reconstructed instead of serialized so internal
//! refactors do not silently become persistence schema changes.

use std::collections::BTreeMap;
use std::fmt::Write as _;

use juris_scenario_schema::{AsyncTaskStatus, DeadlineStatus, FactStatus, ScenarioDefinition};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use thiserror::Error;

use super::{
    ScenarioRuntimeError, ScenarioSession, ScenarioSessionId, ScenarioSessionRegistry,
    MAX_FOREGROUND_ADVANCE_MINUTES,
};

pub const SAVE_SCHEMA_ID: &str = "genesis.ai-juris.command-log";
pub const SAVE_SCHEMA_VERSION: u32 = 1;
const RUNTIME_COMPATIBILITY: &str = "scenario-runtime-v1";

/// One accepted player intention in authoritative replay order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case", deny_unknown_fields)]
pub enum ScenarioCommand {
    Dispatch { action_id: String },
    AdvanceTime { minutes: u32 },
}

/// Stable public Save v1 envelope.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ScenarioSaveEnvelope {
    pub schema_id: String,
    pub schema_version: u32,
    pub runtime_compatibility: String,
    pub scenario_id: String,
    pub scenario_fingerprint: String,
    pub seed: u64,
    pub commands: Vec<ScenarioCommand>,
    pub final_state_digest: String,
}

/// Controlled persistence and replay failures.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ScenarioSaveError {
    #[error("save JSON is malformed: {0}")]
    InvalidJson(String),

    #[error("unknown save schema `{0}`")]
    UnknownSchema(String),

    #[error("unsupported save schema version {0}")]
    UnknownSchemaVersion(u32),

    #[error("unsupported runtime compatibility marker `{0}`")]
    RuntimeCompatibility(String),

    #[error("save targets unknown scenario `{0}`")]
    UnknownScenario(String),

    #[error("scenario content fingerprint does not match this save")]
    FingerprintMismatch,

    #[error("save contains unknown command type `{0}`")]
    UnknownCommand(String),

    #[error("save references unknown action `{0}`")]
    UnknownAction(String),

    #[error("save contains invalid time advance of {0} minutes")]
    InvalidTimeAdvance(u32),

    #[error("save command {index} is illegal: {message}")]
    IllegalCommandSequence { index: usize, message: String },

    #[error("replayed state does not match the save integrity marker")]
    IntegrityMismatch,

    #[error("scenario session `{0}` does not exist")]
    UnknownSession(u64),

    #[error("save serialization failed: {0}")]
    Serialization(String),
}

impl ScenarioSaveEnvelope {
    /// Parses a save while preserving a distinct error for unknown commands.
    pub fn from_json(encoded: &str) -> Result<Self, ScenarioSaveError> {
        let value: Value = serde_json::from_str(encoded)
            .map_err(|error| ScenarioSaveError::InvalidJson(error.to_string()))?;
        if let Some(commands) = value.get("commands").and_then(Value::as_array) {
            for command in commands {
                let Some(command_type) = command.get("command").and_then(Value::as_str) else {
                    return Err(ScenarioSaveError::InvalidJson(
                        "each command must contain a string `command` field".to_owned(),
                    ));
                };
                if !matches!(command_type, "dispatch" | "advance_time") {
                    return Err(ScenarioSaveError::UnknownCommand(command_type.to_owned()));
                }
            }
        }
        serde_json::from_value(value)
            .map_err(|error| ScenarioSaveError::InvalidJson(error.to_string()))
    }

    pub fn to_json(&self) -> Result<String, ScenarioSaveError> {
        serde_json::to_string(self)
            .map_err(|error| ScenarioSaveError::Serialization(error.to_string()))
    }
}

impl ScenarioSession {
    /// Exports the current session as an ordered command-log save.
    pub fn save_envelope(&self) -> Result<ScenarioSaveEnvelope, ScenarioSaveError> {
        Ok(ScenarioSaveEnvelope {
            schema_id: SAVE_SCHEMA_ID.to_owned(),
            schema_version: SAVE_SCHEMA_VERSION,
            runtime_compatibility: RUNTIME_COMPATIBILITY.to_owned(),
            scenario_id: self.definition.metadata.id.as_str().to_owned(),
            scenario_fingerprint: scenario_fingerprint(&self.definition)?,
            seed: self.seed,
            commands: self.command_log.clone(),
            final_state_digest: final_state_digest(self)?,
        })
    }

    pub fn save_json(&self) -> Result<String, ScenarioSaveError> {
        self.save_envelope()?.to_json()
    }

    /// Creates a fresh session and deterministically replays a Save v1 log.
    pub fn from_save_json(
        definition: ScenarioDefinition,
        encoded: &str,
    ) -> Result<Self, ScenarioSaveError> {
        let envelope = ScenarioSaveEnvelope::from_json(encoded)?;
        Self::from_save_envelope(definition, envelope)
    }

    pub fn from_save_envelope(
        definition: ScenarioDefinition,
        envelope: ScenarioSaveEnvelope,
    ) -> Result<Self, ScenarioSaveError> {
        validate_envelope_compatibility(&definition, &envelope)?;

        for command in &envelope.commands {
            match command {
                ScenarioCommand::Dispatch { action_id } => {
                    if !definition
                        .actions
                        .iter()
                        .any(|action| action.id.as_str() == action_id)
                    {
                        return Err(ScenarioSaveError::UnknownAction(action_id.clone()));
                    }
                }
                ScenarioCommand::AdvanceTime { minutes }
                    if *minutes == 0 || *minutes > MAX_FOREGROUND_ADVANCE_MINUTES =>
                {
                    return Err(ScenarioSaveError::InvalidTimeAdvance(*minutes));
                }
                ScenarioCommand::AdvanceTime { .. } => {}
            }
        }

        let mut session = ScenarioSession::new(definition, envelope.seed)
            .map_err(|error| illegal_sequence(0, error))?;
        for (index, command) in envelope.commands.iter().enumerate() {
            let result = match command {
                ScenarioCommand::Dispatch { action_id } => session.dispatch(action_id),
                ScenarioCommand::AdvanceTime { minutes } => session.advance_time(*minutes),
            };
            result.map_err(|error| illegal_sequence(index, error))?;
        }

        if final_state_digest(&session)? != envelope.final_state_digest {
            return Err(ScenarioSaveError::IntegrityMismatch);
        }
        Ok(session)
    }

    #[must_use]
    pub fn command_log(&self) -> &[ScenarioCommand] {
        &self.command_log
    }

    pub fn scenario_fingerprint(&self) -> Result<String, ScenarioSaveError> {
        scenario_fingerprint(&self.definition)
    }

    pub fn final_state_digest(&self) -> Result<String, ScenarioSaveError> {
        final_state_digest(self)
    }
}

impl ScenarioSessionRegistry {
    pub fn save_json(&self, id: ScenarioSessionId) -> Result<String, ScenarioSaveError> {
        self.sessions
            .get(&id)
            .ok_or(ScenarioSaveError::UnknownSession(id.0))?
            .save_json()
    }

    /// Inserts only a completely replayed and integrity-checked new session.
    pub fn load_from_json(
        &mut self,
        definition: ScenarioDefinition,
        encoded: &str,
    ) -> Result<ScenarioSessionId, ScenarioSaveError> {
        let session = ScenarioSession::from_save_json(definition, encoded)?;
        self.insert(session)
            .map_err(|error| ScenarioSaveError::Serialization(error.to_string()))
    }
}

fn validate_envelope_compatibility(
    definition: &ScenarioDefinition,
    envelope: &ScenarioSaveEnvelope,
) -> Result<(), ScenarioSaveError> {
    if envelope.schema_id != SAVE_SCHEMA_ID {
        return Err(ScenarioSaveError::UnknownSchema(envelope.schema_id.clone()));
    }
    if envelope.schema_version != SAVE_SCHEMA_VERSION {
        return Err(ScenarioSaveError::UnknownSchemaVersion(
            envelope.schema_version,
        ));
    }
    if envelope.runtime_compatibility != RUNTIME_COMPATIBILITY {
        return Err(ScenarioSaveError::RuntimeCompatibility(
            envelope.runtime_compatibility.clone(),
        ));
    }
    if envelope.scenario_id != definition.metadata.id.as_str() {
        return Err(ScenarioSaveError::UnknownScenario(
            envelope.scenario_id.clone(),
        ));
    }
    if envelope.scenario_fingerprint != scenario_fingerprint(definition)? {
        return Err(ScenarioSaveError::FingerprintMismatch);
    }
    Ok(())
}

fn illegal_sequence(index: usize, error: ScenarioRuntimeError) -> ScenarioSaveError {
    ScenarioSaveError::IllegalCommandSequence {
        index,
        message: error.to_string(),
    }
}

fn scenario_fingerprint(definition: &ScenarioDefinition) -> Result<String, ScenarioSaveError> {
    digest_serializable(definition)
}

fn final_state_digest(session: &ScenarioSession) -> Result<String, ScenarioSaveError> {
    let fact_statuses: BTreeMap<&str, &str> = session
        .state
        .fact_statuses
        .iter()
        .map(|(id, status)| (id.as_str(), fact_status_name(*status)))
        .collect();
    let deadline_statuses: BTreeMap<&str, Option<&str>> = session
        .state
        .deadline_statuses
        .iter()
        .map(|(id, status)| {
            (
                id.as_str(),
                status.as_ref().copied().map(deadline_status_name),
            )
        })
        .collect();
    let task_statuses: BTreeMap<&str, &str> = session
        .state
        .task_statuses
        .iter()
        .map(|(id, status)| (id.as_str(), task_status_name(*status)))
        .collect();
    let projection = serde_json::json!({
        "scenario_id": session.definition.metadata.id.as_str(),
        "scenario_fingerprint": scenario_fingerprint(&session.definition)?,
        "seed": session.seed,
        "stage_id": session.state.stage_id,
        "clock_minutes": session.state.clock_minutes,
        "flags": session.state.flags,
        "fact_statuses": fact_statuses,
        "available_evidence": session.state.available_evidence,
        "deadline_statuses": deadline_statuses,
        "task_statuses": task_statuses,
        "task_due_minutes": session.state.task_due_minutes,
        "visible_inbox": session.state.visible_inbox,
        "resolved_inbox": session.state.resolved_inbox,
        "action_uses": session.state.action_uses,
        "fired_events": session.state.fired_events,
        "outcome_id": session.state.outcome_id,
    });
    digest_serializable(&projection)
}

fn digest_serializable<T: Serialize>(value: &T) -> Result<String, ScenarioSaveError> {
    let value = serde_json::to_value(value)
        .map_err(|error| ScenarioSaveError::Serialization(error.to_string()))?;
    let mut canonical = String::new();
    write_canonical_json(&value, &mut canonical)?;
    let digest = Sha256::digest(canonical.as_bytes());
    let mut encoded = String::with_capacity(digest.len() * 2);
    for byte in digest {
        write!(&mut encoded, "{byte:02x}")
            .map_err(|error| ScenarioSaveError::Serialization(error.to_string()))?;
    }
    Ok(encoded)
}

fn write_canonical_json(value: &Value, output: &mut String) -> Result<(), ScenarioSaveError> {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {
            output.push_str(
                &serde_json::to_string(value)
                    .map_err(|error| ScenarioSaveError::Serialization(error.to_string()))?,
            );
        }
        Value::Array(values) => {
            output.push('[');
            for (index, value) in values.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                write_canonical_json(value, output)?;
            }
            output.push(']');
        }
        Value::Object(values) => {
            output.push('{');
            let mut entries = values.iter().collect::<Vec<_>>();
            entries.sort_unstable_by_key(|(key, _)| *key);
            for (index, (key, value)) in entries.into_iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                output.push_str(
                    &serde_json::to_string(key)
                        .map_err(|error| ScenarioSaveError::Serialization(error.to_string()))?,
                );
                output.push(':');
                write_canonical_json(value, output)?;
            }
            output.push('}');
        }
    }
    Ok(())
}

fn fact_status_name(status: FactStatus) -> &'static str {
    match status {
        FactStatus::Alleged => "alleged",
        FactStatus::Admitted => "admitted",
        FactStatus::Disputed => "disputed",
        FactStatus::Proven => "proven",
        FactStatus::Inferred => "inferred",
        FactStatus::Unknown => "unknown",
    }
}

fn deadline_status_name(status: DeadlineStatus) -> &'static str {
    match status {
        DeadlineStatus::Open => "open",
        DeadlineStatus::Completed => "completed",
        DeadlineStatus::Missed => "missed",
    }
}

fn task_status_name(status: AsyncTaskStatus) -> &'static str {
    match status {
        AsyncTaskStatus::NotStarted => "not_started",
        AsyncTaskStatus::InProgress => "in_progress",
        AsyncTaskStatus::Ready => "ready",
        AsyncTaskStatus::Reviewed => "reviewed",
        AsyncTaskStatus::Expired => "expired",
    }
}
