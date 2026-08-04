//! Explicit deterministic decisions resolved by the authoritative runtime.

use crate::{Condition, DecisionBranchId, DecisionId, Effect, IntegerOperand, MetricId};
use serde::{Deserialize, Serialize};

/// One ordered branch of a deterministic decision.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeterministicDecisionBranch {
    pub id: DecisionBranchId,

    #[serde(default)]
    pub condition: Condition,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub minimum_roll: Option<i64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub maximum_roll: Option<i64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub minimum_total: Option<i64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub maximum_total: Option<i64>,

    #[serde(default)]
    pub effects: Vec<Effect>,
}

/// One checked integer term contributing to a deterministic decision score.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeterministicDecisionScoreTerm {
    pub operand: IntegerOperand,

    #[serde(
        default = "default_roll_multiplier",
        skip_serializing_if = "is_default_roll_multiplier"
    )]
    pub multiplier: i64,

    #[serde(default)]
    pub condition: Condition,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub minimum: Option<i64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub maximum: Option<i64>,
}

/// A stable, ID-addressed deterministic choice.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeterministicDecisionDefinition {
    pub id: DecisionId,

    /// Hash-derived roll is in `0..roll_range`, then `roll_offset` is added.
    #[serde(
        default = "default_roll_range",
        skip_serializing_if = "is_default_roll_range"
    )]
    pub roll_range: u32,

    #[serde(default, skip_serializing_if = "is_zero_i64")]
    pub roll_offset: i64,

    /// Multiplier applied after the offset and before adding `score_metric`.
    #[serde(
        default = "default_roll_multiplier",
        skip_serializing_if = "is_default_roll_multiplier"
    )]
    pub roll_multiplier: i64,

    /// Optional metric added to the offset roll to form `total`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub score_metric: Option<MetricId>,

    /// Ordered checked score terms. Only terms whose condition is true are
    /// included. Each operand is clamped before multiplication.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub score_terms: Vec<DeterministicDecisionScoreTerm>,

    /// Positive divisor applied after adding `score_offset` to the checked
    /// score sum. A value of one preserves the unscaled sum.
    #[serde(
        default = "default_roll_multiplier",
        skip_serializing_if = "is_default_roll_multiplier"
    )]
    pub score_divisor: i64,

    #[serde(default, skip_serializing_if = "is_zero_i64")]
    pub score_offset: i64,

    #[serde(default)]
    pub branches: Vec<DeterministicDecisionBranch>,
}

const fn default_roll_range() -> u32 {
    100
}

const fn is_default_roll_range(value: &u32) -> bool {
    *value == default_roll_range()
}

const fn is_zero_i64(value: &i64) -> bool {
    *value == 0
}

const fn default_roll_multiplier() -> i64 {
    1
}

const fn is_default_roll_multiplier(value: &i64) -> bool {
    *value == default_roll_multiplier()
}
