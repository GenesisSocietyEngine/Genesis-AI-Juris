# Persistent Command-Log Save/Load v1

## Status and boundary

PR #9 is merged at `06e566afd6b09a6691800cd120bfb546d698583d` and
introduced replay-based persistence for validated
`ScenarioDefinition v1` sessions. Rust remains the sole authority for time,
actions, generated events, asynchronous completions, deadlines, Inbox state,
effects, and terminal outcomes.

Save v1 does not serialize private runtime structs. It records deterministic
session initialization plus accepted player commands and reconstructs state by
starting a new session and replaying those commands.

At the time this persistence contract was introduced, the legacy Failed ERP
Dart demo did not advertise persistence. The later local Failed ERP Rust
migration confirms that no supported legacy save could exist and therefore
adds no importer or alternate format. New Failed ERP sessions use the same
eight-field `scenario-runtime-v2` envelope and atomic replay/load contract as
the other Rust scenarios. See `FAILED_ERP_RUST_MIGRATION_V1.md`.

Matter Lifecycle v1 was subsequently merged through PR #10 at
`0c8c2cc11f6bab44abb3cdafe9f97dee91ff36fc`. Its persistence remediation keeps
the envelope shape unchanged while introducing an explicit v2 runtime profile
for the changed replay, lifecycle, and digest semantics.

## Public save envelope

The public Rust type is `ScenarioSaveEnvelope`. Its compact JSON form has these
fields:

```json
{
  "schema_id": "genesis.ai-juris.command-log",
  "schema_version": 1,
  "runtime_compatibility": "scenario-runtime-v2",
  "scenario_id": "greenfire_first_72_hours",
  "scenario_fingerprint": "64-lowercase-hex-sha256",
  "seed": 20260729,
  "commands": [
    {
      "command": "dispatch",
      "action_id": "accept_emergency_mandate"
    },
    {
      "command": "advance_time",
      "minutes": 90
    }
  ],
  "final_state_digest": "64-lowercase-hex-sha256"
}
```

`commands` accepts exactly two Save v1 variants:

- `dispatch` with one stable action ID;
- `advance_time` with authoritative simulated minutes.

Generated events are consequences of replay. They are never stored as
independent player commands.

The envelope contains no locale or wall-clock timestamp. Presentation metadata
may be added only in a future schema version or an explicitly non-authoritative
outer container.

## Command ordering and mutation

For an accepted runtime command:

1. clone the current session into a candidate;
2. append the player command to the candidate log;
3. apply its effects and generated temporal/event consequences;
4. publish the candidate only if the complete command succeeds.

A rejected action, invalid time advance, overflow, or event-budget failure
therefore does not add a command or partially mutate the live session.

Replay creates a clean session from the supplied canonical scenario and saved
seed. It applies the saved command vector in array order through the same
`dispatch` and `advance_time` methods used during play.

## Scenario fingerprint

The scenario fingerprint is SHA-256 over the complete serialized
`ScenarioDefinition`.

Before hashing:

- JSON object keys are recursively sorted;
- array order is retained because definition order controls presentation and
  deterministic event ordering;
- JSON is written without whitespace;
- strings and numbers use `serde_json` encoding.

Any content change, including stable IDs, conditions, effects, event order, or
canonical text, changes the fingerprint. A save is rejected rather than
silently replayed against different content.

Localized mobile overlays are not part of `ScenarioDefinition`; switching EN
and RU therefore does not change the fingerprint.

## Final-state digest

The runtime compatibility marker selects the digest profile. Both profiles
use SHA-256 over a separate canonical authoritative projection containing:

- scenario ID, scenario fingerprint, and seed;
- stage and elapsed scenario minutes;
- flags and fact statuses;
- available evidence;
- deadline statuses;
- async task statuses and due minutes;
- visible and resolved Inbox IDs;
- action-use counters;
- fired event IDs;
- terminal outcome ID.

`scenario-runtime-v1` preserves the historical projection exactly. It omits
`judicial_result` when no result exists, includes it when a PR #10 lifecycle
save has an authoritative result, and never includes
`judicial_decision_instance`. This single profile verifies both genuine
pre-PR #10 saves and the v1-labelled lifecycle saves emitted by PR #10 without
guessing producer generation from incidental fields.

`scenario-runtime-v2` always adds both `judicial_result` and
`judicial_decision_instance`, including explicit JSON `null` values before a
decision exists. The decision-instance value distinguishes the latest
authoritative decision that produced the current judicial result.

Maps and sets are backed by ordered Rust collections before canonical JSON
encoding. The digest does not include locale, JSON formatting, hash-map
iteration order, platform, time zone, or wall-clock time.

Current generic `ScenarioDefinition v1` sessions do not expose the legacy demo
workload, AI-usage, or spend model. If those concepts are added authoritatively
to this runtime later, they must be added through an explicit compatibility or
save-schema migration before they participate in Save v1 replay.

## Load validation and failure atomicity

Load rejects:

- malformed or truncated JSON;
- unknown schema ID or schema version;
- incompatible runtime marker;
- unknown scenario ID;
- mismatched scenario fingerprint;
- unknown command type;
- unknown action ID;
- illegal action order;
- zero or over-limit time advance;
- replay/runtime errors, including the automatic-event budget;
- a final digest that differs from the envelope.

Schema and runtime-marker validation happen before command payload decoding,
so an unsupported future runtime carrying a future command still fails as
`RuntimeCompatibility`, not `UnknownCommand`. Compatibility validation and the
v1 migration preflight both happen before command replay.

A v1 definition is eligible only when the current generic validator passes and
a separate ordered-effect proof establishes the old outcome-implies-terminal
behavior is continuation-safe under v2. The proof requires every action-owned
outcome to finish at the last `set_stage` in a terminal/resolved stage. It
conservatively rejects event-owned outcome resolution; when an outcome action
explicitly triggers an event, it also rejects definitions in which any event
can change stage, because explicit, dependent, and due events share one queue.
This closes the case where an effect list enters a terminal stage, resolves an
outcome, and then leaves for a nonterminal stage—a shape the ordinary validator
can accept because it validates presence, not final ordered state.

An ineligible v1 save is rejected as `RuntimeCompatibility`, before it can
surface as an illegal command sequence or digest mismatch. No case-specific
stable ID is used by this proof. Conservative rejection is intentional where a
static proof would otherwise require a historical event interpreter.

The registry inserts the replayed session only after every command and the
final digest pass. A failed load leaves all existing session IDs and snapshots
untouched.

The mobile repository keeps its previous session ID and mapped snapshot until
Rust returns a complete loaded session and Flutter successfully maps that
snapshot. Only then does it swap IDs and dispose the old native session.

## JSON bridge and C ABI

Save/load reuse the existing transport:

```json
{"command":"save_session","session_id":42}
```

returns:

```json
{
  "type": "session_saved",
  "session_id": 42,
  "encoded_save": "{...Save v1 JSON...}"
}
```

Load supplies the current canonical scenario and opaque encoded save:

```json
{
  "command": "load_session",
  "scenario": {"schema_version":"1.0"},
  "encoded_save": "{...Save v1 JSON...}"
}
```

It returns a new process-local session ID only after verified replay.

No native export was added. ABI version remains 1 with exactly:

- `juris_mobile_bridge_execute`;
- `juris_mobile_bridge_string_free`;
- `juris_mobile_bridge_abi_version`.

## Flutter storage and clock lifecycle

Flutter stores only the opaque `encoded_save` string. Runtime interpretation
remains in Rust.

`ApplicationSupportGameSaveStore` uses the platform Application Support
directory and one stable file per case. Replacement uses a flushed and
read-verified temporary file plus a recoverable backup. No database, cloud
account, or synchronization service is introduced.

The shell:

- pauses foreground ticking for the complete save/load operation;
- asks for confirmation before load and supports cancellation;
- preserves the user's existing pause state;
- restarts at most one timer after a successful load;
- shows controlled not-found, corruption, and incompatibility messages;
- clears only Flutter-local read markers after load, while authoritative Inbox
  visibility/resolution comes from replay.

## Compatibility rules

The eight-field Save v1 wire envelope is compatible only when all of the
following match:

- schema ID `genesis.ai-juris.command-log`;
- schema version `1`;
- a supported runtime marker, `scenario-runtime-v1` or
  `scenario-runtime-v2`;
- scenario stable ID;
- complete scenario fingerprint;
- understood command variants and valid command sequence;
- the authoritative digest selected by the runtime marker.

`schema_version: 1` describes the unchanged eight-field wire shape.
`runtime_compatibility` independently identifies replay and digest semantics.
Every newly created or successfully migrated save is emitted with
`scenario-runtime-v2`; unknown markers fail closed and never fall back to the
newest runtime.

### v1 migration and rejection matrix

| Save producer/category | Loader behavior | Next save |
|---|---|---|
| Pre-PR #10 compatible canonical save | Pass the generic lifecycle preflight, replay with current semantics, and verify the exact historical v1 digest | Written as v2 with the v2 digest |
| Pre-PR #10 valid-v1 save that resolves an outcome before a terminal stage | Reject before replay as `RuntimeCompatibility`; do not report `IllegalCommandSequence` or digest mismatch | No save is written |
| Pre-PR #10 valid-v1 save whose ordered effects enter a terminal stage, resolve an outcome, then leave it | Reject before replay as `RuntimeCompatibility`, even though the current validator accepts the definition | No save is written |
| v1 definition with event-owned outcome resolution, or an outcome action that triggers events while some event can change stage | Conservatively reject before replay because continuation equivalence is not statically proven | No save is written |
| PR #10 v1-labelled lifecycle save | Pass preflight, replay, verify the v1 digest with conditional `judicial_result` and no decision-instance key, then derive the Rust-owned decision instance | Written as v2 with result and decision instance in the digest |
| Corrupted JSON or digest | Return the controlled JSON or integrity error after the applicable compatibility checks | No save is written |
| Unknown runtime marker | Reject before replay as `RuntimeCompatibility` | No save is written |

The two committed historical counterexamples cover both a direct nonterminal
outcome and ordered `terminal → resolve outcome → nonterminal` effects. Their
producer commits, Rust version, commands, exact v1 digests, expected results,
and disposable-worktree reproduction procedure are recorded in
`crates/juris-engine/tests/fixtures/persistence/README.md`. A failed migration
leaves the Rust registry and active Flutter session unchanged; an incomplete
successful native response or invalid mapped snapshot disposes only the
temporary loaded session.

Existing scenario JSON, mobile bundle schema, snapshot schema, and three-symbol
C ABI remain backward compatible.

## Known limitations

- Save v1 provides one manual slot per case ID; it has no slot browser,
  autosave schedule, cloud sync, or account ownership.
- Application-level file replacement is recoverable but does not claim
  transaction semantics across sudden device/filesystem failure.
- Saves are integrity-checked, not encrypted or authenticated against a
  malicious player.
- A canonical scenario text edit changes the full-content fingerprint even when
  gameplay semantics are unchanged.
- There is no background/offline time catch-up.
- The retired Failed ERP Dart demo had no supported persistence. Its later
  production Rust scenario uses this contract directly; no legacy importer
  exists or is required.
- Physical-device, release-signing, App Store, and Play Store behavior require
  separate verification.

## Future migration strategy

A future reader must validate `schema_id` and `schema_version`, then dispatch
on `runtime_compatibility` before replay. Migration should:

1. parse the old public envelope without private runtime structs;
2. transform old initialization/commands into the next public schema;
3. replay against an explicitly compatible content version;
4. compute and verify the digest profile declared by the old runtime marker;
5. derive the new authoritative state and compute the new profile only after
   successful replay;
6. write the migrated save only after successful replay.

Unknown versions must continue to fail closed. Internal Rust refactors that
preserve the public replay contract require no save migration.
