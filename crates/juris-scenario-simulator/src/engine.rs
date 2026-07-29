use std::collections::{BTreeMap, BTreeSet, VecDeque};

use serde_json::Value;

use crate::{
    document::{optional_string, required_string},
    ScenarioDocument, SimulationError, SimulationResult, SimulationState, SimulationStatus,
    TraceEntry, TraceKind,
};

const DEFAULT_MAX_AUTO_EVENTS: usize = 256;

/// Deterministic path simulator over one canonical scenario document.
#[derive(Clone, Debug)]
pub struct ScenarioSimulator {
    document: ScenarioDocument,
    state: SimulationState,
    fired_events: BTreeSet<String>,
    trace: Vec<TraceEntry>,
    max_auto_events: usize,
}

impl ScenarioSimulator {
    /// Creates a simulator at the initial stage and minute zero.
    pub fn new(document: ScenarioDocument) -> Result<Self, SimulationError> {
        let initial_stage = document.initial_stage().to_owned();
        if document.stage(&initial_stage)?.is_none() {
            return Err(SimulationError::UnknownStage {
                stage: initial_stage,
            });
        }

        Ok(Self {
            document,
            state: SimulationState {
                stage: initial_stage,
                clock_minutes: 0,
                flags: BTreeMap::new(),
                resolved_outcome: None,
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
        mut self,
        actions: &[String],
        require_outcome: bool,
    ) -> Result<SimulationResult, SimulationError> {
        self.process_due_time_events()?;

        for action in actions {
            self.apply_action(action)?;
        }

        if self.is_terminal_stage(&self.state.stage)? && self.state.resolved_outcome.is_none() {
            return Err(SimulationError::TerminalWithoutOutcome {
                stage: self.state.stage.clone(),
            });
        }

        if require_outcome && self.state.resolved_outcome.is_none() {
            return Err(SimulationError::OutcomeRequired);
        }

        let status = if self.state.resolved_outcome.is_some() {
            SimulationStatus::Completed
        } else {
            SimulationStatus::InProgress
        };

        Ok(SimulationResult {
            scenario_id: self.document.scenario_id().to_owned(),
            status,
            final_state: self.state,
            fired_events: self.fired_events.into_iter().collect(),
            trace: self.trace,
        })
    }

    fn apply_action(&mut self, action_id: &str) -> Result<(), SimulationError> {
        if self.is_terminal_stage(&self.state.stage)? {
            return Err(SimulationError::ActionAfterTerminal {
                action: action_id.to_owned(),
                stage: self.state.stage.clone(),
            });
        }

        let action = self.document.action(action_id)?.cloned().ok_or_else(|| {
            SimulationError::UnknownAction {
                action: action_id.to_owned(),
            }
        })?;

        self.ensure_action_allowed_by_stage(action_id)?;
        if !self
            .evaluate_optional_condition(action.get("available_when"), "action.available_when")?
        {
            return Err(SimulationError::ActionUnavailable {
                action: action_id.to_owned(),
            });
        }

        let before = self.state.clone();
        let effects = action
            .get("effects")
            .and_then(Value::as_array)
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        let mut queued_events = self.apply_effects(
            effects,
            &format!("action `{action_id}`"),
            &format!("actions[{action_id}].effects"),
        )?;

        let time_cost = action
            .get("time_cost_minutes")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        self.state.clock_minutes =
            self.state
                .clock_minutes
                .checked_add(time_cost)
                .ok_or_else(|| SimulationError::ClockOverflow {
                    owner: action_id.to_owned(),
                })?;

        for event in self.document.events()? {
            let Some(event_id) = optional_string(event, "id") else {
                continue;
            };
            if self.after_action_matches(event, action_id)? {
                queued_events.push_back(event_id.to_owned());
            }
        }
        self.queue_due_time_events(&mut queued_events)?;

        self.trace.push(TraceEntry {
            sequence: self.trace.len(),
            kind: TraceKind::Action,
            id: action_id.to_owned(),
            state_before: before,
            state_after: self.state.clone(),
        });

        self.process_event_queue(queued_events)
    }

    fn process_due_time_events(&mut self) -> Result<(), SimulationError> {
        let mut queue = VecDeque::new();
        self.queue_due_time_events(&mut queue)?;
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

            let event = self.document.event(&event_id)?.cloned().ok_or_else(|| {
                SimulationError::UnknownEvent {
                    event: event_id.clone(),
                }
            })?;
            self.fired_events.insert(event_id.clone());

            let before = self.state.clone();
            let effects = event
                .get("effects")
                .and_then(Value::as_array)
                .map(Vec::as_slice)
                .unwrap_or(&[]);
            let mut nested = self.apply_effects(
                effects,
                &format!("event `{event_id}`"),
                &format!("events[{event_id}].effects"),
            )?;
            self.queue_due_time_events(&mut nested)?;
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
        effects: &[Value],
        owner: &str,
        base_path: &str,
    ) -> Result<VecDeque<String>, SimulationError> {
        let mut outcomes = Vec::new();
        let mut events = VecDeque::new();

        for (index, effect) in effects.iter().enumerate() {
            let path = format!("{base_path}[{index}]");
            let effect_type = required_effect_string(effect, "type", &path)?;

            match effect_type.as_str() {
                "set_stage" => {
                    let stage = required_effect_string(effect, "stage", &path)?;
                    if self.document.stage(&stage)?.is_none() {
                        return Err(SimulationError::UnknownStage { stage });
                    }
                    self.state.stage = stage;
                }
                "set_flag" => {
                    let flag = required_effect_string(effect, "flag", &path)?;
                    let Some(value) = effect.get("value").and_then(Value::as_bool) else {
                        return Err(SimulationError::InvalidEffect {
                            path,
                            field: "value".to_owned(),
                        });
                    };
                    self.state.flags.insert(flag, value);
                }
                "trigger_event" => {
                    let event = required_effect_string(effect, "event", &path)?;
                    if self.document.event(&event)?.is_none() {
                        return Err(SimulationError::UnknownEvent { event });
                    }
                    events.push_back(event);
                }
                "resolve_outcome" => {
                    outcomes.push(required_effect_string(effect, "outcome", &path)?);
                }
                other => {
                    return Err(SimulationError::UnsupportedEffect {
                        effect_type: other.to_owned(),
                        path,
                    });
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

        let outcome = self.document.outcome(outcome_id)?.cloned().ok_or_else(|| {
            SimulationError::UnknownOutcome {
                outcome: outcome_id.to_owned(),
            }
        })?;
        let expected_stage = required_string(&outcome, "terminal_stage")?;
        if expected_stage != self.state.stage {
            return Err(SimulationError::OutcomeStageMismatch {
                outcome: outcome_id.to_owned(),
                expected: expected_stage,
                actual: self.state.stage.clone(),
            });
        }

        if !self.evaluate_optional_condition(
            outcome.get("condition"),
            &format!("outcomes[{outcome_id}].condition"),
        )? {
            return Err(SimulationError::OutcomeConditionFalse {
                outcome: outcome_id.to_owned(),
            });
        }

        self.state.resolved_outcome = Some(outcome_id.to_owned());
        Ok(())
    }

    fn ensure_action_allowed_by_stage(&self, action_id: &str) -> Result<(), SimulationError> {
        let stage = self.document.stage(&self.state.stage)?.ok_or_else(|| {
            SimulationError::UnknownStage {
                stage: self.state.stage.clone(),
            }
        })?;

        let Some(exit_actions) = stage.get("exit_actions") else {
            return Ok(());
        };
        let Some(exit_actions) = exit_actions.as_array() else {
            return Err(SimulationError::WrongFieldType {
                field: format!("stage {}.exit_actions", self.state.stage),
                expected: "array",
            });
        };

        let allowed = exit_actions
            .iter()
            .filter_map(Value::as_str)
            .any(|candidate| candidate == action_id);
        if allowed {
            Ok(())
        } else {
            Err(SimulationError::ActionNotAllowedByStage {
                action: action_id.to_owned(),
                stage: self.state.stage.clone(),
            })
        }
    }

    fn queue_due_time_events(&self, queue: &mut VecDeque<String>) -> Result<(), SimulationError> {
        for event in self.document.events()? {
            let Some(event_id) = optional_string(event, "id") else {
                continue;
            };
            if self.fired_events.contains(event_id) {
                continue;
            }

            let Some(trigger) = event.get("trigger") else {
                continue;
            };
            let Some(trigger_type) = trigger.get("type").and_then(Value::as_str) else {
                return Err(SimulationError::InvalidEventTrigger {
                    path: format!("events[{event_id}].trigger"),
                    field: "type".to_owned(),
                });
            };

            match trigger_type {
                "at_time" => {
                    let at =
                        trigger
                            .get("at")
                            .ok_or_else(|| SimulationError::InvalidEventTrigger {
                                path: format!("events[{event_id}].trigger"),
                                field: "at".to_owned(),
                            })?;
                    let day = at.get("day").and_then(Value::as_u64).ok_or_else(|| {
                        SimulationError::InvalidEventTrigger {
                            path: format!("events[{event_id}].trigger.at"),
                            field: "day".to_owned(),
                        }
                    })?;
                    let minute =
                        at.get("minute_of_day")
                            .and_then(Value::as_u64)
                            .ok_or_else(|| SimulationError::InvalidEventTrigger {
                                path: format!("events[{event_id}].trigger.at"),
                                field: "minute_of_day".to_owned(),
                            })?;
                    let due = day
                        .checked_mul(1_440)
                        .and_then(|value| value.checked_add(minute))
                        .ok_or_else(|| SimulationError::ClockOverflow {
                            owner: event_id.to_owned(),
                        })?;
                    if due <= self.state.clock_minutes {
                        queue.push_back(event_id.to_owned());
                    }
                }
                "after_action" | "deadline_missed" => {}
                other => {
                    return Err(SimulationError::UnsupportedEventTrigger {
                        trigger_type: other.to_owned(),
                        path: format!("events[{event_id}].trigger"),
                    });
                }
            }
        }
        Ok(())
    }

    fn after_action_matches(
        &self,
        event: &Value,
        action_id: &str,
    ) -> Result<bool, SimulationError> {
        let event_id = optional_string(event, "id").unwrap_or("<unknown>");
        let Some(trigger) = event.get("trigger") else {
            return Ok(false);
        };
        let Some(trigger_type) = trigger.get("type").and_then(Value::as_str) else {
            return Err(SimulationError::InvalidEventTrigger {
                path: format!("events[{event_id}].trigger"),
                field: "type".to_owned(),
            });
        };

        match trigger_type {
            "after_action" => {
                let Some(action) = trigger.get("action").and_then(Value::as_str) else {
                    return Err(SimulationError::InvalidEventTrigger {
                        path: format!("events[{event_id}].trigger"),
                        field: "action".to_owned(),
                    });
                };
                Ok(action == action_id)
            }
            "at_time" | "deadline_missed" => Ok(false),
            other => Err(SimulationError::UnsupportedEventTrigger {
                trigger_type: other.to_owned(),
                path: format!("events[{event_id}].trigger"),
            }),
        }
    }

    fn evaluate_optional_condition(
        &self,
        condition: Option<&Value>,
        path: &str,
    ) -> Result<bool, SimulationError> {
        match condition {
            Some(condition) => self.evaluate_condition(condition, path),
            None => Ok(true),
        }
    }

    fn evaluate_condition(&self, condition: &Value, path: &str) -> Result<bool, SimulationError> {
        let Some(condition_type) = condition.get("type").and_then(Value::as_str) else {
            return Err(SimulationError::InvalidCondition {
                path: path.to_owned(),
                field: "type".to_owned(),
            });
        };

        match condition_type {
            "always" => Ok(true),
            "stage_is" => {
                let stage = required_condition_string(condition, "stage", path)?;
                Ok(self.state.stage == stage)
            }
            "flag_equals" => {
                let flag = required_condition_string(condition, "flag", path)?;
                let Some(expected) = condition.get("value").and_then(Value::as_bool) else {
                    return Err(SimulationError::InvalidCondition {
                        path: path.to_owned(),
                        field: "value".to_owned(),
                    });
                };
                Ok(self.state.flags.get(&flag).copied().unwrap_or(false) == expected)
            }
            "all" => {
                let conditions = required_condition_array(condition, path)?;
                for (index, child) in conditions.iter().enumerate() {
                    if !self.evaluate_condition(child, &format!("{path}.conditions[{index}]"))? {
                        return Ok(false);
                    }
                }
                Ok(true)
            }
            "any" => {
                let conditions = required_condition_array(condition, path)?;
                for (index, child) in conditions.iter().enumerate() {
                    if self.evaluate_condition(child, &format!("{path}.conditions[{index}]"))? {
                        return Ok(true);
                    }
                }
                Ok(false)
            }
            "not" => {
                let child = condition.get("condition").ok_or_else(|| {
                    SimulationError::InvalidCondition {
                        path: path.to_owned(),
                        field: "condition".to_owned(),
                    }
                })?;
                Ok(!self.evaluate_condition(child, &format!("{path}.condition"))?)
            }
            other => Err(SimulationError::UnsupportedCondition {
                condition_type: other.to_owned(),
                path: path.to_owned(),
            }),
        }
    }

    fn is_terminal_stage(&self, stage_id: &str) -> Result<bool, SimulationError> {
        let stage =
            self.document
                .stage(stage_id)?
                .ok_or_else(|| SimulationError::UnknownStage {
                    stage: stage_id.to_owned(),
                })?;

        Ok(stage
            .get("terminal")
            .and_then(Value::as_bool)
            .unwrap_or(false)
            || optional_string(stage, "kind") == Some("resolved"))
    }
}

fn required_effect_string(
    value: &Value,
    field: &str,
    path: &str,
) -> Result<String, SimulationError> {
    value
        .get(field)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| SimulationError::InvalidEffect {
            path: path.to_owned(),
            field: field.to_owned(),
        })
}

fn required_condition_string(
    value: &Value,
    field: &str,
    path: &str,
) -> Result<String, SimulationError> {
    value
        .get(field)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| SimulationError::InvalidCondition {
            path: path.to_owned(),
            field: field.to_owned(),
        })
}

fn required_condition_array<'a>(
    value: &'a Value,
    path: &str,
) -> Result<&'a [Value], SimulationError> {
    let Some(conditions) = value.get("conditions") else {
        return Err(SimulationError::InvalidCondition {
            path: path.to_owned(),
            field: "conditions".to_owned(),
        });
    };
    let Some(conditions) = conditions.as_array() else {
        return Err(SimulationError::InvalidCondition {
            path: path.to_owned(),
            field: "conditions".to_owned(),
        });
    };
    Ok(conditions)
}
