# Immutable Content Version Retention v1

Status: architecture accepted for local implementation

Date: 2026-08-08

Authoritative base and merge base:
`2390c69d27d866e8b8d360e8bdcc71919d3f105c`

Branch: `feat/immutable-content-version-retention-v1`

## Decision

Scenario-content compatibility is exact retention, not migration. A save is
bound to the immutable definition identified by:

```text
(scenario_id, scenario_fingerprint)
```

New games use exactly one current definition for a scenario ID. Loading may
select either that exact current definition or an explicitly retained
load-only definition with the requested fingerprint. After selection, the
existing Rust save loader recomputes the definition fingerprint, checks the
untouched envelope, validates every command, replays it, and checks the final
digest. No command, ID, fingerprint, digest, outcome, or content is translated
between definitions.

`metadata.content_version` is human-readable inventory metadata. It must
match the retained manifest but is never a lookup or integrity key.

The stopped GreenFire Pressure pilot remains separate. This phase retains
GreenFire `0.1.0`; it does not activate Pressure or create GreenFire `0.2.0`.

## Starting evidence

The stopped branch
`feat/greenfire-regulatory-pressure-pilot-v1` remains unchanged at
`c97e66a7d35ac8e5a60f78e2369a332508a2cca6`, one 359-line architecture
document above published `main`. This branch was created independently from
the same published `main`.

Accepted baselines are Rust 333/333, Flutter 153/153 with clean analysis, and
Android API 37 native integration 10/10. Production content has five cases
and 11 canonical paths. The starting mobile bundle is version 4, 622,325
bytes, SHA-256
`58d90d7cc50b853c395e4defe43579b1c7b5d7f3ae12cb9cfe5ec2e22751c97a`.
The ordinary debug APK is 203,489,120 bytes, SHA-256
`50d6874ba1b9148cbb3c78a459c8afd9b2db890882b29b88c433332e940b7cfd`.

The protected ZIP and Desert Water save remain respectively:

- 47,579 bytes,
  `2e5f03f003a7d227cb4ce765e338a8f335d92879862e53bd1c27d65e116de3b6`;
- 12,060 bytes,
  `328d76e392230ac47ecac4ecda6c54af83a48155f4b0d414fe07a2fecabfe019`.

## Existing save and replay path

### Envelope parsing and error precedence

`ScenarioSaveEnvelope` is the stable eight-field structure:

1. `schema_id`;
2. `schema_version`;
3. `runtime_compatibility`;
4. `scenario_id`;
5. `scenario_fingerprint`;
6. `seed`;
7. `commands`;
8. `final_state_digest`.

`ScenarioSaveEnvelope::from_json` first parses controlled JSON, then reads and
validates the compatibility header before interpreting command variants. A
future runtime marker therefore wins over an unknown command. It next
classifies unknown command names and finally deserializes the deny-unknown
eight-field envelope. Retention must call this same parser and preserve that
precedence.

### Strict loader

`ScenarioSession::from_save_json` parses the envelope and delegates to
`from_save_envelope`. `validate_envelope_compatibility` checks the header,
scenario ID, and recomputed full-definition fingerprint before session
construction. Runtime-v1 migration eligibility is checked before replay.
Commands are preflighted and replayed on a new candidate session; the selected
v1/v2 final digest profile is then compared with the envelope.

`ScenarioSessionRegistry::load_from_json` inserts only a completely replayed,
integrity-checked session. A failure cannot partially mutate or replace an
existing registry session.

The fingerprint is SHA-256 over the complete serialized
`ScenarioDefinition`. The v2 final digest includes that fingerprint plus the
authoritative runtime projection. Neither algorithm changes in this phase.

## Historical fixture inventory

The real fixtures under
`crates/juris-engine/tests/fixtures/persistence` are immutable producer bytes.
They include pre-lifecycle Logistics and GreenFire saves, negative/corrupted
fixtures, two exact counterexample definitions, and four PR #10 lifecycle
fixtures. Their README records producer commits, digests, commands, and
expected behavior.

The relevant published GreenFire fixture is
`06e566a_losing_terminal_outcome.json`. It has:

- scenario ID `greenfire_first_72_hours`;
- fingerprint
  `b585c95424169d72ac28a5d925a972e34464809a88f5c65f82261`;
- runtime marker `scenario-runtime-v1`;
- the committed compromised command trace;
- v1 digest
  `f048a70b6abe0cfc67682c2ac4968ce03e27dee9f647bcefc19e26b77ec7ab04`.

The existing golden test loads it with the one current GreenFire definition,
replays it, verifies the compromised terminal outcome, resaves as runtime v2,
retains the fingerprint and commands, and reloads the v2 result. Retention
changes only how that exact definition is obtained.

## Inventory model

The source inventory will consist of:

- ordinary current definitions already owned by `content/catalog/catalog.json`;
- a versioned archive manifest;
- immutable files under
  `content/archive/greenfire_first_72_hours/0.1.0/` for the exact definition
  and matching RU scenario overlay.

The first retained entry is:

| Field | Value |
|---|---|
| Role | load-only historical |
| Scenario ID | `greenfire_first_72_hours` |
| Content version | `0.1.0` |
| Fingerprint | `b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261` |
| Pressure windows | none |

The archived files begin byte-identical in semantic JSON content to the
current GreenFire `0.1.0` definition and overlay. They remain separate so a
future current edit cannot rewrite historical bytes.

Inventory construction validates every definition normally, recomputes its
fingerprint, and verifies the declared scenario ID, content version and
fingerprint. Keys are exact tuples. Current scenario IDs are unique.
Duplicate/conflicting entries fail deterministically. A temporarily identical
current/archive tuple may de-duplicate definition bytes internally while both
roles remain explicit.

Archive iteration order is not selection order. Lookup uses the tuple only;
there is no semver, closest, newest or scenario-ID-only fallback.

## Resolution algorithm

### New game

1. Resolve the scenario ID in the current-role map.
2. Reject a missing or duplicate current entry.
3. Create the session from the current definition only.

No load-only definition is exposed by the catalogue or accepted by the
normal new-game inventory operation.

### Save load/import/resume

1. Parse the encoded save with the existing controlled Rust envelope parser.
   Mobile invokes that parser through the read-only `inspect_save` bridge
   command before attempting inventory lookup.
2. Read its `scenario_id` and `scenario_fingerprint` without executing a
   command or allocating a registry session.
3. If the scenario ID is unknown to both roles, return `UnknownScenario`.
4. Resolve the exact tuple across current and load-only entries.
5. If the scenario is known but the fingerprint is unknown, return
   `FingerprintMismatch`; never fall back to current content.
6. Pass the exact resolved definition and the untouched encoded envelope to
   `ScenarioSessionRegistry::load_from_json` or the existing `load_session`
   bridge request.
7. Let the unchanged Rust ID, fingerprint, command, replay and digest checks
   run.
8. Insert/swap a session only after complete success.

The Rust inventory provides the generic core contract and golden/synthetic
proof. The serialized mobile inventory mirrors the same identities so Flutter
can select the candidate already carried by the existing request. Flutter is
not trusted to assert compatibility: a wrong candidate still fails the
unchanged Rust fingerprint comparison.

## Bridge, FFI and registry ownership

The transport-neutral JSON bridge inventory is:

- `create_session { scenario, seed }`;
- `snapshot { session_id }`;
- `dispatch { session_id, action_id }`;
- `advance_time { session_id, minutes }`;
- `save_session { session_id }`;
- `inspect_save { encoded_save }`;
- `load_session { scenario, encoded_save }`;
- `dispose_session { session_id }`.

`inspect_save` is a read-only retention-hardening command. It calls
`ScenarioSaveEnvelope::from_json`, returns only the validated scenario ID and
fingerprint, and cannot replay a command, allocate a registry session, or
replace live state. `load_session` continues to carry the exact selected
definition and the untouched envelope. `MobileBridge` continues to own one
`ScenarioSessionRegistry`, and FFI continues to expose ABI v1 through only
`juris_mobile_bridge_abi_version`, `juris_mobile_bridge_execute`, and
`juris_mobile_bridge_string_free`.

## Mobile bundle and catalogue boundary

The deterministic exporter will add a root-level, explicitly load-only
inventory section and bump the internal bundle format from 4 to 5. Historical
entries will not be placed inside `cases`.

Each entry carries only:

- declared scenario ID, content version and fingerprint;
- exact archived definition;
- matching scenario localization overlays needed for rendering.

The five current cases remain the only catalogue cards, in the same order,
with unchanged identities, readiness, seeds and definitions. New GreenFire
creation continues to use the current case definition. Archive entries have
no case-card identity, sort order, status, readiness or new-game adapter.

Exporter validation checks manifest shape, stable identities, unique tuples,
file metadata agreement, and localization coverage. Before either writing the
bundle or accepting `--check`, it invokes one Rust verifier process covering
every current and retained declaration. The verifier parses each typed
`ScenarioDefinition`, recomputes the engine-authoritative fingerprint, and
compares it with the manifest pin. Bundle export remains deterministic and
`--check` capable; two consecutive exports must be byte-identical.

## Flutter routing and rendering

`CaseCatalogBundle` will parse current cases and load-only entries separately.
It will expose exact identity resolution without exposing archived entries to
catalogue iteration.

`RustScenarioRepository` starts with the current case definition. On load it
first asks Rust to inspect the complete controlled envelope, then resolves the
returned exact identity and sends that candidate through the existing
`load_session`. It never parses compatibility or command semantics in Dart.
It maps a successful historical snapshot with the retained definition and
overlays, then keeps that presentation definition active for later snapshots.
Reset/new game returns to current content. Failed inspection, resolution, or
Rust validation leaves the live session and navigation unchanged.

The retained English labels come from the archived canonical definition. RU
labels come from its archived RU overlay. GreenFire `0.1.0` has no
`pressure_windows`, so a historical snapshot cannot retroactively expose the
later Pressure projection. Stable fallback behavior remains the same for
fields not localized by the existing overlay.

## Historical resave semantics

Loading the real v1 GreenFire fixture under its archived definition may
produce a runtime-v2 resave under the existing migration contract. The resave
keeps:

- eight fields and schema 1;
- `greenfire_first_72_hours`;
- fingerprint `b585...`;
- the original accepted command sequence unless the player later executes an
  ordinary accepted command.

The new v2 digest is computed from the session still bound to archived
GreenFire `0.1.0`. Reload exact-resolves the archive again. It is never
promoted to future current GreenFire content.

## Malformed and unknown behavior

- Malformed JSON and malformed headers retain existing parser errors.
- Unsupported schema/runtime precedes command interpretation as today.
- An unknown scenario ID returns `UnknownScenario` before any session is
  inserted.
- A known ID with an unknown fingerprint returns `FingerprintMismatch`.
- A routed definition whose recomputed fingerprint does not match is rejected
  by Rust even if application lookup claimed a match.
- An integrity mismatch after replay remains `IntegrityMismatch`.

No current-content fallback is permitted for a failed exact lookup.

## Test plan

### Rust

- pin the archive fingerprint and manifest metadata;
- validate current/load-only uniqueness, conflicts and order independence;
- prove current-only new-session creation;
- prove exact archive resolution for the real GreenFire fixture;
- preserve all v1 migration, replay, outcome, digest and v2 resave assertions;
- prove unknown scenario/fingerprint and wrong candidate failures are atomic;
- use two synthetic same-ID definitions to prove current creation versus old
  exact load and unknown-third-fingerprint failure.

### Bridge and FFI

- inspect the complete envelope before mobile identity resolution while
  preserving schema/runtime/command error precedence;
- prove inspection allocates no session and cannot replace live state;
- route a production-shaped historical load through the existing request;
- prove deterministic snapshot/resave/reload and no Pressure;
- prove malformed/wrong identities do not leak a session;
- retain the command inventory and three-symbol ABI.

### Flutter

- parse bundle v5 with five current cases and one load-only entry;
- prove archive is absent from catalogue/new-game lists;
- prove current GreenFire creation and exact historical load routing;
- prove EN/RU historical rendering and absence of Pressure;
- prove unknown fingerprint UX and live-session atomicity;
- prove resave/reload retains `b585...`.

### Android

Use disposable integration state to load an exact copy of the real historical
GreenFire save, verify archived/no-Pressure state, resave as runtime v2,
dispose/reload it, and then reject an unknown fingerprint without registry
leakage. The protected installed state and Desert Water save remain untouched.

Full Rust/MSRV/format/clippy/test, Dart format, exporter, Flutter analysis/test,
Android API 37, ordinary APK rebuild and three-ABI audits remain required.
Hosted iOS is explicitly not run at this local Windows checkpoint.

## Deterministic drift policy

No production scenario definition changes. All five fingerprints and all 11
canonical outcomes, minutes and digests must remain exact. The historical save
bytes, save schema, runtime profiles, fingerprint/digest algorithms,
catalogue order, C ABI, app version, tag and release remain exact.

Allowed byte drift is limited to the explicit archive/manifest, generic
inventory/routing code, deterministic bundle v5, tests/documentation, and an
APK rebuilt with those bundle/code changes.

Any production fingerprint or canonical digest drift is a stop condition.

## Archive retirement policy

An archived definition is immutable while its save compatibility contract is
supported. It may not be edited in place, repointed, or assigned a different
fingerprint. Retirement requires a separate owner decision that explicitly
ends support for that exact tuple, removes its inventory entry and tests, and
records the user-visible compatibility consequence. No automatic age,
semver, release-count or storage-pressure policy removes retained content.

## Rejected alternatives and exclusions

This design rejects:

- weakening or bypassing scenario ID, fingerprint or digest checks;
- rewriting envelope identity, commands or digest;
- replaying under a nonmatching or newest definition;
- lookup by content version, semver range or scenario ID alone;
- exposing archived content in catalogue/new game;
- a GreenFire-specific loader branch;
- a new save field/schema, runtime marker, mutating or inventory-specific
  bridge command, or ABI symbol;
- network archives, accounts, database migration or remote content services;
- Pressure activation or any production scenario edit;
- app version, release, tag, asset, PR, push, merge, ruleset or branch-cleanup
  work.

## Architecture assessment

The save envelope already contains the exact tuple, and the existing Rust
loader provides strict candidate validation and atomic replay. The complete
mobile trust path additionally requires the read-only Rust inspection step so
compatibility and command errors are classified before Flutter selects that
candidate. The publishing path likewise requires the Rust verifier to bind
every manifest pin to its typed definition before bundle generation. Together
with the explicit immutable inventory, those two checks close the pre-loader
and pre-publication trust boundaries without changing the save schema or C
ABI.
