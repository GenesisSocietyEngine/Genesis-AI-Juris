//! Deterministic post-outcome training debrief projection.
//!
//! The command log remains authoritative for executed action identity and
//! order. The session retains only the completion minute for each accepted
//! dispatch so snapshots do not need to replay the complete command log.
//! Completion minutes are rebuilt by ordinary save replay and are never
//! persisted or included in the final-state digest.

use std::collections::BTreeMap;

use juris_scenario_schema::{MatterLifecycleStatus, RESOURCE_BILLABLE_MINUTES, RESOURCE_SPEND_EUR};
use serde::Serialize;

use super::{DossierMatterStatus, ScenarioCommand, ScenarioSession};

/// Version of the additive training-debrief read model.
pub const TRAINING_DEBRIEF_PROJECTION_SCHEMA_VERSION: u32 = 1;

const REFLECTION_PROMPT_IDS: [&str; 4] = [
    "decisive_fact_or_evidence",
    "deadline_or_procedural_pressure",
    "time_or_budget_tradeoff",
    "alternative_replay_strategy",
];

/// One player action that was accepted by the authoritative runtime.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TrainingDebriefActionProjection {
    pub action_id: String,
    pub sequence: u64,
    pub completion_minute: u64,
    pub time_cost_minutes: u32,
    pub cost_eur: u32,
    pub billable_minutes: u32,
}

/// Initial and final values for one authoritative scenario resource.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TrainingDebriefResourceProjection {
    pub resource_id: String,
    pub initial_value: i64,
    pub current_value: i64,
}

/// Immutable factual review of one resolved run.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TrainingDebriefProjection {
    pub projection_schema_version: u32,
    pub scenario_id: String,
    pub resolved_outcome_id: String,
    pub final_scenario_minute: u64,
    pub matter_lifecycle: MatterLifecycleStatus,
    pub matter_status: DossierMatterStatus,
    pub executed_actions: Vec<TrainingDebriefActionProjection>,
    pub resources: Vec<TrainingDebriefResourceProjection>,
    pub reflection_prompt_ids: Vec<String>,
}

pub(super) fn project_training_debrief(
    session: &ScenarioSession,
    matter_lifecycle: MatterLifecycleStatus,
    matter_status: DossierMatterStatus,
) -> Option<TrainingDebriefProjection> {
    let resolved_outcome_id = session.state.outcome_id.clone()?;
    let dispatched_action_ids = session
        .command_log
        .iter()
        .filter_map(|command| match command {
            ScenarioCommand::Dispatch { action_id } => Some(action_id.as_str()),
            ScenarioCommand::AdvanceTime { .. } => None,
        })
        .collect::<Vec<_>>();

    assert_eq!(
        dispatched_action_ids.len(),
        session.dispatch_completion_minutes.len(),
        "every accepted dispatch must have one authoritative completion minute"
    );

    let executed_actions = dispatched_action_ids
        .into_iter()
        .zip(&session.dispatch_completion_minutes)
        .enumerate()
        .map(|(index, (action_id, completion_minute))| {
            let action = session
                .definition
                .actions
                .iter()
                .find(|action| action.id.as_str() == action_id)
                .expect("accepted action must exist in the validated definition");
            TrainingDebriefActionProjection {
                action_id: action_id.to_owned(),
                sequence: u64::try_from(index)
                    .expect("action sequence must fit in u64")
                    .checked_add(1)
                    .expect("action sequence must not overflow"),
                completion_minute: *completion_minute,
                time_cost_minutes: action.time_cost_minutes,
                cost_eur: action.cost_eur,
                billable_minutes: action.billable_minutes,
            }
        })
        .collect();

    let initial_resources = effective_initial_resources(session);
    let resources = session
        .state
        .resources
        .iter()
        .map(
            |(resource_id, current_value)| TrainingDebriefResourceProjection {
                resource_id: resource_id.clone(),
                initial_value: *initial_resources
                    .get(resource_id)
                    .expect("runtime resource must have an authoritative initial value"),
                current_value: *current_value,
            },
        )
        .collect();

    Some(TrainingDebriefProjection {
        projection_schema_version: TRAINING_DEBRIEF_PROJECTION_SCHEMA_VERSION,
        scenario_id: session.definition.metadata.id.as_str().to_owned(),
        resolved_outcome_id,
        final_scenario_minute: session.state.clock_minutes,
        matter_lifecycle,
        matter_status,
        executed_actions,
        resources,
        reflection_prompt_ids: REFLECTION_PROMPT_IDS
            .into_iter()
            .map(str::to_owned)
            .collect(),
    })
}

fn effective_initial_resources(session: &ScenarioSession) -> BTreeMap<String, i64> {
    let mut resources = session
        .definition
        .initial_resources
        .iter()
        .map(|(resource_id, value)| (resource_id.as_str().to_owned(), *value))
        .collect::<BTreeMap<_, _>>();
    if !resources.is_empty() {
        resources.entry(RESOURCE_SPEND_EUR.to_owned()).or_insert(0);
        resources
            .entry(RESOURCE_BILLABLE_MINUTES.to_owned())
            .or_insert(0);
    }
    resources
}
