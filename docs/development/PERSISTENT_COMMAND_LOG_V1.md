# Persistent Command-Log Save/Load v1

## Status and boundary

This checkpoint adds replay-based persistence for validated
`ScenarioDefinition v1` sessions. Rust remains the sole authority for time,
actions, generated events, asynchronous completions, deadlines, Inbox state,
effects, and terminal outcomes.

Save v1 does not serialize private runtime structs. It records deterministic
session initialization plus accepted player commands and reconstructs state by
starting a new session and replaying those commands.

The legacy Failed ERP Dart demo is unchanged and does not advertise this save
contract. The open `Lost != Closed` lifecycle work in PR #4 is intentionally
not included.

## Public save envelope

The public Rust type is `ScenarioSaveEnvelope`. Its compact JSON form has these
fields:

```json
{
  "schema_id": "genesis.ai-juris.command-log",
  "schema_version": 1,
  "runtime_compatibility": "scenario-runtime-v1",
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

The final-state digest is SHA-256 over a separate canonical authoritative
projection containing:

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

Save v1 is compatible only when all of the following match:

- schema ID `genesis.ai-juris.command-log`;
- schema version `1`;
- runtime marker `scenario-runtime-v1`;
- scenario stable ID;
- complete scenario fingerprint;
- understood command variants and valid command sequence;
- final authoritative digest.

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
- The legacy Failed ERP Dart demo is not persisted by this contract.
- Physical-device, release-signing, App Store, and Play Store behavior require
  separate verification.

## Future migration strategy

A future reader must dispatch on `schema_id` and `schema_version` before
decoding commands. Migration should:

1. parse the old public envelope without private runtime structs;
2. transform old initialization/commands into the next public schema;
3. replay against an explicitly compatible content version;
4. compute and verify the new final-state digest;
5. write the migrated save only after successful replay.

Unknown versions must continue to fail closed. Internal Rust refactors that
preserve the public replay contract require no save migration.
