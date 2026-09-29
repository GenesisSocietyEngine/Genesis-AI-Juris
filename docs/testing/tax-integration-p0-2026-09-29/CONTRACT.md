# Tax v2 P0 contract / P1a boundary
Date: 2026-09-29. Development checkpoint only; no mobile/web deployment or feature activation.

## Outcome and ownership
P1a makes versioned tax inputs/results lossless across a future JSON bridge while retaining the accepted calculator and standalone FFI.
Owner: tax P1a agent, isolated C:/PROJECTS/Genesis-Juris-Tax-P1A-2026-09-29, branch codex/tax-p1a-contract-2026-09-29.
Preflight: coordinator HEAD and freshly fetched origin/main both edfca4bcd8eccbc72c9c90193529e22b006e15b2; coordinator tracked status clean; target path/branch absent before creation; new worktree clean.
Only tax crate boundary/feature declarations, focused tests/fixture and these notes are owned. Original checkout, coordinator tracked files, other agents' worktrees, bridge/UI/web/PDF/configuration remain untouched.
AGENTS.md was read before edits. Accepted tax core functions and src/ffi.rs are unchanged; lib.rs changes only expose new pure modules and conditionally expose the default-enabled ffi module.

## Source inventory
Canonical tree: 4018bd855820fa1bad9795ad4e003b7831d50d99.
Required mobile release 268401ab7dbc12cdc80c20a281268189aad01e60 is the exact merge base: main ahead 231 commits, behind 0.
Complete recursive trees (not the truncated 300-file compare endpoint) show 18 modified + 6 added mobile app paths, no mobile deletion; native bridge/FFI directories unchanged.
Keep every current-main mobile variant: app version remains 0.11.0+18. This slice changes none of them.
Modified mobile paths: assets/case_catalog/mobile_case_bundle.json; lib/app/{home_shell,juris_app}.dart; lib/main.dart; lib/screens/{case_catalog_screen,dossier_screen,studio_wizard_screen,training_debrief_screen}.dart; lib/visual_identity/cinematic_catalogue_strings.dart; lib/widgets/catalogue/case_catalog_masthead.dart; pubspec.yaml; pubspec.lock; test/{case_catalog_test,case_visual_manifest_test}.dart; four catalogue golden PNGs under test/goldens/visual_identity/catalogue/windows_x64_flutter_3_44_8_engine_0cd6107 (compact first EN, compact long-title RU, wide complete-index EN and RU). Disposition: preserve all.
Added mobile paths: lib/app/product_navigation.dart; lib/data/professional_workspace_launcher.dart; lib/organization_context.dart; test/{organization_context_test,product_navigation_test,professional_workspace_launcher_test}.dart. Disposition: preserve all.
Cargo manifests/lock, toolchain, four existing workflows and new web workflow/install-PDF helper/release script differ from the mobile release; retain canonical main. Only the tax package feature declaration changes in P1a.
Tax lib/ffi/regression Git blobs before this slice: 6a350a0af2d23a1b555ddf980a06a0f3bff13d64 / 53f094a93c1c891d7fa13a3027ba5f0c1eefe23f / cfdef1296626425a544db2bed97e46175bfe922b.
Current web v1 blob: 1c26baab49eb9c2160b8587748ceca4566ae4e9b. Older amounts-only schema: 268401ab:apps/juris-web/app/types.ts blob 2da45850b60a334a43583f83d7d56b8358b9a277; current rates/base/FX schema: app/types.ts blob 3c97edf8ba9d999000197b1be58ab5f457c1689c.
Toolchain: repository 1.95.0; supported MSRV 1.78.0; both installed. Rust source semantics are governed by the accepted tax review, not the older duplicate contribution.

## Frozen P0 defaults
- Currency allowlist: EUR, GBP, USD; explicit two-decimal scale. No FX calculation is added. Unsupported imports remain intact with v2 unavailable.
- All input/result money is a canonical signed decimal string of cents. Numeric JSON, exponents, plus signs, leading zeroes and negative-zero minor-unit encodings are rejected. Conversion to i64 is checked across its complete range.
- Human major-unit text requires an explicit dot or comma decimal separator, no grouping/whitespace/exponent, at most two fractional digits. Exact integer conversion permits signed zero and canonicalizes it. EUR 250000 -> 25000000 cents -> 250000.00.
- Distinct identifiers: tax-economics-input-v2, tax-economics-result-v2, tax-economics-json-v1, tax-economics-2026-09-29 calculation semantics, tax-editor-v1 application policy. A semantic calculation change requires a new calculation identifier and fixtures.
- Policy, not core restrictions: 1..240 months; discount 0..5000 bps; signed monetary magnitude <=100000000000000 cents; 100 components, benefits and missing-input entries each; 100 source references per benefit; 128 UTF-8-byte IDs; labels 256 characters; notes/assumptions 4000 characters; request <=256 KiB. Reject rather than truncate. Existing core precision/error/domain rules remain authoritative.
- Structured context: stable case_id/artifact_id; canonical nonnegative u64 revision string; lowercase 64-character SHA256 scenario_fingerprint. It is caller-supplied identity, not cryptographic attestation by this boundary.
- P1b hash contract: SHA256 over UTF-8 compact canonical DTO serialization of input_schema, application_policy, scenario_fingerprint and input, in that fixed order. Preserve declared array order; canonical money strings; no float fields. Rust supplies canonical bytes. Exclude result cache, timestamps and artifact revision. P1a does not yet compute hashes or persist caches.
- P3 artifact: separately versioned authoring sidecar plus aggregate workspace import/export. Inputs/provenance authoritative; cache keyed by input hash/calculation version/source reference. Revisions increase on saved edits. Scenario-only export stays available. Unsupported future artifacts and originals survive old readers/downgrades; unknown content must not be overwritten.
- Legacy P1b conversion recognizes the two pinned web variants explicitly; preserve originals and FX, convert major units exactly, retain saved horizon (current web default 36, core constructor 120), and never invent US/year/as-of provenance. This is not the Rust test-only migration helper.
- Provenance/reference validity and manual-override governance belong to P1b/P3. Scenario facts are prose/status, so confirmed structured monetary bindings are required. No automatic number extraction or gameplay-budget reuse.

## P1a implementation and limits
MoneyCents has exact parsing/formatting and string-only serde. Input/component/benefit/result DTOs retain every accepted core field, null distinction and integer basis-point field; all derive Eq.
decode_request bounds raw bytes before deserialization, rejects duplicate/unknown fields and validates versions/application policy. After individual bounded fields, a capped counting serializer also checks actual encoded JSON size for typed callers, without allocating another payload. calculate delegates to calculate_tax_economics_v2 once. No new financial formula or float conversion is introduced.
Calculation errors retain core detail codes; application-policy rejection is a separate boundary error. Existing standalone error envelopes and native ABI are unchanged.
standalone-ffi is default-enabled. Default builds retain the public ffi module/C symbols. No-default builds omit only that module; pure regressions remain, including the pure assertion within the mixed precision/FFI test.
P1a supplies no bridge command, persistence, native packaging or user-visible editor. Full mobile milestone remains edit -> Rust -> save -> terminate/restart -> reopen after P0-P3.
P2 must inspect feature unification and all juris_* exports in real native artifacts; the existing iOS checker only filters juris_mobile_bridge_*. Do not infer packaged-export acceptance from this feature gate.
