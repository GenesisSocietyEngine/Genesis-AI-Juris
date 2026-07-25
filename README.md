# GENESIS: AI Juris v0.4.0

A deterministic, AI-native legal-career simulation prototype written in Rust.

v0.4.0 turns the first ERP dispute into an active professional workday. The player must manage messages, deadlines, workload, delegation, evidence, settlement, litigation, ethics, and fatigue while the world continues to advance.

## Current vertical slice

**Matter:** The Failed ERP Implementation  
**Jurisdiction:** Belgium  
**Practice area:** Commercial disputes

The player can now:

- triage and answer an active inbox;
- meet or miss professional deadlines;
- work beyond daily capacity and accumulate fatigue;
- rest while the world and deadlines continue;
- review documents personally or delegate to a junior;
- commission and review an independent expert report;
- use a limited in-game AI associate at several procedural stages;
- negotiate settlement;
- progress through pleadings, disclosure, expert evidence, hearing preparation, and hearing;
- receive an explainable deterministic judgment.

## Documentation

- [`VISION.md`](VISION.md) — product vision, philosophy, principles, and long-term direction.
- [`development-journal.md`](development-journal.md) — engineering milestones, rationale, invariants, validation, and open questions.
- [`ROADMAP.md`](ROADMAP.md) — concise release-oriented roadmap.
- [`RELEASE_NOTES_v0.4.0.md`](RELEASE_NOTES_v0.4.0.md) — changes in this release.
- [`UPGRADE_FROM_v0.3.1.md`](UPGRADE_FROM_v0.3.1.md) — safe upgrade and Git instructions.

## Workspace architecture

```text
juris-core       deterministic time, seeded RNG, FIFO scheduler
juris-domain     legal and professional state, events, actions, outcomes
juris-content    typed JSON scenario loading
juris-ai         read-only AI actor boundary and offline scripted adapter
juris-engine     authoritative simulation state transitions
juris-cli        terminal input and presentation
```

### Authority rule

Only `juris-engine` mutates `MatterState`.

- The CLI submits `PlayerAction` values.
- The AI adapter receives an immutable state reference.
- JSON content provides configuration, not executable rules.
- Outcomes are calculated by deterministic Rust code.

## Run the game

From the repository root:

```powershell
cargo run -p juris-cli -- start-day --mode assisted --seed 20260724
```

Other modes:

```powershell
cargo run -p juris-cli -- start-day --mode career --seed 20260724
cargo run -p juris-cli -- start-day --mode hardcore --seed 20260724
cargo run -p juris-cli -- start-day --mode tournament --seed 20260724
```

Using the same seed and the same ordered choices should reproduce the same world and judgment.

## Mandatory quality gate

Run before every commit:

```powershell
cargo fmt --all
cargo fmt --all -- --check
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

The repository includes a GitHub Actions workflow that runs formatting, Clippy, and all tests on every push and pull request.

## Code-comment standard

Public crates and APIs explain:

- architectural purpose;
- authority boundaries;
- ownership and borrowing rationale where material;
- determinism constraints;
- non-obvious business rules.

Tests include a short statement of the behavior or invariant they prove. Comments should explain intent and constraints rather than paraphrasing obvious syntax.

## Status

This is a vertical prototype, not legal advice and not a validated model of every Belgian procedural rule. It exists to prove the game architecture and core professional loop before jurisdictional depth and content scale are expanded.
