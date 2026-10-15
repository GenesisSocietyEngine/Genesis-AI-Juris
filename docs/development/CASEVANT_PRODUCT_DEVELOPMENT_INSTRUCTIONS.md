# CaseVant product development instructions

Prepared 13 October 2026 following the elevated case-library audit. This is the implementation and acceptance playbook for subsequent work; proposed backlog items below are not claims of delivered features. Follow the current repository AGENTS.md and record each slice's review in docs/testing/.

Execution update, 14 October 2026: the immediate remaining audit work now includes an implemented complete Canopy reference-packet download (Markdown/JSON, nine selected document versions plus all retained history and exact UTF-8 SHA-256 hashes), a separate eight-PDF/33-page Base/Medium visual cohort, and actual signed-in production browser acceptance with independent synthetic copies, hypothetical amendments, stale-save rejection and real PDF download. See `docs/testing/case-library-remaining-work-audit-2026-10-14.md` for measured coverage and the delivery receipt for final release/CI identity. These changes do not complete the broader proposed development backlog below.

## 1. Product outcome and vocabulary

Build a professional decision workspace in which a user can identify the mandate, inspect source-level support, separate facts from assumptions, compare options, test hypothetical changes, save a durable case and export an appropriately qualified decision package. Training is a deliberate ninth category, not the default professional experience.

Use exactly the nine registered category IDs. Labels come from the registry/playbook/presentation modules, not independently copied strings:

| Category ID | Public category | Typical output |
| --- | --- | --- |
| general_advisory | Advisory decision | Decision memorandum |
| litigation_strategy | Litigation strategy | Strategy and risk report |
| contract_review | Contract review | Redline and risk report |
| tax_planning | Tax planning | Tax position memorandum |
| compliance | Compliance assessment | Gap and remediation plan |
| tax_compliance | Tax & compliance | Tax position memorandum |
| erp_incident | ERP incident & solution | Solution design & test pack |
| investigation | Investigation | Findings and chronology report |
| training_simulation | Training simulation | Playable scenario and debrief |

Verify the current playbook when implementing output wording. Keep topics, jurisdiction, category and optional guidance as separate dimensions. Do not classify a supplier dispute as a technical ERP incident merely because ERP appears in its title. Canopy is Advisory decision; its featured badge does not introduce a new type or confer approval.

The library currently has fifteen cards but eighteen launch packages: five converted packages, one Canopy card with four variants, and nine category examples. Test packages as well as cards. Training simulation remains playable only when the user deliberately enters its Test/Play flow.

## 2. Start every work slice from verified state

1. Read AGENTS.md and applicable instructions below the files being changed. Record intended user outcome and measurable acceptance criteria before editing.
2. Record local HEAD, canonical main, dirty paths, ownership and current live Sites version/source. Use an isolated checkout if another writer is active. Never stage another session's changes.
3. For hosted changes, use the supported Sites source-opening helper and the existing project ID from .openai/hosting.json. Verify the deployed commit before editing. A clean local checkout alone does not prove parity with production.
4. Reconcile newer canonical changes before implementation. Do not develop from an old uploaded archive or silently replace newer main.
5. Create a codex/ task branch. Keep dependency, storage and audience changes explicit. Do not change unrelated native code or historical fixture locks to obtain a web release.

The selected production site is https://casevant.pro; the existing native Sites URL is https://genesis-juris-web.maxim-hayan.chatgpt.site. Site identity and credentials must be read from current configuration/tool responses, never guessed. DB and DOSSIER_DOCUMENTS are existing storage bindings. Refresh current environment/access state for any future release; do not assume revision 42 forever.

## 3. Source templates and working copies

Maintain three distinct identities:

- A stable reference source case ID and authored source version.
- A versioned template fingerprint, including semantic statement status and retained source references.
- A fresh working-case ID for each launch, owned and saved through the ordinary authorized case API.

All built-in example launchers must use createExampleWorkingCopy. Two launches of the same reference must have different caseId values and retain the same exact exampleSource identity for unchanged template content. A builder returning a new JavaScript object is insufficient: a fixed database identity can still collide with prior user work. Do not reuse a template ID as an editable save key. Do not apply this trusted-template copy helper to arbitrary protected user cases; use the existing authorized child/duplicate workflow for those.

Version substantive template changes. The elevated-audit corrections create converted version 2.2.0 and category-example version 1.1.0; previous 2.0.0/2.1.0/1.0.0 saved payloads remain historical user work. Never silently regenerate or upgrade them on read, reopen, locale switching or library navigation. An optional future upgrade must preview a diff and produce a separate version/copy with explicit user acceptance.

Use the shared Overview entry transition for all built-in examples. Blank drafts start on Brief. Browsing the library must not create, replace or save a case, run AI or execute a simulation. Opening an example is not a confirmed save. Show account-backed success only after the verified server receipt; preserve exact My cases and saved-case navigation identifiers.

Keep preparation lazy. Before installing an asynchronously prepared draft, verify the request generation, navigation/context, account scope, session epoch and original draft identity. Cancellation, account switching, changed draft, newer launch or departed navigation must invalidate the response. Do not remove the second replacement/operation check after awaiting a loader. Failed or stale completion must not clear another request's state or overwrite current work.

## 4. Content and migration invariants

Use source-level records for support, not numeric evidence scores. Preserve all substantive actor/fact/evidence IDs, authored options, logical conditions, legitimate cost/time assumptions and legal/procedural branches. Retain the original simulation bundle and its fingerprint for saved-play recovery. Exclusion from a professional projection does not authorize deletion from canonical simulation data.

For every new or amended template, provide:

1. A mandate, decision owner, jurisdiction and required output.
2. A source register with exact identifiers, availability and provenance limitations.
3. Explicit asserted/assumed/disputed or unresolved statements, with contradictions and missing support.
4. Competing options, conditions, hypothetical consequences and rationale.
5. Chronology/tasks with owners and dates subject to verification.
6. A connected map and category-appropriate report outline.

Set factStatus explicitly on newly authored assumptions. An unresolved assumption must not inherit the legacy asserted default. Preserve legacy omitted fields and their exact fingerprint on read; change newly generated templates rather than rewriting stored cases. Asserted means a recorded statement, not independently verified truth. Editorial/source/template review and professional approval are separate states.

Convert simulated judgments, notices, acquired evidence and completed tasks into explicitly hypothetical/unrecorded records. Do not promote a branch consequence to an actual event or accepted evidence. Relative scenario dates require a confirmed anchor and verified jurisdiction-specific rules before operational scheduling. Monetary amounts are assumptions with provenance and units; they are not recorded payments or authoritative awards.

Exclude stamina, fatigue, numeric trust/position/evidence scores, quotas and inactivity punishment from professional templates. The ERP inactivity correspondence and termination outcome are excluded in 2.2.0; their original records remain in the legacy simulation. Maintain an auditable exclusion policy and tests for preserved substantive content. Never broadly delete every unfavorable outcome: dismissal, missed legal deadlines and adverse findings can be legitimate hypothetical professional scenarios.

Inspect unknown source effect/condition types before adding a migration. A generic fallback sentence does not establish semantic fidelity. Classify every effect as retained, explicitly hypothetical, intentionally training-only or unsupported requiring review. Test exact operands/IDs and nested all/any/not logic. Keep long conditions in linked assumed records; do not truncate their text, increase the 200-node/500-link limits or weaken report layout validators to make an import pass.

Source descriptions are not document bodies. Do not invent missing originals. Canopy retains nine document identities, fifteen immutable versions and four variants. Resolve the cited version and section; a later document must not silently substitute for the cited one. Synthetic S1/S2 category excerpts remain visibly synthetic. No source presence, graph connection or example badge implies human acceptance.

## 5. Saved work, authority and recovery

Keep server authorization, session scope, copy protection and SQL compare-and-swap checks authoritative. Do not make optimistic UI state a substitute for server persistence. Preserve malformed/future stored carriers for authorized recovery rather than normalizing them into a successful write.

For any persistence change, test create, exact reload, legitimate update, stale update, foreign read, revoked authority, duplicate request and lost response. A stale save must return conflict and retain the current payload. An interrupted request may already have committed: inspect the saved version before retrying. Personal and Team destinations retain their distinct authority; an example launch must not infer or create an organization matter.

Retain legacy saved-play schema revisions and exact source fingerprints. Recovery belongs in the Training simulation area, not the primary professional entry. Unknown/unsupported data must produce a recoverable explanation, not a blank replacement case. Do not expose raw private payloads to another account or relax access merely to enable recovery.

Before a data-schema migration, specify forward compatibility, read/write behavior for old clients, backups, idempotency and rollback constraints. Prefer additive migrations. Site rollback is not a database rollback; a previously saved frontend must remain compatible with the advanced schema or have an explicit forward repair plan. Never drop production data to repair a UI issue.

## 6. Scenarios, economics and reporting

Scenario comparison changes hypotheses, not historical source facts. After relevant edits, invalidate exact prepared recommendations and cached outputs. Canopy edits must produce reassessment while retaining its source packet. Distinguish a prepared expected recommendation from an actual selected/approved decision; the first outcome in a graph is not a recommendation.

For economic changes, pin amounts, currency, period, units and input assumptions. Recompute after changed inputs and verify downside calculations. Tax eligibility, statutory rates and legal obligations remain unresolved without suitable authoritative sources and review. Do not restore stale attachments or drop unsupported fields during a save.

Reports must preserve statement status, case/category identity, source IDs and hypothetical qualifiers in JSON, Markdown and PDF. Active Studio Base, Medium and Full analysis covers/headers use CaseVant by Falcon-Merlin Group after this audit's corrections; user prepared-by attribution remains separate. The separate governed-output renderer still has historical branding and requires its own versioned review. Analytical previews are unapproved. Governed release/approval must remain tied to the exact saved snapshot and independent permissions, not the report button, library badge or template review status.

Current analytical PDFs export sources from the selected report content, not the entire Canopy reference packet. Graph-only citations can be absent when the optional graph is excluded. D05 is retained and inspectable in Studio but is not a cited graph source in the audited Canopy model. Sources & evidence now offers a separate complete reference-packet export in Markdown and JSON. It contains all nine selected immutable document versions, all fifteen retained versions, source-scenario and working-case identity, synthetic/no-approval qualifiers and exact document text hashes. The selected versions follow validated source provenance rather than invented current inputs; amended copies retain that reference selection and require reassessment. Fabricated provenance cannot enable the export. The existing export-authority and committed-context guards prevent a late digest from exporting after access/context changes. Do not describe this reference packet as uploaded or accepted dossier evidence, a re-importable Studio case or a complete-packet analytical PDF appendix.

Regenerate exports affected by content or layout changes. Inspect actual PDFs and selected pages with long conditions, high node counts, Unicode/Russian text and source passages. Verify source IDs and qualifiers through extraction as well as visual rendering. Do not claim every interior page was inspected unless it was. The exhaustive ERP appendix can be long; shorter category outputs require an explicit product decision and preserved access to full evidence.

Visual baseline changes require: an intentional documented design change; pinned rasterizer/runtime; approved/current corpus comparison; review of changed pages; explicit baseline update; and normal verification without update mode leaving the baseline byte-identical. Never approve a mass hash update merely because a renderer changed. Keep fixture, selection, source/report/layout fingerprints and pixel geometry governed.

## 7. Acceptance matrix and practical commands

Run commands from the selected checkout with the pinned installed runtime. Do not install dependencies unless missing or their inputs changed. The following existing checks cover the corrected contract:

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --experimental-sqlite --import tsx --test tests/category-demo-launch.test.ts tests/category-demos.test.ts tests/converted-examples.test.ts tests/example-migration-persistence.test.ts tests/studio-overview.test.ts tests/studio-departure.test.ts tests/saved-case-navigation-restore.test.ts tests/play-sessions.test.ts tests/demo-catalogue.test.ts tests/report-statement-status.test.ts tests/report-model.test.ts
node --experimental-sqlite --import tsx --test tests/tax-preservation-routes.test.ts
node --experimental-sqlite --import tsx --test tests/studio-continuity.test.ts
node --experimental-sqlite --import tsx --test tests/studio-source-packet.test.ts
node --import tsx scripts/verify-decision-report-pdfs.ts
```

Run focused lint for changed application/tests and relevant build/export checks. Canonical CI is additional evidence, not an excuse to skip local failures. These commands are not substitutes for browser acceptance or domain review.

When a harness extracts actual handlers into a VM, include their real new dependencies and shared transition helpers. The elevated audit's full CI caught a continuity harness missing createExampleWorkingCopy/enterExampleOverview; its resulting failed replacement was repaired in the harness without weakening the original-byte archive assertions. Keep full-suite CI in the release evidence as well as focused checks.

| Surface | Required positive and adverse acceptance |
| --- | --- |
| Entry/library | One neutral browse action; all nine categories; separate topics/jurisdictions; reset, empty results and combined filters; EN/RU labels |
| Launch | Fifteen cards/eighteen packages; fresh copy per launch; same Overview; no AI/play/save on browse; cancel preserves work |
| Deferred launch | Offline loader; newer request; changed account/epoch/context/draft; cancellation; protected replacement; no late overwrite |
| Statements | New assumption typed assumed; legacy default preserved; no gameplay support score; source facts vs hypotheses vs actual events |
| Canopy | Four variants; nine IDs/fifteen versions; exact cited passages; changed inputs invalidate prepared recommendation |
| Save/reopen | Two copies per package; exact source lineage; repeat edits; stale 409; foreign 404; old version payload/envelope unchanged |
| Recovery | Legacy simulation revisions; malformed/future records; authorized recovery; no private data leak or silent replacement |
| Reports | Appropriate profile; category/evidence/status intact; actual PDF generation/download; source/version and approval qualifiers |
| Presentation | Desktop and narrow widths, long labels, keyboard focus, accessible names, pending/error states and reduced motion |
| Production | Exact merged build/provenance; saved version/deployment success; live changed flow; bounded error-log query |

Exercise fresh authenticated browser save/reopen/download with an authorized test session and isolated synthetic data. The 14 October audit closes this previously missing browser evidence for representative Canopy copies; all eighteen packages additionally have real authenticated production-handler acceptance with platform adapters. Do not expand representative browser coverage into an all-package browser claim. A guest browser success, SSR markup, a mocked adapter and actual hosted behavior are distinct evidence categories. Counts of overlapping cohorts must not be added into an inflated total. Preserve the synthetic production cases until their disposition is explicitly authorized; never delete existing cases during acceptance.

Base/Medium PDF visual acceptance is now a separate all-page lock in `parity/decision-report-pdf-visual-baseline.v1.json`. It covers both formats, both languages, assumed statements and long case/node titles, with source/report/presentation fingerprints and pinned Poppler 25.07.0, 96 DPI, platform/architecture and font identities. Review intentional changes before using `REPORT_DECISION_PDF_UPDATE_BASELINE=1`, then rerun normally with that variable absent and prove the baseline byte-identical. Canonical `pdf-visual` CI runs this cohort as well as the unchanged Full-analysis and tax cohorts.

## 8. Release procedure and rollback

1. Review the complete diff for unintended files, credentials, runtime data and another writer's changes. Commit the coherent slice and push its task branch promptly.
2. Create/attach a canonical PR with final behavior, preservation rationale and actual checks. Integrate through ordinary controls; no force push, admin bypass or weakened required checks.
3. Verify canonical main contains the candidate, then build that exact merged commit. Compare sourceCommit/applicationInputsSha256/hostingConfigSha256 in dist/.openai/release-provenance.json. Refresh the supported source-opening result after integration so publication does not carry an earlier commit identity.
4. Use the current Sites skill/helper. Credentials stay in session memory and hidden stdin; never log them, put them in arguments or commit credential files. Refresh short-lived credentials after a long build. A failure is not a published version.
5. On Windows, preflight the installed node/npm and Git Bash paths. If GNU tar receives a drive-letter archive path, require local-path handling, such as TAR_OPTIONS=--force-local. Keep fixes local to the tool environment; do not edit application dependencies or tracked plugin files as a workaround.
6. Package the completed build with the supported helper; omit already passed commands only when inputs have not changed. Save using its exact project ID, full commit and unchanged archive. Deploy the returned saved version through Sites. Preserve current audience and complete existing bindings.
7. Continue a nonterminal deployment; do not start duplicates. Record terminal status, source/version/deployment IDs, environment revision and production URL. Verify the changed live flow and capture evidence without modifying real user work.
8. Leave a delivery receipt and docs/testing review. Stop owned preview processes, reset temporary viewports and identify every remaining dirty path/owner. Report CI still queued/running or failed honestly.

Before rollout, identify the previous known-good saved version and verify schema compatibility. For an observed production regression, stop further rollout, preserve the failed evidence and deploy the prior compatible saved version through Sites. Do not assume redeploying an old archive repairs user data; investigate saved payloads and perform an authorized additive repair when necessary.

## 9. Prioritized next development slices

Use [CaseVant development backlog and continuation instructions](CASEVANT_DEVELOPMENT_BACKLOG_REPORT.md) for the current execution order, code entry points and handoff procedure. The table below distinguishes remaining migrations from the completed 14 October export and visual-coverage work.

These are proposed follow-on work, not part of the audit's authorization to implement unrelated features. Assign roles rather than inventing individual owners or delivery dates.

| Priority / owner role | Slice and concrete acceptance |
| --- | --- |
| P1 / QA + application | Extend the completed representative authenticated Canopy acceptance to repeatable all-package browser coverage, including narrow authenticated flows. Two-copy save/reopen, hypothetical changes, conflict and actual PDF download have been exercised in Chrome; retain distinct browser/handler evidence and preserve test data unless disposal is authorized. |
| Completed / reporting + QA | Explicit Base/Medium visual cohort delivered: eight bilingual PDFs, 33 pages, assumptions and long case/graph titles, with a separate all-page lock and canonical CI gate. Maintain it alongside the unchanged 47-PDF Full-analysis corpus; review future design changes before updating baselines. |
| Implemented / case-data + QA | Maintain the shared typed example descriptor/launcher registry in app/example-registry.ts for converted, Canopy and category sources. Preserve IDs, versions, exact Canopy sources and factory semantics; prove all eighteen packages share identity/navigation guards. The 14 October continuation unifies lazy factories and guarded launches; see docs/testing/example-registry-review-2026-10-14.md and its release receipt. |
| Implemented / content + domain reviewer | Maintain the read-only case-level provenance/status register and auditable projection/exclusion manifest; see docs/testing/provenance-register-review-2026-10-14.md. Review visible unsupported/unprojected entries before a versioned template amendment. Review unknown effects and jurisdictional assumptions; do not label converted templates approved before review. |
| Completed / reporting + case-data | Complete Canopy reference packets delivered as Markdown/JSON: all nine selected identities including D05, fifteen retained versions and exact text hashes. Maintain the cited analytical register separately. A complete-packet PDF appendix remains an optional future report-format decision. |
| Implemented / application + data | Maintain opt-in semantic template comparison and independent new copies; see projection-upgrade-review-2026-10-14.md. Exact historical 2.2.0 factories and hashes remain frozen. No edits, tax work or approvals transfer; cancellation/stale authority makes no write. A future three-way merge requires explicit conflict and complete-carrier design. |
| P2 / content + application | Define real inspectable source packets for converted cases only where originals or clearly labelled authored synthetic excerpts exist. Retain exact version/section links and visibly missing evidence; no invented external documents. |
| P2 / UX + reporting | Design useful concise category reports and searchable/progressively disclosed large chronologies while retaining full evidence/analysis export. Benchmark the ERP package; do not increase graph bounds or hide assumptions. |
| P2 / governed reporting + QA | Review historical branding in dossier-governed-output-server.ts under an explicitly versioned renderer change. Preserve saved/approved artifacts and exact approval binding; regenerate, compare and independently approve new governed outputs rather than rewriting prior exports. |
| P2 / localization + QA | Replace remaining internal English topic metadata with localized display mappings over stable IDs; test bilingual combined filters and long names without changing saved taxonomy IDs. |
| P2 / platform + QA | Diagnose native iOS queued/time-out checks independently. Do not broaden a web amendment or claim native parity based on web success. |

Deliver each slice with a short problem statement, data/workflow contract, preservation plan, expected user journey, specific negative tests, measured results, unresolved limits and a release receipt. Review after every implementation step and repair material findings before the next step.

## 10. Completion standard

A task is complete when the intended user behavior is implemented, material audit findings are repaired, relevant tests and actual changed flows are verified, saved-work invariants remain intact, canonical source and deployed artifacts agree, and limitations are explicitly recorded. A wording change, successful merge, green isolated happy-path test or saved undeployed archive does not by itself meet this standard.

### Projection/upgrade continuation amendment — 14 October 2026

Converted template 2.3.0 resolves the reviewed ERP/GreenFire milestone and opening-counter gaps, plus the same GoldenShell/Desert Water omissions. Keep effect-free milestones as unrecorded hypotheses linked to every applicable option, including alternate handoffs. Opening zero financial/time counters are fictional initialization context, never actual billing or payments. Do not remove missing document-body disclosures or claim domain approval.

When amending a template, preserve its exact historical factory and frozen bilingual source/copy hashes. Resolve saved lineage by exact version and fingerprint; never use the newest template because a case name matches. Preview substantive node, relationship and context changes, ignore sequential link-ID churn/layout, show local work that will not transfer, reverify authority/content before acceptance and enter a fresh copy via the existing retention guard. Persist only through the ordinary save contract. Do not rewrite old payloads or silently transfer attachments/approval relationships.

Prioritize concise report and chronology usability: the amended ERP Full-analysis browser export is 254 pages. Retain complete export while designing useful shorter outputs with measurable retrieval/print acceptance. Treat current zero projection gaps as completeness of conversion, not evidence sufficiency or legal review. See CASEVANT_DEVELOPMENT_BACKLOG_REPORT.md for owner roles and bounded next-stage acceptance.

### Source-packet and navigation continuation — 15 October 2026

Execution status: PR 109 shipped converted 2.4.0 packets as Sites v130 from canonical 50246061e617a177036c10506da4b95cef617f2d, deployment appgdep_6ad0197c05fc81918aa8a4a89a91165b, environment 42. Authenticated ERP copies 12/14 and GreenFire 13/15 coexist with historic baselines 10/11; copies 12/13 were reopened and amended. Fresh ERP provenance retained its baseline fingerprint. Production packet downloads and narrow EN/RU exact-fragment inspection passed. Preserve every case. Historical 2.2.0 Chrome import, actual account-switch races and complete all-package authenticated coverage remain distinct open acceptance items.

PR 110 implements the bounded orphan Base-report correction and its bilingual ERP regressions. The first candidate was rejected after visual inspection; final Base ERP EN/RU renders three pages without losing qualifications. The separate visual lock now covers 10 PDFs/39 pages; Full-analysis remains 47 PDFs/760 pages with unchanged lock. Base/Medium renderer changes intentionally retire their earlier presentation receipts; canonical analysis and graph identities stay unchanged. Canonical CI caught one historical-receipt test that still expected freshness. Correct that expectation without altering historical receipt bytes, rerun final checks and publish only the exact follow-up merged source. Saved Sites v131 is not a published release. See base-report-pagination-review-2026-10-15.md and the final native receipt for completion, rather than treating earlier pending-status prose as current delivery evidence.

Maintain separate actual graph counts, minimum structural thresholds and human-review status. A count above a minimum is not document coverage or evidence acceptance. Overview's record navigator searches complete original text with explicit scope/result counts, progressive disclosure and exact-node actions; it never infers an operational chronology, completed work or a chosen route. Keep full exports available.

Converted template 2.4.0 adds original fictional-message citations and a separate reference packet. Retain 2.2.0 and 2.3.0 factories and their frozen bilingual hashes; never replace those locks with newest-template hashes. Resolve packets through exact template provenance. Keep all 43 missing document bodies explicit, including unknown version/section/hash. Preserve original premise IDs even when a working node is deleted, with separate working present/missing states. Original message text and UTF-8 hashes must survive user amendments and independent JSON/Markdown exports. Later messages remain hypothetical and unreceived; original register availability is not an uploaded document.

Use existing copy authority, verification, cancellation and source/account/draft context guards. Packet inspection/download creates no approval, evidence acceptance, persisted Studio field or database row. Preserve Canopy's separate immutable source/version path. Reverify original bytes, old source fingerprints, real persistence/recovery/tax handlers, narrow labels and actual downloaded artifacts. Native Sites receipts distinguish the independent releases.

Before broad reporting changes, measure the actual selected format: the opt-in Full-analysis ERP export was 254 pages; the authenticated Base export was four. Its orphan-disclaimer page needs a versioned layout correction. Preserve text and qualifiers, review changed Base/Medium renders deliberately and rerun unchanged Full-analysis/tax visual locks. User-edit migration remains a separate conditional three-way conflict design, not an implied capability of new-copy upgrades.
