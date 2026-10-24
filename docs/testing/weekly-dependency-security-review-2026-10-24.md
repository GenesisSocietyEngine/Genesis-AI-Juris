# Weekly release security amendment — 24 October 2026

## Release hold and exact scope

PR184 integrates portable Markdown/device-recovery handoffs at4107902d0837554eb471a4aeea40aae5bec35ad1 after both candidate web/PDF runs pass1790/0/3. Its exact-main run40065587742 passes tests/build, packaged verification and the separate PDF visual job, then fails the complete dependency audit on24October05:22UTC. Retain .artifacts/weekly-main-4107902-failed.log. This failed release candidate is not published; current public Site remains161 until a later explicit receipt.

The previous23October audit reported zero vulnerabilities. That is a dated registry observation, not evidence to override a subsequent failure. Current findings are fast-uri moderate advisories, undici moderate/high advisories and a high zod advisory, with transitive Cloudflare-tool findings included in the reported total6 (4moderate/2high). Do not equate this dependency-tree result with demonstrated exploitation of the hosted application.

## Upstream checks and bounded correction

Verified official advisory pages identify patched same-major releases: [fast-uri3.1.9](https://github.com/advisories/GHSA-w74x-v6f9-j3xg), [undici7.30.1](https://github.com/advisories/GHSA-4qv8-2p9j-2685), and [zod4.6.6](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). npm registry independently confirms these versions. Existing paths are ajv/schema-utils/webpack→fast-uri3.1.8; the existing Miniflare override→undici7.29.1; eslint-plugin-react-hooks/zod-validation-error→zod4.4.3.

Advance existing fast-uri and Miniflare/undici overrides and add a pinned zod4.6.6 override; update only their resolved lockfile entries. Retain Node22.23.2/npm10.9.8, Next/lint16.4.2 and Cloudflare/Vite/Wrangler versions. Run the exact pinned installer with ignore-scripts. No audit suppression, threshold relaxation, force upgrade, Cloudflare downgrade, case/schema/template/authority/storage change. All fresh full/production audits and existing web/PDF/Worker gates must pass for the amended candidate and exact-main build before publication.

## Review and acceptance boundary

Source installation/diff review, strict types and both fresh audits establish the local checkpoint; exact CI/source/build/archive/Sites receipts establish any later rollout. No new Site or environment mutation. Keep every prior saved case, synthetic case and original compatibility artifact. This security amendment does not close actual browser download-byte acceptance, native cold-first/padding investigation or human/operator commercial-readiness gates.
