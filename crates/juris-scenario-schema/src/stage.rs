//! Procedural stages of a legal matter.

use crate::{ActionId, EventId, StageId};
use serde::{Deserialize, Serialize};

/// Semantic kind of stage.
///
/// The kind allows validators and user interfaces to apply domain-specific
/// rules without relying on fragile stage names such as `"Hearing"`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StageKind {
    Standard,
    HearingPreparation,
    Hearing,
    PostJudgment,
    Appeal,
    Cassation,
    Enforcement,
    Resolved,
}

/// A procedural state through which the matter may progress.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StageDefinition {
    pub id: StageId,
    pub title: String,
    pub kind: StageKind,

    /// Optional event that marks formal entry into this stage.
    ///
    /// The initial stage commonly has no entry event.
    #[serde(default)]
    pub entry_event: Option<EventId>,

    /// Actions expected to provide exits from the stage.
    ///
    /// The validator will later verify that the actions exist and can actually
    /// transition to another stage or terminal outcome.
    #[serde(default)]
    pub exit_actions: Vec<ActionId>,

    /// A terminal stage must not expose further gameplay actions.
    #[serde(default)]
    pub terminal: bool,
}
