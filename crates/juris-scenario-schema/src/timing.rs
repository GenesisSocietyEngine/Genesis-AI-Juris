//! Forward-only deterministic timing definitions.

use crate::{DeadlineId, ScenarioTime};
use serde::{Deserialize, Serialize};

/// A civil calendar target relative to the day containing the selected
/// authoritative anchor.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct RelativeCalendarTarget {
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub day_offset: u32,
    pub minute_of_day: u16,
}

/// Optional deterministic lower bounds for a forward completion target.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct RelativeTimeDefinition {
    /// Optional stored deadline due minute used as the relative/calendar
    /// anchor. Minimum turnaround remains anchored to the current clock.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub relative_to_deadline: Option<DeadlineId>,

    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub offset_minutes: u32,

    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub minimum_turnaround_minutes: u32,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub calendar_target: Option<RelativeCalendarTarget>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub not_before: Option<ScenarioTime>,
}

const fn is_zero_u32(value: &u32) -> bool {
    *value == 0
}
