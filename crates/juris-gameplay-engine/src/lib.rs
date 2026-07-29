#![forbid(unsafe_code)]
//! Authoritative, deterministic gameplay domain model for GENESIS: AI Juris.
//!
//! This crate deliberately contains no Flutter concepts, UI labels, wall-clock
//! calls, random-number generation, or platform APIs. The application layer
//! sends typed commands and renders the resulting state and events.
//!
//! The design incorporates lessons from the mobile prototype:
//!
//! - time is represented as typed integer game minutes rather than parsed UI
//!   strings;
//! - pause affects time advancement only and never blocks read/navigation
//!   operations;
//! - clock rates use integer accumulation, so chunking ticks cannot introduce
//!   floating-point drift;
//! - automatic consequences are evaluated in deterministic chronological order;
//! - missed mandatory hearings force procedural-default outcomes and cannot be
//!   rescued by a seed or a proposed favourable judgment;
//! - first-instance loss is not terminal while an appeal remains available;
//! - appeal and cassation require explicit client authorization;
//! - cassation accepts legal grounds only and remits rather than silently
//!   converting a loss into a merits victory;
//! - commands are atomic and idempotent through explicit command identifiers;
//! - the complete state can be rebuilt from the recorded event stream.

mod clock;
mod command;
mod engine;
mod error;
mod event;
mod matter;
mod outcome;
mod remedies;
mod state;

pub use clock::{ClockAdvance, ClockError, ClockSpeed, GameMinute, SimulationClock};
pub use command::{CommandId, CommandIdError, GameplayCommand};
pub use engine::{CommandReceipt, GameplayEngine};
pub use error::EngineError;
pub use event::{DomainEvent, IgnoredCommandReason, RecordedEvent};
pub use matter::{
    DecisionOutcome, EngagementStatus, LossKind, MandatoryHearing, MatterResult, ProceduralStage,
};
pub use outcome::{CaseReport, ClosureReason, ProfessionalConsequences};
pub use remedies::{
    AllegedCassationGround, AppealState, CassationGround, CassationOutcome, CassationState,
    ClientAuthorization,
};
pub use state::{GameplayConfig, GameplayState, StateInvariantError};
