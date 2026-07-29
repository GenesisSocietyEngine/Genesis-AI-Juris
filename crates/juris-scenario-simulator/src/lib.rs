//! Deterministic authoring-time path simulation for GENESIS: AI Juris.
//!
//! Commit 11D provides a narrow replay harness for scenario authors. It reads
//! canonical scenario JSON, executes a supplied sequence of stable action IDs,
//! advances typed scenario time, fires deterministic automatic events, and
//! verifies explicit outcome resolution.
//!
//! This crate is not the final mobile gameplay runtime. It is a pre-UI content
//! gate used to prove that authored paths can be replayed reproducibly.

mod cli;
mod document;
mod engine;
mod error;
mod model;

pub use cli::{help_text, run_cli};
pub use document::ScenarioDocument;
pub use engine::ScenarioSimulator;
pub use error::SimulationError;
pub use model::{
    ScenarioTraceCommand, SimulationResult, SimulationState, SimulationStatus, TraceEntry,
    TraceKind,
};
