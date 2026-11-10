# CV-005 · Case navigation localization

On 9 November 2026, the candidate used the active interface language for all eleven desktop tabs and mobile options, section headings, breadcrumbs, case picker actions and filters, accessible names, and case and technical disclosures. The destination keys and tab-to-panel relationships still drive navigation. A case switch uses the active language even when the starting URL omitted a language parameter.

A local browser fixture mounted the actual case workspace, calendar and portal components with a synthetic case and read-only data adapters. In English and Russian, desktop tabs completed Overview → Calendar → Client portal → Overview. Each selected tab matched its panel heading. At 390 CSS pixels the phone selector completed the same transitions in both locales, displayed eleven localized options and produced no horizontal document overflow. The case ID and original mixed-language user title stayed intact.

TypeScript and all 63 focused case, navigation, portal departure and rendering tests passed. The regression checks both label sets, the selected tab and panel relationship, route values and the permission-dependent omission of Client portal. The fixture uses synthetic transport. Signed-in verification after publication is pending. CV-006 covers the wording and duplicate creation entry on Overview.
