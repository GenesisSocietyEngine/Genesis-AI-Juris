use std::collections::BTreeMap;

use juris_scenario_schema::{JudicialDecisionInstance, JudicialResult, MatterLifecycleStatus};
use serde::{Deserialize, Serialize};

/// Authoritative state tracked by the authoring-time simulator.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct SimulationState {
    pub stage: String,
    pub clock_minutes: u64,
    pub flags: BTreeMap<String, bool>,
    /// Generic authoritative integer metrics. Empty for legacy scenarios and
    /// omitted from their serialized traces to preserve the v1 output shape.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub numeric_metrics: BTreeMap<String, i64>,
    /// Generic authoritative resources such as budget, spend, and billable
    /// minutes. Empty for legacy scenarios.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub resources: BTreeMap<String, i64>,
    pub judicial_result: Option<JudicialResult>,
    pub judicial_decision_instance: Option<JudicialDecisionInstance>,
    pub matter_lifecycle: MatterLifecycleStatus,
    pub resolved_outcome: Option<String>,
    pub is_closed: bool,
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
    AdvanceTime,
    Event,
}

/// One deterministic authoring/replay command.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case")]
pub enum ScenarioTraceCommand {
    Dispatch { action_id: String },
    AdvanceTime { minutes: u32 },
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
    pub deadline_statuses: BTreeMap<String, Option<String>>,
    pub async_task_statuses: BTreeMap<String, String>,
    pub trace: Vec<TraceEntry>,
}
