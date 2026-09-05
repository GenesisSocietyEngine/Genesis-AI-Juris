# P0a complete-source restoration — 5 September 2026

## Why this change exists

The first cloud request on instruction PR #46 ended with a generic failure and no published implementation. This checkpoint restores the missing native/shared source directly from verified Git history, leaving an accessible implementation branch for the next bounded Codex task.

The source is `c088200138332cd212b87e266746ea85b53a2f77`; the web base is `280394640f0fc4d2a87e098edd6d34001393c557` (tree `d3e14e34db68830f4eb73fc84bc27bce5713577c`). Existing Site recovery commits are not rewritten.

## Restored composition

- Rust workspace manifests, lockfile, toolchain declaration and 14 crates.
- Flutter/mobile application, assets, native packaging and tests.
- Canonical content and shared case/report/security contracts.
- Four inherited GitHub workflows and the iOS native export-check scripts.
- Architecture, authoring, design, development, release, setup and testing history under previously absent documentation directories.
- LF Git attributes and appended, scoped Rust/Flutter output ignores.

The accompanying JSON manifest lists exact source blob/tree identities and explicit exclusions. 487 files are restored byte-for-byte from that source. The root web application, package lock, migration history through 0018 and hosting configuration remain unchanged. The only modified pre-existing file is the additive `.gitignore` update.

Do not restore `apps/juris-web` or historical `dist/`. Preserve case-sensitive web documentation names rather than introducing uppercase collisions from the old monorepo.

## Evidence boundary

This is P0a source reconstruction, not completion of P0 or authorization to merge/deploy. The coordinator checks the candidate tree against both source commits and records the actual results in the implementation PR. Tests and workflows need their own run receipts; absence or failure is not PASS.

The inherited CI files retain their historical content so this checkpoint is independently verifiable. Their floating toolchains, ordinary dependency resolution and missing web/PDF gate are known unfinished work for P0b. Do not reuse historical CI as proof for this candidate.

Historical `docs/development/CURRENT_PROGRESS.md` is restored as a historical source artifact. This receipt and the current daily brief supersede its stale current-status fields.

## Next bounded Codex task: P0b

1. Inspect this implementation PR and available CI results; continue on its branch.
2. Pin verified Rust/Flutter/Dart/Node/npm toolchains consistently and enforce committed locks without mass reformatting or rewriting goldens.
3. Adapt root-web/native paths where actual build or parity failures require it.
4. Add the existing web/PDF verification path to hosted CI, with Poppler artifacts and no weakened gate.
5. Publish a scoped implementation commit and report exact tests, checked-out SHA/tree, artifacts and any environment blocker.
6. Then proceed to P0c final-head evidence and the ERP pilot checklist from the complete `CodexToInstructions.md`.

Do not amend frozen migrations, overwrite the restored root web with old source, merge PR #43/#44, deploy/save Sites, change production secrets or activate confidential ingestion. Phase B wiring remains the follow-on milestone after P0.
