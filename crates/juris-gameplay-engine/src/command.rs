use crate::{AllegedCassationGround, CassationOutcome, ClockSpeed, DecisionOutcome, GameMinute};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use thiserror::Error;

/// Stable identifier used to make command handling idempotent.
///
/// Adapters should persist and retry the same identifier when transport delivery
/// is uncertain. A duplicate identifier returns the original no-op receipt
/// semantics and never applies consequences twice.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct CommandId(String);

impl CommandId {
    /// Maximum accepted identifier length.
    pub const MAX_LEN: usize = 128;

    /// Creates a validated command identifier.
    pub fn new(value: impl Into<String>) -> Result<Self, CommandIdError> {
        let value = value.into();
        if value.trim().is_empty() {
            return Err(CommandIdError::Empty);
        }
        if value.len() > Self::MAX_LEN {
            return Err(CommandIdError::TooLong {
                actual: value.len(),
                maximum: Self::MAX_LEN,
            });
        }
        Ok(Self(value))
    }

    /// Returns the identifier text.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Command identifier validation error.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum CommandIdError {
    /// Empty or whitespace-only identifier.
    #[error("command id must not be empty")]
    Empty,

    /// Identifier exceeds the supported maximum.
    #[error("command id length {actual} exceeds maximum {maximum}")]
    TooLong {
        /// Actual byte length.
        actual: usize,
        /// Maximum byte length.
        maximum: usize,
    },
}

/// Typed command accepted by the authoritative gameplay engine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameplayCommand {
    /// Formally opens a new matter.
    OpenMatter,

    /// Completes pleadings and enters evidence development.
    CompletePleadings,

    /// Completes evidence development and enters hearing preparation.
    CompleteEvidence,

    /// Pauses simulation-time advancement.
    PauseClock,

    /// Resumes simulation-time advancement.
    ResumeClock,

    /// Changes the deterministic clock rate.
    SetClockSpeed {
        /// New speed.
        speed: ClockSpeed,
    },

    /// Advances the simulation from an adapter-supplied real-time duration.
    TickRealTime {
        /// Elapsed real milliseconds.
        elapsed_ms: u64,
    },

    /// Records substantive work and resets inactivity escalation.
    RecordSubstantiveWork,

    /// Schedules a mandatory hearing.
    ScheduleMandatoryHearing {
        /// Hearing opening minute.
        opens_at: GameMinute,
        /// Number of game minutes during which attendance remains possible.
        grace_minutes: u64,
    },

    /// Attends the currently open mandatory hearing.
    AttendMandatoryHearing,

    /// Delivers first-instance judgment.
    ///
    /// `proposed_outcome` is treated as an input from the adjudication system.
    /// A missed mandatory hearing overrides it with procedural default.
    DeliverFirstInstanceJudgment {
        /// Proposed adjudicated outcome.
        proposed_outcome: DecisionOutcome,
    },

    /// Prepares advice on whether an appeal should be pursued.
    PrepareAppealAdvice,

    /// Requests explicit client authorization to appeal.
    RequestAppealAuthorization,

    /// Records the client's appeal decision.
    RecordAppealAuthorization {
        /// Whether the client approved the appeal.
        approved: bool,
    },

    /// Files the authorized appeal.
    FileAppeal,

    /// Delivers appellate judgment.
    DeliverAppealJudgment {
        /// Appellate outcome.
        outcome: DecisionOutcome,
    },

    /// Assesses alleged cassation grounds.
    AssessCassationGrounds {
        /// Alleged grounds, including possible non-cognizable factual disputes.
        alleged_grounds: BTreeSet<AllegedCassationGround>,
    },

    /// Requests explicit client authorization to file cassation.
    RequestCassationAuthorization,

    /// Records the client's cassation decision.
    RecordCassationAuthorization {
        /// Whether the client approved cassation.
        approved: bool,
    },

    /// Files the authorized cassation.
    FileCassation,

    /// Delivers the cassation decision.
    DeliverCassationDecision {
        /// Cassation result.
        outcome: CassationOutcome,
    },

    /// Accepts the currently adverse judgment and closes the matter.
    AcceptCurrentJudgmentAndClose,
}
