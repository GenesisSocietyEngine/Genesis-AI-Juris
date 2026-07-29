//! Semantic validation for case catalogs and matter identities.
//!
//! Validation intentionally reports stable error codes and JSON-like paths. A
//! future visual scenario builder can therefore highlight the exact field while
//! CLI and CI users receive deterministic text diagnostics.

use std::{collections::HashSet, path::Component};

use crate::{
    is_valid_stable_id, CaseCatalog, CatalogBundle, CatalogStatus, Diagnostic, MatterIdentity,
    ProceduralRole, ValidationReport,
};

const SUPPORTED_CATALOG_VERSION: u32 = 1;
const SUPPORTED_IDENTITY_SCHEMA_VERSION: u32 = 1;

/// Validates catalog-level metadata and uniqueness constraints.
#[must_use]
pub fn validate_catalog(catalog: &CaseCatalog) -> ValidationReport {
    let mut report = ValidationReport::new();

    if catalog.catalog_version != SUPPORTED_CATALOG_VERSION {
        report.push(Diagnostic::error(
            "CAT001",
            "$.catalog_version",
            format!(
                "unsupported catalog version {}; expected {}",
                catalog.catalog_version, SUPPORTED_CATALOG_VERSION
            ),
            None,
        ));
    }

    require_text(
        &mut report,
        "CAT002",
        "$.fictional_notice",
        &catalog.fictional_notice,
        "fictional notice must not be empty",
    );

    if catalog.cases.is_empty() {
        report.push(Diagnostic::error(
            "CAT003",
            "$.cases",
            "catalog must contain at least one case",
            None,
        ));
    }

    let mut case_ids = HashSet::new();
    let mut identity_files = HashSet::new();

    for (index, entry) in catalog.cases.iter().enumerate() {
        let base = format!("$.cases[{index}]");

        if !is_valid_stable_id(entry.case_id.as_str()) {
            report.push(Diagnostic::error(
                "CAT100",
                format!("{base}.case_id"),
                format!("invalid stable case ID `{}`", entry.case_id),
                Some("Use lowercase ASCII letters, digits, and single underscores.".to_owned()),
            ));
        }

        if !case_ids.insert(entry.case_id.clone()) {
            report.push(Diagnostic::error(
                "CAT101",
                format!("{base}.case_id"),
                format!("duplicate case ID `{}`", entry.case_id),
                None,
            ));
        }

        require_text(
            &mut report,
            "CAT110",
            &format!("{base}.caption"),
            &entry.caption,
            "caption must not be empty",
        );
        require_text(
            &mut report,
            "CAT111",
            &format!("{base}.topic"),
            &entry.topic,
            "topic must not be empty",
        );
        require_text(
            &mut report,
            "CAT112",
            &format!("{base}.short_title"),
            &entry.short_title,
            "short title must not be empty",
        );
        require_text(
            &mut report,
            "CAT113",
            &format!("{base}.jurisdiction"),
            &entry.jurisdiction,
            "jurisdiction must not be empty",
        );
        require_text(
            &mut report,
            "CAT114",
            &format!("{base}.practice_area"),
            &entry.practice_area,
            "practice area must not be empty",
        );

        report.extend(validate_repository_relative_path(
            &entry.identity_file,
            &format!("{base}.identity_file"),
        ));

        if !identity_files.insert(entry.identity_file.clone()) {
            report.push(Diagnostic::error(
                "CAT120",
                format!("{base}.identity_file"),
                format!(
                    "identity file `{}` is referenced more than once",
                    entry.identity_file
                ),
                None,
            ));
        }

        match &entry.scenario_file {
            Some(path) => report.extend(validate_repository_relative_path(
                path,
                &format!("{base}.scenario_file"),
            )),
            None if entry.status == CatalogStatus::Playable => report.push(Diagnostic::error(
                "CAT121",
                format!("{base}.scenario_file"),
                "a playable case must reference an executable scenario file",
                None,
            )),
            None => {}
        }
    }

    report
}

/// Validates one matter-identity document.
#[must_use]
pub fn validate_matter_identity(identity: &MatterIdentity) -> ValidationReport {
    let mut report = ValidationReport::new();

    if identity.schema_version != SUPPORTED_IDENTITY_SCHEMA_VERSION {
        report.push(Diagnostic::error(
            "MAT001",
            "$.schema_version",
            format!(
                "unsupported matter identity schema version {}; expected {}",
                identity.schema_version, SUPPORTED_IDENTITY_SCHEMA_VERSION
            ),
            None,
        ));
    }

    if !is_valid_stable_id(identity.case_id.as_str()) {
        report.push(Diagnostic::error(
            "MAT100",
            "$.case_id",
            format!("invalid stable case ID `{}`", identity.case_id),
            None,
        ));
    }

    if !identity.fictional {
        report.push(Diagnostic::error(
            "MAT101",
            "$.fictional",
            "Case Catalog v1 accepts fictional matters only",
            Some("Use fictional organizations and persons for v1 content.".to_owned()),
        ));
    }

    require_text(
        &mut report,
        "MAT110",
        "$.caption",
        &identity.caption,
        "caption must not be empty",
    );
    require_text(
        &mut report,
        "MAT111",
        "$.topic",
        &identity.topic,
        "topic must not be empty",
    );
    require_text(
        &mut report,
        "MAT112",
        "$.short_title",
        &identity.short_title,
        "short title must not be empty",
    );
    require_text(
        &mut report,
        "MAT113",
        "$.jurisdiction",
        &identity.jurisdiction,
        "jurisdiction must not be empty",
    );
    require_text(
        &mut report,
        "MAT114",
        "$.practice_area",
        &identity.practice_area,
        "practice area must not be empty",
    );
    require_text(
        &mut report,
        "MAT115",
        "$.synopsis",
        &identity.synopsis,
        "synopsis must not be empty",
    );

    let mut party_ids = HashSet::new();
    let mut contact_ids = HashSet::new();
    let mut claimant_count = 0_usize;
    let mut defendant_count = 0_usize;

    for (index, party) in identity.parties.iter().enumerate() {
        let base = format!("$.parties[{index}]");

        if !is_valid_stable_id(party.party_id.as_str()) {
            report.push(Diagnostic::error(
                "MAT120",
                format!("{base}.party_id"),
                format!("invalid stable party ID `{}`", party.party_id),
                None,
            ));
        }

        if !party_ids.insert(party.party_id.clone()) {
            report.push(Diagnostic::error(
                "MAT121",
                format!("{base}.party_id"),
                format!("duplicate party ID `{}`", party.party_id),
                None,
            ));
        }

        require_text(
            &mut report,
            "MAT122",
            &format!("{base}.display_name"),
            &party.display_name,
            "party display name must not be empty",
        );

        match party.procedural_role {
            ProceduralRole::Claimant => claimant_count += 1,
            ProceduralRole::Defendant => defendant_count += 1,
            ProceduralRole::Appellant | ProceduralRole::Respondent | ProceduralRole::ThirdParty => {
            }
        }

        if let Some(contact) = &party.client_contact {
            if !is_valid_stable_id(contact.contact_id.as_str()) {
                report.push(Diagnostic::error(
                    "MAT130",
                    format!("{base}.client_contact.contact_id"),
                    format!("invalid stable contact ID `{}`", contact.contact_id),
                    None,
                ));
            }

            if !contact_ids.insert(contact.contact_id.clone()) {
                report.push(Diagnostic::error(
                    "MAT131",
                    format!("{base}.client_contact.contact_id"),
                    format!("duplicate contact ID `{}`", contact.contact_id),
                    None,
                ));
            }

            require_text(
                &mut report,
                "MAT132",
                &format!("{base}.client_contact.display_name"),
                &contact.display_name,
                "client contact display name must not be empty",
            );
            require_text(
                &mut report,
                "MAT133",
                &format!("{base}.client_contact.role"),
                &contact.role,
                "client contact role must not be empty",
            );
        }
    }

    if claimant_count != 1 {
        report.push(Diagnostic::error(
            "MAT140",
            "$.parties",
            format!("expected exactly one lead claimant; found {claimant_count}"),
            None,
        ));
    }

    if defendant_count != 1 {
        report.push(Diagnostic::error(
            "MAT141",
            "$.parties",
            format!("expected exactly one lead defendant; found {defendant_count}"),
            None,
        ));
    }

    match identity.player_client() {
        Some(player_client) => {
            if player_client.client_contact.is_none() {
                report.push(Diagnostic::warning(
                    "MAT150",
                    "$.player_client_id",
                    format!(
                        "player client `{}` has no fictional human contact",
                        identity.player_client_id
                    ),
                    Some("Add a client_contact to improve narrative continuity.".to_owned()),
                ));
            }
        }
        None => report.push(Diagnostic::error(
            "MAT151",
            "$.player_client_id",
            format!(
                "player client `{}` does not reference a defined party",
                identity.player_client_id
            ),
            None,
        )),
    }

    if let Some(expected_caption) = identity.canonical_caption() {
        if identity.caption != expected_caption {
            report.push(Diagnostic::error(
                "MAT160",
                "$.caption",
                format!(
                    "caption `{}` does not match procedural parties; expected `{expected_caption}`",
                    identity.caption
                ),
                Some(
                    "Case captions are derived from claimant and defendant, not from player side."
                        .to_owned(),
                ),
            ));
        }
    }

    if identity.legal_issues.is_empty() {
        report.push(Diagnostic::warning(
            "MAT170",
            "$.legal_issues",
            "matter identity has no legal issues",
            None,
        ));
    }

    report
}

/// Validates a loaded catalog together with identity documents.
#[must_use]
pub fn validate_catalog_bundle(bundle: &CatalogBundle) -> ValidationReport {
    let mut report = validate_catalog(&bundle.catalog);

    if bundle.identities.len() != bundle.catalog.cases.len() {
        report.push(Diagnostic::error(
            "BND001",
            "$.identities",
            format!(
                "catalog contains {} entries but {} identities were loaded",
                bundle.catalog.cases.len(),
                bundle.identities.len()
            ),
            None,
        ));
    }

    for (index, entry) in bundle.catalog.cases.iter().enumerate() {
        let Some(identity) = bundle.identities.get(index) else {
            continue;
        };

        let prefix = format!("identity({})", entry.identity_file);
        let identity_report = validate_matter_identity(identity);
        for mut diagnostic in identity_report.diagnostics().iter().cloned() {
            diagnostic.path = format!("{prefix}{}", diagnostic.path.trim_start_matches('$'));
            report.push(diagnostic);
        }

        compare_field(
            &mut report,
            "BND100",
            index,
            "case_id",
            entry.case_id.as_str(),
            identity.case_id.as_str(),
        );
        compare_field(
            &mut report,
            "BND101",
            index,
            "caption",
            &entry.caption,
            &identity.caption,
        );
        compare_field(
            &mut report,
            "BND102",
            index,
            "topic",
            &entry.topic,
            &identity.topic,
        );
        compare_field(
            &mut report,
            "BND103",
            index,
            "short_title",
            &entry.short_title,
            &identity.short_title,
        );
        compare_field(
            &mut report,
            "BND104",
            index,
            "jurisdiction",
            &entry.jurisdiction,
            &identity.jurisdiction,
        );
        compare_field(
            &mut report,
            "BND105",
            index,
            "practice_area",
            &entry.practice_area,
            &identity.practice_area,
        );
        compare_field(
            &mut report,
            "BND106",
            index,
            "player_client_id",
            entry.player_client_id.as_str(),
            identity.player_client_id.as_str(),
        );

        if entry.difficulty != identity.difficulty {
            report.push(Diagnostic::error(
                "BND107",
                format!("$.cases[{index}].difficulty"),
                "catalog difficulty does not match matter identity",
                None,
            ));
        }
    }

    report
}

/// Validates a portable path rooted inside the repository.
#[must_use]
pub fn validate_repository_relative_path(path: &str, json_path: &str) -> ValidationReport {
    let mut report = ValidationReport::new();

    if path.trim().is_empty() {
        report.push(Diagnostic::error(
            "PTH001",
            json_path,
            "repository-relative path must not be empty",
            None,
        ));
        return report;
    }

    if path.contains('\\') {
        report.push(Diagnostic::error(
            "PTH002",
            json_path,
            "path must use forward slashes for cross-platform determinism",
            None,
        ));
    }

    if path.starts_with('/') || path.contains(':') {
        report.push(Diagnostic::error(
            "PTH003",
            json_path,
            "absolute or drive-qualified paths are not allowed",
            None,
        ));
    }

    if std::path::Path::new(path)
        .components()
        .any(|component| matches!(component, Component::ParentDir | Component::RootDir))
    {
        report.push(Diagnostic::error(
            "PTH004",
            json_path,
            "path traversal components are not allowed",
            None,
        ));
    }

    report
}

fn require_text(
    report: &mut ValidationReport,
    code: &'static str,
    path: &str,
    value: &str,
    message: &str,
) {
    if value.trim().is_empty() {
        report.push(Diagnostic::error(code, path, message, None));
    }
}

fn compare_field(
    report: &mut ValidationReport,
    code: &'static str,
    index: usize,
    field: &str,
    catalog_value: &str,
    identity_value: &str,
) {
    if catalog_value != identity_value {
        report.push(Diagnostic::error(
            code,
            format!("$.cases[{index}].{field}"),
            format!(
                "catalog value `{catalog_value}` does not match identity value `{identity_value}`"
            ),
            None,
        ));
    }
}
