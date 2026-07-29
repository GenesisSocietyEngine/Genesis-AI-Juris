use std::path::PathBuf;

use juris_case_catalog::{
    load_catalog_bundle, validate_catalog, validate_catalog_bundle, validate_matter_identity,
    validate_repository_relative_path, CaseCatalog, CaseId, CatalogBundle, CatalogStatus,
    MatterIdentity, PartyId, ProceduralRole, Severity,
};

fn repository_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn load_reference_bundle() -> CatalogBundle {
    load_catalog_bundle(repository_root(), "content/catalog/catalog.json")
        .expect("reference catalog and identities must load")
}

#[test]
fn repository_catalog_and_identities_are_valid() {
    let bundle = load_reference_bundle();
    let report = validate_catalog_bundle(&bundle);

    assert!(
        report.is_valid(),
        "reference bundle produced diagnostics: {:#?}",
        report.diagnostics()
    );
}

#[test]
fn duplicate_case_ids_are_rejected_without_overwriting_entries() {
    let mut catalog = load_reference_bundle().catalog;
    catalog.cases.push(catalog.cases[0].clone());

    let report = validate_catalog(&catalog);
    assert!(report.contains_code("CAT101"));
}

#[test]
fn duplicate_party_ids_are_rejected() {
    let mut identity = load_reference_bundle().identities[0].clone();
    identity.parties[1].party_id = identity.parties[0].party_id.clone();

    let report = validate_matter_identity(&identity);
    assert!(report.contains_code("MAT121"));
}

#[test]
fn player_client_must_reference_a_defined_party() {
    let mut identity = load_reference_bundle().identities[0].clone();
    identity.player_client_id = PartyId::from("missing_client");

    let report = validate_matter_identity(&identity);
    assert!(report.contains_code("MAT151"));
}

#[test]
fn caption_is_independent_from_the_players_side() {
    let identity = load_reference_bundle().identities[0].clone();
    let original_caption = identity.caption.clone();

    let mut claimant_perspective = identity.clone();
    let claimant_id = claimant_perspective
        .parties
        .iter()
        .find(|party| party.procedural_role == ProceduralRole::Claimant)
        .expect("reference identity must have a claimant")
        .party_id
        .clone();
    claimant_perspective.player_client_id = claimant_id;

    assert_eq!(claimant_perspective.caption, original_caption);
    assert_eq!(
        claimant_perspective.canonical_caption().as_deref(),
        Some(original_caption.as_str())
    );
}

#[test]
fn captions_must_follow_claimant_v_defendant_not_player_order() {
    let mut identity = load_reference_bundle().identities[0].clone();
    identity.caption = "Northbridge Consulting BV v. Asteron Systems NV".to_owned();

    let report = validate_matter_identity(&identity);
    assert!(report.contains_code("MAT160"));
}

#[test]
fn display_names_cannot_be_used_as_stable_ids() {
    let mut identity = load_reference_bundle().identities[0].clone();
    identity.case_id = CaseId::from("Failed ERP Implementation");

    let report = validate_matter_identity(&identity);
    assert!(report.contains_code("MAT100"));
}

#[test]
fn catalog_and_identity_metadata_must_match() {
    let mut bundle = load_reference_bundle();
    bundle.catalog.cases[0].topic = "Different Topic".to_owned();

    let report = validate_catalog_bundle(&bundle);
    assert!(report.contains_code("BND102"));
}

#[test]
fn path_traversal_and_windows_separators_are_rejected() {
    let traversal = validate_repository_relative_path("../outside.json", "$.identity_file");
    assert!(traversal.contains_code("PTH004"));

    let windows_path =
        validate_repository_relative_path("content\\catalog\\case.json", "$.identity_file");
    assert!(windows_path.contains_code("PTH002"));
}

#[test]
fn identity_json_round_trip_preserves_stable_ids_and_roles() {
    let identity = load_reference_bundle().identities[0].clone();
    let encoded = serde_json::to_vec_pretty(&identity).expect("identity must serialize");
    let decoded: MatterIdentity =
        serde_json::from_slice(&encoded).expect("identity must deserialize");

    assert_eq!(decoded, identity);
}

#[test]
fn catalog_json_round_trip_preserves_case_order() {
    let catalog = load_reference_bundle().catalog;
    let encoded = serde_json::to_vec_pretty(&catalog).expect("catalog must serialize");
    let decoded: CaseCatalog = serde_json::from_slice(&encoded).expect("catalog must deserialize");

    assert_eq!(decoded, catalog);
}

#[test]
fn reference_library_separates_scenario_content_from_mobile_playability() {
    let bundle = load_reference_bundle();

    assert_eq!(bundle.catalog.cases.len(), 2);
    assert!(bundle.catalog.cases[0].scenario_file.is_some());
    assert_eq!(bundle.catalog.cases[0].status, CatalogStatus::Playable);
    assert!(bundle.catalog.cases[1].scenario_file.is_some());
    assert_eq!(bundle.catalog.cases[1].status, CatalogStatus::Outline);
    assert_eq!(
        bundle.identities[0].player_client_id.as_str(),
        "northbridge_consulting"
    );
    assert_eq!(
        bundle.identities[1].player_client_id.as_str(),
        "velmont_logistics"
    );
}

#[test]
fn warning_only_identity_remains_valid() {
    let mut identity = load_reference_bundle().identities[0].clone();
    let player_client_id = identity.player_client_id.clone();
    let client = identity
        .parties
        .iter_mut()
        .find(|party| party.party_id == player_client_id)
        .expect("player client must exist");
    client.client_contact = None;

    let report = validate_matter_identity(&identity);
    assert!(report.is_valid());
    assert!(report.contains_code("MAT150"));
    assert!(report
        .diagnostics()
        .iter()
        .any(|diagnostic| diagnostic.severity == Severity::Warning));
}
