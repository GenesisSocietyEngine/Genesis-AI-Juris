//! Procedural and client-facing deadlines.

use crate::{ActionId, DeadlineId, EventId, RelativeTimeDefinition, ScenarioTime};
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

    /// Optional forward due-time calculation resolved and stored when the
    /// deadline becomes active.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub relative_due: Option<RelativeTimeDefinition>,

    /// When true, the deadline remains open throughout its due minute and is
    /// missed at the following minute. Completion exactly at due is allowed.
    #[serde(default, skip_serializing_if = "is_false")]
    pub completion_at_due_allowed: bool,

    /// If absent, the deadline is active at scenario start.
    #[serde(default)]
    pub activation_event: Option<EventId>,

    #[serde(default)]
    pub completion_actions: Vec<ActionId>,

    #[serde(default)]
    pub completion_event: Option<EventId>,

    pub missed_event: EventId,
}

const fn is_false(value: &bool) -> bool {
    !*value
}
