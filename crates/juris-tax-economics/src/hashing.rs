//! The P0 input hash is a cache identity, not an artifact signature or permission.
use crate::transport::{BoundaryError, TaxInput, TaxRequest};
use serde::Serialize;
use sha2::{Digest, Sha256};

#[derive(Serialize)]
struct HashInput<'a> {
    input_schema: &'a str,
    application_policy: &'a str,
    scenario_fingerprint: &'a str,
    input: &'a TaxInput,
}
pub fn canonical_input_bytes(request: &TaxRequest) -> Result<Vec<u8>, BoundaryError> {
    request.validate()?;
    serde_json::to_vec(&HashInput {
        input_schema: &request.input_schema,
        application_policy: &request.application_policy,
        scenario_fingerprint: &request.context.scenario_fingerprint,
        input: &request.input,
    })
    .map_err(|error| BoundaryError::InvalidPayload {
        message: error.to_string(),
    })
}
pub fn input_hash(request: &TaxRequest) -> Result<String, BoundaryError> {
    canonical_input_bytes(request).map(|bytes| sha256(&bytes))
}
pub(crate) fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

/// Streaming structured identity for bounded adapter metadata; no encoded copy.
pub(crate) fn serialized_hash<T: Serialize>(value: &T) -> Result<String, BoundaryError> {
    struct HashWriter(Sha256);
    impl std::io::Write for HashWriter {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            self.0.update(bytes);
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut writer = HashWriter(Sha256::new());
    serde_json::to_writer(&mut writer, value).map_err(|error| BoundaryError::InvalidPayload {
        message: error.to_string(),
    })?;
    Ok(format!("{:x}", writer.0.finalize()))
}
