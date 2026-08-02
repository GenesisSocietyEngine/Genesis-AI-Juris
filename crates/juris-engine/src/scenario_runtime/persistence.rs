//! Versioned, replay-based persistence for declarative scenario sessions.
//!
//! A save contains initialization data plus accepted player commands. Runtime
//! state is deliberately reconstructed instead of serialized so internal
//! refactors do not silently become persistence schema changes.

use std::collections::BTreeMap;
use std::fmt::Write as _;

use juris_scenario_schema::{
    AsyncTaskStatus, DeadlineStatus, Effect, FactStatus, ScenarioDefinition, StageKind,
};
use juris_scenario_validator::validate_scenario;
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
const RUNTIME_COMPATIBILITY_V1: &str = "scenario-runtime-v1";
const RUNTIME_COMPATIBILITY_V2: &str = "scenario-runtime-v2";

/// The runtime marker selects replay semantics and the canonical digest
/// projection. It is intentionally independent from the envelope schema
/// version: both profiles use the same stable eight-field wire envelope.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RuntimeCompatibility {
    V1,
    V2,
}

#[derive(Debug, Deserialize)]
struct SaveCompatibilityHeader {
    schema_id: String,
    schema_version: u32,
    runtime_compatibility: String,
}

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

        // Select the compatibility boundary from the envelope header before
        // interpreting the command payload. A future runtime is free to add a
        // command this runtime does not know; it must still fail as an
        // unsupported runtime rather than being misreported as an unknown v1
        // or v2 command.
        let header: SaveCompatibilityHeader = serde_json::from_value(value.clone())
            .map_err(|error| ScenarioSaveError::InvalidJson(error.to_string()))?;
        validate_save_header(
            &header.schema_id,
            header.schema_version,
            &header.runtime_compatibility,
        )?;

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
            runtime_compatibility: RUNTIME_COMPATIBILITY_V2.to_owned(),
            scenario_id: self.definition.metadata.id.as_str().to_owned(),
            scenario_fingerprint: scenario_fingerprint(&self.definition)?,
            seed: self.seed,
            commands: self.command_log.clone(),
            final_state_digest: final_state_digest(self, RuntimeCompatibility::V2)?,
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
        let compatibility = validate_envelope_compatibility(&definition, &envelope)?;

        // A v1 envelope may only cross the lifecycle boundary when a pure
        // definition-level proof establishes that old terminal semantics are
        // representable by v2. This check deliberately runs before session
        // construction or command replay, so an incompatible save cannot
        // partially execute and cannot surface later as an integrity error.
        if compatibility == RuntimeCompatibility::V1 {
            validate_v1_migration_eligibility(&definition)?;
        }

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

        if final_state_digest(&session, compatibility)? != envelope.final_state_digest {
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
        final_state_digest(self, RuntimeCompatibility::V2)
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
) -> Result<RuntimeCompatibility, ScenarioSaveError> {
    let compatibility = validate_save_header(
        &envelope.schema_id,
        envelope.schema_version,
        &envelope.runtime_compatibility,
    )?;
    if envelope.scenario_id != definition.metadata.id.as_str() {
        return Err(ScenarioSaveError::UnknownScenario(
            envelope.scenario_id.clone(),
        ));
    }
    if envelope.scenario_fingerprint != scenario_fingerprint(definition)? {
        return Err(ScenarioSaveError::FingerprintMismatch);
    }
    Ok(compatibility)
}

fn validate_save_header(
    schema_id: &str,
    schema_version: u32,
    runtime_compatibility: &str,
) -> Result<RuntimeCompatibility, ScenarioSaveError> {
    if schema_id != SAVE_SCHEMA_ID {
        return Err(ScenarioSaveError::UnknownSchema(schema_id.to_owned()));
    }
    if schema_version != SAVE_SCHEMA_VERSION {
        return Err(ScenarioSaveError::UnknownSchemaVersion(schema_version));
    }
    Ok(match runtime_compatibility {
        RUNTIME_COMPATIBILITY_V1 => RuntimeCompatibility::V1,
        RUNTIME_COMPATIBILITY_V2 => RuntimeCompatibility::V2,
        _ => {
            return Err(ScenarioSaveError::RuntimeCompatibility(
                runtime_compatibility.to_owned(),
            ));
        }
    })
}

/// Proves that a historical v1 definition does not depend on terminal
/// behavior removed by lifecycle v2.
///
/// A genuine v1 producer could only save a definition accepted by its own
/// validator. If that same fingerprint is not accepted by the current
/// validator, the loader cannot prove which later semantic invariant changed;
/// conservative rejection is therefore safer than an allowlist that could let
/// a future validator change leak out as an illegal command or digest error.
/// No commands are executed, no registry is touched, and no case-specific IDs
/// are used. Definitions that pass this gate are then replayed normally by the
/// current authoritative engine.
fn validate_v1_migration_eligibility(
    definition: &ScenarioDefinition,
) -> Result<(), ScenarioSaveError> {
    let report = validate_scenario(definition);
    if !report.is_valid() || !v1_outcome_boundaries_are_v2_safe(definition) {
        return Err(ScenarioSaveError::RuntimeCompatibility(
            RUNTIME_COMPATIBILITY_V1.to_owned(),
        ));
    }
    Ok(())
}

/// Conservatively proves that the one v1/v2 terminal-semantic difference
/// cannot change continuation after a successfully replayed command.
///
/// V1 treated any resolved outcome as terminal. V2 derives closure only from
/// the final stage. Merely asking the current validator whether a transition
/// *mentions* a terminal stage is insufficient: ordered effects could enter a
/// terminal stage, resolve an outcome, and then leave it again. For migration
/// we therefore require each action-owned outcome to finish at a terminal
/// stage. Event-owned outcomes are rejected because event scheduling can mix
/// explicit, dependent, and due events; proving their final stage requires a
/// historical event interpreter rather than a static shortcut.
///
/// A closure action with an explicit event trigger is accepted only when no
/// event in the definition can change stage. Processing a triggered event also
/// queues dependent and currently-due events, so restricting only the named
/// event would not be a complete proof. This rule is intentionally
/// conservative, generic, deterministic, and independent of case IDs.
fn v1_outcome_boundaries_are_v2_safe(definition: &ScenarioDefinition) -> bool {
    if definition.events.iter().any(|event| {
        event
            .effects
            .iter()
            .any(|effect| matches!(effect, Effect::ResolveOutcome { .. }))
    }) {
        return false;
    }

    let any_event_changes_stage = definition.events.iter().any(|event| {
        event
            .effects
            .iter()
            .any(|effect| matches!(effect, Effect::SetStage { .. }))
    });

    definition.actions.iter().all(|action| {
        let resolves_outcome = action
            .effects
            .iter()
            .any(|effect| matches!(effect, Effect::ResolveOutcome { .. }));
        if !resolves_outcome {
            return true;
        }

        let finishes_terminal = action
            .effects
            .iter()
            .rev()
            .find_map(|effect| match effect {
                Effect::SetStage { stage } => definition
                    .stages
                    .iter()
                    .find(|candidate| candidate.id == *stage),
                _ => None,
            })
            .is_some_and(|stage| stage.terminal || stage.kind == StageKind::Resolved);
        if !finishes_terminal {
            return false;
        }

        let triggers_event = action
            .effects
            .iter()
            .any(|effect| matches!(effect, Effect::TriggerEvent { .. }));
        !triggers_event || !any_event_changes_stage
    })
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

fn final_state_digest(
    session: &ScenarioSession,
    compatibility: RuntimeCompatibility,
) -> Result<String, ScenarioSaveError> {
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
    let mut projection = serde_json::json!({
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
    let projection = projection
        .as_object_mut()
        .expect("authoritative state projection must be an object");
    match compatibility {
        RuntimeCompatibility::V1 => {
            // PR #10 still emitted v1 markers but added judicial_result to the
            // digest only when present. Pre-lifecycle saves have no result, so
            // this one historical projection verifies both generations without
            // inferring a producer from incidental envelope data.
            if let Some(judicial_result) = session.state.judicial_result {
                projection.insert(
                    "judicial_result".to_owned(),
                    serde_json::to_value(judicial_result)
                        .map_err(|error| ScenarioSaveError::Serialization(error.to_string()))?,
                );
            }
        }
        RuntimeCompatibility::V2 => {
            // V2 always emits both lifecycle keys. Explicit nulls distinguish
            // the profile deterministically even before a decision exists and
            // make absence policy independent from serialization defaults.
            projection.insert(
                "judicial_result".to_owned(),
                serde_json::to_value(session.state.judicial_result)
                    .map_err(|error| ScenarioSaveError::Serialization(error.to_string()))?,
            );
            projection.insert(
                "judicial_decision_instance".to_owned(),
                serde_json::to_value(session.state.judicial_decision_instance)
                    .map_err(|error| ScenarioSaveError::Serialization(error.to_string()))?,
            );
        }
    }
    digest_serializable(projection)
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

#[cfg(test)]
mod tests {
    use super::*;
    use juris_scenario_schema::{JudicialDecisionInstance, JudicialResult};

    const LOGISTICS: &str =
        include_str!("../../../../content/cases/unpaid_logistics_invoices.scenario.json");

    #[test]
    fn decision_instance_is_v2_authoritative_but_absent_from_the_v1_profile() {
        let definition: ScenarioDefinition = serde_json::from_str(LOGISTICS).unwrap();
        let base = ScenarioSession::new(definition, 20260725).unwrap();
        let mut first_instance = base.clone();
        first_instance.state.judicial_result = Some(JudicialResult::Lost);
        first_instance.state.judicial_decision_instance =
            Some(JudicialDecisionInstance::FirstInstance);
        let mut appeal = first_instance.clone();
        appeal.state.judicial_decision_instance = Some(JudicialDecisionInstance::Appeal);

        // The sessions differ in exactly one authoritative lifecycle field.
        // Historical v1 never covered that field, while v2 must distinguish it.
        assert_eq!(
            final_state_digest(&first_instance, RuntimeCompatibility::V1).unwrap(),
            final_state_digest(&appeal, RuntimeCompatibility::V1).unwrap()
        );
        let first_v2 = final_state_digest(&first_instance, RuntimeCompatibility::V2).unwrap();
        let appeal_v2 = final_state_digest(&appeal, RuntimeCompatibility::V2).unwrap();
        assert_eq!(
            first_v2,
            "4125d90df1f15fd19a31048ecce41a22621f7a5367a8adbcd13c5c31dbaa715a"
        );
        assert_eq!(
            appeal_v2,
            "8db5604e69b8089368a379db5b8a9aee1e33b91e75f749df86726d6a4510c1de"
        );
        assert_ne!(first_v2, appeal_v2);
    }
}
