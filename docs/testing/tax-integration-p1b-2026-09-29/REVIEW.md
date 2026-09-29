# P1b independent review and validation

Date: 2026-09-29. Implementation base: `7d8fe2741a7c1fda45fc23e5be88f6592c7c94c9`.
Owned checkout: `C:/PROJECTS/Genesis-Juris-Tax-P1B-2026-09-29`.
Task branch: `codex/tax-p1b-adapters-2026-09-29`.

Implemented: both explicit pinned legacy adapters; exact integer money conversion; preserved originals/FX and unknown provenance; confirmed structured component binding; frozen P0 input hashing; separately versioned binding/provenance identity. See [CONTRACT.md](CONTRACT.md) for source pins, field order and future-caller responsibilities.

Independent reviewer `tax_boundary_review` inspected source, pinned historical normalizers, contract and focused regressions. Final review approved after these findings were closed:
- Preserve full unfinished binding data and required component IDs in returned drafts.
- Excluded, nonrequired unfinished bindings do not block selected calculations.
- Keep notes unchanged; hash structured provenance separately instead of ambiguous concatenation.
- Bound optional provenance before cloning, including unconfirmed drafts.
- Validate existing benefit references against the current supplied source indices and document their identity-only trust boundary.
- Demonstrate the exact former concatenation collision and float-rounded fractional money traps in regressions.

| Final command | Observed result |
| --- | --- |
| `cargo fmt -p juris-tax-economics -- --check` | pass |
| `cargo test -p juris-tax-economics --locked` | 79 passed: 21 unit, 25 accepted regressions, 15 P1a transport, 18 P1b |
| same test command with `--no-default-features` | 74 passed: 19 unit, 22 accepted regressions, 15 transport, 18 P1b; only five FFI tests omitted |
| `cargo clippy -p juris-tax-economics --all-targets --locked -- -D warnings` | pass |
| same Clippy command with `--no-default-features` before `--` | pass |
| `cargo +1.78.0 check -p juris-tax-economics --all-targets --locked` | pass |
| same MSRV check with `--no-default-features` | pass |

Final commands exited 0. A SHA256 manifest of crate files plus workspace Cargo.toml/Cargo.lock was compared before and after the final gate sequence; compiled sources were unchanged. Per-command logs and exit receipts are in the sibling P1B evidence directory. The independent golden calculation hash was computed separately with Python hashlib. Test fixtures are synthetic. Initial test-only string/byte API mismatch was corrected before the final green runs.

The core formula implementation and standalone `src/ffi.rs` are unchanged. Existing pure regression coverage remains enabled in both feature modes. Existing sha2 is reused; Cargo.lock adds one dependency edge without upgrading packages. No original checkout, bridge, Flutter/UI, persistence, web/PDF, mobile configuration, deployment or version activation changed. Full workspace/mobile/hosted acceptance is not claimed for this unlinked pure boundary.
