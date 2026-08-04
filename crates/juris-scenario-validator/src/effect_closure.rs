//! Cycle-safe traversal of deterministic effect routers.
//!
//! Scenario validation often needs to answer whether an effect is reachable
//! through a declarative transition. A transition may route through an
//! explicitly triggered event and through every possible branch of a
//! deterministic decision. This helper keeps those analyses consistent while
//! treating invalid event or decision cycles defensively.

use std::collections::HashSet;

use juris_scenario_schema::{Effect, EventTrigger, ScenarioDefinition};

/// Conservative closure of effects reachable from one or more roots.
pub(crate) struct EffectClosure<'a> {
    scenario: &'a ScenarioDefinition,
    effects: Vec<&'a Effect>,
    event_ids: HashSet<String>,
    decision_ids: HashSet<String>,
}

impl<'a> EffectClosure<'a> {
    pub(crate) fn new(scenario: &'a ScenarioDefinition) -> Self {
        Self {
            scenario,
            effects: Vec::new(),
            event_ids: HashSet::new(),
            decision_ids: HashSet::new(),
        }
    }

    pub(crate) fn add_effects(&mut self, effects: &'a [Effect]) {
        for effect in effects {
            self.add_effect(effect);
        }
    }

    pub(crate) fn add_event(&mut self, event_id: &str) {
        if !self.event_ids.insert(event_id.to_owned()) {
            return;
        }

        let Some(event) = self
            .scenario
            .events
            .iter()
            .find(|event| event.id.as_str() == event_id)
        else {
            return;
        };
        self.add_effects(&event.effects);

        let mut dependent_ids = self
            .scenario
            .events
            .iter()
            .filter(|dependent| {
                matches!(
                    &dependent.trigger,
                    EventTrigger::AfterEvent { event: trigger } if trigger == &event.id
                )
            })
            .map(|dependent| dependent.id.as_str().to_owned())
            .collect::<Vec<_>>();
        dependent_ids.extend(self.scenario.async_tasks.iter().filter_map(|task| {
            (task.usable_until_event.as_ref() == Some(&event.id))
                .then(|| {
                    task.expiry_event
                        .as_ref()
                        .map(|expiry| expiry.as_str().to_owned())
                })
                .flatten()
        }));
        for dependent_id in dependent_ids {
            self.add_event(&dependent_id);
        }
    }

    pub(crate) fn contains(&self, predicate: impl Fn(&Effect) -> bool) -> bool {
        self.effects.iter().copied().any(predicate)
    }

    pub(crate) fn effects(&self) -> impl Iterator<Item = &'a Effect> + '_ {
        self.effects.iter().copied()
    }

    pub(crate) fn event_ids(&self) -> impl Iterator<Item = &str> {
        self.event_ids.iter().map(String::as_str)
    }

    fn add_effect(&mut self, effect: &'a Effect) {
        self.effects.push(effect);
        match effect {
            Effect::TriggerEvent { event } => self.add_event(event.as_str()),
            Effect::ResolveDeterministicDecision { decision } => {
                if !self.decision_ids.insert(decision.as_str().to_owned()) {
                    return;
                }
                let Some(definition) = self
                    .scenario
                    .deterministic_decisions
                    .iter()
                    .find(|candidate| candidate.id == *decision)
                else {
                    return;
                };
                for branch in &definition.branches {
                    self.add_effects(&branch.effects);
                }
            }
            _ => {}
        }
    }
}

/// One branch-correlated deterministic transition path.
#[derive(Clone, Default)]
pub(crate) struct EffectPath<'a> {
    effects: Vec<&'a Effect>,
    event_ids: HashSet<String>,
}

impl<'a> EffectPath<'a> {
    pub(crate) fn effects(&self) -> &[&'a Effect] {
        &self.effects
    }

    pub(crate) fn event_ids(&self) -> impl Iterator<Item = &str> {
        self.event_ids.iter().map(String::as_str)
    }
}

/// Expands one action or event transition without merging sibling decision
/// branches. Triggered and AfterEvent event effects remain in the selected
/// path, as do asynchronous expiry events caused by a usable-until boundary.
pub(crate) fn correlated_transition_paths<'a>(
    scenario: &'a ScenarioDefinition,
    root_effects: &'a [Effect],
    source_action: Option<&str>,
    source_event: Option<&str>,
) -> Vec<EffectPath<'a>> {
    let mut paths = expand_sequence(scenario, root_effects, &HashSet::new(), &HashSet::new());

    if let Some(event_id) = source_event {
        for path in &mut paths {
            path.event_ids.insert(event_id.to_owned());
        }
        if let Some(event) = scenario
            .events
            .iter()
            .find(|event| event.id.as_str() == event_id)
        {
            for dependent_id in dependent_event_ids(scenario, event) {
                paths = append_event_to_paths(
                    scenario,
                    paths,
                    &dependent_id,
                    &HashSet::from([event_id.to_owned()]),
                    &HashSet::new(),
                );
            }
        }
    }

    if let Some(action_id) = source_action {
        let after_action_ids = scenario
            .events
            .iter()
            .filter(|event| {
                matches!(
                    &event.trigger,
                    EventTrigger::AfterAction { action } if action.as_str() == action_id
                )
            })
            .map(|event| event.id.as_str().to_owned())
            .collect::<Vec<_>>();
        for event_id in after_action_ids {
            paths =
                append_event_to_paths(scenario, paths, &event_id, &HashSet::new(), &HashSet::new());
        }
    }

    paths
}

fn expand_sequence<'a>(
    scenario: &'a ScenarioDefinition,
    effects: &'a [Effect],
    visiting_events: &HashSet<String>,
    visiting_decisions: &HashSet<String>,
) -> Vec<EffectPath<'a>> {
    let mut paths = vec![EffectPath::default()];
    for effect in effects {
        let alternatives = expand_effect(scenario, effect, visiting_events, visiting_decisions);
        paths = concatenate_paths(paths, alternatives);
    }
    paths
}

fn expand_effect<'a>(
    scenario: &'a ScenarioDefinition,
    effect: &'a Effect,
    visiting_events: &HashSet<String>,
    visiting_decisions: &HashSet<String>,
) -> Vec<EffectPath<'a>> {
    match effect {
        Effect::TriggerEvent { event } => expand_event(
            scenario,
            event.as_str(),
            visiting_events,
            visiting_decisions,
        ),
        Effect::ResolveDeterministicDecision { decision } => {
            if visiting_decisions.contains(decision.as_str()) {
                return vec![EffectPath::default()];
            }
            let Some(definition) = scenario
                .deterministic_decisions
                .iter()
                .find(|candidate| candidate.id == *decision)
            else {
                return vec![EffectPath::default()];
            };
            let mut nested_visiting = visiting_decisions.clone();
            nested_visiting.insert(decision.as_str().to_owned());
            let mut alternatives = Vec::new();
            for branch in &definition.branches {
                alternatives.extend(expand_sequence(
                    scenario,
                    &branch.effects,
                    visiting_events,
                    &nested_visiting,
                ));
            }
            if alternatives.is_empty() {
                alternatives.push(EffectPath::default());
            }
            alternatives
        }
        _ => vec![EffectPath {
            effects: vec![effect],
            event_ids: HashSet::new(),
        }],
    }
}

fn expand_event<'a>(
    scenario: &'a ScenarioDefinition,
    event_id: &str,
    visiting_events: &HashSet<String>,
    visiting_decisions: &HashSet<String>,
) -> Vec<EffectPath<'a>> {
    if visiting_events.contains(event_id) {
        return vec![EffectPath::default()];
    }
    let Some(event) = scenario
        .events
        .iter()
        .find(|event| event.id.as_str() == event_id)
    else {
        return vec![EffectPath::default()];
    };
    let mut nested_visiting = visiting_events.clone();
    nested_visiting.insert(event_id.to_owned());
    let mut paths = expand_sequence(
        scenario,
        &event.effects,
        &nested_visiting,
        visiting_decisions,
    );
    for path in &mut paths {
        path.event_ids.insert(event_id.to_owned());
    }
    for dependent_id in dependent_event_ids(scenario, event) {
        paths = append_event_to_paths(
            scenario,
            paths,
            &dependent_id,
            &nested_visiting,
            visiting_decisions,
        );
    }
    paths
}

fn append_event_to_paths<'a>(
    scenario: &'a ScenarioDefinition,
    paths: Vec<EffectPath<'a>>,
    event_id: &str,
    visiting_events: &HashSet<String>,
    visiting_decisions: &HashSet<String>,
) -> Vec<EffectPath<'a>> {
    concatenate_paths(
        paths,
        expand_event(scenario, event_id, visiting_events, visiting_decisions),
    )
}

fn concatenate_paths<'a>(
    prefixes: Vec<EffectPath<'a>>,
    suffixes: Vec<EffectPath<'a>>,
) -> Vec<EffectPath<'a>> {
    let mut combined = Vec::new();
    for prefix in prefixes {
        for suffix in &suffixes {
            let mut path = prefix.clone();
            path.effects.extend(suffix.effects.iter().copied());
            path.event_ids.extend(suffix.event_ids.iter().cloned());
            combined.push(path);
        }
    }
    combined
}

fn dependent_event_ids(
    scenario: &ScenarioDefinition,
    event: &juris_scenario_schema::EventDefinition,
) -> Vec<String> {
    let mut dependent_ids = scenario
        .events
        .iter()
        .filter(|dependent| {
            matches!(
                &dependent.trigger,
                EventTrigger::AfterEvent { event: trigger } if trigger == &event.id
            )
        })
        .map(|dependent| dependent.id.as_str().to_owned())
        .collect::<Vec<_>>();
    dependent_ids.extend(scenario.async_tasks.iter().filter_map(|task| {
        if task.usable_until_event.as_ref() == Some(&event.id) {
            task.expiry_event
                .as_ref()
                .map(|expiry| expiry.as_str().to_owned())
        } else {
            None
        }
    }));
    dependent_ids
}
