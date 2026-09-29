# Tax Economics v2: reconciled integration instructions

Date: 2026-09-29. This is the preserved integration plan with current implementation annotations. First milestone: **edit -> calculate in Rust -> save -> restart -> reopen with the same inputs and result**.

**Implementation checkpoint:** P0 is frozen in [CONTRACT.md](../tax-integration-p0-2026-09-29/CONTRACT.md). P1a merged through PR #63 as `77e37a0dffce619ccbc121dde051bb4eda6b19a8`: exact money parsing, versioned DTOs, bounded application policy and default-enabled `standalone-ffi` compatibility are implemented. Its reviewed source is `8c5422abb807fa1bd88583757ab71a584e8de2c4`; [P1A_REVIEW.md](../tax-integration-p0-2026-09-29/P1A_REVIEW.md) records local checks. Hosted Rust quality/MSRV passed at that source (push run 36603514205 and PR run 36603644104, attempt 1). These are pure-library results. Native commands, Flutter editing/persistence and web/PDF v2 integration remain unimplemented; the first user milestone is not complete.

**P1b merged checkpoint:** PR #66 merged normally as `8ca2747f3f694d4e55472f2a10f3c9babc644062` and contains functional source `64a99d505e407d80f03063d667027e5d11514c9a` and documentation-only successor `0f838d06cd8d4d1d9792aac15ad514ada6451c26`. Both explicit legacy adapters, lossless original/FX/inactive-base metadata, confirmed structured bindings checked against caller-supplied current source identity, and separate calculation/provenance hashes are implemented. [CONTRACT.md](../tax-integration-p1b-2026-09-29/CONTRACT.md) and [REVIEW.md](../tax-integration-p1b-2026-09-29/REVIEW.md) govern further integration. Final local checks passed 82 default / 77 no-default tests, both Clippy modes and Rust 1.78 checks; exact functional-source hosted Rust quality/MSRV passed on push and PR. The unused-base correction allows amounts calculations while keeping saved bases inactive and requiring explicit validated activation for rates. Main integration is recorded separately in [IMPLEMENTATION_CONTINUATION.md](IMPLEMENTATION_CONTINUATION.md).

Sections describing the original inspected source below are historical evidence. In particular, the previously proposed FFI feature gate and transport identifiers are now implemented/frozen by P0/P1a. Do not repeat those changes or infer that later application slices have shipped.

This document reconciles the uploaded integration plan with the accepted calculation contribution and canonical repository. It replaces the attachment's stale implementation-source instructions, not its useful mobile-first sequence. It does not add tax integration to the current Account/invitation release, authorize a mobile distribution, or claim native, browser or PDF acceptance. Preserve the original checkout and its existing Cargo.toml change.

## 1. Evidence and corrections

| Evidence | Pinned identity and disposition |
| --- | --- |
| User attachment | TAX_ECONOMICS_V2_INTEGRATION_PLAN.md; SHA256 `0da0d58eeea6e60226faa05bcd37f242ab4c6606027052d7f2a71d22a32683b1`. Reviewed as planning input, not current source. |
| Canonical source inspected | `bc4cd1d8fe3f8835c056401bfd873e72b7bc91ae`; tree `f8fa0d837567c32c4f8ab3469c9b2906e7ada86b`. Refresh remote main when implementation begins and record any later changes. |
| Accepted tax contribution | `701395664d9baf9b4a170ef2fe6552456b1e6566`, integrated with reviewed web/CI at `9b2ec6f85d7a2e92731c3b11c7941291fc5607fa`; PR #55 merge `688c57fc27020033e7e3bd827d2d690b0966eb99` is already in canonical main. |
| Required mobile lineage | `268401ab7dbc12cdc80c20a281268189aad01e60` is an ancestor of inspected main; the independent ancestry command returned 0. Ancestry does not replace the release-path and version comparison required below. |
| Accepted source bytes | lib.rs SHA256 `A6F06942ABA1E12E31E963A251EA828FDC4E3029519CB80FE08BCF738E66F929`; ffi.rs `C86C93734F41D21AFA5687023B925CF7E11442061F377C7BCFCAFB761019CEFD`; regressions.rs `50EED87D159A3966EA25F66418BF1AE713A541C9266C9567833EAF88B2C949EA`. lib/ffi hashes were independently read back in this review; the regression hash is from the accepted integration receipt. |
| Current web v1 reference | `bc4cd1d:app/tax-economics.ts`, Git blob `1c26baab49eb9c2160b8587748ceca4566ae4e9b`, independently fetched. It matches the web blob exercised by the accepted calculation review. It has no v2 dated-benefit contract. |
| Existing acceptance | Accepted integration receipt records 21 unit + 25 regression tests, 46 total, and package checks. This planning review did not rerun them. Later merged CI evidence belongs to the release receipts, not to the unimplemented mobile feature. |

| Attachment instruction | Reconciled instruction |
| --- | --- |
| Import three files from 24f8f15; retain 39 tests | Do not import that duplicate source. It has reproduced overflow, precision and rounding defects. Main already contains the stronger accepted crate and its 46 tests; preserve all four crate files, including regressions. See [parallel comparison](PARALLEL_TAX_RECONCILIATION.md). |
| Start from old mobile release and import the crate/CI | Start the feature worktree from a freshly recorded canonical main with required mobile ancestry and reviewed release-path differences. The required lineage and accepted crate/CI are already integrated. Do not transplant pilot Cargo.toml/Cargo.lock or repeat merged CI work. |
| Carry 240-month/5000-bps limits into Rust | Keep the core's positive u32 horizon and full u16 discount domain. Any editor/import restrictions are explicit versioned application policy, independently justified and enforced by the adapter. Never silently clamp imported values. |
| Finish unchecked core arithmetic and use legacy NPV rounding | Those defects were corrected in the accepted source. Retain checked arithmetic, fractional accrual and final truncation; add adapter validation without rewriting accepted formulas. Reproduce any newly suspected defect against canonical source first. |
| Map an existing invalid_benefit_window error | Canonical codes are missing_tax_base, unknown_tax_input_basis, arithmetic_overflow, numeric_precision and invalid_input. Timing uses invalid_input with field benefit_items.timing. A transport code must not masquerade as a pre-existing core variant. |
| Make standalone FFI non-default | Today's public ffi module and C symbols are unconditional. Removing them by default is a compatibility change. Prefer a default-enabled standalone-ffi feature with mobile opting out, subject to feature-unification and export checks described below. |
| CI candidate excludes tax; historical 702-page PDF evidence | Main already includes reviewed CI and the tax crate. Reuse current pinned workflows and current corpus. Release receipts report a later 47-file/760-page corpus; neither historical count certifies new v2 reports. |

The [accepted contract](../tax-calculation-amendment-2026-09-29/REVIEW.md), [integration receipt](../tax-calculation-amendment-2026-09-29/INTEGRATION.md) and [independent diagnostics](../tax-calculation-amendment-2026-09-29/INDEPENDENT_DIAGNOSTICS.md) govern calculation semantics. The duplicate branch is evidence to reconcile, not a second implementation to merge.

## 2. Scope and architecture

Use the existing Studio economics flow for tax-planning/compliance cases. A tax repository calls a versioned stateless command through the existing JSON mobile bridge, which calls the pure Rust calculation API. Existing juris-mobile-ffi owns response allocation/free. Results return through the same transport; widgets and report templates format them.

Keep scenario gameplay, replay, budgets, outcomes, graph-diagnostic UI and runtime session-save semantics outside this feature. Do not add a new top-level gameplay destination. Do not link the tax crate's standalone C calls directly into Dart as a second allocation protocol.

Web and reports must eventually consume the same Rust semantics. First prove a minimal WASM adapter in the actual browser, worker/SSR and Node report-test environments. Packaging, initialization, deterministic results and failure handling must all work. If a supported runtime cannot execute it, document a separately reviewed shared-Rust alternative before expanding infrastructure. Do not introduce an independent TypeScript v2 calculator or an unapproved hosting change.

The mobile milestone is complete after P0-P3 below. It remains mobile-only until web, reports and their acceptance are completed.

## 3. Contract to freeze before UI wiring

### Preserve the accepted numeric behavior

- All core money is signed integer cents; rates/fractions use integer basis points. Derived base is recomputed from included components unless manually overridden. Missing inputs remain distinct from zero.
- Amounts use entered tax costs; rates use the effective base. Carry a negative tax effect in full. Validate declared realization/probability and tax-rate fractions under the accepted contract.
- Implementation is at month zero; maintenance is charged once. Included benefit windows start at month 1 or later, end inclusively and cannot end before start. Start after the horizon is valid but contributes nothing to lifecycle/NPV. One-offs occur once at their start; terminal cost is discounted at the horizon.
- Recognize each item once after its combined realization/probability product. Carry annual accrual in twelfths of a cent; truncate final lifecycle and NPV amounts toward zero. Compute ROI against untruncated implementation + horizon maintenance + terminal cost. Zero-discount NPV equals lifecycle net.
- ROI is nullable with non_positive_lifecycle_cost or out_of_range reason; it is not zero when unavailable. Payback is a whole-month nominal operating-run-rate estimate, not dated cash-flow break-even. Annual summaries also retain nominal run-rate meaning.
- Keep checked i128 aggregation/conversion, exact time-zero cost, sorted event aggregation and compensated discounting. Discounted absolute interval contributions must remain below 2^44 cents; at or above the threshold return numeric_precision. This is a refusal boundary, not a universal one-cent error guarantee.
- Complexity scales with event boundaries rather than iterating every horizon month. Do not impose an artificial core horizon cap to solve a monthly-loop problem that the accepted implementation no longer has.
- Required historical result fields cannot default to zero. Restore validated inputs and recompute; when those inputs are absent, show historical/unavailable output.

Native and WASM executions of the same version must match the pinned integer contract. Legacy floating web comparisons need explicit unit conversion and documented field-specific expectations; a blanket tolerance must not conceal incorrect timing, lost cents, or a 100x amount error.

### Transport, money and policy

P0/P1a froze `tax-economics-input-v2`, `tax-economics-result-v2`, `tax-economics-json-v1`, calculation version `tax-economics-2026-09-29` and application policy `tax-editor-v1`. Use the implemented [P0 contract](../tax-integration-p0-2026-09-29/CONTRACT.md), including stable case/artifact ID, revision and source identity; these identifiers are no longer proposals.

At JavaScript-facing persistence/transport boundaries, encode monetary integers as canonical decimal strings and range-check conversion to i64; do not route them through unsafe JavaScript Number values. Basis points and bounded identifiers retain explicitly defined integer representations. An integer/string-only bridge DTO must preserve the existing BridgeResponse equality guarantee.

P0/P1a froze the initial two-decimal currency allowlist as EUR, GBP and USD. EUR 250000 major units must become 25000000 cents and display EUR 250000 after a round trip. Parse user decimals exactly; define rejection of excess precision, locale separators and unsafe legacy numeric values. Zero/three-decimal currencies require a separate scale-aware contract. Preserve unsupported legacy data intact and show v2 calculation unavailable. Preserve existing FX metadata without performing a new conversion during migration.

The implemented `tax-editor-v1` policy retains 1-240 months and 0-5000 discount bps without changing the core domain. P0/P1a define and enforce signed amount, text, item and payload limits and unique IDs. P1b defines current source-reference validation; callers must provide an authoritative current index. Enforce those limits at the adapter entry as well as UI; distinguish policy rejection from core invalid_input. Existing data outside policy must remain recoverable, with an explicit unsupported/edit-limited state, not silently clamped or discarded.

The bridge must preserve existing commands and error payloads. Add an explicit capability/protocol query with a graceful unsupported-feature path for older native libraries; the current library returns invalid_request for unknown commands. Do not interpret every invalid_request as a tax validation failure. Preserve C ABI version 1 unless a reviewed C ABI change actually requires another version. Any optional structured tax-error detail must leave older command/error serialization compatible.

### Derivation, migration and persistence

Implement case-fact-to-component mapping in an adapter with source anchors and missing-input diagnostics. TaxBaseDerivationStrategy alone does not extract facts. Apply category signs once; the core already subtracts expense categories. Validate override reason, owner and as-of provenance.

Build explicit migration adapters for both observed web v1 variants. Their camelCase models differ from the Rust test-oriented TaxEconomicsV1. Preserve amounts/rates selection, available base, horizon, assumptions and FX. The inspected current web default is 36 months; the core constructor uses 120. Adapters must supply the actual saved/product horizon. Map older operating annual benefit separately from the current web netAnnualBenefit, which includes implementation annualization; ROI percent is bps/100.

Do not inherit the migration helper's hard-coded US, 2026 or 2026-09-01 as factual provenance. Supply actual provenance or an explicit unknown state through the versioned adapter. Keep the original schema and data, make migration idempotent, and leave unsupported/failed conversions intact.

Persist a separately versioned authoring analysis artifact alongside the Studio workspace, keyed by stable case ID and scenario fingerprint/revision. Do not append an undocumented ScenarioDefinition field or alter the runtime session-save envelope. Specify aggregate workspace import/export with a legacy reader while retaining scenario-only import/export.

Inputs and provenance are authoritative. P2 must re-run binding validation against the application's authoritative current case/source index before calculation; caller-supplied IDs or hashes are not attestations. P3 must persist the complete `LegacyImport` (original JSON, FX and all inactive/unavailable metadata) and complete `BindingDraft` (including unfinished bindings and required component IDs), not only a generated calculation request. Bind cached results to `input_hash`, separately versioned `binding_hash_schema`/`binding_hash`, calculation version, case/artifact/revision and current source identity as specified by the [P1b contract](../tax-integration-p1b-2026-09-29/CONTRACT.md). Invalidate on input/provenance edits, migration, engine or reference changes. Save incomplete work as a draft with errors, not a successful zero calculation. Prevent an older asynchronous response from replacing a result for newer inputs.

Require atomic writes and recovery from interruption, missing sidecars, replaced cases and future schema versions. A downgrade may open the original scenario but must preserve the v2 artifact; it must not rewrite an aggregate and erase unsupported content. Reports bind the same artifact revision and calculation identity.

## 4. Native compatibility decision

At the historical planning source `bc4cd1d`, crates/juris-tax-economics/src/lib.rs exposed pub mod ffi unconditionally and Cargo.toml defined no feature gate. P1a has since implemented the default-enabled compatibility gate; mobile linkage and actual native feature/export validation remain P2 work. Existing standalone symbol names/signatures and string ownership were deliberately preserved in the accepted amendment. The crate is currently an rlib and is not a dependency of another Rust package; neither fact licenses silent removal of its public interface.

Preserved compatibility sequence. P1a completed item 1 and the feature-specific test gating in item 3; continue with the native integration and packaged-artifact checks rather than repeating those edits:

1. Add a default-enabled standalone-ffi feature around the existing public ffi module. Ordinary/default builds retain today's Rust module and C-callable entry points, signatures, response envelopes and juris_free_string ownership.
2. Let juris-mobile-bridge depend on the pure crate with default-features = false. Mobile uses only the existing juris_mobile_bridge_execute, juris_mobile_bridge_string_free and juris_mobile_bridge_abi_version C surface.
3. Gate FFI-specific test code deliberately; retain all 46 existing tests in the compatibility/default configuration. Run every applicable pure calculation regression in the no-default-features configuration and new tests in both relevant configurations.
4. Inspect cargo tree -e features for each actual native build. Cargo feature unification may re-enable the default feature through another dependency or workspace build. A manifest declaration alone is insufficient.
5. Audit produced Android libraries and every iOS archive slice for the complete allowed juris_* exports, not just the juris_mobile_bridge_* prefix. Preserve the existing export audit's coverage and test its rejection cases.
6. If actual packaged artifacts still leak auxiliary exports, stop and review a wrapper/build isolation alternative. Do not delete old exports, rename a free function, loosen the allowlist or change a caller's ownership protocol to make a check pass.

P1a completed the compatibility feature and test separation; the remaining native dependency, feature-unification and actual packaged-export checks are P2 work. The historical planning pass itself made no code changes.

## 5. Ordered instructions and acceptance

Before each slice, state the user outcome, exact owned paths and acceptance criteria. After it, inspect the diff, run focused relevant checks, independently review behavior/wording/accessibility and fix material findings before proceeding. Record verified, failed and unrun checks separately. A new finding reopens only the affected slice and dependent evidence.

| Slice | Implement within scope | Required exit evidence |
| --- | --- | --- |
| P0: source and contract | Inventory local HEAD, remote main, dirty paths and owners. Create an isolated integrate/tax-economics-v2-mobile worktree from fresh canonical main. Record required mobile ancestry, release-path/version differences, accepted tax hashes, toolchains and exact fixtures. Freeze units, versions, app policy and artifact identity. | No parallel source overwrite or duplicate import; each release-path difference has a disposition; unit/error/schema fixture review complete. Existing Cargo.toml formatting change remains untouched. |
| P1: pure boundary and adapters | Preserve the accepted calculator. Implement versioned DTOs, exact money conversion, case-fact mapping, legacy adapters and compatible FFI feature isolation. Extend fixtures for adapter-specific behavior. | Default compatibility retains all 46 tests; applicable pure tests pass without defaults; existing ABI/error envelopes preserved; new migration/unit/range fixtures pass. Package fmt, locked test/Clippy and supported MSRV checks pass. |
| P2: native transport | Add stateless tax/capability commands in juris-mobile-bridge and dependency configuration. Reuse mobile FFI and Dart allocation/free. Add a typed repository/error mapping; preserve older native/client behavior. | Built Android and iOS libraries execute success and each error class; repeated allocation/free and complete export audits pass; existing gameplay sessions, command logs and lifecycle remain unchanged. |
| P3: durable mobile slice | Wire tax repository into existing Studio economics views. Edit components, windows and provenance; show results, incomplete drafts and unavailable states. Persist versioned artifacts and aggregate import/export. | On a real native test path: edit -> calculate -> save -> terminate/restart -> reopen, reproducing inputs/result. Repeat with migration, downside, invalid input, stale cache, old library, interrupted save and future-schema preservation. Inspect narrow layouts, long labels, keyboard/focus and screen-reader labels. |
| P4: shared Rust web | Select fresh canonical web target, compare it to pinned v1 blob and prove WASM/runtime packaging. Implement adapter, migration, editor and persistence using the same fixtures. | Browser, worker/SSR and Node report tooling execute shared Rust; exact money display and both legacy variants pass; errors/readiness never synthesize values; no second v2 formula. |
| P5: reports | Project accepted versioned results into tax_position_memorandum and economic_assessment. Include components, timing, assumptions, sources, units and errors. Bind report identity to inputs and calculation version. | Same artifact yields agreed native/web/report values; EN/RU extraction, numeric assertions, pagination, long-content and visual QA pass. Stale reports are invalidated; existing report/graph corpus retained. |
| P6: integration candidate | Reconcile newer main, then run applicable pinned workflows/full release gates on the final functional candidate. Capture source, lockfiles, toolchains, artifact hashes, run/job IDs and actual terminal results. | Distinguish targeted tests, aggregate gate, PR-head CI, merge-source CI and product acceptance. All required feature gates pass or blockers are named; source is reviewable and synchronized. No release claim from a merge or package tests alone. |

Useful existing file groups, to recheck at the pinned implementation source:

- Native: crates/juris-mobile-bridge/{Cargo.toml,src/lib.rs}, crates/juris-mobile-ffi/{Cargo.toml,src/lib.rs}; mobile build scripts; .github/scripts/verify_ios_ffi_exports.sh and its tests.
- Dart/authoring: apps/juris-mobile/lib/data/{scenario_bridge_client.dart,native_scenario_bridge_client.dart,studio_authoring_repository.dart,studio_draft_store.dart}; app/juris_app.dart; models/studio_case_view_projection.dart; models/case_type_registry.dart; widgets/studio_case_views.dart; screens/studio_wizard_screen.dart.
- Native execution: apps/juris-mobile/integration_test/native_android_persistence_smoke_test.dart; native_ios_ffi_smoke_test.dart in the same directory; apps/juris-mobile/ios/RunnerTests/RunnerTests.swift.
- Web/report: app/{types.ts,tax-economics.ts,TaxEconomicsPanel.tsx,studio-tax-currency.ts,case-report.ts,report-manifest.v1.json}; existing report fixtures, PDF QA, parity baselines and scripts/verify-release.sh.

New files should follow repository naming conventions. Name each proposed addition in the slice manifest rather than scattering persistence or formulas across widgets.

## 6. Evidence matrix and release discipline

| Area | Cases that must be exercised |
| --- | --- |
| Calculation contract | Amounts/rates; derived/manual/incomplete bases; negative effects; nonpositive and fractional lifecycle cost; ROI unavailable reasons; payback meaning; 18-month accrual; recurring edges; one-off at month 0 rejected, at horizon included, beyond horizon excluded; terminal discount; checked extremes; deterministic order and precision refusals. Reuse accepted regressions rather than copy a second calculator. |
| Conversion/migration | EUR magnitude round trip; exact decimal parse; unsafe numeric rejection; signed category handling; missing versus zero; both legacy variants; original/FX retention; unsupported currency/policy; old results missing required fields; repeated migration; unavailable provenance. |
| Native behavior | Real library command success and errors, capability/old-library behavior, allocation/free, packaged symbols, gameplay-state immutability. Extend iOS XCTest because the hosted job executes it; a Dart test merely present in the tree is not execution evidence. |
| Mobile journey | Edit/save/restart/reopen, incomplete draft, migration, import/export, stale asynchronous result, artifact/source replacement, interruption recovery, future versions and downgrade preservation. |
| Browser/report | Shared Rust fixtures across target runtimes, exact amounts/null/error labels, source links, bilingual outputs, all produced PDF pages, stale-output identity and download freshness. |
| Delivery | Exact source/tree and functional-input hashes, dependency/toolchain pins, native/WASM artifacts, workflow/job links and terminal exits, independent review findings and dispositions. No credentials, real customer artifacts or private account data in public receipts. |

Use existing package checks as appropriate to the implemented feature configuration: cargo fmt -p juris-tax-economics -- --check; cargo test -p juris-tax-economics --locked; cargo clippy -p juris-tax-economics --all-targets --locked -- -D warnings; equivalent --no-default-features checks after P1; explicit compatibility-feature checks when added. Run changed bridge/FFI tests, relevant workspace checks and MSRV under the repository's pinned toolchain. Do not mass-format unrelated paths.

Reuse existing PDF QA and the exact applicable baseline environment. Do not set REPORT_PDF_UPDATE_VISUAL_BASELINE during routine verification. Any intentional output/baseline change needs a reviewed page-level explanation. Preserve historical evidence; new output requires new evidence.

Commit each coherent reviewed slice, and within the implementation task's publication authorization promptly push its task branch after an outgoing-content check. Use ordinary PR controls to integrate into main; record the actual remote SHA. Do not leave working feature changes only in a local worktree while waiting for unrelated provider or human release acceptance. Conversely, a development checkpoint does not establish application integration or deployment readiness.

Before feature publication, review the complete user journey and the applicable rollout/rollback requirements. Disable v2 use without erasing original or future-version artifacts; never relabel an older calculation as current. Do not weaken a failed native, data, PDF or hosted gate. Current Account/invitation release approval does not automatically extend to this separate feature.

## 7. Decisions and review record

P0/P1a have frozen the selected currencies, input policy and artifact identity/version/input-hash rules. P1b specifies both legacy import variants and the additional versioned binding identity; use those contracts rather than reopening settled choices. P4 must settle actual WASM packaging/initialization on the current web target. P5 must settle report identity and historical-versus-recomputed presentation. These are bounded decisions with the defaults above, not a request to redesign unrelated product areas.

This review read the supplied plan, repository AGENTS.md, the parallel reconciliation, accepted tax review/integration/diagnostics, current calculator and migration code, native JSON bridge/FFI, Dart free ownership and iOS export audit. Current tax workspace membership has no other Rust package dependency. That historical source review found no bridge tax command/capability and no standalone-ffi feature. The bridge remains pending; the feature gate is now implemented by P1a.

Independently retrieved Git blobs at bc4cd1d: tax lib 6a350a0af2d23a1b555ddf980a06a0f3bff13d64; tax ffi 53f094a93c1c891d7fa13a3027ba5f0c1eefe23f; regressions cfdef1296626425a544db2bed97e46175bfe922b; mobile bridge db8ce3afa0009d0ef6acd5aa98a145ee6bd60316; mobile FFI 6e75374e4b7fffb8516a148a920b269372c6603f; Dart native client a5a35e9607afe9cb362e3adc0564ba9a0c5ed5ba; iOS export audit b33a16a577fa87ec5f28c755e1a7eb2fcaca0bd0.

The original reconciliation pass authored only this planning document and changed no tax code, original checkout, runtime data, Git ref, package dependency, deployment or distribution. Later implementation is identified in the checkpoint above. New end-to-end application evidence remains pending.
