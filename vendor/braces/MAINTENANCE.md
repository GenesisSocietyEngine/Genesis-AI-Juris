# Local braces maintenance fork

This private `@casevant/braces` package is copied from the MIT-licensed npm `braces@3.0.3` package (upstream: https://github.com/micromatch/braces). The original copyright and license are retained in LICENSE. It is resolved under the dependency key `braces` through the root npm override; it is not an upstream release.

Reason: GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 affects recursive walkers with no nesting limit. As checked on 2026-10-05, the upstream registry and advisory have no fixed release. References: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm and https://github.com/micromatch/braces/issues/70.

Patch: `lib/depth.js` supplies a fixed limit. `parse.js` checks all brace and parenthesis container pushes before construction (escaped, bracketed and quoted literals retain upstream handling). `compile.js`, `expand.js` and `stringify.js` independently guard recursive AST traversal, including AST input supplied directly. The parser accepts at most 100 nested containers; walkers also allow their leaf node. Exceeding the bound throws a controlled SyntaxError before stack exhaustion. Options cannot raise or disable this security bound. Other upstream code is unchanged.

Validation lives in `tests/braces-security.test.ts` and executes both the local module and the actual module resolved by micromatch. Normal glob/range behavior and deep string/AST rejection are covered; root lint/build/tests and full/production dependency audits remain enabled.

Removal: when an upstream release fixes this advisory with equivalent parser/AST protections, replace the override with that release, rerun the security tests and full CI, then remove this maintenance fork. Do not rename an unpatched dependency to silence audit results.
