# CV-004 mobile portal controls

On 9 November 2026, a headless Chrome fixture exercised the candidate portal stylesheet, the three English and Russian view labels with inline SVG icons, and a common action button. The portal sat in a padded case column. Each row gives the height of each view button in CSS pixels.

| Viewport | English | Russian | Common action |
| --- | ---: | ---: | ---: |
| 320 | 44 | 44 | 44 |
| 390 | 44 | 44 | 44 |
| 600 | 44 | 54 | 44 |
| 1280 | 36 | 36 | 36 |

Each individual word occupied a single text rectangle inside its button. The fixture had zero horizontal page overflow in all eight combinations. The focused unselected button had a 3 px focus-visible outline and the selected button had a distinct bottom border. At 600 px the longer Russian label wrapped and the other two buttons grew to match. The change is confined to the portal stylesheet at viewport widths up to 600 px.

All 27 tests in the portal departure and practice-route suites passed, including draft review, recipient isolation, uploads and revocation. The layout fixture exercised CSS and button markup independently of the authenticated application. After release, open a signed-in synthetic case at 390 px, switch through all three portal views with the keyboard in both locales, and check the actual page width, focus and control bounds before marking CV-004 verified.

## Published verification

On 9 November 2026, all 18 checks passed on [PR #278](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/278). The merged commit was `8b6015e83a534fac8c17d82d522770af64536176`. Both jobs in the [exact-main build](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42652679030) passed. Public version 207 deployed successfully as `appgdep_6af1f3f0b9b8819189e5959f3903256f` with environment revision 42. Its archive SHA-256 is `17cc87e878a23e251f9f9b5e8cab99e39970304b924be8b37d26b3a7c1c57071`. Both origins verified 156 current and 54 retained browser assets. The generated origin initially returned one 404 for a Help Center chunk, then passed the complete repeat check.

| Signed-in synthetic case, 390 CSS px | v206 view heights | v207 view heights |
| --- | --- | --- |
| English | 61.5 / 61.5 / 40 | 44 / 44 / 44 |
| Russian | 83.25 / 61.5 / 61.5 | 44 / 44 / 44 |

In each language, Enter activated Shared items, Client uploads and Messages. The focused button had a 3 px outline, the selected state had a distinct underline, and labels used normal wrapping. The invite and refresh actions were 44 px high. The document scroll width equalled its client width. Restoring desktop sizing produced three 37.75 px view buttons. No case data was changed.
