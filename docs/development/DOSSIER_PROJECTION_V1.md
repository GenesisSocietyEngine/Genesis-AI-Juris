# Dossier Projection v1

## Status and boundary

This document is the implementation contract for the local Dossier Projection
v1 checkpoint. Its exact base is
`7b9c5e1fd9866b19484deec391c8cf9fe6b4de43`, the merge commit that includes the
Matter Lifecycle runtime-v2 compatibility remediation. The implementation
branch is `feat/dossier-projection-v1`.

The dossier is a deterministic, read-only player projection derived by Rust
from the current authoritative `ScenarioSession`. It answers only what the
runtime can currently prove about:

- the current procedure and scenario time;
- known facts;
- available evidence;
- active deadlines and currently executable remedies;
- the latest judicial decision and its Rust-owned instance;
- whether the matter is open, recoverable, or closed.

The dossier is not a second state machine. It cannot be edited independently,
does not accept commands, and is never replayed as an input. Flutter renders
the projection but does not reconstruct legal meaning from stage IDs, outcome
IDs, localized text, or case-specific rules.

This contract records required behavior and validation evidence to collect. It
does not, by itself, claim that an unrun gate or Android path has passed.

The later local Failed ERP Rust migration supplies the first production
position-1 Dossier using exactly eight facts and five evidence items from the
characterized legacy story. Unknown entities are absent, reveal is additive,
save/load re-derives the same sorted projection, and EN/RU preserve stable
identity. Scenario-specific inventory and Android evidence are recorded in
`FAILED_ERP_RUST_MIGRATION_V1.md`; the projection architecture remains generic.

## Authority and additive snapshot contract

Rust derives the dossier during normal snapshot creation from the validated
scenario definition and current runtime state. The existing mobile JSON bridge
must carry it as one additive nested `dossier` member of the version-1 mobile
snapshot. No parallel bridge request, mutable repository, Dart-authored case
model, or case-specific projection rule is permitted.

The nested projection has four player-facing sections:

1. **Procedure** — stable stage ID and title, authoritative scenario minute,
   derived lifecycle, dossier matter status, closure flag, latest judicial
   result and decision instance, and a resolved outcome only after closure.
2. **Facts** — facts whose authoritative status is no longer `unknown`.
3. **Evidence** — evidence currently present in the runtime's available-
   evidence set, including only links to facts that are present in the same
   dossier.
4. **Deadlines and remedies** — activated deadlines and the subset of their
   completion actions that is currently executable.

Stable IDs remain transport and test identities. Titles, statements,
descriptions, kinds, status labels, and summaries are presentation data and
must never be used to dispatch an action or infer authoritative state.

The projection is computed afresh after session creation, every accepted
command, and successful load. It must contain no cached mutable dossier state.

## Dossier matter status

`open`, `recoverable`, and `closed` are Rust-owned projection values. Their
precedence and meaning are:

1. `closed` when authoritative `is_closed` is true. A closed matter remains
   closed regardless of its latest judicial result or any historical deadline.
2. `recoverable` when the matter is not closed, its latest result is `lost`,
   `dismissed`, or `partially_won`, and at least one projected open deadline
   exposes at least one currently available remedy action.
3. `open` for every other non-closed state, including a matter with no judicial
   result, a win that proceeds to enforcement, and an adverse result for which
   no remedy is currently executable.

This projection status does not replace `MatterLifecycleStatus`. Procedure may
therefore be, for example, both lifecycle `post_judgment` and dossier status
`recoverable`. Loss does not imply closure, and a remedy is not advertised
merely because an action ID is named in a scenario definition.

Flutter must map this value directly. Unknown future values map to an explicit
presentation-safe unknown state; they must not be guessed from other fields.

## Visibility and disclosure rules

The dossier is safe only when information not yet disclosed to the player is
absent from the nested payload. It must not emit placeholders, redacted rows,
counts, IDs, or relationship edges that reveal the existence of hidden data.

Rust applies these filters before serialization:

- a fact with status `unknown` is omitted completely; all other fact statuses
  are eligible;
- unavailable evidence is omitted completely, including its ID, title,
  description, kind, and fact links;
- `supports_facts` and `contradicts_facts` are intersected with the stable fact
  IDs already present in the dossier, so an available item cannot disclose an
  unknown fact through a relationship;
- a deadline whose runtime status is inactive (`null`) is omitted completely;
- an open deadline exposes remedies only from the intersection of its authored
  `completion_actions` and the snapshot's currently available actions;
- completed and missed deadlines remain procedural history but expose no
  executable remedies;
- an outcome is omitted until Rust reports explicit closure and a resolved
  outcome;
- private flags, action effects and conditions, async-task internals, unfired
  events, future triggers and countermoves, hidden outcome selection, scoring,
  validator diagnostics, and simulator internals never enter the dossier.

The implementation must not invent chronology. Current state and authoritative
scenario time may be shown, but the projection cannot manufacture dated
entries from fact, evidence, deadline, event, or action definitions that do not
record such history.

## Deterministic ordering

Every collection has a canonical order independent of locale, map iteration,
and presentation rebuilds:

- facts: ascending stable fact ID;
- evidence: ascending stable evidence ID;
- each evidence item's supporting and contradicting fact links: ascending
  stable fact ID, without duplicates;
- deadlines: ascending `due_at_minutes`, then ascending stable deadline ID;
- remedies within a deadline: ascending stable action ID.

The same definition, seed, and accepted command log must produce an equal
dossier before and after save/load. Repeated loads must not duplicate facts,
evidence, deadlines, relationships, or remedies. Switching EN/RU may replace
display strings only; stable IDs, order, statuses, judicial state, lifecycle,
and matter status must remain equal.

## Flutter mapping and presentation

The Flutter mapper consumes only the nested Rust dossier for the Dossier UI.
It must not derive visibility, remedy availability, lifecycle, closure,
judicial result, decision instance, or dossier matter status from legacy
top-level arrays or localized copy.

Scenario localization overlays may replace dossier display strings by stable
section and entity ID. EN and RU must therefore present the same entities in
the same order and state. If a translation or optional display field is absent,
the mapper uses the safe Rust display value or omits the optional text; it does
not drop the entity, change its status, or fail the whole active session.
Malformed or absent optional dossier data must fail presentation safely and
must not mutate the repository session.

The active Matter screen provides the dossier entry point. The dossier view is
scrollable on small screens and presents Procedure, Facts, Evidence, and
Deadlines and remedies as distinct sections. Text or iconography accompanies
every status, so color is never the sole carrier of meaning. A remedy control
uses the authoritative stable action ID and returns to the existing action
flow; it does not dispatch an effect locally. Lost-but-open and explicitly
closed states must be distinguishable in both languages.

## Persistence compatibility

Dossier Projection v1 makes no persistence change:

- save schema ID remains `genesis.ai-juris.command-log`;
- envelope `schema_version` remains `1`;
- the envelope remains exactly eight fields;
- new saves retain `runtime_compatibility: scenario-runtime-v2`;
- persisted command-log entries remain only `dispatch` and `advance_time`;
- the dossier is not serialized in the envelope;
- the v2 final-state digest projection is byte-for-byte unchanged;
- the v1 migration and controlled-rejection policy remains unchanged;
- load continues to replace the active Rust and Flutter session only after all
  parsing, compatibility, fingerprint, replay, and digest checks succeed.

Because the dossier is derived after replay and does not participate in the
digest, an invalid or unsupported save cannot partially replace the displayed
dossier. A successful load must derive the same projection from the restored
authoritative state. If implementation would require new authoritative state,
a changed digest, or a ninth envelope field, this checkpoint must stop for an
explicit compatibility decision.

Scenario Definition v1, production case files, mobile catalogue records,
balance, authored actions, deadlines, outcomes, fingerprints, and deterministic
production traces remain unchanged. A focused debug/test fixture may exercise
disclosure and remedies but must not appear in the production catalogue.

## Legacy top-level snapshot privacy limitation

The pre-existing version-1 mobile snapshot includes top-level `facts`,
`evidence`, `deadlines`, `flags`, and `fired_event_ids`. Some of those legacy
collections enumerate definition-backed entities even when their current state
is unknown, unavailable, or inactive. Dossier Projection v1 does not silently
remove or redefine those established fields because their compatibility impact
has not yet been audited.

Accordingly, only the nested `dossier` subtree has the disclosure-safe contract
defined above. The Dossier UI must not fall back to legacy top-level fields.
Hardening or versioning the broader snapshot is a future, explicit compatibility
decision with its own consumer audit and migration plan. This limitation does
not permit hidden data to leak through the new dossier projection.

## C ABI and bridge compatibility

C ABI version remains `1`, with exactly these native exports:

- `juris_mobile_bridge_execute`;
- `juris_mobile_bridge_string_free`;
- `juris_mobile_bridge_abi_version`.

The dossier travels only as additive JSON in the existing execute response. No
new C symbol, function parameter, callback, platform channel, or native state
store is introduced. Android and hosted iOS export audits must verify the same
three-symbol set after implementation.

## Required verification

Before local checkpoint acceptance, focused automated coverage must prove:

- canonical ordering and equality for identical seed and command log;
- initial omission of every hidden fact/evidence ID, text, and relationship;
- an authoritative action reveals the expected fact and evidence exactly once;
- available evidence cannot link to a fact still omitted from the dossier;
- inactive deadlines are absent, active deadlines appear, and completion or
  expiry changes the status deterministically;
- remedy lists are the exact intersection with currently available actions;
- an adverse open matter is recoverable while explicit closure is closed;
- the decision instance is supplied by Rust and Flutter performs no inference;
- save/load restores an equal dossier and repeated loads add no duplicates;
- failed, corrupted, or incompatible loads preserve the existing active
  session and dossier;
- locale changes alter display strings only;
- bridge and FFI responses add the dossier without changing protocol commands
  or exported symbols;
- Logistics, GreenFire, and GoldenShell fingerprints, deterministic traces,
  balance, and v2 save digests are unchanged.

The complete local gate remains:

- Rust formatting, workspace check, Clippy with warnings denied, and all tests;
- Rust 1.78 MSRV workspace check;
- authoring diagnostics and deterministic scenario traces;
- deterministic mobile-bundle check;
- Flutter formatting, analysis, and all unit/widget/integration tests available
  on the host;
- Android debug APK build and native ABI audit;
- `git diff --check` and complete base-to-HEAD review.

## Android acceptance path

Android acceptance uses a debug-only dossier fixture and a recorded emulator/API
level. It must demonstrate this exact authority path:

1. create the matter and open Dossier from Matter;
2. prove the fixture's hidden fact and evidence IDs/text are absent;
3. dispatch the fixture's reveal action through the native bridge;
4. reopen Dossier and observe the newly known fact and available evidence;
5. reach an adverse judgment and observe the active deadline, executable remedy,
   Rust-owned decision instance, and `recoverable` status;
6. save, reset, and load, then compare the restored dossier exactly;
7. complete or expire the deadline and observe the authoritative status change;
8. reach explicit closure and observe `closed`, with dispatch and time advance
   still rejected by the existing lifecycle boundary.

The review handoff must name the fixture, seed, stable action IDs, authoritative
minutes, revealed fact/evidence IDs, deadline/remedy IDs, emulator and API
level, and screenshot paths or equivalent captured evidence. Screenshots are
presentation evidence, not substitutes for Rust, bridge, mapper, persistence,
or integration assertions.

## Local verification record

The local checkpoint was implemented from exact base
`7b9c5e1fd9866b19484deec391c8cf9fe6b4de43` on
`feat/dossier-projection-v1`. Its isolated implementation commits are:

- `9a32f32effaf67b4e94aecf1236c21e245a2d971` —
  `feat(runtime): add authoritative dossier projection`;
- `61c74f2c7f95e4e542fc3d0ecc183633105de13a` —
  `feat(mobile): present authoritative dossier projection`.

No commit from this checkpoint has been pushed. No PR, tag, release, signing,
Dossier follow-on phase, or production content/balance change was created.

Rust verification completed successfully:

- `cargo +1.78.0 check --workspace --locked`;
- `cargo fmt --all -- --check`;
- `cargo check --workspace`;
- `cargo clippy --workspace --all-targets -- -D warnings`;
- `cargo test --workspace`: 217 passed, 0 failed;
- engine: 63 passed (14 unit + 6 dossier + 23 persistence + 20 runtime);
- bridge: 11 passed;
- FFI: 9 passed;
- authoring diagnostics passed for Logistics, GreenFire, GoldenShell, the
  adverse lifecycle fixture, and the test-only dossier fixture.

Flutter and Android verification completed successfully:

- Dart format: 46 files checked, 0 changed;
- deterministic mobile bundle export: current;
- `flutter analyze`: no issues;
- `flutter test`: 113 passed, 0 failed;
- focused updated Android Dossier path: 1 passed, 0 failed;
- final complete native Android suite: 5 passed, 0 failed;
- ordinary debug APK: 192,458,673 bytes, SHA-256
  `9d402919ca9232ba255edafadbdce5c129bf4d31dc13bf93e49f34d8e5aedbdc`;
- emulator: `emulator-5554`, model `sdk_gphone64_x86_64`, Android 17 / API
  37, 1080x1920.

The Android Dossier test is equivalent captured acceptance evidence. It uses
debug-only case `integration_adverse_judgment_with_remedies`, which the catalog
test proves is absent from the production case library and mobile bundle. The
asserted authority path is:

1. minute 0: only fact `claim_was_filed` and evidence
   `client_instruction_letter` are present; both hidden sentinel texts and IDs
   are absent from Dossier;
2. action `review_dossier_materials` reaches minute 10 and reveals fact
   `registry_record_confirms_service` and evidence
   `court_registry_extract` exactly once;
3. `request_judgment` plus `adverse_trial_judgment` reach minute 70 (09:10),
   result `lost`, decision instance `first_instance`, lifecycle
   `post_judgment`, dossier status `recoverable`, open deadline
   `appeal_deadline`, and remedy `file_appeal`;
4. save/reset/load restores an exactly equal dossier; two real native
   incompatible-v1 failures preserve the same Rust session, mapped snapshot,
   and dossier;
5. `file_appeal` reaches minute 130 (10:10), lifecycle `appeal`, completes
   `appeal_deadline`, and removes its remedies; a second save/reset/load
   restores that exact completed projection;
6. `abandon_appeal` reaches minute 135 (10:15), explicit lifecycle closure,
   dossier status `closed`, and outcome `final_loss`;
7. subsequent dispatch and one-minute time advance are both rejected as
   `scenario_resolved` and the closed dossier remains equal.

Production identities remain exact:

| Scenario | Fingerprint |
|---|---|
| Logistics | `1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8` |
| GreenFire | `b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261` |
| GoldenShell | `7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4` |
| adverse lifecycle fixture | `c0a4ed252b357942a68f4d7632aaf699079564b9a21ce692be8e136fc46db162` |

Production simulator traces remain exact:

- GreenFire protected: `protected_crisis_position`, minute 4440, 26
  transitions;
- GreenFire compromised: `compromised_crisis_position`, minute 4590, 21
  transitions;
- GoldenShell coordinated: `coordinated_claim_position`, minute 4545, 29
  transitions;
- GoldenShell fragmented: `fragmented_claim_position`, minute 4710, 23
  transitions.

The existing runtime-v2 final-state digest projection is unchanged. Rechecked
reference digests include:

| State | Digest |
|---|---|
| Logistics initial, seed 20260725 | `04ab300cd55c8e09f7a23d772702dd39bbfd6868e1c2d2fbfbf489ef8acf4fcb` |
| Logistics before judgment | `74c7fc78d76985f62865af33d9490d9ab6755f7c32ba8a8ccf437edb7c465702` |
| Logistics winning/open | `a676b7758bee2f6a4a88ecbe77671db67f8dd8b16f1d41c806a3ad9737590cc8` |
| Logistics negotiated/closed | `139239e001417ae563e270128864a512e88c0ff535a498e15b000731b8ca5bfe` |
| Logistics enforced/closed | `e25e1eeb36249c1b7da0fe7a947f29ed3363ce7dac0357a110951c49bb738ac3` |
| GreenFire initial | `9ec5686ed2a8bd048c1ff7b1842d634ab6f9f5451bccc7d6b22f8de38d352bf5` |
| GreenFire protected | `17f58f95551abacb445ce6d886fc059bcbd7a7660c3f089d9509e7a25f01a216` |
| GreenFire compromised | `432a3ca4688f2d452a96326872e2058d9a1b2109c4b5f3be24b6b9666cc428ec` |
| GoldenShell initial | `94c676e397e19e6f3d4e112c0a6c44a508250fb2f6f8f44b95b9a5827fe55aa6` |
| GoldenShell coordinated | `72986eeb4a3a690b775ea86c6ac5c9da02027ef5a0ca03292736b5e805f8c53b` |
| GoldenShell fragmented | `846c96ed8ba240bb392daead67e03bd4b9a7cbe1b23bdd6d412314e582c13503` |
| lifecycle lost/open | `5aeab7f3c80b9e3b773a7cfe49f1e2cf9e6e1103d9bcdb669f95afdcd08bfab8` |
| lifecycle appeal success | `82d8fbab3ab20b98693f32504b2f3be8ca5b510f6e6ef6514ff3df83bdea74ce` |
| lifecycle remedies exhausted | `d9b10c3087ec048d91d8f0049844ed64b067535360b1ff9d030dac97353413ae` |
| lifecycle explicit closure | `d477fe5a632d5ab2c7355511aacd253e21e48e4a27b37f8d61a190b8f47dda66` |

The generated mobile bundle remains byte-identical with SHA-256
`8d9db2e75c5cac14df95073843cc5a0775df8d17323fb434c688a8854a012835`.
No production case, catalog, localization, balance, action, deadline, outcome,
or trace file changed from the stated base.

C ABI version is `1`. Fresh `armeabi-v7a`, `arm64-v8a`, and `x86_64`
libraries each define exactly:

- `juris_mobile_bridge_execute`;
- `juris_mobile_bridge_string_free`;
- `juris_mobile_bridge_abi_version`.

No fourth Dossier export exists. PR #11's hosted iOS run passed the same
three-symbol static-library audit and native lifecycle on its exact remediation
head. The local Dossier branch itself has no hosted iOS result because it has
not been published; local iOS execution is unavailable on Windows and remains
a required remote publication gate.

`git diff --check` passed. The base-to-implementation diff changes only the
runtime projection, bridge/FFI tests, the test-only fixture, Flutter
models/mapper/UI/tests, Android acceptance harness, and development documents.
Persistence implementation and production content paths are clean.

## Explicit exclusions

Dossier Projection v1 does not introduce:

- Legal Theory or player-authored pleadings;
- Pressure & Countermove Runtime or disclosure of future countermoves;
- a mutable `DossierDefinition`, dossier repository, dossier command, or
  serialized dossier state;
- inferred or invented chronology;
- production scenario expansion, catalogue changes, or balance work;
- branding redesign, release signing, tag, release, push, or pull request.

Any of those requires a separately authorized checkpoint after this local
implementation and review are complete.
