# GitHub source reconciliation — 29 September 2026

## Outcome and scope
Keep the latest working Genesis Juris implementation in canonical GitHub main, preserving both histories and existing files. Source synchronization is separate from deployment and product-release GO.

## Verified baseline
- GitHub main: 5c1267faf9bc17df659cf14df590485f11856672 (7 September).
- Original web checkout: f880bcaf961066db2e776e32e3bfbb89e19e001d with independent pending report/test edits.
- Newer active candidate: 741472684ad8e581ccedb1b6ff8639c6fc26acee, including the report fix and 18/18 reported invitation authority tests.
- Common ancestor: e025131d87e35d4364d542acc5c84b6097eb657b.
- GitHub-only changes: four September 7 handoff/archive files; no overlap with candidate changes. Preserved unchanged.
- Candidate retains production rollback bf579938 and prior INV01 e256660 in its history.
- Main rules prohibit deletion and non-fast-forward updates; no bypass is used.

## Bounded amendments
- Fetch full history only in web-and-pdf; preserve checked-out ref, permissions and PDF job.
- Diagnose unavailable migration compatibility commits before running the suite.
- Ignore local linked worktrees; legacy checkout receives local exclusions for artifacts/worktrees/error.log without staging its files.
- Preserve independent report assertions for every intermediate CR line and unchanged input.
- Preserve the newer report implementation and renderer identity.
- Local merge e4aee2f preserved GitHub's four files; despite its message, CI/test amendments are in the subsequent fix commit.

## Evidence and limits
Independent merge review found zero changed-path overlap and no new mobile/Rust divergence. Outgoing-history review, targeted checks, remote verification and pending-file dispositions are recorded in the completion addendum. Release acceptance remains open; no mail, migration, deployment or pilot was performed.
