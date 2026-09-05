//! Exact current/load-only scenario-definition inventory.
//!
//! This module selects immutable content before the existing strict save
//! loader runs. It deliberately does not translate envelopes, commands, or
//! definitions: selection is only by the exact `(scenario_id, fingerprint)`
//! identity already carried by Save v1.

use std::collections::{BTreeMap, BTreeSet};

use juris_scenario_schema::ScenarioDefinition;
use juris_scenario_validator::validate_scenario;
use thiserror::Error;

use super::{
    persistence::scenario_fingerprint, ScenarioRuntimeError, ScenarioSaveEnvelope,
    ScenarioSaveError, ScenarioSessionId, ScenarioSessionRegistry,
};

/// One manifest-pinned immutable definition that may only satisfy save load.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetainedScenarioDefinition {
    pub scenario_id: String,
    pub content_version: String,
    pub scenario_fingerprint: String,
    pub definition: ScenarioDefinition,
}

/// Deterministic inventory construction and current-creation failures.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ScenarioContentInventoryError {
    #[error("scenario `{scenario_id}` is invalid: {diagnostics}")]
    InvalidScenario {
        scenario_id: String,
        diagnostics: String,
    },

    #[error("current scenario ID `{0}` is declared more than once")]
    DuplicateCurrentScenario(String),

    #[error("retained scenario ID `{declared}` does not match definition `{actual}`")]
    RetainedScenarioIdMismatch { declared: String, actual: String },

    #[error("retained content version `{declared}` does not match definition metadata `{actual}`")]
    RetainedContentVersionMismatch { declared: String, actual: String },

    #[error(
        "retained fingerprint `{declared}` does not match recomputed definition fingerprint `{actual}`"
    )]
    RetainedFingerprintMismatch { declared: String, actual: String },

    #[error(
        "content identity (`{scenario_id}`, `{scenario_fingerprint}`) has conflicting definitions"
    )]
    ConflictingIdentity {
        scenario_id: String,
        scenario_fingerprint: String,
    },

    #[error("no current definition exists for scenario `{0}`")]
    UnknownCurrentScenario(String),

    #[error(transparent)]
    Runtime(#[from] ScenarioRuntimeError),

    #[error("scenario fingerprint could not be computed: {0}")]
    Fingerprint(String),
}

/// Immutable exact-identity inventory with distinct current and load-only roles.
#[derive(Debug, Clone)]
pub struct ScenarioContentInventory {
    current_by_scenario: BTreeMap<String, String>,
    definitions_by_identity: BTreeMap<(String, String), ScenarioDefinition>,
    retained_identities: BTreeSet<(String, String)>,
    known_scenario_ids: BTreeSet<String>,
}

impl ScenarioContentInventory {
    /// Validates every definition and builds an order-independent inventory.
    pub fn try_new(
        current: Vec<ScenarioDefinition>,
        retained: Vec<RetainedScenarioDefinition>,
    ) -> Result<Self, ScenarioContentInventoryError> {
        let mut inventory = Self {
            current_by_scenario: BTreeMap::new(),
            definitions_by_identity: BTreeMap::new(),
            retained_identities: BTreeSet::new(),
            known_scenario_ids: BTreeSet::new(),
        };

        for definition in current {
            validate_definition(&definition)?;
            let scenario_id = definition.metadata.id.as_str().to_owned();
            let fingerprint = fingerprint(&definition)?;
            if inventory
                .current_by_scenario
                .insert(scenario_id.clone(), fingerprint.clone())
                .is_some()
            {
                return Err(ScenarioContentInventoryError::DuplicateCurrentScenario(
                    scenario_id,
                ));
            }
            inventory.known_scenario_ids.insert(scenario_id.clone());
            inventory.insert_identity(scenario_id, fingerprint, definition)?;
        }

        for entry in retained {
            validate_definition(&entry.definition)?;
            let actual_scenario_id = entry.definition.metadata.id.as_str().to_owned();
            if entry.scenario_id != actual_scenario_id {
                return Err(ScenarioContentInventoryError::RetainedScenarioIdMismatch {
                    declared: entry.scenario_id,
                    actual: actual_scenario_id,
                });
            }
            if entry.content_version != entry.definition.metadata.content_version {
                return Err(
                    ScenarioContentInventoryError::RetainedContentVersionMismatch {
                        declared: entry.content_version,
                        actual: entry.definition.metadata.content_version.clone(),
                    },
                );
            }
            let actual_fingerprint = fingerprint(&entry.definition)?;
            if entry.scenario_fingerprint != actual_fingerprint {
                return Err(ScenarioContentInventoryError::RetainedFingerprintMismatch {
                    declared: entry.scenario_fingerprint,
                    actual: actual_fingerprint,
                });
            }

            let identity = (
                entry.scenario_id.clone(),
                entry.scenario_fingerprint.clone(),
            );
            inventory
                .known_scenario_ids
                .insert(entry.scenario_id.clone());
            inventory.insert_identity(
                entry.scenario_id,
                entry.scenario_fingerprint,
                entry.definition,
            )?;
            if !inventory.retained_identities.insert(identity.clone()) {
                return Err(ScenarioContentInventoryError::ConflictingIdentity {
                    scenario_id: identity.0,
                    scenario_fingerprint: identity.1,
                });
            }
        }

        Ok(inventory)
    }

    /// Creates a new game from the sole current-role definition.
    pub fn create_current(
        &self,
        sessions: &mut ScenarioSessionRegistry,
        scenario_id: &str,
        seed: u64,
    ) -> Result<ScenarioSessionId, ScenarioContentInventoryError> {
        let fingerprint = self.current_by_scenario.get(scenario_id).ok_or_else(|| {
            ScenarioContentInventoryError::UnknownCurrentScenario(scenario_id.to_owned())
        })?;
        let definition = self
            .definitions_by_identity
            .get(&(scenario_id.to_owned(), fingerprint.clone()))
            .expect("current identity must resolve after validated construction")
            .clone();
        Ok(sessions.create(definition, seed)?)
    }

    /// Resolves and loads an exact save identity through the unchanged loader.
    pub fn load_from_json(
        &self,
        sessions: &mut ScenarioSessionRegistry,
        encoded_save: &str,
    ) -> Result<ScenarioSessionId, ScenarioSaveError> {
        let envelope = ScenarioSaveEnvelope::from_json(encoded_save)?;
        let definition = self.resolve_envelope(&envelope)?.clone();
        sessions.load_from_json(definition, encoded_save)
    }

    /// Resolves an already parsed envelope without creating or replaying state.
    pub fn resolve_envelope(
        &self,
        envelope: &ScenarioSaveEnvelope,
    ) -> Result<&ScenarioDefinition, ScenarioSaveError> {
        if !self.known_scenario_ids.contains(&envelope.scenario_id) {
            return Err(ScenarioSaveError::UnknownScenario(
                envelope.scenario_id.clone(),
            ));
        }
        self.definitions_by_identity
            .get(&(
                envelope.scenario_id.clone(),
                envelope.scenario_fingerprint.clone(),
            ))
            .ok_or(ScenarioSaveError::FingerprintMismatch)
    }

    #[must_use]
    pub fn current_count(&self) -> usize {
        self.current_by_scenario.len()
    }

    #[must_use]
    pub fn retained_count(&self) -> usize {
        self.retained_identities.len()
    }

    fn insert_identity(
        &mut self,
        scenario_id: String,
        scenario_fingerprint: String,
        definition: ScenarioDefinition,
    ) -> Result<(), ScenarioContentInventoryError> {
        let key = (scenario_id.clone(), scenario_fingerprint.clone());
        if let Some(existing) = self.definitions_by_identity.get(&key) {
            if existing != &definition {
                return Err(ScenarioContentInventoryError::ConflictingIdentity {
                    scenario_id,
                    scenario_fingerprint,
                });
            }
            return Ok(());
        }
        self.definitions_by_identity.insert(key, definition);
        Ok(())
    }
}

fn fingerprint(definition: &ScenarioDefinition) -> Result<String, ScenarioContentInventoryError> {
    scenario_fingerprint(definition)
        .map_err(|error| ScenarioContentInventoryError::Fingerprint(error.to_string()))
}

fn validate_definition(
    definition: &ScenarioDefinition,
) -> Result<(), ScenarioContentInventoryError> {
    let report = validate_scenario(definition);
    if report.is_valid() {
        return Ok(());
    }
    let diagnostics = report
        .diagnostics
        .iter()
        .map(|item| format!("{} {}: {}", item.code, item.path, item.message))
        .collect::<Vec<_>>()
        .join("; ");
    Err(ScenarioContentInventoryError::InvalidScenario {
        scenario_id: definition.metadata.id.as_str().to_owned(),
        diagnostics,
    })
}
