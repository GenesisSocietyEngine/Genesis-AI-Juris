# Secondary-view bundle boundary

Date: 27 September 2026. Local UX worktree; no deployment or commit.

## Intended outcome and acceptance criteria

The current production manifest identified the JurisApp entry as `JurisApp-Bq19GBW8.js`, 405,417 bytes. The existing build regression limit is 325,000 bytes. Keep that limit, defer screens unused by the default Studio view, and retain all navigation, state ownership, private-content guards and exact save/replacement behavior.

## Change and review

- `CommunityWorkspace.tsx` contains the existing CommunityView/AdminDesk functions and their local types/checklist.
- `PlayWorkspace.tsx` contains the existing PlayView, DebriefView, inbox/metric/ledger panels, DecisionModal and clock formatter.
- `JurisViewShared.tsx` contains the small reused icon, metric-label and response-reader helpers.
- JurisApp loads Community, Play and Help only when their branches render, with localized `role="status"` Suspense fallbacks. Its StudioView, controller state, authorization reconciliation, evidence buffers, departure/replacement guards and save handlers remain in place. The parent still supplies the same props and evaluates the same visibility conditions before rendering each moved screen.
- Lazy source modules use type-only imports for retained parent prop types; transpilation erases those imports. The production bundler coalesces the small shared helpers into the parent entry and makes Community/Play import those helper exports from the already-loaded entry. The parent does not statically import either secondary view. An independent TypeScript AST comparison found all 26 extracted declarations identical to the repository baseline, with no changed function bodies.
- The production regression now checks the three dynamic import boundaries in addition to its unchanged 325 KB limit and existing lazy canonical-runtime/data checks.

## Evidence

- Full strict TypeScript check before source freeze: PASS, exit 0; `evidence/secondary-views-typecheck.log` is empty on success.
- Focused application lint: exit 0, no errors. Its sole unused moved `RunLedger` type import was removed before freeze; initial output is `evidence/secondary-views-lint.log`.
- Eleven focused regression files: 71/76 passed. The five failures were older `release-hotfix.test.ts` source assertions unrelated to extraction (reset defaults, restore guard, current training and delegated navigation). Root corrected those checks and reran their file: 14/14 PASS, `evidence/release-hotfix-retest.log`. Initial combined output is `evidence/secondary-views-regressions.log`.
- Independent access/protection checks: 13/13 PASS, with exact declaration/prop comparison and no material finding; see [independent review](SECONDARY_VIEW_REVIEW.md).
- Final full verified build: PASS, exit 0; strict TypeScript, both migration-statement checks, 18 deterministic parity routes and all five production bundling phases passed. Output: `evidence/secondary-views-build.log`.
- Actual final manifest entry: `JurisApp-Cp6YuRrf.js`, **313,257 bytes**, down 92,160 bytes (22.7%) from the failed candidate and 11,743 bytes below the unchanged limit. The new lazy Community, Play and Help chunks are 53,965, 29,407 and 10,928 bytes respectively. TrainingVideo is no longer an initial JurisApp import. Exact files/imports: `evidence/secondary-views-manifest.json`.
- Production rendered-build checks: **2/2 PASS**, including original runtime/data isolation, the unchanged entry budget and all three new dynamic boundaries. Output: `evidence/secondary-views-rendered-html.log`.
- Browser retest of the built lazy screens belongs to root after the build; no browser acceptance is claimed here.

No user-visible case content or authority rule was changed. This split changes code loading, so the remaining verification specifically includes build-manifest boundaries and opening the affected screens.

## Final accessibility candidate

The measurements above describe the extraction build. Subsequent actual browser review intentionally corrected the retained DecisionModal's keyboard behavior and added empty-report guidance/theme-aware list text. The original 26-declaration identity comparison therefore remains evidence of the extraction step, not a claim that the later dialog is byte-identical to HEAD. See [dialog review](DECISION_MODAL_REVIEW.md) and [browser results](BROWSER_REVIEW.md).

The final successful build has entry `JurisApp-BMbT5fyM.js`, **315,596 bytes**, still 9,404 bytes below the unchanged cap and 89,821 bytes below the initial failed candidate. Dynamic secondary-view boundaries and canonical-runtime isolation pass again (2/2). [Final manifest](evidence/final-accessibility-manifest.json), [final build](evidence/final-accessibility-build-retry.log), [final built-entry check](evidence/final-accessibility-rendered-html.log).
