//! FFI (Foreign Function Interface) bindings for Flutter/Dart
//!
//! Exposes Rust tax-economics functions as C-callable interfaces for use in Flutter
//! mobile apps. All data is serialized to JSON strings for cross-boundary compatibility.

use crate::*;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

/// Initialize the FFI module (for future use)
#[no_mangle]
pub extern "C" fn juris_tax_economics_init() -> i32 {
    0 // Success
}

// ============================================================================
// TAX BASE CALCULATION
// ============================================================================

/// Calculate tax base from JSON components array
/// # Arguments
/// * `components_json` - JSON string of TaxBaseComponent[]
/// # Returns
/// Pointer to C-allocated JSON string of TaxBaseCalculationResult
/// The caller must free the result using juris_free_string
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn juris_calculate_tax_base(components_json: *const c_char) -> *mut c_char {
    if components_json.is_null() {
        return allocate_error_string("components_json is null");
    }

    let components_str = match unsafe { CStr::from_ptr(components_json).to_str() } {
        Ok(s) => s,
        Err(_) => return allocate_error_string("Invalid UTF-8 in components_json"),
    };

    let components: Vec<TaxBaseComponent> = match serde_json::from_str(components_str) {
        Ok(c) => c,
        Err(e) => return allocate_error_string(&format!("Failed to parse components: {}", e)),
    };

    let result = match calculate_tax_base_from_components(&components) {
        Ok(value) => value,
        Err(error) => return allocate_calculation_error(error),
    };
    match serde_json::to_string(&result) {
        Ok(json) => allocate_string(&json),
        Err(e) => allocate_error_string(&format!("Failed to serialize result: {}", e)),
    }
}

/// Get effective annual tax base (override priority)
/// # Arguments
/// * `model_json` - JSON string of TaxEconomicsV2
/// # Returns
/// JSON string: `{"base": <i64> | null, "is_override": bool}`
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn juris_effective_annual_tax_base(model_json: *const c_char) -> *mut c_char {
    if model_json.is_null() {
        return allocate_error_string("model_json is null");
    }

    let model_str = match unsafe { CStr::from_ptr(model_json).to_str() } {
        Ok(s) => s,
        Err(_) => return allocate_error_string("Invalid UTF-8 in model_json"),
    };

    let model: TaxEconomicsV2 = match serde_json::from_str(model_str) {
        Ok(m) => m,
        Err(e) => return allocate_error_string(&format!("Failed to parse model: {}", e)),
    };

    let base = match effective_annual_tax_base(&model) {
        Ok(value) => value,
        Err(error) => return allocate_calculation_error(error),
    };
    let response = serde_json::json!({
        "base": base,
        "is_override": model.tax_base_mode == TaxBaseMode::ManualOverride
    });

    match serde_json::to_string(&response) {
        Ok(json) => allocate_string(&json),
        Err(e) => allocate_error_string(&format!("Failed to serialize response: {}", e)),
    }
}

// ============================================================================
// BENEFIT CALCULATION
// ============================================================================

/// Calculate recognized benefits from items
/// # Arguments
/// * `items_json` - JSON string of TaxBenefitItem[]
/// * `global_realization_bps` - Global realization in basis points (0-10000)
/// # Returns
/// JSON string of RecognizedBenefitsResult
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn juris_calculate_recognized_benefits(
    items_json: *const c_char,
    global_realization_bps: u16,
) -> *mut c_char {
    if items_json.is_null() {
        return allocate_error_string("items_json is null");
    }

    let items_str = match unsafe { CStr::from_ptr(items_json).to_str() } {
        Ok(s) => s,
        Err(_) => return allocate_error_string("Invalid UTF-8 in items_json"),
    };

    let items: Vec<TaxBenefitItem> = match serde_json::from_str(items_str) {
        Ok(i) => i,
        Err(e) => return allocate_error_string(&format!("Failed to parse items: {}", e)),
    };

    let result = match calculate_recognized_benefits(&items, global_realization_bps) {
        Ok(value) => value,
        Err(error) => return allocate_calculation_error(error),
    };
    match serde_json::to_string(&result) {
        Ok(json) => allocate_string(&json),
        Err(e) => allocate_error_string(&format!("Failed to serialize result: {}", e)),
    }
}

// ============================================================================
// TAX ECONOMICS CALCULATION
// ============================================================================

/// Calculate complete tax economics with all intermediate values
/// # Arguments
/// * `model_json` - JSON string of TaxEconomicsV2
/// # Returns
/// JSON string of TaxEconomicsCalculationResult, or
/// `{"error": ..., "detail": TaxEconomicsError}` when inputs are incomplete
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn juris_calculate_tax_economics(model_json: *const c_char) -> *mut c_char {
    if model_json.is_null() {
        return allocate_error_string("model_json is null");
    }

    let model_str = match unsafe { CStr::from_ptr(model_json).to_str() } {
        Ok(s) => s,
        Err(_) => return allocate_error_string("Invalid UTF-8 in model_json"),
    };

    let model: TaxEconomicsV2 = match serde_json::from_str(model_str) {
        Ok(m) => m,
        Err(e) => return allocate_error_string(&format!("Failed to parse model: {}", e)),
    };

    let result = match calculate_tax_economics_v2(&model) {
        Ok(r) => r,
        Err(error) => return allocate_calculation_error(error),
    };
    match serde_json::to_string(&result) {
        Ok(json) => allocate_string(&json),
        Err(e) => allocate_error_string(&format!("Failed to serialize result: {}", e)),
    }
}

// ============================================================================
// GRAPH INTEGRITY DIAGNOSTICS
// ============================================================================

/// Analyze graph integrity and return structured diagnostics
/// # Arguments
/// * `nodes_json` - JSON string of GraphNode[]
/// * `links_json` - JSON string of GraphLink[]
/// # Returns
/// JSON string of IntegrityDiagnostic[]
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn juris_analyze_graph_integrity(
    nodes_json: *const c_char,
    links_json: *const c_char,
) -> *mut c_char {
    if nodes_json.is_null() || links_json.is_null() {
        return allocate_error_string("nodes_json or links_json is null");
    }

    let nodes_str = match unsafe { CStr::from_ptr(nodes_json).to_str() } {
        Ok(s) => s,
        Err(_) => return allocate_error_string("Invalid UTF-8 in nodes_json"),
    };

    let links_str = match unsafe { CStr::from_ptr(links_json).to_str() } {
        Ok(s) => s,
        Err(_) => return allocate_error_string("Invalid UTF-8 in links_json"),
    };

    let nodes: Vec<GraphNode> = match serde_json::from_str(nodes_str) {
        Ok(n) => n,
        Err(e) => return allocate_error_string(&format!("Failed to parse nodes: {}", e)),
    };

    let links: Vec<GraphLink> = match serde_json::from_str(links_str) {
        Ok(l) => l,
        Err(e) => return allocate_error_string(&format!("Failed to parse links: {}", e)),
    };

    let diagnostics = analyze_graph_integrity(&nodes, &links);
    match serde_json::to_string(&diagnostics) {
        Ok(json) => allocate_string(&json),
        Err(e) => allocate_error_string(&format!("Failed to serialize diagnostics: {}", e)),
    }
}

/// Check if graph is healthy for playability
/// # Returns
/// 1 if healthy, 0 if contains errors
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn juris_is_graph_healthy(
    nodes_json: *const c_char,
    links_json: *const c_char,
) -> i32 {
    if nodes_json.is_null() || links_json.is_null() {
        return 0;
    }

    let nodes_str = match unsafe { CStr::from_ptr(nodes_json).to_str() } {
        Ok(s) => s,
        Err(_) => return 0,
    };

    let links_str = match unsafe { CStr::from_ptr(links_json).to_str() } {
        Ok(s) => s,
        Err(_) => return 0,
    };

    let nodes: Vec<GraphNode> = match serde_json::from_str(nodes_str) {
        Ok(n) => n,
        Err(_) => return 0,
    };

    let links: Vec<GraphLink> = match serde_json::from_str(links_str) {
        Ok(l) => l,
        Err(_) => return 0,
    };

    if is_graph_healthy(&nodes, &links) {
        1
    } else {
        0
    }
}

// ============================================================================
// V1 MIGRATION
// ============================================================================

/// Migrate v1 model to v2
/// # Arguments
/// * `v1_json` - JSON string of TaxEconomicsV1
/// # Returns
/// JSON string of TaxEconomicsV2
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn juris_migrate_v1_to_v2(v1_json: *const c_char) -> *mut c_char {
    if v1_json.is_null() {
        return allocate_error_string("v1_json is null");
    }

    let v1_str = match unsafe { CStr::from_ptr(v1_json).to_str() } {
        Ok(s) => s,
        Err(_) => return allocate_error_string("Invalid UTF-8 in v1_json"),
    };

    let v1: TaxEconomicsV1 = match serde_json::from_str(v1_str) {
        Ok(m) => m,
        Err(e) => return allocate_error_string(&format!("Failed to parse v1 model: {}", e)),
    };

    let v2 = match migrate_v1_to_v2(&v1) {
        Ok(value) => value,
        Err(error) => return allocate_calculation_error(error),
    };
    match serde_json::to_string(&v2) {
        Ok(json) => allocate_string(&json),
        Err(e) => allocate_error_string(&format!("Failed to serialize v2 model: {}", e)),
    }
}

// ============================================================================
// MEMORY MANAGEMENT
// ============================================================================

/// Free a C-allocated string
/// # Arguments
/// * `ptr` - Pointer to string allocated by FFI functions
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn juris_free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Allocate and return a C-string
fn allocate_string(s: &str) -> *mut c_char {
    CString::new(s)
        .map(|cs| cs.into_raw())
        .unwrap_or_else(|_| std::ptr::null_mut())
}

fn allocate_calculation_error(error: TaxEconomicsError) -> *mut c_char {
    allocate_string(
        &serde_json::json!({
            "error": "Tax economics calculation could not be completed",
            "detail": error
        })
        .to_string(),
    )
}

/// Allocate and return an error JSON response
fn allocate_error_string(message: &str) -> *mut c_char {
    let error_json = serde_json::json!({
        "error": message
    })
    .to_string();
    allocate_string(&error_json)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ffi_calculate_tax_base() {
        let components = vec![TaxBaseComponent {
            id: "1".to_string(),
            label: "Income".to_string(),
            category: TaxBaseComponentCategory::TaxableIncome,
            signed_amount: 100_000,
            source_type: "test".to_string(),
            source_node_id: None,
            source_field: "income".to_string(),
            period: "2026".to_string(),
            jurisdiction: "US".to_string(),
            evidence_status: "estimated".to_string(),
            include_in_calculation: true,
            note: "Test".to_string(),
        }];

        let json = serde_json::to_string(&components).unwrap();
        let json_cstr = CString::new(json).unwrap();

        let result_ptr = juris_calculate_tax_base(json_cstr.as_ptr());
        assert!(!result_ptr.is_null());

        let result_str = unsafe { CStr::from_ptr(result_ptr).to_string_lossy() };
        assert!(result_str.contains("calculated_tax_base"));

        juris_free_string(result_ptr);
    }

    #[test]
    fn test_ffi_migrate_v1_to_v2() {
        let v1 = TaxEconomicsV1 {
            kind: "tax-economics-v1".to_string(),
            currency: "USD".to_string(),
            gross_annual_rent: Some(100_000),
            rental_property_expenses: Some(20_000),
            annual_loan_interest: Some(15_000),
            derived_annual_tax_base: Some(65_000),
            baseline_tax_rate_bps: 2100,
            optimized_tax_rate_bps: 1500,
            baseline_annual_tax_cost: 13_650,
            optimized_annual_tax_cost: 9_750,
            implementation_cost: 50_000,
            annual_maintenance_cost: 2_000,
            terminal_tax_or_unwind_cost: 5_000,
            analysis_horizon_months: 120,
            annual_discount_rate_bps: 800,
            benefit_realization_bps: 10000,
            assumptions: "Test".to_string(),
        };

        let json = serde_json::to_string(&v1).unwrap();
        let json_cstr = CString::new(json).unwrap();

        let result_ptr = juris_migrate_v1_to_v2(json_cstr.as_ptr());
        assert!(!result_ptr.is_null());

        let result_str = unsafe { CStr::from_ptr(result_ptr).to_string_lossy() };
        assert!(result_str.contains("tax-economics-v2"));
        assert!(result_str.contains("65000"));

        juris_free_string(result_ptr);
    }
}
