//! Actors participating in a legal scenario.

use crate::ActorId;
use serde::{Deserialize, Serialize};

/// Functional role played by an actor.
///
/// The role is intentionally domain-oriented rather than UI-oriented.
/// Flutter may render roles differently, but the scenario remains independent
/// from any particular presentation layer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActorRole {
    Player,
    Client,
    OpposingParty,
    OpposingCounsel,
    Court,
    Expert,
    Colleague,
    Witness,
    Other,
}

/// Declarative description of a person or institution in the scenario.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActorDefinition {
    pub id: ActorId,
    pub name: String,
    pub role: ActorRole,

    #[serde(default)]
    pub description: Option<String>,
}
