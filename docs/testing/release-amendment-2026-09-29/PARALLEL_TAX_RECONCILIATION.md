# Parallel tax follow-up reconciliation — 29 September 2026

This is a bounded architecture/PO reconciliation, not an application integration or release receipt. Root PO retains the accepted canonical calculation contract unless a defect is reproduced against that source. The frozen candidate remains unchanged; the parallel branch is not to be duplicate-cherry-picked.

## Evidence identity

| Evidence | Identity and scope |
|---|---|
| Uploaded report | `CURRENT_PROGRESS(5).md`, SHA256 `4e0f3602f3cb2da17d772215b0cb42c724f2cde616769446ae19d3ee9dfad3aa`, independently verified. The new follow-up is lines 386–416; v64/frontmatter is historical. |
| Parallel calculation source | `24f8f15a1d5e004bfb8eca8650030b6d0d92d091`; later documentation HEAD `e78b38f15e91acd7a43e7a275b79495b1967d44c`, independently read by the source reviewer. The attachment reports 39 local tests, not global readiness. |
| Accepted calculation contribution | `701395664d9baf9b4a170ef2fe6552456b1e6566`, based on mobile release `268401ab7dbc12cdc80c20a281268189aad01e60`; integrated with reviewed web/CI as `9b2ec6f85d7a2e92731c3b11c7941291fc5607fa`. |
| Canonical integration and frozen candidate | Root coordinator verified tax merge `688c57fc27020033e7e3bd827d2d690b0966eb99` and pushed candidate `54987950f86f75fb20a1fdbbf2e806719e56680e`. These are development/source identities, not deployments. |
| Accepted source readback | Independently rechecked `lib.rs` SHA256 `A6F06942ABA1E12E31E963A251EA828FDC4E3029519CB80FE08BCF738E66F929` and `ffi.rs` `C86C93734F41D21AFA5687023B925CF7E11442061F377C7BCFCAFB761019CEFD`; both match the accepted receipts. |

The accepted [contract](../tax-calculation-amendment-2026-09-29/REVIEW.md), [independent diagnostics](../tax-calculation-amendment-2026-09-29/INDEPENDENT_DIAGNOSTICS.md) and [integration receipt](../tax-calculation-amendment-2026-09-29/INTEGRATION.md) remain authoritative for this bounded library contribution.

## Shared corrections and contract decisions

The parallel commits address already accepted scope: effective tax-base/rate calculation, horizon annualization, maintenance counted once, unreduced negative tax effect, lifecycle-cost ROI, one-off NPV, terminal discounting and recurring benefit windows. Their existence does not require another implementation or branch merge.

| Topic | Retained canonical decision |
|---|---|
| ROI | Implementation plus horizon maintenance plus terminal cost is the denominator. Compute the ratio before final monetary truncation; explicitly distinguish nonpositive lifecycle cost from an out-of-range i32 ratio. |
| Timing and summaries | Month-end cash flows; inclusive positive start/end months; one-offs only at start; after-horizon items contribute nothing to lifecycle/NPV. Horizon remains positive u32 and discount the full u16 domain. Annual summaries and simple payback retain nominal run-rate meaning. |
| Rounding | Recognize an item once, carry accrual in twelfths of a cent, then truncate final lifecycle and NPV toward zero. Zero-discount NPV equals lifecycle net. The parallel requirement to reproduce legacy `3db5edc` full-window rounding is not adopted. |
| Precision and errors | Preserve checked wide arithmetic, exact time-zero cost and event aggregation before discounting, deterministic item-order behavior, and typed overflow/precision refusals. A sample tolerance does not authorize silently inaccurate cents. |
| API and persisted results | Preserve model JSON, C symbols/signatures and string ownership; numeric failures carry typed detail and Rust helpers return Result. Missing required baseline/optimized result fields are rejected, never defaulted to zero. Restore the input model and recompute; no saved-data integration or new model version is introduced. |

The attachment's qualified `ceil(H/12)` statement is not a general error bound: successive truncations can compound. Its five inline parity cases do not establish equivalence for arbitrary inputs or dated benefits, for which web has no corresponding contract. Source review found those fixtures copy web monetary numerals without the currency-unit-to-cent conversion and do not execute the canonical web function. The accepted fixture does execute the pinned web source and explicitly converts major units to cents.

## Independent diagnostic comparison

Independent Codex reviewer `/root/tax_independent_review` compiled and ran the same synthetic probe against both libraries using Rust 1.97.1; execution began `2026-09-29T11:43:01.2639321Z`, and both diagnostic processes exited 0. Panics below were caught deliberately by the diagnostic harness. An initial compiler/dependency-artifact version mismatch failed before execution; the explicit matching compiler resolved that tooling issue. This is not Claude review or a full package/hosted rerun.

Parallel SHA256: `lib.rs` `213E8C7840AC9FF08DB9A81CA6772276DD2A8203652FA46C9AC5822C00BE729D`; `ffi.rs` `E4732D5663CF724FF29DBC4D216766A2D12EE1E09B86352CC6D71375FCC3A6AA`. Accepted hashes are recorded above. The document reviewer independently read `compare.rs`, `parallel.log` and `accepted.log` under `C:/PROJECTS/Genesis-Juris-Tax-Calc-2026-09-29/.artifacts/tax-independent-review/parallel-comparison/`.

Amounts below are cents; ROI is basis points. Unless overridden: horizon 12 months, discount zero, costs/taxes zero, realization 10000, included recurring items start at month 1 without an end. `MAX` is i64::MAX. These inputs and outcomes retain the meaningful reproduction without importing another production implementation.

| Synthetic case | Parallel 24f8f15 | Accepted canonical |
|---|---|---|
| H18, tax 1000, recurring 5, maintenance 333, implementation 100, terminal 7 | Lifecycle/NPV 901; ROI 14867 after lifecycle-cost truncation to 606 | Lifecycle/NPV 901; ROI 14855. The attachment's 901 lifecycle case is preserved; denominator remains 606.5 before ratio calculation. |
| H1, maintenance 1 | Lifecycle/NPV 0; ROI unavailable | Lifecycle/NPV 0; ROI -10000, using the fractional positive cost. |
| H6, recurring 3, zero discount | Lifecycle 1; NPV 2 | Lifecycle 1; NPV 1. |
| H18, recurring 3, implementation 5 | Lifecycle/NPV -1; ROI -2000 | Lifecycle/NPV 0; ROI -1000 from the pre-truncation net amount. |
| Implementation 768614336404564651, discount 1 bp | NPV -768614336404564608: 43-cent loss | Exact NPV -768614336404564651. |
| Month-1 one-offs [MAX/2, 10000, -MAX/2] versus [MAX/2, -MAX/2, 10000], discount 1 bp | NPV 10240 versus 10000 | NPV 9999 in both orders. |
| Baseline tax MAX, optimized tax -1 | Panic | Typed arithmetic overflow for recognized annual tax saving. |
| H1, implementation MAX | Annualized net 12 from narrowing; NPV i64::MIN | Typed arithmetic overflow for annualized net benefit. |
| Taxable-income components MAX and 1 | Panic | Typed arithmetic overflow for total taxable income. |

Separate source inspection found parallel acceptance of a zero horizon or month-zero start and unchecked arithmetic still differ from the accepted validation/error contract. These are source-review findings, not extra executed cases in the table. No defect in the accepted main calculation source was reproduced by this comparison.

## Disposition and remaining scope

Retain the canonical contract and frozen candidate. Do not merge or cherry-pick the duplicate branch, restore legacy rounding, broaden tolerance to conceal a contract difference, or infer readiness from 39 local tests. The non-divisible-horizon and parity examples are useful review inputs; this comparison already covers the material gaps, so no redundant tests are added by this document. Any future failing case must first reproduce against canonical source under its documented units and semantics.

The first four comparisons expose rounding/ROI contract differences; the remaining cases expose precision or unchecked-arithmetic failures in the parallel source. The positive-discount result 9999 is deterministic under the documented final-truncation policy, not a claim of mathematically exact discounted NPV. Exactness here applies to integer event aggregation, time-zero cost and the zero-discount identity. Neither these probes nor a +/-1 fixture tolerance certify all floating-point inputs.

The attachment's missing release-based branch/remote/hosted evidence describes its own parallel history; it does not undo the accepted contribution's reviewed release-based integration and source-specific CI. Actual native/Flutter linkage, navigation, saved-data compatibility, PDF/web output and application end-to-end integration remain outside this library scope. They require separately scoped implementation and acceptance; no new integration or deployment authorization is inferred. Historical Site v64 statements do not describe current live production. The original 42-row UX ledger and INV01 are unchanged.

The original `C:/PROJECTS/Genesis-AI-Juris/Cargo.toml` formatting edit remains untouched. Independent readback still gives SHA256 `9C621537D520779FD29D49717015E394DF1A2CCCEA7DD9A52CAFFB611E434CED`.

Document authored by independent Codex architecture/product reviewer `/root/claude_product_acceptance`, using the separate Codex source review and executed diagnostics above. This task writes only this reconciliation document; it changes no application source, tests, dependency, lockfile, resource, membership or distribution. Git publication and the final release record remain the root coordinator's responsibility.
