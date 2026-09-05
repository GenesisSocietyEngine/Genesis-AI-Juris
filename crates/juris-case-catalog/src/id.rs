//! Strongly typed stable identifiers.
//!
//! A `CaseId`, `PartyId`, and `ContactId` all serialize as plain JSON strings,
//! but they are distinct Rust types. This prevents an entire class of mistakes
//! where a party identifier is accidentally passed to an API expecting a case
//! identifier.
//!
//! Deserialization intentionally does not reject malformed identifiers. The
//! authoring workflow benefits from collecting all diagnostics in one pass,
//! rather than aborting at the first malformed field. Semantic validation is
//! therefore performed by `validation::validate_*`.

use core::fmt;
use serde::{Deserialize, Serialize};

macro_rules! stable_id_type {
    ($name:ident) => {
        #[derive(Clone, Debug, Deserialize, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
        #[serde(transparent)]
        pub struct $name(String);

        impl $name {
            /// Creates an identifier without performing semantic validation.
            ///
            /// This constructor is useful for deserialization and test setup.
            /// Production authoring code should run the catalog validator before
            /// persisting or executing a scenario bundle.
            #[must_use]
            pub fn unchecked(value: impl Into<String>) -> Self {
                Self(value.into())
            }

            /// Returns the identifier as a borrowed string.
            ///
            /// Borrowing avoids allocations when identifiers are used as map
            /// keys, diagnostic values, or engine references.
            #[must_use]
            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl AsRef<str> for $name {
            fn as_ref(&self) -> &str {
                self.as_str()
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str(self.as_str())
            }
        }

        impl From<&str> for $name {
            fn from(value: &str) -> Self {
                Self::unchecked(value)
            }
        }

        impl From<String> for $name {
            fn from(value: String) -> Self {
                Self::unchecked(value)
            }
        }
    };
}

stable_id_type!(CaseId);
stable_id_type!(PartyId);
stable_id_type!(ContactId);

/// Returns `true` when a string satisfies the authoring-tool stable-ID policy.
///
/// Stable IDs are machine-facing and deliberately conservative:
///
/// - 1 to 64 ASCII characters;
/// - first character is a lowercase ASCII letter;
/// - remaining characters are lowercase letters, digits, or single underscores;
/// - no trailing or consecutive underscores.
///
/// Display names are intentionally *not* accepted. For example,
/// `northbridge_consulting` is valid while `Northbridge Consulting BV` is not.
#[must_use]
pub fn is_valid_stable_id(value: &str) -> bool {
    if value.is_empty() || value.len() > 64 {
        return false;
    }

    let mut characters = value.chars();
    let Some(first) = characters.next() else {
        return false;
    };

    if !first.is_ascii_lowercase() {
        return false;
    }

    let mut previous_was_underscore = false;
    for character in characters {
        if character == '_' {
            if previous_was_underscore {
                return false;
            }
            previous_was_underscore = true;
        } else if character.is_ascii_lowercase() || character.is_ascii_digit() {
            previous_was_underscore = false;
        } else {
            return false;
        }
    }

    !previous_was_underscore
}

#[cfg(test)]
mod tests {
    use super::is_valid_stable_id;

    #[test]
    fn stable_id_policy_accepts_machine_ids_and_rejects_display_text() {
        assert!(is_valid_stable_id("be_commercial_failed_erp_001"));
        assert!(is_valid_stable_id("northbridge_consulting"));

        assert!(!is_valid_stable_id(""));
        assert!(!is_valid_stable_id("Northbridge Consulting BV"));
        assert!(!is_valid_stable_id("northbridge-consulting"));
        assert!(!is_valid_stable_id("northbridge__consulting"));
        assert!(!is_valid_stable_id("northbridge_consulting_"));
    }
}
