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
