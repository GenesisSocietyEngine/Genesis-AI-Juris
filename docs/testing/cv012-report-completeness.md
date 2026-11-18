# CV-012 · Report population and incomplete data

17 November 2026. Candidate scope covers report completeness. Public baseline remains v221.

Reports now shows the matching record count before grouping and the number of source records returned for the selected report and period. Calculated fields show how many matching records have a value and how many lack one. Grouped tables and CSV exports carry those counts alongside the sum. A recorded zero contributes to the count. An absent value remains blank and an entirely absent total stays unavailable.

The pipeline explanation identifies active prospects, the excluded Not pursuing stage and the absence of date filtering. Russian copy uses the directory's «Без продолжения» label. The values remain scoped to the existing authenticated report loaders. Permission failures still abort the complete report.

## Verification

- Nineteen report and proposal review checks passed. The new EN/RU regression exercises filtered and grouped populations, partial totals, all-missing estimates, recorded zero and localized CSV headers.
- The actual ReportsWorkspace component was exercised in the local browser with three synthetic contacts. English and Russian both showed three matching records, two contributing estimates, one missing estimate and EUR 125. The grouped row exposed the same counts.
- TypeScript passed. Browser inspection found a Russian number-agreement issue in the results heading. The heading now uses «Записей» before the count.
- Existing proposal checks passed for explicit human decisions, attributed review, exact source bindings, viewer denial, repeated review and source replacement. Broader signed-in AI proposal acceptance remains open.
- Production report acceptance requires publishing this candidate. CV-010 live receipt checks remain pending an active test client.

## CV-033 and PR #315

The two web jobs for #315 passed their test work but failed the full dependency audit. Both reported [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), a high-severity repeated-extglob ReDoS in Picomatch through 4.0.7. The official advisory returned no patched version, and the registry returned 4.0.7 as latest. The 19 audit findings include dependent packages. The diagnostic archive warning occurred after the audit failure.

PR #315 remains pending. The next security step is a reviewed compatible repair or a patched upstream release, followed by the dependency audits and CI. No dependency exclusions or audit-threshold changes were made.

Evidence from [PR CI](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44134552792) and [push CI](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44134506363).
