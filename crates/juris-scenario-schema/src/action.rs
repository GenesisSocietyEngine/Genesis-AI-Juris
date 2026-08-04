//! Player and system actions available during a scenario.

use crate::{ActionId, Condition, DeadlineId, Effect, RelativeTimeDefinition};
use serde::{Deserialize, Serialize};

/// Controls whether an action may be executed more than once.
///
/// Repeatability is declared explicitly because accidental repeatability
/// caused several lifecycle bugs in the mobile prototype.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ActionRepeatability {
    /// Actions are one-shot by default because accidental repeatability can
    /// create duplicate expert requests, repeated filings, or other invalid
    /// lifecycle transitions.
    #[default]
    Once,

    Unlimited,

    Limited {
        max_uses: u32,
    },
}

/// Declarative action definition.
///
/// No closures, callbacks, or mutable runtime objects are stored here.
/// This makes actions serializable, inspectable, and validator-friendly.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActionDefinition {
    pub id: ActionId,
    pub title: String,

    #[serde(default)]
    pub description: Option<String>,

    /// Stable presentation capabilities such as `ai`. Presentation code may
    /// filter by these tags without parsing localized titles or action IDs.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub presentation_tags: Vec<String>,

    #[serde(default)]
    pub available_when: Condition,

    #[serde(default)]
    pub effects: Vec<Effect>,

    /// Simulated time consumed by the action.
    #[serde(default)]
    pub time_cost_minutes: u32,

    /// External professional, expert, filing, or operational spend in euros.
    ///
    /// This is deliberately separate from simulated player time. Existing
    /// scenarios remain backward compatible and deserialize with zero cost.
    #[serde(default)]
    pub cost_eur: u32,

    /// Professional time charged to the client. This is deliberately
    /// independent from elapsed scenario time.
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub billable_minutes: u32,

    /// Optional forward-only completion target. The runtime completes the
    /// action no earlier than its fixed time cost and every timing candidate.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completion_timing: Option<RelativeTimeDefinition>,

    /// The earliest currently-open stored due minute becomes a forward target.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub advance_to_deadlines: Vec<DeadlineId>,

    /// Opt-in finish-by constraints. The earliest open stored due minute is
    /// selected; exact-minute completion follows that deadline's
    /// `completion_at_due_allowed` policy.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub completion_deadlines: Vec<DeadlineId>,

    /// Signed adjustment to the selected completion deadline.
    #[serde(default, skip_serializing_if = "is_zero_i64")]
    pub completion_deadline_offset_minutes: i64,

    #[serde(default)]
    pub repeatability: ActionRepeatability,
}

const fn is_zero_u32(value: &u32) -> bool {
    *value == 0
}

const fn is_zero_i64(value: &i64) -> bool {
    *value == 0
}
