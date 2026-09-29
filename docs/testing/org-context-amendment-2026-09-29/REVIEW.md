# Organization context amendment — 29 September 2026

## Intended outcome and ownership
Preserve the managed organization and unrelated draft input after create/accept; expose ordinary sign-in recovery after expiry; refresh the navigation rail when an organization becomes available, including recovery from a failed follow-up read. This is a bounded correction within the existing organization/INV01 journeys, with no feature expansion.

Codex contributor `/root/review_git_sync` is the sole writer in the new isolated `Genesis-Juris-Org-Amendment-2026-09-29` worktree, branch `codex/org-context-amendment-2026-09-29`. Owned paths are `app/organizations/OrganizationsClient.tsx`, `tests/organization-context-continuity.test.ts`, and this evidence directory. Root coordinates independent integration review and publication. No other checkout or shared dependency directory is modified.

Base: `bd8b0e07fe4b9c0eded527e1825f0fa3eb66956c`, containing the reviewed CI dependency correction. The two application/test blobs are ported exactly from `781a62b69aa6784760d346754a84ef3218d66095`, incorporating `964d31c`, `8d5763a` and `781a62b`. The older dependency commit `5175cb0` is excluded; current manifest/lock, PDF baseline and all other application/native inputs are preserved.

## Source review
Independent pre-port read-only review found no blocking source defect. The authority/actor fences and server-authorized navigation remain; expiry may retain page recovery while denial still withdraws authority. Creating/accepting adds a rail choice without selecting it. Changed managed selection withdraws authority. A failed follow-up read does not promise a missing Manage entry; a successful later Refresh updates rail choices.

The upstream commit messages report seven red/green cases and a subsequent independent review that discovered the failed-read recovery gap. Those statements are historical claims; no new upstream raw receipt was imported. This port is verified separately on the recorded inputs.

## Acceptance and evidence
Required local evidence: fresh isolated lock-enforcing install with Node 22.23.2/npm 10.9.8, unchanged manifest/lock, 19 continuity cases, existing organization/invitation/navigation regression suites, strict TypeScript, focused lint, and a tracked-input preservation guard. `verify.mjs` records commands, terminal exits, exact input hashes and timestamps. It requires a fresh checkout at the stated base and no existing `node_modules`; do not rerun it as an in-place cleanup command.

Readable logs normalize line endings, trailing whitespace and the isolated checkout path. Raw command bytes remain locally under `.artifacts/org-context-amendment-2026-09-29/raw`; each readable log records the raw and readable SHA-256 in its receipt. No credentials or production data are required.

The handler tests execute extracted real handlers with a mocked loader and fixed mounted flag. They do not certify React effect timing, rendered sign-in controls, DOM input restoration or actual Open cases clicks. Browser journeys, complete release verification, hosted CI, deployment and external pilot remain NOT_RUN for this port. No completed user-journey or release GO is claimed.

Completed verification and delivery status are recorded below.

## Completed bounded verification
[Terminal receipt](evidence/result.json): **PASS**, 29 September 2026, 10:23:32.577Z–10:34:18.871Z. These results cover base plus the exact two reviewed working-file hashes; the subsequent commit records those same source blobs and evidence.

| Check | Result |
|---|---|
| Fresh pinned `npm ci --no-fund` | PASS; 527 packages; manifest and lock unchanged; real isolated dependency directory, no junction |
| Organization continuity | 19 PASS, 0 FAIL/SKIP |
| Seven existing organization/invitation/navigation regression files | 73 PASS, 0 FAIL/SKIP |
| Strict nonincremental TypeScript | PASS |
| Focused application/test ESLint | PASS, no warnings |
| Final tracked-input guard | PASS; zero changed tracked inputs during verification |
| Published verification helper syntax/ESLint | PASS |

Counts are separate suites. Commands and raw/readable log hashes are in the terminal receipt. The existing regression selection includes the P1 organization/ERP and Canopy governance cases; their longer execution completed successfully.

Root coordinator independently inspected the ported source and verified both files equal the reviewed `781a62b` blobs. Its read-only disposition found the retained authority/epoch fences and post-create recovery correction acceptable. Source review does not certify the unrun browser journeys.

One evidence-tooling finding was corrected: the initially executed CommonJS launcher violated the repository's no-require-imports lint rule. Its executed bytes remain in the local ignored directory as `verify-executed.cjs`. The published helper uses ESM imports and fixed reviewed blob IDs, avoiding a dependency on unpublished upstream history; child verification commands are unchanged. Final syntax/lint and both blob comparisons passed. No product source, assertion, lint policy or baseline changed for this correction.

To reproduce: use a fresh isolated checkout at the stated base; restore the two owned files from this port's commit; copy this evidence helper; select Node 22.23.2/npm 10.9.8 and run `node docs/testing/org-context-amendment-2026-09-29/verify.mjs` before installing dependencies separately. The helper deliberately requires no existing `node_modules` and does not clean any checkout.

## Delivery and remaining acceptance
The coherent local commit contains only the two owned paths and this review/evidence directory. Remote push, PR/main integration and hosted checks are delegated to root after independent publication review; they are not claimed here. No other worktree, tax/Rust source or original pending artifact is included.

Browser journeys remain **NOT_RUN**: actual create/accept and Open cases with departure confirmation; failed follow-up read followed by Refresh without a repeated POST; rendered expiry/sign-in recovery and retained input; denial/account-change fencing of late results. The extracted-handler tests do not close those user-journey requirements. Full release, production migration, live mail, deployment and external pilot remain outside this local verification.
