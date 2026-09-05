//! Terminal legal and career outcomes.

use crate::{Condition, OutcomeId, StageId};
use serde::{Deserialize, Serialize};

/// Final scenario result.
///
/// Financial, reputation, and career scoring can be added in a later schema
/// revision. Version 1 first establishes deterministic terminal identity and
/// reachability.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OutcomeDefinition {
    pub id: OutcomeId,
    pub title: String,
    pub summary: String,
    pub terminal_stage: StageId,

    #[serde(default)]
    pub condition: Condition,
}
