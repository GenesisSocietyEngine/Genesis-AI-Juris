# GoldenShell — Recall at Dawn

Status: playable `ScenarioDefinition v1` vertical slice.

## Decision

GoldenShell represents a multi-client food-safety and supply-chain crisis
without introducing `DossierDefinition`, claimant-group schema, parallel
matter sessions, new C ABI symbols, or case-specific Dart transitions.

The player represents GoldenShell Producers Cooperative U.A. for twelve
fictional member farms. The cooperative is the single player client; the farms
remain related businesses with common-source questions but separate evidence,
contracts, mitigation, insurance, quality controls, and losses.

Rust remains authoritative. Flutter submits stable commands through the shared
`rust_scenario_v1` adapter.

## Stable identity and inventory

- case ID: `nl_food_safety_goldenshell_001`;
- scenario ID: `goldenshell_recall_at_dawn`;
- deterministic seed: `20260730`;
- 4 stages;
- 17 stable actions;
- 4 deadlines;
- 1 asynchronous residue assessment;
- 10 Inbox items;
- 12 events;
- 2 deterministic outcomes;
- 9 actors, 8 facts, and 13 evidence items.

The outcomes are `coordinated_claim_position` and
`fragmented_claim_position`.

## Proof and time model

The content keeps common source, farm-specific contamination, regulatory and
mitigation facts, and farm-specific losses distinct.

`preliminary_residue_assessment` takes 720 simulated minutes after retention.
Completion makes it ready, but explicit review is required before the report
becomes evidence and the common-source fact becomes inferred. Unreviewed work
expires at `handoff_window_opened`.

The scenario declares `clock.mode: foreground`. The Flutter shell sends one
explicit authoritative minute per foreground tick. Pause and speed are
presentation controls only. Backgrounding stops future commands, and resuming
does not catch up elapsed wall time.

## Deterministic reference paths

Coordinated:

```text
accept_cooperative_mandate
issue_coordinated_legal_hold
preserve_reference_samples
obtain_blocking_decisions
notify_cleaning_contractor
notify_farm_insurers
coordinate_recall_response
request_product_composition_records
retain_independent_residue_expert
advance_time 360 × 2
review_preliminary_residue_assessment
map_common_and_individual_losses
prepare_protective_attachment_strategy
establish_coordinated_claim_protocol
advance_time 360 × 7
complete_coordinated_handoff
```

Expected result: `coordinated_claim_position` at 4545 minutes, with no missed
deadline and a reviewed residue assessment.

Fragmented:

```text
accept_cooperative_mandate
authorise_recall_without_reference_samples
prioritise_regulator_claim
advance_time 360 × 12
complete_fragmented_handoff
```

Expected result: `fragmented_claim_position` at 4710 minutes, with the retailer,
contractor, and insurance deadlines missed and unreviewed residue work expired.
Neither handoff is available before the scheduled 72-hour event.

The executable mixed traces live under `content/traces`. They are
authoring/replay inputs only and make no persistence compatibility claim.

## Scope boundary

All organizations, people, authorities, products, documents, events, and
chronology are fictional. No dossier, persistence, lifecycle redesign,
criminal branch, appeal branch, or case-specific runtime is included.
