//! Fast lookup index over all stable IDs in a scenario definition.
//!
//! The index does not validate duplicates. It exists only to make reference
//! checks explicit and efficient. Duplicate detection remains a structural
//! validation responsibility.

use juris_scenario_schema::ScenarioDefinition;
use std::collections::HashSet;

#[derive(Debug)]
pub(crate) struct ScenarioIndex {
    actors: HashSet<String>,
    facts: HashSet<String>,
    evidence: HashSet<String>,
    stages: HashSet<String>,
    actions: HashSet<String>,
    deadlines: HashSet<String>,
    async_tasks: HashSet<String>,
    inbox_items: HashSet<String>,
    events: HashSet<String>,
    outcomes: HashSet<String>,
}

impl ScenarioIndex {
    pub(crate) fn new(scenario: &ScenarioDefinition) -> Self {
        Self {
            actors: scenario
                .actors
                .iter()
                .map(|item| item.id.as_str().to_owned())
                .collect(),

            facts: scenario
                .facts
                .iter()
                .map(|item| item.id.as_str().to_owned())
                .collect(),

            evidence: scenario
                .evidence
                .iter()
                .map(|item| item.id.as_str().to_owned())
                .collect(),

            stages: scenario
                .stages
                .iter()
                .map(|item| item.id.as_str().to_owned())
                .collect(),

            actions: scenario
                .actions
                .iter()
                .map(|item| item.id.as_str().to_owned())
                .collect(),

            deadlines: scenario
                .deadlines
                .iter()
                .map(|item| item.id.as_str().to_owned())
                .collect(),

            async_tasks: scenario
                .async_tasks
                .iter()
                .map(|item| item.id.as_str().to_owned())
                .collect(),

            inbox_items: scenario
                .inbox_items
                .iter()
                .map(|item| item.id.as_str().to_owned())
                .collect(),

            events: scenario
                .events
                .iter()
                .map(|item| item.id.as_str().to_owned())
                .collect(),

            outcomes: scenario
                .outcomes
                .iter()
                .map(|item| item.id.as_str().to_owned())
                .collect(),
        }
    }

    pub(crate) fn has_actor(&self, id: &str) -> bool {
        self.actors.contains(id)
    }

    pub(crate) fn has_fact(&self, id: &str) -> bool {
        self.facts.contains(id)
    }

    pub(crate) fn has_evidence(&self, id: &str) -> bool {
        self.evidence.contains(id)
    }

    pub(crate) fn has_stage(&self, id: &str) -> bool {
        self.stages.contains(id)
    }

    pub(crate) fn has_action(&self, id: &str) -> bool {
        self.actions.contains(id)
    }

    pub(crate) fn has_deadline(&self, id: &str) -> bool {
        self.deadlines.contains(id)
    }

    pub(crate) fn has_async_task(&self, id: &str) -> bool {
        self.async_tasks.contains(id)
    }

    pub(crate) fn has_inbox_item(&self, id: &str) -> bool {
        self.inbox_items.contains(id)
    }

    pub(crate) fn has_event(&self, id: &str) -> bool {
        self.events.contains(id)
    }

    pub(crate) fn has_outcome(&self, id: &str) -> bool {
        self.outcomes.contains(id)
    }
}
