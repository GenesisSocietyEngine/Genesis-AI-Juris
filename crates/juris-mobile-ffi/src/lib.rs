//! Minimal C ABI used by the Flutter Android and iOS clients.
//!
//! The ABI intentionally exchanges only owned UTF-8 JSON strings. Protocol
//! evolution therefore remains in `juris-mobile-bridge`, while this crate is a
//! thin lifecycle and memory-ownership boundary.

use std::{
    ffi::{c_char, CStr, CString},
    panic::{catch_unwind, AssertUnwindSafe},
    sync::{Mutex, OnceLock},
};

use juris_mobile_bridge::MobileBridge;

static BRIDGE: OnceLock<Mutex<MobileBridge>> = OnceLock::new();

fn bridge() -> &'static Mutex<MobileBridge> {
    BRIDGE.get_or_init(|| Mutex::new(MobileBridge::new()))
}

fn error_json(code: &str, message: &str) -> String {
    serde_json::json!({
        "type": "error",
        "code": code,
        "message": message,
    })
    .to_string()
}

fn response_c_string(response: String) -> *mut c_char {
    CString::new(response)
        .unwrap_or_else(|_| {
            CString::new(error_json(
                "invalid_response",
                "bridge response contained an interior NUL byte",
            ))
            .expect("static bridge error must be a valid C string")
        })
        .into_raw()
}

/// Executes one JSON bridge request.
///
/// The returned string is owned by Rust and must be released exactly once with
/// [`juris_mobile_bridge_string_free`].
///
/// # Safety
///
/// `request` must be a non-null pointer to a valid NUL-terminated byte string
/// for the duration of this call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn juris_mobile_bridge_execute(request: *const c_char) -> *mut c_char {
    if request.is_null() {
        return response_c_string(error_json(
            "invalid_request_pointer",
            "request pointer must not be null",
        ));
    }

    let result = catch_unwind(AssertUnwindSafe(|| {
        // SAFETY: The caller contract requires a valid NUL-terminated string.
        let encoded = unsafe { CStr::from_ptr(request) };
        let encoded = match encoded.to_str() {
            Ok(value) => value,
            Err(error) => {
                return error_json(
                    "invalid_request_utf8",
                    &format!("request must be valid UTF-8: {error}"),
                );
            }
        };

        match bridge().lock() {
            Ok(mut endpoint) => endpoint.execute_json(encoded),
            Err(_) => error_json(
                "bridge_lock_poisoned",
                "the process bridge is unavailable after an internal failure",
            ),
        }
    }));

    response_c_string(result.unwrap_or_else(|_| {
        error_json(
            "bridge_panic",
            "the native bridge rejected an unexpected internal panic",
        )
    }))
}

/// Releases a response returned by [`juris_mobile_bridge_execute`].
///
/// Passing `null` is a no-op.
///
/// # Safety
///
/// `response` must be null or a pointer returned by
/// [`juris_mobile_bridge_execute`] that has not already been released.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn juris_mobile_bridge_string_free(response: *mut c_char) {
    if response.is_null() {
        return;
    }

    // SAFETY: The caller contract transfers back one pointer created with
    // `CString::into_raw`, exactly once.
    drop(unsafe { CString::from_raw(response) });
}

/// Returns a stable ABI version without allocating memory.
#[unsafe(no_mangle)]
pub extern "C" fn juris_mobile_bridge_abi_version() -> u32 {
    1
}

/// Test-only helper keeps null-pointer behavior observable without requiring a
/// caller to dereference the returned pointer.
#[cfg(test)]
fn execute_null_request() -> String {
    // SAFETY: A null request is explicitly supported and returns an error.
    let response = unsafe { juris_mobile_bridge_execute(std::ptr::null()) };
    // SAFETY: The bridge always returns one valid owned C string.
    let decoded = unsafe { CStr::from_ptr(response) }
        .to_string_lossy()
        .into_owned();
    // SAFETY: `response` has not been released yet.
    unsafe { juris_mobile_bridge_string_free(response) };
    decoded
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn null_request_returns_stable_error_and_abi_is_versioned() {
        assert_eq!(juris_mobile_bridge_abi_version(), 1);
        assert!(execute_null_request().contains("\"invalid_request_pointer\""));
    }

    #[test]
    fn malformed_json_round_trips_through_owned_c_strings() {
        let request = CString::new("{not-json").unwrap();
        // SAFETY: `request` is a valid C string for the complete call.
        let response = unsafe { juris_mobile_bridge_execute(request.as_ptr()) };
        // SAFETY: The bridge returned a valid C string.
        let decoded = unsafe { CStr::from_ptr(response) }
            .to_string_lossy()
            .into_owned();
        // SAFETY: The response is released exactly once.
        unsafe { juris_mobile_bridge_string_free(response) };

        assert!(decoded.contains("\"type\":\"error\""));
        assert!(decoded.contains("\"code\":\"invalid_request\""));
    }
}
