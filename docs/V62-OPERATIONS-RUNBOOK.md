# v62 Operations and Release Runbook

## Immutable rollback

Verified public rollback target:

- Product: v61
- Sites version: 63
- Web source: `8bd10594bc01e5a45183a743396ac24b7aeaf321`
- Deployment: `appgdep_6a95f0f1a25881918a3d534044ebfd4d`
- Custom domain: `https://studio.falcon-merlin.com`

Do not overwrite, delete, or reinterpret version 63. A v62 failure rolls back by
deploying that already-saved version; it never creates a replacement rollback
version.

## Pre-save release gate

Before saving a Sites version, require one exact reviewed web head and one exact
merged mobile `main` head with:

- strict TypeScript, lint, full web tests, production build, and zero unresolved
  high/critical production dependency findings;
- all 18 route/parity paths plus import/export, malformed import, revision, case
  registry, playbook, report profile, report manifest, and layout-fixture
  parity;
- Rust format, Clippy with warnings denied, and locked workspace tests;
- Flutter format/analyze/tests plus Android and iOS packaging/lifecycle
  evidence on the same mobile source;
- Bhopal and stress PDF structure, extraction, Poppler rendering, and recorded
  human visual review;
- anonymous PDF local-only, same-tab SIWC return/save, and one-shot stale-chunk
  recovery tests;
- a clean exact-source diff and complete development records.

Any clipped or split node, ellipsized title, layer cut, connector defect,
adjacency drift, landscape page, unreadable graph, missing text alternative,
mobile mismatch, security finding, exception, or 5xx fails the gate.

## Exact-source save

1. Commit the reviewed web tree once release evidence is bound.
2. Push that exact commit to the existing Sites `main` branch using a
   short-lived per-command credential. Never persist the credential.
3. Build and package from that exact pushed SHA.
4. Save exactly one new Sites version with the exact commit and archive.
5. Record the assigned Sites version and immutable version ID.

Do not create an intermediate public deployment.

## Release identity

The current hosted environment inherited stale non-secret values from an older
release. After the new version is saved and before deployment, update only:

- `GENESIS_DEPLOYMENT_VERSION` to the newly assigned Sites version;
- `GENESIS_WEB_COMMIT` to the exact 40-character pushed web SHA.

Preserve every secret and unrelated environment value. Record the new
environment revision. The deployment is blocked until the runtime reads these
exact values and structured events carry them.

## Public approval and deployment

Because the existing Site is public, obtain fresh explicit user approval
immediately before calling the public deployment operation. Prior milestone or
coding approval is not a substitute for this final confirmation.

Deploy only the saved exact-SHA version and poll until the platform returns
`succeeded`. If it fails or remains nonterminal beyond the bounded release
window, stop and preserve version 63.

## Production verification

On both the Sites URL and custom domain, verify:

1. access policy remains public and custom-domain SSL is active;
2. document marker is exactly `v62`;
3. runtime identity is the assigned Site version and exact web SHA;
4. public pages, catalogue, assets, expected anonymous identity probes, and
   deliberate 404 return only expected statuses and security headers;
5. an anonymous Bhopal report downloads locally with no authenticated API call;
6. every PDF MediaBox is A4 portrait, titles wrap, nodes remain whole, paired
   connector continuity is readable, and the complete text alternative
   extracts;
7. same-tab SIWC returns to the original Studio draft and an exact workspace
   save succeeds;
8. stale-chunk recovery reloads at most once and fails visibly rather than
   looping;
9. Worker logs contain no exception, 5xx, D1 busy/timeout/internal failure,
   replay failure, or privacy-unsafe field; expected anonymous 401 events are
   classified as successful expected behavior.

## Rollback

If any post-deployment gate fails:

1. deploy saved Site version 63;
2. wait for `succeeded`;
3. verify custom-domain marker `v61`, source `8bd10594...`, active SSL, and
   green Worker logs;
4. record the failed v62 gate and rollback receipt;
5. do not describe v62 as shipped and do not save a second v62 version merely
   to repeat verification.

## Stop condition

After one verified successful v62 deployment, record final source, archive,
version, deployment, mobile CI, PDF, auth-save, and observability receipts.
Then stop. No duplicate Sites version, redeployment, app-store distribution, or
next milestone is authorized.
