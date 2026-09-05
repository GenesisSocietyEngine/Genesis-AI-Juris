//! Strongly typed identifiers used by declarative scenario definitions.
//!
//! The schema deliberately avoids using plain `String` values for references.
//! A typed ID prevents accidentally passing an `ActionId` where an `EventId`
//! is expected, while still remaining human-readable in YAML.
//!
//! IDs contain no runtime state. They are stable content identifiers and must
//! remain unchanged when arrays are reordered or descriptions are edited.

use serde::{Deserialize, Serialize};
use std::fmt;

/// Defines a transparent string-backed identifier.
///
/// `#[serde(transparent)]` ensures that YAML remains concise:
///
/// ```yaml
/// initial_stage: intake
/// ```
///
/// rather than:
///
/// ```yaml
/// initial_stage:
///   value: intake
/// ```
macro_rules! define_string_id {
    ($name:ident) => {
        #[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(String);

        impl $name {
            /// Creates an ID from an owned or borrowed string.
            ///
            /// Validation of empty or malformed IDs belongs to
            /// `juris-scenario-validator`, not to the data schema.
            pub fn new(value: impl Into<String>) -> Self {
                Self(value.into())
            }

            /// Returns the underlying identifier without allocating.
            pub fn as_str(&self) -> &str {
                &self.0
            }

            /// Allows structural validation to detect empty identifiers.
            pub fn is_empty(&self) -> bool {
                self.0.is_empty()
            }
        }

        impl From<&str> for $name {
            fn from(value: &str) -> Self {
                Self::new(value)
            }
        }

        impl From<String> for $name {
            fn from(value: String) -> Self {
                Self::new(value)
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str(&self.0)
            }
        }
    };
}

define_string_id!(ScenarioId);
define_string_id!(ActorId);
define_string_id!(FactId);
define_string_id!(EvidenceId);
define_string_id!(StageId);
define_string_id!(ActionId);
define_string_id!(DeadlineId);
define_string_id!(AsyncTaskId);
define_string_id!(InboxItemId);
define_string_id!(EventId);
define_string_id!(OutcomeId);
define_string_id!(FlagId);
define_string_id!(MetricId);
define_string_id!(ResourceId);
define_string_id!(DecisionId);
define_string_id!(DecisionBranchId);
define_string_id!(PressureWindowId);
