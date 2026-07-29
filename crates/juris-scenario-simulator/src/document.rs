use std::{collections::BTreeSet, fs, path::Path};

use serde_json::Value;

use crate::SimulationError;

/// Parsed canonical scenario JSON plus minimal indexes checked before replay.
#[derive(Clone, Debug)]
pub struct ScenarioDocument {
    root: Value,
    scenario_id: String,
    initial_stage: String,
}

impl ScenarioDocument {
    /// Loads one scenario JSON file.
    pub fn load(path: impl AsRef<Path>) -> Result<Self, SimulationError> {
        let path = path.as_ref();
        let bytes = fs::read(path).map_err(|source| SimulationError::Io {
            path: path.to_path_buf(),
            source,
        })?;
        let root = serde_json::from_slice(&bytes).map_err(|source| SimulationError::Json {
            path: path.to_path_buf(),
            source,
        })?;
        Self::from_value(root)
    }

    /// Builds a document from already parsed canonical JSON.
    pub fn from_value(root: Value) -> Result<Self, SimulationError> {
        let scenario_id = required_string_at(&root, &["metadata", "id"])?;
        let initial_stage = required_string(&root, "initial_stage")?;

        for field in ["stages", "actions", "events", "outcomes"] {
            required_array(&root, field)?;
        }

        validate_unique_ids(&root, "stages", "stage")?;
        validate_unique_ids(&root, "actions", "action")?;
        validate_unique_ids(&root, "events", "event")?;
        validate_unique_ids(&root, "outcomes", "outcome")?;

        if find_by_id(&root, "stages", &initial_stage)?.is_none() {
            return Err(SimulationError::UnknownStage {
                stage: initial_stage,
            });
        }

        Ok(Self {
            root,
            scenario_id,
            initial_stage,
        })
    }

    #[must_use]
    pub fn scenario_id(&self) -> &str {
        &self.scenario_id
    }

    #[must_use]
    pub fn initial_stage(&self) -> &str {
        &self.initial_stage
    }

    #[must_use]
    pub fn root(&self) -> &Value {
        &self.root
    }
}

pub(crate) fn required_string(value: &Value, field: &str) -> Result<String, SimulationError> {
    let Some(candidate) = value.get(field) else {
        return Err(SimulationError::MissingField {
            field: field.to_owned(),
        });
    };
    let Some(candidate) = candidate.as_str() else {
        return Err(SimulationError::WrongFieldType {
            field: field.to_owned(),
            expected: "string",
        });
    };
    Ok(candidate.to_owned())
}

pub(crate) fn optional_string<'a>(value: &'a Value, field: &str) -> Option<&'a str> {
    value.get(field).and_then(Value::as_str)
}

pub(crate) fn required_array<'a>(
    value: &'a Value,
    field: &str,
) -> Result<&'a [Value], SimulationError> {
    let Some(candidate) = value.get(field) else {
        return Err(SimulationError::MissingField {
            field: field.to_owned(),
        });
    };
    let Some(candidate) = candidate.as_array() else {
        return Err(SimulationError::WrongFieldType {
            field: field.to_owned(),
            expected: "array",
        });
    };
    Ok(candidate)
}

fn required_string_at(value: &Value, path: &[&str]) -> Result<String, SimulationError> {
    let mut current = value;
    for segment in path {
        let Some(next) = current.get(*segment) else {
            return Err(SimulationError::MissingField {
                field: path.join("."),
            });
        };
        current = next;
    }

    let Some(candidate) = current.as_str() else {
        return Err(SimulationError::WrongFieldType {
            field: path.join("."),
            expected: "string",
        });
    };
    Ok(candidate.to_owned())
}

fn validate_unique_ids(
    root: &Value,
    collection: &str,
    kind: &'static str,
) -> Result<(), SimulationError> {
    let mut ids = BTreeSet::new();
    for item in required_array(root, collection)? {
        let id = required_string(item, "id")?;
        if !ids.insert(id.clone()) {
            return Err(SimulationError::DuplicateId { kind, id });
        }
    }
    Ok(())
}

fn find_by_id<'a>(
    root: &'a Value,
    collection: &str,
    id: &str,
) -> Result<Option<&'a Value>, SimulationError> {
    Ok(required_array(root, collection)?
        .iter()
        .find(|item| optional_string(item, "id") == Some(id)))
}
