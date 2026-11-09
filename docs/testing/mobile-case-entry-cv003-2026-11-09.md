# CV-003 · Direct mobile case links · 9 November 2026

A direct link to a team case should show the authorized case name and requested section before the register. At 390 × 844, the section heading should fit on the first screen and its first command be reachable within one screen of scrolling. An ordinary Cases or New case visit should still start with an open register. The picker must work with a keyboard, and an explicit open or close must survive section changes.

The [original audit](ui-ux-functionality-2026-11-09.md) measured the case workspace without the outer Personal/Team collections. This iteration included those collections, the real navigation shell and the pilot notice. Positions below are CSS pixels from the top of a freshly opened document, with no scripted scroll.

| 390 × 844 direct to Client portal | Case heading, top | Portal heading, top–bottom | First portal command, top | Picker on arrival |
| --- | ---: | ---: | ---: | --- |
| v205, signed-in production synthetic case | 1,198 | 1,751–1,778 | 1,977 | Open |
| v206, same signed-in production synthetic case | 208 | 639–665 | 865 | Closed |
| v205, isolated short English title | 1,136 | 1,638–1,664 | 1,864 | Open |
| Candidate, same short English title | 208 | 589–616 | 815 | Closed |
| Candidate, 235-character title in the Russian interface | 208 | 800–827 | 1,026 | Closed |

Both candidate titles were fully displayed, with no horizontal page scrolling. The short and long names use separate synthetic case records. The heading for the requested section and the actual section selector agree. The case header keeps its status badges and shows readiness in the **Case details and actions** disclosure; the case editor and technical details are available inside. The pilot privacy limitation stays visible.

- Enter opens the native case picker and leaves focus on its summary. Tab reaches the collection links. Space closes the picker and its search field leaves the tab order. The summary is 44 px high on the tested phone.
- Opening the picker, selecting Calendar, closing it and selecting Client portal kept the chosen state and the same case. An unselected visit kept the register open after the first case automatically loaded.
- Explicitly opening the picker before narrowing to a phone kept it open; explicitly closing it before widening to desktop kept it closed. The phone section selector still raised the CV-002 warning for an unsent invitation and Review focused the same field and case. Nothing was sent.
- At desktop width, the register was open beside the case. After closing it, **My cases** reopened the picker and moved keyboard focus to its summary.
- The parent-render regressions cover direct links, ordinary and New case visits, nested return links, access still being checked and access being suspended. The full focused set passed all 102 checks, including the case editor, portal departure guards and return navigation.

**Smaller phone and exact links.** At 320 × 568 in Russian, the first candidate placed the primary portal command at 1,209 px with the 235-character title. The small-phone layout gives the title more width and uses 20 px text. The section label now starts at 198 px, the full title spans 222–452 px, and the command spans 1,045–1,085 px: the whole command is reachable within one screen of scrolling (1,136 px from the document top). There was no horizontal overflow or automatic scroll. A direct Documents link with an exact upload target kept its section and target in the URL and focused the upload-purpose field without selecting or uploading a file.

No change to data storage, case permissions or submission behavior. Mobile portal button sizing and broader navigation translation are separate backlog items (CV-004 and CV-005).

**Published verification · v206:** Reopened the same signed-in synthetic production URL used on v205 at 390 × 844. The picker was closed; the case and requested portal were visible on arrival with no horizontal overflow. Stay on the same case when switching sections; a deliberate open or close remained in effect. The register was still keyboard-accessible, and an unselected visit used its separate register-first behavior. This check only navigated the existing case. Long titles and exact document targets were exercised in the isolated fixture. [Implementation](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/275) · [Small-phone refinement](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/276) · [Exact-main checks](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42632955256) · [Release receipt](receipts/mobile-case-entry-v206-2026-11-09.json).
