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

## Public v222 · 18 November 2026

PR [#315](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/315)
merged at 09:22:45 UTC after 18 successful checks; [#316](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/316)
merged at 09:34:20 UTC after 18 successful checks. Exact-main
[web/PDF CI](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44277169701)
passed. The reporting candidate web run passed 2,098 tests with zero failures and
three inherited skips, plus two rendered-HTML checks. Both dependency audits
reported zero vulnerabilities. No audit threshold was weakened.

Sites published v222, environment revision 42, preserving the public audience.
Both origins returned canonical source `a724003199daab5795d11ce03f3ab3254a0e9c6c`
and verified 222/222 assets: 166 current and 56 retained from v221.
[Release receipt](receipts/cv012-v222.json).

### Signed-in acceptance

The owner workspace contained one synthetic prospect without an estimate. After
explicit user approval, two synthetic prospects were added: “CV-012 synthetic
prospect · zero estimate” (EUR 0) and “CV-012 synthetic prospect · EUR 125 estimate”
(EUR 125), both New inquiry. No email, invitation or case link was added.

- English and Russian grouped results show **3 matching records / 3 source
  records**, despite only two stage rows; recorded 2, missing 1, sum EUR 125.
- Filtering names to CV-012 shows **2/3**, recorded 2, missing 0, sum EUR 125.
  Switching RU to EN preserves those settings and counts without rerunning.
- Filtering to the original missing-value prospect shows **1/3**, recorded 0,
  missing 1, no total and “No recorded values” / «Нет записанных значений».
- Clearing the filter and removing grouping restores three rows. The missing
  estimate is blank, the recorded zero is 0, and the positive estimate is 125.
- Four actual browser downloads (grouped and raw, EN and RU) were parsed and
  asserted. Headers/stages are localized; grouped counts are 1 and 2, recorded
  counts 0 and 2, missing counts 1 and 0. The entirely missing group has a blank
  sum. Raw CSV retains blank / 0 / 125 separately.
- EN/RU switching was exercised in both directions. The release was loaded by a
  fresh reload; the synthetic values persisted. Desktop screenshots were checked
  for legibility and layout. No new issue was found in this scope.

[English screenshot](receipts/cv012-v222/reports-en.jpg) ·
[Russian screenshot](receipts/cv012-v222/reports-ru.jpg) ·
[CSV verification and hashes](receipts/cv012-v222/csv-verification.json).

CV-012 remains in progress for broader signed-in AI proposal/review/apply
acceptance. CV-010 live receipt submission, exact-version retries and reload
remain pending an active test client; no new client access was created.
