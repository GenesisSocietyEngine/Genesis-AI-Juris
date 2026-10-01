# Templates and category examples — review notes, 1 October 2026

## Ownership and baseline

Task owner: this Codex chat. Canonical source: GenesisSocietyEngine/Genesis-AI-Juris.
Isolated clone under the chat workspace; candidate branch `codex/templates-demo-coverage-2026-10-01`.
Fetched canonical main: `1a8b7ee23c61ae3efc78283a0a29538ecae2bd86`; implementation begins at that commit.
Production v105 source `073a638` is a separate publication receipt.
The original checkout HEAD is `e78b38f` on `feat/professional-product-ui-redesign-pilot-v2`.
Existing dirty paths there: Cargo.toml, docs/development/CURRENT_PROGRESS.md,
docs/development/TAX_ECONOMICS_V2_INTEGRATION_PLAN.md. Those belong to existing work and remain untouched.

## Slice 1: category examples

Outcome: every immutable case type has a fictional, editable Studio example with facts,
evidence, a decision and contrasting outcomes; training compiles to a playable route.
Acceptance: exact nine-category coverage, independent copies, EN/RU content, valid
save/export normalization, no invented legal-review status, no stored calculation results,
and existing departure/replacement protection used for launching examples.

## Slice 2: Templates and Demo discovery

Outcome: a visitor can scan numbered template tiles, understand the intended output,
and choose either an empty template or its matching worked example.
Acceptance: stable registry numbering, semantic list, labelled search and live count,
one relevant announcement region, explicit actions, 44px targets, visible focus,
one-column narrow layout, no clipped long Russian text, no example auto-launch.
Demo search/format/category filters and result counts must include new examples.

## Slice 3: PO delivery

Outcome: a prioritized development brief connects the supplied evidence to commercial
activation, pilot gates, accessibility and operational acceptance.
Acceptance: distinguish report claims from verification in this task; clear owners,
acceptance criteria, order of delivery, measurable hypotheses and release limitations.

## Results

### Implementation review

Added nine distinct bilingual teaching fixtures, one per immutable registry category.
Each has fictional evidence, unresolved issues, owner, internal checkpoint and two
outcomes. New launch uses the actual existing `resetStudioDraft` and
`enterNewLocalDraft` protection, clears saved-case identity and opens Decision.
No persisted authority, current-law review date or cached tax response is invented.
Empty starters remain empty; examples are separately labelled actions.

Templates now uses an ordered tile list with stable registry numbers, labelled
search, polite result count, compact announcement and expanded intake hints.
Demo catalog adds a Worked Studio example format, nine examples, matching search
and facets, corrected result count and explicit format-dependent pagination.
Existing Canopy and published simulations keep their existing paths.

Review found that long announcement copy delayed the first tile on phones. It was
shortened before delivery. English Tax & compliance presentation was added to
demo search vocabulary so the visible category name is searchable.

### Verified evidence

- Strict TypeScript validation passed after the final source edits.
- Targeted ESLint checks passed on new/changed catalog components, fixture module
  and category/catalog tests. The large existing JurisApp was reviewed by diff;
  this is not a claim that the whole repository lint suite passed.
- 29 targeted tests passed: registry/playbooks, existing Templates/navigation and
  Canopy layout, all fixture normalization/coverage, branching compile, copy
  isolation, all demo facets, and four tests executing the actual parent launch
  and replacement handlers for cancellation, pending/refused operations and success.
- Shared Rust tax assets/source/native corpus verification passed.
- Canonical mobile parity lock passed: 18 deterministic routes; unchanged bundle.
- Both matching D1 migration breakpoint checks passed.
- Production vinext build completed all five phases. Existing large-chunk warnings
  remain. Build success does not imply hosted provider or production save acceptance.
- Actual local browser: nine template tiles; tax search returns two; registry
  numbers remain 04 and 06; Orchard opens as a 12-node/11-link unsaved tax draft.
- Actual local browser: leaving that draft shows the existing Stay/Discard dialog;
  Stay preserves the Orchard draft; explicit Discard returns to Templates.
- Actual local Demo catalog shows 15 entries (Canopy, five existing simulations,
  nine category examples). Worked format plus Meridian search shows one example.
- Desktop 1280px and narrow 390px/320px layouts inspected. Russian tax tiles at
  320px have no horizontal overflow (`scrollWidth=innerWidth=320`), one column,
  and all four primary/secondary actions are 45px tall. Keyboard Tab then Enter
  opens the Russian intake disclosure; visible focus and wrapped hints inspected.
- Screenshots saved as task outputs: templates-preview.png and templates-mobile-ru.png.
- React skill review: derived search results need no effect; event callbacks own
  mutations; stable category keys; no new storage, fetch waterfall or dependencies.

### Verification limits

The Windows sandbox cannot resolve `os.userInfo()` for tsx. Local commands use an
unshipped preload outside the repository that supplies a temporary test identity
only when that syscall fails. The workaround is not part of the candidate.

Two broader existing esbuild-based checks could not complete under this sandbox:
studio-departure.test.ts and the organization-gated render test in
dossier-workspace-ui.test.ts. Their resolver reports Access denied while reading
an ancestor directory, followed by unresolved imports. In the latter run 36 tests
passed and one was blocked. The actual parent launch tests and local browser
departure test above passed independently; the blocked suites are not counted as
passed. Full repository suite/CI remains unverified.

The optional tax runtime packaging verifier's browser portion stopped because
CHROME_BIN was not configured. Runtime source/assets verification and the
production build passed; full browser packaging verification is not claimed.

The local central catalog is unprovisioned and uses the existing bundled fallback.
This verifies local discovery, not production provider identity or account history.
Spoken screen-reader, text resize to 200%, PDF tagging/reading order, hosted save,
real participant pilot and physical device acceptance remain open.

### Source delivery

Canonical remote main was checked again and remains `1a8b7ee`. Existing writers'
dirty paths were untouched. GitHub CLI authentication reports an invalid token.
Final commit and synchronization outcome will be recorded in the output receipt;
no main integration or deployment is implied by the local implementation.

### CI follow-up: deferred draft construction

User outcome: opening a worked example retains the app's initial-load budget and
existing replacement protections. Acceptance: the unchanged 325 KB entry limit
passes; restricted-context reset checks, deferred launch/cancel/refusal and failed
load preservation pass; the example still opens in Decision.

The first remote full-suite run found two failures: an exact-signature assertion
in the existing reset isolation test, and an initial entry of 355,610 bytes.
Moved draft construction and its tax dependencies to a deferred module; updated
the signature assertion while retaining all isolation checks. Initial entry is
310,769 bytes in the local build, below the unchanged limit. Both rendered-build
tests and 23 category/reset checks passed; an added fifth actual-parent handler
check verifies failed deferred loading preserves work and offers retry. Strict
TypeScript and targeted lint passed. Browser launch after the split opened Orchard
at Decision with 12 nodes and 11 connections. Remote CI must rerun on this fix.
