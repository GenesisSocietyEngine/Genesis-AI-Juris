//! Stateless authoring commands. The native boundary derives the source index
//! from the supplied current canonical scenario, never a caller's index/hash.
use juris_engine::scenario_fingerprint;
use juris_scenario_schema::ScenarioDefinition;
use juris_tax_economics::{
    adapters::{
        bindings::{bind_components, ComponentBinding, CurrentSource},
        calculate_authoring,
        legacy::{import_legacy, LegacySchema},
        AdapterError,
    },
    hashing::input_hash,
    transport::{self, CalculationContext, TaxRequest},
    TaxBaseMode, TaxEconomicsV2,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(tag = "command", rename_all = "snake_case", deny_unknown_fields)]
enum TaxCommand {
    #[serde(rename = "tax_capabilities")]
    Capabilities,
    #[serde(rename = "tax_prepare")]
    Prepare {
        scenario: Box<ScenarioDefinition>,
        artifact_id: String,
        revision: String,
        currency: String,
    },
    #[serde(rename = "tax_calculate")]
    Calculate {
        scenario: Box<ScenarioDefinition>,
        request: Box<TaxRequest>,
        bindings: Vec<ComponentBinding>,
        required_component_ids: Vec<String>,
    },
    #[serde(rename = "tax_import")]
    Import {
        scenario: Box<ScenarioDefinition>,
        artifact_id: String,
        revision: String,
        schema: LegacySchema,
        original_json: String,
    },
}

fn source(scenario: &ScenarioDefinition) -> Result<CurrentSource, AdapterError> {
    if scenario.schema_version != juris_scenario_schema::SCENARIO_SCHEMA_VERSION_V1 {
        return Err(transport::BoundaryError::UnsupportedVersion {
            field: "scenario.schema_version".into(),
            value: scenario.schema_version.clone(),
        }
        .into());
    }
    Ok(CurrentSource {
        case_id: scenario.metadata.id.as_str().into(),
        scenario_fingerprint: scenario_fingerprint(scenario).map_err(|_| {
            AdapterError::StaleSource {
                field: "scenario".into(),
            }
        })?,
        fact_ids: scenario
            .facts
            .iter()
            .map(|f| f.id.as_str().into())
            .collect(),
        reference_ids: scenario
            .evidence
            .iter()
            .map(|e| e.id.as_str().into())
            .collect(),
    })
}

fn context(current: &CurrentSource, artifact_id: String, revision: String) -> CalculationContext {
    CalculationContext {
        case_id: current.case_id.clone(),
        scenario_fingerprint: current.scenario_fingerprint.clone(),
        artifact_id,
        revision,
    }
}

fn execute(command: TaxCommand) -> Result<Value, AdapterError> {
    match command {
        TaxCommand::Capabilities => Ok(
            json!({"type":"tax_capabilities", "transport_protocol":transport::TRANSPORT_PROTOCOL,
            "input_schema":transport::INPUT_SCHEMA, "result_schema":transport::RESULT_SCHEMA,
            "calculation_version":transport::CALCULATION_VERSION, "application_policy":transport::APPLICATION_POLICY,
            "currencies":transport::SUPPORTED_CURRENCIES, "max_request_bytes":transport::MAX_REQUEST_BYTES}),
        ),
        TaxCommand::Prepare {
            scenario,
            artifact_id,
            revision,
            currency,
        } => {
            let current = source(&scenario)?;
            let request = TaxRequest {
                transport_protocol: transport::TRANSPORT_PROTOCOL.into(),
                input_schema: transport::INPUT_SCHEMA.into(),
                application_policy: transport::APPLICATION_POLICY.into(),
                context: context(&current, artifact_id, revision),
                input: TaxEconomicsV2::new_default(currency).into(),
            };
            request.validate()?;
            Ok(json!({"type":"tax_prepared", "request":request, "source":current}))
        }
        TaxCommand::Calculate {
            scenario,
            request,
            bindings,
            required_component_ids,
        } => {
            let current = source(&scenario)?;
            // Always revalidate references and provenance, including in manual mode.
            let mut draft =
                bind_components(&request, &current, &required_component_ids, &bindings)?;
            if request.input.tax_base_mode == TaxBaseMode::ManualOverride {
                draft.request = *request;
                draft.input_hash = input_hash(&draft.request)?;
                draft.missing_inputs.clear();
            }
            // Incomplete inputs are returned with their full draft, never a zero result.
            match calculate_authoring(draft.request.clone()) {
                Ok(result) => Ok(
                    json!({"type":"tax_calculated", "draft":draft, "source":current, "calculation":result}),
                ),
                Err(detail) => Ok(
                    json!({"type":"tax_error", "detail":detail, "draft":draft, "source":current}),
                ),
            }
        }
        TaxCommand::Import {
            scenario,
            artifact_id,
            revision,
            schema,
            original_json,
        } => {
            let current = source(&scenario)?;
            let imported = import_legacy(
                schema,
                original_json,
                context(&current, artifact_id, revision),
            );
            Ok(json!({"type":"tax_imported", "legacy":imported, "source":current}))
        }
    }
}

pub(crate) fn execute_json(encoded: &str) -> Option<String> {
    // Borrow the tag and skip other JSON values without constructing their trees.
    #[derive(Deserialize)]
    struct Tag<'a> {
        #[serde(borrow)]
        command: &'a str,
    }
    let tag: Tag<'_> = serde_json::from_str(encoded).ok()?;
    if !matches!(
        tag.command,
        "tax_capabilities" | "tax_prepare" | "tax_calculate" | "tax_import"
    ) {
        return None;
    }
    let response = if encoded.len() > transport::MAX_REQUEST_BYTES {
        json!({"type":"tax_error", "detail":{"code":"boundary", "detail":{"code":"policy_rejected", "field":"payload", "reason":"tax command exceeds 256 KiB"}}})
    } else {
        match serde_json::from_str::<TaxCommand>(encoded) {
            Ok(command) => execute(command)
                .unwrap_or_else(|detail| json!({"type":"tax_error", "detail":detail})),
            Err(error) => {
                json!({"type":"tax_error", "detail":{"code":"boundary", "detail":{"code":"invalid_payload", "message":error.to_string()}}})
            }
        }
    };
    Some(response.to_string())
}
