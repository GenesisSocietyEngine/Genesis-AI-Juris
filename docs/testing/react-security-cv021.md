# CV-021 · React security release blocker

On 11 November 2026, CV-020 PR #289 merged with 18/18 checks passed as `bebc1bc657a64a7ee2da0290b4ea3c74f77eec4b`. Native run 42928300685 first exited 124 during its 300-second write phase while connecting the Flutter driver; it reported no application assertion failure. Its paired run passed, and retrying only the failed job on the unchanged commit passed. No assertions or deadlines changed.

Exact-main run 42938033556 completed the web tests with zero failures, and its PDF visual job passed. The full dependency audit then flagged critical [GHSA-xqc2-xf4c-x3h3](https://github.com/advisories/GHSA-xqc2-xf4c-x3h3) in `react-server-dom-webpack` 19.2.8. The advisory was published to the GitHub Advisory Database on 10 November. Publication stopped before any version was saved or deployed; v211 remains live. This is a dependency finding, not evidence of exploitation.

The upstream [19.2.9 release](https://github.com/react/react/releases/tag/v19.2.9) supplies the backported fix. Official npm metadata requires matching React/React DOM ^19.2.9; Vinext 1.0.0-beta.8 accepts those versions. The candidate pins all three packages to 19.2.9 and regenerates the lockfile without mutating the shared local node_modules junction. `npm audit --package-lock-only --audit-level=low` reports zero vulnerabilities. The patched installed runtime must pass CI and the exact-main build before publication; local tests using the pre-existing junction are not claimed as patched-runtime acceptance.

After release, verify CV-020 document links on the signed-in EN/RU site, then perform the requested UI/UX/design audit and color-accent iteration. Keep security, document-target acceptance and visual changes separately evidenced.

## Published acceptance · v212

PR #290 passed all 18 checks and merged as `c2213aab4531b5a9f2dec1d02c46d7598cca8a03`. Exact-main build 42943780736 passed the complete web/PDF checks, packaged browser/Worker verification and dependency audits. v212 deployed successfully with environment revision 42 unchanged; both origins verified all 274 assets. Signed-in EN/RU activity-to-document, reload, missing-target and organization-denial checks passed. [Receipt](receipts/document-links-v212.json). CV-021 is closed; the requested visual audit follows as CV-022.
