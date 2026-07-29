//! Repository-relative JSON loading for case catalogs.
//!
//! The loader owns filesystem concerns only. Semantic errors are returned by the
//! validator so an author can receive a complete report rather than a single
//! early failure.

use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::de::DeserializeOwned;
use thiserror::Error;

use crate::{validate_repository_relative_path, CaseCatalog, MatterIdentity};

/// A loaded catalog and its identity documents in catalog order.
///
/// Keeping identities in catalog order makes duplicate catalog IDs observable
/// to validation instead of silently overwriting entries in a map.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CatalogBundle {
    pub catalog: CaseCatalog,
    pub identities: Vec<MatterIdentity>,
}

impl CatalogBundle {
    /// Finds the first identity matching a stable case ID.
    #[must_use]
    pub fn identity(&self, case_id: &crate::CaseId) -> Option<&MatterIdentity> {
        self.identities
            .iter()
            .find(|identity| &identity.case_id == case_id)
    }
}

#[derive(Debug, Error)]
pub enum CatalogLoadError {
    #[error("unable to read JSON file {path:?}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("invalid JSON in {path:?}")]
    Json {
        path: PathBuf,
        #[source]
        source: serde_json::Error,
    },

    #[error("unsafe repository-relative path: {path}")]
    UnsafePath { path: String },
}

/// Loads one JSON file while retaining the path in any error.
pub fn load_json_file<T>(path: impl AsRef<Path>) -> Result<T, CatalogLoadError>
where
    T: DeserializeOwned,
{
    let path = path.as_ref();
    let bytes = fs::read(path).map_err(|source| CatalogLoadError::Io {
        path: path.to_path_buf(),
        source,
    })?;

    serde_json::from_slice(&bytes).map_err(|source| CatalogLoadError::Json {
        path: path.to_path_buf(),
        source,
    })
}

/// Loads a catalog and all referenced identity documents from a repository root.
///
/// `catalog_relative_path` and every `identity_file` are required to use portable
/// forward-slash paths without traversal components. This prevents authoring
/// data from reading outside the repository when future tooling processes
/// third-party case packs.
pub fn load_catalog_bundle(
    repository_root: impl AsRef<Path>,
    catalog_relative_path: &str,
) -> Result<CatalogBundle, CatalogLoadError> {
    validate_safe_path_or_error(catalog_relative_path)?;

    let repository_root = repository_root.as_ref();
    let catalog_path = repository_root.join(catalog_relative_path);
    let catalog: CaseCatalog = load_json_file(catalog_path)?;

    let mut identities = Vec::with_capacity(catalog.cases.len());
    for entry in &catalog.cases {
        validate_safe_path_or_error(&entry.identity_file)?;
        let identity_path = repository_root.join(&entry.identity_file);
        identities.push(load_json_file(identity_path)?);
    }

    Ok(CatalogBundle {
        catalog,
        identities,
    })
}

fn validate_safe_path_or_error(path: &str) -> Result<(), CatalogLoadError> {
    let report = validate_repository_relative_path(path, "$");
    if report.is_valid() {
        Ok(())
    } else {
        Err(CatalogLoadError::UnsafePath {
            path: path.to_owned(),
        })
    }
}
