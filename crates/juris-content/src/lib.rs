//! Data-driven legal scenario content.
//!
//! Narrative text and tunable timing values live outside the simulation engine
//! so legal reviewers and content designers can iterate without changing Rust
//! rules. The engine receives a validated `CaseTemplate`; it never parses JSON
//! in the middle of a player action.
//!
//! v0.4 embeds one case at compile time. Future releases may load signed content
//! packs, but this strongly typed boundary should remain unchanged.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Author-controlled configuration for one legal matter.
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

    /// Relative offsets keep content portable if the global start time changes.
    pub partner_brief_due_minutes_from_start: u32,
    pub preservation_due_minutes_from_start: u32,
    pub claim_due_minutes_from_start: u32,

    /// Asynchronous turnaround times for work performed by other actors.
    pub junior_review_turnaround_minutes: u32,
    pub expert_turnaround_minutes: u32,
    pub opponent_disclosure_turnaround_minutes: u32,
    pub hearing_delay_minutes_from_filing: u32,
}

/// Errors exposed by content parsing.
#[derive(Debug, Error)]
pub enum ContentError {
    #[error("invalid case JSON: {0}")]
    InvalidJson(#[from] serde_json::Error),
}

/// Parses one JSON document into an owned typed template.
///
/// Returning ownership prevents content-layer lifetimes from leaking into the
/// engine and allows one simulation run to retain its immutable template.
pub fn load_case_from_str(json: &str) -> Result<CaseTemplate, ContentError> {
    Ok(serde_json::from_str(json)?)
}

/// Returns the embedded ERP dispute used by the vertical prototype.
///
/// `include_str!` makes the CLI independent of its current working directory.
/// CI validates this same asset through the test below.
pub fn failed_erp_template() -> CaseTemplate {
    load_case_from_str(include_str!("../../../content/cases/failed_erp.json"))
        .expect("embedded case content must remain valid")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_case_content_is_valid_and_operationally_complete() {
        // This test proves more than JSON syntax: the first matter contains the
        // values needed by deadline, delegation, disclosure, and hearing systems.
        let case = failed_erp_template();
        assert_eq!(case.id, "failed-erp-implementation");
        assert!(case.claim_value_eur > 0);
        assert!(case.partner_brief_due_minutes_from_start > 0);
        assert!(case.claim_due_minutes_from_start > case.preservation_due_minutes_from_start);
        assert!(case.hearing_delay_minutes_from_filing > 0);
    }
}
