# Independent secondary-view extraction review

Date: 2026-09-27. Reviewer: report-verification agent. No application code or tests changed by this review.

## Acceptance criteria

The initial Studio entry may defer Community, Play and Help code while preserving existing parent state, callbacks, access guards, and the extracted views' behavior. Tests must continue checking the actual implementation rather than stale locations. The implementing agent owns the production build, 325,000-byte entry budget and browser verification.

## Verified

- Used the TypeScript AST to compare all 26 moved named declarations with `HEAD:app/JurisApp.tsx`, normalizing only line endings: all are identical. This covers Community/Admin (14 declarations), Play/Debrief/panels/DecisionModal (8), and shared Icon/labels/JSON helper (4). No moved function-body changes were found.
- The JSX attributes passed to `PlayView`, `CommunityView`, `HelpCenter` and `DecisionModal` are also identical to HEAD. Existing callbacks therefore still point at the parent implementation.
- Inspected the extraction script and resulting render boundaries: only the four secondary views gain Suspense wrappers. Parent Studio state and the private-play concealment conditions remain in `JurisApp`. The Play and DecisionModal boundaries still require `!privatePlayConcealed`; feedback retains both concealment guards.
- New modules import parent-owned types using `import type`. TypeScript transpilation produced no runtime import of `JurisApp` in any of the three new modules. Shared helpers have no runtime dependency on the parent.
- All four loading fallbacks are bilingual and expose `role="status"`. View markup, component-local hooks and their initial values were preserved by the exact declaration comparison.
- Reviewed source/AST tests referencing `JurisApp`. The assigned `custom-case-access.test.ts` and `case-protection.test.ts` inspect Studio/export/publication logic that remains in the parent, so no path changes were needed. The Studio handler AST harnesses likewise select parent functions that were not moved. Existing catalogue, report, navigation, Studio and play-export source assertions inspected during the review target remaining parent logic. The implementing agent added production-manifest assertions for the three newly lazy views in `rendered-html.test.mjs`.
- Ran `node22 --experimental-sqlite --import tsx --test tests/custom-case-access.test.ts tests/case-protection.test.ts`: **13 passed, 0 failed**, exit 0. Used the pinned Node v22.23.2 host runtime because the tsx runtime cannot initialize in this Windows sandbox.

## Evidence and limits

- [Declaration and invocation comparison](evidence/secondary-view-extraction-review.json)
- [Access/protection test output](evidence/secondary-view-access-tests.log)

No material extraction defect was found. This review is source and focused-test evidence; it does not claim the production entry budget, lazy network loading, browser focus, complete suite, or authenticated browser flows passed. Those checks are owned by the implementing/root agents. No golden files, fixtures, authentication rules, or test expectations were changed here.
