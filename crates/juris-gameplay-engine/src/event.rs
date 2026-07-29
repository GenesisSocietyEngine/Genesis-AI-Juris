use crate::{
    AllegedCassationGround, CaseReport, CassationGround, CassationOutcome, ClockAdvance,
    ClockSpeed, CommandId, DecisionOutcome, GameMinute, MatterResult, ProfessionalConsequences,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// Reason an otherwise valid command produced no state transition.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum IgnoredCommandReason {
    /// Clock was already paused.
    ClockAlreadyPaused,
    /// Clock was already running.
    ClockAlreadyRunning,
    /// Requested speed was already active.
    ClockSpeedAlreadySelected,
    /// Real-time tick arrived while paused.
    ClockPaused,
    /// Real-time tick arrived after terminal closure.
    MatterAlreadyClosed,
    /// Tick was too small to advance a full game minute.
    NoWholeGameMinuteElapsed,
}

/// Domain event emitted by the engine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DomainEvent {
    /// Matter opened.
    MatterOpened,

    /// Pleadings completed.
    PleadingsCompleted,

    /// Evidence development completed.
    EvidenceCompleted,

    /// Clock paused.
    ClockPaused,

    /// Clock resumed.
    ClockResumed,

    /// Clock speed changed.
    ClockSpeedChanged {
        /// New speed.
        speed: ClockSpeed,
    },

    /// Real-time tick was translated into game-time advancement.
    RealTimeTicked {
        /// Elapsed real milliseconds supplied by the adapter.
        elapsed_ms: u64,
        /// Exact deterministic clock projection.
        advance: ClockAdvance,
    },

    /// Command was accepted but intentionally ignored.
    CommandIgnored {
        /// Why no state transition occurred.
        reason: IgnoredCommandReason,
    },

    /// Substantive work reset inactivity escalation.
    SubstantiveWorkRecorded {
        /// Game time of the work.
        at: GameMinute,
    },

    /// First inactivity warning issued.
    InactivityWarningIssued {
        /// Exact threshold time.
        at: GameMinute,
    },

    /// Final inactivity warning issued.
    FinalInactivityWarningIssued {
        /// Exact threshold time.
        at: GameMinute,
    },

    /// Client terminated the engagement for inactivity.
    EngagementTerminatedForInactivity {
        /// Exact termination threshold.
        at: GameMinute,
    },

    /// Mandatory hearing scheduled.
    MandatoryHearingScheduled {
        /// Hearing opening time.
        opens_at: GameMinute,
        /// End of attendance grace period.
        grace_ends_at: GameMinute,
    },

    /// Mandatory hearing opened.
    MandatoryHearingOpened {
        /// Opening time.
        at: GameMinute,
    },

    /// Mandatory hearing attended.
    MandatoryHearingAttended {
        /// Attendance time.
        at: GameMinute,
    },

    /// Mandatory hearing missed.
    MandatoryHearingMissed {
        /// End of grace period.
        at: GameMinute,
    },

    /// First-instance judgment delivered.
    FirstInstanceJudgmentDelivered {
        /// Delivery time.
        at: GameMinute,
        /// Outcome proposed by the adjudication layer.
        proposed_outcome: DecisionOutcome,
        /// Effective outcome after mandatory procedural rules.
        effective_outcome: DecisionOutcome,
        /// Appeal deadline created for an adverse outcome.
        appeal_deadline: Option<GameMinute>,
    },

    /// Appeal advice prepared.
    AppealAdvicePrepared {
        /// Completion time.
        at: GameMinute,
    },

    /// Client appeal authorization requested.
    AppealAuthorizationRequested {
        /// Request time.
        at: GameMinute,
    },

    /// Client appeal authorization recorded.
    AppealAuthorizationRecorded {
        /// Decision time.
        at: GameMinute,
        /// Whether authorization was granted.
        approved: bool,
    },

    /// Appeal filed.
    AppealFiled {
        /// Filing time.
        at: GameMinute,
    },

    /// Appeal deadline expired.
    AppealDeadlineExpired {
        /// Expiry time.
        at: GameMinute,
    },

    /// Appellate judgment delivered.
    AppealJudgmentDelivered {
        /// Delivery time.
        at: GameMinute,
        /// Outcome.
        outcome: DecisionOutcome,
        /// Cassation deadline created for an adverse outcome.
        cassation_deadline: Option<GameMinute>,
    },

    /// Cassation grounds assessed.
    CassationGroundsAssessed {
        /// Assessment time.
        at: GameMinute,
        /// All alleged grounds.
        alleged_grounds: BTreeSet<AllegedCassationGround>,
        /// Cognizable legal grounds.
        viable_grounds: BTreeSet<CassationGround>,
    },

    /// Client cassation authorization requested.
    CassationAuthorizationRequested {
        /// Request time.
        at: GameMinute,
    },

    /// Client cassation authorization recorded.
    CassationAuthorizationRecorded {
        /// Decision time.
        at: GameMinute,
        /// Whether authorization was granted.
        approved: bool,
    },

    /// Cassation filed.
    CassationFiled {
        /// Filing time.
        at: GameMinute,
    },

    /// Cassation deadline expired.
    CassationDeadlineExpired {
        /// Expiry time.
        at: GameMinute,
    },

    /// Cassation decision delivered.
    CassationDecisionDelivered {
        /// Delivery time.
        at: GameMinute,
        /// Outcome.
        outcome: CassationOutcome,
    },

    /// Matter closed terminally.
    MatterClosed {
        /// Closure time.
        at: GameMinute,
        /// Final result.
        final_result: MatterResult,
        /// Closure consequences.
        consequences: ProfessionalConsequences,
    },

    /// Immutable case report generated.
    CaseReportGenerated {
        /// Generated report.
        report: CaseReport,
    },
}

/// Event record with deterministic sequence and causating command identifier.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RecordedEvent {
    sequence: u64,
    command_id: CommandId,
    event: DomainEvent,
}

impl RecordedEvent {
    pub(crate) fn new(sequence: u64, command_id: CommandId, event: DomainEvent) -> Self {
        Self {
            sequence,
            command_id,
            event,
        }
    }

    /// Monotonic event sequence, starting at 1.
    #[must_use]
    pub const fn sequence(&self) -> u64 {
        self.sequence
    }

    /// Command that caused the event.
    #[must_use]
    pub fn command_id(&self) -> &CommandId {
        &self.command_id
    }

    /// Domain event.
    #[must_use]
    pub fn event(&self) -> &DomainEvent {
        &self.event
    }
}
