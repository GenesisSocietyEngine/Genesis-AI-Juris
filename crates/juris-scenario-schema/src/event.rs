//! Scheduled and causally triggered scenario events.

use crate::{ActionId, AsyncTaskId, Condition, DeadlineId, Effect, EventId, ScenarioTime};
use serde::{Deserialize, Serialize};

/// Semantic classification used by validators and user interfaces.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    Generic,
    HearingScheduled,
    HearingOpened,
    HearingClosed,
    Judgment,
    Appeal,
    Cassation,
    MatterClosed,
}

/// Deterministic trigger for an event.
///
/// `ByEffect` means another action or event must explicitly contain
/// `Effect::TriggerEvent` for this event.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EventTrigger {
    ScenarioStart,

    AtTime { at: ScenarioTime },

    AfterAction { action: ActionId },

    AfterEvent { event: EventId },

    AsyncTaskCompleted { task: AsyncTaskId },

    DeadlineMissed { deadline: DeadlineId },

    ByEffect,
}

/// Declarative event definition.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EventDefinition {
    pub id: EventId,
    pub title: String,
    pub kind: EventKind,
    pub trigger: EventTrigger,

    #[serde(default)]
    pub condition: Condition,

    #[serde(default)]
    pub effects: Vec<Effect>,
}
