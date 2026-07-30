//! Generic authoritative runtime for declarative scenario definitions.
//!
//! Flutter and other presentation layers receive immutable snapshots and send
//! stable action IDs. They never apply scenario effects themselves. Keeping
//! interpretation and mutation inside `juris-engine` preserves the authority
//! boundary while allowing new validated scenarios to reuse one runtime.

use std::collections::{BTreeMap, BTreeSet, VecDeque};

use juris_scenario_schema::{
    ActionDefinition, ActionRepeatability, AsyncTaskStatus, Condition, DeadlineStatus, Effect,
    EventDefinition, EventTrigger, FactStatus, ScenarioClockMode, ScenarioDefinition, StageKind,
};
use juris_scenario_validator::validate_scenario;
use serde::Serialize;
use thiserror::Error;

mod persistence;

pub use persistence::{
    ScenarioCommand, ScenarioSaveEnvelope, ScenarioSaveError, SAVE_SCHEMA_ID, SAVE_SCHEMA_VERSION,
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
    pub time_cost_minutes: u32,
    pub cost_eur: u32,
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

/// Presentation-safe deadline state. Inactive deadlines use `null` status.
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
    pub subject: String,
    pub body: String,
    pub visible: bool,
    pub action_required: bool,
    pub resolved: bool,
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
    pub terminal: bool,
    pub flags: BTreeMap<String, bool>,
    pub facts: Vec<MobileFactSnapshot>,
    pub evidence: Vec<MobileEvidenceSnapshot>,
    pub deadlines: Vec<MobileDeadlineSnapshot>,
    pub inbox: Vec<MobileInboxSnapshot>,
    pub available_actions: Vec<MobileActionSnapshot>,
    pub fired_event_ids: Vec<String>,
    pub outcome: Option<MobileOutcomeSnapshot>,
}

#[derive(Debug, Clone)]
struct ScenarioRuntimeState {
    stage_id: String,
    clock_minutes: u64,
    flags: BTreeMap<String, bool>,
    fact_statuses: BTreeMap<String, FactStatus>,
    available_evidence: BTreeSet<String>,
    deadline_statuses: BTreeMap<String, Option<DeadlineStatus>>,
    task_statuses: BTreeMap<String, AsyncTaskStatus>,
    task_due_minutes: BTreeMap<String, u64>,
    visible_inbox: BTreeSet<String>,
    resolved_inbox: BTreeSet<String>,
    action_uses: BTreeMap<String, u32>,
    fired_events: BTreeSet<String>,
    outcome_id: Option<String>,
}

/// Authoritative runtime for one validated declarative scenario.
#[derive(Debug, Clone)]
pub struct ScenarioSession {
    seed: u64,
    definition: ScenarioDefinition,
    state: ScenarioRuntimeState,
    command_log: Vec<ScenarioCommand>,
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

        let mut session = Self {
            seed,
            state: ScenarioRuntimeState {
                stage_id: definition.initial_stage.as_str().to_owned(),
                clock_minutes: 0,
                flags: BTreeMap::new(),
                fact_statuses,
                available_evidence,
                deadline_statuses,
                task_statuses,
                task_due_minutes: BTreeMap::new(),
                visible_inbox,
                resolved_inbox: BTreeSet::new(),
                action_uses: BTreeMap::new(),
                fired_events: BTreeSet::new(),
                outcome_id: None,
            },
            definition,
            command_log: Vec::new(),
        };

        let mut initial_events = VecDeque::new();
        for event in &session.definition.events {
            match &event.trigger {
                EventTrigger::ScenarioStart => {
                    initial_events.push_back(event.id.as_str().to_owned());
                }
                EventTrigger::AtTime { at } if scenario_time_minutes(*at) == 0 => {
                    initial_events.push_back(event.id.as_str().to_owned());
                }
                _ => {}
            }
        }
        session.process_event_queue(initial_events)?;
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

        let facts = self
            .definition
            .facts
            .iter()
            .map(|fact| MobileFactSnapshot {
                id: fact.id.as_str().to_owned(),
                statement: fact.statement.clone(),
                status: fact_status_name(
                    *self
                        .state
                        .fact_statuses
                        .get(fact.id.as_str())
                        .expect("validated fact state must exist"),
                )
                .to_owned(),
            })
            .collect();
        let evidence = self
            .definition
            .evidence
            .iter()
            .map(|item| MobileEvidenceSnapshot {
                id: item.id.as_str().to_owned(),
                title: item.title.clone(),
                kind: format!("{:?}", item.kind).to_lowercase(),
                available: self.state.available_evidence.contains(item.id.as_str()),
            })
            .collect();
        let deadlines = self
            .definition
            .deadlines
            .iter()
            .map(|deadline| MobileDeadlineSnapshot {
                id: deadline.id.as_str().to_owned(),
                title: deadline.title.clone(),
                due_at_minutes: scenario_time_minutes(deadline.due_at),
                status: self
                    .state
                    .deadline_statuses
                    .get(deadline.id.as_str())
                    .copied()
                    .flatten()
                    .map(deadline_status_name)
                    .map(str::to_owned),
                completion_action_ids: deadline
                    .completion_actions
                    .iter()
                    .map(|action| action.as_str().to_owned())
                    .collect(),
            })
            .collect();
        let inbox = self
            .definition
            .inbox_items
            .iter()
            .map(|item| MobileInboxSnapshot {
                id: item.id.as_str().to_owned(),
                subject: item.subject.clone(),
                body: item.body.clone(),
                visible: self.state.visible_inbox.contains(item.id.as_str()),
                action_required: item.action_required,
                resolved: self.state.resolved_inbox.contains(item.id.as_str()),
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

        MobileScenarioSnapshot {
            snapshot_schema_version: SNAPSHOT_SCHEMA_VERSION,
            scenario_id: self.definition.metadata.id.as_str().to_owned(),
            seed: self.seed,
            stage_id: self.state.stage_id.clone(),
            stage_title: stage.title.clone(),
            clock_minutes: self.state.clock_minutes,
            clock_mode: clock_mode_name(self.definition.clock.mode).to_owned(),
            terminal: self.is_terminal(),
            flags: self.state.flags.clone(),
            facts,
            evidence,
            deadlines,
            inbox,
            available_actions: self.available_actions(),
            fired_event_ids: self.state.fired_events.iter().cloned().collect(),
            outcome,
        }
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
        if self.is_terminal() {
            return Err(ScenarioRuntimeError::ScenarioResolved);
        }

        let action = self
            .definition
            .actions
            .iter()
            .find(|item| item.id.as_str() == action_id)
            .cloned()
            .filter(|item| self.action_is_available(item))
            .ok_or_else(|| ScenarioRuntimeError::ActionUnavailable(action_id.to_owned()))?;

        self.apply_effects(&action.effects)?;
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
        self.advance_clock_by(action.time_cost_minutes, events)?;

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
        if self.is_terminal() {
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

        self.advance_clock_by(minutes, VecDeque::new())?;
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
    ) -> Result<(), ScenarioRuntimeError> {
        let target = self
            .state
            .clock_minutes
            .checked_add(u64::from(minutes))
            .ok_or(ScenarioRuntimeError::ClockOverflow)?;

        // An action may resolve the scenario in its effects. Its declared time
        // cost still belongs to that action, but no later temporal event fires.
        if self.is_terminal() {
            self.state.clock_minutes = target;
            return Ok(());
        }

        while let Some(boundary) = self.next_temporal_boundary_before(target) {
            self.state.clock_minutes = boundary;
            let mut due_events = VecDeque::new();
            self.queue_due_events(&mut due_events);
            self.process_event_queue(due_events)?;
            if self.is_terminal() {
                return Ok(());
            }
        }

        self.state.clock_minutes = target;
        let mut events = final_events;
        self.queue_due_events(&mut events);
        self.process_event_queue(events)
    }

    fn next_temporal_boundary_before(&self, target: u64) -> Option<u64> {
        let current = self.state.clock_minutes;
        let at_time = self.definition.events.iter().filter_map(|event| {
            if self.state.fired_events.contains(event.id.as_str()) {
                return None;
            }
            match event.trigger {
                EventTrigger::AtTime { at } => Some(scenario_time_minutes(at)),
                _ => None,
            }
        });
        let async_tasks = self
            .state
            .task_due_minutes
            .iter()
            .filter_map(|(task_id, due)| {
                (self.state.task_statuses.get(task_id) == Some(&AsyncTaskStatus::InProgress))
                    .then_some(*due)
            });
        let deadlines = self.definition.deadlines.iter().filter_map(|deadline| {
            (self
                .state
                .deadline_statuses
                .get(deadline.id.as_str())
                .copied()
                .flatten()
                == Some(DeadlineStatus::Open))
            .then_some(scenario_time_minutes(deadline.due_at))
        });

        at_time
            .chain(async_tasks)
            .chain(deadlines)
            .filter(|boundary| *boundary > current && *boundary < target)
            .min()
    }

    fn available_actions(&self) -> Vec<MobileActionSnapshot> {
        if self.is_terminal() {
            return Vec::new();
        }

        self.definition
            .actions
            .iter()
            .filter(|action| self.action_is_available(action))
            .map(|action| MobileActionSnapshot {
                id: action.id.as_str().to_owned(),
                title: action.title.clone(),
                description: action.description.clone(),
                time_cost_minutes: action.time_cost_minutes,
                cost_eur: action.cost_eur,
            })
            .collect()
    }

    fn action_is_available(&self, action: &ActionDefinition) -> bool {
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

    fn is_terminal(&self) -> bool {
        let terminal_stage = self
            .definition
            .stages
            .iter()
            .find(|item| item.id.as_str() == self.state.stage_id)
            .is_some_and(|stage| stage.terminal || stage.kind == StageKind::Resolved);
        terminal_stage || self.state.outcome_id.is_some()
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
            Condition::All { conditions } => {
                conditions.iter().all(|item| self.evaluate_condition(item))
            }
            Condition::Any { conditions } => {
                conditions.iter().any(|item| self.evaluate_condition(item))
            }
            Condition::Not { condition } => !self.evaluate_condition(condition),
        }
    }

    fn apply_effects(&mut self, effects: &[Effect]) -> Result<(), ScenarioRuntimeError> {
        let mut events = VecDeque::new();
        for effect in effects {
            match effect {
                Effect::SetStage { stage } => {
                    self.state.stage_id = stage.as_str().to_owned();
                }
                Effect::SetFlag { flag, value } => {
                    self.state.flags.insert(flag.as_str().to_owned(), *value);
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
                    {
                        let due = self
                            .state
                            .clock_minutes
                            .checked_add(u64::from(definition.duration_minutes))
                            .ok_or(ScenarioRuntimeError::ClockOverflow)?;
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
                }
                Effect::ResolveInboxItem { item } => {
                    self.state.resolved_inbox.insert(item.as_str().to_owned());
                }
                Effect::TriggerEvent { event } => {
                    events.push_back(event.as_str().to_owned());
                }
                Effect::ResolveOutcome { outcome } => {
                    self.resolve_outcome(outcome.as_str())?;
                }
            }
        }
        self.process_event_queue(events)
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
        mut events: VecDeque<String>,
    ) -> Result<(), ScenarioRuntimeError> {
        let mut processed = 0_usize;
        while let Some(event_id) = events.pop_front() {
            if self.state.fired_events.contains(&event_id) {
                continue;
            }
            processed += 1;
            if processed > MAX_EVENTS_PER_COMMAND {
                return Err(ScenarioRuntimeError::EventLimitExceeded(
                    MAX_EVENTS_PER_COMMAND,
                ));
            }

            let event = self
                .definition
                .events
                .iter()
                .find(|item| item.id.as_str() == event_id)
                .cloned()
                .ok_or_else(|| ScenarioRuntimeError::UnknownEvent(event_id.clone()))?;
            if !self.evaluate_condition(&event.condition) {
                continue;
            }

            self.state.fired_events.insert(event_id.clone());
            let mut event_owned = self.activate_event_owned_state(&event);
            self.apply_effects(&event.effects)?;
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

    fn activate_event_owned_state(&mut self, event: &EventDefinition) -> VecDeque<String> {
        let mut events = VecDeque::new();
        for deadline in &self.definition.deadlines {
            if deadline.activation_event.as_ref() == Some(&event.id) {
                self.state
                    .deadline_statuses
                    .insert(deadline.id.as_str().to_owned(), Some(DeadlineStatus::Open));
            }
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
        events
    }

    fn queue_due_events(&mut self, events: &mut VecDeque<String>) {
        for event in &self.definition.events {
            if self.state.fired_events.contains(event.id.as_str()) {
                continue;
            }
            if matches!(
                event.trigger,
                EventTrigger::AtTime { at }
                    if scenario_time_minutes(at) <= self.state.clock_minutes
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
                scenario_time_minutes(deadline.due_at) <= self.state.clock_minutes
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

fn scenario_time_minutes(time: juris_scenario_schema::ScenarioTime) -> u64 {
    u64::from(time.day) * 1_440 + u64::from(time.minute_of_day)
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
