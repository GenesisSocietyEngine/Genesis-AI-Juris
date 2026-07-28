//! Evidence definitions used by the scenario.

use crate::{EvidenceId, FactId};
use serde::{Deserialize, Serialize};

/// Broad evidence category.
///
/// The enum is intentionally extensible at schema-version boundaries.
/// Unknown future categories should require an explicit migration rather than
/// silently changing deterministic scenario behaviour.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceKind {
    Document,
    Email,
    Contract,
    Invoice,
    ExpertReport,
    WitnessStatement,
    SystemRecord,
    Other,
}

/// A document, testimony, record, or report that affects legal facts.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvidenceDefinition {
    pub id: EvidenceId,
    pub title: String,
    pub kind: EvidenceKind,

    #[serde(default)]
    pub description: Option<String>,

    #[serde(default)]
    pub supports_facts: Vec<FactId>,

    #[serde(default)]
    pub contradicts_facts: Vec<FactId>,

    /// Whether the player can use this evidence at scenario start.
    #[serde(default)]
    pub initially_available: bool,
}
