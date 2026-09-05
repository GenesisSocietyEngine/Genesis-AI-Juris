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

fn json(encoded: &str) -> serde_json::Value {
    serde_json::from_str(encoded).expect("production JSON fixture must deserialize")
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
fn reference_library_exposes_all_mobile_playable_scenarios() {
    let bundle = load_reference_bundle();

    assert_eq!(bundle.catalog.cases.len(), 5);
    assert!(bundle
        .catalog
        .cases
        .iter()
        .all(|case| case.scenario_file.is_some() && case.status == CatalogStatus::Playable));
    assert_eq!(
        bundle
            .catalog
            .cases
            .iter()
            .map(|case| case.case_id.as_str())
            .collect::<Vec<_>>(),
        vec![
            "be_commercial_failed_erp_001",
            "be_commercial_logistics_001",
            "greenfire_first_72_hours",
            "nl_food_safety_goldenshell_001",
            "us_environmental_desert_water_001",
        ]
    );
    assert_eq!(
        bundle
            .identities
            .iter()
            .map(|identity| identity.player_client_id.as_str())
            .collect::<Vec<_>>(),
        vec![
            "asteron_systems",
            "velmont_logistics",
            "greenfire_industrial_solutions",
            "goldenshell_producers_cooperative",
            "sundial_mesa_residents_association",
        ]
    );
}

#[test]
fn four_pre_desert_water_catalogue_identities_remain_exact() {
    const LOCALIZATION: &str = include_str!("../../../content/localization/case_catalog.v1.json");
    const FAILED_ERP: &str = include_str!("../../../content/cases/failed_erp.scenario.json");
    const LOGISTICS: &str =
        include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
    const GREENFIRE: &str =
        include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
    const GOLDENSHELL: &str =
        include_str!("../../../content/cases/goldenshell_recall_at_dawn.scenario.json");

    struct ExpectedCase<'a> {
        case_id: &'a str,
        scenario_id: &'a str,
        sort_order: u64,
        runtime_adapter: &'a str,
        en_topic: &'a str,
        ru_topic: &'a str,
        en_short_title: &'a str,
        ru_short_title: &'a str,
        scenario: &'a str,
    }

    let expected = [
        ExpectedCase {
            case_id: "be_commercial_failed_erp_001",
            scenario_id: "be_commercial_failed_erp_001",
            sort_order: 10,
            runtime_adapter: "rust_scenario_v1",
            en_topic: "Failed ERP Implementation",
            ru_topic: "Неудачное внедрение ERP",
            en_short_title: "Failed ERP",
            ru_short_title: "Провал ERP-проекта",
            scenario: FAILED_ERP,
        },
        ExpectedCase {
            case_id: "be_commercial_logistics_001",
            scenario_id: "be_commercial_logistics_001",
            sort_order: 20,
            runtime_adapter: "rust_scenario_v1",
            en_topic: "Unpaid Logistics Invoices",
            ru_topic: "Неоплаченные логистические счета",
            en_short_title: "Unpaid Logistics Invoices",
            ru_short_title: "Логистические счета",
            scenario: LOGISTICS,
        },
        ExpectedCase {
            case_id: "greenfire_first_72_hours",
            scenario_id: "greenfire_first_72_hours",
            sort_order: 30,
            runtime_adapter: "rust_scenario_v1",
            en_topic: "The First 72 Hours",
            ru_topic: "Первые 72 часа",
            en_short_title: "GreenFire",
            ru_short_title: "GreenFire",
            scenario: GREENFIRE,
        },
        ExpectedCase {
            case_id: "nl_food_safety_goldenshell_001",
            scenario_id: "goldenshell_recall_at_dawn",
            sort_order: 40,
            runtime_adapter: "rust_scenario_v1",
            en_topic: "Contaminated Egg Supply Chain",
            ru_topic: "Загрязнение цепочки поставок яиц",
            en_short_title: "Recall at Dawn",
            ru_short_title: "Отзыв на рассвете",
            scenario: GOLDENSHELL,
        },
    ];

    let bundle = load_reference_bundle();
    assert_eq!(
        bundle.catalog.cases[..4]
            .iter()
            .map(|entry| entry.case_id.as_str())
            .collect::<Vec<_>>(),
        expected
            .iter()
            .map(|entry| entry.case_id)
            .collect::<Vec<_>>()
    );

    let localization = json(LOCALIZATION);
    for expected_case in expected {
        let case = &localization["cases"][expected_case.case_id];
        assert_eq!(case["sort_order"].as_u64(), Some(expected_case.sort_order));
        assert_eq!(
            case["runtime_adapter"].as_str(),
            Some(expected_case.runtime_adapter)
        );
        assert_eq!(
            case["locales"]["en"]["topic"].as_str(),
            Some(expected_case.en_topic)
        );
        assert_eq!(
            case["locales"]["ru"]["topic"].as_str(),
            Some(expected_case.ru_topic)
        );
        assert_eq!(
            case["locales"]["en"]["short_title"].as_str(),
            Some(expected_case.en_short_title)
        );
        assert_eq!(
            case["locales"]["ru"]["short_title"].as_str(),
            Some(expected_case.ru_short_title)
        );

        let scenario = json(expected_case.scenario);
        // All four pre-Desert production scenarios use ScenarioDefinition v1 metadata IDs.
        let actual_id = scenario["metadata"]["id"].as_str();
        assert_eq!(actual_id, Some(expected_case.scenario_id));
    }
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
