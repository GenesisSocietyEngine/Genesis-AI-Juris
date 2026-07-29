use crate::{ClockError, CommandIdError, StateInvariantError};
use thiserror::Error;

/// Authoritative gameplay engine failure.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum EngineError {
    /// Invalid command identifier.
    #[error(transparent)]
    CommandId(#[from] CommandIdError),

    /// Clock arithmetic failed.
    #[error(transparent)]
    Clock(#[from] ClockError),

    /// State configuration or invariant failed.
    #[error(transparent)]
    StateInvariant(#[from] StateInvariantError),

    /// Command is not legal in the current state.
    #[error("invalid transition: {0}")]
    InvalidTransition(String),

    /// Required deadline has passed.
    #[error("deadline passed: {0}")]
    DeadlinePassed(String),

    /// Explicit client authorization is missing.
    #[error("client authorization required: {0}")]
    ClientAuthorizationRequired(String),

    /// Cassation has no legally viable ground.
    #[error("no viable cassation ground")]
    NoViableCassationGround,

    /// Replayed event sequence is invalid.
    #[error("invalid replay sequence: {0}")]
    InvalidReplay(String),

    /// Internal command processing produced no event.
    #[error("internal error: accepted command produced no event")]
    EmptyDecision,
}
