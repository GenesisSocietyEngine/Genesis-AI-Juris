//! The application supplies the current web source. This validates its descriptor,
//! not the omitted graph or the application's access authority.
use super::*;
use juris_tax_economics::adapters::bindings::{validate_source_identity, validate_source_index};

const SOURCE_SCHEMA: &str = "web-studio-tax-source-v1";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WebSource {
    source_schema: String,
    case_id: String,
    scenario_fingerprint: String,
    fact_ids: Vec<String>,
    reference_ids: Vec<String>,
}
impl WebSource {
    fn validate(self) -> Result<CurrentSource, AdapterError> {
        if self.source_schema != SOURCE_SCHEMA {
            return Err(transport::BoundaryError::UnsupportedVersion {
                field: "source.source_schema".into(),
                value: self.source_schema,
            }
            .into());
        }
        let current = CurrentSource {
            case_id: self.case_id,
            scenario_fingerprint: self.scenario_fingerprint,
            fact_ids: self.fact_ids,
            reference_ids: self.reference_ids,
        };
        validate_source_identity(&current)?;
        validate_source_index(&current)?;
        for (field, values) in [
            ("source.fact_ids", &current.fact_ids),
            ("source.reference_ids", &current.reference_ids),
        ] {
            if values.windows(2).any(|pair| pair[0] >= pair[1]) {
                return Err(AdapterError::InvalidBinding {
                    field: field.into(),
                    reason: "web source index must be sorted by UTF-8 bytes".into(),
                });
            }
        }
        if current
            .reference_ids
            .iter()
            .any(|id| current.fact_ids.binary_search(id).is_ok())
        {
            return Err(AdapterError::InvalidBinding {
                field: "source.reference_ids".into(),
                reason: "web source fact and reference identifiers must be disjoint".into(),
            });
        }
        Ok(current)
    }
}

#[derive(Deserialize)]
#[serde(tag = "command", deny_unknown_fields)]
enum WebCommand {
    // A struct-shaped empty variant is deliberate: the native unit variant
    // accepts extras. The new web capability must reject unknown fields.
    #[serde(rename = "tax_web_capabilities")]
    Capabilities {},
    #[serde(rename = "tax_web_prepare")]
    Prepare {
        source: WebSource,
        artifact_id: String,
        revision: String,
        currency: String,
    },
    #[serde(rename = "tax_web_calculate")]
    Calculate {
        source: WebSource,
        request: Box<TaxRequest>,
        bindings: Vec<ComponentBinding>,
        required_component_ids: Vec<String>,
    },
    #[serde(rename = "tax_web_import")]
    Import {
        source: WebSource,
        artifact_id: String,
        revision: String,
        schema: LegacySchema,
        original_json: String,
    },
}

pub(super) fn is_command(command: &str) -> bool {
    matches!(
        command,
        "tax_web_capabilities" | "tax_web_prepare" | "tax_web_calculate" | "tax_web_import"
    )
}
fn execute(command: WebCommand) -> Result<Value, AdapterError> {
    let mut response = match command {
        WebCommand::Capabilities {} => {
            json!({"type":"tax_web_capabilities", "transport_protocol":transport::TRANSPORT_PROTOCOL,
            "input_schema":transport::INPUT_SCHEMA, "result_schema":transport::RESULT_SCHEMA,
            "calculation_version":transport::CALCULATION_VERSION, "application_policy":transport::APPLICATION_POLICY,
            "currencies":transport::SUPPORTED_CURRENCIES, "max_request_bytes":transport::MAX_REQUEST_BYTES})
        }
        WebCommand::Prepare {
            source,
            artifact_id,
            revision,
            currency,
        } => super::prepare(source.validate()?, artifact_id, revision, currency)?,
        WebCommand::Calculate {
            source,
            request,
            bindings,
            required_component_ids,
        } => super::calculate(
            source.validate()?,
            request,
            bindings,
            required_component_ids,
        )?,
        WebCommand::Import {
            source,
            artifact_id,
            revision,
            schema,
            original_json,
        } => super::import(
            source.validate()?,
            artifact_id,
            revision,
            schema,
            original_json,
        ),
    };
    response["source_schema"] = json!(SOURCE_SCHEMA);
    Ok(response)
}
pub(super) fn execute_json(encoded: &str) -> Value {
    match serde_json::from_str::<WebCommand>(encoded) {
        Ok(command) => {
            execute(command).unwrap_or_else(|detail| json!({"type":"tax_error", "detail":detail}))
        }
        Err(error) => {
            json!({"type":"tax_error", "detail":{"code":"boundary", "detail":{"code":"invalid_payload", "message":error.to_string()}}})
        }
    }
}
