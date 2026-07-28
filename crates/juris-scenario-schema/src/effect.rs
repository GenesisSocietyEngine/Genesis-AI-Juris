//! Declarative state transitions produced by actions and events.
//!
//! Effects describe intent. The authoritative engine remains responsible for
//! applying effects in a deterministic order and recording resulting events.

use crate::{
    AsyncTaskId, DeadlineId, EventId, EvidenceId, FactId, FactStatus, FlagId, InboxItemId,
    OutcomeId, StageId,
};
use serde::{Deserialize, Serialize};

/// A deterministic state transition requested by scenario content.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Effect {
    SetStage { stage: StageId },

    SetFlag { flag: FlagId, value: bool },

    SetFactStatus { fact: FactId, status: FactStatus },

    MakeEvidenceAvailable { evidence: EvidenceId },

    StartAsyncTask { task: AsyncTaskId },

    MarkAsyncTaskReady { task: AsyncTaskId },

    ReviewAsyncTask { task: AsyncTaskId },

    ExpireAsyncTask { task: AsyncTaskId },

    CompleteDeadline { deadline: DeadlineId },

    MissDeadline { deadline: DeadlineId },

    CreateInboxItem { item: InboxItemId },

    ResolveInboxItem { item: InboxItemId },

    TriggerEvent { event: EventId },

    ResolveOutcome { outcome: OutcomeId },
}
