# GENESIS: JURIS — Matter Lifecycle v1

## Status and boundary

Matter Lifecycle v1 was merged through PR #10 at
`0c8c2cc11f6bab44abb3cdafe9f97dee91ff36fc`. It establishes the authoritative
rule that an adverse judicial result does not, by itself, close a matter. The
persistence compatibility remediation documented below is a separate local
checkpoint and is not described as published or merged.

Rust remains the sole authority for the current procedural stage, judicial
result, matter lifecycle, available remedies, elapsed scenario time, generated
events, and terminal outcome. Flutter presents the Rust snapshot and does not
infer legal closure from a result label.

This checkpoint is generic engine and presentation infrastructure. It does not
revise the balance or authored paths of the existing playable cases, and it
does not introduce player-authored legal theory.

## Authoritative lifecycle contract

### Judicial result

`JudicialResult` records the latest substantive judicial decision:

- `won`;
- `lost`;
- `partially_won`;
- `dismissed`.

It is mutable runtime state rather than a terminal outcome. A later appeal,
cassation, remittal, or other authored remedy may replace an earlier result.

`JudicialDecisionInstance` records the procedural instance that produced that
current result:

- `first_instance`;
- `appeal`;
- `cassation`.

It is absent until a judicial result exists. Rust derives it at
`SetJudicialResult` execution time from the authoritative stage. A later
decision replaces both the result and its instance, so the two fields always
describe the same latest authoritative decision. Enforcement and resolved
stages preserve an existing instance because they are not themselves judicial
decision instances.

Scenario authors set and query it declaratively:

```json
{"type":"set_judicial_result","result":"lost"}
```

```json
{"type":"judicial_result_is","result":"lost"}
```

`SetJudicialResult` is an effect and `JudicialResultIs` is a condition. Neither
is a new player command.

### Matter lifecycle

`MatterLifecycleStatus` is derived from the authoritative current stage. It is
not stored as an independent mutable state machine.

| Stage contract | Derived lifecycle | Closed |
|---|---|---:|
| standard, hearing preparation, or hearing | `active` | no |
| post-judgment | `post_judgment` | no |
| appeal | `appeal` | no |
| cassation | `cassation` | no |
| enforcement | `enforcement` | no |
| resolved or explicitly terminal | `closed` | yes |

The schema adds the semantic stage kinds `appeal`, `cassation`, and
`enforcement`. Existing `post_judgment` and `resolved` stages participate in
the same derived lifecycle.

The authoring contract requires:

- post-judgment and remedy stages to remain nonterminal;
- every remedy stage to provide a valid exit;
- a resolved stage to be terminal;
- every terminal stage to use the `resolved` stage kind;
- a terminal stage to expose no exit actions;
- a complete `OutcomeDefinition` to resolve only in a transition that enters
  a terminal stage. Because every terminal stage must use the `resolved` kind,
  this is also the resolved terminal boundary.

Consequently, `lost` and `dismissed` may be adverse results while the matter
remains open. Dispatch and foreground time advancement stop only after derived
closure. Until then, available appeal, cassation, enforcement, waiver, or
other authored actions remain executable.

## Snapshot and bridge contract

The versioned mobile snapshot remains schema version 1 and adds:

- `judicial_result`: nullable latest decision;
- `judicial_decision_instance`: nullable Rust-owned instance that produced the
  current decision;
- `matter_lifecycle`: stage-derived lifecycle;
- `is_closed`: authoritative closure flag;
- `resolved_outcome`: nullable terminal outcome ID.

`terminal` remains a backward-compatible alias for `is_closed`. A terminal
outcome summary is exposed and rendered only after closure.

These fields travel through the existing JSON bridge. No new native function
was added.

## Scenario and persistence compatibility

Scenario Definition v1 remains version `1.0`. The lifecycle additions are
additive enum, condition, effect, and stage-kind variants. Existing scenario
stable IDs and existing scenario documents are unchanged.

Persistent Command-Log Save/Load retains its wire contract:

- technical schema ID: `genesis.ai-juris.command-log`;
- schema version: `1`;
- exactly the same eight envelope fields;
- accepted player commands: `dispatch` and `advance_time`;
- replay from the authoritative scenario definition and seed;
- scenario fingerprint and final-state digest verification;
- failure-atomic registry and Flutter session replacement.

Envelope schema version 1 identifies this unchanged wire shape. The separate
runtime marker identifies replay and digest semantics. New lifecycle saves
write `scenario-runtime-v2`.

For historical `scenario-runtime-v1` saves, the loader performs a generic,
side-effect-free lifecycle eligibility check before replay. Compatible
pre-PR #10 saves replay with the exact v1 digest projection and migrate to v2.
The known valid-v1 definition that resolves an outcome before entering a
terminal stage is rejected before replay as `RuntimeCompatibility`. It is not
allowed to fail later as an illegal command sequence or digest mismatch.

The eligibility check is stricter than ordinary definition validation because
effect order is authoritative. Every action-owned outcome must finish at the
last `set_stage` in a terminal/resolved stage. Event-owned outcome resolution
is conservatively rejected, as is an outcome action that triggers events when
any event can change stage. Consequently, the historical definition whose
effects enter `resolved`, resolve an outcome, and then return to a nonterminal
stage is rejected as `RuntimeCompatibility` even though the current validator
accepts it. This rule is generic and contains no scenario IDs.

PR #10 also emitted v1-labelled lifecycle saves. They use the same v1 digest
profile: `judicial_result` is present only when authoritative state has a
result, and `judicial_decision_instance` is absent. Compatible saves in that
category replay under the v1 profile, derive the decision instance from Rust
state, and are re-saved as v2. The v2 digest always includes both result and
decision-instance keys, including explicit nulls. Matter lifecycle remains
derived from the restored stage rather than duplicated in the envelope.

The lifecycle fixture has its own scenario identity and does not change the
fingerprints of Logistics, GreenFire, or GoldenShell. Localization overlays
remain outside the authoritative scenario fingerprint and save envelope.

## C ABI compatibility

C ABI version 1 is preserved with exactly the existing three exports:

- `juris_mobile_bridge_execute`;
- `juris_mobile_bridge_string_free`;
- `juris_mobile_bridge_abi_version`.

Lifecycle state is transported as additive JSON fields through
`juris_mobile_bridge_execute`. Repository, crate, Dart package, application
ID, C symbol, save `schema_id`, and existing scenario identifiers retain their
compatibility-sensitive names.

## Focused lifecycle fixture

`content/fixtures/authoring/adverse_judgment_with_remedies.json` is a
test-only Belgian lifecycle fixture. Its intermediate adverse-judgment state
proves:

- `judicial_result` is `lost`;
- `matter_lifecycle` is `post_judgment`;
- `is_closed` and `terminal` are false;
- `resolved_outcome` is null;
- `file_appeal` and `waive_appeal` remain available.

It defines three deterministic complete paths:

| Path | Action sequence after the initial hearing | Final result | Closure time |
|---|---|---|---:|
| Appeal succeeds and enforcement completes | `request_judgment` → `adverse_trial_judgment` → `file_appeal` → `appeal_success` → `begin_enforcement` → `complete_enforcement` | `appellate_success` | 360 minutes |
| Appeal is expressly waived | `request_judgment` → `adverse_trial_judgment` → `waive_appeal` | `final_loss` | 65 minutes |
| Appeal and cassation are exhausted | `request_judgment` → `adverse_trial_judgment` → `file_appeal` → `appeal_lost` → `file_cassation` → `cassation_rejected` → `close_after_remedies_exhausted` | `final_loss` | 425 minutes |

Schema round-trip, validator, authoring diagnostics, simulator, runtime,
command-log replay, JSON bridge, C ABI, snapshot mapper, and widget tests cover
the lifecycle boundary. Persistence coverage verifies an open adverse result,
continuation into appeal after load, identical repeated loads, and no
duplication of generated events or command-log entries.

Historical cross-version bytes and provenance are committed under
`crates/juris-engine/tests/fixtures/persistence/`. They include both semantic
counterexamples, including the ordered-effects v1 digest
`f7118812912dfb37fe8cb4d7c2f9060af363138c4d1ece1072c14768b978559e`.

## Flutter EN/RU behavior

Flutter maps the authoritative lifecycle fields without using localized text
as an identifier. It maps `judicial_decision_instance` directly and does not
reconstruct it from stage IDs, outcome IDs, or display text. Missing
`is_closed` falls back to the legacy `terminal` field, and unknown future
judicial-result, decision-instance, or lifecycle values map to explicit
presentation-safe `unknown` values.

The Matter screen presents decision and lifecycle separately. For example:

- EN: `Decision: Lost` and
  `Matter status: Post-judgment — remedies available`;
- RU: `Решение: Поражение` and
  `Статус дела: После решения — доступны средства обжалования`.

The final outcome card and case report remain hidden while the matter is open.
After explicit closure, the report presents both the latest decision and the
closed lifecycle. Changing EN/RU presentation does not change the Rust state,
command log, scenario fingerprint, or final-state digest.

## Known limitations

- The adverse-judgment fixture is test-only and is not a catalog case.
- Existing playable cases are not rewritten to use every new remedy stage.
- Procedural availability, waiver, exhaustion, and enforcement rules remain
  authored scenario content; this checkpoint does not encode jurisdiction-
  specific appellate law in engine code.
- The legacy Failed ERP Dart demo retains its compatibility fallback until it
  is migrated to the generic Rust scenario runtime.
- Save v1 remains manual, single-slot, local, integrity-checked rather than
  encrypted, and without background or offline time advancement.
- No physical-device, release-signing, App Store, or Play Store behavior is
  defined by this lifecycle contract.

## Next dependency

After this persistence compatibility remediation receives explicit acceptance,
the next separately authorized architectural dependency is Dossier Projection
v1: a deterministic, Rust-owned read model derived from authoritative scenario
state. That checkpoint must preserve stable IDs, replay determinism, save/load
failure atomicity, EN/RU parity, snapshot compatibility, and C ABI version 1.
It must not yet introduce player-authored legal theory.
