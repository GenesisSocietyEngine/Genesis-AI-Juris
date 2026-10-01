# Miniflare synchronous binding correction

The intended outcome is reliable local and CI execution of the existing D1-backed application checks. Synchronous binding calls must consume the response for their own request, even if the background worker is preempted. Existing application assertions, export audits and iOS application checks remain enabled.

This is a dependency correction, not new tax functionality or acceptance evidence. The isolated branch starts at `54d6d29868db0fe0fa4c570d89571cbfcd55ed18`. At creation, local HEAD and cached `origin/main` matched; a fresh fetch failed DNS resolution. Root subsequently verified current canonical main through the GitHub connector and confirmed the same SHA. Exact candidate CI remains pending.

## Finding and bounded change

PR72's web checks failed in two different D1-backed suites: a first application-level 503 was followed by repeated `SynchronousFetcher.fetch` message-ID assertions. The exact `7d6cd91fddec6d7cb706758b0afd8034546bd94b` push passed; separate main `54d6d29868db0fe0fa4c570d89571cbfcd55ed18` passed with identical web/report files. These are distinct source identities. These observations alone did not establish the cause of the initial 503.

Cloudflare's merged [PR15552](https://github.com/cloudflare/workers-sdk/pull/15552) identifies the exact bridge defect present in the pinned Miniflare: a delayed notification for an earlier request can wake the next request before its response is queued. Subsequent responses become misaligned. The [merged correction and regression](https://github.com/cloudflare/workers-sdk/commit/6f3d7b58b1f6cd036aca3e5946807bba37776065) use a request generation and recheck it after each wake. The fix does not weaken the message-ID assertion.

The earliest published matching set is:

| Package | Before | Corrected |
| --- | --- | --- |
| `@cloudflare/vite-plugin` | 1.54.8 | 1.54.11 |
| `wrangler` | 4.131.1 | 4.133.0 |
| `@cloudflare/workers-types` | 5.20260911.1 | 5.20260916.1 |
| Transitive `miniflare` | 5.20260911.0-alpha | 5.20260916.0-alpha |
| Transitive `workerd` | 1.20260911.1 | 1.20260916.1 |

Official release notes link the correction in [Miniflare](https://github.com/cloudflare/workers-sdk/releases/tag/miniflare%405.20260916.0-alpha), [Wrangler](https://github.com/cloudflare/workers-sdk/releases/tag/wrangler%404.133.0) and the [Vite plugin](https://github.com/cloudflare/workers-sdk/releases/tag/%40cloudflare/vite-plugin%401.54.11). The plugin and Wrangler pin the same Miniflare/workerd versions; the Workers types change satisfies Wrangler's matching peer range. Existing Vite 8.2.2 and Node 22.23.2 meet the published requirements. The existing `undici` 7.29.1 override is retained.

## Review evidence and limits

Primary GitHub source, package metadata and npm tarballs are retained under root `.artifacts/miniflare-upstream-research/`. Tarballs for Miniflare 5.20260911.0-alpha, 5.20260915.0-alpha and 5.20260916.0-alpha passed both published SHA512 integrity and SHA1 checks. Inspection found the generation wait only in the September 16 package. Its tarball SHA256 is `ee5939819df02f47525bbc2e8a1983e455dd649787cc751739531faa52478d4a`; the bundled index SHA256 is `5a18ce002daa1f50d5d4589dfc6c1a963c54fcbb3d660ac2e1ddb249b94a81b9`.

The correction uses published matching packages. No application source, custom vendor patch, transitive-only override, retry policy, test assertion or CI concurrency setting is changed. Lock generation uses pinned Node 22.23.2/npm 10.9.8 and a task-local cache. npm's initial generation changed 31 unrelated metadata entries (`dev` flags and Next platform `libc` fields); those unchanged-package entries were restored from the base, and the initial graph is retained separately. The final 737-entry graph changes only root pins and ten intended Cloudflare package nodes, with no package added or removed. Independent review verified dependency ranges, integrity, unchanged scripts/overrides and the entire installed Miniflare index against the retained tarball.

The independent deterministic protocol control runs the pinned receive block and exact upstream `receiveReply` with the upstream real Worker/MessageChannel regression. The pinned block fails its message-ID assertion after one confirmed stale wake; the corrected block absorbs two stale wakes and receives request 1's complete expected response. This establishes the bridge defect and correction, not a replay of the initiating CI schedule or the first 503. Root artifacts `probe-receive.mjs`, `probe-run.log` and `probe-receipt.json` retain the control.

Fresh isolated `npm ci` passed (527 packages) and preserved lock SHA256 `d4a3f6e0aa14116221383cb745816d1663554ff3326091c23b72da6fd2e1b968`. Full and production-only npm audits both passed with zero vulnerabilities. Logs and full graph comparisons are retained in this worktree's `.artifacts/`.

The existing verified build passed: strict TypeScript, generated Rust runtime/native corpus verification, both migration breakpoint controls, the 18-route mobile parity lock, and all five Vite/Vinext production build stages. This local run used the uncommitted correction on the recorded base; its receipt does not label base main as corrected-source evidence.

The unchanged P1 organization/ERP and email-invitation suites passed all 40 tests (34 top-level, six nested Canopy controls), with no skipped or cancelled tests, in 527.4 seconds. This includes all four Canopy scenarios, the causal walkthrough and blocked/unavailable runtime controls. The retained log is `.artifacts/focused-d1-tests.log`; local execution used test concurrency 2, without changing CI settings.

At this checkpoint, broader suites, actual packaged browser/Worker execution, PDF checks and exact-head CI remain pending. No fresh application journey or iOS result is claimed here.
