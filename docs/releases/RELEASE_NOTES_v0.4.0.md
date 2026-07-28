# GENESIS: AI Juris v0.4.0 — Release Notes

## Theme

**The active legal workday**

v0.4.0 expands the event-driven prototype into a strategic professional loop. Messages require responses, deadlines can be missed, work consumes daily capacity, delegation takes time, and litigation proceeds through multiple stages before judgment.

## Added

- Structured active inbox with handled and response-required state.
- Client CEO, CFO, partner, junior, expert, opponent, and court messages.
- Partner brief, preservation notice, and statement-of-claim deadlines.
- Deadline warnings and deadline-specific penalties.
- Daily work capacity, overtime, persistent fatigue, and deliberate rest.
- Fatigue-based quality penalties for selected professional actions.
- Asynchronous junior document-review delegation.
- Asynchronous independent expert report.
- Multi-stage litigation: pleadings, filing, disclosure, opponent disclosure, expert decision, preparation, hearing.
- Stage-specific AI research, evidence review, damages model, draft review, and hearing preparation.
- Explainable judgment breakdown with named modifiers, final threshold, and deterministic roll.
- `VISION.md` and `development-journal.md`.
- Repository-wide LF normalization through `.gitattributes`.
- Extensive architectural and explanatory Rust comments.

## Changed

- Case stage model expanded beyond a single generic litigation stage.
- Inbox is now authoritative domain state rather than a vector of display strings.
- Settlement outcome records net value after simulated legal spend.
- Content JSON now owns deadline and turnaround configuration.
- The CLI displays workload, fatigue, active deadlines, message status, litigation progress, and judgment factors.

## Preserved invariants

- Same seed plus same actions reproduces the same state.
- AI cannot mutate state or reveal undiscovered evidence.
- Only the engine applies mechanical consequences.
- Scores remain bounded from 0 to 100.
- All future events use stable FIFO ordering.

## Release validation

Before tagging v0.4.0, run:

```powershell
cargo fmt --all
cargo fmt --all -- --check
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Then confirm the GitHub Actions `quality` job is green.
