//! Scenario-authoring primitives and CLI support for GENESIS: AI Juris.
//!
//! Commit 11B deliberately starts with deterministic matter-identity creation.
//! It does not yet generate the complete executable decision graph. Keeping
//! that boundary explicit lets authors create catalog-ready fictional matters
//! while the later validation and simulation commits evolve independently.
//!
//! The builder follows rules learned from the Failed ERP implementation case:
//!
//! - stable IDs are authoritative; display names and captions are not;
//! - captions are derived from claimant and defendant roles;
//! - the player's client is referenced explicitly by stable party ID;
//! - generated documents are validated before any filesystem replacement;
//! - writes use sibling temporary files and transactional replacement;
//! - identical inputs produce identical JSON content.

pub mod cli;
pub mod error;
pub mod generator;
pub mod template;
pub mod writer;

pub use cli::{help_text, run};
pub use error::BuilderError;
pub use generator::{
    clone_matter_identity, generate_matter_identity, CloneMatterRequest, NewMatterRequest,
    PartyDraft,
};
pub use template::{load_template, ScenarioTemplate};
pub use writer::{read_identity, serialize_identity, write_identity};
