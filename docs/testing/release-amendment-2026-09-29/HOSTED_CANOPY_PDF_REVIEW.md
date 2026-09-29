# Live Canopy PDF review — 2026-09-29

Bounded result: PASS for the four synthetic exports downloaded from production v103. This is a report-export acceptance check, not full product or recovery acceptance.

| Export | Tree | Pages | Bytes | SHA-256 |
|---|---|---:|---:|---|
| base | OFF | 3 | 33674 | `74a6988e614c35563f64a58ae713029e386a4d0f3fc1e6ff85ba33171ee3a7aa` |
| medium | ON | 7 | 98584 | `3b450a7e570f427c318e3dfcb80d38baa089864e3e6b05fd85dd964321229af2` |
| full-on | ON | 15 | 192343 | `4f4c5cd663cac9f75f726bca2080ba25257088ed5bd2b9f0bab29053058227a8` |
| full-off | OFF | 8 | 81976 | `32a189e1396e3749b3757832aea95f6bc482c65c6e2a842b7667fa824bb64fab` |

All 33 pages rendered with Poppler and were visually reviewed in contact sheets; dense tables, graph and appendix pages were also inspected individually. No clipping, overlap or unintended missing text was found. Character bounds checks found zero non-whitespace characters outside a page in each file.

Full OFF retains sections 1–8 and all eight core pages. Compared with Full ON, text differs only in the correct appendix-included/omitted notice after normalizing generation time and page numbering. Full ON adds four graph pages and three text-alternative pages. Its appendix lists 14 nodes, 13 directed adjacencies, and 3 paired page connectors.

Semantic text checks confirm the 300 signed / 450 minimum demand distinction; conservative base/upside contributions of 80,000; 240,000 / 80,000 = 3.00 years; downside 240,000 / 70,000 = 3.43 years; base revenue 720,000, energy 80,000, other costs 520,000, contribution 120,000 and simple payback 2.00 years; and the pilot prohibition on production before accepted release conditions. These details are present in Medium and both Full variants. Base intentionally summarizes rather than repeating economics.

Usability opportunities, not newly established regressions: approximately 7-point graph/appendix body type; raw JSON in the trigger node; repeated Issues/Options/Recommendation content. Keep any redesign separately scoped.

Limits: Canopy only; this does not close original Five Flats acceptance, hosted 65-line LF/CRLF/CR preservation or the complete PDF golden gate. No PDF/UA or screen-reader certification; no proof for other cases/roles/languages; no full case JSON equivalence; no migration/recovery, native/mobile or tax-v2 acceptance. No case approval or governed-output approval is claimed. The root agent supplied production identity, observed report settings and current-receipt state. Original PDFs were not modified.
