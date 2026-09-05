//! Legally relevant facts and their initial epistemic status.

use crate::{ActorId, FactId};
use serde::{Deserialize, Serialize};

/// Current legal or evidentiary status of a fact.
///
/// These statuses are not equivalent to objective truth. They represent what
/// the simulated legal matter currently treats as alleged, disputed, proven,
/// or otherwise known.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FactStatus {
    Alleged,
    Admitted,
    Disputed,
    Proven,
    Inferred,
    Unknown,
}

/// A legally relevant proposition that may evolve during the scenario.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FactDefinition {
    pub id: FactId,
    pub statement: String,
    pub initial_status: FactStatus,

    /// Actors directly connected to the fact.
    ///
    /// References are validated later by `juris-scenario-validator`.
    #[serde(default)]
    pub related_actors: Vec<ActorId>,
}
