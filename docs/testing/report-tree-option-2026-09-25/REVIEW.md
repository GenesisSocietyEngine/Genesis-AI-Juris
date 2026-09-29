# Report decision-tree option, 25 September 2026

Baseline: production v99, application 34eebf8de21311a738cea66cbb6c316249ab9e8a, successful deployment appgdep_6ab6921a6b6881918419bb9a4635d6fe, environment revision 39.

Intended outcome: preserve the findings-led report and allow an explicit decision-tree ON/OFF choice in both report formats. The dialog defaults OFF. OFF omits the diagram and its text appendix; ON includes both after the narrative. Legacy programmatic full-report callers retain their existing tree default. The chosen report purpose remains visible in the concise report.

Acceptance: on/off presence in actual report definitions and generated PDFs; unchanged financial findings; redaction preservation; distinct presentation receipts; preview invalidation; accessible visible control; retained selection across report format changes. No schema, authentication, environment or historical case/PDF changes.

Review after implementation: reused the existing governed graph renderer and text alternative. The concise report's smaller printable area bounds appendix dimensions without cropping or changing graph content. Receipt presentation version advances so historical presentation receipts are not represented as matching the changed layout. Existing report authority checks remain in place.

Verification results will be appended before publication. Local output and browser checks are not a claim that the owner's ongoing authenticated v99 smoke has completed.

## Verification and self-review

48/48 focused checks passed: tree ON/OFF in both formats, unchanged core narrative and calculations, default compatibility, redacted graph records, Russian appendix, preview invalidation, receipt staleness/recovery, authority checks and prior PDF regressions. Strict TypeScript passed. The first run exposed obsolete mandatory-graph copy assertions; updated them for the explicitly optional graph, without removing receipt or rendering checks.

The production checkout omitted the FiveFlats fixture referenced by its existing tests and review generator. Restored the exact synthetic working copy from the native review source into tests/fixtures; SHA-256 2deeb85544ca8b667c3c005bd95405de05ede81702223f0ecd357f80ece7f676. The historical original was not amended.

Actual app-generated FiveFlats PDFs: OFF 5 pages, ON 18 pages including the full diagram and logical-order text appendix. Inspected the cover, final narrative page, first graph page and last appendix page. All rendered text bounds remain within A4. The long technical appendix is deliberately optional; findings remain first. The graph background is transparent in Decision format to fit its white report treatment; existing Full analysis diagram styling is preserved.

Supervised local browser: Canopy report opened with the switch OFF. ON produced an embedded PDF preview; OFF immediately hid that preview. Full/Decision format changes retained the explicit choice. Space toggled the switch. Screenshot records the final visible ON state. No 390px/200% or authenticated production smoke is claimed; those remain outside this local report amendment.

Publication uses the current production project with its audience and environment unchanged. No schema, migration, dependency, storage, authority or historical artifact changes are included.
