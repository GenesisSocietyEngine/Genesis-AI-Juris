# GENESIS: AI Juris v0.3.1

This patch release keeps the v0.3 event-driven architecture unchanged.

## Fixed

- Renamed `SimMinute::add` to `SimMinute::saturating_add_minutes`.
- Updated all engine call sites.
- `Cargo.lock` is no longer ignored, so application builds can be reproduced.
- The explicit method name documents overflow behaviour and satisfies
  `cargo clippy --workspace --all-targets -- -D warnings` on Rust 1.97.

## Verified by the user before this patch

- `cargo check --workspace` succeeded.
- All eight v0.3 tests succeeded.
- The only strict Clippy failure was `clippy::should_implement_trait`.

## Git note

The local project directory was not yet a Git repository. Run `git init` before
creating commits or tags, then attach the GitHub remote.
