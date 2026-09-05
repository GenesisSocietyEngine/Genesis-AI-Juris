//! Declarative pressure windows composed from ordinary runtime primitives.

use crate::{ActionId, ActorId, DeadlineId, EventId, PressureWindowId};
use serde::{Deserialize, Serialize};

/// One authored pressure and its deterministic response window.
///
/// The definition deliberately references existing actors, events, deadlines,
/// and actions. It adds no second scheduler or mutable pressure lifecycle.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PressureWindowDefinition {
    pub id: PressureWindowId,
    pub source_actor_id: ActorId,
    pub activation_event_id: EventId,
    pub response_deadline_id: DeadlineId,
    pub countermove_event_id: EventId,
    pub response_action_ids: Vec<ActionId>,
}
