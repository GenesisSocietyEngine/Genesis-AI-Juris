# CaseVant product development instructions

Prepared 13 October 2026 following the elevated case-library audit. This is the implementation and acceptance playbook for subsequent work; proposed backlog items below are not claims of delivered features. Follow the current repository AGENTS.md and record each slice's review in docs/testing/.

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

Current analytical PDFs export sources from the selected report content, not the entire Canopy reference packet. Graph-only citations can be absent when the optional graph is excluded. D05 is retained and inspectable in Studio but is not a cited graph source in the audited Canopy model. Keep those distinctions explicit; a complete packet/export appendix is separate follow-on work. Never describe current PDF acceptance as verification of all nine document bodies in the export.

Regenerate exports affected by content or layout changes. Inspect actual PDFs and selected pages with long conditions, high node counts, Unicode/Russian text and source passages. Verify source IDs and qualifiers through extraction as well as visual rendering. Do not claim every interior page was inspected unless it was. The exhaustive ERP appendix can be long; shorter category outputs require an explicit product decision and preserved access to full evidence.

Visual baseline changes require: an intentional documented design change; pinned rasterizer/runtime; approved/current corpus comparison; review of changed pages; explicit baseline update; and normal verification without update mode leaving the baseline byte-identical. Never approve a mass hash update merely because a renderer changed. Keep fixture, selection, source/report/layout fingerprints and pixel geometry governed.

## 7. Acceptance matrix and practical commands

Run commands from the selected checkout with the pinned installed runtime. Do not install dependencies unless missing or their inputs changed. The following existing checks cover the corrected contract:

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --experimental-sqlite --import tsx --test tests/category-demo-launch.test.ts tests/category-demos.test.ts tests/converted-examples.test.ts tests/example-migration-persistence.test.ts tests/studio-overview.test.ts tests/studio-departure.test.ts tests/saved-case-navigation-restore.test.ts tests/play-sessions.test.ts tests/demo-catalogue.test.ts tests/report-statement-status.test.ts tests/report-model.test.ts
node --experimental-sqlite --import tsx --test tests/tax-preservation-routes.test.ts
```

Run focused lint for changed application/tests and relevant build/export checks. Canonical CI is additional evidence, not an excuse to skip local failures. These commands are not substitutes for browser acceptance or domain review.

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

Exercise fresh authenticated browser save/reopen/download with an authorized synthetic test account and isolated data. Until that is done, record it as unverified even when authenticated handler tests pass. Similarly, a guest browser success, SSR markup, a mocked adapter and actual hosted behavior are distinct evidence categories. Counts of overlapping cohorts must not be added into an inflated total.

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

These are proposed follow-on work, not part of the audit's authorization to implement unrelated features. Assign roles rather than inventing individual owners or delivery dates.

| Priority / owner role | Slice and concrete acceptance |
| --- | --- |
| P1 / QA + application | Close authenticated browser coverage with a repeatable isolated synthetic account, two-copy save/reopen, changed scenario, conflict and real PDF download at desktop/narrow widths. Preserve/remove only explicitly disposable test data. |
| P1 / reporting + QA | Extend the locked visual corpus with explicit Base and Medium fixtures. The existing 47-PDF corpus exercises Full analysis; it did not catch the old Base/Medium branding. Keep separate source/report/layout identities and inspect both language variants and long titles before adding baselines. |
| P1 / case-data + QA | Create a shared typed example descriptor/launcher registry for converted, Canopy and category sources. Preserve IDs, versions, exact Canopy sources and factory semantics; prove all eighteen packages share identity/navigation guards. Avoid a big-bang rewrite. |
| P1 / content + domain reviewer | Add an explicit case-level provenance/status register and an auditable projection/exclusion manifest. Review unknown effects and jurisdictional assumptions; do not label converted templates approved before review. |
| P1 / reporting + case-data | Add an explicit complete source-packet export/appendix, distinct from the cited-source report register. Include all nine Canopy identities and selected immutable versions, preserve their synthetic status, and verify currently uncited D05. Keep the existing cited-source export contract unchanged. |
| P1 / application + data | Add an opt-in version comparison/upgrade flow that previews semantic changes and creates a new copy/version. Prior saved bytes remain readable and untouched; cancellation makes no write. |
| P2 / content + application | Define real inspectable source packets for converted cases only where originals or clearly labelled authored synthetic excerpts exist. Retain exact version/section links and visibly missing evidence; no invented external documents. |
| P2 / UX + reporting | Design useful concise category reports and searchable/progressively disclosed large chronologies while retaining full evidence/analysis export. Benchmark the ERP package; do not increase graph bounds or hide assumptions. |
| P2 / governed reporting + QA | Review historical branding in dossier-governed-output-server.ts under an explicitly versioned renderer change. Preserve saved/approved artifacts and exact approval binding; regenerate, compare and independently approve new governed outputs rather than rewriting prior exports. |
| P2 / localization + QA | Replace remaining internal English topic metadata with localized display mappings over stable IDs; test bilingual combined filters and long names without changing saved taxonomy IDs. |
| P2 / platform + QA | Diagnose native iOS queued/time-out checks independently. Do not broaden a web amendment or claim native parity based on web success. |

Deliver each slice with a short problem statement, data/workflow contract, preservation plan, expected user journey, specific negative tests, measured results, unresolved limits and a release receipt. Review after every implementation step and repair material findings before the next step.

## 10. Completion standard

A task is complete when the intended user behavior is implemented, material audit findings are repaired, relevant tests and actual changed flows are verified, saved-work invariants remain intact, canonical source and deployed artifacts agree, and limitations are explicitly recorded. A wording change, successful merge, green isolated happy-path test or saved undeployed archive does not by itself meet this standard.
