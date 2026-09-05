//! Loading of deterministic authoring templates.

use std::{fs, path::Path};

use juris_case_catalog::Difficulty;
use serde::{Deserialize, Serialize};

use crate::BuilderError;

const SUPPORTED_TEMPLATE_VERSION: u32 = 1;

/// Defaults shared by a family of generated fictional matters.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ScenarioTemplate {
    pub template_version: u32,
    pub template_id: String,
    pub schema_version: u32,
    pub fictional: bool,
    pub jurisdiction: String,
    pub practice_area: String,
    pub difficulty: Difficulty,
    pub default_synopsis: String,
    #[serde(default)]
    pub default_legal_issues: Vec<String>,
    #[serde(default)]
    pub default_tags: Vec<String>,
}

/// Loads and version-checks one scenario-authoring template.
pub fn load_template(path: impl AsRef<Path>) -> Result<ScenarioTemplate, BuilderError> {
    let path = path.as_ref();
    let bytes = fs::read(path).map_err(|source| BuilderError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    let template: ScenarioTemplate =
        serde_json::from_slice(&bytes).map_err(|source| BuilderError::Json {
            path: path.to_path_buf(),
            source,
        })?;

    if template.template_version != SUPPORTED_TEMPLATE_VERSION {
        return Err(BuilderError::UnsupportedTemplateVersion {
            found: template.template_version,
        });
    }

    Ok(template)
}
