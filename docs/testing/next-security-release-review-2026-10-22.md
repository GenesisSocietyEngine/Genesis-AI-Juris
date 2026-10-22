# Release dependency gate — 22 October 2026

## Trigger and bounded amendment

The ordinary web-only PR181 merge is5b3d33e52a81fc39cd7bb16da6f49fc3388c6e2b. Its exact-main39832569968 completes web tests, packaged browser/Worker tax execution and PDF visual locks, but fails npm's complete-tree audit at2026-10-22T18:41:18Z: Next16.3.8 is now classified with critical advisories. Earlier candidate runs passed their morning audit; these are dated observations, not a current security pass. The prepared5b3d33e archive is retained and must not be published.

Verified primary advisories identify affected16.0.0–16.4.0 and patched16.4.1:

- [Image optimization / SVG advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw).
- [App Router Server Actions denial of service](https://github.com/advisories/GHSA-p3m5-59mp-jv5r).
- [Typed-array use-cache advisory](https://github.com/advisories/GHSA-673q-mjm6-r5xr).

The official npm registry confirms Next16.4.2 and eslint-config-next16.4.2. Pin both exactly, retain React19.2.8/Node22.23.2/npm10.9.8 and existing explicit overrides, and review the lock delta. Do not run audit-fix --force, alter audit severity, suppress an advisory or infer exploitability/non-exploitability solely from using Vinext. No auth/storage/schema/template/user-case change belongs in this security slice.

## Release acceptance

Require complete and production dependency audits, full candidate and exact-main web/PDF gates, existing historical/authority/export tests and exact-source production Worker checks. Rebuild/package the amended merged source, not the superseded5b3d33e archive. Preserve v160's immediate previous-client assets and refresh Sites environment/audience before publication. Record native saved-version/archive/deployment/environment receipts and both-origin byte/MIME checks. Source integration is not production deployment.

The unchanged43missing-original disclosures, historical factory hashes, complete254-page Full report, all PDF locks, saved/synthetic cases and protected unsaved tabs remain mandatory. Browser download-event timeouts and the incomplete cold-first native investigation remain separate limits, not reasons to bypass this release gate.

Local amendment validation: npm10.9.8 installs the two exact16.4.2 pins with lifecycle scripts disabled; five packages change. Fresh complete and production audits each report zero vulnerabilities at every severity. These local audit results are not a substitute for the fresh candidate and exact-main release workflows.

## Other evidence retained during preparation

The v149-only archive inspector rejects v160's three standard PAX path/time headers. The original raw v160 package still matches4f0c0afe3916b6719193fa4ebabebebb449befd309a930d0f078cff1e8f2d1b3/30382123bytes and native source/archive receipt. A separate one-time stdlib reader prevalidates all578entries, permits only inspected path/decimal-mtime metadata, rejects links/special files/unsafe or duplicate paths, detaches all bytes before writing new output and executes nothing. Original archive and inspector remain unchanged. Existing retention then verifies136previous current-manifest assets, copies51distinct immutable assets and validates186combined assets for5b3d33e. Final amended source needs its own rebuilt retention check.

The installed plugin build wrapper resolves a nonexistent checkout-local npm CLI. The existing equivalent scripts/build-portable.mjs completes under pinned Node without modifying application inputs. Preserve the failed wrapper log and successful build log separately. The final source/helper package must reflect the amended security pins and its own source digest.
