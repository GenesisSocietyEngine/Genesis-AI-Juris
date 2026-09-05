//! Deterministic construction and cloning of matter identities.

use juris_case_catalog::{
    validate_matter_identity, CaseId, ClientContact, MatterIdentity, Party, PartyId,
    ProceduralRole, Severity,
};

use crate::{BuilderError, ScenarioTemplate};

/// Author-provided data for one procedural party.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PartyDraft {
    pub party_id: PartyId,
    pub display_name: String,
    pub client_contact: Option<ClientContact>,
}

/// Inputs required to generate a new matter identity from a template.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewMatterRequest {
    pub template: ScenarioTemplate,
    pub case_id: CaseId,
    pub claimant: PartyDraft,
    pub defendant: PartyDraft,
    pub player_client_id: PartyId,
    pub topic: String,
    pub short_title: String,
    pub synopsis: Option<String>,
}

/// Inputs required to clone an existing identity under new stable IDs.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CloneMatterRequest {
    pub source: MatterIdentity,
    pub case_id: CaseId,
    pub claimant: PartyDraft,
    pub defendant: PartyDraft,
    pub player_client_id: PartyId,
    pub topic: Option<String>,
    pub short_title: Option<String>,
    pub synopsis: Option<String>,
}

/// Generates a catalog-ready identity and validates it before returning.
pub fn generate_matter_identity(request: NewMatterRequest) -> Result<MatterIdentity, BuilderError> {
    ensure_party_relationships(
        &request.claimant,
        &request.defendant,
        &request.player_client_id,
    )?;

    let caption = canonical_caption(&request.claimant, &request.defendant);
    let synopsis = request
        .synopsis
        .unwrap_or_else(|| request.template.default_synopsis.clone());

    let identity = MatterIdentity {
        schema_version: request.template.schema_version,
        case_id: request.case_id,
        fictional: request.template.fictional,
        caption,
        topic: request.topic,
        short_title: request.short_title,
        jurisdiction: request.template.jurisdiction,
        practice_area: request.template.practice_area,
        difficulty: request.template.difficulty,
        player_client_id: request.player_client_id,
        synopsis,
        legal_issues: request.template.default_legal_issues,
        tags: request.template.default_tags,
        parties: parties(request.claimant, request.defendant),
    };

    validate_generated_identity(identity)
}

/// Clones one identity while consistently replacing case and party identity.
///
/// Legal issues, tags, jurisdiction, practice area, and difficulty are retained.
/// Presentation fields can be replaced without affecting stable references.
pub fn clone_matter_identity(request: CloneMatterRequest) -> Result<MatterIdentity, BuilderError> {
    ensure_party_relationships(
        &request.claimant,
        &request.defendant,
        &request.player_client_id,
    )?;

    let identity = MatterIdentity {
        schema_version: request.source.schema_version,
        case_id: request.case_id,
        fictional: request.source.fictional,
        caption: canonical_caption(&request.claimant, &request.defendant),
        topic: request.topic.unwrap_or(request.source.topic),
        short_title: request.short_title.unwrap_or(request.source.short_title),
        jurisdiction: request.source.jurisdiction,
        practice_area: request.source.practice_area,
        difficulty: request.source.difficulty,
        player_client_id: request.player_client_id,
        synopsis: request.synopsis.unwrap_or(request.source.synopsis),
        legal_issues: request.source.legal_issues,
        tags: request.source.tags,
        parties: parties(request.claimant, request.defendant),
    };

    validate_generated_identity(identity)
}

fn ensure_party_relationships(
    claimant: &PartyDraft,
    defendant: &PartyDraft,
    player_client_id: &PartyId,
) -> Result<(), BuilderError> {
    if claimant.party_id == defendant.party_id {
        return Err(BuilderError::SamePartyId {
            party_id: claimant.party_id.to_string(),
        });
    }

    if player_client_id != &claimant.party_id && player_client_id != &defendant.party_id {
        return Err(BuilderError::UnknownPlayerClient {
            party_id: player_client_id.to_string(),
        });
    }

    Ok(())
}

fn canonical_caption(claimant: &PartyDraft, defendant: &PartyDraft) -> String {
    format!(
        "{} v. {}",
        claimant.display_name.trim(),
        defendant.display_name.trim()
    )
}

fn parties(claimant: PartyDraft, defendant: PartyDraft) -> Vec<Party> {
    vec![
        Party {
            party_id: claimant.party_id,
            display_name: claimant.display_name,
            procedural_role: ProceduralRole::Claimant,
            client_contact: claimant.client_contact,
        },
        Party {
            party_id: defendant.party_id,
            display_name: defendant.display_name,
            procedural_role: ProceduralRole::Defendant,
            client_contact: defendant.client_contact,
        },
    ]
}

fn validate_generated_identity(identity: MatterIdentity) -> Result<MatterIdentity, BuilderError> {
    let report = validate_matter_identity(&identity);
    if report.is_valid() {
        return Ok(identity);
    }

    let mut lines = Vec::new();
    for diagnostic in report.diagnostics() {
        if diagnostic.severity == Severity::Error {
            lines.push(format!(
                "{} {}: {}",
                diagnostic.code, diagnostic.path, diagnostic.message
            ));
        }
    }

    Err(BuilderError::InvalidIdentity {
        diagnostics: lines.join("\n"),
    })
}
