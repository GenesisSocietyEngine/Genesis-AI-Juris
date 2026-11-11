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

Published v213 on 11 November 2026 at 03:30 UTC. PR #292 passed all 18 checks and merged as `b493b4de0d530493e559ecab67edccd7fdf97236`. Exact-main workflow 42951487738 passed. Native Sites deployment `appgdep_6af3e1327e1081919bd72b250b5c6555` succeeded with environment revision 42 unchanged. Both production origins verified 163 current plus 61 retained assets (224 total). [Receipt](receipts/design-accents-v213.json).

The official helper's first packaging input was rejected by automatic review because the opening receipt still referenced v212. Verified checkout HEAD, artifact provenance and asset receipt all matched the new merge; packaging succeeded after providing that verified source metadata. No failed or unverified artifact was published.

Additional isolated checks covered English narrow and Russian desktop activity, Reports and Billing. Each had no horizontal overflow, unnamed buttons or unlabeled fields. Temporary local server was stopped.

Live signed-in v213: Russian and English Billing retained the synthetic balances (unbilled EUR 0, outstanding EUR 30, trust EUR 0) with new labeled cards. English Reports showed category accents and opened case-list configuration correctly; return to catalog/language-switch/mobile verification was then interrupted by browser-tool timeouts. Three attempts to recover the signed-in browser also timed out. No production transactions or documents were changed.

Remaining: verify the newly styled live activity filters/history/document links in EN/RU, Russian Reports and production narrow visuals. The failed viewport call may have left a temporary browser override; reset it on reconnection before beginning desktop checks. Full EN/RU document-link acceptance for CV-020 was already completed on v212; v213's styling-only follow-up does not replace that evidence. CV-022 stays Waiting for verification, not fully production-verified. Existing CV-014/CV-015/CV-017/CV-018 and independent-identity limits remain open.
