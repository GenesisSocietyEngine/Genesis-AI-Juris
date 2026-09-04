# v62 Professional Report Graph Pagination and Document Flow

## Outcome

v62 makes every professional report graph a deterministic A4 portrait document
flow. It changes presentation only: case meaning, routes, decisions, evidence,
rules, canonical ReportModel content, and the playable training product remain
unchanged.

## Baselines

- Web: `8bd10594bc01e5a45183a743396ac24b7aeaf321`
- Mobile main: `29f862649dea378cfe3d4e145f5e396bf6d4c6ff`
- Production rollback: Sites version 63

The release is developed on isolated v62 branches. v61 commits, fingerprints,
receipts, and the rollback version are immutable.

## Presentation boundary

`ReportGraphLayoutModel` is built after `CanonicalReportModel` and before the
PDF renderer. It is a bounded presentation projection with:

- layout schema, algorithm, and layout-renderer versions;
- exact case, profile, ReportModel, and PDF-renderer references;
- A4 portrait page and printable-frame metrics;
- stable component, topology-layer, sub-layer, node-box, and page assignments;
- same-page edge segments and paired cross-page connectors;
- graph-page and following text-register order;
- complete node, adjacency, connector, root, terminal, and component records;
- a canonical layout fingerprint.

No pagination field enters the canonical case, route hash, or released
ReportModel content fingerprint. A layout or PDF-renderer change makes a render
receipt stale without making the underlying professional matter stale.

## Layout rules

The engine computes topology once in unpaged coordinates, reflows a wide layer
into deterministic portrait sub-layers, measures every node with committed
metrics from the exact embedded PDF font, and packs complete measured layers.
It never cuts through a layer or node.

Titles wrap in full without ellipsis. Long tokens use a deterministic
Unicode-safe fallback. Details that cannot fit the bounded graph card move to
the complete node register and leave an explicit `Full detail: Nxx` reference.
An individually oversized node receives a dedicated full-width graph page or
fails with a precise validation error.

Every cross-page edge produces exactly one matched connector pair. Both markers
share a stable connector ID derived from the canonical edge and deterministic
page assignment, name both graph pages and nodes, preserve direction and
relationship conditions, and have an extractable text equivalent. Connectors
are layout artifacts only.

## Document composition

All pages use ISO A4 portrait, 210 x 297 mm. Graph pages use the printable
portrait width; the node and edge register never sits beside the graph. Report,
section, case/profile identity, graph-page numbering, confidentiality, and
document-page numbering remain visible and legible.

After the last visual graph page, the document provides in logical order:

1. diagram summary with roots, terminal outcomes, and disconnected components;
2. node register ordered by graph page, layer, and stable node ID;
3. adjacency row for every canonical directed edge;
4. connector index mapping every pair to both graph pages and nodes.

The PDF sets a descriptive title and BCP 47 language and keeps Unicode text
extractable. v62 describes output as accessibility-improved, not PDF/UA
certified. A PDF/UA claim is prohibited without validated tagging, reading
order, figure alternatives, and artifact treatment.

## Standards language

- ISO 216 supplies the A4 paper-size baseline.
- ISO 5807 is a general flowchart-symbol and diagram-convention reference.
- OMG BPMN 2.0.2 informs paired printed Link Intermediate Event continuity.
- WCAG non-text-content and reading-order principles inform the complete text
  alternative.
- ISO 14289-2 is the PDF/UA-2 reference only; it is not a v62 conformance claim.

GENESIS graphs are not BPMN models. Product and report copy must say
**BPMN-inspired off-page continuity**, never BPMN conformance.

## Fail-closed evidence

The release requires locked Bhopal, deep, wide, fan-out, fan-in, disconnected,
cyclic-repair, long-title, long-detail, EN, RU, and maximum-node fixtures.
Automated verification checks A4 MediaBoxes, portrait orientation, printable
bounds, node integrity, wrapped text, exact connector pairs, adjacency
preservation, ReportModel stability, web/Flutter layout parity, extractable
text, and rendered-image sanity.

All 32 bilingual/audience professional goldens and both long-content stress
reports remain mandatory. Every PDF is rendered to PNG with Poppler and text is
extracted; Bhopal plus representative first, middle, and last stress pages
receive human visual review. Text extraction alone never approves the release.

## Release condition

Web, Rust, Flutter, Android, iOS, package/manifest parity, import/export,
malformed-import, revision, 18-route, security, build, PDF, production anonymous
PDF, same-tab authenticated save, stale-chunk, and observability gates must all
pass on exact reviewed heads. Then one exact-SHA Sites version may be saved and,
after fresh explicit approval, publicly deployed. Site version 63 remains the
rollback target. App-store distribution is outside v62.
