use std::{
    ffi::OsString,
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};

use juris_case_catalog::{
    is_valid_stable_id, validate_matter_identity, CaseId, ClientContact, ContactId, PartyId,
    ProceduralRole,
};
use juris_scenario_builder::{
    clone_matter_identity, generate_matter_identity, load_template, read_identity, run,
    serialize_identity, write_identity, BuilderError, CloneMatterRequest, NewMatterRequest,
    PartyDraft,
};

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

struct TestDirectory {
    path: PathBuf,
}

impl TestDirectory {
    fn new(label: &str) -> Self {
        let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "genesis-juris-builder-{label}-{}-{counter}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("test directory must be created");
        Self { path }
    }

    fn join(&self, path: &str) -> PathBuf {
        self.path.join(path)
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn repository_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn template_path() -> PathBuf {
    repository_root().join("content/templates/commercial_litigation_v1.json")
}

fn claimant() -> PartyDraft {
    PartyDraft {
        party_id: PartyId::from("velmont_logistics"),
        display_name: "Velmont Logistics SA".to_owned(),
        client_contact: Some(ClientContact {
            contact_id: ContactId::from("sophie_maes"),
            display_name: "Sophie Maes".to_owned(),
            role: "Finance Director".to_owned(),
        }),
    }
}

fn defendant() -> PartyDraft {
    PartyDraft {
        party_id: PartyId::from("orbis_retail_belgium"),
        display_name: "Orbis Retail Belgium NV".to_owned(),
        client_contact: None,
    }
}

fn request() -> NewMatterRequest {
    NewMatterRequest {
        template: load_template(template_path()).expect("reference template must load"),
        case_id: CaseId::from("be_commercial_logistics_002"),
        claimant: claimant(),
        defendant: defendant(),
        player_client_id: PartyId::from("velmont_logistics"),
        topic: "Unpaid Logistics Invoices".to_owned(),
        short_title: "Unpaid Invoices".to_owned(),
        synopsis: Some("A deterministic generated test matter.".to_owned()),
    }
}

#[test]
fn reference_template_loads_and_uses_supported_version() {
    let template = load_template(template_path()).expect("template must load");

    assert_eq!(template.template_version, 1);
    assert_eq!(template.template_id, "commercial_litigation_v1");
}

#[test]
fn generated_case_validates_immediately() {
    let identity = generate_matter_identity(request()).expect("identity must generate");
    let report = validate_matter_identity(&identity);

    assert!(report.is_valid(), "{:#?}", report.diagnostics());
}

#[test]
fn caption_orders_claimant_before_defendant() {
    let identity = generate_matter_identity(request()).expect("identity must generate");

    assert_eq!(
        identity.caption,
        "Velmont Logistics SA v. Orbis Retail Belgium NV"
    );
}

#[test]
fn representing_the_defendant_does_not_reverse_the_caption() {
    let mut input = request();
    input.player_client_id = PartyId::from("orbis_retail_belgium");

    let identity = generate_matter_identity(input).expect("identity must generate");

    assert_eq!(
        identity.caption,
        "Velmont Logistics SA v. Orbis Retail Belgium NV"
    );
    assert_eq!(
        identity
            .player_client()
            .expect("player client must resolve")
            .procedural_role,
        ProceduralRole::Defendant
    );
}

#[test]
fn duplicate_party_ids_are_rejected_before_writing() {
    let mut input = request();
    input.defendant.party_id = input.claimant.party_id.clone();

    let error = generate_matter_identity(input).expect_err("duplicate IDs must fail");

    assert!(matches!(error, BuilderError::SamePartyId { .. }));
}

#[test]
fn player_client_must_reference_one_of_the_generated_parties() {
    let mut input = request();
    input.player_client_id = PartyId::from("unknown_client");

    let error = generate_matter_identity(input).expect_err("unknown client must fail");

    assert!(matches!(error, BuilderError::UnknownPlayerClient { .. }));
}

#[test]
fn invalid_stable_ids_are_rejected_by_validation() {
    let mut input = request();
    input.case_id = CaseId::from("Invalid Display ID");

    let error = generate_matter_identity(input).expect_err("invalid ID must fail");

    assert!(matches!(error, BuilderError::InvalidIdentity { .. }));
    assert!(!is_valid_stable_id("Invalid Display ID"));
}

#[test]
fn existing_output_is_protected_without_force() {
    let directory = TestDirectory::new("protect");
    let output = directory.join("matter.json");
    fs::write(&output, b"original").expect("fixture must be written");
    let identity = generate_matter_identity(request()).expect("identity must generate");

    let error = write_identity(&output, &identity, false).expect_err("overwrite must fail");

    assert!(matches!(error, BuilderError::OutputExists { .. }));
    assert_eq!(fs::read(&output).expect("fixture must remain"), b"original");
}

#[test]
fn force_replaces_existing_output_with_valid_json() {
    let directory = TestDirectory::new("force");
    let output = directory.join("matter.json");
    fs::write(&output, b"original").expect("fixture must be written");
    let identity = generate_matter_identity(request()).expect("identity must generate");

    write_identity(&output, &identity, true).expect("forced write must succeed");

    assert_eq!(
        read_identity(output).expect("written identity must load"),
        identity
    );
}

#[test]
fn failed_validation_leaves_no_partial_output() {
    let directory = TestDirectory::new("invalid");
    let output = directory.join("matter.json");
    let mut identity = generate_matter_identity(request()).expect("identity must generate");
    identity.caption = "Wrong Caption".to_owned();

    let error = write_identity(&output, &identity, false).expect_err("invalid write must fail");

    assert!(matches!(error, BuilderError::InvalidIdentity { .. }));
    assert!(!output.exists());
}

#[test]
fn identical_inputs_produce_byte_identical_json() {
    let first = generate_matter_identity(request()).expect("first identity must generate");
    let second = generate_matter_identity(request()).expect("second identity must generate");

    assert_eq!(
        serialize_identity(&first).expect("first identity must serialize"),
        serialize_identity(&second).expect("second identity must serialize")
    );
}

#[test]
fn cloning_rewrites_case_and_party_ids_consistently() {
    let source = generate_matter_identity(request()).expect("source must generate");
    let cloned = clone_matter_identity(CloneMatterRequest {
        source,
        case_id: CaseId::from("be_commercial_machinery_001"),
        claimant: PartyDraft {
            party_id: PartyId::from("meridian_industrial"),
            display_name: "Meridian Industrial Services BV".to_owned(),
            client_contact: None,
        },
        defendant: PartyDraft {
            party_id: PartyId::from("atlas_components"),
            display_name: "Atlas Components NV".to_owned(),
            client_contact: None,
        },
        player_client_id: PartyId::from("meridian_industrial"),
        topic: Some("Defective Machinery Supply".to_owned()),
        short_title: Some("Defective Machinery".to_owned()),
        synopsis: None,
    })
    .expect("clone must generate");

    assert_eq!(cloned.case_id.as_str(), "be_commercial_machinery_001");
    assert_eq!(cloned.parties[0].party_id.as_str(), "meridian_industrial");
    assert_eq!(cloned.parties[1].party_id.as_str(), "atlas_components");
    assert_eq!(
        cloned.caption,
        "Meridian Industrial Services BV v. Atlas Components NV"
    );
}

#[test]
fn cloning_retains_no_source_party_references() {
    let source = generate_matter_identity(request()).expect("source must generate");
    let cloned = clone_matter_identity(CloneMatterRequest {
        source,
        case_id: CaseId::from("be_commercial_machinery_002"),
        claimant: PartyDraft {
            party_id: PartyId::from("meridian_industrial"),
            display_name: "Meridian Industrial Services BV".to_owned(),
            client_contact: None,
        },
        defendant: PartyDraft {
            party_id: PartyId::from("atlas_components"),
            display_name: "Atlas Components NV".to_owned(),
            client_contact: None,
        },
        player_client_id: PartyId::from("atlas_components"),
        topic: None,
        short_title: None,
        synopsis: None,
    })
    .expect("clone must generate");

    let encoded =
        String::from_utf8(serialize_identity(&cloned).expect("cloned identity must serialize"))
            .expect("JSON must be UTF-8");

    assert!(!encoded.contains("velmont_logistics"));
    assert!(!encoded.contains("orbis_retail_belgium"));
}

#[test]
fn changing_display_names_does_not_change_stable_ids() {
    let mut input = request();
    input.claimant.display_name = "Velmont Freight SA".to_owned();

    let identity = generate_matter_identity(input).expect("identity must generate");

    assert_eq!(identity.parties[0].party_id.as_str(), "velmont_logistics");
    assert_eq!(identity.player_client_id.as_str(), "velmont_logistics");
}

#[test]
fn utf8_fictional_names_survive_write_and_read() {
    let directory = TestDirectory::new("utf8");
    let output = directory.join("matter.json");
    let mut input = request();
    input.claimant.display_name = "Société Vélmont SA".to_owned();
    input.claimant.client_contact = Some(ClientContact {
        contact_id: ContactId::from("elodie_maes"),
        display_name: "Élodie Maes".to_owned(),
        role: "Directrice financière".to_owned(),
    });
    let identity = generate_matter_identity(input).expect("identity must generate");

    write_identity(&output, &identity, false).expect("identity must be written");
    let decoded = read_identity(output).expect("identity must be read");

    assert_eq!(decoded, identity);
}

#[test]
fn cli_new_command_generates_a_valid_identity() {
    let directory = TestDirectory::new("cli-new");
    let output = directory.join("generated.json");
    let arguments = vec![
        OsString::from("new"),
        OsString::from("--template"),
        template_path().into_os_string(),
        OsString::from("--output"),
        output.clone().into_os_string(),
        OsString::from("--case-id"),
        OsString::from("be_commercial_cli_001"),
        OsString::from("--claimant-id"),
        OsString::from("velmont_logistics"),
        OsString::from("--claimant-name"),
        OsString::from("Velmont Logistics SA"),
        OsString::from("--defendant-id"),
        OsString::from("orbis_retail_belgium"),
        OsString::from("--defendant-name"),
        OsString::from("Orbis Retail Belgium NV"),
        OsString::from("--player-client-id"),
        OsString::from("velmont_logistics"),
        OsString::from("--topic"),
        OsString::from("Unpaid Logistics Invoices"),
    ];

    let message = run(arguments).expect("CLI new command must succeed");
    let identity = read_identity(output).expect("CLI output must load");

    assert!(message.contains("be_commercial_cli_001"));
    assert!(validate_matter_identity(&identity).is_valid());
}

#[test]
fn cli_validate_reports_valid_generated_documents() {
    let directory = TestDirectory::new("cli-validate");
    let output = directory.join("generated.json");
    let identity = generate_matter_identity(request()).expect("identity must generate");
    write_identity(&output, &identity, false).expect("identity must be written");

    let message = run(vec![
        OsString::from("validate"),
        OsString::from("--input"),
        output.into_os_string(),
    ])
    .expect("CLI validate command must succeed");

    assert!(message.starts_with("VALID "));
}
