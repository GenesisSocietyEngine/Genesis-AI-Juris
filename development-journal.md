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

