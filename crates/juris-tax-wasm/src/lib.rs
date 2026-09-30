//! Maintained string transport for the shared Rust tax protocol.
#![forbid(unsafe_code)]

use wasm_bindgen::prelude::wasm_bindgen;

#[must_use]
#[wasm_bindgen]
pub fn execute_tax_json(encoded: &str) -> Option<String> {
    juris_mobile_bridge::execute_tax_json(encoded)
}
