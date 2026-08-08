# GreenFire Production Pressure Pilot v1

Status: **architecture stop — owner decision required before implementation**

Date: 2026-08-08

Authoritative base: `2390c69d27d866e8b8d360e8bdcc71919d3f105c`

Local review branch: `feat/greenfire-regulatory-pressure-pilot-v1`

## Decision summary

The proposed pilot is architecturally compatible with the published generic
Pressure & Countermove Runtime v1. It needs no new schema type, gameplay
primitive, scheduler, bridge command, FFI call, ABI symbol, or
scenario-specific Rust/Flutter branch. The content change would compose one
existing GreenFire actor, activation event, deadline, two actions, missed
event, and Inbox item.

Implementation is nevertheless stopped before production content changes.
The repository currently requires a published pre-pilot GreenFire save to
load successfully against the single current GreenFire definition:

- `crates/juris-engine/tests/fixtures/persistence/06e566a_losing_terminal_outcome.json`
  carries the current GreenFire fingerprint
  `b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261`;
- `real_pre_lifecycle_v1_golden_saves_migrate_and_resave_as_v2` loads that
  envelope with `GREENFIRE_SCENARIO` and requires successful replay and
  migration;
- `validate_envelope_compatibility` rejects a definition/fingerprint mismatch
  before session construction or command replay;
- the pilot must change the GreenFire fingerprint and is explicitly forbidden
  from bypassing, rewriting, or migrating that fingerprint merely to appear
  compatible.

The instruction requires an architecture stop when repository policy or tests
require all previously published GreenFire saves to continue loading under one
current definition. That boundary is present. No GreenFire scenario data,
fixture, generated bundle, test expectation, or cumulative checkpoint has
therefore been edited.

## Verified starting checkpoint

The preflight was performed before the branch was created or any file was
edited.

| Item | Observed value |
|---|---|
| Base, local `main`, `origin/main`, GitHub `main` | `2390c69d27d866e8b8d360e8bdcc71919d3f105c` |
| Merge base | `2390c69d27d866e8b8d360e8bdcc71919d3f105c` |
| Tracked worktree | clean |
| Sole untracked file | `docs/development/CURRENT_PROGRESS.zip` |
| Accepted local totals | Rust 333/333; Flutter 153/153; Android API 37 native integration 10/10 |
| App version | `0.6.0+13` |
| Release | published prerelease `v0.6.0-alpha.1`, no assets |
| Ruleset | `Main` (`19991132`), active, `~ALL`, no exclusions or bypass actors |

Protected bytes were unchanged:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `CURRENT_PROGRESS.zip` | 47,579 | `2e5f03f003a7d227cb4ce765e338a8f335d92879862e53bd1c27d65e116de3b6` |
| Corrected Desert Water save | 12,060 | `328d76e392230ac47ecac4ecda6c54af83a48155f4b0d414fe07a2fecabfe019` |
| Production mobile bundle | 622,325 | `58d90d7cc50b853c395e4defe43579b1c7b5d7f3ae12cb9cfe5ec2e22751c97a` |
| Ordinary debug APK | 203,489,120 | `50d6874ba1b9148cbb3c78a459c8afd9b2db890882b29b88c433332e940b7cfd` |

The Desert Water save remains recorded as 291 commands, eight envelope
fields, schema 1, `scenario-runtime-v2`, and final digest
`6ce210e4a6b55a2ec2495d3405adcd7c45ff2edee38cfee3f5c981e2a68d647c`.
It was hashed but not loaded, replayed, migrated, or opened in the app.

PR #4 remains open at `7aa6927e8ebfd6e205bfd12478ba28d52c40248a`.
The local recovery ref `backup/desert-water-pre-failed-erp` remains at
`44e565b22c52a4c3a3e69b2c137353b7771fcf77`; remote
`feat/dossier-projection-v1` remains at
`62111ddef1623f0211149c70617564f2aa622dd4`. Both Pressure publication
branches remain unchanged.

The existing APK libraries for `armeabi-v7a`, `arm64-v8a`, and `x86_64` each
export exactly:

- `juris_mobile_bridge_abi_version`;
- `juris_mobile_bridge_execute`;
- `juris_mobile_bridge_string_free`.

## Evidence map

| Contract | Current authoritative source |
|---|---|
| Definition shape | `crates/juris-scenario-schema/src/pressure.rs`; `ScenarioDefinition.pressure_windows` in `scenario.rs` |
| Structural validation | `crates/juris-scenario-validator/src/pressure.rs`; diagnostic `SCN015_INVALID_PRESSURE_WINDOW_DEFINITION` |
| Finish-by timing | `ActionDefinition.completion_deadlines`; `ensure_action_finishes_by_deadline` and `ensure_completion_is_timely` |
| Deadline lifecycle | `DeadlineDefinition`, stored due minutes, ordinary completion/miss effects |
| Projection | `crates/juris-engine/src/scenario_runtime/pressure_countermove.rs` |
| Candidate atomicity | clone/validate/commit boundaries in `ScenarioSession::dispatch` and `ScenarioSessionRegistry::load_from_json` |
| Fingerprint and digest | `scenario_runtime/persistence.rs`; full serialized definition fingerprint and definition-bound v2 digest |
| Production content | `content/cases/greenfire_first_72_hours.scenario.json` |
| Canonical traces | `content/traces/greenfire_protected.commands.json`; `greenfire_compromised.commands.json` |
| EN/RU content | canonical English definition and `greenfire_first_72_hours.ru.v1.json` overlay |
| Mobile bundle | `apps/juris-mobile/tool/export_mobile_case_bundle.dart` and generated `mobile_case_bundle.json` |
| Flutter mapping/UI | `scenario_snapshot_mapper.dart`, generic Pressure view model, and `matter_screen.dart` |
| Bridge/FFI | existing create/snapshot/dispatch/save/load/dispose protocol and three-symbol C ABI |
| Debug/native coverage | published Pressure fixtures plus `native_android_persistence_smoke_test.dart` |

## Exact proposed content contract

If the compatibility blocker is resolved by a later owner instruction, the
pilot should bump only GreenFire `metadata.content_version` from `0.1.0` to
`0.2.0` and add exactly this one ordered window:

```json
{
  "id": "regulator_document_request_pressure",
  "source_actor_id": "port_haven_environment_authority",
  "activation_event_id": "regulator_request_received",
  "response_deadline_id": "initial_regulatory_response_deadline",
  "response_action_ids": [
    "submit_initial_regulatory_response",
    "release_unreviewed_documents"
  ],
  "countermove_event_id": "regulatory_response_missed"
}
```

Both existing actions currently lack a finish-by declaration. Each would need
exactly:

```json
"completion_deadlines": ["initial_regulatory_response_deadline"]
```

`advance_to_deadlines` is not appropriate: both actions have a fixed authored
duration of 180 minutes and should finish by the deadline, not consume all
remaining time. Their existing effects already complete the deadline and
resolve `regulator_document_request`; the risky action additionally sets
`uncontrolled_disclosure`.

No other scenario may gain a window. No action, event, deadline, actor, Inbox
item, effect, outcome, score, recommendation, or generated-text field is
needed.

## Timing compatibility

`regulator_request_received` fires at absolute scenario minute 120. The
existing deadline is due at day 1, minute 720, or absolute minute 2,160. It is
therefore initially active with 2,040 game minutes remaining.

The deadline omits `completion_at_due_allowed`, so the schema default is
`false`. The generic runtime rejects a candidate completion at or after 2,160:

```text
completion < 2160  -> timely
completion >= 2160 -> ActionCompletionDeadlineExceeded
```

Since each response costs 180 minutes, it remains available only when its
candidate completion is before 2,160. A start at minute 1,979 can complete at
2,159; a start at minute 1,980 would complete exactly at due and must be
rejected. `dispatch` validates this on a cloned candidate and commits only on
success, preserving command-log, state, Inbox, deadline, cost, and effect
atomicity.

The unchanged protected trace reaches the reviewed response at minute 600,
well before due, and must still finish at minute 4,440. The unchanged
compromised trace reaches the risky response at minute 390 and must still
finish at minute 4,590. Adding the finish-by declarations is expected to
constrain genuinely late starts without changing either accepted path.

## Player-visible lifecycle

### Before activation

Before minute 120, the activation event has not fired and the deadline is not
open. The generic projection returns no `pressure_and_countermove`; no pilot
pressure, countermove, or response IDs should occur in player snapshot bytes.

### Active request

At minute 120, the ordinary event creates `regulator_document_request` and
opens `initial_regulatory_response_deadline`. The generic projection would
emit exactly one pressure with source actor
`port_haven_environment_authority`, due minute 2,160, remaining time derived
from the Rust clock, and the definition-ordered intersection of the two
response IDs with ordinary authoritative available actions.

The reviewed response remains unavailable until
`open_controlled_regulator_channel` sets `regulator_channel_controlled`; the
risky response may be available earlier. If neither is available, the active
pressure remains visible with a neutral empty response list. Flutter does not
infer failure.

The existing Matter card labels due and remaining values as game minutes.
Review navigation uses the existing clock-suspension and action-confirmation
flow and emits no command until confirmation.

### Controlled response

One ordinary `dispatch(submit_initial_regulatory_response)` consumes 180
minutes, sets `regulatory_response_submitted`, completes the deadline, and
resolves the Inbox item once. The next authoritative snapshot omits the
pressure.

### Risky response

One ordinary `dispatch(release_unreviewed_documents)` consumes 180 minutes,
sets `uncontrolled_disclosure` and `regulatory_response_submitted`, completes
the same deadline, and resolves the Inbox item. Generic UI must not relabel or
block it as an incorrect choice.

### Miss and closure

Crossing the exclusive due boundary without a response lets the existing
deadline engine fire `regulatory_response_missed` once, mark the deadline
missed, and set the existing flag. The pressure disappears because the
deadline is no longer open. It exposes neither the hidden countermove ID nor
its effects in advance. Terminal handoff also suppresses pressure and retains
the normal post-closure command rejection.

One large time advance and equivalent chunks must yield identical event,
deadline, Inbox, and projection state.

## Canonical and deterministic consequences

The allowed future drift would be limited to the GreenFire definition-bound
values:

- content version `0.1.0` to `0.2.0`;
- GreenFire fingerprint changes once;
- protected and compromised final digests change once because they include
  the definition fingerprint;
- production bundle bytes/hash change deterministically;
- an ordinary rebuilt APK may change because it embeds that bundle.

The GreenFire outcomes/minutes must remain
`protected_crisis_position`/4,440 and
`compromised_crisis_position`/4,590. The other four fingerprints, other nine
canonical digests, every non-GreenFire outcome/minute, catalogue identity and
order, save schema, digest profiles, bridge protocol, and C ABI must remain
byte-exact.

Baseline GreenFire values are fingerprint
`b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261`,
protected digest
`17f58f95551abacb445ce6d886fc059bcbd7a7660c3f089d9509e7a25f01a216`,
and compromised digest
`432a3ca4688f2d452a96326872e2058d9a1b2109c4b5f3be24b6b9666cc428ec`.
No replacement value has been guessed or pinned because implementation did
not begin.

## Save compatibility and release blocker

The save envelope is fixed at eight fields with identity
`genesis.ai-juris.command-log`, schema 1, and runtime marker
`scenario-runtime-v2` for new saves. `scenario_fingerprint` hashes the full
serialized definition. The final-state digest also incorporates that
fingerprint.

The loader compares the envelope fingerprint with the supplied current
definition before constructing or replaying a candidate session. Registry
load inserts only a fully replayed, integrity-checked session. This is the
correct generic and candidate-atomic behavior.

The existing historical GreenFire fixture is not merely test data for expected
rejection. The cumulative regression test explicitly treats it as an eligible
published v1 save, loads it against the current GreenFire definition, resaves
it as v2, and requires its compromised terminal result. After the proposed
definition change, the normal loader must return `FingerprintMismatch`
instead. Preserving both behaviors with one current definition would require
one of the forbidden changes: weakening fingerprint validation, rewriting the
envelope, retaining the historical definition, or introducing migration.

This is a publication/release blocker, not a runtime defect. The owner must
choose one separately authorized policy:

1. explicitly accept alpha GreenFire save invalidation and revise the
   historical GreenFire compatibility contract so the pre-pilot envelope is
   expected to fail atomically; or
2. authorize a separate generic content-version retention/migration phase
   that is not GreenFire-specific.

Until then, the smallest compatible action is to keep production GreenFire at
`0.1.0` with its current fingerprint and stop at this document.

## EN/RU and UI impact

Both response action IDs already have English canonical text and Russian
overlay title/description coverage. The generic Flutter mapper resolves
response labels through those IDs and filters them again against the
authoritative available-action set.

The Russian overlay currently has no `actors` section for
`port_haven_environment_authority`; the generic mapper therefore falls back
to the canonical English actor name. If implementation is later authorized,
the existing actor ID should receive one narrow Russian `name` overlay entry.
That is localization of an existing stable entity, not pressure-specific
prose or a new gameplay primitive.

The published Pressure card, response review, long-text/scale/scroll handling,
and clock suspension should be reused unchanged. No GreenFire conditional is
permitted in Flutter.

## Deferred test plan

No test expectation was changed at this stop. A later authorized implementation
must add evidence in these layers:

- definition/validator: exactly one GreenFire window, exact six references,
  both finish-by declarations, `SCN015` success, zero windows elsewhere,
  catalogue and localization coverage;
- Rust runtime: pre-activation omission, activation at minute 120, exact
  projection/order/timing, controlled/risky/missed paths, exact-due rejection,
  large-step parity, atomic late/unavailable rejection, repeated snapshot byte
  equality, active save/load parity, and absence after resolution/closure;
- persistence: a post-pilot active and final save replays exactly, while a
  representative pre-pilot envelope fails with `FingerprintMismatch` without
  registry mutation, but only after the owner resolves the existing
  successful-load contract;
- simulator: unchanged protected and compromised command traces plus a focused
  noncanonical miss proof;
- bridge/FFI: the same create/snapshot/dispatch/save/load/dispose inventory,
  no hidden countermove/effects/unavailable IDs, and unchanged three-symbol ABI;
- Flutter: EN/RU mapping, source/action labels, game-time labels, ordered
  responses, neutral empty responses, review with zero commands, one confirmed
  dispatch, and disappearance only after the returned snapshot;
- Android API 37: one disposable production GreenFire lifecycle covering
  activation, review, controlled response, miss, and active save/load without
  touching protected application state.

Only after focused gates may new fingerprints/digests be generated and pinned.
Full Rust, formatting, clippy, Flutter, bundle, Android, APK, and ABI gates
remain required. Hosted iOS is not part of this local checkpoint and must be
reported as not run.

## Rejected alternatives and exclusions

The following were considered and rejected:

- accepting the old fingerprint under changed bytes;
- editing the historical envelope's fingerprint or digest;
- silently replacing its successful migration assertion with a new baseline;
- a GreenFire-only migrator or hidden second runtime definition;
- `advance_to_deadlines` in place of the authored 180-minute action duration;
- changing the canonical commands, outcome conditions, durations, costs, or
  final minutes;
- a second pressure window or pressure in another production scenario;
- a new opponent engine, effect, scheduler, wall-clock task, notification,
  bridge command, ABI symbol, Flutter dispatch path, or scenario-ID branch;
- revealing the countermove/effects, unavailable response IDs, or an ideal
  answer label;
- version, tag, release, asset, PR, ruleset, protected ref, or branch cleanup
  work.

## Stop boundary

The branch contains documentation only. Production GreenFire, generated
bundle, APK, persistence fixtures, tests, `CURRENT_PROGRESS.md`, protected
state, refs, rules, release metadata, and application version remain unchanged.
Nothing is authorized for push, PR, merge, tag, release, asset upload, or the
next roadmap phase.
