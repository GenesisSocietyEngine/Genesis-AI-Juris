# Decision report iteration — 25 September 2026

## Intended user outcome and acceptance

The default PDF must answer what the recorded facts and calculations mean, what should happen next, and which evidence could change the recommendation. It must not present model topology or unsupported tax/probability outputs as professional findings.

Implementation steps: (1) pure, reproducible analysis; (2) concise decision PDF with optional full technical format and exact receipt binding; (3) real FiveFlats rendering, regression tests and independent review; (4) private review publication and production successor preparation. After each step inspect wording, preservation and applicable tests; record limitations rather than inferring acceptance.

References reviewed: HM Treasury, Publishing business cases (2025), and Monmouthshire Cabinet residential-property acquisition business case (6 March 2024). Adopt recommendation-first structure, alternatives, quantified assumptions, risks and actions; these are design references, not legal/tax authorities or commercial benchmarks.

Original 23-page PDF audit: repeated node inventories; deterministic loss labelled 100% probability; unset sources for 35%/5% tax rates; static-interest tax base inconsistent with selected amortization; future case-entered legal date; undefined client return target represented as cash-on-cash. Historical case JSON and PDF must remain unchanged.

Design review: a negative result before unpriced costs remains a useful adverse finding; missing inputs must not be treated as verified zeros. Sensitivity is hypothetical, holding the current expense ratio constant. No universal lender covenant or tax benefit is assumed. No new AI provider, paid calls, migration or authority changes.

## Implementation review

The dialog defaults to Decision report and offers Full analysis separately. Full analysis remains the compatibility default for existing programmatic callers. Exact presentation binding revision 4 differentiates modes and invalidates old-layout receipts; no historical receipt or PDF is rewritten. Authority fences, current-context checks and privacy recovery are unchanged.

Independent review found short-loan annualization, debt-free operating deficit wording, generic financial-action leakage and loss of FX/exit exclusions. These were corrected. Missing costs remain unknown, known negative cash flow remains visible as an upper-bound result, and no lender covenant is invented. Full-mode probability charts were removed; arithmetic tax tables remain explicitly unverified. Sources remain recorded references rather than asserted legal authority.

44/44 focused checks passed, including exact receipt/private-scope recovery, real PDF generation regressions, EN/RU, deterministic FiveFlats math, zero/missing costs, short-term loans, interest-only principal, redactions and mode identity. TypeScript and focused lint passed. Original source JSON and migration files are unchanged.

## Visual review

Actual app generator produced the revised FiveFlats PDF. All five pages were visually inspected as A4 renders: readable hierarchy, recommendation first, no clipped tables or duplicated node inventory. An initial blank sixth page caused by overflow was corrected by tightening the evidence section. Page five retains every material exclusion and full relevant assumptions. PDF remains selectable text but is not a tagged accessible PDF; PDF/UA compliance is not claimed.

This iteration does not supply verified tax rates, current specialist opinions, a market rent forecast or a selected/approved case outcome. Human authenticated acceptance of the integrated public C1 release remains separate.

Supervised local browser: opened Canopy through Demo → Open in Studio → Create analytical report. Decision format was selected by default and Preview PDF completed with an embedded PDF. Switching to Full analysis removed the earlier preview. This verifies the local dialog/generation path, not hosted identity or independent approval. No viewport resize or 200% zoom capability was advertised in this browser; no narrow/zoom acceptance is claimed.

Browser review also exposed a demo premise with appended machine-readable pinned inputs. Decision format now displays the human objective and points to the complete record; a regression covers omission of technical JSON and irrelevant finance actions.
