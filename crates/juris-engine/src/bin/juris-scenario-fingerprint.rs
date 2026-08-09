use std::{
    env,
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
    process::ExitCode,
};

use juris_engine::ScenarioSession;

fn main() -> ExitCode {
    match run(env::args_os().skip(1)) {
        Ok(count) => {
            println!("PASS verified {count} authoritative scenario fingerprints");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run<I>(arguments: I) -> Result<usize, String>
where
    I: IntoIterator<Item = OsString>,
{
    let mut arguments = arguments.into_iter();
    let mut count = 0;

    while let Some(option) = arguments.next() {
        if option.to_str() != Some("--expect") {
            return Err(format!(
                "unexpected argument `{}`; expected `--expect <fingerprint> <scenario.json>`",
                option.to_string_lossy()
            ));
        }
        let declared = arguments
            .next()
            .ok_or_else(|| "--expect requires a fingerprint".to_owned())?
            .into_string()
            .map_err(|_| "scenario fingerprint must be Unicode".to_owned())?;
        if !is_lowercase_sha256(&declared) {
            return Err(format!(
                "declared scenario fingerprint must be 64 lowercase hexadecimal characters: {declared}"
            ));
        }
        let path = PathBuf::from(
            arguments
                .next()
                .ok_or_else(|| "--expect requires a scenario path".to_owned())?,
        );
        verify_scenario_fingerprint(&path, &declared)?;
        count += 1;
    }

    if count == 0 {
        return Err(
            "at least one `--expect <fingerprint> <scenario.json>` pair is required".to_owned(),
        );
    }
    Ok(count)
}

fn verify_scenario_fingerprint(path: &Path, declared: &str) -> Result<(), String> {
    let encoded = fs::read_to_string(path)
        .map_err(|error| format!("could not read `{}`: {error}", path.display()))?;
    let session = ScenarioSession::from_json(&encoded, 0)
        .map_err(|error| format!("could not validate `{}`: {error}", path.display()))?;
    let authoritative = session
        .scenario_fingerprint()
        .map_err(|error| format!("could not fingerprint `{}`: {error}", path.display()))?;
    if declared != authoritative {
        return Err(format!(
            "scenario fingerprint mismatch for `{}`: declared {declared}, authoritative {authoritative}",
            path.display()
        ));
    }
    Ok(())
}

fn is_lowercase_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn repository_root() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
    }

    fn production_arguments() -> (Vec<OsString>, usize) {
        let root = repository_root();
        let manifest_path = root.join("content/archive/content_versions.v1.json");
        let manifest: Value = serde_json::from_str(
            &fs::read_to_string(&manifest_path).expect("production manifest must be readable"),
        )
        .expect("production manifest must be valid JSON");
        let mut arguments = Vec::new();
        let mut count = 0;

        for section in ["current_identities", "entries"] {
            let entries = manifest[section]
                .as_array()
                .unwrap_or_else(|| panic!("{section} must be an array"));
            assert!(!entries.is_empty(), "{section} must not be empty");
            for entry in entries {
                let fingerprint = entry["scenario_fingerprint"]
                    .as_str()
                    .expect("manifest fingerprint must be a string");
                let scenario_file = entry["scenario_file"]
                    .as_str()
                    .expect("manifest scenario_file must be a string");
                arguments.extend([
                    OsString::from("--expect"),
                    OsString::from(fingerprint),
                    root.join(scenario_file).into_os_string(),
                ]);
                count += 1;
            }
        }
        (arguments, count)
    }

    #[test]
    fn production_current_and_archive_pins_match_authoritative_fingerprints() {
        let (arguments, expected_count) = production_arguments();
        assert_eq!(run(arguments).unwrap(), expected_count);
    }

    #[test]
    fn stale_current_pin_is_rejected() {
        let path = repository_root().join("content/cases/greenfire_first_72_hours.scenario.json");
        let error = verify_scenario_fingerprint(&path, &"0".repeat(64)).unwrap_err();
        assert!(error.contains("scenario fingerprint mismatch"));
        assert!(error.contains("authoritative"));
    }

    #[test]
    fn stale_archive_pin_is_rejected() {
        let path = repository_root().join(
            "content/archive/greenfire_first_72_hours/0.1.0/greenfire_first_72_hours.scenario.json",
        );
        let error = verify_scenario_fingerprint(&path, &"f".repeat(64)).unwrap_err();
        assert!(error.contains("scenario fingerprint mismatch"));
        assert!(error.contains("authoritative"));
    }

    #[test]
    fn malformed_arguments_fail_before_any_scenario_is_read() {
        assert!(run(Vec::<OsString>::new())
            .unwrap_err()
            .contains("at least one"));
        assert!(
            run([OsString::from("--expect"), OsString::from("not-a-hash")])
                .unwrap_err()
                .contains("64 lowercase hexadecimal")
        );
    }
}
