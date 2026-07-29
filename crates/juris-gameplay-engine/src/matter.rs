use crate::GameMinute;
use serde::{Deserialize, Serialize};

/// High-level procedural stage rendered by clients.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProceduralStage {
    /// Matter has not yet been formally opened.
    #[default]
    Intake,
    /// Pleadings are being prepared or exchanged.
    Pleadings,
    /// Evidence is being developed.
    Evidence,
    /// Hearing preparation is underway.
    HearingPreparation,
    /// A mandatory hearing is currently attendable.
    HearingOpen,
    /// The court's judgment is pending.
    JudgmentPending,
    /// First-instance judgment has been delivered.
    FirstInstanceJudgmentDelivered,
    /// Appeal advice is being prepared.
    AppealAdvice,
    /// The firm is waiting for client appeal instructions.
    AwaitingAppealInstructions,
    /// Appeal has been filed and is pending.
    AppealPending,
    /// Appellate judgment has been delivered.
    AppealJudgmentDelivered,
    /// Cassation grounds are being assessed.
    CassationAssessment,
    /// The firm is waiting for client cassation instructions.
    AwaitingCassationInstructions,
    /// Cassation proceedings are pending.
    CassationPending,
    /// The decision was quashed and the matter remitted.
    Remitted,
    /// The matter is terminally closed.
    Closed,
}

/// Engagement lifecycle, independent from the procedural result.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EngagementStatus {
    /// The firm is actively instructed.
    #[default]
    Active,
    /// The next procedural step requires client instructions.
    AwaitingClientInstructions,
    /// The client terminated the engagement.
    TerminatedByClient,
    /// The firm terminated the engagement.
    TerminatedByFirm,
    /// The engagement completed normally.
    Completed,
}

/// Type of loss.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LossKind {
    /// Loss after an ordinary merits assessment.
    Merits,
    /// Loss caused by a procedural default.
    ProceduralDefault,
    /// Loss caused by a missed filing or remedy deadline.
    MissedDeadline,
    /// Closure caused by client termination after inactivity.
    ClientTermination,
}

/// Court decision at first instance or on appeal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DecisionOutcome {
    /// Complete success.
    Won,
    /// Partial success.
    PartiallyWon,
    /// Unsuccessful result with an explicit cause.
    Lost(LossKind),
}

impl DecisionOutcome {
    /// Returns whether the decision is a loss.
    #[must_use]
    pub const fn is_loss(self) -> bool {
        matches!(self, Self::Lost(_))
    }

    /// Returns the loss kind, when applicable.
    #[must_use]
    pub const fn loss_kind(self) -> Option<LossKind> {
        match self {
            Self::Lost(kind) => Some(kind),
            Self::Won | Self::PartiallyWon => None,
        }
    }
}

/// User-facing result separate from procedural stage and engagement status.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MatterResult {
    /// No judgment has yet determined the result.
    #[default]
    Undecided,
    /// Won at first instance.
    WonAtFirstInstance,
    /// Partially won at first instance.
    PartiallyWonAtFirstInstance,
    /// Lost at first instance while an appeal remains possible.
    LostAtFirstInstance,
    /// Won on appeal.
    WonOnAppeal,
    /// Partially won on appeal.
    PartiallyWonOnAppeal,
    /// Lost on appeal while cassation may remain possible.
    LostOnAppeal,
    /// First-instance loss became final without appeal.
    FinalLossAfterFirstInstance,
    /// Appellate loss became final without successful cassation.
    FinalLossAfterAppeal,
    /// Cassation was dismissed.
    CassationDismissed,
    /// Decision was quashed and remitted for rehearing.
    RemittedAfterCassation,
    /// Client terminated the engagement.
    EngagementTerminated,
}

/// Scheduled mandatory hearing.
///
/// The domain stores absolute typed minutes. Display strings such as
/// `Day 5 · 10:00` are adapter concerns and cannot affect deadline logic.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MandatoryHearing {
    opens_at: GameMinute,
    grace_ends_at: GameMinute,
    attended_at: Option<GameMinute>,
    missed_at: Option<GameMinute>,
}

impl MandatoryHearing {
    pub(crate) fn scheduled(opens_at: GameMinute, grace_ends_at: GameMinute) -> Self {
        Self {
            opens_at,
            grace_ends_at,
            attended_at: None,
            missed_at: None,
        }
    }

    /// Hearing opening time.
    #[must_use]
    pub const fn opens_at(self) -> GameMinute {
        self.opens_at
    }

    /// End of the attendance grace period.
    #[must_use]
    pub const fn grace_ends_at(self) -> GameMinute {
        self.grace_ends_at
    }

    /// Attendance time.
    #[must_use]
    pub const fn attended_at(self) -> Option<GameMinute> {
        self.attended_at
    }

    /// Missed-hearing time.
    #[must_use]
    pub const fn missed_at(self) -> Option<GameMinute> {
        self.missed_at
    }

    /// Whether the hearing was attended.
    #[must_use]
    pub const fn was_attended(self) -> bool {
        self.attended_at.is_some()
    }

    /// Whether the hearing was missed.
    #[must_use]
    pub const fn was_missed(self) -> bool {
        self.missed_at.is_some()
    }

    pub(crate) fn mark_attended(&mut self, at: GameMinute) {
        self.attended_at = Some(at);
    }

    pub(crate) fn mark_missed(&mut self, at: GameMinute) {
        self.missed_at = Some(at);
    }
}
