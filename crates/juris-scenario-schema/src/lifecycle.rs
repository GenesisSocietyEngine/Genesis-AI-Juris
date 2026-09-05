//! Authoritative judicial result and derived matter-lifecycle values.

use crate::StageKind;
use serde::{Deserialize, Serialize};

/// Substantive judicial result recorded at the current procedural point.
///
/// A later remedy may replace an earlier result, so this value is deliberately
/// mutable runtime state rather than a terminal outcome.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JudicialResult {
    Won,
    Lost,
    PartiallyWon,
    Dismissed,
}

/// Procedural instance that produced the current [`JudicialResult`].
///
/// This value is absent until a judicial result is recorded. A subsequent
/// decision replaces both the result and its instance, so the two values
/// always describe the same latest authoritative decision.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JudicialDecisionInstance {
    FirstInstance,
    Appeal,
    Cassation,
}

impl JudicialDecisionInstance {
    /// Maps the authoritative stage at `SetJudicialResult` execution time and
    /// the prior instance, if any, to the instance that produced the result.
    ///
    /// Appeal and cassation map to their corresponding remedies. Trial and
    /// post-judgment stages map to first instance. Enforcement and resolved
    /// stages are not decision instances, so they preserve the prior instance;
    /// first instance is used only when no prior instance exists.
    #[must_use]
    pub const fn from_stage(kind: StageKind, prior: Option<Self>) -> Self {
        match kind {
            StageKind::Appeal => Self::Appeal,
            StageKind::Cassation => Self::Cassation,
            StageKind::Standard
            | StageKind::HearingPreparation
            | StageKind::Hearing
            | StageKind::PostJudgment => Self::FirstInstance,
            StageKind::Enforcement | StageKind::Resolved => match prior {
                Some(instance) => instance,
                None => Self::FirstInstance,
            },
        }
    }
}

/// Procedural lifecycle derived from the authoritative current stage.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MatterLifecycleStatus {
    Active,
    PostJudgment,
    Appeal,
    Cassation,
    Enforcement,
    Closed,
}

impl MatterLifecycleStatus {
    /// Derives lifecycle without introducing a second mutable state machine.
    #[must_use]
    pub const fn from_stage(kind: StageKind, terminal: bool) -> Self {
        if terminal || matches!(kind, StageKind::Resolved) {
            return Self::Closed;
        }

        match kind {
            StageKind::PostJudgment => Self::PostJudgment,
            StageKind::Appeal => Self::Appeal,
            StageKind::Cassation => Self::Cassation,
            StageKind::Enforcement => Self::Enforcement,
            StageKind::Standard
            | StageKind::HearingPreparation
            | StageKind::Hearing
            | StageKind::Resolved => Self::Active,
        }
    }

    #[must_use]
    pub const fn is_closed(self) -> bool {
        matches!(self, Self::Closed)
    }
}
