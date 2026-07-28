//! Declarative Inbox messages.
//!
//! Read state and resolution state are intentionally distinct. Opening an
//! email may mark it as read, but it must not automatically satisfy the legal
//! or procedural action represented by the message.

use crate::{ActionId, EventId, InboxItemId};
use serde::{Deserialize, Serialize};

/// Message displayed in the player's legal-work Inbox.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InboxItemDefinition {
    pub id: InboxItemId,
    pub subject: String,
    pub body: String,

    /// If absent, the message is visible at scenario start.
    #[serde(default)]
    pub created_by_event: Option<EventId>,

    #[serde(default)]
    pub initially_visible: bool,

    #[serde(default)]
    pub action_required: bool,

    /// At least one resolution action or an expiry event is required for every
    /// action-required message.
    #[serde(default)]
    pub resolution_actions: Vec<ActionId>,

    #[serde(default)]
    pub expiry_event: Option<EventId>,
}
