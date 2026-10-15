# CaseVant development backlog and continuation instructions

Updated 15 October 2026 for the product owner and the next application, case-data and reporting contributors. Continue from the current live source and deliver one reviewed migration at a time. The shared typed example registry is implemented in the 14 October continuation slice; see its review and release receipt for measured acceptance. The auditable provenance/projection register is implemented in the next 14 October continuation slice; use its review and release receipt for measured acceptance. The projection-gap amendment and opt-in comparison/new-copy workflow are implemented in the next reviewed slice; see projection-upgrade-review-2026-10-14.md. The next substantial product work is inspectable source packets and concise reports/chronologies, alongside all-package authenticated browser acceptance.

This report complements the binding [product development instructions](CASEVANT_PRODUCT_DEVELOPMENT_INSTRUCTIONS.md). Use the instructions for detailed invariants and the acceptance matrix; use this report to select the next deliverable and its completion criteria. Repository `AGENTS.md` requires a review after every implementation step.

## Current product state

The library uses nine categories, separate topic and jurisdiction filters, fifteen cards and eighteen launch packages. Canopy is Advisory decision, with four visible scenario variants, nine document identities and fifteen retained immutable source versions. Five former simulations open as professional Studio case packages; deliberate Training simulation and legacy saved-play recovery remain available separately.

Every ordinary example opens an independent working copy through the shared Overview flow. New category assumptions are explicitly typed assumed. Converted templates exclude gameplay stamina, quotas, inactivity warnings and training termination while retaining substantive mandates, chronology, evidence and hypothetical branches. Saved historical payloads are readable without forced upgrades.

Complete Canopy reference packets now download as Markdown or JSON with selected immutable versions, retained history and exact UTF-8 text hashes, including uncited D05. These packets are separate from analytical PDFs and accepted dossier evidence. Base, Medium and Full analytical formats use current CaseVant branding. The separate governed-output renderer still needs a versioned review.

Release 124 is the verified starting baseline for this layout amendment. Its canonical web run passed 1,269 tests with zero failures and three skips. PDF CI verified 47 Full-analysis PDFs, eight Base/Medium PDFs covering 33 pages, and 22 tax PDFs. Actual authorized Chrome checks verified two independent Canopy saves, reopening, an explicitly hypothetical amendment, reassessment, stale-save refusal and a real PDF download. All eighteen packages have additional real authenticated handler coverage; this is distinct from all-package browser coverage.

The current layout amendment moves Canopy, converted cases and category cards into one shared results grid. Two Advisory decision results occupy the same desktop row and stack on narrow screens. Optional expanded Canopy guidance may use the full row. Card ordering, accessible launch controls, filtering and saved-work behavior remain unchanged. Use the accompanying [layout review](../testing/case-library-grid-review-2026-10-14.md) and final delivery receipt for this amendment's actual release evidence.

## Remaining work and execution order

| Order | Priority | Deliverable | Primary owner role |
| --- | --- | --- | --- |
| Completed implementation | P1 | Shared typed example descriptor and launcher registry | Application and case-data |
| Completed implementation | P1 | Provenance/status register and auditable projection manifest | Case-data and domain review |
| Completed implementation | P1 | Versioned projection corrections and opt-in semantic comparison/new copies | Application and case-data |
| Parallel | P1 | Repeatable authenticated browser acceptance across all packages | QA |
| Implemented reference slice | P2 | Exact original fictional-message packets and explicit document-body gaps | Content and case-data |
| Navigation delivered / reporting follow-up | P2 | Progressive record search; correct orphan Base-report disclaimer under a versioned layout | Reporting and UX |
| Separate | P2 | Versioned governed-output branding | Governed reporting and QA |
| Separate | P2 | Localized topic display mappings and small asset maintenance | Localization and application |
| Separate | P2 | Native CI diagnosis and parity evidence | Platform and QA |

### Shared example registry

Delivered implementation: `app/example-registry.ts` supplies lightweight metadata and lazy reference factories; all example callback families now use one guarded launch handler. Eighteen public packages and the hidden Canopy unavailable-clearance compatibility package have frozen bilingual source/copy-source fingerprint checks. Future registry changes must keep those locks and the all-family launch/recovery acceptance. See [registry review](../testing/example-registry-review-2026-10-14.md).

For further changes, start with `app/CaseExampleLibrary.tsx`, `app/DemoCatalogueCards.tsx`, `app/CategoryDemoCards.tsx`, `app/converted-examples.ts`, `app/canopy-fixture.ts`, the category demo modules and the launch handlers in `app/JurisApp.tsx`. Introduce descriptors for stable source identity, source version, category, bilingual presentation, optional guidance and an explicit draft factory. Migrate one example family first, review it, then migrate the others.

Acceptance: all eighteen packages retain exact source IDs, versions and unchanged-content fingerprints; every launch creates a fresh working-case ID through `createExampleWorkingCopy`; all ordinary examples use the same navigation and async ownership guards. Loading, cancellation, stale requests, changed account/epoch/draft and protected replacement cannot overwrite work. Keep one presentation grid owned by the library rather than rebuilding separate grids inside each card family.

### Provenance and projection register

Delivered implementation: Sources & evidence now offers a read-only, exact-version provenance register and a separately authorized JSON audit export. It exposes source values/hashes, original-to-graph mappings, nested conditions/effects, explicit gameplay exclusions and changed/missing/additional working records. It leaves older saved payloads and template content untouched; unrecognized versions receive no substitute. See [provenance review](../testing/provenance-register-review-2026-10-14.md).

Reviewed amendment: converted template 2.3.0 resolves ERP’s ten, GreenFire’s six, GoldenShell’s four and Desert Water’s four projection entries by retaining effect-free milestones as explicitly hypothetical records and explaining opening financial counters. All five current packages have zero unresolved projection entries in both languages. Exact 2.2.0 templates remain reproducible and their original gaps remain visible. Structural completeness does not establish domain approval. See [projection and upgrade review](../testing/projection-upgrade-review-2026-10-14.md).

For future additions, record what came from the authored source, what was converted into a task or hypothetical scenario, what was excluded as gameplay, and which statements remain assumptions or need review. Make exclusions inspectable by stable source IDs and explicit reasons. Keep synthetic source material separate from uploaded evidence and accepted anchors.

Acceptance: reviewers can trace retained evidence and branches to their source; unexplained exclusions fail validation; substantive constraint actions cannot be mistaken for training strain mechanics. Existing saved payloads and original simulation bytes remain unchanged. A status register must not manufacture professional approval from structural completeness or editorial review.

### Version comparison and opt-in upgrades

Delivered: Sources & evidence provides an opt-in semantic preview followed by an independent new copy. It never carries user amendments, tax work or approvals into the new template. The ordinary replacement/retention guard protects the original; normal Save to workspace remains separate. Cancellation, stale content/authority and unknown versions refuse replacement. Maintain the exact-version factory and historical fingerprint locks. Future work may add a separately reviewed three-way merge with explicit conflicts; do not imply such merging exists.

For future template versions, build a preview of semantic changes before a user accepts a newer example/template version. Compare assumptions, sources, options, chronology and conditions, then create a new independent copy or child version through the ordinary authorized save flow. Use `app/studio-aggregate.ts`, `app/case-integrity.ts` and existing persistence/recovery contracts rather than introducing a second importer.

Acceptance: cancellation writes nothing; old versions remain readable byte-for-byte; changed source, approval and tax-carrier relationships are explicit; stale concurrent writes fail safely. Unknown future fields or malformed records must remain recoverable rather than being normalized into apparently successful saves. Never replace an existing saved case automatically when a template changes.

### Browser acceptance coverage

Use an authorized session and isolated, clearly labelled synthetic cases. Extend representative Canopy coverage to converted and category packages. Exercise two-copy save/reopen, hypothetical changes, repeat edits, conflicts and actual downloads at desktop and narrow widths. Include EN/RU filters, empty results, sparse result counts, long labels, keyboard focus and expanded guidance.

Acceptance: capture actual URLs/state, downloaded bytes and rendered layouts; distinguish browser results from authenticated handler/platform-adapter tests. Keep test artifacts outside Git and remove only data explicitly authorized for disposal. Existing user cases, tabs and original downloads must remain untouched.

### Source packets for converted cases

Inventory available original documents or clearly labelled authored synthetic excerpts before designing exports. Extend exact version/section references only where source text exists. Missing material must remain visibly missing; do not invent external documents or silently use a later source version.

Acceptance: packet identity, selected versions, text hashes and synthetic qualifiers survive save/reopen and export. Keep the cited analytical source register and full reference packet as distinct outputs. An optional complete-packet PDF appendix is a separate report-format decision; current complete packets are Markdown/JSON.

### Concise reports and large chronologies

Design concise outputs for each professional category while preserving access to the exhaustive evidence and graph. Benchmark the ERP package before changing layout or disclosure; its exhaustive Full export can exceed 250 pages. Add searchable or progressively disclosed chronology and task views with inspectable sources.

Acceptance: summaries preserve material conditions, unresolved evidence, assumptions and hypothetical qualifiers. Full analysis remains exportable. Do not raise graph bounds, omit adverse evidence or treat a first graph outcome as a selected recommendation to shorten the report. Inspect both languages, long titles, dense tables and graph page transitions.

### Governed reporting and smaller maintenance slices

Review `app/dossier-governed-output-server.ts` under a new renderer version. Preserve historical approved artifacts and bind each newly approved output to its exact saved snapshot and independent permissions. Do not regenerate and silently replace prior approved files.

Localize topic display labels over stable taxonomy IDs; do not translate stored IDs. Test combined category/topic/jurisdiction filters and reset behavior. A bounded production sample recorded a fallback `/favicon.ico` 404; address it as a small branding/asset task with an explicit icon and verified response.

Native iOS checks require their own current run/status review. A queued or slow native job is not proof of an application defect, and web/PDF success is not native parity evidence. Diagnose runner, simulator and process-restart behavior without weakening unrelated checks or broadening a web amendment.

## Instructions for the next contributor

1. Read repository `AGENTS.md`, the detailed product instructions and the current slice's review. State the intended user outcome and measurable positive/adverse acceptance before editing.
2. Record local HEAD, dirty paths, canonical main, current live Sites version/source and ownership. Use an isolated checkout when another writer is active. Reconcile newer canonical changes and open the existing Site through the supported Sites helper before changing hosted source.
3. Create a `codex/` branch. Keep credentials in session memory and hidden stdin. Preserve the Site's current audience, D1/R2 bindings, storage schema, source IDs, approval rules and graph limits unless the chosen slice explicitly requires a reviewed migration.
4. Implement a bounded vertical slice. Keep source templates, working copies and saved-case identities distinct. Read-only browsing must not launch AI, write a save or start a simulation. After each step, inspect the diff and the changed wording, navigation, accessibility and preservation behavior.
5. Run the focused acceptance checks below. Exercise changed flows in the supported browser; inspect desktop/narrow layouts and actual exports. Repair material failures before integration. Record unavailable checks as unavailable rather than passed.
6. Commit only intended source files and review notes; exclude credentials, databases, downloads and `.artifacts`. Push promptly, create and attach an ordinary canonical PR, and integrate without force-push or bypassing required controls.
7. Build/package the exact merged commit, verify build provenance and publish the saved version through the existing Sites project. Confirm terminal deployment success, inspect the changed live flow and retain a compatible rollback target.
8. Finish with the source/version/deployment receipt, current CI status, evidence and remaining limits. Stop owned preview servers, reset viewports and update this backlog so completed work is not presented as a new development task.

## Practical verification commands

Run from the selected checkout using its installed runtime. Do not install dependencies unless missing or their inputs change.

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --experimental-sqlite --import tsx --test tests/demo-catalogue.test.ts tests/category-demos.test.ts tests/category-demo-launch.test.ts tests/converted-examples.test.ts tests/studio-overview.test.ts tests/studio-continuity.test.ts tests/studio-source-packet.test.ts tests/play-sessions.test.ts
node --experimental-sqlite --import tsx --test tests/tax-preservation-routes.test.ts
node --import tsx scripts/verify-decision-report-pdfs.ts
node scripts/build-portable.mjs
```

Choose focused tests appropriate to the change and satisfy canonical release checks. For reporting changes, also run the existing Full-analysis and tax PDF verification workflows. Review an intentional visual change before updating a lock; rerun normally without update mode and prove baseline bytes unchanged. Existing passing fixtures are not a reason to accept a missing source, incorrect statement status or clipped output.

## Release and handoff acceptance

A completed slice has implemented user behavior, reviewed preservation invariants, relevant passing checks, actual changed-flow evidence, ordinary canonical integration and an exact-source successful deployment where publishing applies. Retain the previous compatible saved version for rollback. Rollback does not repair user data: preserve failure evidence and investigate saved records before any separately authorized additive repair.

Record each future slice's owner role, acceptance, dependency, source commit, checks, release identity and unresolved issue. Start the next substantial migration with the shared registry; do not repeat the already completed Canopy packet export or Base/Medium baseline work.

## Amended continuation priorities after projection/upgrade delivery

1. Reporting/UX: benchmark ERP’s actual 254-page Full-analysis output. Design a concise decision/strategy report and searchable, progressively disclosed chronology. Preserve all source records and full export; measure retrieval time and rendered page counts. Review EN/RU and print geometry before changing any governed renderer or pixel lock.
2. Content/case-data: create inspectable packets only from available original bodies or explicitly labelled authored synthetic excerpts. Assign stable document/version/section IDs, cite exact passages, retain missing-evidence status and bump affected template versions. Do not infer review or legal approval.
3. QA/application: expand authenticated Chrome acceptance to upgraded ERP/GreenFire and all remaining packages. Two independent saved copies; reopen/edit; stale conflict; actual report downloads; narrow layout; source identity and original saved bytes unchanged. Existing representative guest acceptance and real authenticated-handler evidence must remain separately described.
4. Application/data: if users need to carry amendments forward, design three-way comparison against the exact historical template, explicit per-conflict choices, complete tax/evidence/approval carrier handling and a new saved identity. A fresh template copy is the delivered behavior, not an automatic user-edit merge.

Maintain tests/example-registry-baseline.json unchanged; new current templates need new versioned acceptance rather than replacing historical hashes. Unknown/future versions remain recoverable without source substitution. Review each slice under docs/testing and deploy only exact merged source with a native Sites receipt.

## Execution update — 15 October 2026

Latest acceptance: converted 2.4.0 packets are live in Sites v130 (PR 109, canonical 50246061e617a177036c10506da4b95cef617f2d). Historic synthetic 2.3.0 baselines 10/11 coexist with ERP copies 12/14 and GreenFire 13/15. Copies 12/13 reopened and accepted amendments. Actual packet downloads were independently hash-checked and narrow authenticated EN/RU exact-section navigation passed. Historical 2.2.0 Chrome import, account-switch browser races, remaining-package authenticated coverage and moderated retrieval timing remain open; do not substitute handler tests for those browser/user-study results.

The separate PR 110 reporting correction meets the local three-page ERP Base target in both languages, preserves full text and unchanged Full/tax locks, and extends the deliberate Base/Medium lock to 10 PDFs/39 pages. Canonical CI passed its PDF job but found a historical Base/Medium receipt test that incorrectly expected freshness after the presentation-version change. Saved Sites v131 was withheld. The follow-up corrects that expectation with both stale-historical and fresh-current checks, retaining original receipt bytes and unchanged analysis/layout bindings. Require final canonical acceptance and a follow-up native Sites receipt before marking rollout complete. Keep the remaining backlog below in that context; full user-edit merging is still conditional future work.

PR 108 delivered separate actual/minimum graph counts and progressive case-record search through Sites v129. The canonical merged web/PDF run passed on retry after a Chrome startup-port failure; no code or configuration was changed to obtain the retry result. ERP filter diagnostic p95 was 0.3131 ms for 193 records; Chrome verified exact-node navigation, narrow/Russian controls and empty results. The preserved synthetic ERP/GreenFire baselines are workspace cases 10 and 11. Reopened ERP was amended and a stale-tab save was refused. Actual saved-version Base PDF delivery was verified on disk (four pages), separately from the account receipt.

The next reviewed data slice implements converted template 2.4.0 reference packets: 58 exact original fictional message bodies, per-body UTF-8 SHA-256, stable message/section IDs, exact jumps, missing-body/premise mapping and guarded Markdown/JSON export. All 43 original evidence-document bodies remain explicitly absent; no external documents were reconstructed. Opening vs hypothetical/unreceived status remains distinct. Existing 2.2.0 and 2.3.0 factories/hashes remain frozen, and older/unknown references receive no substitute packet. See converted-source-packet-review-2026-10-15.md and its separate Sites receipt for release identity.

A four-page ERP Base export exposed an orphan disclaimer on an almost empty page before a forced Evidence/Method page break. Address this as a separate versioned decision-renderer amendment with intentional Base/Medium baseline review. Preserve all text, explicit missing-source and approval qualifiers, and unchanged Full-analysis/tax locks. Proposed acceptance: no disclaimer-only page in the ERP fixture; target at most three Base pages for that fixture, not a universal page quota. Measure and inspect both languages and long titles before publication.

Reference packets are not accepted evidence or complete uploaded-document packets. Further content work requires authentic document bodies or explicitly labelled authored synthetic excerpts with new versions; retain missing passages until then. Carrying user amendments forward remains conditional future work requiring three-way conflicts and complete carriers; the delivered flow opens independent copies and never merges edits implicitly. Historical 2.2.0 Chrome file import remains unverified; no extension permission was changed. Preserve all synthetic production cases unless disposal is explicitly authorized.
