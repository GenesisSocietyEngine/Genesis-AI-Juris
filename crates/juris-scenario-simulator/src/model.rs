use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// Authoritative state tracked by the authoring-time simulator.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct SimulationState {
    pub stage: String,
    pub clock_minutes: u64,
    pub flags: BTreeMap<String, bool>,
    pub resolved_outcome: Option<String>,
}

/// Whether the supplied path completed the matter.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SimulationStatus {
    InProgress,
    Completed,
}

/// Transition type recorded in the deterministic trace.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TraceKind {
    Action,
    Event,
}

/// One state transition in replay order.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct TraceEntry {
    pub sequence: usize,
    pub kind: TraceKind,
    pub id: String,
    pub state_before: SimulationState,
    pub state_after: SimulationState,
}

/// Complete deterministic simulation result.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct SimulationResult {
    pub scenario_id: String,
    pub status: SimulationStatus,
    pub final_state: SimulationState,
    pub fired_events: Vec<String>,
    pub trace: Vec<TraceEntry>,
}
