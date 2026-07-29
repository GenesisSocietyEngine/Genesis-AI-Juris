use std::collections::{BTreeMap, BTreeSet, VecDeque};

use juris_scenario_schema::{
    ActionDefinition, ActionRepeatability, AsyncTaskStatus, Condition, DeadlineStatus, Effect,
    EventDefinition, EventTrigger, FactStatus, MatterLifecycleStatus, ScenarioDefinition,
    StageKind,
};
use serde_json::Value;

use crate::{
    ScenarioDocument, SimulationCommand, SimulationError, SimulationResult, SimulationState,
    SimulationStatus, TraceEntry, TraceKind,
};

const DEFAULT_MAX_AUTO_EVENTS: usize = 256;

#[derive(Clone, Debug)]
struct RuntimeState {
    fact_statuses: BTreeMap<String, FactStatus>,
    available_evidence: BTreeSet<String>,
    deadline_statuses: BTreeMap<String, Option<DeadlineStatus>>,
    task_statuses: BTreeMap<String, AsyncTaskStatus>,
    task_due_minutes: BTreeMap<String, u64>,
    visible_inbox: BTreeSet<String>,
    resolved_inbox: BTreeSet<String>,
    action_uses: BTreeMap<String, u32>,
}

/// Deterministic path simulator over one canonical ScenarioDefinition v1 document.
#[derive(Clone, Debug)]
pub struct ScenarioSimulator {
    definition: ScenarioDefinition,
    state: SimulationState,
    runtime: RuntimeState,
    fired_events: BTreeSet<String>,
    trace: Vec<TraceEntry>,
    max_auto_events: usize,
}

impl ScenarioSimulator {
    /// Creates a simulator at the initial stage and minute zero.
    pub fn new(document: ScenarioDocument) -> Result<Self, SimulationError> {
        validate_supported_v1_shapes(document.root())?;
        let definition: ScenarioDefinition = serde_json::from_value(document.root().clone())
            .map_err(|source| SimulationError::InvalidScenarioDocument { source })?;
        let initial_stage = definition.initial_stage.as_str().to_owned();
        if !definition
            .stages
            .iter()
            .any(|stage| stage.id.as_str() == initial_stage)
        {
            return Err(SimulationError::UnknownStage {
                stage: initial_stage,
            });
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

        let initial_stage_definition = definition
            .stages
            .iter()
            .find(|stage| stage.id.as_str() == initial_stage)
            .expect("validated initial stage must exist");
        let matter_lifecycle = MatterLifecycleStatus::from_stage(
            initial_stage_definition.kind,
            initial_stage_definition.terminal,
        );

        Ok(Self {
            definition,
            state: SimulationState {
                stage: initial_stage,
                clock_minutes: 0,
                flags: BTreeMap::new(),
                judicial_result: None,
                matter_lifecycle,
                resolved_outcome: None,
                is_closed: matter_lifecycle.is_closed(),
            },
            runtime: RuntimeState {
                fact_statuses,
                available_evidence,
                deadline_statuses,
                task_statuses,
                task_due_minutes: BTreeMap::new(),
                visible_inbox,
                resolved_inbox: BTreeSet::new(),
                action_uses: BTreeMap::new(),
            },
            fired_events: BTreeSet::new(),
            trace: Vec::new(),
            max_auto_events: DEFAULT_MAX_AUTO_EVENTS,
        })
    }

    /// Changes the cycle guard used for automatic event processing.
    pub fn set_max_auto_events(&mut self, limit: usize) {
        self.max_auto_events = limit;
    }

    #[must_use]
    pub fn state(&self) -> &SimulationState {
        &self.state
    }

    /// Executes authored action IDs in the supplied order.
    pub fn run_actions(
        self,
        actions: &[String],
        require_outcome: bool,
    ) -> Result<SimulationResult, SimulationError> {
        let commands = actions
            .iter()
            .cloned()
            .map(SimulationCommand::Action)
            .collect::<Vec<_>>();
        self.run_commands(&commands, require_outcome)
    }

    /// Executes explicit action and foreground-time commands in replay order.
    pub fn run_commands(
        mut self,
        commands: &[SimulationCommand],
        require_outcome: bool,
    ) -> Result<SimulationResult, SimulationError> {
        self.process_due_events()?;

        for command in commands {
            match command {
                SimulationCommand::Action(action) => self.apply_action(action)?,
                SimulationCommand::AdvanceTime { minutes } => {
                    self.advance_time(*minutes)?;
                }
            }
        }

        if self.is_terminal_stage(&self.state.stage) && self.state.resolved_outcome.is_none() {
            return Err(SimulationError::TerminalWithoutOutcome {
                stage: self.state.stage.clone(),
            });
        }
        if require_outcome && self.state.resolved_outcome.is_none() {
            return Err(SimulationError::OutcomeRequired);
        }

        Ok(SimulationResult {
            scenario_id: self.definition.metadata.id.as_str().to_owned(),
            status: if self.state.is_closed {
                SimulationStatus::Completed
            } else {
                SimulationStatus::InProgress
            },
            final_state: self.state,
            fired_events: self.fired_events.into_iter().collect(),
            trace: self.trace,
        })
    }

    fn advance_time(&mut self, minutes: u32) -> Result<(), SimulationError> {
        if self.is_terminal_stage(&self.state.stage) {
            return Err(SimulationError::TimeAdvanceAfterTerminal {
                stage: self.state.stage.clone(),
            });
        }

        let before = self.state.clone();
        self.state.clock_minutes = self
            .state
            .clock_minutes
            .checked_add(u64::from(minutes))
            .ok_or_else(|| SimulationError::ClockOverflow {
                owner: format!("advance_time:{minutes}"),
            })?;

        let mut events = VecDeque::new();
        self.queue_due_events(&mut events)?;
        self.trace.push(TraceEntry {
            sequence: self.trace.len(),
            kind: TraceKind::TimeAdvance,
            id: minutes.to_string(),
            state_before: before,
            state_after: self.state.clone(),
        });
        self.process_event_queue(events)
    }

    fn apply_action(&mut self, action_id: &str) -> Result<(), SimulationError> {
        if self.is_terminal_stage(&self.state.stage) {
            return Err(SimulationError::ActionAfterTerminal {
                action: action_id.to_owned(),
                stage: self.state.stage.clone(),
            });
        }

        let action = self
            .definition
            .actions
            .iter()
            .find(|action| action.id.as_str() == action_id)
            .cloned()
            .ok_or_else(|| SimulationError::UnknownAction {
                action: action_id.to_owned(),
            })?;
        self.ensure_action_allowed_by_stage(action_id)?;
        if !self.action_is_repeatable(&action) || !self.evaluate_condition(&action.available_when) {
            return Err(SimulationError::ActionUnavailable {
                action: action_id.to_owned(),
            });
        }

        let before = self.state.clone();
        let mut queued_events =
            self.apply_effects(&action.effects, &format!("action `{action_id}`"))?;
        *self
            .runtime
            .action_uses
            .entry(action_id.to_owned())
            .or_default() += 1;
        self.state.clock_minutes = self
            .state
            .clock_minutes
            .checked_add(u64::from(action.time_cost_minutes))
            .ok_or_else(|| SimulationError::ClockOverflow {
                owner: action_id.to_owned(),
            })?;

        for event in &self.definition.events {
            if matches!(
                &event.trigger,
                EventTrigger::AfterAction { action } if action.as_str() == action_id
            ) {
                queued_events.push_back(event.id.as_str().to_owned());
            }
        }
        self.queue_due_events(&mut queued_events)?;

        self.trace.push(TraceEntry {
            sequence: self.trace.len(),
            kind: TraceKind::Action,
            id: action_id.to_owned(),
            state_before: before,
            state_after: self.state.clone(),
        });
        self.process_event_queue(queued_events)
    }

    fn process_due_events(&mut self) -> Result<(), SimulationError> {
        let mut queue = VecDeque::new();
        for event in &self.definition.events {
            if matches!(event.trigger, EventTrigger::ScenarioStart) {
                queue.push_back(event.id.as_str().to_owned());
            }
        }
        self.queue_due_events(&mut queue)?;
        self.process_event_queue(queue)
    }

    fn process_event_queue(&mut self, mut queue: VecDeque<String>) -> Result<(), SimulationError> {
        let mut processed = 0_usize;
        while let Some(event_id) = queue.pop_front() {
            if self.fired_events.contains(&event_id) {
                continue;
            }
            processed += 1;
            if processed > self.max_auto_events {
                return Err(SimulationError::AutomaticEventLimitExceeded {
                    limit: self.max_auto_events,
                });
            }

            let event = self
                .definition
                .events
                .iter()
                .find(|event| event.id.as_str() == event_id)
                .cloned()
                .ok_or_else(|| SimulationError::UnknownEvent {
                    event: event_id.clone(),
                })?;
            if !self.evaluate_condition(&event.condition) {
                continue;
            }

            self.fired_events.insert(event_id.clone());
            let before = self.state.clone();
            let mut nested = self.activate_event_owned_state(&event);
            let mut effect_events =
                self.apply_effects(&event.effects, &format!("event `{event_id}`"))?;
            nested.append(&mut effect_events);
            for dependent in &self.definition.events {
                if matches!(
                    &dependent.trigger,
                    EventTrigger::AfterEvent { event } if event.as_str() == event_id
                ) {
                    nested.push_back(dependent.id.as_str().to_owned());
                }
            }
            self.queue_due_events(&mut nested)?;
            queue.append(&mut nested);

            self.trace.push(TraceEntry {
                sequence: self.trace.len(),
                kind: TraceKind::Event,
                id: event_id,
                state_before: before,
                state_after: self.state.clone(),
            });
        }
        Ok(())
    }

    fn apply_effects(
        &mut self,
        effects: &[Effect],
        owner: &str,
    ) -> Result<VecDeque<String>, SimulationError> {
        let mut events = VecDeque::new();
        let mut outcomes = Vec::new();

        for effect in effects {
            match effect {
                Effect::SetStage { stage } => {
                    if !self.definition.stages.iter().any(|item| item.id == *stage) {
                        return Err(SimulationError::UnknownStage {
                            stage: stage.as_str().to_owned(),
                        });
                    }
                    self.state.stage = stage.as_str().to_owned();
                    self.refresh_lifecycle();
                }
                Effect::SetFlag { flag, value } => {
                    self.state.flags.insert(flag.as_str().to_owned(), *value);
                }
                Effect::SetFactStatus { fact, status } => {
                    self.runtime
                        .fact_statuses
                        .insert(fact.as_str().to_owned(), *status);
                }
                Effect::MakeEvidenceAvailable { evidence } => {
                    self.runtime
                        .available_evidence
                        .insert(evidence.as_str().to_owned());
                }
                Effect::StartAsyncTask { task } => {
                    self.runtime
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
                            .ok_or_else(|| SimulationError::ClockOverflow {
                                owner: task.as_str().to_owned(),
                            })?;
                        self.runtime
                            .task_due_minutes
                            .insert(task.as_str().to_owned(), due);
                    }
                }
                Effect::MarkAsyncTaskReady { task } => {
                    self.runtime
                        .task_statuses
                        .insert(task.as_str().to_owned(), AsyncTaskStatus::Ready);
                    self.runtime.task_due_minutes.remove(task.as_str());
                }
                Effect::ReviewAsyncTask { task } => {
                    self.runtime
                        .task_statuses
                        .insert(task.as_str().to_owned(), AsyncTaskStatus::Reviewed);
                    self.runtime.task_due_minutes.remove(task.as_str());
                }
                Effect::ExpireAsyncTask { task } => {
                    self.runtime
                        .task_statuses
                        .insert(task.as_str().to_owned(), AsyncTaskStatus::Expired);
                    self.runtime.task_due_minutes.remove(task.as_str());
                }
                Effect::CompleteDeadline { deadline } => {
                    self.runtime.deadline_statuses.insert(
                        deadline.as_str().to_owned(),
                        Some(DeadlineStatus::Completed),
                    );
                }
                Effect::MissDeadline { deadline } => {
                    self.runtime
                        .deadline_statuses
                        .insert(deadline.as_str().to_owned(), Some(DeadlineStatus::Missed));
                }
                Effect::CreateInboxItem { item } => {
                    self.runtime.visible_inbox.insert(item.as_str().to_owned());
                }
                Effect::ResolveInboxItem { item } => {
                    self.runtime.resolved_inbox.insert(item.as_str().to_owned());
                }
                Effect::SetJudicialResult { result } => {
                    self.state.judicial_result = Some(*result);
                }
                Effect::TriggerEvent { event } => {
                    if !self.definition.events.iter().any(|item| item.id == *event) {
                        return Err(SimulationError::UnknownEvent {
                            event: event.as_str().to_owned(),
                        });
                    }
                    events.push_back(event.as_str().to_owned());
                }
                Effect::ResolveOutcome { outcome } => {
                    outcomes.push(outcome.as_str().to_owned());
                }
            }
        }

        outcomes.sort();
        outcomes.dedup();
        if outcomes.len() > 1 {
            return Err(SimulationError::MultipleOutcomes {
                owner: owner.to_owned(),
                outcomes: outcomes.join(", "),
            });
        }
        if let Some(outcome) = outcomes.first() {
            self.resolve_outcome(outcome)?;
        }
        Ok(events)
    }

    fn resolve_outcome(&mut self, outcome_id: &str) -> Result<(), SimulationError> {
        if let Some(existing) = self.state.resolved_outcome.as_ref() {
            if existing == outcome_id {
                return Ok(());
            }
            return Err(SimulationError::ConflictingOutcome {
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
            .ok_or_else(|| SimulationError::UnknownOutcome {
                outcome: outcome_id.to_owned(),
            })?;
        if outcome.terminal_stage.as_str() != self.state.stage {
            return Err(SimulationError::OutcomeStageMismatch {
                outcome: outcome_id.to_owned(),
                expected: outcome.terminal_stage.as_str().to_owned(),
                actual: self.state.stage.clone(),
            });
        }
        if !self.evaluate_condition(&outcome.condition) {
            return Err(SimulationError::OutcomeConditionFalse {
                outcome: outcome_id.to_owned(),
            });
        }
        self.state.resolved_outcome = Some(outcome_id.to_owned());
        Ok(())
    }

    fn ensure_action_allowed_by_stage(&self, action_id: &str) -> Result<(), SimulationError> {
        let stage = self
            .definition
            .stages
            .iter()
            .find(|item| item.id.as_str() == self.state.stage)
            .ok_or_else(|| SimulationError::UnknownStage {
                stage: self.state.stage.clone(),
            })?;
        if stage
            .exit_actions
            .iter()
            .any(|candidate| candidate.as_str() == action_id)
        {
            Ok(())
        } else {
            Err(SimulationError::ActionNotAllowedByStage {
                action: action_id.to_owned(),
                stage: self.state.stage.clone(),
            })
        }
    }

    fn action_is_repeatable(&self, action: &ActionDefinition) -> bool {
        let uses = self
            .runtime
            .action_uses
            .get(action.id.as_str())
            .copied()
            .unwrap_or(0);
        match action.repeatability {
            ActionRepeatability::Once => uses == 0,
            ActionRepeatability::Unlimited => true,
            ActionRepeatability::Limited { max_uses } => uses < max_uses,
        }
    }

    fn evaluate_condition(&self, condition: &Condition) -> bool {
        match condition {
            Condition::Always => true,
            Condition::StageIs { stage } => stage.as_str() == self.state.stage,
            Condition::FlagEquals { flag, value } => {
                self.state
                    .flags
                    .get(flag.as_str())
                    .copied()
                    .unwrap_or(false)
                    == *value
            }
            Condition::FactStatusIs { fact, status } => {
                self.runtime.fact_statuses.get(fact.as_str()) == Some(status)
            }
            Condition::EvidenceAvailable { evidence } => {
                self.runtime.available_evidence.contains(evidence.as_str())
            }
            Condition::DeadlineStatusIs { deadline, status } => {
                self.runtime
                    .deadline_statuses
                    .get(deadline.as_str())
                    .copied()
                    .flatten()
                    == Some(*status)
            }
            Condition::AsyncTaskStatusIs { task, status } => {
                self.runtime.task_statuses.get(task.as_str()) == Some(status)
            }
            Condition::InboxItemResolved { item } => {
                self.runtime.resolved_inbox.contains(item.as_str())
            }
            Condition::JudicialResultIs { result } => self.state.judicial_result == Some(*result),
            Condition::All { conditions } => {
                conditions.iter().all(|item| self.evaluate_condition(item))
            }
            Condition::Any { conditions } => {
                conditions.iter().any(|item| self.evaluate_condition(item))
            }
            Condition::Not { condition } => !self.evaluate_condition(condition),
        }
    }

    fn activate_event_owned_state(&mut self, event: &EventDefinition) -> VecDeque<String> {
        let mut events = VecDeque::new();
        for deadline in &self.definition.deadlines {
            if deadline.activation_event.as_ref() == Some(&event.id) {
                self.runtime
                    .deadline_statuses
                    .insert(deadline.id.as_str().to_owned(), Some(DeadlineStatus::Open));
            }
        }
        for item in &self.definition.inbox_items {
            if item.created_by_event.as_ref() == Some(&event.id) {
                self.runtime
                    .visible_inbox
                    .insert(item.id.as_str().to_owned());
            }
            if item.expiry_event.as_ref() == Some(&event.id) {
                self.runtime
                    .resolved_inbox
                    .insert(item.id.as_str().to_owned());
            }
        }
        for task in &self.definition.async_tasks {
            if task.usable_until_event.as_ref() != Some(&event.id) {
                continue;
            }
            let status = self
                .runtime
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

    fn queue_due_events(&mut self, events: &mut VecDeque<String>) -> Result<(), SimulationError> {
        for event in &self.definition.events {
            if self.fired_events.contains(event.id.as_str()) {
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
            .runtime
            .task_due_minutes
            .iter()
            .filter(|(_, due)| **due <= self.state.clock_minutes)
            .map(|(task, _)| task.clone())
            .collect::<Vec<_>>();
        for task_id in due_tasks {
            self.runtime
                .task_statuses
                .insert(task_id.clone(), AsyncTaskStatus::Ready);
            self.runtime.task_due_minutes.remove(&task_id);
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
                        .runtime
                        .deadline_statuses
                        .get(deadline.id.as_str())
                        .copied()
                        .flatten()
                        == Some(DeadlineStatus::Open)
            })
            .cloned()
            .collect::<Vec<_>>();
        for deadline in due_deadlines {
            self.runtime.deadline_statuses.insert(
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
        Ok(())
    }

    fn is_terminal_stage(&self, stage_id: &str) -> bool {
        self.definition
            .stages
            .iter()
            .find(|item| item.id.as_str() == stage_id)
            .is_some_and(|stage| stage.terminal || stage.kind == StageKind::Resolved)
    }

    fn refresh_lifecycle(&mut self) {
        let stage = self
            .definition
            .stages
            .iter()
            .find(|item| item.id.as_str() == self.state.stage)
            .expect("validated current stage must exist");
        self.state.matter_lifecycle = MatterLifecycleStatus::from_stage(stage.kind, stage.terminal);
        self.state.is_closed = self.state.matter_lifecycle.is_closed();
    }
}

fn scenario_time_minutes(time: juris_scenario_schema::ScenarioTime) -> u64 {
    u64::from(time.day) * 1_440 + u64::from(time.minute_of_day)
}

fn validate_supported_v1_shapes(root: &Value) -> Result<(), SimulationError> {
    for (collection, condition_field) in [
        ("actions", "available_when"),
        ("events", "condition"),
        ("outcomes", "condition"),
    ] {
        for (index, item) in root
            .get(collection)
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .enumerate()
        {
            if let Some(condition) = item.get(condition_field) {
                validate_condition_shape(
                    condition,
                    &format!("{collection}[{index}].{condition_field}"),
                )?;
            }
        }
    }
    for collection in ["actions", "events"] {
        for (item_index, item) in root
            .get(collection)
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .enumerate()
        {
            for (effect_index, effect) in item
                .get("effects")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .enumerate()
            {
                let effect_type = effect
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if !matches!(
                    effect_type,
                    "set_stage"
                        | "set_flag"
                        | "set_fact_status"
                        | "make_evidence_available"
                        | "start_async_task"
                        | "mark_async_task_ready"
                        | "review_async_task"
                        | "expire_async_task"
                        | "complete_deadline"
                        | "miss_deadline"
                        | "create_inbox_item"
                        | "resolve_inbox_item"
                        | "set_judicial_result"
                        | "trigger_event"
                        | "resolve_outcome"
                ) {
                    return Err(SimulationError::UnsupportedEffect {
                        effect_type: effect_type.to_owned(),
                        path: format!("{collection}[{item_index}].effects[{effect_index}]"),
                    });
                }
            }
        }
    }
    for (index, event) in root
        .get("events")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .enumerate()
    {
        if let Some(trigger_type) = event
            .get("trigger")
            .and_then(|trigger| trigger.get("type"))
            .and_then(Value::as_str)
        {
            if !matches!(
                trigger_type,
                "scenario_start"
                    | "at_time"
                    | "after_action"
                    | "after_event"
                    | "async_task_completed"
                    | "deadline_missed"
                    | "by_effect"
            ) {
                return Err(SimulationError::UnsupportedEventTrigger {
                    trigger_type: trigger_type.to_owned(),
                    path: format!("events[{index}].trigger"),
                });
            }
        }
    }
    Ok(())
}

fn validate_condition_shape(condition: &Value, path: &str) -> Result<(), SimulationError> {
    let condition_type = condition
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    match condition_type {
        "always"
        | "stage_is"
        | "flag_equals"
        | "fact_status_is"
        | "evidence_available"
        | "deadline_status_is"
        | "async_task_status_is"
        | "inbox_item_resolved" => Ok(()),
        "judicial_result_is" => Ok(()),
        "all" | "any" => {
            for (index, child) in condition
                .get("conditions")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .enumerate()
            {
                validate_condition_shape(child, &format!("{path}.conditions[{index}]"))?;
            }
            Ok(())
        }
        "not" => {
            if let Some(child) = condition.get("condition") {
                validate_condition_shape(child, &format!("{path}.condition"))
            } else {
                Ok(())
            }
        }
        other => Err(SimulationError::UnsupportedCondition {
            condition_type: other.to_owned(),
            path: path.to_owned(),
        }),
    }
}
