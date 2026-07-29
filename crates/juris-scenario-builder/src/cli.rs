//! Dependency-light command-line parsing for the scenario builder.

use std::{
    collections::{BTreeMap, BTreeSet},
    ffi::OsString,
    path::PathBuf,
};

use juris_case_catalog::{
    validate_matter_identity, CaseId, ClientContact, ContactId, PartyId, ProceduralRole, Severity,
};

use crate::{
    clone_matter_identity, generate_matter_identity, load_template, read_identity, write_identity,
    BuilderError, CloneMatterRequest, NewMatterRequest, PartyDraft,
};

/// Runs the CLI from arguments that exclude the executable name.
pub fn run<I>(arguments: I) -> Result<String, BuilderError>
where
    I: IntoIterator<Item = OsString>,
{
    let mut arguments = arguments.into_iter();
    let Some(command) = arguments.next() else {
        return Ok(help_text().to_owned());
    };
    let command = unicode(command)?;

    match command.as_str() {
        "help" | "--help" | "-h" => Ok(help_text().to_owned()),
        "new" => run_new(parse_options(arguments)?),
        "clone" => run_clone(parse_options(arguments)?),
        "inspect" => run_inspect(parse_options(arguments)?),
        "validate" => run_validate(parse_options(arguments)?),
        _ => Err(BuilderError::UnknownCommand { command }),
    }
}

/// Static help text kept deterministic for tests and documentation.
#[must_use]
pub fn help_text() -> &'static str {
    "juris-scenario-builder v1\n\nCommands:\n  new       Generate a matter identity from a template\n  clone     Clone an identity under new case and party IDs\n  inspect   Print stable identity and player-side metadata\n  validate  Validate one matter identity JSON file\n\nRun a command with required --option value pairs. Use --force only with new or clone."
}

#[derive(Debug, Default)]
struct ParsedOptions {
    values: BTreeMap<String, String>,
    flags: BTreeSet<String>,
}

impl ParsedOptions {
    fn take_required(&mut self, name: &str) -> Result<String, BuilderError> {
        self.values
            .remove(name)
            .ok_or_else(|| BuilderError::MissingOption {
                option: format!("--{name}"),
            })
    }

    fn take_optional(&mut self, name: &str) -> Option<String> {
        self.values.remove(name)
    }

    fn take_flag(&mut self, name: &str) -> bool {
        self.flags.remove(name)
    }

    fn ensure_empty(self) -> Result<(), BuilderError> {
        if let Some(name) = self.values.keys().next() {
            return Err(BuilderError::UnknownOption {
                option: format!("--{name}"),
            });
        }
        if let Some(name) = self.flags.iter().next() {
            return Err(BuilderError::UnknownOption {
                option: format!("--{name}"),
            });
        }
        Ok(())
    }
}

fn parse_options<I>(arguments: I) -> Result<ParsedOptions, BuilderError>
where
    I: IntoIterator<Item = OsString>,
{
    let mut parsed = ParsedOptions::default();
    let mut arguments = arguments.into_iter();

    while let Some(raw) = arguments.next() {
        let option = unicode(raw)?;
        if !option.starts_with("--") {
            return Err(BuilderError::UnexpectedArgument { argument: option });
        }

        let name = option.trim_start_matches("--").to_owned();
        if name == "force" {
            if !parsed.flags.insert(name.clone()) {
                return Err(BuilderError::DuplicateOption {
                    option: format!("--{name}"),
                });
            }
            continue;
        }

        let Some(value) = arguments.next() else {
            return Err(BuilderError::MissingOptionValue {
                option: format!("--{name}"),
            });
        };
        let value = unicode(value)?;
        if parsed.values.insert(name.clone(), value).is_some() {
            return Err(BuilderError::DuplicateOption {
                option: format!("--{name}"),
            });
        }
    }

    Ok(parsed)
}

fn run_new(mut options: ParsedOptions) -> Result<String, BuilderError> {
    let template_path = PathBuf::from(options.take_required("template")?);
    let output_path = PathBuf::from(options.take_required("output")?);
    let topic = options.take_required("topic")?;
    let short_title = options
        .take_optional("short-title")
        .unwrap_or_else(|| topic.clone());
    let force = options.take_flag("force");

    let claimant = take_party(&mut options, "claimant")?;
    let defendant = take_party(&mut options, "defendant")?;
    let request = NewMatterRequest {
        template: load_template(template_path)?,
        case_id: CaseId::from(options.take_required("case-id")?),
        claimant,
        defendant,
        player_client_id: PartyId::from(options.take_required("player-client-id")?),
        topic,
        short_title,
        synopsis: options.take_optional("synopsis"),
    };
    options.ensure_empty()?;

    let identity = generate_matter_identity(request)?;
    write_identity(&output_path, &identity, force)?;

    Ok(format!(
        "Created {}\nCaption: {}\nPlayer client: {}\nOutput: {}",
        identity.case_id,
        identity.caption,
        identity.player_client_id,
        output_path.display()
    ))
}

fn run_clone(mut options: ParsedOptions) -> Result<String, BuilderError> {
    let source_path = PathBuf::from(options.take_required("source")?);
    let output_path = PathBuf::from(options.take_required("output")?);
    let force = options.take_flag("force");

    let claimant = take_party(&mut options, "claimant")?;
    let defendant = take_party(&mut options, "defendant")?;
    let request = CloneMatterRequest {
        source: read_identity(source_path)?,
        case_id: CaseId::from(options.take_required("case-id")?),
        claimant,
        defendant,
        player_client_id: PartyId::from(options.take_required("player-client-id")?),
        topic: options.take_optional("topic"),
        short_title: options.take_optional("short-title"),
        synopsis: options.take_optional("synopsis"),
    };
    options.ensure_empty()?;

    let identity = clone_matter_identity(request)?;
    write_identity(&output_path, &identity, force)?;

    Ok(format!(
        "Cloned {}\nCaption: {}\nPlayer client: {}\nOutput: {}",
        identity.case_id,
        identity.caption,
        identity.player_client_id,
        output_path.display()
    ))
}

fn run_inspect(mut options: ParsedOptions) -> Result<String, BuilderError> {
    let identity = read_identity(PathBuf::from(options.take_required("input")?))?;
    options.ensure_empty()?;

    let player = identity.player_client();
    let player_name = player
        .map(|party| party.display_name.as_str())
        .unwrap_or("<missing>");
    let player_role = player
        .map(|party| role_name(party.procedural_role))
        .unwrap_or("missing");

    Ok(format!(
        "Case ID: {}\nCaption: {}\nTopic: {}\nPlayer client: {}\nPlayer role: {}\nJurisdiction: {}\nPractice area: {}",
        identity.case_id,
        identity.caption,
        identity.topic,
        player_name,
        player_role,
        identity.jurisdiction,
        identity.practice_area
    ))
}

fn run_validate(mut options: ParsedOptions) -> Result<String, BuilderError> {
    let identity = read_identity(PathBuf::from(options.take_required("input")?))?;
    options.ensure_empty()?;

    let report = validate_matter_identity(&identity);
    if !report.is_valid() {
        let diagnostics = report
            .diagnostics()
            .iter()
            .filter(|diagnostic| diagnostic.severity == Severity::Error)
            .map(|diagnostic| {
                format!(
                    "{} {}: {}",
                    diagnostic.code, diagnostic.path, diagnostic.message
                )
            })
            .collect::<Vec<_>>()
            .join("\n");
        return Err(BuilderError::InvalidIdentity { diagnostics });
    }

    Ok(format!(
        "VALID {}\nWarnings: {}",
        identity.case_id,
        report.warning_count()
    ))
}

fn take_party(options: &mut ParsedOptions, prefix: &str) -> Result<PartyDraft, BuilderError> {
    let party_id = PartyId::from(options.take_required(&format!("{prefix}-id"))?);
    let display_name = options.take_required(&format!("{prefix}-name"))?;
    let client_contact = take_contact(options, prefix)?;

    Ok(PartyDraft {
        party_id,
        display_name,
        client_contact,
    })
}

fn take_contact(
    options: &mut ParsedOptions,
    prefix: &str,
) -> Result<Option<ClientContact>, BuilderError> {
    let id = options.take_optional(&format!("{prefix}-contact-id"));
    let name = options.take_optional(&format!("{prefix}-contact-name"));
    let role = options.take_optional(&format!("{prefix}-contact-role"));

    match (id, name, role) {
        (None, None, None) => Ok(None),
        (Some(id), Some(name), Some(role)) => Ok(Some(ClientContact {
            contact_id: ContactId::from(id),
            display_name: name,
            role,
        })),
        _ => Err(BuilderError::IncompleteContact {
            party: prefix.to_owned(),
        }),
    }
}

fn role_name(role: ProceduralRole) -> &'static str {
    match role {
        ProceduralRole::Claimant => "claimant",
        ProceduralRole::Defendant => "defendant",
        ProceduralRole::Appellant => "appellant",
        ProceduralRole::Respondent => "respondent",
        ProceduralRole::ThirdParty => "third_party",
    }
}

fn unicode(value: OsString) -> Result<String, BuilderError> {
    value
        .into_string()
        .map_err(|_| BuilderError::NonUnicodeArgument)
}
