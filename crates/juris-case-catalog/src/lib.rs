//! Case-catalog and matter-identity primitives for GENESIS: AI Juris.
//!
//! This crate deliberately owns *identity and catalog metadata only*. It does
//! not resolve legal outcomes and it does not execute gameplay commands. That
//! separation is architectural: display names, captions, topics, and client
//! contacts must be available to the UI and authoring tools without becoming
//! authoritative inputs to the deterministic gameplay engine.
//!
//! The public API is organized around four concerns:
//!
//! - [`id`] provides strongly typed stable identifiers;
//! - [`model`] defines serializable catalog and matter-identity documents;
//! - [`validation`] produces stable, path-aware authoring diagnostics;
//! - [`loader`] loads a catalog bundle from repository-relative JSON files.
//!
//! The crate is intentionally compatible with the workspace Rust 2021 edition
//! and MSRV. In particular, it avoids Rust 2024-only syntax such as let chains.

pub mod diagnostic;
pub mod id;
pub mod loader;
pub mod model;
pub mod validation;

pub use diagnostic::{Diagnostic, Severity, ValidationReport};
pub use id::{is_valid_stable_id, CaseId, ContactId, PartyId};
pub use loader::{load_catalog_bundle, load_json_file, CatalogBundle, CatalogLoadError};
pub use model::{
    CaseCatalog, CaseCatalogEntry, CatalogStatus, ClientContact, Difficulty, MatterIdentity, Party,
    ProceduralRole,
};
pub use validation::{
    validate_catalog, validate_catalog_bundle, validate_matter_identity,
    validate_repository_relative_path,
};
