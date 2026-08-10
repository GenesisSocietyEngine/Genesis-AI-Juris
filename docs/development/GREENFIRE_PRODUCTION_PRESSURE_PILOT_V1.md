# GreenFire Production Pressure Pilot v1

Status: **local implementation accepted — publication pending**

Resolution date: 2026-08-10

Authoritative base (`RETENTION_FINAL_MAIN`):
`f0ef69b97c3846ed3dfc95ee5b65e08927acdcbd`

Historical stop date: 2026-08-08

Historical stop base: `2390c69d27d866e8b8d360e8bdcc71919d3f105c`

Implementation branch: `feat/greenfire-production-pressure-pilot-v1`

Historical stopped branch: `feat/greenfire-regulatory-pressure-pilot-v1`

## Current architecture resolution

The owner has explicitly authorized implementation of the GreenFire Production
Pressure Pilot from `RETENTION_FINAL_MAIN`. The architecture stop recorded
below remains the historical explanation of the original blocker; it is not a
current implementation stop.

The generic Immutable Content Version Retention work published through PRs
#23 and #24, together with the retention hardening published through PR #25,
resolves the blocker without weakening save integrity or adding a GreenFire
special case:

- current catalogue content resolves only its exact scenario ID/fingerprint
  tuple, while immutable load-only content can retain the exact historical
  tuple required by a published save;
- the resolved target state assigns GreenFire `0.2.0` to the current catalogue
  and retains the byte-exact GreenFire `0.1.0` definition as an immutable
  load-only archive for old saves;
- Rust validates the save envelope through the read-only `inspect_save`
  command before Flutter performs exact-tuple resolution, so compatibility and
  command validation remain authoritative and precede content lookup;
- the bundle exporter invokes the authoritative Rust fingerprint verifier for
  both current and archived definitions before either writing a bundle or
  accepting `--check`.

The authorized product delta remains exactly one ordered pressure window:
`regulator_document_request_pressure`. It activates with
`regulator_request_received` at absolute minute 120 and uses
`initial_regulatory_response_deadline`, due at absolute minute 2,160. Both
ordered responses keep their authored 180-minute duration and gain the same
finish-by declaration. Because completion at due is excluded, a start at
minute 1,979 may finish at 2,159, while a start at minute 1,980 must be rejected
atomically. The protected and compromised canonical paths must continue to end
at minutes 4,440 and 4,590 respectively.

The accepted `RETENTION_FINAL_MAIN` baseline is Rust 345/345, Flutter 157/157,
and Android API 37 native integration 11/11. The generic bridge protocol now
has eight commands, including read-only `inspect_save`; its C ABI remains
unchanged at version 1 with exactly the existing three exported symbols.

Implementation is now authorized subject to the exact contract, exclusions,
local and hosted acceptance gates, and publication requirements in the
governing instruction set.

## Local implementation checkpoint

The production implementation and its complete local acceptance are now
finished on the fresh branch based on exact `RETENTION_FINAL_MAIN`. The
pre-checkpoint implementation HEAD is
`2334a6cdd3663a8e67fa41983b353e9ef2bc7537`; this document is the sixth and
final intentional product-branch commit. Publication, hosted iOS acceptance,
product merge, and the separate one-file `CURRENT_PROGRESS.md` evidence PR
remain pending.

The implementation history before this checkpoint is linear and preserves the
historical cherry-pick as a distinct commit:

1. `5500ebe3c93520f0aaaf101765ca3df36eb2f714` — historical architecture
   checkpoint, cherry-picked with `-x` from
   `c97e66a7d35ac8e5a60f78e2369a332508a2cca6`;
2. `dab42bfd0dd2f636c6a1b8d6d915a547a40b02e1` — compatibility resolution;
3. `e26b88e3fe8885765bee1f99a459105373ddd40f` — current content activation;
4. `4702c8333e89119342c32282279793ba95a7d0d8` — Rust, bridge, FFI, validator,
   inventory, persistence, visibility, and canonical coverage;
5. `2334a6cdd3663a8e67fa41983b353e9ef2bc7537` — Flutter and Android native
   acceptance coverage.

### Accepted deterministic drift

Current GreenFire is now `0.2.0` with authoritative fingerprint
`173140f010723c50f580fe9fd4e91417d3a20f51ca0b5315d94e900c1bde2438`.
Its canonical source is 29,969 bytes with SHA-256
`d6bd5e4d8605fe97673e1f6626d8b7b2bb78d82c396336146a997a891f518876`;
the current Russian overlay is 10,708 bytes with SHA-256
`f8ae379a93b5fcdddabded929329209f5f1c6cecd3f5f6ff2d4fc6de4777f120`.

The current definition has exactly one pressure window, and both response
actions carry exactly
`completion_deadlines: [initial_regulatory_response_deadline]`. The other
four production definitions preserve default key omission and their exact
fingerprints:

| Scenario | Accepted current fingerprint |
|---|---|
| Failed ERP | `ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8` |
| Logistics | `1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8` |
| GreenFire `0.2.0` | `173140f010723c50f580fe9fd4e91417d3a20f51ca0b5315d94e900c1bde2438` |
| GoldenShell | `7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4` |
| Desert Water | `636e7b78ddccf01b23476e53ab77f3c8b0c82406be7c567afbd9f1edc41a28af` |

The generated bundle v5 contains five current cases and exactly one load-only
definition. Two normal exports reproduced the committed 684,266-byte file
byte-for-byte; its SHA-256 is
`e90f856cbb0f4625f7612a99db2f527ac3b090619019b7a83c21140f78f1984a`,
and the authoritative exporter `--check` passes.

Archived GreenFire remains the exact immutable `0.1.0/F0` identity. Its
scenario blob is unchanged at 29,359 bytes, SHA-256
`a0237b3260d184d114eb79ad3fcf019d9b4cf540012e2fefb7478002162ef82c`,
fingerprint
`b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261`.
Its Russian overlay is unchanged at 10,563 bytes, SHA-256
`af176bb2610e6602bf3b2d411a90e175f17c17e90391315c0999b50ee5c88cf5`.
The real pre-pilot runtime-v1 save resolves through that archive, replays,
resaves as runtime v2 with F0, and reloads identically. Current active saves
resolve only through F1; unknown identities fail before live-session
replacement.

All 11 canonical outcome/minute contracts remain exact. Only the two
definition-bound GreenFire digests changed:

| Scenario / path | Final minute | Outcome | Accepted digest |
|---|---:|---|---|
| Failed ERP / settlement | 570 | `settlement_64500` | `fd77a45422e4abd7f141fc7b1db767524ebf48d9674bd25c21354fb7a2b8c029` |
| Failed ERP / prepared judgment | 8,640 | `judgment_preserved_after_cassation` | `f25604fc0225d7ac5a7e98d192ce3b82114970158a3662aee7575b128430ca0c` |
| Failed ERP / remittal/open | 10,080 | none | `268f27867fd1f45a417c0e999819165bd79f76a74f3ab2e65ee075e193cbc34a` |
| Logistics / negotiated | 270 | `negotiated_recovery` | `139239e001417ae563e270128864a512e88c0ff535a498e15b000731b8ca5bfe` |
| Logistics / judgment | 480 | `judgment_recovery` | `e25e1eeb36249c1b7da0fe7a947f29ed3363ce7dac0357a110951c49bb738ac3` |
| GreenFire / protected | 4,440 | `protected_crisis_position` | `524078c5a72296b9b6549b2dca88cf2d727d0b28cb7c69012500b320919cdd58` |
| GreenFire / compromised | 4,590 | `compromised_crisis_position` | `3b9d4a3776d65678a0318730d3d366f9279d318c197300c792b10d89a14f8aec` |
| GoldenShell / coordinated | 4,545 | `coordinated_claim_position` | `72986eeb4a3a690b775ea86c6ac5c9da02027ef5a0ca03292736b5e805f8c53b` |
| GoldenShell / fragmented | 4,710 | `fragmented_claim_position` | `846c96ed8ba240bb392daead67e03bd6b9a7cbe1b23bdd6d412314e582c13503` |
| Desert Water / coordinated | 3,180 | `credible_source_and_remedy` | `432df44aa3f9039ea3970298a0c2dbfe111f0ddfbf76713c75c1cc92261e0e2d` |
| Desert Water / compromised | 3,510 | `compromised_claim_closed` | `a8ce4971e6898c5e020697733288cae4fc142cdb28f599551c7bfa0405c141ce` |

### Complete local acceptance

All gates ran against committed implementation HEAD
`2334a6cdd3663a8e67fa41983b353e9ef2bc7537` before this documentation-only
checkpoint:

| Gate | Result |
|---|---|
| Rust 1.78 locked workspace check | pass |
| Rust format, current workspace check, Clippy `-D warnings` | pass |
| Full Rust workspace tests | `352/352` pass |
| Bundle normal export twice and `--check` | pass; byte-identical |
| Dart format | 57 files, zero changes |
| Flutter analysis | no issues |
| Full Flutter tests | `159/159` pass |
| Android native integration | Android 17 / API 37, `12/12` pass |
| Ordinary debug APK | pass; 203,489,120 bytes; SHA-256 `ff1b59a4a4d226cf4b56beed06588add6021630015bceee73f018da9971dfa69` |
| Three-ABI `llvm-nm` audit | pass; exact approved three symbols in `armeabi-v7a`, `arm64-v8a`, and `x86_64` |
| `git diff --check` and tracked/index audit | pass |

The native lifecycle covers preactivation, the minute-120 projection,
definition-ordered responses after the controlled channel opens, active F1
save/load parity, command-free review cancellation, one confirmed controlled
Dispatch, and a disposable miss at minute 2,160. The generic runtime tests
also prove both responses, minute 1,979/1,980 exclusivity, rejected-command
atomicity, large/chunk parity, one-shot miss, terminal omission, and
post-closure rejection. No GreenFire-specific production code path was added.

The C ABI remains version 1 with exactly
`juris_mobile_bridge_abi_version`, `juris_mobile_bridge_execute`, and
`juris_mobile_bridge_string_free`. Save identity, eight-field envelope,
schema 1, runtime compatibility rules, digest profiles, bridge command
inventory, app version `0.6.0+13`, tag/release state, and hosted workflows are
unchanged.

### Local transient record

- The first sandboxed bundle export stalled without product/test output and
  timed out after 180 seconds. The single permitted elevated retry succeeded;
  a second normal export and `--check` then proved byte identity.
- Two wrapper-based Dart formatter invocations stalled on the host. Direct SDK
  formatting completed; one sandboxed invocation then reported only denied
  telemetry-session timestamp access after formatting. The elevated final
  format check completed normally with zero changes.
- The first focused Flutter run exposed two new-test assertion defects: an EN
  fallback title did not use production source prose, and an exact semantics
  finder did not account for merged semantics. Both tests were corrected;
  focused reruns and the full `159/159` suite pass.
- An independent review prompted stronger unavailable-action, terminal,
  raw-omission, and visibility assertions. The first focused compile of the
  strengthened visibility assertion found a typed-ID/String comparison; it
  was corrected before the final focused and full Rust passes.
- The first `llvm-nm` invocation was denied sandbox execution access to the
  installed NDK. The same already extracted APK libraries were audited once
  with approved elevated access; no rebuild or byte change occurred.

### Protected state and publication boundary

The sole untracked file remains protected
`docs/development/CURRENT_PROGRESS.zip`, 47,579 bytes, SHA-256
`2e5f03f003a7d227cb4ce765e338a8f335d92879862e53bd1c27d65e116de3b6`.
The corrected Desert Water save was hashed only and remains 12,060 bytes,
SHA-256
`328d76e392230ac47ecac4ecda6c54af83a48155f4b0d414fe07a2fecabfe019`.
It was not parsed, loaded, replayed, migrated, reset, or opened in gameplay.

The historical stopped branch remains exact at
`c97e66a7d35ac8e5a60f78e2369a332508a2cca6`; recovery and Dossier refs,
PR #4, ruleset, version, annotated tag, prerelease, and release assets remain
protected. No release, tag, asset, version bump, branch cleanup, second
production pressure activation, visual work, Legal Theory work, or later
roadmap phase occurred.

Hosted Rust, Flutter, and iOS acceptance is not inferred from these local
results. The next authorized action is publication of the exact reviewed
feature HEAD through a Draft PR, normal merge commit, post-merge hosted gates,
and then a separate one-file publication-evidence PR.

## Historical architecture stop (preserved)

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

## Historical stop boundary (superseded)

The branch contains documentation only. Production GreenFire, generated
bundle, APK, persistence fixtures, tests, `CURRENT_PROGRESS.md`, protected
state, refs, rules, release metadata, and application version remain unchanged.
Nothing is authorized for push, PR, merge, tag, release, asset upload, or the
next roadmap phase.
