//! Top-level declarative scenario document.

use crate::{
    ActionDefinition, ActorDefinition, AsyncTaskDefinition, DeadlineDefinition, EventDefinition,
    EvidenceDefinition, FactDefinition, InboxItemDefinition, OutcomeDefinition, ScenarioId,
    StageDefinition, StageId,
};
use serde::{Deserialize, Serialize};

/// Current version understood by this schema crate.
pub const SCENARIO_SCHEMA_VERSION_V1: &str = "1.0";

/// How simulated time may advance for a scenario.
///
/// Action-driven remains the backward-compatible default. Foreground scenarios
/// additionally accept explicit deterministic minute commands while the app is
/// active.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScenarioClockMode {
    #[default]
    ActionDriven,
    Foreground,
}

/// Declarative clock policy for one scenario.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ScenarioClockDefinition {
    #[serde(default)]
    pub mode: ScenarioClockMode,
}

/// Deterministic simulated time.
///
/// Time is represented as a day plus minute-of-day instead of wall-clock
/// timestamps. This avoids time-zone, daylight-saving, and locale-dependent
/// behaviour in deterministic simulations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct ScenarioTime {
    pub day: u32,
    pub minute_of_day: u16,
}

impl ScenarioTime {
    /// Constructs a scenario time value.
    ///
    /// The validator will reject values where `minute_of_day >= 1440`.
    pub const fn new(day: u32, minute_of_day: u16) -> Self {
        Self { day, minute_of_day }
    }
}

/// Human-facing metadata that does not directly mutate runtime state.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScenarioMetadata {
    pub id: ScenarioId,
    pub title: String,
    pub summary: String,
    pub content_version: String,

    #[serde(default)]
    pub author: Option<String>,

    #[serde(default)]
    pub tags: Vec<String>,
}

/// Reference to an external, versioned jurisdiction pack.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JurisdictionReference {
    pub code: String,
    pub pack_version: String,
}

/// Complete declarative source document for one playable scenario.
///
/// Collection order may affect presentation but must never provide identity.
/// All cross-references therefore use stable typed IDs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScenarioDefinition {
    pub schema_version: String,
    pub metadata: ScenarioMetadata,
    pub jurisdiction: JurisdictionReference,
    pub initial_stage: StageId,

    #[serde(default)]
    pub clock: ScenarioClockDefinition,

    #[serde(default)]
    pub actors: Vec<ActorDefinition>,

    #[serde(default)]
    pub facts: Vec<FactDefinition>,

    #[serde(default)]
    pub evidence: Vec<EvidenceDefinition>,

    #[serde(default)]
    pub stages: Vec<StageDefinition>,

    #[serde(default)]
    pub actions: Vec<ActionDefinition>,

    #[serde(default)]
    pub deadlines: Vec<DeadlineDefinition>,

    #[serde(default)]
    pub async_tasks: Vec<AsyncTaskDefinition>,

    #[serde(default)]
    pub inbox_items: Vec<InboxItemDefinition>,

    #[serde(default)]
    pub events: Vec<EventDefinition>,

    #[serde(default)]
    pub outcomes: Vec<OutcomeDefinition>,
}
