# Production C1 source draft — no hosted execution

The intended outcome is a reviewable local production source candidate that preserves production history, documentation and hosting configuration while using the exact C1 application and the two bounded fixes discovered during clean-review acceptance. This preparation does not establish M0, deployment readiness, production approval or pilot GO.

| Role | Exact source commit |
| --- | --- |
| Live production v91 / preserved detached rollback source | `3986d9035b522044ad8423b50a5b620cbc13734f` |
| Fetched production main, candidate parent | `ef4488e0510a498b55339f0e334f0f0aa921acef` |
| Accepted clean-review source before newly discovered defects | `6411971f51b65ad81f16b018e5b299d730807b85` |
| Canonical notes receipt digest correction | `90c920ef9b7577e570cd879c3e911473815d64b2` |
| Narrow-screen notes switch correction / transferred successor | `773dc47714bda9288dc5e8d2be516790a727ace8` |
| Local production implementation commit | `2a6e4ae16a5547b415951dcb5f6dfd2a672f4d92` |

The production parent is retained rather than overwritten by the live version. Its additional `docs/testing/demo-catalogue-publication-2026-09-16.json` contains 56 lines and remains byte-identical. The independent checkout `C:/PROJECTS/Genesis-AI-Juris/.worktrees/c1-production-source-2026-09-24` remains clean and detached at live production `3986d9035b522044ad8423b50a5b620cbc13734f`.

The candidate is at `C:/PROJECTS/Genesis-AI-Juris/.worktrees/c1-production-candidate-2026-09-24`, branch `codex/c1-production-candidate-2026-09-24`. Source was read from immutable Git blobs of successor `773dc47714bda9288dc5e8d2be516790a727ace8`, not from an uncommitted working directory. No unrelated Git histories were merged.

## Exact transfer and exclusions

[source-transfer.json](source-transfer.json) lists every changed path with its prior production Git blob, successor Git blob, mode, byte length and SHA-256. It records **495 selected tracked files verified**, **75 changed files**, and **164 existing production documentation/configuration files preserved**. The selected source inventory covers `app`, `worker`, `build`, `db`, `public`, `drizzle`, `scripts`, `tests` and the explicit root configuration list in the JSON.

The application transfer contains the existing C1 notes/departure/recovery work, B1 behavior, immutable document-version form, release provenance, minimal migration correction and two subsequent notes fixes. No additional C2, mobile or design work was introduced. Production native-mobile, Rust, content, contract, example and parity files have no diff. New review evidence directories, synthetic datasets and runtime artifacts were not copied; existing production documentation and fixtures remain intact.

The whole production `.openai` directory is preserved. In particular `.openai/hosting.json` still selects production project `appgprj_6a88a26d2f808191aa076b9fcd8dbce6`, D1 binding `DB` and R2 binding `DOSSIER_DOCUMENTS`, with SHA-256 `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe`. Review-only `.openai/c1-review-identity.json`, the old review staging notice, dependency directories, build outputs and runtime caches were excluded. No resources, secrets, provider settings or custom domains were created, reassigned or copied. Preserving source binding names is not evidence of current hosted resource state.

## Provenance and verification limits

Read-only hashing of the release helper's 353 input records yielded the same application-input digest for successor `773dc47714bda9288dc5e8d2be516790a727ace8` and production implementation `2a6e4ae16a5547b415951dcb5f6dfd2a672f4d92`:

`d62d9432d39a01eb126d6b1c7b179dcb88e8c44afd3c02272fe77c0f1d0f72c8`

This is a source-input digest, not a bundle hash, deployment mapping or runtime receipt. The full hosting-config hashes differ as expected. The selected 495-file source/test/config inventory hash is separately recorded as `f6f349f64df6feb23aa5975acce8f8e0c9b1831ebc94b9c5f9fa3c054d76179e`.

No generated `dist` files or embedded provenance were copied. No production-candidate build or archive was made. When an authorized build becomes appropriate, `vite.config.ts` must capture identity from the final candidate HEAD and its production hosting bytes; `build/sites-vite-plugin.ts` must verify stable inputs and write the matching sidecar. Neither accepted `6411971…` nor successor `773dc477…` should be substituted as that future production build's source commit. A later documentation-only commit can change HEAD without changing application input bytes.

Source equality and `git diff --check` passed locally. Tests were not rerun in this production candidate and no browser check of it is claimed. The following technical evidence belongs to the separate clean-review source and is referenced rather than copied:

- Commit `90c920ef9b7577e570cd879c3e911473815d64b2`, `docs/testing/c1-notes-receipt-contract-2026-09-24/REVIEW.md`: real-handler regression failed before correction; 19/19 controller plus actual-handler tests and TypeScript passed after correction. Receipt verification remains strict.
- Commit `773dc47714bda9288dc5e8d2be516790a727ace8`, `docs/testing/c1-notes-mode-switch-2026-09-24/REVIEW.md`: two source/render checks and TypeScript passed; actual 390 px / 200% browser acceptance remains separate.

Those files are available locally under `C:/PROJECTS/Genesis-AI-Juris/.worktrees/c1-clean-review-source-2026-09-24/`. Local tests do not prove hosted acceptance or human approval.

## Migration and publication boundary

Production migration `0022` disposition remains **UNKNOWN**. The transferred source SQL is `drizzle/0022_loving_juggernaut.sql`, SHA-256 `5a7d2c2ca5b724e5f29bf27660a45191fb68b6d676491a1af7414e55f2f3760a`. Its source metadata is copied exactly from the clean successor. `drizzle/meta/_journal.json` is source migration metadata; it does not attest to or alter the hosted migration ledger.

This corrected migration is contingent on authoritative reconciliation demonstrating it is UNAPPLIED, or a separately approved operator continuation appropriate to the precise retained partial state. An APPLIED or partially applied target must not receive an automatic rerun merely because this file passes local checks. Existing data, migration ledger, triggers and constraints must remain intact. Current production schema/ledger/data, failure/partial-state trace, rehearsal, verifiable restoration and old-application compatibility remain M0 prerequisites.

No build, archive, migration execution, native Site save, push, deployment, production change, invitation, closed pilot or expenditure was performed during this preparation. This is a **local source-only draft**; it supplies no production GO.
