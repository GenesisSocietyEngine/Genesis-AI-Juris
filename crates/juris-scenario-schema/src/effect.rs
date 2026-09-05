//! Declarative state transitions produced by actions and events.
//!
//! Effects describe intent. The authoritative engine remains responsible for
//! applying effects in a deterministic order and recording resulting events.

use crate::{
    AsyncTaskId, DeadlineId, DecisionId, EventId, EvidenceId, FactId, FactStatus, FlagId,
    InboxItemId, JudicialResult, MetricId, OutcomeId, ResourceId, StageId,
};
use serde::{Deserialize, Serialize};

/// A deterministic state transition requested by scenario content.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Effect {
    SetStage {
        stage: StageId,
    },

    SetFlag {
        flag: FlagId,
        value: bool,
    },

    SetMetric {
        metric: MetricId,
        value: i64,
    },

    AddMetric {
        metric: MetricId,
        amount: i64,
    },

    SubtractMetric {
        metric: MetricId,
        amount: i64,
    },

    ClampMetric {
        metric: MetricId,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        minimum: Option<i64>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        maximum: Option<i64>,
    },

    SetResource {
        resource: ResourceId,
        value: i64,
    },

    AddResource {
        resource: ResourceId,
        amount: i64,
    },

    SubtractResource {
        resource: ResourceId,
        amount: i64,
    },

    SetFactStatus {
        fact: FactId,
        status: FactStatus,
    },

    MakeEvidenceAvailable {
        evidence: EvidenceId,
    },

    StartAsyncTask {
        task: AsyncTaskId,
    },

    MarkAsyncTaskReady {
        task: AsyncTaskId,
    },

    ReviewAsyncTask {
        task: AsyncTaskId,
    },

    ExpireAsyncTask {
        task: AsyncTaskId,
    },

    CompleteDeadline {
        deadline: DeadlineId,
    },

    MissDeadline {
        deadline: DeadlineId,
    },

    CreateInboxItem {
        item: InboxItemId,
    },

    ResolveInboxItem {
        item: InboxItemId,
    },

    SetJudicialResult {
        result: JudicialResult,
    },

    ResolveDeterministicDecision {
        decision: DecisionId,
    },

    TriggerEvent {
        event: EventId,
    },

    ResolveOutcome {
        outcome: OutcomeId,
    },
}
