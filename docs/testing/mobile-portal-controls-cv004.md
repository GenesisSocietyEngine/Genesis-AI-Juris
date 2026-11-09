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
