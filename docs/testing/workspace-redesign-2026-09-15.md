# Genesis workspace redesign — 15 September 2026

## Baseline and reference access

Source baseline: clean `930609843604833f5619e554e0201ab96981c130`, matching published Sites version 81. Existing project identity and data architecture are retained.

References located by filename: `Coda web Mar 2024.zip` (361,183,695 bytes) and `ClickUp web Nov 2025.zip` (459,229,218 bytes). The supplied OneDrive folder redirected but retrieval returned 502. Available copies were located in the user's files. Transfers ended with 502 before complete archives arrived. Local ZIP records yielded 344 Coda and 557 ClickUp intact images; each recovered image's decompressed length and CRC32 matched its ZIP entry. This is partial archive coverage, not a claim that the complete archives were inspected.

## Initial audit

1. The normal entry loads Canopy automatically. Replace this with an intentional entry and preserve recent work.
2. First use shows disabled save/report actions, editor modes, history and six-step controls before a task is chosen.
3. Studio and saved cases have different navigation sets. Bookmarked Operations falls back to Studio.
4. Beige Studio, white navigation, dark empty saved-case background and separate Canopy/account styles undermine consistency.
5. Inactive saved-case tabs have no arrow-key navigation; some regular text is smaller than 12px.
6. Canopy's existing canonical sources and review workflow need a clearer introduction, distinct from quick exploratory copies.
7. The anonymous preview cannot perform an authenticated saved-case journey. An existing isolated Canopy integration harness covers actual source/task/review/output handlers; it is separate evidence from browser verification.

## Direction and initial mapping

Visual thesis: a quiet, document-centred case workspace, with a persistent navigation rail, a white reading surface, blue primary actions and compact task statuses. The distinctive Genesis relationship is case → evidence → decision package. Brand mark, canonical content and evidence safeguards remain intact.

| Observed reference | Visible pattern | Genesis recommendation |
| --- | --- | --- |
| `Coda web Mar 2024 99.png` | Readable narrative and a small action table on the same page; table options in a contextual right panel. | Use readable case sections with structured evidence/tasks and reveal detailed controls in context. |
| `ClickUp web Nov 2025 158.png` | Explicit status names with restrained coloured markers; one Apply changes action in a focused dialog. | Keep status labels legible, pair colour with text, and use one main action per task/review surface. |

The typography sizes, blue Genesis accent, spacing scale, entry composition and six-step guidance are original implementation choices, not measurements copied from the references.

## Stage 1 acceptance

- Normal entry shows Case Studio with Create, Import, Open demo case and recent-work access; no automatic demo replacement.
- One workspace navigation component and destination list work across Studio and saved sections.
- Light office tokens, readable text, focus and responsive controls establish the shared foundation.
- Existing imports, saved work, explicit continuations, canonical fingerprints and display-only portrait projection remain intact.
- Inspect desktop/narrow rendering and exercise entry, navigation and menu dismissal before proceeding.

Stage 1 review: desktop entry, Demo link, Operations empty-state route, outside-click and Escape menu dismissal were exercised in the browser. Typecheck and focused React lint passed. Ten existing navigation/continuation tests passed after updating obsolete route/default expectations. Canonical data was not edited. A 390px iframe preview initially did not render; mobile acceptance is still pending and is not claimed. The entry has one blue primary action and no editor chrome, consistent with the selected Coda document hierarchy.

Additional full-size selected references: Coda `23`, `98`, `127`, `137`, `265`, `271`; ClickUp `168`, `186`, `229`, `411`, `438`, `396` (with the archive's filename prefixes). Contact sheets cover the recovered subset. Coda 137 shows a record panel; ClickUp 229 shows task details and activity, whereas ClickUp 411 is a list-information panel. These distinctions guide contextual panels without conflating reference functions.

## Stage 2 acceptance

- Canonical Canopy in Demo has an understandable scenario, starting steps and expected outputs using existing verified fixture content.
- The six-step editor is compact, readable, preserves exact content, and shows contextual advanced controls.
- Case projections, graph controls and Operations use the same spacing, typography and status language.
- Reopened docflow remains portrait; menu/keyboard/report interactions are reviewed after the stage.

### Stage 2 review and evaluation
- Browser inspected the canonical Demo presentation, all four scenario selectors and source/expected-output disclosure. Base opened explicitly in Studio.
- Switched graph Horizontal → Vertical in the browser; portrait map and selected-step summary rendered. This deliberate layout change remains recorded; opening alone remains a display projection.
- Review found evidence lists and relation editors pushing the map down the page. Collapsed them into contextual disclosures and separated reading a step from editing it; reviewed inputs remain available without raw JSON in the default reading view.
- Found and fixed Continue recent work overwriting the previous step with Describe; restoration now resolves the saved stage before writing the URL.
- 19 focused workflow, import, canonical demo isolation and collision-free layout checks passed. Typecheck passed before the final small navigation corrections; final gates will repeat it.
- A 390px static render of the actual entry components and styles was inspected in the browser. Text wrapping and prominent demo action pass visual review. This is not a live mobile interaction test; live iframe hydration did not work in the review environment.

### Stage 3 acceptance criteria
Apply shared office tokens and typography to saved cases, Canopy, account and organization administration. Preserve permissions and source versions. Make saved case tabs keyboard operable and locations recoverable; provide specific, plain-language sign-in and administration help. Review rendered accessible pages and static components where authenticated routes cannot be opened.


### Stage 3 review and evaluation
- Inspected the account, unsigned My cases and Administration pages in the browser. They now share the navigation and office palette; sign-in and organization access remain enforced.
- Inspected the actual saved-case navigation and Tasks & reviews components in a browser harness, using explicitly labelled synthetic request rows based on Canopy's three opening questions. This was not an authenticated saved-case session. Search, Open/Received/Cancelled filters, empty results, request form/owner selection, and keyboard tab selection were exercised without writing production data.
- A live 390px component harness verified task search, the mobile section selector, wrapping, and More/Escape dismissal. The full application on a physical phone and authenticated mobile flows remain unverified. The separate static entry render checks layout only.
- Review caught a misleading fallback assigning unowned tasks to their creator. Owner now reflects the actual requested participant, or “Not assigned.” The create form uses the existing participant field and existing server validation.
- Kept Evidence review separate from Documents & evidence: it has a distinct review workflow and permission boundary. Saved cases retain seven conceptual destinations. The editable Decision map lives in Studio; the saved case exposes the Decision package and its Studio continuation. Combining these into one persistent editor would require a separate workflow change.
- Plain-language role guidance was added to Administration. Diagnostic actor IDs remain in Developer view; evidence quality, readiness, missing sources and independent review status stay available to users.

### Final interaction review
- Browser verified normal entry, explicit Canopy Base opening, all four scenario choices, source dossier disclosure, portrait orientation, Horizontal/Vertical switching, selected-step reading, contextual editing, and the six-step controls.
- Continue recent work returns to the previously selected Test step, rather than overwriting it with Brief.
- A synthetic browser-history event was found to remount the app and lose a playable run. Internal navigation now uses a dedicated event while native history listeners remain. Replayed GreenFire launch, document selection and return to Demo successfully after the repair. Explicit saved-case/template opening also retains its intended editor step.
- Operations review removed the old parchment document style and enlarged deadline rows. Document labels wrap beside numbered rows. Unknown dates read “Not recorded”; the original field remains in Record details. Unknown costs remain explicit in plain language.
- User validation now shows actionable gaps, with the complete diagnostic list in Developer view. The package review explains that completeness does not establish evidence reliability or independent approval.
- The report dialog covers workspace navigation, traps focus, returns focus on Escape, and generated the available 15-page preliminary Canopy PDF in the browser. Its cover was inspected in the portrait preview. It is a working draft, not an approved governed report.
- Canonical Markdown import rejected an invalid status and verified/applied a valid Canopy file (14 nodes, 13 links) using its exact fingerprint. The source fixture, access rules and signed-data semantics were preserved.

### Reference-to-design mapping
| Screenshot | Observed pattern | Applied Genesis choice |
| --- | --- | --- |
| Coda web Mar 2024 23.png | Slim navigation, page title, short callout and structured table | Quiet rail, one case title, compact numbered guidance and readable content surface |
| Coda web Mar 2024 98.png | Narrative and structured records together | Canopy scenario, source dossier and expected output on one Demo page |
| Coda web Mar 2024 127.png | Contextual status menu | Text-labelled statuses and local actions rather than global diagnostic controls |
| Coda web Mar 2024 137.png | Record details in a side panel | Selected map-step reading summary with editing disclosed separately |
| Coda web Mar 2024 265.png | Nested pages alongside a task table | Separate workspace navigation from within-case destinations |
| Coda web Mar 2024 271.png | Secondary page controls under ellipsis | More menus for secondary controls, with outside-click and Escape dismissal |
| ClickUp web Nov 2025 168.png | Task owner, status and due date are explicit | Request rows show actual ownership, state and due information |
| ClickUp web Nov 2025 186.png | Grouped review work | Focused Tasks & reviews queue with counts and useful empty states |
| ClickUp web Nov 2025 229.png | Work-item overlay with details and activity | Preserve case context while inspecting details; keep audit distinct from primary work |
| ClickUp web Nov 2025 438.png | Filters beside work lists | Search and status filters adjacent to review requests |
| ClickUp web Nov 2025 396.png | Contextual secondary actions | Restrained menus and local disclosures |

### Shared implementation rules
- Typography: system sans-serif stack; 16px body baseline; ordinary dense content 14px; supporting labels 12–13px; one 32–36px page title and subordinate 18–24px headings.
- Spacing: 4px-based increments, 16–24px card padding and clear section gaps. No decorative parchment, tilted sheets or dense all-capitals metadata in the revised primary surfaces.
- Colour: white content, pale grey navigation, dark slate text and a blue primary accent. Status always has a text label; uncertainty and missing evidence are not concealed.
- Components: shared navigation/destinations and tokens; 8–10px radii; restrained borders/shadows; contextual drawers/disclosures; visible focus; buttons and form controls sized for touch; responsive tabs become a section selector.
- The Genesis accent, layout dimensions, six-step composition and case→evidence→decision-package framing are original recommendations, not claims of exact reference replication.

### Verification evidence and limitations
- Focused run: 85/85 tests passed across entry/navigation, bilingual guidance, canonical Canopy, Markdown integrity, source protection, portrait layout, report graph pagination/connectors, first report and request lifecycle.
- Isolated Canopy integration: 7/7 passed using disposable D1/R2 and synthetic identities. Covered all four scenario outcomes, causal explanation, failed-versus-unavailable clearance, source/proposal/request/snapshot/output handlers and report approval. This does not substitute for authenticated browser verification.
- Generated governed Base dossier: 41 A4 portrait pages (595.28 × 841.89 points, rotation 0). First two pages were rendered and visually inspected. Report graph tests verify pagination and paired page connectors. Not every page was visually inspected.
- Strict PDF review packaging stopped because the environment provides Poppler 24.02.0 while the project pins 25.07.0. The version gate was not weakened; reproducible full PDF review remains outstanding.
- Automated entry→Demo→Canopy→visible next-action timing was 6.115 seconds. This measures scripted navigation only. No real-user two-minute usability study or completed registration timing was performed.
- Production typecheck, build and mobile contract lock passed. Final lint passed. A further 28/28 checks passed, including compiled entry size, metadata, sign-in continuation, package rules and Operations observability. These overlap six guidance tests in the 85-test run; they are not 113 distinct tests. The loading budget is unchanged; entry/document/inspector panels now load separately.
- Full authenticated browser journey (registration, persisted evidence review, request mutation, independent approval) remains blocked by the preview's unavailable authenticated service. No credentials or permission bypass were introduced.
- Coda/ClickUp reference coverage is the 901 intact recovered images, not the entire two archives. Selected screenshots were inspected full-size; the recovered set was reviewed through contact sheets.

### Readiness assessment
Suitable for a guided product demonstration of entry, Demo, Canopy's source/decision story, Markdown import, portrait map and preliminary reporting. The new visual system substantially improves hierarchy and consistency. Do not present the anonymous Studio working copy as an approved decision package.

Priority follow-ups:
1. Run the full authenticated browser journey with real test organization membership, including registration, evidence review, assigned request completion and independently approved report download.
2. Verify the complete app on physical mobile devices and assistive technology; complete measured two-minute first-use sessions with new users.
3. Re-run the pinned PDF review on Poppler 25.07.0 and inspect all report pages.
4. Further simplify the long decision map and advanced governed forms based on user observation; the map remains a tall scrolling workspace, and some specialist workflows still require guided explanation.
