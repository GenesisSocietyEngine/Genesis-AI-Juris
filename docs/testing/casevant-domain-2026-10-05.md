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

## Existing-user continuity review

- PR review identified an origin-bound limitation: host-only sessions and device drafts do not automatically move between the two domains. Workspace records share the existing backend, but users must authenticate to the same account on the new origin. This is an unavoidable browser boundary; no cross-domain token or browser-storage transfer is introduced.
- Outcome: a discoverable Studio notice on `casevant.pro`, in English and Russian, explains how to preserve and reopen existing work. It instructs users to keep the original browser/profile/tab, avoid signing out or clearing browser data, confirm a workspace save or use a permitted case export, then reopen Personal cases with the same account and select the same organization for Team cases. Unavailable save/export paths explicitly retain the original tab.
- All three recovery links open separate tabs with `noopener noreferrer`; no case data, credentials or authorization tokens appear in links. The component only reads the public hostname and adds no storage writes or network requests.
- Focused domain/entry/recovery checks passed (5/5), along with ESLint for the new component and test and strict TypeScript. React review covered hydration-safe origin selection, stable subscription callbacks, semantic disclosure and lists, keyboard focus, wrapping text and preservation of the existing departure controller.

## Dependency audit repair

- Exact-head web CI passed 1,166 tests and the packaged Rust/Worker checks, then stopped at `npm audit --audit-level=low`: GHSA-vfj7-8cjw-p6xm affects the transitive `braces` 3.0.3 dependency of build/lint tooling. The advisory and registry list no fixed upstream release. No audit threshold, workflow or production dependency is to be weakened or downgraded.
- Intended outcome: replace this transitive module with an explicitly named, MIT-licensed local maintenance fork of the same upstream code, with bounded parser and walker depth. Acceptance: reject deep brace/parenthesis patterns before recursion, bound direct AST walkers, preserve ordinary glob/range behavior, exercise the actual resolved dependency, pass full lint/build/tests and both unchanged audits. Document upstream provenance and removal criteria; do not imply that npm published a fixed upstream version.

## Help & Training refresh after v110 publication

- The domain functionality was published as v110 before this documentation refresh. The owner additionally requested current Help & Training material after publication.
- Outcome: current English/Russian written instructions must lead from a brief or import through review, confirmed save, My cases → Personal, and PDF inspection. Team cases, device drafts, AI profile requirements and origin-bound recovery must be distinguished accurately. Downloadable quick starts and a Russian practice brief must work.
- Acceptance: public Help navigation preserves the selected language, saved cases open the Personal collection, the recorded video's audio/captions/transcript remain aligned and its older interface is clearly labelled, all existing media checks pass, and both languages render with accessible disclosures and working local downloads.

## Reviewed checkpoint evidence

- Clean install with the CI-pinned npm 10.9.8 succeeded against the exact candidate lock hash `831331c83ecedd379ff4db548f8c24b547ef436c07d17107d54f11c573d6e8f2`; npm retained that hash. `npm ls braces --all` resolves micromatch to the named local fork. All four security regressions also passed against that clean installation. Only the braces resolution and root reference change in the lock; unrelated package metadata and versions are retained.
- Full and production npm audits returned 0 vulnerabilities with the audit gates unchanged. Full ESLint passed (four existing unrelated warnings); targeted lint after the Help changes also passed. Fifteen focused recovery, security and existing Studio/media checks passed. The complete verified production build and rendered-bundle tests passed; the full local test suite is still running at this source checkpoint. Exact-head Actions will supply integration results.
- Browser preview confirmed the live public Help page in English and Russian, the language-specific download destinations, and keyboard expansion of the save/reopen step. Russian navigation now uses the same “Мои кейсы” label as its destination. Earlier video links and the video heading explicitly identify the earlier recording; narration, subtitles and transcript bytes are unchanged.
- A rendered component fixture in a 390px iframe confirmed the responsive Russian Help layout without horizontal overflow (375px content/scroll width including scrollbar). The domain notice in both languages wrapped within 390px containers and keyboard disclosure worked. The full application disallows embedding, so the narrow check used the actual component/CSS fixture, not an authenticated embedded app. All temporary QA pages were removed before staging.
- Both localized quick-start/practice downloads exist and rendered links resolve to those local assets. The cloud-browser download-event wait timed out; receipt of a downloaded file was not claimed. Sign-in and account-owned save/reopen on the new domain remain unverified until TLS and an authenticated session are available.
- React review: no render-time storage writes, stable external-store callbacks for the hostname notice, semantic details/summary, preserved focus behavior and departure navigation, same-account relative recovery links opening separate tabs, and no secrets in links. Current written guidance is placed before the earlier recording; saved cases, browser drafts and Team records are clearly distinguished.
- The full local run completed with 1,194 passes, three existing skips and two failures caused solely by absent historical Git objects in the initial shallow clone. The failing files explicitly require published migration revisions; full history is being fetched and those two checks will be rerun without skipping or substituting historical source. This is not reported as a fully green local run at the checkpoint.
