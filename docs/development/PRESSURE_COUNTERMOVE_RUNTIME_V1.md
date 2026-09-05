# Pressure & Countermove Runtime v1 - architecture contract

## Status and checkpoint boundary

This document defines the local-only Pressure & Countermove Runtime v1
checkpoint. The authoritative base is
`586a44800035edcd1b5c8f1457d0903ab4617dd7` on local branch
`feat/pressure-countermove-runtime-v1`.

The capability is generic runtime and product-platform infrastructure. It is
proved with debug/test-only content. None of the five production definitions,
the production catalogue, or the deterministic mobile bundle may contain a
pressure window in this checkpoint. Publication, a production Pressure Pilot,
release work, version changes, and later roadmap work remain excluded.

## Verified starting checkpoint

- `HEAD`, local `main`, `origin/main`, remote `main`, and merge base were all
  `586a44800035edcd1b5c8f1457d0903ab4617dd7` before branch creation.
- PR #4 was open and unchanged at
  `7aa6927e8ebfd6e205bfd12478ba28d52c40248a`.
- local recovery ref `backup/desert-water-pre-failed-erp` remained
  `44e565b22c52a4c3a3e69b2c137353b7771fcf77`; remote Dossier ref
  `feat/dossier-projection-v1` remained
  `62111ddef1623f0211149c70617564f2aa622dd4`.
- repository ruleset `Main` (`19991132`) was active for `~ALL`, with an empty
  exclusion list, deletion and non-fast-forward rules, and no bypass actors.
- the tracked worktree was clean. The sole untracked file was protected
  `docs/development/CURRENT_PROGRESS.zip`, 47,579 bytes, SHA-256
  `2e5f03f003a7d227cb4ce765e338a8f335d92879862e53bd1c27d65e116de3b6`.
- corrected Desert Water recovery save remained 12,060 bytes with eight
  fields, 291 commands, schema 1, `scenario-runtime-v2`, byte SHA-256
  `328d76e392230ac47ecac4ecda6c54af83a48155f4b0d414fe07a2fecabfe019`,
  and final-state digest
  `6ce210e4a6b55a2ec2495d3405adcd7c45ff2edee38cfee3f5c981e2a68d647c`.
  The installed application state was not opened or mutated.
- latest release tag remained `v0.6.0-alpha.1`; Flutter app version remained
  `0.6.0+13`.
- the production bundle remained 622,325 bytes, SHA-256
  `58d90d7cc50b853c395e4defe43579b1c7b5d7f3ae12cb9cfe5ec2e22751c97a`.
- the accepted ordinary debug APK remained 203,489,120 bytes, SHA-256
  `4f8934a085a87f2ed5e29622289f205694da8ba6b7e86b1986d62342ff667071`.
- C ABI remained version 1. NDK `llvm-nm -D --defined-only` found exactly
  `juris_mobile_bridge_abi_version`, `juris_mobile_bridge_execute`, and
  `juris_mobile_bridge_string_free` in `armeabi-v7a`, `arm64-v8a`, and
  `x86_64`.
- `cargo test --workspace` passed the accepted 320-test baseline. The accepted
  Flutter baseline is 149/149 and Android 17 / API 37 native baseline is 9/9.
  Two unchanged Flutter baseline invocations were inconclusive host stalls:
  the first timed out after 180 seconds and the single permitted retry after
  300 seconds, both without compiler, assertion, or test output. No product or
  test failure is inferred from those attempts.

A separate local documentation-only commit from the preceding published
checkpoint is parked on `docs/training-debrief-final-cleanup-handoff`. It is
not an ancestor of this feature branch and is outside this checkpoint.

## Normative definition contract

`ScenarioDefinition` gains one optional/default-empty collection:

```text
pressure_windows[]:
  id
  source_actor_id
  activation_event_id
  response_deadline_id
  response_action_ids[]
  countermove_event_id
```

The concrete schema type is `PressureWindowDefinition`, with a typed
`PressureWindowId`. It is reference-only: it contains no prose, condition,
effect, score, probability, localized value, timer, or mutable state.

Normative invariants are:

1. pressure IDs are non-empty and unique within the scenario;
2. `source_actor_id` references an existing actor;
3. activation, deadline, response-action, and countermove references exist;
4. response actions are non-empty, unique, and definition-ordered;
5. activation and countermove event IDs differ;
6. the referenced deadline's `activation_event` equals the pressure
   activation event;
7. the referenced deadline's `missed_event` equals the pressure countermove
   event;
8. every response action is a declared `completion_action` of the response
   deadline and names that deadline in either its `completion_deadlines` or
   `advance_to_deadlines` timing contract.

Rules 6-8 are required by repository evidence. They make activation,
successful response, expiry, and exact-boundary behavior compositions of the
existing deadline engine instead of a second pressure state machine. The core
validator can prove these relations structurally. Cross-stage reachability and
concrete trace timing remain deterministic simulation-test responsibilities.

The collection uses
`#[serde(default, skip_serializing_if = "Vec::is_empty")]`. Existing
definitions therefore deserialize with an empty collection and serialize
without a new key. Because the scenario fingerprint hashes canonical
serialization of the complete `ScenarioDefinition`, omission of the empty
collection is mandatory for byte- and fingerprint compatibility.

## Authoritative source map

| Datum or behavior | Existing authority | Pressure use |
|---|---|---|
| Stable schema references | typed IDs in `juris-scenario-schema/src/ids.rs` | typed pressure, actor, event, deadline, and action references |
| Definition serialization | `ScenarioDefinition` plus serde defaults in `scenario.rs` | skipped empty `pressure_windows` collection |
| Fingerprint | `scenario_runtime::persistence::scenario_fingerprint()` canonicalizes the complete definition | no production change because the empty field is absent |
| Actor identity/name | `ActorDefinition` and stable-ID locale overlays | Rust projects only actor ID; Flutter resolves a display name |
| Activation | `ScenarioRuntimeState::fired_events`, written by `process_event_queue_with_context()` | activation event must have fired; its ID is never projected |
| Live response deadline | `deadline_statuses` and `deadline_due_minutes`, initialized/activated by `ScenarioSession::new()` and `activate_deadline()` | status must be `Open`; stored due minute is authoritative |
| Deadline policy | `DeadlineDefinition::completion_at_due_allowed`, `ensure_completion_is_timely()`, and `deadline_miss_boundary()` | exact-due acceptance/rejection is inherited unchanged |
| Currently executable responses | `ScenarioSession::available_actions()` after stage, condition, repeatability, and completion checks | definition-ordered intersection with authored response IDs |
| Accepted response | candidate-atomic `ScenarioSession::dispatch()` and existing deadline precompletion/completion | ordinary action effects execute once; the deadline ceases to be open |
| Countermove | `queue_due_events()` marks the deadline missed and queues its ordinary missed event; `process_event_queue_with_context()` applies its effects | no parallel consequence or pressure-owned effect path |
| Inbox consequence | `activate_event_owned_state()` and ordinary `CreateInboxItem` effects | visible only through existing Inbox projection after event processing |
| Closure | `ScenarioSession::is_closed()` / stage-derived `MatterLifecycleStatus` | closed sessions expose no active pressure |
| Snapshot bytes | `MobileScenarioSnapshot`, serialized through the existing bridge execute response | one optional nested projection; no authored inventory |
| Save/replay | eight-field `ScenarioSaveEnvelope`; `from_save_envelope()` creates a fresh session and replays accepted commands | normal replay re-derives fired events, deadlines, and active pressure |
| Final digest | `final_state_digest()` hashes authoritative runtime state and the definition fingerprint | projection is not independently added to v1 or v2 digest profiles |
| Flutter state | `ScenarioSnapshotMapper` -> immutable `GameSnapshot` | maps only the nested Rust projection |
| Response execution | `HomeShell._showActions()` -> existing confirmation sheet -> `GameRuntimeRepository.applyAction()` | Pressure reuses this path exactly once |
| Clock suspension | `HomeShell._whileClockSuspended()` | review UI sends no command and pauses foreground ticks |

## Runtime lifecycle and exact-boundary semantics

### Inactive

Before the activation event fires, the projection is absent. Neither pressure
ID, actor ID, deadline reference, response inventory, nor countermove ID is
serialized.

### Active

A pressure window is active only when all of these are true:

- the session is not closed;
- its activation event is present in authoritative fired-event state;
- its referenced deadline has authoritative status `Open`;
- its countermove event has not fired.

The active projection is derived without mutation or replay. It contains:

```text
pressure_and_countermove:
  projection_schema_version: 1
  active_pressures[]:
    pressure_id
    source_actor_id
    due_at_minute
    remaining_minutes
    available_response_action_ids[]
```

`remaining_minutes` is `due_at_minute.saturating_sub(clock_minutes)`.
Response IDs are the definition-ordered intersection with the already-built
authoritative available-action projection. An active window remains visible
with an empty response list. Simultaneous windows preserve definition order.
The entire nested object is omitted when no window is active.

Activation minute is deliberately not projected in v1. Existing state stores
that an event fired, not the minute it fired, and the product contract does not
need activation history to answer the active-play questions. Inventing or
retaining another timestamp would add state without player value.

### Responded

The existing dispatch candidate clone validates the action, applies its
ordinary effects, processes its clock boundaries, and commits only on success.
Because a response action is structurally bound to the referenced deadline,
an accepted timely response completes that deadline through existing logic.
The pressure then disappears. Rejected, malformed, unavailable, or late
dispatches do not commit the candidate, so pressure state and all other bytes
remain unchanged.

### Countermove

At the existing deadline miss boundary, `queue_due_events()` marks the
deadline missed and queues its authored missed event. The ordinary event
engine applies that event's existing effects and Inbox behavior once. Since
the deadline is no longer open, the pressure projection disappears. The
projection never contains the countermove event ID or its future effects.

### Exact boundary and large advances

`completion_at_due_allowed = true` accepts response completion at the due
minute and misses at due plus one. The default false policy rejects completion
at due and misses at the due minute. The pressure layer does not reinterpret
either rule. `advance_clock_to_with_deadline_completion()` and
`queue_due_events()` retain the established AtTime, async-completion, then
deadline-miss category order. One large foreground advance and equivalent
smaller advances therefore use the same temporal boundaries.

### Terminal lifecycle

Stage-derived closure suppresses the entire pressure projection and existing
runtime command guards continue rejecting post-terminal dispatch and time
advance. Pressure UI cannot re-enable commands.

## Disclosure boundary

V1 exposes only active, player-relevant pressure data. It never projects:

- inactive or resolved pressure definitions;
- activation or countermove event IDs;
- unavailable authored response IDs;
- conditions, effects, flags, future events, probabilities, or ideal answers;
- a historical ledger or a second debrief.

Raw serialization tests must search for every fixture-only stable ID before
activation, while active, after response, after countermove, and after closure.
Repeated snapshots must be byte-equal and side-effect-free.

## Persistence, replay, digest, bridge, and ABI compatibility

Pure derivation is sufficient; no private runtime tracker is required.
Pressure adds nothing to `ScenarioCommand`, `ScenarioSaveEnvelope`, or either
final-state digest projection. Save identity remains
`genesis.ai-juris.command-log`, schema remains 1, the envelope remains eight
fields, and runtime compatibility remains `scenario-runtime-v2`.

Load continues to build a candidate session and replay each accepted command
once. That replay reconstructs activation events, deadline status/due minutes,
and available actions, so equal pressure semantics follow automatically.
`snapshot()` performs no replay and no mutation.

The existing snapshot command carries the optional nested projection through
the existing JSON bridge and `juris_mobile_bridge_execute`. No command, FFI
function, ABI version, or native export is added.

## Flutter product-platform contract

Flutter adds immutable pressure view models and maps only
`pressure_and_countermove`. Missing/null means no UI. Malformed required
active data follows the established `FormatException` behavior. Unknown future
projection versions and stable IDs remain display-safe and never dispatch by
themselves.

The active Matter screen presents an accessible Pressure card with:

- actor name resolved from stable-ID scenario text and EN/RU overlays;
- due scenario minute and remaining scenario minutes, explicitly labelled as
  game time;
- the count/state of currently projected responses;
- neutral copy when the list is empty;
- a Review responses entry point only when response IDs are available.

Review responses filters the existing `snapshot.actions` by Rust-projected IDs
in projection order and opens the existing clock-suspended action picker and
confirmation flow. Reading, opening, and closing send no gameplay command.
There is no wall-clock countdown, periodic client mutation, or alternate
dispatch path.

## Debug/test-only vertical slice

The repository already supports an integration-only
`MobileCaseDefinition` with inline scenario JSON under
`integration_test/support`, proving that native tests can instantiate real
schema through the existing create-session command without adding content to
the production catalogue or bundle. Pressure uses the same harness pattern;
no bridge extension is required.

The neutral fixture contains one activation event, one relative live response
deadline, two ordinary response actions, and one deadline-missed countermove
event with ordinary visible metric/Inbox consequences. Its traces cover:

- absence before activation;
- active projection and ordered response filtering;
- successful response;
- no-response countermove;
- both exact-due policies through focused fixtures;
- rejected-response atomicity;
- stable simultaneous-window order and independent resolution;
- save/dispose/load parity and repeated snapshots;
- bridge, FFI, Flutter mapping/UI, and Android native lifecycle where the
  established harness is available.

Fixture IDs remain test-only and must not appear in the generated production
bundle.

## Rejected alternatives

- A pressure-owned effect list would create a second effects engine.
- Flutter-derived activation or countdown state would cross the authority
  boundary and diverge during save/load or suspended navigation.
- Projecting all authored responses or the countermove event would disclose
  hidden future content.
- Replaying the command log in `snapshot()` is unnecessary and expensive.
- A persisted or replay-derived pressure tracker is unnecessary because the
  existing event/deadline/action relations fully determine active state.
- Scenario-ID switches in Rust or Flutter would turn generic infrastructure
  into production-case logic.
- Adding fixture content to the catalogue or bundle would violate the
  production activation boundary and intentionally change fingerprints.

## Test and acceptance plan

Focused Rust tests cover schema defaults/omission, every structural/reference
diagnostic, active lifecycle, response/countermove traces, exact boundaries,
atomic failures, large-step parity, ordering, closure, replay, snapshot bytes,
bridge, and FFI. Flutter tests cover mapping, unknown/malformed data, EN/RU,
game-time labels, zero responses, ordering, scaling/overflow/scrolling,
command-free navigation, and one confirmed dispatch.

Full acceptance then runs the required MSRV, format, check, Clippy, Rust,
bundle, Dart format, Flutter analysis/test, diff, Android integration, APK,
and three-ABI symbol gates. Production fingerprints, all 11 canonical results,
bundle bytes, persistence contracts, and existing feature contracts remain
exact. Hosted iOS is explicitly not run at this local Windows checkpoint.

## Mandatory architecture stop assessment

No stop condition is present in the inspected repository:

- no save/envelope/schema migration is needed;
- no bridge command or C ABI change is needed;
- no new effect interpreter, scheduler, or wall-clock timer is needed;
- no command-log replay occurs in `snapshot()`;
- Flutter owns no lifecycle decision;
- no scenario-specific production branch is needed;
- no production definition is required for proof;
- skipped-empty serialization preserves current definition bytes;
- the active-only projection prevents hidden future disclosure.

Implementation may proceed under this contract. Any later evidence that breaks
one of these conclusions reinstates the stop at the first failing boundary.
