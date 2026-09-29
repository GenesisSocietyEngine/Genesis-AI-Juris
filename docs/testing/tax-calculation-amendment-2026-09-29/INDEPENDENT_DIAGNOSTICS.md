# Independent synthetic diagnostics - 29 September 2026
These standalone probes were compiled against the reviewed debug rlib. Synthetic values only; source and revised output retained for reproduction.

## precision_probe
```rust
use juris_tax_economics::*;
fn b(amount:i64)->TaxBenefitItem {TaxBenefitItem{id:"fixture".into(),label:"fixture".into(),benefit_type:BenefitType::Other,timing:BenefitTiming::OneOff,amount,start_month:1,end_month:None,realization_bps:None,probability_bps:None,source_node_ids:vec![],note:None,include_in_base_case:true}}
fn main(){
 let mut m=TaxEconomicsV2::new_default("EUR".into());
 m.analysis_horizon_months=12;
 m.annual_discount_rate_bps=1;
 m.implementation_cost=768_614_336_404_564_651;
 println!("IMMEDIATE={:?}",calculate_tax_economics_v2(&m).map(|r|r.npv));
 m.implementation_cost=0;
 for a in [[i64::MAX,10_000,-i64::MAX],[i64::MAX,-i64::MAX,10_000]] {
  m.benefit_items=a.into_iter().map(b).collect();
  println!("ORDER={a:?} RESULT={:?}",calculate_tax_economics_v2(&m).map(|r|(r.lifecycle_net_benefit,r.npv)));
 }
}

```
```text
IMMEDIATE=Ok(-768614336404564651)
ORDER=[9223372036854775807, 10000, -9223372036854775807] RESULT=Ok((10000, 9999))
ORDER=[9223372036854775807, -9223372036854775807, 10000] RESULT=Ok((10000, 9999))

```

## oracle_probe
```rust
use juris_tax_economics::*;use std::ffi::{CStr,CString};
fn b(amount:i64,timing:BenefitTiming,start:u32,end:Option<u32>)->TaxBenefitItem {TaxBenefitItem{id:"fixture".into(),label:"fixture".into(),benefit_type:BenefitType::Other,timing,amount,start_month:start,end_month:end,realization_bps:None,probability_bps:None,source_node_ids:vec![],note:None,include_in_base_case:true}}
fn m()->TaxEconomicsV2 {let mut m=TaxEconomicsV2::new_default("EUR".into());m.analysis_horizon_months=12;m.annual_discount_rate_bps=0;m}
fn main(){
 let mut model=m();model.analysis_horizon_months=1;model.annual_maintenance_cost=1;
 let r=calculate_tax_economics_v2(&model).unwrap();assert_eq!(r.lifecycle_net_benefit,0);assert_eq!(r.npv,0);assert_eq!(r.lifecycle_roi_bps,Some(-10000));println!("fractionalROI=PASS");
 let mut largest_diff=0;for seed in 1..=1000u32 {let mut model=m();let h=1+seed%240;model.analysis_horizon_months=h;model.annual_discount_rate_bps=[1,100,1000,10000,65535][seed as usize%5];model.implementation_cost=(seed as i64)*7;model.annual_maintenance_cost=99+(seed as i64)*11;model.terminal_tax_or_unwind_cost=200+(seed as i64)*13;model.baseline_annual_tax_cost=1000+(seed as i64)*21;
 model.benefit_items=vec![b(101+(seed as i64)*3,BenefitTiming::RecurringAnnual,1+seed%h,Some(h)),b(-77-(seed as i64)*2,BenefitTiming::OneOff,1+seed%h,None)];
 let mut expected=-(model.implementation_cost as f64);let rate=model.annual_discount_rate_bps as f64/10000.;let mut exact12=-(model.implementation_cost as i128+model.terminal_tax_or_unwind_cost as i128)*12;
 for month in 1..=h {let mut cents=(model.baseline_annual_tax_cost-model.annual_maintenance_cost) as f64/12.;let mut c12=(model.baseline_annual_tax_cost-model.annual_maintenance_cost) as i128;for item in &model.benefit_items {let contributes=month>=item.start_month&&month<=item.end_month.unwrap_or(h);if contributes {match item.timing {BenefitTiming::RecurringAnnual=>{cents+=item.amount as f64/12.;c12+=item.amount as i128},BenefitTiming::OneOff=>{if month==item.start_month {cents+=item.amount as f64;c12+=item.amount as i128*12}}}}}expected+=cents/(1.+rate).powf(month as f64/12.);exact12+=c12;}
 expected-=model.terminal_tax_or_unwind_cost as f64/(1.+rate).powf(h as f64/12.);let actual=calculate_tax_economics_v2(&model).unwrap();assert_eq!(actual.lifecycle_net_benefit,(exact12/12) as i64);let diff=(actual.npv-expected.trunc() as i64).abs();largest_diff=largest_diff.max(diff);assert!(diff<=1,"seed={seed} got={} expected={expected}",actual.npv);
 }println!("independent1000MonthScheduleOracle=PASS maxDiff={largest_diff}");
 let model=m();let mut result=serde_json::to_value(calculate_tax_economics_v2(&model).unwrap()).unwrap();result.as_object_mut().unwrap().remove("optimized_annual_tax_cost");assert!(serde_json::from_value::<TaxEconomicsCalculationResult>(result).is_err());println!("oldMissingOptimizedCost=REJECTED");
 for input in ["{}", "null", "[1]", "notJSON"] {let s=CString::new(input).unwrap();let p=ffi::juris_calculate_tax_economics(s.as_ptr());assert!(!p.is_null());let v:serde_json::Value=serde_json::from_str(unsafe{CStr::from_ptr(p)}.to_str().unwrap()).unwrap();assert!(v["error"].is_string());ffi::juris_free_string(p);}println!("malformedFFI=PASS");
 let p=ffi::juris_calculate_tax_economics(std::ptr::null());assert!(!p.is_null());ffi::juris_free_string(p);println!("nullFFI=PASS");
}

```
```text
fractionalROI=PASS
independent1000MonthScheduleOracle=PASS maxDiff=0
oldMissingOptimizedCost=REJECTED
malformedFFI=PASS
nullFFI=PASS

```

## ffi_terminal_probe
```rust
use juris_tax_economics::*;use std::ffi::{CStr,CString};use std::os::raw::c_char;
fn c(amount:i64)->TaxBaseComponent{TaxBaseComponent{id:"fixture".into(),label:"fixture".into(),category:TaxBaseComponentCategory::TaxableIncome,signed_amount:amount,source_type:"fixture".into(),source_node_id:None,source_field:"amount".into(),period:"annual".into(),jurisdiction:"BE".into(),evidence_status:"fixture".into(),include_in_calculation:true,note:String::new()}}
fn invoke(call:impl FnOnce(*const c_char)->*mut c_char,value:serde_json::Value){let s=CString::new(value.to_string()).unwrap();let p=call(s.as_ptr());assert!(!p.is_null());let v:serde_json::Value=serde_json::from_str(unsafe{CStr::from_ptr(p)}.to_str().unwrap()).unwrap();assert_eq!(v["detail"]["code"],"arithmetic_overflow");ffi::juris_free_string(p);}
fn main(){
 invoke(|p|ffi::juris_calculate_tax_base(p),serde_json::to_value(vec![c(i64::MAX),c(1)]).unwrap());
 let mut m=TaxEconomicsV2::new_default("EUR".into());m.tax_base_components=vec![c(i64::MAX),c(1)];m.missing_tax_base_inputs.clear();invoke(|p|ffi::juris_effective_annual_tax_base(p),serde_json::to_value(m).unwrap());
 let v=TaxEconomicsV1{kind:"tax-economics-v1".into(),currency:"EUR".into(),gross_annual_rent:Some(i64::MAX),rental_property_expenses:Some(-1),annual_loan_interest:Some(0),derived_annual_tax_base:Some(0),baseline_tax_rate_bps:0,optimized_tax_rate_bps:0,baseline_annual_tax_cost:0,optimized_annual_tax_cost:0,implementation_cost:0,annual_maintenance_cost:0,terminal_tax_or_unwind_cost:0,analysis_horizon_months:12,annual_discount_rate_bps:0,benefit_realization_bps:10000,assumptions:String::new()};invoke(|p|ffi::juris_migrate_v1_to_v2(p),serde_json::to_value(v).unwrap());
 println!("standaloneBaseEffectiveMigrationOverflowEnvelopes=PASS");
 for terminal in [11000,12100] {let mut m=TaxEconomicsV2::new_default("EUR".into());m.analysis_horizon_months=12;m.annual_discount_rate_bps=1000;m.terminal_tax_or_unwind_cost=terminal;println!("TERMINAL={terminal} NPV={:?}",calculate_tax_economics_v2(&m).map(|r|r.npv));}
}

```
```text
standaloneBaseEffectiveMigrationOverflowEnvelopes=PASS
TERMINAL=11000 NPV=Ok(-10000)
TERMINAL=12100 NPV=Ok(-11000)

```
