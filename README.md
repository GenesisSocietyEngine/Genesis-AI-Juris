# GENESIS: AI Juris v0.3.1

The first event-driven vertical slice of an AI-native legal career simulator.

## What changed from v0.2

- deterministic scheduler and typed world events;
- a living legal workday with inbox messages, client pressure, partner review, offers, and a hearing;
- AI actors behind a strict trait boundary;
- case content stored as JSON rather than hard-coded prose;
- six focused crates with one-way dependencies;
- explicit career, assisted, hardcore, and tournament rules;
- reproducibility and anti-cheating tests.

## Run

```powershell
cargo fmt --all
cargo check --workspace
cargo test --workspace
cargo run -p juris-cli -- start-day --mode assisted --seed 20260724
```

## Architecture

```text
juris-core       deterministic time, RNG, scheduler
juris-domain     serializable legal state and typed actions/events
juris-content    JSON case loading
juris-ai         AI actor interfaces and offline scripted adapter
juris-engine     the only crate allowed to mutate simulation state
juris-cli        presentation and input only
```

The engine, not the LLM, remains the authority for costs, evidence, deadlines,
reputation, ethics, settlement value, and outcomes.


## First-time Git bootstrap

```powershell
git init
git branch -M main
git add .
git status
git commit -m "Initial event-driven prototype v0.3.1"
```

Create an empty private GitHub repository named `genesis-ai-juris`, then run:

```powershell
git remote add origin https://github.com/YOUR-USER-NAME/genesis-ai-juris.git
git push -u origin main
git tag -a v0.3.1 -m "GENESIS: AI Juris v0.3.1"
git push origin v0.3.1
```
