//! Procedural and client-facing deadlines.

use crate::{ActionId, DeadlineId, EventId, ScenarioTime};
use serde::{Deserialize, Serialize};

/// Runtime lifecycle states supported by every deadline.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeadlineStatus {
    Open,
    Completed,
    Missed,
}

/// Declarative deadline definition.
///
/// The validator will require both a completion path and a missed-event path,
/// ensuring that an open deadline cannot remain unresolved forever.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeadlineDefinition {
    pub id: DeadlineId,
    pub title: String,
    pub due_at: ScenarioTime,

    /// If absent, the deadline is active at scenario start.
    #[serde(default)]
    pub activation_event: Option<EventId>,

    #[serde(default)]
    pub completion_actions: Vec<ActionId>,

    #[serde(default)]
    pub completion_event: Option<EventId>,

    pub missed_event: EventId,
}
