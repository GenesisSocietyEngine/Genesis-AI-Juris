# Independent tax calculation review — 29 September 2026

Reviewer: /root/tax_independent_review. Scope: calculation crate only, ported from 3db5edc onto mobile base 268401. No tracked source changes, commits, pushes, native integration or deployment by reviewer.

## Disposition
No unresolved P1/P2 found in the reviewed calculation source after one corrective review cycle. This is code-review acceptance for the bounded calculation slice, not product-release acceptance. Full workspace/mobile/hosted validation remains the owner's separate gate.

Reviewed SHA256:
- src/lib.rs: A6F06942ABA1E12E31E963A251EA828FDC4E3029519CB80FE08BCF738E66F929
- src/ffi.rs: C86C93734F41D21AFA5687023B925CF7E11442061F377C7BCFCAFB761019CEFD
- tests/regressions.rs at retest: 606975BCE9180A4A6A859F12DF439CD95EB77990E56AC6677F2243E730F786DD (writer may subsequently add tests).

## Found and closed
P2: the first implementation used f64 for undiscounted implementation cost and summed discounted items in input order. Independent compiled probes reproduced a 43-cent loss on an immediate 768614336404564651-cent cost and NPV 10240 versus 9999 for reordered same-date signed offsets [i64::MAX, 10000, -i64::MAX]. First lib hash: DDB39288A8CE8EF2341A3867DD7D5B1120AA4DB370D1FC7133BC6E31825F1A9B.
The writer fixed this using exact i128 event aggregation across overlapping dated cash flows, exact time-zero cost, compensated deterministic discounted summation, and a typed numeric_precision refusal for extreme discounted magnitudes. Compiled revised probes return the exact immediate cost and NPV 9999 in both item orders. The limitation is explicit rather than silently returning fabricated cents.

## Independent executed evidence
- Recompiled and executed precision_probe.rs, oracle_probe.rs and ffi_terminal_probe.rs against the revised debug rlib; all completed successfully.
- 1000 independently expanded monthly schedules, horizons 1–240 and discount rates 1, 100, 1000, 10000 and 65535 bps: exact lifecycle equality and zero cents difference against the per-month powf NPV oracle. This sampled numeric evidence is not an exhaustive proof of floating-point accuracy.
- Fractional cost: implementation 0, annual maintenance 1 cent, horizon 1 month gives lifecycle/NPV 0 after final truncation and ROI -10000 bps, preserving the pre-rounding ratio.
- At a 12-month horizon and 1000 bps, terminal costs 11000 and 12100 give NPV exactly -10000 and -11000.
- Standalone tax-base, effective-base and v1-migration FFI helpers return typed arithmetic_overflow envelopes. Malformed JSON and null model pointers safely preserve the existing error envelope. Result JSON missing optimized annual tax cost is rejected.
- Checked source timing validation, signed item realization, negative tax effects, full u32 horizon/u16 discount domains, checked overflow/narrowing, explicit ROI unavailability, stale-derived-cache recomputation and no-default legacy result tax costs. No further defect identified within this scope.
