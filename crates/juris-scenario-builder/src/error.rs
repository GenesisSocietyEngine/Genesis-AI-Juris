use std::path::PathBuf;

use thiserror::Error;

/// Errors exposed by the authoring library and command-line interface.
#[derive(Debug, Error)]
pub enum BuilderError {
    #[error("unable to read or write {path:?}")]
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

    #[error("unable to serialize generated matter identity")]
    Serialization {
        #[source]
        source: serde_json::Error,
    },

    #[error("unsupported template version {found}; expected 1")]
    UnsupportedTemplateVersion { found: u32 },

    #[error("claimant and defendant must use different stable party IDs: {party_id}")]
    SamePartyId { party_id: String },

    #[error("player client `{party_id}` must reference the claimant or defendant")]
    UnknownPlayerClient { party_id: String },

    #[error("generated matter identity failed validation:\n{diagnostics}")]
    InvalidIdentity { diagnostics: String },

    #[error("output already exists: {path:?}; pass --force to replace it")]
    OutputExists { path: PathBuf },

    #[error("output path has no usable file name: {path:?}")]
    InvalidOutputPath { path: PathBuf },

    #[error("missing required option {option}")]
    MissingOption { option: String },

    #[error("option {option} was supplied more than once")]
    DuplicateOption { option: String },

    #[error("unknown option {option}")]
    UnknownOption { option: String },

    #[error("unknown command {command}")]
    UnknownCommand { command: String },

    #[error("argument is not valid Unicode")]
    NonUnicodeArgument,

    #[error("option {option} requires a value")]
    MissingOptionValue { option: String },

    #[error("contact options for {party} must provide ID, name, and role together")]
    IncompleteContact { party: String },

    #[error("unexpected positional argument {argument}")]
    UnexpectedArgument { argument: String },
}
