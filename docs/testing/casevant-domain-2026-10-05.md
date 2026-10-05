# CaseVant custom domain — 2026-10-05

## Source and ownership

- User request: make the existing CaseVant functionality available at `casevant.pro`.
- Production base: v109, source `3d8b870d82acb3650e4089618a8f9c4f9e1963b8`; checkout initially clean.
- Canonical main observed at `96a69c5703fd98782aec361e4a6414987c4de7bb`. Both changed functional files match that main exactly before this patch.
- This task owns only custom-domain setup, the exact host match, its focused regression coverage and this review note.

## Outcome and acceptance

The new domain must open the same Studio workspace and CaseVant page metadata as `studio.falcon-merlin.com`, retaining explicit navigation to the library, help and other existing views. Both domains must use the same application, database, document store and access policy. No data migration, authentication changes, unrelated feature integration or external-pilot GO is implied.

## Review

- Added only the exact `casevant.pro` hostname to the existing normalization and host selection. Existing legacy host, forwarded-host precedence and explicit navigation behavior remain intact.
- Both `generateMetadata` and the initial Studio mode already consume this host predicate. Existing navigation and account continuations use relative URLs; no redirect to the legacy domain was introduced.
- No wording, layout, accessibility controls, dependencies, storage bindings or calculations were changed. Same-page UI behavior inherits the existing production implementation.
- Focused host and Studio entry checks: 4/4 passed. ESLint passed on both modified TypeScript files; diff whitespace validation passed.
- Complete verified production build passed, including strict TypeScript validation, generated Rust tax assets, every D1 migration breakpoint and the locked mobile contract. No dependency changes were needed. The existing large-chunk advisory remains informational.
- Reviewed the complete domain-entry path from forwarded-host normalization to Studio selection and metadata; explicit library/help/continuation parameters retain their existing precedence. Authenticated browser acceptance remains unverified while the new domain awaits TLS.

## Domain validation

- Added `casevant.pro` to the existing production Site; public access and the existing domain are unchanged.
- Provider hostname validation is active; TLS was still `pending_validation` at 14:10 UTC.
- Public DNS inspection found the expected ownership TXT. Cloudflare's resolver returned `162.159.143.30` and `172.60.3.26`; the second address contains a typo and must be `172.66.3.26`. The owner was notified. Google's resolver still had the old one.com address cached.
- The actual DNS correction and HTTPS activation must be confirmed before claiming the new address is live. No authenticated browser journey has been claimed.
- The owner reported the A-record correction at 14:13 UTC. Resolver propagation and final TLS state are being rechecked independently of the successful source build.

## CI correction and main rollout

- Follow-up authorization: fix the failing check, verify the candidate and roll it into canonical main; then update Help & Training.
- Isolated contributor checkout: `/workspace/scratch/1ebfc70d74f9/pr89-fix`, starting at PR #89 head `d55df4839aebaa0c3ab2a2e59e1c8ca71da9fb8a`, initially clean. Production remains separate at v110/source `d935f5d45d68b336a88e9b04ee34dd4d15e1cbe9`.
- Failed CI job `111808549097` stopped in the portable deadline tests before simulator setup. Its assertion expected `install began` in stdout, but the 0.3-second subprocess deadline can expire before interpreter startup emits a byte. An explicit 0.6-second startup shim reproduced the exact failure locally.
- Intended outcome: remove startup-speed dependence while retaining a real bounded-process test and deterministic proof that timeout streams and failure evidence are preserved. Acceptance retains the real 0.3-second deadline, upper elapsed bound, prior-evidence preservation, no success exit code and no runtime acceptance. Production timeout code and workflow gates are unchanged.
- The real-child test now requires both output files without requiring that startup produced output. A separate test verifies exact partial stdout/stderr and the no-output case, timeout rethrow, terminal metadata and absence of phase acceptance.
- Local validation: all 73 portable diagnostic/deadline/phase tests passed (13 + 11 + 49). The same delayed-start shim that reproduced the old failure now passes with the real 0.3-second deadline unchanged. Diff whitespace checks passed. Exact-head CI results will be recorded in the PR publication receipt. No unrelated working tree changes belong to this task.
