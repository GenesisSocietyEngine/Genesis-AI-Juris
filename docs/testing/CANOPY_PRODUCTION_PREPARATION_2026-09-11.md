# Canopy production preparation — 11 September 2026

The owner requested deployment to Prod after completing Base publication in the separate Canopy acceptance Site, followed by UI/UX audit work. This request authorizes publication of the integrated software to the existing production Site. Historical no-deploy instructions in earlier checkpoints do not describe this request.

## Reconciled state

- Existing production project: `appgprj_6a88a26d2f808191aa076b9fcd8dbce6`; existing public audience and custom domain retained.
- Previous saved and successfully deployed production version: 72, source `e025131d87e35d4364d542acc5c84b6097eb657b`.
- Integrated acceptance source: `eb7e1e0aa5bfad11e85a982e0187db53b16d3a83`, acceptance version 3.
- Acceptance catalogue confirms Base 2.0.0 published at 2026-09-11T11:18:34.854Z, case `project_canopy_managed_site_expansion`, playable fingerprint `sha256-4c17139f6cf47399349aeaf27a473bbcb1429e7d6a9cc3eb0766e12ab290b31b`, Studio fingerprint `sha256-e8df94bed5cc24a4b56093b21b24101839cd7501080d01b4bfb0f1bb7e4b3702`.
- Production has its own catalogue: the read-only check returned 15 existing historical versions and no Canopy package. Application deployment does not copy acceptance records or approve outputs. Publish Base there through the normal reviewed source workflow before a production recorded run.
- The production manifest is preserved. The integration changes no D1 schema, migration SQL, journal, R2 binding, authentication configuration, or dependency lockfile.
- Production release telemetry still names version 69 and an older source. Update the two non-secret release identity fields to the returned saved version and exact pushed source when deploying.

## First audit corrections

1. `/templates` now supplies a dedicated catalogue route. Root bookmarks with an explicit library/community/help/play view override the custom domain's default Studio mode.
2. Templates links from Studio, account and matters use the dedicated route. The standalone header exposes My cases, Canopy and the community workspace.
3. In-application navigation writes browser history and listens for back/forward, including standalone Studio/play transitions. Query parameters for other context are retained.
4. Administration distinguishes case publication from subscriber announcements, explains prerequisites, and supplies section links.
5. Unavailable reset actions explain the account/sender prerequisite beside the control; account names and email addresses have separate readable lines.
6. Administration labels and regular helper text use readable sizes and phone layouts stack user actions. The standalone header uses the existing product release value rather than a hardcoded beta 0.1.0.

## Verification and boundaries

The production Worker build, TypeScript, 18-route canonical parity lock and focused source/build checks passed. Full web/API testing is recorded in the accompanying release/audit report when it finishes. Source link inspection covers nine page routes and 33 literal internal links; one is the platform-owned sign-in dispatcher, not a missing application route. This is source verification, not browser interaction evidence.

The supervised audit preview reports running, but browser commands time out. Browser clicks, back/forward, keyboard focus, 200% text enlargement, mobile layout, live sign-in, independent reviewer acceptance and a real demo recording remain unverified. Do not claim an authenticated end-to-end pass from local API fixtures. No recorded reviewer approval, account impersonation, direct live catalogue writes or acceptance-data transfer was performed.

## Audit continuation priorities

- Publish the exact Base into production through the normal owner/admin workflow; preserve a separate production dossier and participant scope.
- Check first-time ChatGPT sign-in, return to the originating Community/Studio path, cancellation and unsaved prompt retention. Source still shows separate-tab AI sign-in and some returns to `/`.
- Consolidate navigation names and organization context across Account, Organizations, Studio and Canopy. Verify all nine routes and deep links with actual browser reload and back/forward.
- Apply EN/RU consistently: the organization language selector currently does not translate the English-only Canopy and account content.
- Verify owner preparation through recorded scenarios, generated PDF/JSON, distinct reviewer action, reopening and stale-output behavior.
- Make the analytical report easy to discover in User View. PDF/DOCX text extraction remains unsupported in the media policy and must not be advertised as working AI analysis.
- Follow the existing investor-audit/demo brief. Measure the three start routes with new users; record the new 8–10 minute video only from verified live UI actions. Existing drawn demo screens are not evidence of those actions.

A successful hosting receipt establishes software deployment. It does not establish catalogue publication, live acceptance, usability timing or demo completion.
