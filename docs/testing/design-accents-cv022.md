# CV-022 · UI/UX audit and color accents

11 November 2026. Contributor base `af2c478` (v212 acceptance notes). Scope: improve recognition and hierarchy without changing workflows, saved data, permissions, billing arithmetic or report definitions.

## Observed baseline

- Signed-in Home already has blue/teal/amber/violet accents. Preserve its palette and layout.
- Full activity history has a body-sized title and links indistinguishable from surrounding text. Home's general button rules also compete with activity filter styling.
- Reports has clear labeled controls but weak section headings and undifferentiated category groups. English desktop and Russian desktop/390 CSS-pixel DOM checks found no horizontal overflow, unlabeled fields or unnamed buttons.
- Russian Billing, using the existing synthetic release case, has undifferentiated totals. No production transactions were created or changed.
- The earlier v212 document audit remains the evidence for exact document access in both languages. Existing CV-014/CV-015/CV-017/CV-018 findings and restricted-identity coverage are not closed by this styling work.

## Changes and review

Activity: stronger heading, blue top border, always-underlined links, blue selected filter with underline and pressed state, 44px filter minimum, visible keyboard outline, muted timestamps and labeled category icons with soft color backgrounds. Deleted subjects remain unlinked. Specificity is sufficient to preserve the filter styles inside Home.

Reports: labeled category cards with blue case, teal financial, violet productivity and amber lead accents, stronger headings and explicit focus treatment. Print keeps neutral backgrounds and dark headings. Billing: teal title rail, labeled blue/amber/teal totals cards, stronger headings and focus/hover treatment. Color supplements existing labels and semantics.

React review: only two data attributes were added to existing mapped elements. Stable keys, hooks, state, handlers, fetches, links and accessible names are unchanged. No new dependencies or effects.

## Candidate verification

- 10 existing activity-link/feed, Billing and Reports tests passed; targeted ESLint and whitespace checks passed.
- Actual React components rendered in an isolated synthetic preview, using real module CSS and workspace styles. EN desktop activity/Reports/Billing and RU narrow Home activity/Reports/Billing were visually reviewed. At requested 390px width, available content was 375px with the scrollbar; scroll width matched content width. The report configuration screen measured 390px without overflow.
- RU Documents filter selected only document rows; Home → history link preserved filter/language; keyboard Tab from Documents reached Tasks with a visible outline. All six Home activity filters measured 44px. Reports opened the Russian case-list configuration correctly. No transaction submission was needed.
- Calculated text contrast: blue on white 7.87:1; teal 5.93:1; violet 6.57:1; amber 6.18:1; deleted red 5.81:1; muted timestamps 5.99:1. These checks cover the changed palette, not a claim of full WCAG certification.
- Chrome responsive screenshot capture timed out; responsive production Reports DOM measurement succeeded. Local visual previews used the in-app browser. Temporary viewport overrides were reset.

## Release status

Candidate only. Await all required CI, ordinary merge, exact-main verified build and native Sites release. Then recheck signed-in EN/RU activity, Reports and Billing on the deployed site, including narrow layout and exact document navigation. Production remains v212 until that evidence is recorded.
