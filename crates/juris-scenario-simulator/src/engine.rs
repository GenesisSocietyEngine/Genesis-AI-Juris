use std::collections::{BTreeMap, BTreeSet, VecDeque};

use juris_scenario_schema::{
    ActionDefinition, ActionRepeatability, AsyncTaskStatus, Condition, DeadlineStatus, Effect,
    EventDefinition, EventTrigger, FactStatus, IntegerComparisonOperator, IntegerOperand,
    JudicialDecisionInstance, MatterLifecycleStatus, RelativeTimeDefinition, ScenarioClockMode,
    ScenarioDefinition, StageKind, RESOURCE_BILLABLE_MINUTES, RESOURCE_SPEND_EUR,
};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::{
    ScenarioDocument, ScenarioTraceCommand, SimulationError, SimulationResult, SimulationState,
    SimulationStatus, TraceEntry, TraceKind,
};

const DEFAULT_MAX_AUTO_EVENTS: usize = 256;
const MAX_FOREGROUND_ADVANCE_MINUTES: u32 = 1_440;

#[derive(Clone, Debug)]
struct RuntimeState {
    fact_statuses: BTreeMap<String, FactStatus>,
    available_evidence: BTreeSet<String>,
    deadline_statuses: BTreeMap<String, Option<DeadlineStatus>>,
    deadline_due_minutes: BTreeMap<String, u64>,
    task_statuses: BTreeMap<String, AsyncTaskStatus>,
    task_due_minutes: BTreeMap<String, u64>,
    visible_inbox: BTreeSet<String>,
    resolved_inbox: BTreeSet<String>,
    action_uses: BTreeMap<String, u32>,
    decision_resolutions: BTreeMap<String, Vec<String>>,
}

/// Deterministic path simulator over one canonical ScenarioDefinition v1 document.
#[derive(Clone, Debug)]
pub struct ScenarioSimulator {
    seed: u64,
    effect_time_anchor: Option<u64>,
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
        Self::new_with_seed(document, 0)
    }

    /// Creates a simulator with the seed used by deterministic decisions.
    /// The legacy constructor remains equivalent to seed zero.
    pub fn new_with_seed(document: ScenarioDocument, seed: u64) -> Result<Self, SimulationError> {
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
        let calendar_baseline = definition
            .initial_clock
            .map(scenario_time_minutes)
            .unwrap_or(0);
        // Static authored due times are known independently of activation.
        // Populate those first so a relative deadline never depends on array
        // order when it names a later-declared static anchor.
        let mut deadline_due_minutes = definition
            .deadlines
            .iter()
            .filter(|deadline| deadline.relative_due.is_none())
            .map(|deadline| {
                let due = authored_time_to_elapsed(deadline.due_at, definition.initial_clock)
                    .ok_or_else(|| SimulationError::ClockOverflow {
                        owner: deadline.id.as_str().to_owned(),
                    })?;
                Ok((deadline.id.as_str().to_owned(), due))
            })
            .collect::<Result<BTreeMap<_, _>, SimulationError>>()?;
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

        let initial_stage_definition = definition
            .stages
            .iter()
            .find(|stage| stage.id.as_str() == initial_stage)
            .expect("validated initial stage must exist");
        let matter_lifecycle = MatterLifecycleStatus::from_stage(
            initial_stage_definition.kind,
            initial_stage_definition.terminal,
        );

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

        Ok(Self {
            seed,
            effect_time_anchor: None,
            definition,
            state: SimulationState {
                stage: initial_stage,
                clock_minutes: 0,
                flags: BTreeMap::new(),
                numeric_metrics,
                resources,
                judicial_result: None,
                judicial_decision_instance: None,
                matter_lifecycle,
                resolved_outcome: None,
                is_closed: matter_lifecycle.is_closed(),
            },
            runtime: RuntimeState {
                fact_statuses,
                available_evidence,
                deadline_statuses,
                deadline_due_minutes,
                task_statuses,
                task_due_minutes: BTreeMap::new(),
                visible_inbox,
                resolved_inbox: BTreeSet::new(),
                action_uses: BTreeMap::new(),
                decision_resolutions: BTreeMap::new(),
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
            .map(|action_id| ScenarioTraceCommand::Dispatch {
                action_id: action_id.clone(),
            })
            .collect::<Vec<_>>();
        self.run_commands(&commands, require_outcome)
    }

    /// Executes a mixed deterministic sequence of action and time commands.
    pub fn run_commands(
        mut self,
        commands: &[ScenarioTraceCommand],
        require_outcome: bool,
    ) -> Result<SimulationResult, SimulationError> {
        self.process_due_events()?;

        for command in commands {
            match command {
                ScenarioTraceCommand::Dispatch { action_id } => self.apply_action(action_id)?,
                ScenarioTraceCommand::AdvanceTime { minutes } => self.advance_time(*minutes)?,
            }
        }

        self.finish(require_outcome)
    }

    fn finish(self, require_outcome: bool) -> Result<SimulationResult, SimulationError> {
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
            deadline_statuses: self
                .runtime
                .deadline_statuses
                .into_iter()
                .map(|(id, status)| (id, status.map(|value| format!("{value:?}").to_lowercase())))
                .collect(),
            async_task_statuses: self
                .runtime
                .task_statuses
                .into_iter()
                .map(|(id, status)| (id, format!("{status:?}").to_lowercase()))
                .collect(),
            trace: self.trace,
        })
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
        let (completion_target, selected_advance_deadline) =
            self.action_completion_target(&action)?;
        self.ensure_action_finishes_by_deadline(
            &action,
            completion_target,
            selected_advance_deadline.as_deref(),
        )?;
        self.precomplete_action_deadlines(&action);

        let before = self.state.clone();
        let previous_anchor = self.effect_time_anchor.replace(completion_target);
        let effect_result = self.apply_effects(&action.effects, &format!("action `{action_id}`"));
        self.effect_time_anchor = previous_anchor;
        let mut queued_events = effect_result?;
        if !self.definition.initial_resources.is_empty() {
            self.add_resource(RESOURCE_SPEND_EUR, i64::from(action.cost_eur))?;
            self.add_resource(
                RESOURCE_BILLABLE_MINUTES,
                i64::from(action.billable_minutes),
            )?;
        }
        *self
            .runtime
            .action_uses
            .entry(action_id.to_owned())
            .or_default() += 1;
        for event in &self.definition.events {
            if matches!(
                &event.trigger,
                EventTrigger::AfterAction { action } if action.as_str() == action_id
            ) {
                queued_events.push_back(event.id.as_str().to_owned());
            }
        }
        self.advance_clock_to_with_deadline_completion(
            completion_target,
            queued_events,
            false,
            selected_advance_deadline.as_deref(),
        )?;

        self.trace.push(TraceEntry {
            sequence: self.trace.len(),
            kind: TraceKind::Action,
            id: action_id.to_owned(),
            state_before: before,
            state_after: self.state.clone(),
        });
        Ok(())
    }

    fn action_completion_target(
        &self,
        action: &ActionDefinition,
    ) -> Result<(u64, Option<String>), SimulationError> {
        let now = self.state.clock_minutes;
        let mut target = now
            .checked_add(u64::from(action.time_cost_minutes))
            .ok_or_else(|| SimulationError::ClockOverflow {
                owner: action.id.as_str().to_owned(),
            })?;
        if let Some(timing) = &action.completion_timing {
            target = target.max(self.resolve_timing_at(now, timing)?);
        }
        let selected_advance = if action.advance_to_deadlines.is_empty() {
            None
        } else {
            let (deadline, due) = self
                .select_open_deadline(&action.advance_to_deadlines)
                .ok_or_else(|| SimulationError::DeadlineInactive {
                    deadline: action.advance_to_deadlines[0].as_str().to_owned(),
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
    ) -> Result<(), SimulationError> {
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
                    .runtime
                    .deadline_due_minutes
                    .get(deadline_id)
                    .expect("open deadline must have a stored due minute");
                self.ensure_completion_is_timely(action, deadline, completion, due)?;
            }
        }
        if action.completion_deadlines.is_empty() {
            return Ok(());
        }
        let (deadline_id, stored_due) = self
            .select_open_deadline(&action.completion_deadlines)
            .ok_or_else(|| SimulationError::DeadlineInactive {
                deadline: action.completion_deadlines[0].as_str().to_owned(),
            })?;
        let due = add_signed_minutes(stored_due, action.completion_deadline_offset_minutes)
            .ok_or_else(|| SimulationError::ClockOverflow {
                owner: action.id.as_str().to_owned(),
            })?;
        let deadline = self
            .definition
            .deadlines
            .iter()
            .find(|deadline| deadline.id.as_str() == deadline_id)
            .expect("validated completion deadline must exist");
        self.ensure_completion_is_timely(action, deadline, completion, due)
    }

    fn ensure_completion_is_timely(
        &self,
        action: &ActionDefinition,
        deadline: &juris_scenario_schema::DeadlineDefinition,
        completion: u64,
        due: u64,
    ) -> Result<(), SimulationError> {
        let late = if deadline.completion_at_due_allowed {
            completion > due
        } else {
            completion >= due
        };
        if late {
            return Err(SimulationError::ActionCompletionDeadlineExceeded {
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
                    .runtime
                    .deadline_statuses
                    .get(id.as_str())
                    .copied()
                    .flatten()
                    == Some(DeadlineStatus::Open))
                .then(|| {
                    self.runtime
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
                self.runtime
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
            self.runtime
                .deadline_statuses
                .insert(deadline_id, Some(DeadlineStatus::Completed));
        }
    }

    fn resolve_timing_at(
        &self,
        now: u64,
        timing: &RelativeTimeDefinition,
    ) -> Result<u64, SimulationError> {
        let anchor = match &timing.relative_to_deadline {
            Some(id) => self
                .runtime
                .deadline_due_minutes
                .get(id.as_str())
                .copied()
                .ok_or_else(|| SimulationError::DeadlineInactive {
                    deadline: id.as_str().to_owned(),
                })?,
            None => now,
        };
        let calendar_baseline = self
            .definition
            .initial_clock
            .map(scenario_time_minutes)
            .unwrap_or(0);
        resolve_forward_time(now, timing, anchor, calendar_baseline)
    }

    fn advance_time(&mut self, minutes: u32) -> Result<(), SimulationError> {
        if self.is_terminal_stage(&self.state.stage) || self.state.resolved_outcome.is_some() {
            return Err(SimulationError::ActionAfterTerminal {
                action: "advance_time".to_owned(),
                stage: self.state.stage.clone(),
            });
        }
        if self.definition.clock.mode != ScenarioClockMode::Foreground {
            return Err(SimulationError::ClockAdvanceUnsupported);
        }
        if minutes == 0 {
            return Err(SimulationError::InvalidClockAdvance);
        }
        if minutes > MAX_FOREGROUND_ADVANCE_MINUTES {
            return Err(SimulationError::ClockAdvanceLimitExceeded {
                requested: minutes,
                maximum: MAX_FOREGROUND_ADVANCE_MINUTES,
            });
        }

        let before = self.state.clone();
        self.advance_clock_by(minutes, VecDeque::new(), "advance_time", true)?;
        self.trace.push(TraceEntry {
            sequence: self.trace.len(),
            kind: TraceKind::AdvanceTime,
            id: minutes.to_string(),
            state_before: before,
            state_after: self.state.clone(),
        });
        Ok(())
    }

    fn advance_clock_by(
        &mut self,
        minutes: u32,
        final_events: VecDeque<String>,
        owner: &str,
        apply_foreground_metric_rates: bool,
    ) -> Result<(), SimulationError> {
        let target = self
            .state
            .clock_minutes
            .checked_add(u64::from(minutes))
            .ok_or_else(|| SimulationError::ClockOverflow {
                owner: owner.to_owned(),
            })?;
        self.advance_clock_to(target, final_events, apply_foreground_metric_rates)
    }

    fn advance_clock_to(
        &mut self,
        target: u64,
        final_events: VecDeque<String>,
        apply_foreground_metric_rates: bool,
    ) -> Result<(), SimulationError> {
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
    ) -> Result<(), SimulationError> {
        if target < self.state.clock_minutes {
            return Err(SimulationError::ClockOverflow {
                owner: "advance_clock_to".to_owned(),
            });
        }

        if self.is_terminal_stage(&self.state.stage) || self.state.resolved_outcome.is_some() {
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
            self.queue_due_events(&mut due_events)?;
            self.process_event_queue(due_events)?;
            if self.is_terminal_stage(&self.state.stage) || self.state.resolved_outcome.is_some() {
                return Ok(());
            }
            if apply_foreground_metric_rates {
                let mut metric_events = VecDeque::new();
                self.queue_crossed_metric_events(&previous_metrics, &mut metric_events);
                self.process_event_queue(metric_events)?;
                if self.is_terminal_stage(&self.state.stage)
                    || self.state.resolved_outcome.is_some()
                {
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
                .runtime
                .deadline_statuses
                .get(deadline_id)
                .copied()
                .flatten()
                == Some(DeadlineStatus::Open)
            {
                self.runtime
                    .deadline_statuses
                    .insert(deadline_id.to_owned(), Some(DeadlineStatus::Completed));
            }
        }
        let mut events = final_events;
        self.queue_due_events(&mut events)?;
        self.process_event_queue(events)?;
        if self.is_terminal_stage(&self.state.stage)
            || self.state.resolved_outcome.is_some()
            || !apply_foreground_metric_rates
        {
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
            if self.fired_events.contains(event.id.as_str()) {
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
            .runtime
            .task_due_minutes
            .iter()
            .filter_map(|(task_id, due)| {
                (self.runtime.task_statuses.get(task_id) == Some(&AsyncTaskStatus::InProgress))
                    .then_some(*due)
            });
        let deadlines = self.definition.deadlines.iter().filter_map(|deadline| {
            (self
                .runtime
                .deadline_statuses
                .get(deadline.id.as_str())
                .copied()
                .flatten()
                == Some(DeadlineStatus::Open))
            .then(|| self.deadline_miss_boundary(deadline))
            .flatten()
        });
        let metric_thresholds = self.definition.events.iter().filter_map(|event| {
            if !include_foreground_metric_thresholds
                || (self.fired_events.contains(event.id.as_str()) && !event.repeatable)
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

    fn deadline_miss_boundary(
        &self,
        deadline: &juris_scenario_schema::DeadlineDefinition,
    ) -> Option<u64> {
        let due = self
            .runtime
            .deadline_due_minutes
            .get(deadline.id.as_str())
            .copied()?;
        Some(deadline_miss_boundary(deadline, due))
    }

    fn increment_foreground_metrics(
        &mut self,
        elapsed_minutes: u64,
    ) -> Result<(), SimulationError> {
        let elapsed =
            i64::try_from(elapsed_minutes).map_err(|_| SimulationError::ClockOverflow {
                owner: "foreground_metrics".to_owned(),
            })?;
        let increments = self
            .definition
            .foreground_metric_rates
            .iter()
            .map(|(metric, rate)| {
                rate.checked_mul(elapsed)
                    .map(|amount| (metric.as_str().to_owned(), amount))
                    .ok_or_else(|| SimulationError::IntegerOverflow {
                        state: metric.as_str().to_owned(),
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
            if self.fired_events.contains(event.id.as_str()) && !event.repeatable {
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
        let mut processed_repeatable = BTreeSet::new();
        while let Some(event_id) = queue.pop_front() {
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
            if event.repeatable {
                if !processed_repeatable.insert(event_id.clone()) {
                    continue;
                }
            } else if self.fired_events.contains(&event_id) {
                continue;
            }
            if !self.evaluate_condition(&event.condition) {
                continue;
            }

            if !event.repeatable {
                self.fired_events.insert(event_id.clone());
            }
            let before = self.state.clone();
            let mut nested = self.activate_event_owned_state(&event)?;
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
                Effect::SetMetric { metric, value } => {
                    self.set_metric(metric.as_str(), *value)?;
                }
                Effect::AddMetric { metric, amount } => {
                    self.add_metric(metric.as_str(), *amount)?;
                }
                Effect::SubtractMetric { metric, amount } => {
                    let delta =
                        amount
                            .checked_neg()
                            .ok_or_else(|| SimulationError::IntegerOverflow {
                                state: metric.as_str().to_owned(),
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
                        .ok_or_else(|| SimulationError::UnknownIntegerState {
                            state: metric.as_str().to_owned(),
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
                    let delta =
                        amount
                            .checked_neg()
                            .ok_or_else(|| SimulationError::IntegerOverflow {
                                state: resource.as_str().to_owned(),
                            })?;
                    self.add_resource(resource.as_str(), delta)?;
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
                        let timing_anchor =
                            self.effect_time_anchor.unwrap_or(self.state.clock_minutes);
                        let due = timing_anchor
                            .checked_add(u64::from(definition.duration_minutes))
                            .ok_or_else(|| SimulationError::ClockOverflow {
                                owner: task.as_str().to_owned(),
                            })?;
                        let due = match &definition.completion_timing {
                            Some(timing) => due.max(self.resolve_timing_at(timing_anchor, timing)?),
                            None => due,
                        };
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
                    self.runtime.resolved_inbox.remove(item.as_str());
                }
                Effect::ResolveInboxItem { item } => {
                    self.runtime.resolved_inbox.insert(item.as_str().to_owned());
                }
                Effect::SetJudicialResult { result } => {
                    let current_stage = self
                        .definition
                        .stages
                        .iter()
                        .find(|stage| stage.id.as_str() == self.state.stage)
                        .expect("validated current stage must exist");
                    self.state.judicial_result = Some(*result);
                    self.state.judicial_decision_instance =
                        Some(JudicialDecisionInstance::from_stage(
                            current_stage.kind,
                            self.state.judicial_decision_instance,
                        ));
                }
                Effect::ResolveDeterministicDecision { decision } => {
                    let mut decision_events =
                        self.resolve_deterministic_decision(decision.as_str())?;
                    events.append(&mut decision_events);
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

    fn set_metric(&mut self, id: &str, value: i64) -> Result<(), SimulationError> {
        let metric = self.state.numeric_metrics.get_mut(id).ok_or_else(|| {
            SimulationError::UnknownIntegerState {
                state: id.to_owned(),
            }
        })?;
        *metric = value;
        Ok(())
    }

    fn add_metric(&mut self, id: &str, amount: i64) -> Result<(), SimulationError> {
        let metric = self.state.numeric_metrics.get_mut(id).ok_or_else(|| {
            SimulationError::UnknownIntegerState {
                state: id.to_owned(),
            }
        })?;
        *metric = metric
            .checked_add(amount)
            .ok_or_else(|| SimulationError::IntegerOverflow {
                state: id.to_owned(),
            })?;
        Ok(())
    }

    fn set_resource(&mut self, id: &str, value: i64) -> Result<(), SimulationError> {
        let resource = self.state.resources.get_mut(id).ok_or_else(|| {
            SimulationError::UnknownIntegerState {
                state: id.to_owned(),
            }
        })?;
        *resource = value;
        Ok(())
    }

    fn add_resource(&mut self, id: &str, amount: i64) -> Result<(), SimulationError> {
        let resource = self.state.resources.get_mut(id).ok_or_else(|| {
            SimulationError::UnknownIntegerState {
                state: id.to_owned(),
            }
        })?;
        *resource =
            resource
                .checked_add(amount)
                .ok_or_else(|| SimulationError::IntegerOverflow {
                    state: id.to_owned(),
                })?;
        Ok(())
    }

    fn resolve_deterministic_decision(
        &mut self,
        id: &str,
    ) -> Result<VecDeque<String>, SimulationError> {
        let decision = self
            .definition
            .deterministic_decisions
            .iter()
            .find(|decision| decision.id.as_str() == id)
            .cloned()
            .ok_or_else(|| SimulationError::UnknownDecision {
                decision: id.to_owned(),
            })?;
        if decision.roll_range == 0 {
            return Err(SimulationError::NoEligibleDecisionBranch {
                decision: id.to_owned(),
            });
        }

        let occurrence = self
            .runtime
            .decision_resolutions
            .get(id)
            .map_or(0_u64, |items| items.len() as u64);
        let fingerprint = scenario_fingerprint(&self.definition).map_err(|message| {
            SimulationError::DecisionResolution {
                decision: id.to_owned(),
                message,
            }
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
            .ok_or_else(|| SimulationError::IntegerOverflow {
                state: id.to_owned(),
            })?;

        let mut score_sum = match &decision.score_metric {
            Some(metric) => self
                .state
                .numeric_metrics
                .get(metric.as_str())
                .copied()
                .ok_or_else(|| SimulationError::UnknownIntegerState {
                    state: metric.as_str().to_owned(),
                })?,
            None => 0,
        };
        for term in &decision.score_terms {
            if !self.evaluate_condition(&term.condition) {
                continue;
            }
            let value = self.integer_operand_value(&term.operand).ok_or_else(|| {
                SimulationError::DecisionResolution {
                    decision: id.to_owned(),
                    message: "score term references missing or overflowing integer state"
                        .to_owned(),
                }
            })?;
            let value = term.minimum.map_or(value, |minimum| value.max(minimum));
            let value = term.maximum.map_or(value, |maximum| value.min(maximum));
            let contribution = value.checked_mul(term.multiplier).ok_or_else(|| {
                SimulationError::IntegerOverflow {
                    state: id.to_owned(),
                }
            })?;
            score_sum = score_sum.checked_add(contribution).ok_or_else(|| {
                SimulationError::IntegerOverflow {
                    state: id.to_owned(),
                }
            })?;
        }
        if decision.score_divisor <= 0 {
            return Err(SimulationError::DecisionResolution {
                decision: id.to_owned(),
                message: "score divisor must be positive".to_owned(),
            });
        }
        let score = score_sum
            .checked_add(decision.score_offset)
            .and_then(|score| score.checked_div(decision.score_divisor))
            .ok_or_else(|| SimulationError::IntegerOverflow {
                state: id.to_owned(),
            })?;
        let total = roll
            .checked_mul(decision.roll_multiplier)
            .and_then(|roll| roll.checked_add(score))
            .ok_or_else(|| SimulationError::IntegerOverflow {
                state: id.to_owned(),
            })?;
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
            .ok_or_else(|| SimulationError::NoEligibleDecisionBranch {
                decision: id.to_owned(),
            })?;

        self.runtime
            .decision_resolutions
            .entry(id.to_owned())
            .or_default()
            .push(branch.id.as_str().to_owned());
        self.apply_effects(&branch.effects, &format!("decision `{id}`"))
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

    fn activate_event_owned_state(
        &mut self,
        event: &EventDefinition,
    ) -> Result<VecDeque<String>, SimulationError> {
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
        Ok(events)
    }

    fn activate_deadline(&mut self, id: &str) -> Result<(), SimulationError> {
        let deadline = self
            .definition
            .deadlines
            .iter()
            .find(|deadline| deadline.id.as_str() == id)
            .cloned()
            .ok_or_else(|| SimulationError::DeadlineInactive {
                deadline: id.to_owned(),
            })?;
        let due = match &deadline.relative_due {
            Some(timing) => self.resolve_timing_at(
                self.effect_time_anchor.unwrap_or(self.state.clock_minutes),
                timing,
            )?,
            None => self
                .runtime
                .deadline_due_minutes
                .get(id)
                .copied()
                .or_else(|| {
                    authored_time_to_elapsed(deadline.due_at, self.definition.initial_clock)
                })
                .ok_or_else(|| SimulationError::ClockOverflow {
                    owner: id.to_owned(),
                })?,
        };
        self.runtime.deadline_due_minutes.insert(id.to_owned(), due);
        self.runtime
            .deadline_statuses
            .insert(id.to_owned(), Some(DeadlineStatus::Open));
        Ok(())
    }

    fn queue_due_events(&mut self, events: &mut VecDeque<String>) -> Result<(), SimulationError> {
        for event in &self.definition.events {
            if self.fired_events.contains(event.id.as_str()) {
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
                self.deadline_miss_boundary(deadline)
                    .is_some_and(|boundary| boundary <= self.state.clock_minutes)
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

fn authored_time_to_elapsed(
    time: juris_scenario_schema::ScenarioTime,
    initial_clock: Option<juris_scenario_schema::ScenarioTime>,
) -> Option<u64> {
    scenario_time_minutes(time).checked_sub(initial_clock.map(scenario_time_minutes).unwrap_or(0))
}

fn resolve_forward_time(
    now: u64,
    timing: &RelativeTimeDefinition,
    anchor: u64,
    calendar_baseline: u64,
) -> Result<u64, SimulationError> {
    let offset = anchor
        .checked_add(u64::from(timing.offset_minutes))
        .ok_or_else(|| SimulationError::ClockOverflow {
            owner: "relative_time".to_owned(),
        })?;
    let turnaround = now
        .checked_add(u64::from(timing.minimum_turnaround_minutes))
        .ok_or_else(|| SimulationError::ClockOverflow {
            owner: "relative_time".to_owned(),
        })?;
    let mut target = now.max(offset).max(turnaround);

    if let Some(calendar) = timing.calendar_target {
        let anchor_civil = calendar_baseline.checked_add(anchor).ok_or_else(|| {
            SimulationError::ClockOverflow {
                owner: "calendar_target".to_owned(),
            }
        })?;
        let target_day = anchor_civil
            .checked_div(1_440)
            .and_then(|day| day.checked_add(u64::from(calendar.day_offset)))
            .ok_or_else(|| SimulationError::ClockOverflow {
                owner: "calendar_target".to_owned(),
            })?;
        let target_civil = target_day
            .checked_mul(1_440)
            .and_then(|day| day.checked_add(u64::from(calendar.minute_of_day)))
            .ok_or_else(|| SimulationError::ClockOverflow {
                owner: "calendar_target".to_owned(),
            })?;
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
) -> Result<u64, SimulationError> {
    if let Some(due) = due_minutes.get(deadline_id).copied() {
        return Ok(due);
    }
    if !visiting.insert(deadline_id.to_owned()) {
        return Err(SimulationError::DeadlineInactive {
            deadline: deadline_id.to_owned(),
        });
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

fn scenario_fingerprint(definition: &ScenarioDefinition) -> Result<String, String> {
    let value = serde_json::to_value(definition).map_err(|error| error.to_string())?;
    let mut canonical = String::new();
    write_canonical_json(&value, &mut canonical)?;
    let digest = Sha256::digest(canonical.as_bytes());
    Ok(digest.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn write_canonical_json(value: &Value, output: &mut String) -> Result<(), String> {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {
            output.push_str(&serde_json::to_string(value).map_err(|error| error.to_string())?);
        }
        Value::Array(values) => {
            output.push('[');
            for (index, value) in values.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                write_canonical_json(value, output)?;
            }
            output.push(']');
        }
        Value::Object(values) => {
            output.push('{');
            let mut entries = values.iter().collect::<Vec<_>>();
            entries.sort_unstable_by_key(|(key, _)| *key);
            for (index, (key, value)) in entries.into_iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                output.push_str(&serde_json::to_string(key).map_err(|error| error.to_string())?);
                output.push(':');
                write_canonical_json(value, output)?;
            }
            output.push('}');
        }
    }
    Ok(())
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
    for (decision_index, decision) in root
        .get("deterministic_decisions")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .enumerate()
    {
        for (term_index, term) in decision
            .get("score_terms")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .enumerate()
        {
            if let Some(condition) = term.get("condition") {
                validate_condition_shape(
                    condition,
                    &format!(
                        "deterministic_decisions[{decision_index}].score_terms[{term_index}].condition"
                    ),
                )?;
            }
        }
        for (branch_index, branch) in decision
            .get("branches")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .enumerate()
        {
            if let Some(condition) = branch.get("condition") {
                validate_condition_shape(
                    condition,
                    &format!(
                        "deterministic_decisions[{decision_index}].branches[{branch_index}].condition"
                    ),
                )?;
            }
            for (effect_index, effect) in branch
                .get("effects")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .enumerate()
            {
                validate_effect_shape(
                    effect,
                    format!(
                        "deterministic_decisions[{decision_index}].branches[{branch_index}].effects[{effect_index}]"
                    ),
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
                validate_effect_shape(
                    effect,
                    format!("{collection}[{item_index}].effects[{effect_index}]"),
                )?;
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
                    | "metric_threshold_reached"
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

fn validate_effect_shape(effect: &Value, path: String) -> Result<(), SimulationError> {
    let effect_type = effect
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if matches!(
        effect_type,
        "set_stage"
            | "set_flag"
            | "set_metric"
            | "add_metric"
            | "subtract_metric"
            | "clamp_metric"
            | "set_resource"
            | "add_resource"
            | "subtract_resource"
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
            | "resolve_deterministic_decision"
            | "trigger_event"
            | "resolve_outcome"
    ) {
        Ok(())
    } else {
        Err(SimulationError::UnsupportedEffect {
            effect_type: effect_type.to_owned(),
            path,
        })
    }
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
        | "inbox_item_resolved"
        | "integer_compare" => Ok(()),
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
