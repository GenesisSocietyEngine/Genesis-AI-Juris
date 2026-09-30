# Confirmed account return

The intended behavior is to return to the requested workspace after a successful local login or confirmed profile save without warning that the completed operation is still pending. Failed, unconfirmed and stale operations must retain ordinary departure protection. If starting navigation throws, later dirty or pending work must still receive its warning.

## Source and observed defect

Development starts from clean `60c62862f72449e3d87d23ff85935a1b621f77b7` in the isolated `codex/account-confirmed-return-2026-09-30` branch. The original runtime/diagnostic checkout at `8bfa5e75007216b7dcf5b5a5e8f48c657192e387`, PR72 and the user's original checkout remain unchanged.

The earlier actual local Worker journey verified a completed PDF and complete receipt JSON against the full POST201, history GET, D1 event and freshly executed Rust model. Its saved case stayed byte-for-byte unchanged. That report proof is separate from account-return acceptance.

In a later bounded diagnostic on unchanged `8bfa5e7`, Edge154's real login returned200 and completed transport at `2026-09-30T21:29:18.794Z`. At `21:29:18.795Z`, Page events recorded the script-initiated navigation to the exact saved Studio URL followed by `javascriptDialogOpening`, type `beforeunload`. Return navigation did not complete. A separate direct-target dialog-accept call returned `No dialog is showing`; it was not successful recovery. Earlier uninstrumented Chrome138 and Edge stalls remain separate observations, not retrospectively proven to have the same cause.

Source inspection and focused actual-handler regression show the ordering defect: `formCommitted` updates the form baseline, while the guard still reports `busy=true` until the handler's `finally` update commits. The immediate `location.assign` therefore reaches unload protection for the just-completed operation.

Retained ignored evidence is under `ci-miniflare-handshake/.artifacts/authenticated-browser-worker/edge-2026-09-30/`: `REVIEW.md`, `diagnostic-inventory.json` (SHA256 `33755cecdeb8bde96f64159ed346b36e23282d0f36c1615c4ffa0cd580f4be5a`) and `final-d1-verification.json` (SHA256 `f30afe99c1e252aea535f65429b6d050234de2d383acf3ee5c8806ba05ac8348`). These are local synthetic-account diagnostics, not a live provider/production-account claim.

## Correction and preservation review

Only the confirmed login/profile handoff uses the existing `NavigationController` departure-approval API. The helper checks the captured authority generation immediately before approval, approves directly before `location.assign`, and cancels that approval if navigation throws. Existing success checks, response-body authority checks, form baseline/reset behavior and failure handling remain in place. Other credential operations do not approve departure.

The form guard, shared controller, authentication routes, storage, report calculations and report-history rules are unchanged. There is no new UI copy, layout, focus behavior or broad removal of unload protection. Actual rendered navigation still requires the fresh-build application check below.

## Focused validation

The regression harness extracts and executes the actual AccountClient handlers, using the real `NavigationController` and a registered pending/dirty guard. It covers current success while the guard remains pending, held response protection, HTTP/network/JSON failures, authority withdrawal during both transport and body parsing, thrown navigation recovery, unrelated credential success and already-authenticated rejection.

- Before the correction, the new14-test suite passed10 and failed4 on the expected successful-handoff warning assertions. The original failure log is retained.
- After the correction, the new suite plus existing authentication, sidebar and Studio departure suites passed46/46, with no skips.
- Whole-project typecheck and focused ESLint both passed with exit0 and no diagnostics.
- `git diff --check` passed. Package and lock bytes match the already verified dependency installation; focused checks use that installation read-only through a task-worktree junction, with no npm mutation.

Logs are retained in this worktree's ignored `.artifacts/account-confirmed-return/`. These local results initially describe the uncommitted two-file correction, not an unchanged-base application build.

## Review and application result

Root independently reviewed the complete production diff and all 14 actual-handler tests and found no remaining material issue. The pending guard remains protected before server confirmation, and a thrown return restores warning behavior. A named local commit precedes the new verified production build.

The reviewed correction was committed as `53ae4ec500bb48619e16bad31d657ec0dbb4a70a`. A fresh isolated `npm ci` completed without changing lock bytes. Exact raw-input verification matched all 429 committed application input files; the fresh verified production build passed, and client/RSC/SSR manifests bind that exact source and application digest `35f178afbdb51f4509f5e3c19525f2b32ff1aec62714794cd3f6494cd8920c98`.

The [actual Worker/browser application review](BROWSER_APPLICATION.md) closes the bounded corrected login-return journey. Real failed-password input and departure protection remain intact. Two successful UI logins returned automatically without an unload dialog, separated by explicit sign-out and browser termination/restart. Fresh report output, completed PDF and receipt JSON downloads, complete account-history/D1 parity, a fresh preview after the new login, unchanged saved-case bytes and final cleanup were independently reviewed. The second login and logout response-body capture limits remain explicit in that review; the profile-save path remains covered by handler tests rather than a separate browser edit journey.

After cleanup, the full existing web suite ran on the same clean source with Node 22.23.2 and concurrency 2: 1,157 tests total, 1,154 passed, zero failed/cancelled, and three existing opt-in historical migration checks skipped. It exited 0 at `2026-09-30T22:14:52.3420791Z`. The full log SHA256 is `f3a212efcc900489098e85ab3d8fd979825899c63c947751ec5d353f241d4934`; source-bound logs and the exit receipt remain under `.artifacts/account-confirmed-return/`. The skipped historical migration mode is not claimed as executed.

This follow-up changes only the review documents. Hosted exact-source CI, canonical reconciliation, publication and merge remain separate gates. Existing physical mobile, spoken accessibility, untagged-PDF accessibility and broader provider/production acceptance remain outside this bounded correction.
