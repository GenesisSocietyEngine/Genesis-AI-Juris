//! Asynchronous work such as expert reports and delegated document reviews.

use crate::{ActionId, AsyncTaskId, EventId, RelativeTimeDefinition};
use serde::{Deserialize, Serialize};

/// Complete lifecycle for asynchronous work.
///
/// `Ready` means the work product exists but has not necessarily been reviewed
/// or incorporated into the legal strategy.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AsyncTaskStatus {
    NotStarted,
    InProgress,
    Ready,
    Reviewed,
    Expired,
}

/// Declarative asynchronous task.
///
/// Every task must have a completion event. Tasks that become irrelevant after
/// another procedural event should also define a usable-until boundary and an
/// expiry event.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AsyncTaskDefinition {
    pub id: AsyncTaskId,
    pub title: String,
    pub start_action: ActionId,
    pub completion_event: EventId,
    pub duration_minutes: u32,

    /// Optional forward calendar target combined with duration as a minimum.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completion_timing: Option<RelativeTimeDefinition>,

    #[serde(default)]
    pub usable_until_event: Option<EventId>,

    #[serde(default)]
    pub expiry_event: Option<EventId>,
}
