use juris_mobile_bridge::MobileBridge;
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::path::Path;

const PROBE_SCHEMA_VERSION: u64 = 1;

#[derive(Default)]
struct ContractReceipt {
    snapshot_schema_revisions: BTreeSet<u64>,
    projection_schema_revisions: BTreeSet<u64>,
}

fn main() {
    let (output, failed) = match run() {
        Ok(output) => (output, false),
        Err(message) => (
            json!({
                "schema_version": PROBE_SCHEMA_VERSION,
                "runtime": "mobile-rust",
                "error": message,
            }),
            true,
        ),
    };

    // The probe is consumed as a subprocess protocol. Keep stdout strictly JSON,
    // including controlled failures, so callers never need to scrape diagnostics.
    println!(
        "{}",
        serde_json::to_string(&output).unwrap_or_else(|error| {
            json!({
                "schema_version": PROBE_SCHEMA_VERSION,
                "runtime": "mobile-rust",
                "error": format!("could not serialize probe output: {error}"),
            })
            .to_string()
        })
    );

    if failed {
        std::process::exit(1);
    }
}

fn run() -> Result<Value, String> {
    let arguments = env::args().collect::<Vec<_>>();
    if arguments.len() != 3 {
        return Err(format!(
            "usage: {} <mobile-case-bundle.json> <mobile-parity-fixtures.json>",
            arguments
                .first()
                .map(String::as_str)
                .unwrap_or("mobile-parity-probe")
        ));
    }

    let bundle = read_json(Path::new(&arguments[1]), "mobile case bundle")?;
    let fixtures = read_json(Path::new(&arguments[2]), "parity fixtures")?;
    let fixture_schema = required_u64(&fixtures, "schema_version", "parity fixtures")?;
    if fixture_schema != PROBE_SCHEMA_VERSION {
        return Err(format!(
            "unsupported parity fixture schema {fixture_schema}; expected {PROBE_SCHEMA_VERSION}"
        ));
    }

    let cases = required_array(&bundle, "cases", "mobile case bundle")?;
    let routes = required_array(&fixtures, "routes", "parity fixtures")?;
    if routes.is_empty() {
        return Err("parity fixtures contain no routes".to_owned());
    }

    let mut route_ids = BTreeSet::new();
    let mut contract_receipt = ContractReceipt::default();
    let mut results = Vec::with_capacity(routes.len());
    for (route_index, route) in routes.iter().enumerate() {
        let route_context = format!("route {}", route_index + 1);
        let route_id = required_str(route, "id", &route_context)?;
        if !route_ids.insert(route_id.to_owned()) {
            return Err(format!("duplicate parity route id `{route_id}`"));
        }

        let case_id = required_str(route, "case_id", route_id)?;
        let seed = required_u64(route, "seed", route_id)?;
        let commands = required_array(route, "commands", route_id)?;
        let case = find_case(cases, case_id)?;
        let scenario = required_value(case, "scenario", case_id)?.clone();
        if !scenario.is_object() {
            return Err(format!("case `{case_id}` scenario must be an object"));
        }
        let identity = case_identity(case, &scenario, case_id)?;

        let mut bridge = MobileBridge::new();
        let created = execute(
            &mut bridge,
            json!({
                "command": "create_session",
                "scenario": scenario.clone(),
                "seed": seed,
            }),
            "session_created",
            &format!("{route_id}: create session"),
        )?;
        let session_id = required_u64(&created, "session_id", route_id)?;
        let initial = normalize_snapshot(
            required_value(&created, "snapshot", route_id)?,
            &format!("{route_id}: initial snapshot"),
            &mut contract_receipt,
        )?;

        let mut checkpoints = Vec::with_capacity(commands.len());
        let mut final_snapshot = initial.clone();
        for (command_index, command) in commands.iter().enumerate() {
            let command_context = format!("{route_id}: command {}", command_index + 1);
            let request = command_request(command, session_id, &command_context)?;
            let response = execute(&mut bridge, request, "snapshot", &command_context)?;
            final_snapshot = normalize_snapshot(
                required_value(&response, "snapshot", &command_context)?,
                &format!("{command_context} snapshot"),
                &mut contract_receipt,
            )?;
            checkpoints.push(json!({
                "command": command,
                "snapshot": final_snapshot.clone(),
            }));
        }

        let saved = execute(
            &mut bridge,
            json!({"command": "save_session", "session_id": session_id}),
            "session_saved",
            &format!("{route_id}: save session"),
        )?;
        let encoded_save = required_str(&saved, "encoded_save", route_id)?.to_owned();
        let save_envelope: Value = serde_json::from_str(&encoded_save)
            .map_err(|error| format!("{route_id}: bridge returned invalid save JSON: {error}"))?;
        let save_summary = summarize_save(&save_envelope, commands.len(), route_id)?;

        let inspected = execute(
            &mut bridge,
            json!({
                "command": "inspect_save",
                "encoded_save": encoded_save.clone(),
            }),
            "save_inspected",
            &format!("{route_id}: inspect save"),
        )?;
        let inspection = json!({
            "scenario_id": required_str(&inspected, "scenario_id", route_id)?,
            "scenario_fingerprint": required_str(
                &inspected,
                "scenario_fingerprint",
                route_id,
            )?,
        });
        verify_inspection(&inspection, &identity, route_id)?;

        let loaded = execute(
            &mut bridge,
            json!({
                "command": "load_session",
                "scenario": scenario,
                "encoded_save": encoded_save.clone(),
            }),
            "session_loaded",
            &format!("{route_id}: load session"),
        )?;
        let loaded_session_id = required_u64(&loaded, "session_id", route_id)?;
        let loaded_snapshot = normalize_snapshot(
            required_value(&loaded, "snapshot", route_id)?,
            &format!("{route_id}: loaded snapshot"),
            &mut contract_receipt,
        )?;
        if loaded_snapshot != final_snapshot {
            return Err(format!(
                "{route_id}: save/load round-trip changed the normalized snapshot"
            ));
        }

        let resaved = execute(
            &mut bridge,
            json!({
                "command": "save_session",
                "session_id": loaded_session_id,
            }),
            "session_saved",
            &format!("{route_id}: save loaded session"),
        )?;
        if required_str(&resaved, "encoded_save", route_id)? != encoded_save {
            return Err(format!(
                "{route_id}: save/load round-trip changed the encoded command log"
            ));
        }

        results.push(json!({
            "id": route_id,
            "case_id": case_id,
            "seed": seed,
            "identity": identity,
            "initial": initial,
            "commands": checkpoints,
            "round_trip": {
                "inspection": inspection,
                "save": save_summary,
                "loaded_snapshot": loaded_snapshot,
                "matches_final": true,
                "resaved_matches": true,
            },
        }));
    }

    let snapshot_schema_revision = single_contract_revision(
        &contract_receipt.snapshot_schema_revisions,
        "mobile snapshot schema",
    )?;
    let projection_schema_revision = single_contract_revision(
        &contract_receipt.projection_schema_revisions,
        "mobile dossier projection schema",
    )?;

    Ok(json!({
        "schema_version": PROBE_SCHEMA_VERSION,
        "runtime": "mobile-rust",
        "contracts": {
            "mobile_snapshot_schema_revision": snapshot_schema_revision,
            "mobile_projection_schema_revision": projection_schema_revision,
            "mobile_bridge_abi": juris_mobile_ffi::juris_mobile_bridge_abi_version(),
        },
        "routes": results,
    }))
}

fn read_json(path: &Path, label: &str) -> Result<Value, String> {
    let encoded = fs::read_to_string(path)
        .map_err(|error| format!("could not read {label} `{}`: {error}", path.display()))?;
    serde_json::from_str(&encoded)
        .map_err(|error| format!("could not parse {label} `{}`: {error}", path.display()))
}

fn find_case<'a>(cases: &'a [Value], case_id: &str) -> Result<&'a Value, String> {
    let mut matching = cases
        .iter()
        .filter(|case| case.get("case_id").and_then(Value::as_str) == Some(case_id));
    let found = matching
        .next()
        .ok_or_else(|| format!("mobile case bundle does not contain `{case_id}`"))?;
    if matching.next().is_some() {
        return Err(format!(
            "mobile case bundle contains duplicate case id `{case_id}`"
        ));
    }
    Ok(found)
}

fn case_identity(case: &Value, scenario: &Value, case_id: &str) -> Result<Value, String> {
    let metadata = required_value(scenario, "metadata", case_id)?;
    Ok(json!({
        "case_id": case_id,
        "scenario_id": required_str(case, "scenario_id", case_id)?,
        "version": required_str(metadata, "content_version", case_id)?,
        "fingerprint": required_str(case, "scenario_fingerprint", case_id)?,
        "schema_revision": required_value(scenario, "schema_version", case_id)?,
    }))
}

fn command_request(command: &Value, session_id: u64, context: &str) -> Result<Value, String> {
    match required_str(command, "kind", context)? {
        "dispatch" => Ok(json!({
            "command": "dispatch",
            "session_id": session_id,
            "action_id": required_str(command, "action_id", context)?,
        })),
        "advance_time" => {
            let minutes = required_u64(command, "minutes", context)?;
            let minutes = u32::try_from(minutes)
                .map_err(|_| format!("{context}: `minutes` exceeds the mobile u32 range"))?;
            if minutes == 0 {
                return Err(format!("{context}: `minutes` must be positive"));
            }
            Ok(json!({
                "command": "advance_time",
                "session_id": session_id,
                "minutes": minutes,
            }))
        }
        kind => Err(format!("{context}: unknown command kind `{kind}`")),
    }
}

fn execute(
    bridge: &mut MobileBridge,
    request: Value,
    expected_type: &str,
    context: &str,
) -> Result<Value, String> {
    let encoded_request = serde_json::to_string(&request)
        .map_err(|error| format!("{context}: could not encode bridge request: {error}"))?;
    let encoded_response = bridge.execute_json(&encoded_request);
    let response: Value = serde_json::from_str(&encoded_response)
        .map_err(|error| format!("{context}: bridge returned invalid JSON: {error}"))?;
    let response_type = response
        .get("type")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("{context}: bridge response has no string `type`"))?;
    if response_type == "error" {
        let code = response
            .get("code")
            .and_then(Value::as_str)
            .unwrap_or("unknown_error");
        let message = response
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("bridge returned no error message");
        return Err(format!("{context}: bridge error `{code}`: {message}"));
    }
    if response_type != expected_type {
        return Err(format!(
            "{context}: expected bridge response `{expected_type}`, got `{response_type}`"
        ));
    }
    Ok(response)
}

fn normalize_snapshot(
    snapshot: &Value,
    context: &str,
    contracts: &mut ContractReceipt,
) -> Result<Value, String> {
    if !snapshot.is_object() {
        return Err(format!("{context}: snapshot must be an object"));
    }

    contracts.snapshot_schema_revisions.insert(required_u64(
        snapshot,
        "snapshot_schema_version",
        context,
    )?);
    let dossier = required_value(snapshot, "dossier", context)?;
    contracts.projection_schema_revisions.insert(required_u64(
        dossier,
        "projection_schema_version",
        context,
    )?);

    let mut actions = projected_ids(snapshot, "available_actions", context)?;
    let mut evidence = projected_ids(snapshot, "evidence", context)?;
    actions.sort();
    evidence.sort();

    let deadline_values = required_array(snapshot, "deadlines", context)?;
    let mut deadlines = Vec::with_capacity(deadline_values.len());
    for deadline in deadline_values {
        let id = required_str(deadline, "id", context)?;
        let status = required_value(deadline, "status", context)?;
        if !status.is_null() && !status.is_string() {
            return Err(format!(
                "{context}: deadline `{id}` status must be a string or null"
            ));
        }
        deadlines.push(json!({
            "id": id,
            "status": status,
            "due_minutes": required_u64(deadline, "due_at_minutes", context)?,
        }));
    }
    deadlines.sort_by(|left, right| {
        left.get("id")
            .and_then(Value::as_str)
            .cmp(&right.get("id").and_then(Value::as_str))
    });

    let inbox_values = required_array(snapshot, "inbox", context)?;
    let mut inbox = Vec::with_capacity(inbox_values.len());
    for item in inbox_values {
        inbox.push(json!({
            "id": required_str(item, "id", context)?,
            "resolved": required_bool(item, "resolved", context)?,
        }));
    }
    inbox.sort_by(|left, right| {
        left.get("id")
            .and_then(Value::as_str)
            .cmp(&right.get("id").and_then(Value::as_str))
    });

    let outcome = match snapshot.get("resolved_outcome") {
        None | Some(Value::Null) => Value::Null,
        Some(Value::String(id)) => Value::String(id.clone()),
        Some(_) => {
            return Err(format!(
                "{context}: `resolved_outcome` must be a string or null"
            ))
        }
    };
    let judicial_result = required_nullable_string(snapshot, "judicial_result", context)?;
    let dossier_judicial_result = required_nullable_string(dossier, "judicial_result", context)?;
    if dossier_judicial_result != judicial_result {
        return Err(format!(
            "{context}: dossier and top-level judicial results must match"
        ));
    }

    Ok(json!({
        "stage": required_str(snapshot, "stage_id", context)?,
        "clock": required_u64(snapshot, "clock_minutes", context)?,
        "actions": actions,
        "resources": optional_object(snapshot, "resources", context)?,
        "numeric_metrics": optional_object(snapshot, "numeric_metrics", context)?,
        "evidence": evidence,
        "deadlines": deadlines,
        "inbox": inbox,
        "judicial_result": judicial_result,
        "outcome": outcome,
    }))
}

fn single_contract_revision(revisions: &BTreeSet<u64>, label: &str) -> Result<u64, String> {
    if revisions.len() != 1 {
        return Err(format!(
            "{label} must have one invariant revision, observed {revisions:?}"
        ));
    }
    revisions
        .first()
        .copied()
        .ok_or_else(|| format!("{label} revision was not observed"))
}

fn projected_ids(snapshot: &Value, key: &str, context: &str) -> Result<Vec<String>, String> {
    required_array(snapshot, key, context)?
        .iter()
        .map(|item| required_str(item, "id", context).map(str::to_owned))
        .collect()
}

fn optional_object(snapshot: &Value, key: &str, context: &str) -> Result<Value, String> {
    match snapshot.get(key) {
        None | Some(Value::Null) => Ok(json!({})),
        Some(Value::Object(values)) => Ok(Value::Object(values.clone())),
        Some(_) => Err(format!("{context}: `{key}` must be an object or null")),
    }
}

fn summarize_save(
    envelope: &Value,
    expected_commands: usize,
    context: &str,
) -> Result<Value, String> {
    let commands = required_array(envelope, "commands", context)?;
    if commands.len() != expected_commands {
        return Err(format!(
            "{context}: save contains {} commands; expected {expected_commands}",
            commands.len()
        ));
    }
    Ok(json!({
        "schema_id": required_str(envelope, "schema_id", context)?,
        "schema_version": required_u64(envelope, "schema_version", context)?,
        "runtime_compatibility": required_str(envelope, "runtime_compatibility", context)?,
        "scenario_id": required_str(envelope, "scenario_id", context)?,
        "scenario_fingerprint": required_str(envelope, "scenario_fingerprint", context)?,
        "seed": required_u64(envelope, "seed", context)?,
        "command_count": commands.len(),
        "final_state_digest": required_str(envelope, "final_state_digest", context)?,
    }))
}

fn verify_inspection(inspection: &Value, identity: &Value, context: &str) -> Result<(), String> {
    if inspection.get("scenario_id") != identity.get("scenario_id") {
        return Err(format!(
            "{context}: inspected save scenario does not match bundle identity"
        ));
    }
    if inspection.get("scenario_fingerprint") != identity.get("fingerprint") {
        return Err(format!(
            "{context}: inspected save fingerprint does not match bundle identity"
        ));
    }
    Ok(())
}

fn required_value<'a>(value: &'a Value, key: &str, context: &str) -> Result<&'a Value, String> {
    value
        .get(key)
        .ok_or_else(|| format!("{context}: missing `{key}`"))
}

fn required_array<'a>(value: &'a Value, key: &str, context: &str) -> Result<&'a [Value], String> {
    required_value(value, key, context)?
        .as_array()
        .map(Vec::as_slice)
        .ok_or_else(|| format!("{context}: `{key}` must be an array"))
}

fn required_str<'a>(value: &'a Value, key: &str, context: &str) -> Result<&'a str, String> {
    required_value(value, key, context)?
        .as_str()
        .ok_or_else(|| format!("{context}: `{key}` must be a string"))
}

fn required_u64(value: &Value, key: &str, context: &str) -> Result<u64, String> {
    required_value(value, key, context)?
        .as_u64()
        .ok_or_else(|| format!("{context}: `{key}` must be a non-negative integer"))
}

fn required_bool(value: &Value, key: &str, context: &str) -> Result<bool, String> {
    required_value(value, key, context)?
        .as_bool()
        .ok_or_else(|| format!("{context}: `{key}` must be a boolean"))
}

fn required_nullable_string(value: &Value, key: &str, context: &str) -> Result<Value, String> {
    match required_value(value, key, context)? {
        Value::Null => Ok(Value::Null),
        Value::String(text) => Ok(Value::String(text.clone())),
        _ => Err(format!(
            "{context}: `{key}` must be a string or explicit null"
        )),
    }
}
