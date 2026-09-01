# GENESIS: AI Juris — Development Journal

This journal records engineering milestones, decisions, invariants, validation status, and unresolved questions. It is intentionally more technical and chronological than `VISION.md`.

---

## 2026-07-24 — v0.1.0: Deterministic vertical skeleton

### Objective

Prove that one legal matter can be represented as deterministic Rust state rather than as an improvised sequence of AI-generated conversations.

### Delivered

- Rust workspace with domain, simulation, and CLI crates.
- First matter: **The Failed ERP Implementation**.
- Seeded uncertainty and reproducible outcomes.
- Evidence, legal spend, working hours, client trust, ethics, negotiation, settlement, and judgment.
- Initial causal tests for determinism, expert evidence, concealment, and invalid actions.

### Architectural rationale

The simulation must own consequences. AI-generated language may describe or advise, but it must not be the source of truth for evidence, money, deadlines, or outcomes.

### Invariants established

1. Identical seed and decisions produce identical state.
2. Player intentions are typed.
3. Scores remain bounded from 0 to 100.
4. Ethical shortcuts have persistent mechanical consequences.

### Validation

The initial source package was generated in an environment without Rust tooling. Compilation was subsequently validated by the project owner on Windows.

---

## 2026-07-24 — v0.2.0: AI as a governed resource

### Objective

Integrate the in-game AI associate without allowing AI output to become authoritative simulation state.

### Delivered

- Career, Assisted, Hardcore, and Tournament modes.
- Limited AI requests with time and monetary cost.
- AI advice restricted to discovered facts.
- Career-oriented reputation dimensions.
- Stronger evidence-discovery and disclosure state.

### Architectural rationale

The product should not attempt to prohibit external ChatGPT use. Instead, strategy must depend on hidden facts, procedural timing, budgets, ethics, and action sequence. The official in-game assistant becomes a resource with constraints and verification risk.

### Invariants added

1. AI cannot reveal evidence the engine has not marked discovered.
2. AI cannot mutate authoritative state through its adapter interface.
3. Hardcore mode exposes no internal AI actions.
4. AI use consumes simulated professional capacity.

---

## 2026-07-24 — v0.3.1: Event-driven legal workday

### Objective

Move from a linear menu sequence to a world in which events occur while the player works.

### Delivered

- `juris-core`, `juris-domain`, `juris-content`, `juris-ai`, `juris-engine`, and `juris-cli` separation.
- Deterministic event scheduler with FIFO ordering for simultaneous events.
- Simulation clock independent of real wall-clock time.
- Incoming client, partner, and opponent events.
- Data-driven case content embedded from JSON.
- GitHub Actions quality gate: formatting, Clippy, and tests.

### Important correction

A long-running action initially risked leaving already-due messages suspended in the past. The engine was changed to drain all due events after time-consuming actions.

### Validation

- `cargo check --workspace`: passed.
- `cargo clippy --workspace --all-targets -- -D warnings`: passed after the explicit time-method rename.
- `cargo test --workspace`: passed.
- GitHub Actions: passed after Rust formatting and line-ending normalization.
- Full CLI matter completed successfully from intake to judgment.

### Learning from the first playthrough

The event architecture worked, but the legal experience remained too compressed:

- inbox messages could not be answered;
- work could continue for unrealistic periods without fatigue;
- litigation jumped too quickly from decision to judgment;
- AI disappeared from later procedural stages;
- the final outcome was deterministic but insufficiently explained.

These observations define v0.4.0.

---

## 2026-07-25 — v0.4.0: The active legal workday

### Milestone objective

Demonstrate that professional legal work can function as a strategic game loop, not merely as a sequence of case decisions.

### Scope delivered

#### Active inbox

Messages now have stable IDs, semantic kinds, response requirements, and handled state. Client, CFO, partner, junior, expert, opponent, and court messages can create specific actions rather than remaining passive log entries.

#### Professional deadlines

The matter tracks:

- partner risk brief;
- evidence-preservation notice;
- statement-of-claim filing.

Warnings and deadline events are scheduled independently. Missing a deadline changes procedural position, ethics, client trust, peer respect, or judicial credibility according to the deadline type.

#### Work capacity and fatigue

Player actions consume professional time. The engine tracks:

- minutes worked during the current day;
- a nine-hour soft capacity;
- overtime across the matter;
- persistent fatigue;
- partial recovery through deliberate rest.

Fatigue and overtime reduce the quality of selected professional actions. Rest advances the world, so it may cause messages and deadlines to arrive.

#### Delegation

Document review can be performed personally or delegated to a junior associate. Delegation saves player time but creates asynchronous turnaround and requires a separate review before evidence becomes usable.

#### Multi-stage litigation

Litigation now progresses through:

1. pleadings;
2. statement drafting;
3. filing deadline;
4. disclosure;
5. opponent disclosure review;
6. expert-evidence decision;
7. witness preparation;
8. hearing rehearsal;
9. hearing.

#### Stage-specific AI assistance

The official AI associate can support:

- legal research;
- evidence review;
- damages modelling;
- draft review;
- hearing preparation.

The adapter remains read-only. Reliability is resolved by the deterministic engine rather than inferred from prose.

#### Explainable judgment

A judgment stores:

- base position;
- named positive and negative factors;
- final win threshold;
- deterministic roll.

The player can therefore see why a result occurred while uncertainty remains meaningful.

### Ownership and borrowing rationale

- `Engine` owns its AI adapter, scheduler, template, RNG, and matter state. A run has one explicit authority boundary and no global mutable state.
- `Engine::state()` returns `&MatterState`, not `&mut MatterState`. Presentation layers can inspect but cannot bypass action validation.
- AI receives `&MatterState` and returns an owned response. The immutable borrow prevents state mutation; ownership of the response lets the engine retain or discard text safely.
- Content parsing returns an owned `CaseTemplate`, preventing JSON-input lifetimes from leaking into gameplay code.
- Scheduler events own their payloads so delayed work does not borrow temporary UI or content data.

### Determinism considerations

- Simulation time uses integer minutes.
- Outcome calculations use integer arithmetic.
- Simultaneous events are ordered by stable sequence ID.
- All uncertainty comes from one seeded RNG owned by the engine.
- AI prose does not determine mechanical effects.
- Wall-clock time is presentation-only.

### What the v0.4 tests prove

| Test | Property proved |
|---|---|
| scheduler preserves FIFO order | simultaneous events replay in stable order |
| identical RNG seeds | uncertainty is reproducible |
| next workday never rewinds time | rest preserves monotonic time |
| embedded content is operationally complete | case data contains required deadline and turnaround values |
| scripted AI uses authorized context | hidden facts do not leak through the adapter |
| identical seed and actions reproduce world | complete matter state is replayable |
| client reply handles inbox item | inbox is active gameplay, not a passive log |
| long work delivers due events | actions cannot strand events in the past |
| partner deadline miss is penalized | deadline state and reputation consequences are causal |
| delegation is asynchronous | delegated work does not reveal evidence instantly |
| overtime and rest affect fatigue | professional capacity has persistent consequences |
| AI cannot reveal hidden evidence | engine controls factual access |
| Hardcore removes AI actions | mode rules constrain available actions |
| concealment harms ethics and threshold | unethical leverage creates long-term risk |
| judgment records threshold and roll | terminal outcomes are explainable and reproducible |

### Validation status at package creation

The source was prepared in an environment without `cargo`, `rustc`, or `rustfmt`. Static review and consistency checks were performed, but the following commands remain the release gate on the Windows development machine:

```powershell
cargo fmt --all
cargo fmt --all -- --check
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

The release is not considered validated until all five commands and GitHub Actions pass.

### Known limitations

- Only one matter is active; multiple concurrent matters are planned for v0.5.
- The AI adapter is scripted and offline.
- The legal model is a gameplay abstraction, not legal advice.
- Calendar weekends, public holidays, and jurisdiction-specific court calendars are not yet modelled.
- Delegation supports only one junior task at a time.
- Inbox responses are typed choices rather than free-form drafting.
- Persistence and replay-file export are not yet implemented.

### Completion criteria for v0.4.0

- All quality-gate commands pass.
- The player can complete both settlement and litigation paths.
- At least one playthrough demonstrates a missed deadline.
- At least one playthrough demonstrates delegation and report review.
- The final judgment displays named factors, threshold, and deterministic roll.
- Repeating the same seed and actions reproduces the same terminal state.

---

## Next milestone — v0.5.0: Competing matters and career pressure

### Proposed objective

Prove that the core game remains understandable and strategically interesting when the player manages several matters competing for the same day.

### Candidate scope

- two or three simultaneous matters;
- shared calendar and workload;
- priority conflicts;
- partner assignment and performance review;
- delegation queue rather than one task;
- persistent client and colleague relationships;
- save, load, and replay export;
- first career-week summary.

### Open design questions

1. Should time advance continuously across all matters or through a firm-level scheduler?
2. How much information should a partner reveal about performance criteria?
3. Should billing pressure reward hours, efficiency, realization, or a combination?
4. How should free-form player drafting be evaluated without making an LLM authoritative?
5. Which parts of Belgian civil procedure require deeper jurisdictional modelling before public release?


## 2026-07-25 — v0.4.1: Simulation integrity after the first full playthrough

The first complete seed `20260724` run validated the active-workday loop but exposed several rule-integrity weaknesses. The player could sleep through a scheduled hearing, settlement offers never expired or reacted to the record, AI outputs were generic, overnight rest erased every workload consequence, and legal spend did not require client authority.

The patch treats these observations as design evidence rather than isolated defects. Mandatory events now constrain time advancement. Settlement is represented as a time-bounded stateful offer. Acute fatigue and cumulative strain are separated. Client budget approval becomes a mechanical constraint. AI text contains concrete task-specific output, while the deterministic engine still decides whether the advice was reliable.

### Architectural decision

The engine continues to be the only authority that changes state. Offer values, expiries, hearing defaults, budget ceilings, and AI reliability all remain deterministic engine calculations. The AI adapter receives immutable state and returns owned text only.

### Completion criteria for v0.4.1

- A player cannot rest past a hearing.
- Missing a hearing has a terminal adverse consequence.
- Expired settlement offers are unavailable.
- Material case developments can produce revised offers.
- AI output gives the player usable information and exposes reliability.
- Repeated overtime leaves persistent strain after sleep.
- Expensive actions respect client-approved budget authority.

## 2026-07-25 — v0.4.2: Release hygiene and enforceable MSRV

The v0.4.1 local quality gate exposed two non-gameplay defects: a test-only `ActorId` import was absent, and `juris-engine` used `Option::is_none_or`, which is newer than the workspace's declared Rust 1.78 minimum.

The correction keeps production behavior unchanged. The test imports `ActorId` explicitly, and hearing-rest eligibility uses a documented `match` expression compatible with Rust 1.78. A separate CI job now invokes `cargo +1.78.0` against the locked workspace so the MSRV is tested rather than merely stated in `Cargo.toml` or overridden by the repository toolchain file.

### What this patch proves

- `cargo check` alone is insufficient because it does not compile all test targets.
- `cargo clippy --all-targets -- -D warnings` is a valuable release gate.
- An MSRV declaration should be backed by CI on that exact compiler.
- Release patches should avoid changing deterministic gameplay when correcting build hygiene.


## 2026-07-25 — v0.5.0: The simulation acquires a mobile product surface

The terminal prototype had already proven deterministic state transitions, legal workflow, active time, professional pressure, and explainable outcomes. Continuing to add mechanics only through numbered CLI menus would optimize the design for a development harness rather than for the intended player experience. v0.5.0 therefore shifts the next validation target from simulation depth to interaction architecture.

### Product decision

GENESIS: AI Juris is smartphone-first. The player should experience legal work through a persistent professional shell: Inbox, Matter, Calendar, AI Associate, and Career. Material information must be readable in short sessions without hiding strategic depth.

### Architectural decision

Flutter receives immutable presentation snapshots and submits action identifiers. It must not mutate authoritative legal state. In v0.5.0 a deliberately small `DemoGameRepository` makes the shell interactive, but comments, naming, and tests state explicitly that this repository is disposable. v0.5.1 will replace its transitions with a generated Rust bridge.

This temporary duplication is acceptable only because:

1. it covers a tiny intake/investigation demonstration;
2. it is isolated under the mobile application;
3. it does not change or call the Rust engine;
4. it exists to validate navigation, information density, confirmations, and visual hierarchy;
5. the migration target is already defined as an immutable snapshot/action API.

### Mobile information architecture

- **Inbox** prioritizes action-required communication over narrative history.
- **Matter** shows strength, evidence, budget, workload, ethics, trust, and settlement state.
- **Calendar** makes deadlines and professional capacity visible.
- **AI Associate** explains both work product and authority limits.
- **Career** connects current conduct to long-term identity and hosts the product brand.

The shell uses a Material 3 bottom navigation bar on phones and a navigation rail on wider windows. This supports Android phones now and keeps tablet/desktop previews coherent without platform-specific business logic.

### Android scaffolding decision

The release archive does not commit hand-authored Gradle templates. Android project files are generated by the developer's installed Flutter SDK through `bootstrap_flutter_windows.ps1`. This avoids freezing stale Android Gradle Plugin and Kotlin template versions inside an environment that cannot execute Flutter itself. Once generated and successfully built on the development machine, the Android directory should be committed, excluding machine-local properties.

### What the widget tests prove

| Test | Property proved |
|---|---|
| shell opens on actionable inbox | deterministic mobile boot exposes the first professional decision |
| conflict check advances snapshot | action IDs flow through the UI and rebuild from immutable state |
| navigation opens matter dashboard | core game information is reachable through the phone navigation model |

### Completion criteria for v0.5.0

- Flutter analysis passes.
- Widget tests pass.
- Android scaffolding is generated by the installed Flutter SDK.
- The shell runs on an emulator or physical Android device.
- A debug APK is created under `dist/`.
- Rust quality gates remain green after the version bump and boundary-test corrections.

### Next milestone

v0.5.1 will create the first engine-backed APK. The critical work is not visual polish but the FFI authority boundary: start game, obtain snapshot, submit available action, receive next snapshot, save deterministic state, and surface typed errors without allowing Dart to become authoritative.

## 2026-07-26 — v0.5.0 mobile interaction patch

The first emulator playtest showed that a global Actions button was not enough for Inbox-driven gameplay. Message cards now open contextual detail sheets, and settlement offers expose explicit Yes/No responses. Generic action confirmations also use `No` and `Yes` instead of the ambiguous `Cancel` / `Execute action` pairing. The demo repository implements acceptance and rejection only to validate the interaction; the Rust bridge remains the future authority for real consequences.

## 2026-09-01 — v62 report-manifest and mobile parity foundation

The authorized v62 milestone was opened from the exact closed v61 baselines: web `8bd10594bc01e5a45183a743396ac24b7aeaf321`, mobile `main` `29f862649dea378cfe3d4e145f5e396bf6d4c6ff`, and live Site version 63 with product marker `v61`. The production deployment was not changed. Site version 63 remains the rollback target.

### Decision

Layout versioning is recorded separately from professional-matter semantics. The new immutable report manifest binds:

- `ReportModel` schema 1;
- the v61 report-profile registry schema 1 and semantic renderer `1.0.0`;
- layout schema 1, layout algorithm `1.1.0`, and layout renderer `2.1.0`;
- layout scope `presentation_only`;
- every output declared by the nine case playbooks exactly once.

The manifest does not add pagination fields to the canonical case or `ReportModel`. It does not reinterpret `tax_compliance`, change routes, or make layout artifacts into rules, case nodes, evidence, decisions, or runtime transitions. Rust remains authoritative.

### Implementation

- Added `report-manifest.v1.json` to the web application and byte-equivalent copies to mobile contracts and Flutter assets.
- Copied the unchanged v61 `report-profiles.v1.json` into mobile contracts and Flutter assets.
- Added the Dart `ReportContract`, `ReportProfileRegistry`, and `ReportManifest` models plus `loadReportContract`.
- Validation rejects unknown IDs, unknown schema or renderer versions, duplicate profiles or output bindings, invalid case/profile bindings, primary-output drift, and incomplete playbook coverage.
- Added focused web and Flutter tests for nine-package, 19-profile, and 22-output parity plus malformed-input rejection.
- The existing `assets/case_types/` directory declaration already includes both new Flutter assets, so `pubspec.yaml` did not require a narrower duplicate declaration.

Canonical Git-filtered object IDs match across the web and mobile repositories:

- report profiles: `686c59b8463af05890c93ca198adfeeb15c4f29c`;
- report manifest: `209f5b596e0a29bc12281b84cfa024d1d233e369`.

Within mobile, the contract and asset raw bytes are identical:

- report profiles SHA-256: `c022dc2cc6710ba41441d00d816eb9a48f90b3e4b7c4cca281a5c7bd4c131d22`;
- report manifest SHA-256: `ca99dfb2cf5de55c465b8667d978c276c8e46b0f110a2c9e4cca0c03f158ccd9`.

### Verification evidence

- `dart format lib/models/report_contract.dart test/report_contract_test.dart`: completed.
- `flutter test test/report_contract_test.dart`: 5 tests passed.
- `flutter analyze`: no issues found. A temporary `R:` drive mapping was used and removed to avoid the deeply nested Windows worktree path exceeding Flutter iOS-package enumeration limits.
- Focused TypeScript no-emit check for `tests/v62-report-manifest.test.ts`: passed.
- `node --import tsx --test tests/v62-report-manifest.test.ts`: 2 tests passed through VS Code's bundled Node-compatible runtime, with synchronous exit code 0. The host does not expose a standalone `node` command on `PATH`.

### Scope and release state

This entry establishes parity contracts only. It does not claim Flutter PDF generation, layout-fixture parity, Bhopal PDF acceptance, full Flutter regression coverage, Android or iOS packaging, a reviewed exact-head merge, or a public v62 deployment.

Before release, v62 still requires receipts and staleness integration, structural/extraction/visual PDF gates, all legacy goldens and stress families, strict web gates, dependency and security audit, Rust and native Android/iOS gates, all 18 routes, exact-head review and merge, production anonymous PDF and authenticated save verification, stale-chunk recovery, and clean observability. Explicit approval is required immediately before the sole final public deployment. No app-store distribution is authorized.

## 2026-09-01 — v62 Flutter deterministic layout parity

The mobile presentation layer now evaluates the same finalized `ReportGraphLayoutModel` contract as the web application. This is deliberately not a Flutter PDF implementation and not a second legal rules engine. It consumes immutable presentation input, performs deterministic geometry and document-flow work, and preserves the canonical case and `ReportModel` content fingerprint unchanged.

### Implementation decision

The evaluator uses integer micrometres for all paper, frame, box, anchor, line-height, and measured-width values. Roboto advances come from the exact web-generated metrics artifact and use the same integer ceiling formula. Text is iterated by Unicode scalar, long tokens break only at the contract's cluster-safe boundaries, node titles are never ellipsized, and visually abbreviated detail points to the complete node register.

Weak components are seeded in ASCII ID order. Kahn processing records longest-parent layers; a cycle promotes the smallest remaining node and records every ignored incoming edge. Each topology layer is split into no more than three portrait lanes and packed atomically between pages. Same-page relationships use deterministic node-border anchors. Cross-page relationships receive edge-order `C001`, `C002`, … pairs with explicit `:OUT` and `:IN` endpoints and the matching adjacency record.

The output is recursively immutable and includes every node record, every adjacency row, every connector row, and a root/terminal/disconnected/cyclic-repair summary. Canonical serialization mirrors the web key collation and binds the presentation-only layout fingerprint.

### Locked artifacts and parity evidence

- Font metrics SHA-256: `dce864593f4230771a0466e73eec1f7f2cf3a1024bcc83580975d4e1fefe7dda`.
- Layout fixtures SHA-256: `7f71a976872aa7266a7c360529430b9bdc6c2978368917bc0d61c0e3a33e249f`.
- Report manifest SHA-256: `261ff3984e2e73a52f1bf672f94a7e6b0312c1f5d5a228b5e372ec5c885de5f3`.
- Exact fixture families: Bhopal EN with fan-in/fan-out, 26-node deep, wide, disconnected, cyclic repair, long-title/detail Russian Unicode, and 200-node stress.
- Every fixture matches the web node-to-page projection, compact connector projection, and full layout SHA-256 fingerprint.
- Reversing node and edge input order produces the identical canonical serialization and fingerprint.
- Recursive result collections reject mutation.

### Verification receipts

- `dart format` on all five layout sources and `report_graph_layout_test.dart`: completed.
- Focused Dart analysis: no issues.
- `flutter pub get` from a temporary repository-root `R:` mapping: succeeded; the mapping was removed.
- `flutter analyze --no-pub`: no issues found.
- `flutter test test/report_contract_test.dart test/report_graph_layout_test.dart`: 13 tests passed.
- `flutter test --no-pub`: 256 tests passed.

`crypto` moved from a development-only dependency to the runtime dependency set because production layout evaluation computes SHA-256 fingerprints. The lock version did not change; only its dependency classification changed. The automatic pub step on the deeply nested Windows worktree exposed a generated iOS Swift-package enumeration failure. Pub resolution and the 13 focused report tests then passed from a temporary repository-root mapping, which was removed; the long-path analysis and complete 256-test suite used the already-resolved lock with `--no-pub`. No Rust source, engine semantics, case content, route, report semantic renderer, Android package, iOS package, production Site, or app-store state changed.

The remaining release work is web PDF structure/extraction/visual validation, receipt and stale-render integration, complete web/Rust/native gates, reviewed exact-head merge, final release binding, and the explicitly approved single public deployment.

## 2026-09-01 — governed 1.1 renderer and release-probe correction

The synchronized web assets advanced the presentation-only layout algorithm to
`1.1.0` and renderer to `2.1.0`; relabeling the old mobile approximation was
rejected. The Dart evaluator now parses and validates the exact 2048-UPM Roboto
face contract, cmap, positive shaping allowances, ink overhangs, unsafe shaping
pairs, stacked GDEF marks, and grapheme-break receipt. Connector cells divide
the printable width exactly and use up to seven separated route lanes per side.
Endpoint IDs and mandatory gutter seams remain in the fingerprinted model.

The pure-Dart probe accepts the exact release-script `--manifest`,
`--font-metrics`, and `--fixtures` arguments, proves manifest byte equality,
and reproduced every locked fingerprint. The max fixture exercises 200 nodes
and 187 cross-page connector pairs. Full Flutter analysis is clean, focused
contract/layout tests pass 13/13, and the complete suite passes 256/256. The
temporary short Windows drive mapping used for the 283-character generated iOS
path was removed after each command. No Rust, deployment, or app-store state
changed.

## 2026-09-01 - Adversarial parity regression gate

Two additional fail-closed probes now reject exact font-face byte drift and
malformed Unicode or unsafe shaping inputs. The focused report contract/layout
suite passes 15/15, the complete Flutter suite passes 258/258, and full Flutter
analysis remains clean. The temporary short drive mapping was removed after the
run; no Rust, deployment, or app-store state changed.

## 2026-09-01 - Final local mobile and native acceptance

The complete candidate was rechecked after the web dossier migration chain was
frozen. `dart format --output=none --set-exit-if-changed` checked 113 files with
zero changes; `flutter analyze` reported no issues; and `flutter test` passed
258/258. `cargo fmt --all -- --check`, locked workspace Clippy with `-D warnings`,
and the complete locked Rust workspace tests all passed.

The configured Pixel emulator was started headlessly because no Android device
was initially connected. The native persistence integration then passed all 12
scenarios, including save/load integrity, historical content retention,
corruption atomicity, GreenFire pressure, Failed ERP, Desert Water visibility,
and terminal debrief restoration. The short `M:` mapping was removed after the
run. No mobile package was distributed and no app-store action was taken.
