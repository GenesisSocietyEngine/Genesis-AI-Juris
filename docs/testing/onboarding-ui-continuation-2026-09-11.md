# Onboarding and report UI continuation — 11 September 2026

This change continues production Site 74 (`e53e9129201360b55a995eb5658d12497f340da4`). It keeps the existing Site, database schema, identities, roles, catalogue and approval workflows.

The main problem was losing a task while moving to authentication, compounded by inconsistent navigation and late report discovery. The change adds same-tab sign-in with a bounded, expiring continuation for eligible local drafts; an Account start path with optional password setup; shared navigation and locale preferences; explicit example/import/prompt starts; persistent import errors; and a visible preliminary report action with a PDF preview. Canopy can open the exact synthetic Base in Studio without a second file search. The server still authorizes each operation independently.

Temporary sign-in storage excludes server-owned, private, protected and inspection-only drafts. The continuation accepts only the originating account scope, except for an explicitly anonymous local draft being claimed in the same tab; it expires after 15 minutes and is consumed once. It contains no credentials. Return URLs accept only known same-origin application pages.

`scripts/build-canopy-preliminary-example.ts` creates an unapproved synthetic PDF using the application renderer, the exact canonical Base file and a local report model. It has no database or identity capabilities. Its provenance explicitly distinguishes the Studio, playable and publication-review fingerprints. The report is not an executed Canopy result or a governed production JSON export.

Focused regression coverage is in `tests/onboarding-continuation.test.ts`. Existing navigation source assertions are updated to check the shared navigation and contextual return route. ERP/Canopy authorization, publication, exact-output approval and staleness tests remain unchanged. Build includes TypeScript and the canonical 18-route contract lock. The user-facing release receipt contains final test results and hosting IDs; this change does not claim separate GitHub/native CI.

Live browser inspection is blocked by repeated connection timeouts, including the supervised preview. Therefore the 120-second cold-start target, first report within five minutes, cancellation/refresh/back in a browser, narrow-screen/focus behaviour, real AI generation, distinct live reviewer and real MP4 remain unverified. Prepared narration and measurement sheets do not count as recorded video. Existing Help video/poster/duration are retained until a real replacement has been verified.

Production and Acceptance have separate catalogues. The exact Base was published in Acceptance. It must be published through normal authorized Studio controls in production before a production recorded run; this code does not seed catalogue rows, copy private dossiers or manufacture approvals.

Rollback: the previous production archive is Site 74. This UI change introduces no migration. A rollout can be reversed by deploying that saved version and restoring its deployment/source telemetry labels. Do not undo any legitimate user activity completed after rollout.
