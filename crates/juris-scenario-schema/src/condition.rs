//! Declarative predicates controlling action and event availability.
//!
//! Conditions contain data only. They do not execute arbitrary Rust code.
//! This restriction is essential for deterministic replay, validation,
//! scenario generation, and future cross-platform execution.

use crate::{AsyncTaskId, DeadlineId, EvidenceId, FactId, FlagId, InboxItemId, StageId};
use crate::{AsyncTaskStatus, DeadlineStatus, FactStatus};
use serde::{Deserialize, Serialize};

/// Predicate evaluated against authoritative runtime state.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Condition {
    /// Absence of an explicit condition means that the item is unconditionally
    /// available. The validator may later apply additional structural rules.
    #[default]
    Always,

    StageIs {
        stage: StageId,
    },

    FlagEquals {
        flag: FlagId,
        value: bool,
    },

    FactStatusIs {
        fact: FactId,
        status: FactStatus,
    },

    EvidenceAvailable {
        evidence: EvidenceId,
    },

    DeadlineStatusIs {
        deadline: DeadlineId,
        status: DeadlineStatus,
    },

    AsyncTaskStatusIs {
        task: AsyncTaskId,
        status: AsyncTaskStatus,
    },

    InboxItemResolved {
        item: InboxItemId,
    },

    All {
        conditions: Vec<Condition>,
    },

    Any {
        conditions: Vec<Condition>,
    },

    Not {
        condition: Box<Condition>,
    },
}
