//! Scheduled and causally triggered scenario events.

use crate::{
    ActionId, AsyncTaskId, Condition, DeadlineId, Effect, EventId, MetricId, ScenarioTime,
};
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

    AtTime {
        at: ScenarioTime,
    },

    AfterAction {
        action: ActionId,
    },

    AfterEvent {
        event: EventId,
    },

    AsyncTaskCompleted {
        task: AsyncTaskId,
    },

    DeadlineMissed {
        deadline: DeadlineId,
    },

    /// Edge-triggered when an explicit foreground-time segment crosses from
    /// below `threshold` to greater than or equal to it.
    MetricThresholdReached {
        metric: MetricId,
        threshold: i64,
    },

    ByEffect,
}

/// Declarative event definition.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EventDefinition {
    pub id: EventId,
    pub title: String,
    pub kind: EventKind,
    pub trigger: EventTrigger,

    /// Repeatable events may fire again after their trigger is re-armed (for
    /// example, a metric is reset below an idle-warning threshold).
    #[serde(default, skip_serializing_if = "is_false")]
    pub repeatable: bool,

    #[serde(default)]
    pub condition: Condition,

    #[serde(default)]
    pub effects: Vec<Effect>,
}

const fn is_false(value: &bool) -> bool {
    !*value
}
