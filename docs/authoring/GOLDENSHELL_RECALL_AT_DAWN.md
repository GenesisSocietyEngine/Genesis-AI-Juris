# GoldenShell — Recall at Dawn

Status: implemented as a playable `ScenarioDefinition v1` vertical slice.

## Decision

GoldenShell proves that the existing scenario pipeline can represent a
multi-client food-safety and supply-chain crisis without introducing
`DossierDefinition`, a claimant-group schema, parallel matter sessions, new FFI
functions, or case-specific Dart transitions.

The player represents GoldenShell Producers Cooperative U.A. while coordinating
the first 72 hours for twelve fictional member farms. The cooperative is the
single player client; the farms remain related businesses with common source
questions but separate contracts, treatment histories, laboratory evidence,
mitigation decisions, insurance, quality controls, and losses.

Rust remains authoritative for conditions, effects, time, deadlines,
asynchronous work, Inbox state, evidence, facts, and outcomes. Flutter sends
stable action IDs through `rust_scenario_v1`.

## Fictionalization boundary

Every organization, person, authority, product, document, event, and chronology
in GoldenShell is fictional. The scenario uses abstract legal mechanics found
in public food-safety and supply-chain disputes, but does not copy real parties,
products, pleadings, messages, witness accounts, judicial text, exact
chronology, or outcomes.

The scenario never treats proof of a common source or common liability as proof
of each farm's contamination, mitigation, own-fault position, or damages.

## Stable identity

- case ID: `nl_food_safety_goldenshell_001`;
- scenario ID: `goldenshell_recall_at_dawn`;
- player client: `goldenshell_producers_cooperative`;
- runtime adapter: `rust_scenario_v1`;
- deterministic mobile seed: `20260730`.

## Content inventory

- 4 stages;
- 18 stable actions;
- 4 deadlines;
- 1 asynchronous residue assessment;
- 10 Inbox items;
- 12 events;
- 2 deterministic outcomes;
- 9 actors, 8 facts, and 13 evidence items.

`handoff_complete` is the only terminal stage. The outcomes are:

- `coordinated_claim_position`;
- `fragmented_claim_position`.

## Proof model

The content keeps four proof layers distinct:

1. common product source and contractor conduct;
2. farm-specific treatment, samples, and contamination;
3. regulatory blocking, retailer recall, and mitigation;
4. farm-specific loss, insurance, quality controls, and own-fault questions.

`preserve_reference_samples` and
`authorise_recall_without_reference_samples` share the
`sample_strategy_completed` gate. Executing either action makes the other
unavailable.

## Deadlines and expert lifecycle

The scenario has deterministic deadlines for sample preservation, retailer
recall response, contractor notice, and insurer notice. The contractor notice
falls within the first 24 hours. Missing critical work records typed deadline
state and forces a fragmented position.

`preliminary_residue_assessment` takes 720 simulated minutes after
`retain_independent_residue_expert`. Completion makes the work ready and creates
an Inbox item, but does not build the legal causation model.
`review_preliminary_residue_assessment` must be executed explicitly before the
report becomes evidence and the common-source fact becomes inferred. Unreviewed
work expires at `handoff_window_opened`.

The temporary repeatable `coordinate_operational_period` action advances six
hours per use. It is a content-level compatibility mechanism inherited from the
merged GreenFire baseline. Formal foreground clock control remains isolated in
separate development work.

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
coordinate_operational_period × 2
review_preliminary_residue_assessment
map_common_and_individual_losses
prepare_protective_attachment_strategy
establish_coordinated_claim_protocol
coordinate_operational_period × 7
complete_coordinated_handoff
```

Expected result: `coordinated_claim_position` at 4545 minutes, with no missed
deadline and a reviewed residue assessment.

Fragmented:

```text
accept_cooperative_mandate
authorise_recall_without_reference_samples
prioritise_regulator_claim
coordinate_operational_period × 12
complete_fragmented_handoff
```

Expected result: `fragmented_claim_position` at 4710 minutes. This trace misses
the retailer, contractor, and insurance deadlines, destroys stock without a
defensible independent reference set, prioritizes the regulator theory, and
expires the unstarted residue assessment.

Neither handoff action is available before the scheduled 72-hour event.

## Runtime and test boundary

The canonical content is exercised by the shared validator, authoring
diagnostics, simulator, authoritative engine, JSON bridge, existing three-symbol
C ABI, deterministic mobile exporter, and Flutter catalog/repository tests.
There is no GoldenShell-specific runtime adapter.

## Future dossier hooks

The following are documentation-only follow-ups:

- The Hundred Farms;
- The Missing Ingredient;
- The Indemnity Trap;
- contractor and director criminal defence;
- regulator liability;
- insurance coverage and aggregation;
- farm-specific damages assessment;
- appeal and cassation.

No dossier, persistence, lifecycle redesign, foreground-clock implementation,
criminal branch, or appeal branch is part of this content checkpoint.
