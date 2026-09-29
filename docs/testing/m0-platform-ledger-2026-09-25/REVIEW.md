# Production migration-ledger diagnostic amendment — 25 September 2026

Intended outcome: use the owner's actual production report to establish the present schema, then read the observed Sites migration ledger without waiting for Support or changing database state.

Acceptance: preserve v94 application behavior, authorization, all 44 packaged migration/metadata files and existing audience; read only bounded schema/migration metadata; never select unknown provider values; mark unsupported, changing or truncated evidence incomplete. A successful diagnostic collection is not a migration or release approval.

## Observed production evidence

The uploaded report was captured at 2026-09-25T09:11:37.880Z, request `2b57d5b7-774b-4961-855a-0837d5440003`. Both compact JSON digests verify. All 44 matching chunks were independently retrieved from native Sites Worker logs and reconstruct exactly the uploaded report. The Worker script version is `32923b27-5d7c-44ab-9b0b-ad4ddedccc63`; legacy telemetry labels are not treated as source identity.

All 591 exact v91 schema objects match by type, name, table and SQL-definition SHA-256. No baseline object is missing or mismatched. All 36 schema objects added by corrected 0022 are absent. The only extras are the observed `__appgarden_migrations`, its automatic index, and `_cf_KV`.

This establishes a complete pre-0022 application schema at capture time. It does not establish application row preservation, migration ledger contents, physical D1 resource identity, or backup/restore capability. There is no evidence-based reason to reset or remove schema objects.

The previous diagnostic checked two other conventional ledger names. The narrow successor also recognizes the actual observed platform ledger. Native database overview exposes user tables and did not return this platform table; no table-row tool was called with an unreturned identifier.

## Amendment

Revision `m0-readonly-2026-09-25.2` discovers only this fixed ledger's bounded column metadata. A projection is composed exclusively from constant recognized migration-metadata identifiers. Unknown values, SQL text, defaults and JSON are never selected or logged. Invalid values and unknown columns remain explicit incomplete evidence. Two ledger reads detect intervening changes; two catalogue reads retain the existing schema stability check. The endpoint retains existing platform-administrator authorization, no request parameters and no D1/R2 writes.

Null values and readable empty tables remain literal observations. Neither means applied or unapplied. No automatic GO is inferred from an ID, row presence, timestamp or null.

## Verification and release boundary

The focused suite passed 12/12, including real D1, actual authorization handlers, exact row/schema preservation, unknown-value exclusion, changing-ledger detection and bounds. Strict TypeScript passed. An independent source review found no blocking authorization, privacy or write defect and independently confirmed 12/12. Build/package results and native publication identities are recorded separately after execution. The unchanged application has no new visible UI or authentication behavior. Existing C1 production and external-pilot acceptance requirements remain separate. This amendment contains no migration 0022 and makes no database backup or restore claim.

Reproduce schema comparison from the checkout root: `node --experimental-sqlite docs/testing/m0-platform-ledger-2026-09-25/compare-production-schema.mjs`. Historical uploaded bytes are preserved in `uploaded-production-report.md`; native evidence excludes request headers, IPs and credentials.
