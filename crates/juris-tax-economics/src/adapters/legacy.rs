//! Explicit adapters for two pinned web v1 formats; never the core test-only V1.
use super::AdapterError;
use crate::{
    hashing::{input_hash, sha256},
    money::MoneyCents,
    transport::{
        CalculationContext, TaxInput, TaxRequest, APPLICATION_POLICY, INPUT_SCHEMA,
        MAX_REQUEST_BYTES, TRANSPORT_PROTOCOL,
    },
    TaxBaseMode, TaxEconomicsV2,
};
use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LegacySchema {
    WebAmountsV1,
    WebRatesFxV1,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LegacyImport {
    pub schema: LegacySchema,
    /// Exact supplied UTF-8 source, including whitespace and unknown content.
    pub original_json: String,
    pub original_sha256: String,
    pub status: ImportStatus,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ImportStatus {
    Converted { draft: Box<LegacyDraft> },
    Unavailable { reason: AdapterError },
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LegacyBaseProvenance {
    Unknown,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InactiveLegacyBase {
    pub amount: MoneyCents,
    /// Retain the original denomination even if the active draft later changes currency.
    pub currency: String,
    pub source_original_sha256: String,
    pub provenance: LegacyBaseProvenance,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LegacyDraft {
    pub request: TaxRequest,
    pub input_hash: String,
    /// Exact JSON token for FX metadata already applied by the old web app.
    pub fx_json: Option<String>,
    /// Saved amounts-mode aggregate: preserved, never an active or approved base.
    pub inactive_tax_base: Option<InactiveLegacyBase>,
    /// Active override blockers only; inactive candidate provenance is separate.
    /// Import does not invent an approving owner or as-of date.
    pub missing_override_provenance: Vec<String>,
    /// Unknown unused slots are explicit, not declared factual zero values.
    pub unavailable_legacy_fields: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WebAmounts {
    kind: String,
    currency: String,
    baseline_annual_tax_cost: Box<RawValue>,
    optimized_annual_tax_cost: Box<RawValue>,
    implementation_cost: Box<RawValue>,
    annual_maintenance_cost: Box<RawValue>,
    terminal_tax_or_unwind_cost: Box<RawValue>,
    analysis_horizon_months: Box<RawValue>,
    annual_discount_rate_bps: Box<RawValue>,
    benefit_realization_bps: Box<RawValue>,
    assumptions: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WebRatesFx {
    kind: String,
    currency: String,
    baseline_annual_tax_cost: Box<RawValue>,
    optimized_annual_tax_cost: Box<RawValue>,
    implementation_cost: Box<RawValue>,
    annual_maintenance_cost: Box<RawValue>,
    terminal_tax_or_unwind_cost: Box<RawValue>,
    analysis_horizon_months: Box<RawValue>,
    annual_discount_rate_bps: Box<RawValue>,
    benefit_realization_bps: Box<RawValue>,
    assumptions: Option<String>,
    tax_input_basis: String,
    annual_tax_base: Option<Box<RawValue>>,
    baseline_tax_rate_bps: Option<Box<RawValue>>,
    optimized_tax_rate_bps: Option<Box<RawValue>>,
    fx: Option<Box<RawValue>>,
}
struct Common {
    kind: String,
    currency: String,
    baseline_annual_tax_cost: Box<RawValue>,
    optimized_annual_tax_cost: Box<RawValue>,
    implementation_cost: Box<RawValue>,
    annual_maintenance_cost: Box<RawValue>,
    terminal_tax_or_unwind_cost: Box<RawValue>,
    analysis_horizon_months: Box<RawValue>,
    annual_discount_rate_bps: Box<RawValue>,
    benefit_realization_bps: Box<RawValue>,
    assumptions: Option<String>,
}
impl From<WebAmounts> for Common {
    fn from(value: WebAmounts) -> Self {
        Self {
            kind: value.kind,
            currency: value.currency,
            baseline_annual_tax_cost: value.baseline_annual_tax_cost,
            optimized_annual_tax_cost: value.optimized_annual_tax_cost,
            implementation_cost: value.implementation_cost,
            annual_maintenance_cost: value.annual_maintenance_cost,
            terminal_tax_or_unwind_cost: value.terminal_tax_or_unwind_cost,
            analysis_horizon_months: value.analysis_horizon_months,
            annual_discount_rate_bps: value.annual_discount_rate_bps,
            benefit_realization_bps: value.benefit_realization_bps,
            assumptions: value.assumptions,
        }
    }
}
impl From<WebRatesFx> for Common {
    fn from(value: WebRatesFx) -> Self {
        Self {
            kind: value.kind,
            currency: value.currency,
            baseline_annual_tax_cost: value.baseline_annual_tax_cost,
            optimized_annual_tax_cost: value.optimized_annual_tax_cost,
            implementation_cost: value.implementation_cost,
            annual_maintenance_cost: value.annual_maintenance_cost,
            terminal_tax_or_unwind_cost: value.terminal_tax_or_unwind_cost,
            analysis_horizon_months: value.analysis_horizon_months,
            annual_discount_rate_bps: value.annual_discount_rate_bps,
            benefit_realization_bps: value.benefit_realization_bps,
            assumptions: value.assumptions,
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Fx {
    provider: String,
    source_currency: String,
    target_currency: String,
    rate: Box<RawValue>,
    as_of: String,
}
fn invalid(field: &str, reason: &str) -> AdapterError {
    AdapterError::InvalidLegacy {
        field: field.into(),
        reason: reason.into(),
    }
}
fn parse<T: for<'de> Deserialize<'de>>(source: &str) -> Result<T, AdapterError> {
    serde_json::from_str(source).map_err(|error| invalid("legacy", &error.to_string()))
}
/// Bounded exact decimal coefficient/scale, with no f64 path.
fn decimal(raw: &str, field: &str) -> Result<(bool, u128, i32), AdapterError> {
    if raw.len() > 128 {
        return Err(invalid(field, "numeric token exceeds 128 bytes"));
    }
    let (negative, unsigned) = raw.strip_prefix('-').map_or((false, raw), |v| (true, v));
    let mut parts = unsigned.split(['e', 'E']);
    let mantissa = parts.next().unwrap_or("");
    let exponent = parts
        .next()
        .map(|v| v.parse::<i32>())
        .transpose()
        .map_err(|_| invalid(field, "unsupported exponent"))?
        .unwrap_or(0);
    if parts.next().is_some() || !(-38..=38).contains(&exponent) {
        return Err(invalid(field, "unsupported exponent"));
    }
    let mut digits = String::new();
    let mut fraction = 0i32;
    let mut dotted = false;
    for c in mantissa.bytes() {
        if c == b'.' && !dotted {
            dotted = true;
            continue;
        }
        if !c.is_ascii_digit() {
            return Err(invalid(field, "expected a JSON number"));
        }
        if digits.len() == 38 {
            return Err(invalid(field, "coefficient exceeds exact supported range"));
        }
        digits.push(char::from(c));
        if dotted {
            fraction += 1;
        }
    }
    let coefficient = digits
        .parse::<u128>()
        .map_err(|_| invalid(field, "invalid number"))?;
    Ok((negative, coefficient, fraction - exponent))
}
fn integer(raw: &RawValue, field: &str, maximum: u64) -> Result<u64, AdapterError> {
    let (negative, coefficient, scale) = decimal(raw.get(), field)?;
    if coefficient == 0 {
        return Ok(0);
    } // JS nonnegative checks historically accept -0.
    if negative {
        return Err(invalid(field, "legacy value must be nonnegative"));
    }
    let exact = if scale > 0 {
        let divisor = 10u128
            .checked_pow(scale as u32)
            .ok_or_else(|| invalid(field, "value is not an exact legacy integer"))?;
        if coefficient % divisor != 0 {
            return Err(invalid(field, "legacy major units must be integral"));
        }
        coefficient / divisor
    } else {
        coefficient
            .checked_mul(
                10u128
                    .checked_pow((-scale) as u32)
                    .ok_or_else(|| invalid(field, "value exceeds exact range"))?,
            )
            .ok_or_else(|| invalid(field, "value exceeds exact range"))?
    };
    if exact > u128::from(maximum) {
        return Err(invalid(field, "value exceeds the pinned legacy range"));
    }
    u64::try_from(exact).map_err(|_| invalid(field, "value exceeds exact range"))
}
fn money(raw: &RawValue, field: &str) -> Result<i64, AdapterError> {
    let major = integer(raw, field, 1_000_000_000_000)?;
    let cents = major
        .checked_mul(100)
        .ok_or_else(|| invalid(field, "cent conversion overflow"))?;
    i64::try_from(cents).map_err(|_| invalid(field, "cent conversion overflow"))
}
fn fx_metadata(raw: Option<&RawValue>, currency: &str) -> Result<Option<String>, AdapterError> {
    let Some(raw) = raw else {
        return Ok(None);
    };
    let fx: Fx = parse(raw.get())?;
    let source = fx.source_currency.trim().to_ascii_uppercase();
    let target = fx.target_currency.trim().to_ascii_uppercase();
    let (negative, coefficient, scale) = decimal(fx.rate.get(), "fx.rate")?;
    let digits = coefficient.to_string().len() as i32;
    let integer_digits = digits - scale;
    let above_maximum = integer_digits > 7
        || (integer_digits == 7 && coefficient > 10u128.pow((digits - 1) as u32));
    if fx.provider != "ECB"
        || source.len() != 3
        || !source.bytes().all(|b| b.is_ascii_uppercase())
        || target != currency
        || negative
        || coefficient == 0
        || above_maximum
        || !super::valid_date(&fx.as_of)
    {
        return Err(invalid("fx", "invalid historical FX metadata"));
    }
    Ok(Some(raw.get().to_owned()))
}
pub fn import_legacy(
    schema: LegacySchema,
    original_json: String,
    context: CalculationContext,
) -> LegacyImport {
    let original_sha256 = sha256(original_json.as_bytes());
    let status = match convert(schema, &original_json, &original_sha256, context) {
        Ok(draft) => ImportStatus::Converted {
            draft: Box::new(draft),
        },
        Err(reason) => ImportStatus::Unavailable { reason },
    };
    LegacyImport {
        schema,
        original_json,
        original_sha256,
        status,
    }
}
fn convert(
    schema: LegacySchema,
    source: &str,
    original_sha256: &str,
    context: CalculationContext,
) -> Result<LegacyDraft, AdapterError> {
    if source.len() > MAX_REQUEST_BYTES {
        return Err(invalid("legacy", "source exceeds 256 KiB"));
    }
    let (common, basis, base, baseline_rate, optimized_rate, fx) = match schema {
        LegacySchema::WebAmountsV1 => {
            let value: WebAmounts = parse(source)?;
            (
                Common::from(value),
                "amounts".to_owned(),
                None,
                None,
                None,
                None,
            )
        }
        LegacySchema::WebRatesFxV1 => {
            let mut value: WebRatesFx = parse(source)?;
            let basis = value.tax_input_basis.clone();
            let base = value.annual_tax_base.take();
            let baseline = value.baseline_tax_rate_bps.take();
            let optimized = value.optimized_tax_rate_bps.take();
            let fx = value.fx.take();
            (Common::from(value), basis, base, baseline, optimized, fx)
        }
    };
    if common.kind != "tax-economics-v1" {
        return Err(invalid("kind", "unsupported legacy schema"));
    }
    if basis != "amounts" && basis != "rates" {
        return Err(invalid("taxInputBasis", "unknown basis"));
    }
    let mut unavailable = Vec::new();
    for (field, missing) in [
        ("annualTaxBase", base.is_none()),
        ("baselineTaxRateBps", baseline_rate.is_none()),
        ("optimizedTaxRateBps", optimized_rate.is_none()),
    ] {
        if missing {
            unavailable.push(field.to_owned());
        }
    }
    if basis == "rates" && !unavailable.is_empty() {
        return Err(AdapterError::MissingLegacyInputs {
            fields: unavailable,
        });
    }
    let currency = common.currency.trim().to_ascii_uppercase();
    let fx_json = fx_metadata(fx.as_deref(), &currency)?;
    let mut core = TaxEconomicsV2::new_default(currency);
    core.tax_input_basis = basis;
    core.tax_base_formula_id = "legacy-web-saved-aggregate".into();
    core.tax_base_formula_version = "1".into();
    core.baseline_annual_tax_cost =
        money(&common.baseline_annual_tax_cost, "baselineAnnualTaxCost")?;
    core.optimized_annual_tax_cost =
        money(&common.optimized_annual_tax_cost, "optimizedAnnualTaxCost")?;
    core.implementation_cost = money(&common.implementation_cost, "implementationCost")?;
    core.annual_maintenance_cost = money(&common.annual_maintenance_cost, "annualMaintenanceCost")?;
    core.terminal_tax_or_unwind_cost = money(
        &common.terminal_tax_or_unwind_cost,
        "terminalTaxOrUnwindCost",
    )?;
    core.analysis_horizon_months = integer(
        &common.analysis_horizon_months,
        "analysisHorizonMonths",
        240,
    )? as u32;
    core.annual_discount_rate_bps = integer(
        &common.annual_discount_rate_bps,
        "annualDiscountRateBps",
        5000,
    )? as u16;
    core.benefit_realization_bps = integer(
        &common.benefit_realization_bps,
        "benefitRealizationBps",
        10000,
    )? as u16;
    core.baseline_tax_rate_bps = baseline_rate
        .as_deref()
        .map(|r| integer(r, "baselineTaxRateBps", 10000))
        .transpose()?
        .unwrap_or(0) as u16;
    core.optimized_tax_rate_bps = optimized_rate
        .as_deref()
        .map(|r| integer(r, "optimizedTaxRateBps", 10000))
        .transpose()?
        .unwrap_or(0) as u16;
    if common.assumptions.is_none() {
        unavailable.push("assumptions".into());
    }
    core.assumptions = common.assumptions.unwrap_or_default();
    let saved_base = base
        .as_deref()
        .map(|raw| money(raw, "annualTaxBase"))
        .transpose()?;
    let inactive_tax_base = if core.tax_input_basis == "amounts" {
        saved_base.map(|amount| InactiveLegacyBase {
            amount: MoneyCents::new(amount),
            currency: core.currency.clone(),
            source_original_sha256: original_sha256.into(),
            provenance: LegacyBaseProvenance::Unknown,
        })
    } else {
        None
    };
    let active_base = saved_base.filter(|_| core.tax_input_basis == "rates");
    let missing_override_provenance = if let Some(base) = active_base {
        core.tax_base_mode = TaxBaseMode::ManualOverride;
        core.annual_tax_base_override = Some(base);
        core.missing_tax_base_inputs.clear();
        core.override_reason = Some(
            "Imported saved legacy aggregate; derivation and approval provenance unavailable"
                .into(),
        );
        vec!["override_owner".into(), "override_as_of".into()]
    } else {
        core.missing_tax_base_inputs = vec!["annual_tax_base".into()];
        Vec::new()
    };
    let request = TaxRequest {
        transport_protocol: TRANSPORT_PROTOCOL.into(),
        input_schema: INPUT_SCHEMA.into(),
        application_policy: APPLICATION_POLICY.into(),
        context,
        input: TaxInput::from(core),
    };
    let input_hash = input_hash(&request)?;
    Ok(LegacyDraft {
        request,
        input_hash,
        fx_json,
        inactive_tax_base,
        missing_override_provenance,
        unavailable_legacy_fields: unavailable,
    })
}
