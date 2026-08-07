//! Generic authoritative runtime for declarative scenario definitions.
//!
//! Flutter and other presentation layers receive immutable snapshots and send
//! stable action IDs. They never apply scenario effects themselves. Keeping
//! interpretation and mutation inside `juris-engine` preserves the authority
//! boundary while allowing new validated scenarios to reuse one runtime.

use std::collections::{BTreeMap, BTreeSet, VecDeque};

use juris_scenario_schema::{
    ActionDefinition, ActionRepeatability, AsyncTaskStatus, Condition, DeadlineStatus, Effect,
    EventDefinition, EventTrigger, FactStatus, IntegerComparisonOperator, IntegerOperand,
    JudicialDecisionInstance, JudicialResult, MatterLifecycleStatus, RelativeTimeDefinition,
    ScenarioClockMode, ScenarioDefinition, ScenarioTime, RESOURCE_BILLABLE_MINUTES,
    RESOURCE_SPEND_EUR,
};
use juris_scenario_validator::validate_scenario;
use serde::Serialize;
use sha2::{Digest, Sha256};
use thiserror::Error;

mod dossier;
mod persistence;
mod pressure_countermove;
mod training_debrief;

pub use dossier::{
    DossierDeadlineProjection, DossierEvidenceProjection, DossierFactProjection,
    DossierMatterStatus, DossierOutcomeProjection, DossierProcedureProjection, DossierProjection,
    DossierRemedyProjection, DOSSIER_PROJECTION_SCHEMA_VERSION,
};

pub use persistence::{
    ScenarioCommand, ScenarioSaveEnvelope, ScenarioSaveError, SAVE_SCHEMA_ID, SAVE_SCHEMA_VERSION,
};
pub use pressure_countermove::{
    ActivePressureProjection, PressureAndCountermoveProjection,
    PRESSURE_COUNTERMOVE_PROJECTION_SCHEMA_VERSION,
};
pub use training_debrief::{
    TrainingDebriefActionProjection, TrainingDebriefProjection, TrainingDebriefResourceProjection,
    TRAINING_DEBRIEF_PROJECTION_SCHEMA_VERSION,
};

const SNAPSHOT_SCHEMA_VERSION: u32 = 1;
const MAX_EVENTS_PER_COMMAND: usize = 256;
pub const MAX_FOREGROUND_ADVANCE_MINUTES: u32 = 1_440;

/// Errors returned by the generic scenario runtime.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ScenarioRuntimeError {
    #[error("scenario JSON could not be parsed: {0}")]
    InvalidJson(String),

    #[error("scenario validation failed: {0}")]
    InvalidScenario(String),

    #[error("the scenario has already reached a terminal outcome")]
    ScenarioResolved,

    #[error("action `{0}` is not currently available")]
    ActionUnavailable(String),

    #[error("deadline `{0}` is not active")]
    DeadlineInactive(String),

    #[error(
        "action `{action}` would complete at minute {completion}, outside deadline `{deadline}` at minute {due}"
    )]
    ActionCompletionDeadlineExceeded {
        action: String,
        deadline: String,
        completion: u64,
        due: u64,
    },

    #[error("integer state overflow while updating `{0}`")]
    IntegerOverflow(String),

    #[error("integer state `{0}` is not configured")]
    UnknownIntegerState(String),

    #[error("deterministic decision `{0}` does not exist")]
    UnknownDecision(String),

    #[error("deterministic decision `{0}` has no eligible positive-weight branch")]
    NoEligibleDecisionBranch(String),

    #[error("deterministic decision `{0}` could not be resolved: {1}")]
    DecisionResolution(String, String),

    #[error("foreground clock advancement is not enabled for this scenario")]
    ClockAdvanceUnsupported,

    #[error("clock advancement must be greater than zero minutes")]
    InvalidClockAdvance,

    #[error("clock advancement of {requested} minutes exceeds the per-command limit of {maximum}")]
    ClockAdvanceLimitExceeded { requested: u32, maximum: u32 },

    #[error("event `{0}` does not exist")]
    UnknownEvent(String),

    #[error("outcome `{0}` does not exist")]
    UnknownOutcome(String),

    #[error("outcome `{outcome}` targets stage `{expected}` but the runtime is at `{actual}`")]
    OutcomeStageMismatch {
        outcome: String,
        expected: String,
        actual: String,
    },

    #[error("outcome `{0}` condition is false")]
    OutcomeConditionFalse(String),

    #[error("outcome `{new_outcome}` conflicts with already resolved `{existing}`")]
    ConflictingOutcome {
        existing: String,
        new_outcome: String,
    },

    #[error("scenario clock overflow")]
    ClockOverflow,

    #[error("automatic event limit of {0} was exceeded")]
    EventLimitExceeded(usize),

    #[error("scenario session `{0}` does not exist")]
    UnknownSession(u64),
}

/// Presentation-safe description of one currently executable action.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MobileActionSnapshot {
    pub id: String,
    pub title: String,
    pub description: Option<String>,

    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub presentation_tags: Vec<String>,
    pub time_cost_minutes: u32,
    pub cost_eur: u32,

    #[serde(skip_serializing_if = "is_zero_u32")]
    pub billable_minutes: u32,

    /// Forward elapsed completion target for actions that opt into calendar or
    /// deadline-driven timing.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completion_at_minutes: Option<u64>,
}

/// Presentation-safe fact state.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MobileFactSnapshot {
    pub id: String,
    pub statement: String,
    pub status: String,
}

/// Presentation-safe evidence state.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MobileEvidenceSnapshot {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub available: bool,
}

/// Presentation-safe active deadline state.
///
/// The optional status field is retained for the version-1 JSON shape, but the
/// player projection omits inactive deadlines and therefore always emits a
/// concrete status.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MobileDeadlineSnapshot {
    pub id: String,
    pub title: String,
    pub due_at_minutes: u64,
    pub status: Option<String>,
    pub completion_action_ids: Vec<String>,
}

/// Presentation-safe Inbox state.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MobileInboxSnapshot {
    pub id: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender: Option<String>,

    pub subject: String,
    pub body: String,
    pub visible: bool,
    pub action_required: bool,
    pub resolved: bool,

    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub resolution_action_ids: Vec<String>,
}

/// Explicit terminal outcome exposed to mobile clients.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MobileOutcomeSnapshot {
    pub id: String,
    pub title: String,
    pub summary: String,
}

/// Immutable read model returned after session creation and every command.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MobileScenarioSnapshot {
    pub snapshot_schema_version: u32,
    pub scenario_id: String,
    pub seed: u64,
    pub stage_id: String,
    pub stage_title: String,
    pub clock_minutes: u64,
    pub clock_mode: String,
    pub judicial_result: Option<JudicialResult>,
    pub judicial_decision_instance: Option<JudicialDecisionInstance>,
    pub matter_lifecycle: MatterLifecycleStatus,
    pub is_closed: bool,
    pub resolved_outcome: Option<String>,
    /// Backward-compatible alias for `is_closed`.
    pub terminal: bool,
    pub dossier: DossierProjection,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub pressure_and_countermove: Option<PressureAndCountermoveProjection>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub training_debrief: Option<TrainingDebriefProjection>,

    /// Structurally retained version-1 diagnostic field. Player snapshots
    /// always emit an empty map; Rust tests use explicit diagnostic accessors.
    pub flags: BTreeMap<String, bool>,

    /// Optional canonical generic state. Existing scenarios that do not opt
    /// in omit these keys from serialized snapshots.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub numeric_metrics: Option<BTreeMap<String, i64>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<BTreeMap<String, i64>>,
    pub facts: Vec<MobileFactSnapshot>,
    pub evidence: Vec<MobileEvidenceSnapshot>,
    pub deadlines: Vec<MobileDeadlineSnapshot>,
    pub inbox: Vec<MobileInboxSnapshot>,
    pub available_actions: Vec<MobileActionSnapshot>,
    /// Structurally retained version-1 diagnostic field. Player snapshots
    /// always emit an empty list.
    pub fired_event_ids: Vec<String>,
    pub outcome: Option<MobileOutcomeSnapshot>,
}

#[derive(Debug, Clone)]
struct ScenarioRuntimeState {
    stage_id: String,
    clock_minutes: u64,
    flags: BTreeMap<String, bool>,
    numeric_metrics: BTreeMap<String, i64>,
    resources: BTreeMap<String, i64>,
    fact_statuses: BTreeMap<String, FactStatus>,
    available_evidence: BTreeSet<String>,
    deadline_statuses: BTreeMap<String, Option<DeadlineStatus>>,
    deadline_due_minutes: BTreeMap<String, u64>,
    task_statuses: BTreeMap<String, AsyncTaskStatus>,
    task_due_minutes: BTreeMap<String, u64>,
    visible_inbox: BTreeSet<String>,
    resolved_inbox: BTreeSet<String>,
    action_uses: BTreeMap<String, u32>,
    fired_events: BTreeSet<String>,
    decision_resolutions: BTreeMap<String, Vec<String>>,
    judicial_result: Option<JudicialResult>,
    judicial_decision_instance: Option<JudicialDecisionInstance>,
    outcome_id: Option<String>,
}

#[derive(Default)]
struct EventProcessingContext {
    processed: usize,
    repeatable_ids: BTreeSet<String>,
}

/// Authoritative runtime for one validated declarative scenario.
#[derive(Debug, Clone)]
pub struct ScenarioSession {
    seed: u64,
    definition: ScenarioDefinition,
    state: ScenarioRuntimeState,
    command_log: Vec<ScenarioCommand>,
    /// Completion minute for each accepted Dispatch command, in command-log
    /// dispatch order. This projection metadata is rebuilt by ordinary replay
    /// and is never persisted or included in the final-state digest.
    dispatch_completion_minutes: Vec<u64>,
    /// Ephemeral causal anchor used while one accepted action applies effects.
    /// It is reconstructed by replay and is never persisted or projected.
    effect_time_anchor: Option<u64>,
}

impl ScenarioSession {
    /// Parses, validates, and starts one scenario session.
    pub fn from_json(encoded: &str, seed: u64) -> Result<Self, ScenarioRuntimeError> {
        let definition = serde_json::from_str(encoded)
            .map_err(|error| ScenarioRuntimeError::InvalidJson(error.to_string()))?;
        Self::new(definition, seed)
    }

    /// Starts one session only after the complete core validation gate passes.
    pub fn new(definition: ScenarioDefinition, seed: u64) -> Result<Self, ScenarioRuntimeError> {
        let report = validate_scenario(&definition);
        if !report.is_valid() {
            let diagnostics = report
                .diagnostics
                .iter()
                .map(|item| format!("{} {}: {}", item.code, item.path, item.message))
                .collect::<Vec<_>>()
                .join("; ");
            return Err(ScenarioRuntimeError::InvalidScenario(diagnostics));
        }

        let fact_statuses = definition
            .facts
            .iter()
            .map(|fact| (fact.id.as_str().to_owned(), fact.initial_status))
            .collect();
        let available_evidence = definition
            .evidence
            .iter()
            .filter(|item| item.initially_available)
            .map(|item| item.id.as_str().to_owned())
            .collect();
        let calendar_baseline = definition
            .initial_clock
            .map(scenario_time_minutes)
            .unwrap_or(0);
        let deadline_statuses = definition
            .deadlines
            .iter()
            .map(|deadline| {
                (
                    deadline.id.as_str().to_owned(),
                    deadline
                        .activation_event
                        .is_none()
                        .then_some(DeadlineStatus::Open),
                )
            })
            .collect();
        // Static authored due times are known independently of activation.
        // Populate those first so a relative deadline never depends on array
        // order when it names a later-declared static anchor.
        let mut deadline_due_minutes = definition
            .deadlines
            .iter()
            .filter(|deadline| deadline.relative_due.is_none())
            .map(|deadline| {
                let due = authored_time_to_elapsed(deadline.due_at, definition.initial_clock)
                    .expect("validated static deadline cannot precede initial_clock");
                (deadline.id.as_str().to_owned(), due)
            })
            .collect::<BTreeMap<_, _>>();
        let initially_active_relative_ids = definition
            .deadlines
            .iter()
            .filter(|deadline| {
                deadline.activation_event.is_none() && deadline.relative_due.is_some()
            })
            .map(|deadline| deadline.id.as_str().to_owned())
            .collect::<Vec<_>>();
        for deadline_id in initially_active_relative_ids {
            resolve_initial_deadline_due(
                &definition,
                &deadline_id,
                calendar_baseline,
                &mut deadline_due_minutes,
                &mut BTreeSet::new(),
            )?;
        }
        let task_statuses = definition
            .async_tasks
            .iter()
            .map(|task| (task.id.as_str().to_owned(), AsyncTaskStatus::NotStarted))
            .collect();
        let visible_inbox = definition
            .inbox_items
            .iter()
            .filter(|item| item.initially_visible || item.created_by_event.is_none())
            .map(|item| item.id.as_str().to_owned())
            .collect();
        let numeric_metrics = definition
            .numeric_metrics
            .iter()
            .map(|(id, value)| (id.as_str().to_owned(), *value))
            .collect();
        let mut resources = definition
            .initial_resources
            .iter()
            .map(|(id, value)| (id.as_str().to_owned(), *value))
            .collect::<BTreeMap<_, _>>();
        if !definition.initial_resources.is_empty() {
            resources.entry(RESOURCE_SPEND_EUR.to_owned()).or_insert(0);
            resources
                .entry(RESOURCE_BILLABLE_MINUTES.to_owned())
                .or_insert(0);
        }

        let mut session = Self {
            seed,
            state: ScenarioRuntimeState {
                stage_id: definition.initial_stage.as_str().to_owned(),
                clock_minutes: 0,
                flags: BTreeMap::new(),
                numeric_metrics,
                resources,
                fact_statuses,
                available_evidence,
                deadline_statuses,
                deadline_due_minutes,
                task_statuses,
                task_due_minutes: BTreeMap::new(),
                visible_inbox,
                resolved_inbox: BTreeSet::new(),
                action_uses: BTreeMap::new(),
                fired_events: BTreeSet::new(),
                decision_resolutions: BTreeMap::new(),
                judicial_result: None,
                judicial_decision_instance: None,
                outcome_id: None,
            },
            definition,
            command_log: Vec::new(),
            dispatch_completion_minutes: Vec::new(),
            effect_time_anchor: None,
        };

        let mut initial_events = VecDeque::new();
        for event in &session.definition.events {
            match &event.trigger {
                EventTrigger::ScenarioStart => {
                    initial_events.push_back(event.id.as_str().to_owned());
                }
                EventTrigger::AtTime { at }
                    if authored_time_to_elapsed(*at, session.definition.initial_clock)
                        == Some(0) =>
                {
                    initial_events.push_back(event.id.as_str().to_owned());
                }
                _ => {}
            }
        }
        session.process_event_queue(initial_events)?;
        // Boundary zero is authoritative even when the scenario has no
        // ScenarioStart or AtTime(0) event to enter the event queue.
        let mut initial_due_events = VecDeque::new();
        session.queue_due_events(&mut initial_due_events);
        session.process_event_queue(initial_due_events)?;
        Ok(session)
    }

    /// Returns the current immutable mobile projection.
    #[must_use]
    pub fn snapshot(&self) -> MobileScenarioSnapshot {
        let stage = self
            .definition
            .stages
            .iter()
            .find(|item| item.id.as_str() == self.state.stage_id)
            .expect("validated current stage must exist");
        let available_actions = self.available_actions();
        let available_action_ids = available_actions
            .iter()
            .map(|action| action.id.clone())
            .collect::<BTreeSet<_>>();

        let facts = self
            .definition
            .facts
            .iter()
            .filter_map(|fact| {
                let status = *self
                    .state
                    .fact_statuses
                    .get(fact.id.as_str())
                    .expect("validated fact state must exist");
                (status != FactStatus::Unknown).then(|| MobileFactSnapshot {
                    id: fact.id.as_str().to_owned(),
                    statement: fact.statement.clone(),
                    status: fact_status_name(status).to_owned(),
                })
            })
            .collect();
        let evidence = self
            .definition
            .evidence
            .iter()
            .filter(|item| self.state.available_evidence.contains(item.id.as_str()))
            .map(|item| MobileEvidenceSnapshot {
                id: item.id.as_str().to_owned(),
                title: item.title.clone(),
                kind: format!("{:?}", item.kind).to_lowercase(),
                available: true,
            })
            .collect();
        let deadlines = self
            .definition
            .deadlines
            .iter()
            .filter_map(|deadline| {
                let status = self
                    .state
                    .deadline_statuses
                    .get(deadline.id.as_str())
                    .copied()
                    .flatten()?;
                let completion_action_ids = if status == DeadlineStatus::Open {
                    deadline
                        .completion_actions
                        .iter()
                        .filter(|action| available_action_ids.contains(action.as_str()))
                        .map(|action| action.as_str().to_owned())
                        .collect()
                } else {
                    Vec::new()
                };
                Some(MobileDeadlineSnapshot {
                    id: deadline.id.as_str().to_owned(),
                    title: deadline.title.clone(),
                    due_at_minutes: self
                        .state
                        .deadline_due_minutes
                        .get(deadline.id.as_str())
                        .copied()
                        .expect("active deadline must have a stored due minute"),
                    status: Some(deadline_status_name(status).to_owned()),
                    completion_action_ids,
                })
            })
            .collect();
        let inbox = self
            .definition
            .inbox_items
            .iter()
            .filter(|item| self.state.visible_inbox.contains(item.id.as_str()))
            .map(|item| MobileInboxSnapshot {
                id: item.id.as_str().to_owned(),
                sender: item.sender.clone(),
                subject: item.subject.clone(),
                body: item.body.clone(),
                visible: true,
                action_required: item.action_required,
                resolved: self.state.resolved_inbox.contains(item.id.as_str()),
                resolution_action_ids: item
                    .resolution_actions
                    .iter()
                    .filter(|action| available_action_ids.contains(action.as_str()))
                    .map(|action| action.as_str().to_owned())
                    .collect(),
            })
            .collect();
        let outcome = self.state.outcome_id.as_ref().map(|outcome_id| {
            let definition = self
                .definition
                .outcomes
                .iter()
                .find(|item| item.id.as_str() == outcome_id)
                .expect("resolved outcome must exist");
            MobileOutcomeSnapshot {
                id: outcome_id.clone(),
                title: definition.title.clone(),
                summary: definition.summary.clone(),
            }
        });
        let matter_lifecycle = MatterLifecycleStatus::from_stage(stage.kind, stage.terminal);
        let is_closed = matter_lifecycle.is_closed();
        let dossier = dossier::project_dossier(
            self,
            stage,
            matter_lifecycle,
            is_closed,
            &available_actions,
            outcome.as_ref(),
        );
        let training_debrief = training_debrief::project_training_debrief(
            self,
            matter_lifecycle,
            dossier.procedure.matter_status,
        );
        let pressure_and_countermove = pressure_countermove::project_pressure_and_countermove(
            self,
            is_closed,
            &available_actions,
        );

        MobileScenarioSnapshot {
            snapshot_schema_version: SNAPSHOT_SCHEMA_VERSION,
            scenario_id: self.definition.metadata.id.as_str().to_owned(),
            seed: self.seed,
            stage_id: self.state.stage_id.clone(),
            stage_title: stage.title.clone(),
            clock_minutes: self.state.clock_minutes,
            clock_mode: clock_mode_name(self.definition.clock.mode).to_owned(),
            judicial_result: self.state.judicial_result,
            judicial_decision_instance: self.state.judicial_decision_instance,
            matter_lifecycle,
            is_closed,
            resolved_outcome: self.state.outcome_id.clone(),
            terminal: is_closed,
            dossier,
            pressure_and_countermove,
            training_debrief,
            // Preserve the version-1 response shape without exposing internal
            // diagnostic identifiers through the player projection.
            flags: BTreeMap::new(),
            numeric_metrics: (!self.definition.numeric_metrics.is_empty())
                .then(|| self.state.numeric_metrics.clone()),
            resources: (!self.definition.initial_resources.is_empty())
                .then(|| self.state.resources.clone()),
            facts,
            evidence,
            deadlines,
            inbox,
            available_actions,
            fired_event_ids: Vec::new(),
            outcome,
        }
    }

    /// Rust-only diagnostic access for parity and authoring tests.
    ///
    /// Internal flags are deliberately excluded from the player snapshot and
    /// are never serialized by the mobile bridge.
    #[doc(hidden)]
    #[must_use]
    pub fn diagnostic_flags(&self) -> &BTreeMap<String, bool> {
        &self.state.flags
    }

    /// Rust-only fired-event access for parity and authoring tests.
    ///
    /// Event identifiers are runtime diagnostics, not player-visible content.
    #[doc(hidden)]
    #[must_use]
    pub fn diagnostic_fired_event_ids(&self) -> &BTreeSet<String> {
        &self.state.fired_events
    }

    /// Rust-only visible-Inbox access for projection-contract tests.
    ///
    /// The bridge receives only the definition-ordered player projection.
    #[doc(hidden)]
    #[must_use]
    pub fn diagnostic_visible_inbox_ids(&self) -> &BTreeSet<String> {
        &self.state.visible_inbox
    }

    /// Applies one stable action ID and returns the resulting snapshot.
    pub fn dispatch(
        &mut self,
        action_id: &str,
    ) -> Result<MobileScenarioSnapshot, ScenarioRuntimeError> {
        let mut candidate = self.clone();
        candidate.command_log.push(ScenarioCommand::Dispatch {
            action_id: action_id.to_owned(),
        });
        let snapshot = candidate.dispatch_unlogged(action_id)?;
        *self = candidate;
        Ok(snapshot)
    }

    fn dispatch_unlogged(
        &mut self,
        action_id: &str,
    ) -> Result<MobileScenarioSnapshot, ScenarioRuntimeError> {
        if self.is_closed() {
            return Err(ScenarioRuntimeError::ScenarioResolved);
        }

        let action = self
            .definition
            .actions
            .iter()
            .find(|item| item.id.as_str() == action_id)
            .cloned()
            .filter(|item| self.action_is_basically_available(item))
            .ok_or_else(|| ScenarioRuntimeError::ActionUnavailable(action_id.to_owned()))?;

        let (completion_target, selected_advance_deadline) =
            self.action_completion_target(&action)?;
        self.ensure_action_finishes_by_deadline(
            &action,
            completion_target,
            selected_advance_deadline.as_deref(),
        )?;
        self.precomplete_action_deadlines(&action);

        // Effects remain pre-clock for existing scenarios. Calendar-sensitive
        // effects use the accepted completion target as their causal anchor.
        self.effect_time_anchor = Some(completion_target);
        let effects_result = self.apply_effects(&action.effects);
        self.effect_time_anchor = None;
        effects_result?;
        if !self.definition.initial_resources.is_empty() {
            self.add_resource(RESOURCE_SPEND_EUR, i64::from(action.cost_eur))?;
            self.add_resource(
                RESOURCE_BILLABLE_MINUTES,
                i64::from(action.billable_minutes),
            )?;
        }
        *self
            .state
            .action_uses
            .entry(action_id.to_owned())
            .or_default() += 1;
        let mut events = VecDeque::new();
        for event in &self.definition.events {
            if matches!(
                &event.trigger,
                EventTrigger::AfterAction { action }
                    if action.as_str() == action_id
            ) {
                events.push_back(event.id.as_str().to_owned());
            }
        }
        self.advance_clock_to_with_deadline_completion(
            completion_target,
            events,
            false,
            selected_advance_deadline.as_deref(),
        )?;

        self.dispatch_completion_minutes
            .push(self.state.clock_minutes);

        Ok(self.snapshot())
    }

    /// Advances an eligible foreground scenario by deterministic simulated
    /// minutes and returns the resulting authoritative snapshot.
    pub fn advance_time(
        &mut self,
        minutes: u32,
    ) -> Result<MobileScenarioSnapshot, ScenarioRuntimeError> {
        let mut candidate = self.clone();
        candidate
            .command_log
            .push(ScenarioCommand::AdvanceTime { minutes });
        let snapshot = candidate.advance_time_unlogged(minutes)?;
        *self = candidate;
        Ok(snapshot)
    }

    fn advance_time_unlogged(
        &mut self,
        minutes: u32,
    ) -> Result<MobileScenarioSnapshot, ScenarioRuntimeError> {
        if self.is_closed() {
            return Err(ScenarioRuntimeError::ScenarioResolved);
        }
        if self.definition.clock.mode != ScenarioClockMode::Foreground {
            return Err(ScenarioRuntimeError::ClockAdvanceUnsupported);
        }
        if minutes == 0 {
            return Err(ScenarioRuntimeError::InvalidClockAdvance);
        }
        if minutes > MAX_FOREGROUND_ADVANCE_MINUTES {
            return Err(ScenarioRuntimeError::ClockAdvanceLimitExceeded {
                requested: minutes,
                maximum: MAX_FOREGROUND_ADVANCE_MINUTES,
            });
        }

        self.advance_clock_by(minutes, VecDeque::new(), true)?;
        Ok(self.snapshot())
    }

    /// Shared deterministic boundary processor used by action costs and
    /// explicit foreground-time commands.
    ///
    /// At each minute boundary, due consequences are queued in definition
    /// order with this category priority: AtTime events, async completions,
    /// then deadline misses.
    fn advance_clock_by(
        &mut self,
        minutes: u32,
        final_events: VecDeque<String>,
        apply_foreground_metric_rates: bool,
    ) -> Result<(), ScenarioRuntimeError> {
        let target = self
            .state
            .clock_minutes
            .checked_add(u64::from(minutes))
            .ok_or(ScenarioRuntimeError::ClockOverflow)?;
        self.advance_clock_to(target, final_events, apply_foreground_metric_rates)
    }

    fn advance_clock_to(
        &mut self,
        target: u64,
        final_events: VecDeque<String>,
        apply_foreground_metric_rates: bool,
    ) -> Result<(), ScenarioRuntimeError> {
        self.advance_clock_to_with_deadline_completion(
            target,
            final_events,
            apply_foreground_metric_rates,
            None,
        )
    }

    fn advance_clock_to_with_deadline_completion(
        &mut self,
        target: u64,
        final_events: VecDeque<String>,
        apply_foreground_metric_rates: bool,
        completion_deadline: Option<&str>,
    ) -> Result<(), ScenarioRuntimeError> {
        if target < self.state.clock_minutes {
            return Err(ScenarioRuntimeError::ClockOverflow);
        }

        // An action may resolve the scenario in its effects. Its declared time
        // cost still belongs to that action, but no later temporal event fires.
        if self.is_closed() {
            self.state.clock_minutes = target;
            return Ok(());
        }

        while let Some(boundary) =
            self.next_temporal_boundary_before(target, apply_foreground_metric_rates)
        {
            let previous_metrics = self.state.numeric_metrics.clone();
            let elapsed = boundary - self.state.clock_minutes;
            if apply_foreground_metric_rates {
                self.increment_foreground_metrics(elapsed)?;
            }
            self.state.clock_minutes = boundary;
            let mut due_events = VecDeque::new();
            self.queue_due_events(&mut due_events);
            self.process_event_queue(due_events)?;
            if self.is_closed() {
                return Ok(());
            }
            if apply_foreground_metric_rates {
                let mut metric_events = VecDeque::new();
                self.queue_crossed_metric_events(&previous_metrics, &mut metric_events);
                self.process_event_queue(metric_events)?;
                if self.is_closed() {
                    return Ok(());
                }
            }
        }

        let previous_metrics = self.state.numeric_metrics.clone();
        let elapsed = target - self.state.clock_minutes;
        if apply_foreground_metric_rates {
            self.increment_foreground_metrics(elapsed)?;
        }
        self.state.clock_minutes = target;
        if let Some(deadline_id) = completion_deadline {
            if self
                .state
                .deadline_statuses
                .get(deadline_id)
                .copied()
                .flatten()
                == Some(DeadlineStatus::Open)
            {
                self.state
                    .deadline_statuses
                    .insert(deadline_id.to_owned(), Some(DeadlineStatus::Completed));
            }
        }
        let mut events = final_events;
        self.queue_due_events(&mut events);
        self.process_event_queue(events)?;
        if self.is_closed() || !apply_foreground_metric_rates {
            return Ok(());
        }
        let mut metric_events = VecDeque::new();
        self.queue_crossed_metric_events(&previous_metrics, &mut metric_events);
        self.process_event_queue(metric_events)
    }

    fn next_temporal_boundary_before(
        &self,
        target: u64,
        include_foreground_metric_thresholds: bool,
    ) -> Option<u64> {
        let current = self.state.clock_minutes;
        let at_time = self.definition.events.iter().filter_map(|event| {
            if self.state.fired_events.contains(event.id.as_str()) {
                return None;
            }
            match event.trigger {
                EventTrigger::AtTime { at } => {
                    authored_time_to_elapsed(at, self.definition.initial_clock)
                }
                _ => None,
            }
        });
        let async_tasks = self
            .state
            .task_due_minutes
            .iter()
            .filter(|(task_id, _)| {
                self.state.task_statuses.get(*task_id) == Some(&AsyncTaskStatus::InProgress)
            })
            .map(|(_, due)| *due);
        let deadlines = self
            .definition
            .deadlines
            .iter()
            .filter(|deadline| {
                self.state
                    .deadline_statuses
                    .get(deadline.id.as_str())
                    .copied()
                    .flatten()
                    == Some(DeadlineStatus::Open)
            })
            .filter_map(|deadline| {
                self.state
                    .deadline_due_minutes
                    .get(deadline.id.as_str())
                    .copied()
                    .map(|due| deadline_miss_boundary(deadline, due))
            });
        let metric_thresholds = self.definition.events.iter().filter_map(|event| {
            if !include_foreground_metric_thresholds
                || (self.state.fired_events.contains(event.id.as_str()) && !event.repeatable)
            {
                return None;
            }
            let EventTrigger::MetricThresholdReached { metric, threshold } = &event.trigger else {
                return None;
            };
            let rate = self
                .definition
                .foreground_metric_rates
                .get(metric)
                .copied()?;
            let current_value = self.state.numeric_metrics.get(metric.as_str()).copied()?;
            if rate <= 0 || current_value >= *threshold {
                return None;
            }
            let distance = threshold.checked_sub(current_value)?;
            let steps = distance.checked_sub(1)?.checked_div(rate)?.checked_add(1)?;
            let steps = u64::try_from(steps).ok()?;
            current.checked_add(steps)
        });

        at_time
            .chain(async_tasks)
            .chain(deadlines)
            .chain(metric_thresholds)
            .filter(|boundary| *boundary > current && *boundary < target)
            .min()
    }

    fn increment_foreground_metrics(
        &mut self,
        elapsed_minutes: u64,
    ) -> Result<(), ScenarioRuntimeError> {
        let elapsed =
            i64::try_from(elapsed_minutes).map_err(|_| ScenarioRuntimeError::ClockOverflow)?;
        let increments = self
            .definition
            .foreground_metric_rates
            .iter()
            .map(|(metric, rate)| {
                rate.checked_mul(elapsed)
                    .map(|amount| (metric.as_str().to_owned(), amount))
                    .ok_or_else(|| {
                        ScenarioRuntimeError::IntegerOverflow(metric.as_str().to_owned())
                    })
            })
            .collect::<Result<Vec<_>, _>>()?;
        for (metric, amount) in increments {
            self.add_metric(&metric, amount)?;
        }
        Ok(())
    }

    fn queue_crossed_metric_events(
        &self,
        previous_metrics: &BTreeMap<String, i64>,
        events: &mut VecDeque<String>,
    ) {
        for event in &self.definition.events {
            if self.state.fired_events.contains(event.id.as_str()) && !event.repeatable {
                continue;
            }
            let EventTrigger::MetricThresholdReached { metric, threshold } = &event.trigger else {
                continue;
            };
            let previous = previous_metrics.get(metric.as_str()).copied();
            let current = self.state.numeric_metrics.get(metric.as_str()).copied();
            if previous
                .zip(current)
                .is_some_and(|(previous, current)| previous < *threshold && current >= *threshold)
            {
                events.push_back(event.id.as_str().to_owned());
            }
        }
    }

    fn available_actions(&self) -> Vec<MobileActionSnapshot> {
        if self.is_closed() {
            return Vec::new();
        }

        self.definition
            .actions
            .iter()
            .filter(|action| self.action_is_available(action))
            .map(|action| {
                let completion_at_minutes = (!action.advance_to_deadlines.is_empty()
                    || action.completion_timing.is_some())
                .then(|| {
                    self.action_completion_target(action)
                        .expect("available action must have a completion target")
                        .0
                });
                MobileActionSnapshot {
                    id: action.id.as_str().to_owned(),
                    title: action.title.clone(),
                    description: action.description.clone(),
                    presentation_tags: action.presentation_tags.clone(),
                    time_cost_minutes: action.time_cost_minutes,
                    cost_eur: action.cost_eur,
                    billable_minutes: action.billable_minutes,
                    completion_at_minutes,
                }
            })
            .collect()
    }

    fn action_is_available(&self, action: &ActionDefinition) -> bool {
        if !self.action_is_basically_available(action) {
            return false;
        }
        let Ok((completion_target, selected_advance)) = self.action_completion_target(action)
        else {
            return false;
        };
        self.ensure_action_finishes_by_deadline(
            action,
            completion_target,
            selected_advance.as_deref(),
        )
        .is_ok()
    }

    fn action_is_basically_available(&self, action: &ActionDefinition) -> bool {
        let Some(stage) = self
            .definition
            .stages
            .iter()
            .find(|item| item.id.as_str() == self.state.stage_id)
        else {
            return false;
        };
        if !stage
            .exit_actions
            .iter()
            .any(|candidate| candidate == &action.id)
        {
            return false;
        }

        let uses = self
            .state
            .action_uses
            .get(action.id.as_str())
            .copied()
            .unwrap_or(0);
        let repeatable = match action.repeatability {
            ActionRepeatability::Once => uses == 0,
            ActionRepeatability::Unlimited => true,
            ActionRepeatability::Limited { max_uses } => uses < max_uses,
        };

        repeatable && self.evaluate_condition(&action.available_when)
    }

    fn action_completion_target(
        &self,
        action: &ActionDefinition,
    ) -> Result<(u64, Option<String>), ScenarioRuntimeError> {
        let mut target = self
            .state
            .clock_minutes
            .checked_add(u64::from(action.time_cost_minutes))
            .ok_or(ScenarioRuntimeError::ClockOverflow)?;
        if let Some(timing) = &action.completion_timing {
            target = target.max(self.resolve_timing_at(timing, self.state.clock_minutes)?);
        }
        let selected_advance = if action.advance_to_deadlines.is_empty() {
            None
        } else {
            let (deadline, due) = self
                .select_open_deadline(&action.advance_to_deadlines)
                .ok_or_else(|| {
                    ScenarioRuntimeError::DeadlineInactive(
                        action.advance_to_deadlines[0].as_str().to_owned(),
                    )
                })?;
            target = target.max(due);
            Some(deadline)
        };
        Ok((target, selected_advance))
    }

    fn ensure_action_finishes_by_deadline(
        &self,
        action: &ActionDefinition,
        completion: u64,
        selected_advance_deadline: Option<&str>,
    ) -> Result<(), ScenarioRuntimeError> {
        if let Some(deadline_id) = selected_advance_deadline {
            let deadline = self
                .definition
                .deadlines
                .iter()
                .find(|deadline| deadline.id.as_str() == deadline_id)
                .expect("selected advance deadline must exist");
            if deadline
                .completion_actions
                .iter()
                .any(|candidate| candidate == &action.id)
            {
                let due = *self
                    .state
                    .deadline_due_minutes
                    .get(deadline_id)
                    .expect("open deadline must have a stored due minute");
                self.ensure_completion_is_timely(action, deadline, completion, due)?;
            }
        }
        if !action.completion_deadlines.is_empty() {
            let (deadline_id, due) = self
                .select_open_deadline(&action.completion_deadlines)
                .ok_or_else(|| {
                    ScenarioRuntimeError::DeadlineInactive(
                        action.completion_deadlines[0].as_str().to_owned(),
                    )
                })?;
            let adjusted_due = add_signed_minutes(due, action.completion_deadline_offset_minutes)
                .ok_or(ScenarioRuntimeError::ClockOverflow)?;
            let definition = self
                .definition
                .deadlines
                .iter()
                .find(|deadline| deadline.id.as_str() == deadline_id)
                .expect("validated completion deadline must exist");
            self.ensure_completion_is_timely(action, definition, completion, adjusted_due)?;
        }
        Ok(())
    }

    fn ensure_completion_is_timely(
        &self,
        action: &ActionDefinition,
        deadline: &juris_scenario_schema::DeadlineDefinition,
        completion: u64,
        due: u64,
    ) -> Result<(), ScenarioRuntimeError> {
        let late = if deadline.completion_at_due_allowed {
            completion > due
        } else {
            completion >= due
        };
        if late {
            return Err(ScenarioRuntimeError::ActionCompletionDeadlineExceeded {
                action: action.id.as_str().to_owned(),
                deadline: deadline.id.as_str().to_owned(),
                completion,
                due,
            });
        }
        Ok(())
    }

    fn select_open_deadline(
        &self,
        ids: &[juris_scenario_schema::DeadlineId],
    ) -> Option<(String, u64)> {
        ids.iter()
            .filter_map(|id| {
                (self
                    .state
                    .deadline_statuses
                    .get(id.as_str())
                    .copied()
                    .flatten()
                    == Some(DeadlineStatus::Open))
                .then(|| {
                    self.state
                        .deadline_due_minutes
                        .get(id.as_str())
                        .copied()
                        .map(|due| (id.as_str().to_owned(), due))
                })
                .flatten()
            })
            .min_by(|(left_id, left_due), (right_id, right_due)| {
                left_due.cmp(right_due).then_with(|| left_id.cmp(right_id))
            })
    }

    fn precomplete_action_deadlines(&mut self, action: &ActionDefinition) {
        let deadline_ids = self
            .definition
            .deadlines
            .iter()
            .filter(|deadline| {
                self.state
                    .deadline_statuses
                    .get(deadline.id.as_str())
                    .copied()
                    .flatten()
                    == Some(DeadlineStatus::Open)
                    && deadline
                        .completion_actions
                        .iter()
                        .any(|candidate| candidate == &action.id)
                    && action.advance_to_deadlines.is_empty()
            })
            .map(|deadline| deadline.id.as_str().to_owned())
            .collect::<Vec<_>>();
        for deadline_id in deadline_ids {
            self.state
                .deadline_statuses
                .insert(deadline_id, Some(DeadlineStatus::Completed));
        }
    }

    fn resolve_timing_at(
        &self,
        timing: &RelativeTimeDefinition,
        default_anchor: u64,
    ) -> Result<u64, ScenarioRuntimeError> {
        let anchor = match &timing.relative_to_deadline {
            Some(deadline) => self
                .state
                .deadline_due_minutes
                .get(deadline.as_str())
                .copied()
                .ok_or_else(|| {
                    ScenarioRuntimeError::DeadlineInactive(deadline.as_str().to_owned())
                })?,
            None => default_anchor,
        };
        resolve_forward_time(
            self.state.clock_minutes,
            timing,
            anchor,
            self.calendar_baseline(),
        )
    }

    fn calendar_baseline(&self) -> u64 {
        self.definition
            .initial_clock
            .map(scenario_time_minutes)
            .unwrap_or(0)
    }

    fn is_closed(&self) -> bool {
        self.definition
            .stages
            .iter()
            .find(|item| item.id.as_str() == self.state.stage_id)
            .is_some_and(|stage| {
                MatterLifecycleStatus::from_stage(stage.kind, stage.terminal).is_closed()
            })
    }

    fn evaluate_condition(&self, condition: &Condition) -> bool {
        match condition {
            Condition::Always => true,
            Condition::StageIs { stage } => stage.as_str() == self.state.stage_id,
            Condition::FlagEquals { flag, value } => {
                self.state
                    .flags
                    .get(flag.as_str())
                    .copied()
                    .unwrap_or(false)
                    == *value
            }
            Condition::FactStatusIs { fact, status } => {
                self.state.fact_statuses.get(fact.as_str()) == Some(status)
            }
            Condition::EvidenceAvailable { evidence } => {
                self.state.available_evidence.contains(evidence.as_str())
            }
            Condition::DeadlineStatusIs { deadline, status } => {
                self.state
                    .deadline_statuses
                    .get(deadline.as_str())
                    .copied()
                    .flatten()
                    == Some(*status)
            }
            Condition::AsyncTaskStatusIs { task, status } => {
                self.state.task_statuses.get(task.as_str()) == Some(status)
            }
            Condition::InboxItemResolved { item } => {
                self.state.resolved_inbox.contains(item.as_str())
            }
            Condition::JudicialResultIs { result } => self.state.judicial_result == Some(*result),
            Condition::IntegerCompare {
                left,
                operator,
                right,
            } => self
                .integer_operand_value(left)
                .zip(self.integer_operand_value(right))
                .is_some_and(|(left, right)| compare_integers(left, *operator, right)),
            Condition::All { conditions } => {
                conditions.iter().all(|item| self.evaluate_condition(item))
            }
            Condition::Any { conditions } => {
                conditions.iter().any(|item| self.evaluate_condition(item))
            }
            Condition::Not { condition } => !self.evaluate_condition(condition),
        }
    }

    fn integer_operand_value(&self, operand: &IntegerOperand) -> Option<i64> {
        match operand {
            IntegerOperand::Constant { value } => Some(*value),
            IntegerOperand::Metric { metric, offset } => self
                .state
                .numeric_metrics
                .get(metric.as_str())
                .copied()?
                .checked_add(*offset),
            IntegerOperand::Resource { resource, offset } => self
                .state
                .resources
                .get(resource.as_str())
                .copied()?
                .checked_add(*offset),
        }
    }

    fn apply_effects(&mut self, effects: &[Effect]) -> Result<(), ScenarioRuntimeError> {
        self.apply_effects_with_context(effects, &mut EventProcessingContext::default())
    }

    fn apply_effects_with_context(
        &mut self,
        effects: &[Effect],
        context: &mut EventProcessingContext,
    ) -> Result<(), ScenarioRuntimeError> {
        let mut events = VecDeque::new();
        for effect in effects {
            match effect {
                Effect::SetStage { stage } => {
                    self.state.stage_id = stage.as_str().to_owned();
                }
                Effect::SetFlag { flag, value } => {
                    self.state.flags.insert(flag.as_str().to_owned(), *value);
                }
                Effect::SetMetric { metric, value } => {
                    self.set_metric(metric.as_str(), *value)?;
                }
                Effect::AddMetric { metric, amount } => {
                    self.add_metric(metric.as_str(), *amount)?;
                }
                Effect::SubtractMetric { metric, amount } => {
                    let delta = amount.checked_neg().ok_or_else(|| {
                        ScenarioRuntimeError::IntegerOverflow(metric.as_str().to_owned())
                    })?;
                    self.add_metric(metric.as_str(), delta)?;
                }
                Effect::ClampMetric {
                    metric,
                    minimum,
                    maximum,
                } => {
                    let value = self
                        .state
                        .numeric_metrics
                        .get(metric.as_str())
                        .copied()
                        .ok_or_else(|| {
                            ScenarioRuntimeError::UnknownIntegerState(metric.as_str().to_owned())
                        })?;
                    let value = minimum.map_or(value, |minimum| value.max(minimum));
                    let value = maximum.map_or(value, |maximum| value.min(maximum));
                    self.set_metric(metric.as_str(), value)?;
                }
                Effect::SetResource { resource, value } => {
                    self.set_resource(resource.as_str(), *value)?;
                }
                Effect::AddResource { resource, amount } => {
                    self.add_resource(resource.as_str(), *amount)?;
                }
                Effect::SubtractResource { resource, amount } => {
                    let delta = amount.checked_neg().ok_or_else(|| {
                        ScenarioRuntimeError::IntegerOverflow(resource.as_str().to_owned())
                    })?;
                    self.add_resource(resource.as_str(), delta)?;
                }
                Effect::SetFactStatus { fact, status } => {
                    self.state
                        .fact_statuses
                        .insert(fact.as_str().to_owned(), *status);
                }
                Effect::MakeEvidenceAvailable { evidence } => {
                    self.state
                        .available_evidence
                        .insert(evidence.as_str().to_owned());
                }
                Effect::StartAsyncTask { task } => {
                    self.state
                        .task_statuses
                        .insert(task.as_str().to_owned(), AsyncTaskStatus::InProgress);
                    if let Some(definition) = self
                        .definition
                        .async_tasks
                        .iter()
                        .find(|item| item.id == *task)
                        .cloned()
                    {
                        let due = if let Some(timing) = &definition.completion_timing {
                            let anchor =
                                self.effect_time_anchor.unwrap_or(self.state.clock_minutes);
                            anchor
                                .checked_add(u64::from(definition.duration_minutes))
                                .ok_or(ScenarioRuntimeError::ClockOverflow)?
                                .max(self.resolve_timing_at(timing, anchor)?)
                        } else {
                            // Preserve schema-v1 behavior exactly: without an
                            // explicit timing extension, asynchronous duration
                            // starts at the pre-clock effect minute.
                            self.state
                                .clock_minutes
                                .checked_add(u64::from(definition.duration_minutes))
                                .ok_or(ScenarioRuntimeError::ClockOverflow)?
                        };
                        self.state
                            .task_due_minutes
                            .insert(task.as_str().to_owned(), due);
                    }
                }
                Effect::MarkAsyncTaskReady { task } => {
                    self.state
                        .task_statuses
                        .insert(task.as_str().to_owned(), AsyncTaskStatus::Ready);
                    self.state.task_due_minutes.remove(task.as_str());
                }
                Effect::ReviewAsyncTask { task } => {
                    self.state
                        .task_statuses
                        .insert(task.as_str().to_owned(), AsyncTaskStatus::Reviewed);
                    self.state.task_due_minutes.remove(task.as_str());
                }
                Effect::ExpireAsyncTask { task } => {
                    self.state
                        .task_statuses
                        .insert(task.as_str().to_owned(), AsyncTaskStatus::Expired);
                    self.state.task_due_minutes.remove(task.as_str());
                }
                Effect::CompleteDeadline { deadline } => {
                    self.state.deadline_statuses.insert(
                        deadline.as_str().to_owned(),
                        Some(DeadlineStatus::Completed),
                    );
                }
                Effect::MissDeadline { deadline } => {
                    self.state
                        .deadline_statuses
                        .insert(deadline.as_str().to_owned(), Some(DeadlineStatus::Missed));
                }
                Effect::CreateInboxItem { item } => {
                    self.state.visible_inbox.insert(item.as_str().to_owned());
                    self.state.resolved_inbox.remove(item.as_str());
                }
                Effect::ResolveInboxItem { item } => {
                    self.state.resolved_inbox.insert(item.as_str().to_owned());
                }
                Effect::SetJudicialResult { result } => {
                    let current_stage = self
                        .definition
                        .stages
                        .iter()
                        .find(|stage| stage.id.as_str() == self.state.stage_id)
                        .expect("validated current stage must exist");
                    self.state.judicial_result = Some(*result);
                    self.state.judicial_decision_instance =
                        Some(JudicialDecisionInstance::from_stage(
                            current_stage.kind,
                            self.state.judicial_decision_instance,
                        ));
                }
                Effect::ResolveDeterministicDecision { decision } => {
                    self.resolve_deterministic_decision(decision.as_str(), context)?;
                }
                Effect::TriggerEvent { event } => {
                    events.push_back(event.as_str().to_owned());
                }
                Effect::ResolveOutcome { outcome } => {
                    self.resolve_outcome(outcome.as_str())?;
                }
            }
        }
        self.process_event_queue_with_context(events, context)
    }

    fn set_metric(&mut self, id: &str, value: i64) -> Result<(), ScenarioRuntimeError> {
        let metric = self
            .state
            .numeric_metrics
            .get_mut(id)
            .ok_or_else(|| ScenarioRuntimeError::UnknownIntegerState(id.to_owned()))?;
        *metric = value;
        Ok(())
    }

    fn add_metric(&mut self, id: &str, amount: i64) -> Result<(), ScenarioRuntimeError> {
        let metric = self
            .state
            .numeric_metrics
            .get_mut(id)
            .ok_or_else(|| ScenarioRuntimeError::UnknownIntegerState(id.to_owned()))?;
        *metric = metric
            .checked_add(amount)
            .ok_or_else(|| ScenarioRuntimeError::IntegerOverflow(id.to_owned()))?;
        Ok(())
    }

    fn set_resource(&mut self, id: &str, value: i64) -> Result<(), ScenarioRuntimeError> {
        let resource = self
            .state
            .resources
            .get_mut(id)
            .ok_or_else(|| ScenarioRuntimeError::UnknownIntegerState(id.to_owned()))?;
        *resource = value;
        Ok(())
    }

    fn add_resource(&mut self, id: &str, amount: i64) -> Result<(), ScenarioRuntimeError> {
        let resource = self
            .state
            .resources
            .get_mut(id)
            .ok_or_else(|| ScenarioRuntimeError::UnknownIntegerState(id.to_owned()))?;
        *resource = resource
            .checked_add(amount)
            .ok_or_else(|| ScenarioRuntimeError::IntegerOverflow(id.to_owned()))?;
        Ok(())
    }

    fn resolve_deterministic_decision(
        &mut self,
        id: &str,
        context: &mut EventProcessingContext,
    ) -> Result<(), ScenarioRuntimeError> {
        let decision = self
            .definition
            .deterministic_decisions
            .iter()
            .find(|decision| decision.id.as_str() == id)
            .cloned()
            .ok_or_else(|| ScenarioRuntimeError::UnknownDecision(id.to_owned()))?;
        if decision.roll_range == 0 {
            return Err(ScenarioRuntimeError::NoEligibleDecisionBranch(
                id.to_owned(),
            ));
        }

        let occurrence = self
            .state
            .decision_resolutions
            .get(id)
            .map_or(0_u64, |items| items.len() as u64);
        let fingerprint = self.scenario_fingerprint().map_err(|error| {
            ScenarioRuntimeError::DecisionResolution(id.to_owned(), error.to_string())
        })?;
        let mut hash = Sha256::new();
        hash.update(self.seed.to_be_bytes());
        hash.update((fingerprint.len() as u64).to_be_bytes());
        hash.update(fingerprint.as_bytes());
        hash.update((id.len() as u64).to_be_bytes());
        hash.update(id.as_bytes());
        hash.update(occurrence.to_be_bytes());
        let digest = hash.finalize();
        let raw = u64::from_be_bytes(
            digest[..8]
                .try_into()
                .expect("SHA-256 prefix always contains eight bytes"),
        ) % u64::from(decision.roll_range);
        let roll = i64::try_from(raw)
            .ok()
            .and_then(|raw| raw.checked_add(decision.roll_offset))
            .ok_or_else(|| ScenarioRuntimeError::IntegerOverflow(id.to_owned()))?;
        let mut score_sum = match &decision.score_metric {
            Some(metric) => self
                .state
                .numeric_metrics
                .get(metric.as_str())
                .copied()
                .ok_or_else(|| {
                    ScenarioRuntimeError::UnknownIntegerState(metric.as_str().to_owned())
                })?,
            None => 0,
        };
        for term in &decision.score_terms {
            if !self.evaluate_condition(&term.condition) {
                continue;
            }
            let value = self.integer_operand_value(&term.operand).ok_or_else(|| {
                ScenarioRuntimeError::DecisionResolution(
                    id.to_owned(),
                    "score term references missing or overflowing integer state".to_owned(),
                )
            })?;
            let value = term.minimum.map_or(value, |minimum| value.max(minimum));
            let value = term.maximum.map_or(value, |maximum| value.min(maximum));
            let contribution = value
                .checked_mul(term.multiplier)
                .ok_or_else(|| ScenarioRuntimeError::IntegerOverflow(id.to_owned()))?;
            score_sum = score_sum
                .checked_add(contribution)
                .ok_or_else(|| ScenarioRuntimeError::IntegerOverflow(id.to_owned()))?;
        }
        if decision.score_divisor <= 0 {
            return Err(ScenarioRuntimeError::DecisionResolution(
                id.to_owned(),
                "score divisor must be positive".to_owned(),
            ));
        }
        let score = score_sum
            .checked_add(decision.score_offset)
            .and_then(|score| score.checked_div(decision.score_divisor))
            .ok_or_else(|| ScenarioRuntimeError::IntegerOverflow(id.to_owned()))?;
        let total = roll
            .checked_mul(decision.roll_multiplier)
            .and_then(|roll| roll.checked_add(score))
            .ok_or_else(|| ScenarioRuntimeError::IntegerOverflow(id.to_owned()))?;
        let branch = decision
            .branches
            .iter()
            .find(|branch| {
                self.evaluate_condition(&branch.condition)
                    && branch.minimum_roll.map_or(true, |minimum| roll >= minimum)
                    && branch.maximum_roll.map_or(true, |maximum| roll <= maximum)
                    && branch
                        .minimum_total
                        .map_or(true, |minimum| total >= minimum)
                    && branch
                        .maximum_total
                        .map_or(true, |maximum| total <= maximum)
            })
            .cloned()
            .ok_or_else(|| ScenarioRuntimeError::NoEligibleDecisionBranch(id.to_owned()))?;

        self.state
            .decision_resolutions
            .entry(id.to_owned())
            .or_default()
            .push(branch.id.as_str().to_owned());
        self.apply_effects_with_context(&branch.effects, context)
    }

    fn resolve_outcome(&mut self, outcome_id: &str) -> Result<(), ScenarioRuntimeError> {
        if let Some(existing) = self.state.outcome_id.as_ref() {
            if existing == outcome_id {
                return Ok(());
            }
            return Err(ScenarioRuntimeError::ConflictingOutcome {
                existing: existing.clone(),
                new_outcome: outcome_id.to_owned(),
            });
        }

        let outcome = self
            .definition
            .outcomes
            .iter()
            .find(|item| item.id.as_str() == outcome_id)
            .cloned()
            .ok_or_else(|| ScenarioRuntimeError::UnknownOutcome(outcome_id.to_owned()))?;
        if outcome.terminal_stage.as_str() != self.state.stage_id {
            return Err(ScenarioRuntimeError::OutcomeStageMismatch {
                outcome: outcome_id.to_owned(),
                expected: outcome.terminal_stage.as_str().to_owned(),
                actual: self.state.stage_id.clone(),
            });
        }
        if !self.evaluate_condition(&outcome.condition) {
            return Err(ScenarioRuntimeError::OutcomeConditionFalse(
                outcome_id.to_owned(),
            ));
        }
        self.state.outcome_id = Some(outcome_id.to_owned());
        Ok(())
    }

    fn process_event_queue(
        &mut self,
        events: VecDeque<String>,
    ) -> Result<(), ScenarioRuntimeError> {
        self.process_event_queue_with_context(events, &mut EventProcessingContext::default())
    }

    fn process_event_queue_with_context(
        &mut self,
        mut events: VecDeque<String>,
        context: &mut EventProcessingContext,
    ) -> Result<(), ScenarioRuntimeError> {
        while let Some(event_id) = events.pop_front() {
            let event = self
                .definition
                .events
                .iter()
                .find(|item| item.id.as_str() == event_id)
                .cloned()
                .ok_or_else(|| ScenarioRuntimeError::UnknownEvent(event_id.clone()))?;
            if event.repeatable {
                if !context.repeatable_ids.insert(event_id.clone()) {
                    continue;
                }
            } else if self.state.fired_events.contains(&event_id) {
                continue;
            }
            context.processed += 1;
            if context.processed > MAX_EVENTS_PER_COMMAND {
                return Err(ScenarioRuntimeError::EventLimitExceeded(
                    MAX_EVENTS_PER_COMMAND,
                ));
            }
            if !self.evaluate_condition(&event.condition) {
                continue;
            }

            if !event.repeatable {
                self.state.fired_events.insert(event_id.clone());
            }
            let mut event_owned = self.activate_event_owned_state(&event)?;
            self.apply_effects_with_context(&event.effects, context)?;
            events.append(&mut event_owned);

            for dependent in &self.definition.events {
                if matches!(
                    &dependent.trigger,
                    EventTrigger::AfterEvent { event }
                        if event.as_str() == event_id
                ) {
                    events.push_back(dependent.id.as_str().to_owned());
                }
            }
            self.queue_due_events(&mut events);
        }
        Ok(())
    }

    fn activate_event_owned_state(
        &mut self,
        event: &EventDefinition,
    ) -> Result<VecDeque<String>, ScenarioRuntimeError> {
        let mut events = VecDeque::new();
        let activated_deadlines = self
            .definition
            .deadlines
            .iter()
            .filter(|deadline| deadline.activation_event.as_ref() == Some(&event.id))
            .map(|deadline| deadline.id.as_str().to_owned())
            .collect::<Vec<_>>();
        for deadline_id in activated_deadlines {
            self.activate_deadline(&deadline_id)?;
        }
        for item in &self.definition.inbox_items {
            if item.created_by_event.as_ref() == Some(&event.id) {
                self.state.visible_inbox.insert(item.id.as_str().to_owned());
            }
            if item.expiry_event.as_ref() == Some(&event.id) {
                self.state
                    .resolved_inbox
                    .insert(item.id.as_str().to_owned());
            }
        }
        for task in &self.definition.async_tasks {
            if task.usable_until_event.as_ref() != Some(&event.id) {
                continue;
            }
            let status = self
                .state
                .task_statuses
                .get(task.id.as_str())
                .copied()
                .unwrap_or(AsyncTaskStatus::NotStarted);
            if matches!(
                status,
                AsyncTaskStatus::NotStarted | AsyncTaskStatus::InProgress | AsyncTaskStatus::Ready
            ) {
                if let Some(expiry_event) = &task.expiry_event {
                    events.push_back(expiry_event.as_str().to_owned());
                }
            }
        }
        Ok(events)
    }

    fn activate_deadline(&mut self, deadline_id: &str) -> Result<(), ScenarioRuntimeError> {
        let deadline = self
            .definition
            .deadlines
            .iter()
            .find(|deadline| deadline.id.as_str() == deadline_id)
            .cloned()
            .expect("validated activated deadline must exist");
        let due = match &deadline.relative_due {
            Some(timing) => self.resolve_timing_at(
                timing,
                self.effect_time_anchor.unwrap_or(self.state.clock_minutes),
            )?,
            None => authored_time_to_elapsed(deadline.due_at, self.definition.initial_clock)
                .expect("validated static deadline cannot precede initial_clock"),
        };
        self.state
            .deadline_due_minutes
            .insert(deadline_id.to_owned(), due);
        self.state
            .deadline_statuses
            .insert(deadline_id.to_owned(), Some(DeadlineStatus::Open));
        Ok(())
    }

    fn queue_due_events(&mut self, events: &mut VecDeque<String>) {
        for event in &self.definition.events {
            if self.state.fired_events.contains(event.id.as_str()) {
                continue;
            }
            if matches!(
                event.trigger,
                EventTrigger::AtTime { at }
                    if authored_time_to_elapsed(at, self.definition.initial_clock)
                        .is_some_and(|at| at <= self.state.clock_minutes)
            ) {
                events.push_back(event.id.as_str().to_owned());
            }
        }

        let due_tasks = self
            .state
            .task_due_minutes
            .iter()
            .filter(|(_, due)| **due <= self.state.clock_minutes)
            .map(|(task, _)| task.clone())
            .collect::<Vec<_>>();
        for task_id in due_tasks {
            self.state
                .task_statuses
                .insert(task_id.clone(), AsyncTaskStatus::Ready);
            self.state.task_due_minutes.remove(&task_id);
            if let Some(task) = self
                .definition
                .async_tasks
                .iter()
                .find(|item| item.id.as_str() == task_id)
            {
                events.push_back(task.completion_event.as_str().to_owned());
                for event in &self.definition.events {
                    if matches!(
                        &event.trigger,
                        EventTrigger::AsyncTaskCompleted { task: trigger_task }
                            if trigger_task == &task.id
                    ) {
                        events.push_back(event.id.as_str().to_owned());
                    }
                }
            }
        }

        let due_deadlines = self
            .definition
            .deadlines
            .iter()
            .filter(|deadline| {
                self.state
                    .deadline_due_minutes
                    .get(deadline.id.as_str())
                    .copied()
                    .is_some_and(|due| {
                        deadline_miss_boundary(deadline, due) <= self.state.clock_minutes
                    })
                    && self
                        .state
                        .deadline_statuses
                        .get(deadline.id.as_str())
                        .copied()
                        .flatten()
                        == Some(DeadlineStatus::Open)
            })
            .cloned()
            .collect::<Vec<_>>();
        for deadline in due_deadlines {
            self.state.deadline_statuses.insert(
                deadline.id.as_str().to_owned(),
                Some(DeadlineStatus::Missed),
            );
            events.push_back(deadline.missed_event.as_str().to_owned());
            for event in &self.definition.events {
                if matches!(
                    &event.trigger,
                    EventTrigger::DeadlineMissed {
                        deadline: trigger_deadline
                    } if trigger_deadline == &deadline.id
                ) {
                    events.push_back(event.id.as_str().to_owned());
                }
            }
        }
    }
}

/// Opaque process-local identifier for one runtime session.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub struct ScenarioSessionId(pub u64);

/// Owns independent sessions so concurrent cases and saves cannot share state.
#[derive(Debug, Default)]
pub struct ScenarioSessionRegistry {
    next_id: u64,
    sessions: BTreeMap<ScenarioSessionId, ScenarioSession>,
}

impl ScenarioSessionRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self {
            next_id: 1,
            sessions: BTreeMap::new(),
        }
    }

    pub fn create(
        &mut self,
        definition: ScenarioDefinition,
        seed: u64,
    ) -> Result<ScenarioSessionId, ScenarioRuntimeError> {
        let session = ScenarioSession::new(definition, seed)?;
        self.insert(session)
    }

    pub fn create_from_json(
        &mut self,
        encoded: &str,
        seed: u64,
    ) -> Result<ScenarioSessionId, ScenarioRuntimeError> {
        let session = ScenarioSession::from_json(encoded, seed)?;
        self.insert(session)
    }

    pub fn snapshot(
        &self,
        id: ScenarioSessionId,
    ) -> Result<MobileScenarioSnapshot, ScenarioRuntimeError> {
        self.sessions
            .get(&id)
            .map(ScenarioSession::snapshot)
            .ok_or(ScenarioRuntimeError::UnknownSession(id.0))
    }

    pub fn dispatch(
        &mut self,
        id: ScenarioSessionId,
        action_id: &str,
    ) -> Result<MobileScenarioSnapshot, ScenarioRuntimeError> {
        self.sessions
            .get_mut(&id)
            .ok_or(ScenarioRuntimeError::UnknownSession(id.0))?
            .dispatch(action_id)
    }

    pub fn advance_time(
        &mut self,
        id: ScenarioSessionId,
        minutes: u32,
    ) -> Result<MobileScenarioSnapshot, ScenarioRuntimeError> {
        self.sessions
            .get_mut(&id)
            .ok_or(ScenarioRuntimeError::UnknownSession(id.0))?
            .advance_time(minutes)
    }

    pub fn dispose(&mut self, id: ScenarioSessionId) -> bool {
        self.sessions.remove(&id).is_some()
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.sessions.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.sessions.is_empty()
    }

    fn insert(
        &mut self,
        session: ScenarioSession,
    ) -> Result<ScenarioSessionId, ScenarioRuntimeError> {
        let id = ScenarioSessionId(self.next_id);
        self.next_id = self
            .next_id
            .checked_add(1)
            .ok_or(ScenarioRuntimeError::ClockOverflow)?;
        self.sessions.insert(id, session);
        Ok(id)
    }
}

fn scenario_time_minutes(time: ScenarioTime) -> u64 {
    u64::from(time.day) * 1_440 + u64::from(time.minute_of_day)
}

fn authored_time_to_elapsed(
    time: ScenarioTime,
    initial_clock: Option<ScenarioTime>,
) -> Option<u64> {
    scenario_time_minutes(time).checked_sub(initial_clock.map_or(0, scenario_time_minutes))
}

fn resolve_forward_time(
    current: u64,
    timing: &RelativeTimeDefinition,
    anchor: u64,
    calendar_baseline: u64,
) -> Result<u64, ScenarioRuntimeError> {
    let offset = anchor
        .checked_add(u64::from(timing.offset_minutes))
        .ok_or(ScenarioRuntimeError::ClockOverflow)?;
    let turnaround = current
        .checked_add(u64::from(timing.minimum_turnaround_minutes))
        .ok_or(ScenarioRuntimeError::ClockOverflow)?;
    let mut target = current.max(offset).max(turnaround);

    if let Some(calendar) = timing.calendar_target {
        let anchor_civil = calendar_baseline
            .checked_add(anchor)
            .ok_or(ScenarioRuntimeError::ClockOverflow)?;
        let target_day = anchor_civil
            .checked_div(1_440)
            .and_then(|day| day.checked_add(u64::from(calendar.day_offset)))
            .ok_or(ScenarioRuntimeError::ClockOverflow)?;
        let target_civil = target_day
            .checked_mul(1_440)
            .and_then(|day| day.checked_add(u64::from(calendar.minute_of_day)))
            .ok_or(ScenarioRuntimeError::ClockOverflow)?;
        target = target.max(target_civil.saturating_sub(calendar_baseline));
    }
    if let Some(not_before) = timing.not_before {
        target = target.max(scenario_time_minutes(not_before).saturating_sub(calendar_baseline));
    }
    Ok(target)
}

fn resolve_initial_deadline_due(
    definition: &ScenarioDefinition,
    deadline_id: &str,
    calendar_baseline: u64,
    due_minutes: &mut BTreeMap<String, u64>,
    visiting: &mut BTreeSet<String>,
) -> Result<u64, ScenarioRuntimeError> {
    if let Some(due) = due_minutes.get(deadline_id).copied() {
        return Ok(due);
    }
    if !visiting.insert(deadline_id.to_owned()) {
        // Validation owns the descriptive cycle diagnostic. This guard keeps
        // construction total if an unvalidated definition reaches the helper.
        return Err(ScenarioRuntimeError::DeadlineInactive(
            deadline_id.to_owned(),
        ));
    }
    let deadline = definition
        .deadlines
        .iter()
        .find(|deadline| deadline.id.as_str() == deadline_id)
        .expect("validated relative deadline must exist");
    let timing = deadline
        .relative_due
        .as_ref()
        .expect("static due minutes are populated before relative resolution");
    let anchor = match &timing.relative_to_deadline {
        Some(anchor) => resolve_initial_deadline_due(
            definition,
            anchor.as_str(),
            calendar_baseline,
            due_minutes,
            visiting,
        )?,
        None => 0,
    };
    let due = resolve_forward_time(0, timing, anchor, calendar_baseline)?;
    visiting.remove(deadline_id);
    due_minutes.insert(deadline_id.to_owned(), due);
    Ok(due)
}

fn add_signed_minutes(base: u64, offset: i64) -> Option<u64> {
    if offset >= 0 {
        base.checked_add(offset.unsigned_abs())
    } else {
        base.checked_sub(offset.unsigned_abs())
    }
}

fn deadline_miss_boundary(deadline: &juris_scenario_schema::DeadlineDefinition, due: u64) -> u64 {
    due.saturating_add(u64::from(deadline.completion_at_due_allowed))
}

fn compare_integers(left: i64, operator: IntegerComparisonOperator, right: i64) -> bool {
    match operator {
        IntegerComparisonOperator::Equal => left == right,
        IntegerComparisonOperator::NotEqual => left != right,
        IntegerComparisonOperator::LessThan => left < right,
        IntegerComparisonOperator::LessThanOrEqual => left <= right,
        IntegerComparisonOperator::GreaterThan => left > right,
        IntegerComparisonOperator::GreaterThanOrEqual => left >= right,
    }
}

const fn is_zero_u32(value: &u32) -> bool {
    *value == 0
}

fn fact_status_name(status: FactStatus) -> &'static str {
    match status {
        FactStatus::Alleged => "alleged",
        FactStatus::Admitted => "admitted",
        FactStatus::Disputed => "disputed",
        FactStatus::Proven => "proven",
        FactStatus::Inferred => "inferred",
        FactStatus::Unknown => "unknown",
    }
}

fn deadline_status_name(status: DeadlineStatus) -> &'static str {
    match status {
        DeadlineStatus::Open => "open",
        DeadlineStatus::Completed => "completed",
        DeadlineStatus::Missed => "missed",
    }
}

fn clock_mode_name(mode: ScenarioClockMode) -> &'static str {
    match mode {
        ScenarioClockMode::ActionDriven => "action_driven",
        ScenarioClockMode::Foreground => "foreground",
    }
}
