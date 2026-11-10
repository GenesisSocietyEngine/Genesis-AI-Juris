# CV-005 · Case navigation localization

On 9 November 2026, the candidate used the active interface language for all eleven desktop tabs and mobile options, section headings, breadcrumbs, case picker actions and filters, accessible names, and case and technical disclosures. The destination keys and tab-to-panel relationships still drive navigation. A case switch uses the active language even when the starting URL omitted a language parameter.

A local browser fixture mounted the actual case workspace, calendar and portal components with a synthetic case and read-only data adapters. In English and Russian, desktop tabs completed Overview → Calendar → Client portal → Overview. Each selected tab matched its panel heading. At 390 CSS pixels the phone selector completed the same transitions in both locales, displayed eleven localized options and produced no horizontal document overflow. The case ID and original mixed-language user title stayed intact.

TypeScript and all 63 focused case, navigation, portal departure and rendering tests passed. The regression checks both label sets, the selected tab and panel relationship, route values and the permission-dependent omission of Client portal. The fixture uses synthetic transport. Signed-in verification after publication is pending. CV-006 covers the wording and duplicate creation entry on Overview.

## Published verification · 10 November 2026

All 18 checks passed on [PR #279](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/279). The released archive came from [the exact-main web/PDF build](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42803791211) at `dce964658e24ffcc14acbc9878e8da8c3a607837`. Version 208 deployed as `appgdep_6af2fbd1b99c8191bcf87aeeae94ad8b` with environment revision 42. Archive SHA-256 was `ac148bc152c2649633ba095121c0af2a59d454c8af4a67442a6cdefa67b794c6`. Both origins verified 156 current and 52 retained assets.

In signed-in Chrome, all eleven desktop tabs and all eleven phone options followed the selected language. Overview → Calendar → Client portal → Overview kept the original case ID and synthetic title, and each destination exposed the matching tab panel. English and Russian passed on desktop and at 390 CSS pixels. The phone document and viewport widths matched. English desktop sizing and language were restored after the check.
