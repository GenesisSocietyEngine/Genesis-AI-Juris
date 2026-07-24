//! Data-driven content loading.
//!
//! Case prose and configurable values live outside Rust so designers and legal
//! reviewers can iterate without recompiling the engine.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CaseTemplate {
    pub id: String,
    pub title: String,
    pub jurisdiction: String,
    pub practice_area: String,
    pub claim_value_eur: i64,
    pub opening_subject: String,
    pub opening_message: String,
    pub opponent_initial_offer_eur: i64,
}

#[derive(Debug, Error)]
pub enum ContentError {
    #[error("invalid case JSON: {0}")]
    InvalidJson(#[from] serde_json::Error),
}

pub fn load_case_from_str(json: &str) -> Result<CaseTemplate, ContentError> {
    Ok(serde_json::from_str(json)?)
}

/// Built-in fallback makes the prototype runnable even when launched outside
/// the repository root. Production builds should load signed content packs.
pub fn failed_erp_template() -> CaseTemplate {
    load_case_from_str(include_str!("../../../content/cases/failed_erp.json"))
        .expect("embedded case content must remain valid")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_case_content_is_valid() {
        let case = failed_erp_template();
        assert_eq!(case.id, "failed-erp-implementation");
        assert!(case.claim_value_eur > 0);
    }
}
