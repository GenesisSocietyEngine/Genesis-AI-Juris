# CaseVant production migration review

Task owner: this isolated Sites checkout. Initial dirty paths: none.
Canonical PR #90 reviewed exact head: 46c198a0b2cff7975c31d4611d363ad83931b43a; canonical main at review: 6e5497170877151515a9b4405f36cb5cf91b286d.
Actual existing production: v112, source 91edf30fc69083b990f65f16a7b72a81edc7e1b1, deployment appgdep_6ac3ca68a3988191a02b3f24e68e04d5, environment revision 42, public audience. v109 in the request was stale.

## Acceptance and reconciliation

Use the specified PR source, preserve v112's newer CaseVant training package, and fix scoped migration defects before publication. Resolve duplicate history against PR source plus the reviewed training commit, not by reverting current training. Exact deployment SHA will be a successor containing both inputs.

PR's Web/PDF run 37482113872 failed the dependency audit: source-map-js 1.2.1, GHSA-68fv-2mgg-jv7q. All earlier web/build/typecheck/lint, packaged Rust/tax-worker checks and PDF visual job passed on that exact original head. Do not claim that head is green. Patch the vulnerable transitive dependency to 1.2.2 and rerun gates on the successor.

Scoped additions: fixed-apex www redirect; direct text/XML crawler responses; account root and private query exclusions; X-Robots-Tag on private surfaces; distinct public canonical and Open Graph URLs. Keep page-specific noindex. Preserve all D1/R2 declarations and historical migrations, environment entries/secrets, auth configuration, audience and live data. No new schema migration.

## Domain baseline

Apex and studio.falcon-merlin.com active with active TLS on existing Site. www initially served Apache outside Sites. Registered www on the same project; DNS validation pending. No custom-domain redirect setting is exposed by available Sites tools; application redirect is implemented without changing auth handlers.

## Validation

The fresh audit also found sharp 0.35.4 / GHSA-wq5f-xc86-pv6w. Pin sharp 0.35.5 for Next and Miniflare; retain all existing top-level framework/tooling versions. Full and production audits now report zero vulnerabilities. Focused SEO/host/training/domain checks passed all 22 tests. Full exact-source gates remain pending.

Pending successor checks and production verification. No release-gate bypass authorized or attempted.

## Full-suite findings

The first full run passed 1198 tests, skipped 3, and failed 2 stale training filename assertions. Update both tests to require the preserved v112 CaseVant captions and transcript, verify all current media assets, and retain legacy-media availability checks. No assertion is removed or disabled. Packaged Worker checks passed for all four public self-canonicals, real crawler text/XML, six private pages with both metadata and header noindex, and the fixed-apex 308. Hosted Windows PDF validation passed all 47 approved baselines and tax-v2 PDFs on the reconciled source tree. Rerun the complete suite on the test reconciliation commit before publication.
