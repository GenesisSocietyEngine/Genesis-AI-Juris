# Web production rollout — 29 September 2026

**Published:** version 103 at 15:16:07 UTC (17:16:07 Europe/Paris), following the user's explicit instruction to roll the reviewed amendment into production.

- Live domain: https://studio.falcon-merlin.com — active domain and SSL, unchanged public audience.
- Source: `ddb61267c9d4368b3d1cb654a8d3a5c989bddf69`; application/configuration inputs match tested `c86c83bd6dc62c5eee2ae825272e65e3821e7aa5`. The 37 intervening changed paths are documentation only.
- Version: `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_b2ed5f44ca108191ade10ddacd16025a`.
- Deployment: `appgdep_6abbd4eccd6c8191b44e4e0cb7ab4169`, provider status `succeeded`, environment revision 40.
- Provider-built archive: SHA256 `80304c98b0eb31cb4d4a665e8ddef7518095404c9e8c234565fe33369479e22f`, 37,724,160 bytes, 410 files.
- Evidence: [machine-readable provider/source receipt](WEB_PRODUCTION_ROLLOUT.json). No separate live browser smoke or hosted binary attestation is claimed.

Local dependency preparation failed with curl exit 28 (proxy timeout). The normal Site workflow pushed and read back exact source, then local packaging failed because no build output existed. The supported source-only deployment fallback built the saved source remotely and succeeded. The later version readback contains its provider-created archive; no local archive was substituted.

The existing password-reset sender was reused for invitation mail; the existing provider secret and canonical HTTPS origin were preserved. Only invitation sender/enablement and version/source labels changed. Configuration sends no email or creates membership. Actual provider acceptance, delivery and recipient mailbox verification have not been exercised; no test messages were sent.

Migration 0023 is the only new SQL migration: two tables, four indexes and four triggers, with earlier SQL unchanged. The Sites persistence workflow documents applying/recording migrations individually before Worker upload. Deployment succeeded through that workflow. Separate live journal/schema inspection, physical-resource attestation and hosted restore rehearsal remain unverified. Do not rewrite applied migrations or assume code rollback reverses schema/data; preserve partial-application evidence if a later deployment fails.

**Correction to earlier schema wording:** the database tool returned 50 alphabetically early table names and reported zero projection omissions, but even known older tables were outside that list. The returned list does not independently establish an exhaustive inventory; absence of invitation tables from it was not proof that they were absent from the database.

Android emulator readiness and the separate iOS CI timeout remain mobile verification issues, not reproduced web-runtime defects. The previously recorded exact-source web/PR checks remain valid; this publication does not convert the blocked full local aggregate into a pass.

Full hosted UX/accessibility acceptance, recovery evidence and five-participant human validation remain open. No external-pilot GO is claimed. Tax Economics v2 remains a standalone calculation library; its native/Flutter/web integration plan is unchanged.

The current production interface now comes from the amended source: Account continuation/layout, report amendments, organization recovery, contrast corrections and the email-first invitation interface. Member-ID compatibility controls remain within their intended legacy disclosures. Earlier v102/no-deployment statements remain dated pre-rollout history.
