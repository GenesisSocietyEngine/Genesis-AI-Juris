# Original-application fixture preparation: preserve bindings and source packets

## Outcome and demonstrated cause

Before extending historical import/export acceptance, stop the local QA runner from manufacturing stale tax source bindings or losing example provenance when adding QA labels. This changes tooling and tests only; no production case, archive, factory, application handler, policy or SDK is changed.

The previous full-tax input renamed web_tax_contract to qa_original_v149_full_tax_en, changed its title and added a manual node position, but retained the original tax source fingerprintdc19c89b…. Independent source derivation yields cef6c0cc… for that modified draft. Shape-only aggregate preflight cannot establish the outer case binding. The original fixture derives the original descriptor exactly. All prior files remain retained; the stale tax input was not imported or saved as acceptance.

Self-review also finds the five non-tax factory drafts have no exampleSource reference before QA renaming. Simply renaming them loses packet recognition. Preparation now classifies the complete original aggregate before any normalizer, then uses the existing example working-copy contract to pin exact source case/version/fingerprint before assigning the synthetic identity/title/manual placement. Historical ERP2.2 provenance and Canopy's selected nine-document packet remain inspectable in regression tests. No current-template substitution or source-factory edit is introduced.

## Bounded implementation

`preparePublishedStudioFixture` retains the whole known bound tax draft unchanged and independently derives its source descriptor. Stale identity/title/position bindings and unsupported carriers fail before a new fixture file is written; there is no silent rebind. Unknown aggregate fields refuse before the standard working-copy normalizer can discard them. Non-tax fixtures use separate manual placement and retain source references. Synthetic labels live in the external manifest for the unchanged tax draft.

Manifest draftVersion, templateVersion, sourceReference and envelopeVersion are distinct. The full-tax raw draft is1.2.3 with no example template/envelope version; it is not mislabelled as a1.2.3 example template. Each fixture has exact bytes/SHA256. The original saved application version149/sourcebcd50f3 and archive hashes remain separate from these fixture versions.

Nine focused inspector/fixture regressions pass with zero failures/skips. They cover archived-byte/path safety, exact tax draft/carrier preservation, stale case/title/manual-position refusal, unsupported/unknown refusal, historical source recognition, Canopy packet availability and unchanged originals. Strict TypeScript and changed-file ESLint pass. These controls do not replace original-browser round trips.

## Actual original Worker execution

Final local execution uses the unchanged570-file, hash-verified original v149 Worker/client and isolated D1/R2 at127.0.0.2:4175, with outbound requests denied and no production bindings. Its new execution directory is `.artifacts/original-v149-20261020-a/local-execution-2026-10-21T14-37-16.892Z` in the release checkout. [Derived receipt](receipts/published-fixture-binding-2026-10-21.json) retains exact original artifact identities, fixture hashes and the original execution-receipt hash.

All six prepared fixture files are verified. Five have pinned source references and manual positions. Full-tax retains case_id web_tax_contract and the exact original carrier document; all earlier bad/intermediate files remain unmodified. Actual original Worker owner recovery200, foreign404, exact raw recovery hash and zero case/draft/audit writes across those recovery requests pass again, as do initial archived client asset bytes/MIME checks. This is actual original Worker execution with current generated input, not a same-source rebuild, browser import or new-copy/save acceptance.

The earlier supported Chrome chooser and download waits returned no file/path. Original EN/RU browser import/export, full carrier round trips, tax guarded editing/recalculation, historical coexistence, saved variants and production account/source timing races remain open. Preserve all existing cases and the sleeping stale writer. Public v160 application inputcdf8a1bf… and hosting input20c4899d… remain unchanged; no duplicate Sites version is warranted for this QA-only slice. Canonical native integration371b0f4 and the amended continuation PR178 remain separate review/check identities.
