//! Transport-neutral JSON boundary between Flutter and `juris-engine`.
//!
//! This crate deliberately contains no JNI, Dart FFI, or platform lifecycle
//! code. It defines one stable command/response protocol that a thin native
//! transport can expose on Android and iOS. All authoritative mutation remains
//! in the engine-owned session registry.

#![forbid(unsafe_code)]

use juris_engine::{
    MobileScenarioSnapshot, ScenarioRuntimeError, ScenarioSaveError, ScenarioSessionId,
    ScenarioSessionRegistry,
};
use juris_scenario_schema::ScenarioDefinition;
use serde::{Deserialize, Serialize};

/// Commands accepted from a mobile transport.
#[derive(Debug, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case")]
pub enum BridgeRequest {
    CreateSession {
        scenario: Box<ScenarioDefinition>,
        seed: u64,
    },
    Snapshot {
        session_id: u64,
    },
    Dispatch {
        session_id: u64,
        action_id: String,
    },
    AdvanceTime {
        session_id: u64,
        minutes: u32,
    },
    SaveSession {
        session_id: u64,
    },
    LoadSession {
        scenario: Box<ScenarioDefinition>,
        encoded_save: String,
    },
    DisposeSession {
        session_id: u64,
    },
}

/// Responses returned as UTF-8 JSON to the mobile transport.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BridgeResponse {
    SessionCreated {
        session_id: u64,
        snapshot: MobileScenarioSnapshot,
    },
    Snapshot {
        session_id: u64,
        snapshot: MobileScenarioSnapshot,
    },
    SessionSaved {
        session_id: u64,
        encoded_save: String,
    },
    SessionLoaded {
        session_id: u64,
        snapshot: MobileScenarioSnapshot,
    },
    SessionDisposed {
        session_id: u64,
        disposed: bool,
    },
    Error {
        code: String,
        message: String,
    },
}

/// Stateful bridge endpoint owned by one application process.
#[derive(Debug, Default)]
pub struct MobileBridge {
    sessions: ScenarioSessionRegistry,
}

impl MobileBridge {
    #[must_use]
    pub fn new() -> Self {
        Self {
            sessions: ScenarioSessionRegistry::new(),
        }
    }

    /// Executes one already-decoded command.
    pub fn execute(&mut self, request: BridgeRequest) -> BridgeResponse {
        match request {
            BridgeRequest::CreateSession { scenario, seed } => {
                match self.sessions.create(*scenario, seed) {
                    Ok(id) => self.snapshot_response(id, true),
                    Err(error) => runtime_error_response(error),
                }
            }
            BridgeRequest::Snapshot { session_id } => {
                self.snapshot_response(ScenarioSessionId(session_id), false)
            }
            BridgeRequest::Dispatch {
                session_id,
                action_id,
            } => {
                let id = ScenarioSessionId(session_id);
                match self.sessions.dispatch(id, &action_id) {
                    Ok(snapshot) => BridgeResponse::Snapshot {
                        session_id,
                        snapshot,
                    },
                    Err(error) => runtime_error_response(error),
                }
            }
            BridgeRequest::AdvanceTime {
                session_id,
                minutes,
            } => {
                let id = ScenarioSessionId(session_id);
                match self.sessions.advance_time(id, minutes) {
                    Ok(snapshot) => BridgeResponse::Snapshot {
                        session_id,
                        snapshot,
                    },
                    Err(error) => runtime_error_response(error),
                }
            }
            BridgeRequest::SaveSession { session_id } => {
                match self.sessions.save_json(ScenarioSessionId(session_id)) {
                    Ok(encoded_save) => BridgeResponse::SessionSaved {
                        session_id,
                        encoded_save,
                    },
                    Err(error) => save_error_response(error),
                }
            }
            BridgeRequest::LoadSession {
                scenario,
                encoded_save,
            } => match self.sessions.load_from_json(*scenario, &encoded_save) {
                Ok(id) => match self.sessions.snapshot(id) {
                    Ok(snapshot) => BridgeResponse::SessionLoaded {
                        session_id: id.0,
                        snapshot,
                    },
                    Err(error) => runtime_error_response(error),
                },
                Err(error) => save_error_response(error),
            },
            BridgeRequest::DisposeSession { session_id } => {
                let disposed = self.sessions.dispose(ScenarioSessionId(session_id));
                BridgeResponse::SessionDisposed {
                    session_id,
                    disposed,
                }
            }
        }
    }

    /// Parses one command and always returns a serializable response.
    #[must_use]
    pub fn execute_json(&mut self, encoded_request: &str) -> String {
        let response = match serde_json::from_str(encoded_request) {
            Ok(request) => self.execute(request),
            Err(error) => BridgeResponse::Error {
                code: "invalid_request".to_owned(),
                message: error.to_string(),
            },
        };

        serde_json::to_string(&response).unwrap_or_else(|error| {
            format!(
                "{{\"type\":\"error\",\"code\":\"serialization_failure\",\"message\":{}}}",
                serde_json::to_string(&error.to_string())
                    .unwrap_or_else(|_| "\"unknown serialization failure\"".to_owned())
            )
        })
    }

    #[must_use]
    pub fn session_count(&self) -> usize {
        self.sessions.len()
    }

    fn snapshot_response(&self, id: ScenarioSessionId, created: bool) -> BridgeResponse {
        match self.sessions.snapshot(id) {
            Ok(snapshot) if created => BridgeResponse::SessionCreated {
                session_id: id.0,
                snapshot,
            },
            Ok(snapshot) => BridgeResponse::Snapshot {
                session_id: id.0,
                snapshot,
            },
            Err(error) => runtime_error_response(error),
        }
    }
}

fn save_error_response(error: ScenarioSaveError) -> BridgeResponse {
    let code = match &error {
        ScenarioSaveError::InvalidJson(_) => "invalid_save_json",
        ScenarioSaveError::UnknownSchema(_) => "unknown_save_schema",
        ScenarioSaveError::UnknownSchemaVersion(_) => "unknown_save_schema_version",
        ScenarioSaveError::RuntimeCompatibility(_) => "incompatible_runtime",
        ScenarioSaveError::UnknownScenario(_) => "unknown_save_scenario",
        ScenarioSaveError::FingerprintMismatch => "scenario_fingerprint_mismatch",
        ScenarioSaveError::UnknownCommand(_) => "unknown_save_command",
        ScenarioSaveError::UnknownAction(_) => "unknown_save_action",
        ScenarioSaveError::InvalidTimeAdvance(_) => "invalid_save_time_advance",
        ScenarioSaveError::IllegalCommandSequence { .. } => "illegal_save_command_sequence",
        ScenarioSaveError::IntegrityMismatch => "save_integrity_mismatch",
        ScenarioSaveError::UnknownSession(_) => "unknown_session",
        ScenarioSaveError::Serialization(_) => "save_serialization_failure",
    };
    BridgeResponse::Error {
        code: code.to_owned(),
        message: error.to_string(),
    }
}

fn runtime_error_response(error: ScenarioRuntimeError) -> BridgeResponse {
    let code = match &error {
        ScenarioRuntimeError::InvalidJson(_) => "invalid_scenario_json",
        ScenarioRuntimeError::InvalidScenario(_) => "invalid_scenario",
        ScenarioRuntimeError::ScenarioResolved => "scenario_resolved",
        ScenarioRuntimeError::ActionUnavailable(_) => "action_unavailable",
        ScenarioRuntimeError::ClockAdvanceUnsupported => "clock_advance_unsupported",
        ScenarioRuntimeError::InvalidClockAdvance => "invalid_clock_advance",
        ScenarioRuntimeError::ClockAdvanceLimitExceeded { .. } => "clock_advance_limit_exceeded",
        ScenarioRuntimeError::UnknownEvent(_) => "unknown_event",
        ScenarioRuntimeError::UnknownOutcome(_) => "unknown_outcome",
        ScenarioRuntimeError::OutcomeStageMismatch { .. } => "outcome_stage_mismatch",
        ScenarioRuntimeError::OutcomeConditionFalse(_) => "outcome_condition_false",
        ScenarioRuntimeError::ConflictingOutcome { .. } => "conflicting_outcome",
        ScenarioRuntimeError::ClockOverflow => "clock_overflow",
        ScenarioRuntimeError::EventLimitExceeded(_) => "event_limit_exceeded",
        ScenarioRuntimeError::UnknownSession(_) => "unknown_session",
    };
    BridgeResponse::Error {
        code: code.to_owned(),
        message: error.to_string(),
    }
}
