//! Generic integer values used by deterministic runtime conditions.

use crate::{MetricId, ResourceId};
use serde::{Deserialize, Serialize};

/// Stable comparison operators for integer-valued conditions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntegerComparisonOperator {
    Equal,
    NotEqual,
    LessThan,
    LessThanOrEqual,
    GreaterThan,
    GreaterThanOrEqual,
}

/// One side of an integer comparison.
///
/// Offsets make resource-to-resource checks such as
/// `authorized_budget_eur >= spend_eur + action_cost` possible without
/// embedding arithmetic or scenario-specific logic in the runtime.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "source", rename_all = "snake_case")]
pub enum IntegerOperand {
    Constant {
        value: i64,
    },
    Metric {
        metric: MetricId,

        #[serde(default, skip_serializing_if = "is_zero_i64")]
        offset: i64,
    },
    Resource {
        resource: ResourceId,

        #[serde(default, skip_serializing_if = "is_zero_i64")]
        offset: i64,
    },
}

const fn is_zero_i64(value: &i64) -> bool {
    *value == 0
}
