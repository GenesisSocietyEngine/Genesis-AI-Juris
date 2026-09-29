# Tax Economics P1b adapter contract

Date: 2026-09-29. Base: `7d8fe2741a7c1fda45fc23e5be88f6592c7c94c9`.

## User outcome and acceptance
This pure crate slice lets a later editor import either supported historical web input without silently losing its original data, and build a derived tax base from explicitly confirmed structured monetary facts. An incomplete draft remains editable and cannot calculate a partial rates-based base.
Acceptance: exact units and saved horizon; raw originals and FX retained; no invented approval; stale/missing source references refused; unfinished bindings round-trip intact; fixed canonical input identity; default/no-default/MSRV checks. Native bridge, UI, persistence, web/PDF output, formula changes and release activation are outside P1b.

## Pinned legacy schemas
Selection is explicit through `LegacySchema`; the shared `kind: tax-economics-v1` is insufficient to distinguish them. No heuristic auto-detection or prose/game-budget extraction is provided.

| Selector | Pinned schema and normalizer |
| --- | --- |
| WebAmountsV1 | `268401ab7dbc12cdc80c20a281268189aad01e60:apps/juris-web/app/types.ts`, blob `2da45850b60a334a43583f83d7d56b8358b9a277`; calculator blob `2a630cab64a5eddcc45d604d54e4b5c2705933be` |
| WebRatesFxV1 | base main `app/types.ts`, blob `3c97edf8ba9d999000197b1be58ab5f457c1689c`; `app/tax-economics.ts`, blob `1c26baab49eb9c2160b8587748ceca4566ae4e9b` |

Both schemas require currency, five saved cost amounts, horizon, discount and realization. Older amounts have no basis/base/rates/FX; only that selected schema supplies the historical amounts basis. Current schema requires its basis, accepts optional base/rates/FX, and refuses missing/null numerical inputs in rates mode instead of turning them into factual zero. Missing optional rates in amounts mode use unused zero representation slots while `unavailable_legacy_fields` records their absence. Missing/null assumptions become an empty representation with explicit unavailable metadata. Supplied assumptions stay verbatim.

All saved money is nonnegative **integer major units**, maximum 1,000,000,000,000. The adapter parses bounded JSON number tokens as decimal integer arithmetic, proves exact integrality, then multiplies by 100 with checked conversion into `MoneyCents`. Equivalent exact integral exponent/decimal tokens are accepted; fractional, negative, oversized, unknown, duplicate or unsupported content gives a typed unavailable import while retaining the original JSON. No f32/f64 conversion is used. Currency is normalized then restricted to EUR/GBP/USD. Horizon 1..240 is copied from the saved input; the v2 default is never substituted.

A saved annual aggregate becomes a manual numerical base, with a migration explanation and **unknown owner/as-of**. It is not inferred from components, not provenance-confirmed and not a fabricated user approval. `missing_override_provenance` exposes the fields needing action. `calculate_authoring` requires a real reason, owner and valid date for manual overrides. This deliberately also blocks an amounts draft retaining a saved aggregate until its provenance is supplied or the aggregate is explicitly removed. Amounts without an aggregate remain calculable without inventing a base.

FX is already reflected in saved amounts. It is validated as historical ECB metadata and retained as its original raw JSON token; it is never applied again. Legacy outputs are not imported or relabelled as v2 calculations. Old web `netAnnualBenefit` semantics differ; the saved original remains available for historical display.

`LegacyImport` always retains the owned original JSON and its SHA256, including refusal cases. Source payload size is checked before deserialization (256 KiB); strict typed schema parsing rejects unknown and duplicate fields. The caller should retain the original before attempting import and apply transport byte limits before constructing the owned string. Serialization is deterministic and repeated import is idempotent.

## Structured facts and confirmation
`bind_components` is a pure atomic replacement of derived components. The caller supplies the current case/fingerprint and fact/reference ID indices. These are caller-supplied identity checks, **not evidence, identity, authorization or legal-status attestations**. The application must load them from the current authoritative case and enforce permissions separately. IDs alone do not verify source content; the supplied fingerprint must actually cover the current source.

Every binding supplies the exact monetary cents, currency, category, fact ID, monetary field, current fingerprint, inclusion and explicit confirmation. No text extraction, inferred amount, implicit FX, guessed period or jurisdiction occurs. Confirmed bindings require an owner and real YYYY-MM-DD date. Period/jurisdiction absent in the draft map to explicit unknown component metadata. Category signs remain core-owned: a positive deductible expense is subtracted once; a negative expense remains negative and reverses the deduction.

Duplicate component IDs, duplicate monetary anchors, missing facts, stale case/fingerprint or mixed currencies refuse atomically. Existing benefit references are checked against the union of current fact IDs and reference IDs; absent references refuse the entire operation. Empty benefit references stay empty and acquire no invented evidence. Included unconfirmed or missing required bindings mark the base incomplete. Excluded, nonrequired unfinished bindings remain in the draft without blocking selected calculations.

`BindingDraft` retains the **entire original structured binding list**, including unfinished values and partial provenance, plus required component IDs. P3 must save these fields, not only the generated request. A confirmed binding's user note is copied unchanged; provenance is not encoded by concatenating text. The typed API bounds bindings and required IDs to 100, source indices together to 10,000, IDs to 128 UTF-8 bytes, labels 256 characters, notes 4,000 characters and provenance 128 characters before result cloning. A future raw bridge must enforce its own byte cap before deserializing these typed structures.

## Identities and cache invalidation
Frozen P0 `input_hash` is unchanged: SHA256 of compact UTF-8 serde JSON with top-level fields in this order: `input_schema`, `application_policy`, `scenario_fingerprint`, `input`. Input fields use the declared `TaxInput`/nested DTO order; arrays preserve their supplied order; money stays canonical decimal strings and optional values are explicit null. No trailing newline. Revision, artifact/case identity, transport version, calculation version, timestamps and result are excluded. Callers store calculation version separately and never use this hash as authorization or whole-artifact integrity.

The additional provenance identity is separately versioned as `tax-component-bindings-v1`. `binding_hash` is SHA256 of compact UTF-8 JSON in this exact top-level order: `schema`, `source`, `required_component_ids`, `bindings`. Source order: `case_id`, `scenario_fingerprint`, `fact_ids`, `reference_ids`. Each binding order: `component_id`, `label`, `category`, `amount`, `currency`, `fact_id`, `source_field`, `scenario_fingerprint`, `period`, `jurisdiction`, `note`, `include_in_calculation`, `confirmed`, `confirmation_owner`, `confirmation_as_of`. Arrays retain order, optional fields are null, money is a string. The source includes default-empty reference IDs. Hashing streams serialization instead of allocating a second payload.

This separate identity resolves a concrete cache issue: an owner/date/unfinished binding edit can leave the calculated input unchanged while changing authoring provenance. Later authoring caches must bind `input_hash`, `binding_hash_schema`, `binding_hash`, case/artifact/revision, calculation version and current source identity. Retain `original_sha256` separately for legacy-original/FX history; an FX-only metadata edit need not change already-converted calculation amounts. Neither digest is an authentication signature.

## Next slice boundary
P2 may expose these pure APIs through the existing mobile bridge only on an independently reviewed integration branch. It must enforce raw limits, load current source identity, re-run binding validation before calculation and preserve typed unavailable states. `calculate_authoring` alone validates manual provenance and the calculation request; it cannot authenticate caller-supplied derived facts. P3 must round-trip originals, unfinished bindings and identity/version metadata, then demonstrate edit → Rust calculate → save → reopen. This commit does not activate or deploy Tax Economics v2.
