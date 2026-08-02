//! Declarative scenario schema for GENESIS: AI Juris.
//!
//! This crate defines serializable content only. It deliberately contains:
//!
//! - no mutable simulation state;
//! - no scheduler;
//! - no Flutter or mobile concepts;
//! - no LLM client;
//! - no arbitrary executable callbacks.
//!
//! A scenario generator may produce `ScenarioDefinition`, but the generated
//! document must be validated before the authoritative engine compiles it.

#![forbid(unsafe_code)]

mod action;
mod actor;
mod async_task;
mod condition;
mod deadline;
mod effect;
mod event;
mod evidence;
mod fact;
mod ids;
mod inbox;
mod lifecycle;
mod outcome;
mod scenario;
mod stage;

pub use action::{ActionDefinition, ActionRepeatability};
pub use actor::{ActorDefinition, ActorRole};
pub use async_task::{AsyncTaskDefinition, AsyncTaskStatus};
pub use condition::Condition;
pub use deadline::{DeadlineDefinition, DeadlineStatus};
pub use effect::Effect;
pub use event::{EventDefinition, EventKind, EventTrigger};
pub use evidence::{EvidenceDefinition, EvidenceKind};
pub use fact::{FactDefinition, FactStatus};
pub use ids::{
    ActionId, ActorId, AsyncTaskId, DeadlineId, EventId, EvidenceId, FactId, FlagId, InboxItemId,
    OutcomeId, ScenarioId, StageId,
};
pub use inbox::InboxItemDefinition;
pub use lifecycle::{JudicialDecisionInstance, JudicialResult, MatterLifecycleStatus};
pub use outcome::OutcomeDefinition;
pub use scenario::{
    JurisdictionReference, ScenarioClockDefinition, ScenarioClockMode, ScenarioDefinition,
    ScenarioMetadata, ScenarioTime, SCENARIO_SCHEMA_VERSION_V1,
};
pub use stage::{StageDefinition, StageKind};
