//! Serializable catalog and matter-identity models.
//!
//! These structures separate machine identity from presentation. `case_id` and
//! `party_id` remain stable across localization or fictional-name revisions,
//! while `caption`, `topic`, and `display_name` are presentation data.

use serde::{Deserialize, Serialize};

use crate::{CaseId, ContactId, PartyId};

/// Root document listing cases available to the game or authoring tools.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct CaseCatalog {
    pub catalog_version: u32,
    pub fictional_notice: String,
    pub cases: Vec<CaseCatalogEntry>,
}

/// Lightweight metadata used to render a case-library card.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct CaseCatalogEntry {
    pub case_id: CaseId,
    pub caption: String,
    pub topic: String,
    pub short_title: String,
    pub jurisdiction: String,
    pub practice_area: String,
    pub difficulty: Difficulty,
    pub status: CatalogStatus,
    pub player_client_id: PartyId,
    pub identity_file: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scenario_file: Option<String>,
}

/// Authoring status shown by a future case selector.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CatalogStatus {
    Playable,
    Outline,
    ComingSoon,
}

/// Coarse author-facing difficulty classification.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Difficulty {
    Introductory,
    Intermediate,
    Advanced,
    Expert,
}

/// Identity document for one legal matter.
///
/// This document may evolve independently of the executable scenario tree. The
/// separation allows the library and UI to adopt fictional case names before
/// all gameplay logic is migrated away from legacy fixtures.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct MatterIdentity {
    pub schema_version: u32,
    pub case_id: CaseId,
    pub fictional: bool,
    pub caption: String,
    pub topic: String,
    pub short_title: String,
    pub jurisdiction: String,
    pub practice_area: String,
    pub difficulty: Difficulty,
    pub player_client_id: PartyId,
    pub synopsis: String,
    #[serde(default)]
    pub legal_issues: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub parties: Vec<Party>,
}

impl MatterIdentity {
    /// Builds the standard first-instance caption from the lead claimant and
    /// lead defendant.
    ///
    /// The function intentionally does not inspect `player_client_id`. A case
    /// caption describes the procedural parties, not which side the player
    /// represents. This preserves captions when the same matter is played from
    /// a different perspective.
    #[must_use]
    pub fn canonical_caption(&self) -> Option<String> {
        let claimant = self
            .parties
            .iter()
            .find(|party| party.procedural_role == ProceduralRole::Claimant)?;
        let defendant = self
            .parties
            .iter()
            .find(|party| party.procedural_role == ProceduralRole::Defendant)?;

        Some(format!(
            "{} v. {}",
            claimant.display_name, defendant.display_name
        ))
    }

    /// Returns the UI-ready caption and topic without changing stable IDs.
    #[must_use]
    pub fn display_title(&self) -> String {
        format!("{} - {}", self.caption, self.topic)
    }

    /// Resolves the player client through its stable party identifier.
    #[must_use]
    pub fn player_client(&self) -> Option<&Party> {
        self.parties
            .iter()
            .find(|party| party.party_id == self.player_client_id)
    }
}

/// A procedural party participating in the matter.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct Party {
    pub party_id: PartyId,
    pub display_name: String,
    pub procedural_role: ProceduralRole,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_contact: Option<ClientContact>,
}

/// Procedural position at the reference first-instance stage.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProceduralRole {
    Claimant,
    Defendant,
    Appellant,
    Respondent,
    ThirdParty,
}

/// Fictional human contact representing an organizational client.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ClientContact {
    pub contact_id: ContactId,
    pub display_name: String,
    pub role: String,
}
