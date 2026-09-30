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

## Remaining gates

Root independently reviewed the complete production diff and all14 actual-handler tests and found no remaining material issue. The pending guard remains protected before server confirmation, and a thrown return restores warning behavior. A named local commit precedes the new verified production build.

A fresh real Worker/browser run must exercise successful login return without the unexpected dialog, fresh report/history, UI sign-out, browser termination/relaunch, new UI login, fresh preview and the persisted full receipt. No corrected browser, unified CI, publication or merge success is claimed here yet. Existing physical mobile, spoken accessibility and broader production acceptance remain outside this bounded correction.
