# P1b independent review and validation

Date: 2026-09-29. Implementation base: `7d8fe2741a7c1fda45fc23e5be88f6592c7c94c9`.
Owned checkout: `C:/PROJECTS/Genesis-Juris-Tax-P1B-2026-09-29`.
Task branch: `codex/tax-p1b-adapters-2026-09-29`.

## Required start snapshot
Task owner: `/root/tax_p0_scope`. At worktree creation on 2026-09-29, the owned local HEAD was `7d8fe2741a7c1fda45fc23e5be88f6592c7c94c9`; freshly fetched and independently verified `origin/main` was the same commit. The target path and branch were checked for collisions before creation, and the new owned checkout was initially clean.
The scope was confined to the owned path/branch above, tax crate adapters/tests and named documentation. Pre-existing dirty work in `C:/PROJECTS/Genesis-AI-Juris`—`Cargo.toml`, `docs/development/CURRENT_PROGRESS.md` and `docs/development/TAX_ECONOMICS_V2_INTEGRATION_PLAN.md`—was outside this task's ownership and was not edited, staged or imported. Coordinator and Site checkout tracked files were also outside ownership.

## Implemented scope and review

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
| `cargo test -p juris-tax-economics --locked` | 82 passed: 21 unit, 25 accepted regressions, 15 P1a transport, 21 P1b |
| same test command with `--no-default-features` | 77 passed: 19 unit, 22 accepted regressions, 15 transport, 21 P1b; only five FFI tests omitted |
| `cargo clippy -p juris-tax-economics --all-targets --locked -- -D warnings` | pass |
| same Clippy command with `--no-default-features` before `--` | pass |
| `cargo +1.78.0 check -p juris-tax-economics --all-targets --locked` | pass |
| same MSRV check with `--no-default-features` | pass |

Final commands exited 0. A SHA256 manifest of crate files plus workspace Cargo.toml/Cargo.lock was compared before and after the final gate sequence; compiled sources were unchanged. Per-command logs and exit receipts are in the sibling P1B evidence directory. The independent golden calculation hash was computed separately with Python hashlib. Test fixtures are synthetic. Initial test-only string/byte API mismatch was corrected before the final green runs.

The core formula implementation and standalone `src/ffi.rs` are unchanged. Existing pure regression coverage remains enabled in both feature modes. Existing sha2 is reused; Cargo.lock adds one dependency edge without upgrading packages. No original checkout, bridge, Flutter/UI, persistence, web/PDF, mobile configuration, deployment or version activation changed. Full workspace/mobile/hosted acceptance is not claimed for this unlinked pure boundary.

## PO migration correction after be57e97
Pinned web defaults/normalization always include an annual base and the basis selector retains it. Activating that unused aggregate blocked ordinary amounts imports on unnecessary provenance. The follow-up preserves the base as explicitly inactive typed metadata (cents, original currency/source SHA256, unknown provenance), while the active amounts request has no base. Rates imports and the existing manual provenance gate are unchanged.
Independent reviewer approved the correction and three additional regressions: zero/nonzero inactive bases with original/FX/round-trip/idempotence, bare basis/currency toggle refusal followed by explicit approval, and unavailable rates/base retained distinctly from zero. Future activation responsibilities are specified in CONTRACT.md. The final counts above include this correction; every listed gate was rerun with an unchanged SHA256 source guard (inactive-* evidence receipts). The prior be57e97 checkpoint remains in branch history.

## Published functional checkpoint and handoff
Snapshot read back at 2026-09-29 19:09 UTC. Functional head: [64a99d505e407d80f03063d667027e5d11514c9a](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/commit/64a99d505e407d80f03063d667027e5d11514c9a), with reviewed predecessor `be57e97536a4dc1fff8c9aab88473898a6536d40` preserved. Local HEAD and `git ls-remote` both verified that functional SHA on `codex/tax-p1b-adapters-2026-09-29`; the owned checkout was clean. Publication is represented by [PR #66](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/66).
At that snapshot, remote `main` was still `7d8fe2741a7c1fda45fc23e5be88f6592c7c94c9` and did not contain the candidate. This documentation-only successor records the functional checkpoint above; it does not claim its own not-yet-created commit hash is the tested functional SHA.

| Exact functional-head hosted evidence | Terminal result |
| --- | --- |
| PR Rust CI run 36616745259: [MSRV job 109571587327](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36616745259/job/109571587327) | success |
| Same PR run: [quality job 109571587702](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36616745259/job/109571587702) | success |
| Push Rust CI run 36616738962: [MSRV job 109571567918](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36616738962/job/109571567918) | success |
| Same push run: [quality job 109571568372](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36616738962/job/109571568372) | success |

Each job API reported `head_sha=64a99d505e407d80f03063d667027e5d11514c9a`, completed/success. At the same checkpoint Root Web/PDF runs 36616745079 and 36616738991 and PR Android run 36616745083 were in progress; PR iOS run 36616745080 was in progress and push iOS run 36616739164 was pending. These are checkpoint observations, not future conclusions. The pure tax crate remains unlinked to native applications; native workflow results do not establish P2/P3 integration. No all-CI, merge, feature-activation or release acceptance is claimed.

Handoff: root owns PR reconciliation, outstanding hosted-result readback and ordinary merge. P2 native transport and P3 durable editor/save/reopen remain separate work. This successor changes only this review record; source/test artifacts are unchanged, so documentation diff/link checks and an independent brief review replace an unnecessary package-test rerun.
