# Functional, UX and graphic review · 22 November 2026

## Scope and baseline

Canonical base: `d77267b3ea74344fc61a55911bb04a63328f49b9` (PR #350). Clean task branch `codex/ux-review-2026-11-22`; independent iOS PR #351 remains open at `6473dac04761d43467589f74a8d8cae347c5c540`. Sites reports current version 229 and public audience. No production records, invitations, uploads or messages were created in this audit.

Read-only live inspection covered signed-in Russian Evidence, Home and Reports, English Home and its overdue-task destination, mobile Reports/menu language switching, and Home at 390px. This is a focused navigation and visual audit, not renewed acceptance of every Billing, portal, export or provider workflow. Existing client/infrastructure gates remain open.

## Findings and implementation

| ID | Priority | Evidence and user impact | Disposition |
| --- | --- | --- | --- |
| CV-042 | P2 | Starting from an expired Russian Evidence source deep link, “Sign in to continue” returned to the same case/section/language but lost the source fragment. The boundary used the server-generated return URL; the browser-only fragment was absent. | Implemented: after hydration use the existing allowlisted workspace sign-in builder with the complete current browser location; retain the server fallback before hydration. Subscribe to hash changes. No authorization rules change. |
| CV-043 | P3 | Home showed `1 Overdue tasks`, `1 Просроченных задач`, `1 Открытых записей` and `2 Доступных дел`. Count labels were fixed plural strings. | Implemented: count-aware EN/RU labels, including Russian one/few/many and teen forms, without changing totals or filters. |
| CV-044 | P3 | Home used 12px summary/action labels, 13px task titles, and two indistinguishable “View all” accessible names. | Implemented: 14px task labels/actions, darker secondary summary/empty-state copy, wrapping labels, and contextual accessible names for today/overdue actions. Existing blue/amber/red/teal accents retained. |
| CV-045 | P2 | Case selection/header and multiple navigation rows push Evidence below the initial desktop viewport. The selected Evidence tab can be outside the horizontal tab viewport. Home repeats many sidebar destinations and requires horizontal scrolling on mobile. | Open: prototype a compact case header and reliably reveal the selected section; retain all routes, keyboard focus, exact document/thread identity and unsaved-work guards. Verify EN/RU desktop/mobile before adopting a broader navigation change. |
| CV-046 | P3 | Tasks displayed `1 matching items`; RU task result count strings also use fixed noun forms. Reports browser title stays English in Russian UI. | Open: audit shared work/result counts and document titles, then localize system copy without translating user-authored names. |

## Graphic style review

The existing restrained blue/teal palette, colored icons, selected-row borders and Reports category accents provide a coherent foundation. Russian Reports cards stack cleanly at 390px, and the mobile menu switches language immediately. No wholesale recoloring is justified by the observed screens. Prioritize readable type and navigation hierarchy. Color remains supplemental to text and icons; no new status meaning is conveyed by color alone. Home's revised summary labels wrap rather than overflow, including long Russian phrases.

## Verification

- TypeScript: `npm run typecheck` passed.
- Focused regression suite: 30 passed, zero failed (`home-dashboard`, `onboarding-continuation`, `navigation-shell`). First sandbox attempt failed before tests in Node `os.userInfo`; rerun outside the sandbox passed. Existing unsafe/external/API/auth return rejection tests remain passing.
- Local synthetic browser: Russian Home desktop and 390px, English 390px, immediate RU→EN language switch, contextual action names, 14px computed summary text, and no document horizontal overflow at 390px.
- Signed-out synthetic fixture: exact case/section/source hash present in the boundary sign-in link in RU and after switching to EN. The fixture deliberately supplies a server fallback without the hash. This verifies the repaired client URL; a new production OAuth round trip remains a post-release check.
- Synthetic preview does not implement Recent activities transport; its retry notice is not a production regression.
- Production build passed, including migration, canonical web contracts and 18-route mobile parity preflight. React component review found no added data fetch, mutation or conditional hook; the hash subscription has matching cleanup. Integration/release results remain pending. No candidate deployment or live fix acceptance is claimed by these local checks.

## Remaining acceptance

After green integration/release, verify actual sign-in returns to the same Evidence source/document in EN/RU, Home zero/one/multiple counts and both summary action destinations, and repeat narrow layout checks. CV-010/028/029 still need an active test client; CV-009 still needs EU infrastructure/residency evidence. CV-032 remains an independent iOS investigation, not a reason to classify these web findings as resolved.

## Delivery checkpoint

**Delivery checkpoint:** [PR #352](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/352) publishes CV-042–044. The 30 focused tests, typecheck, production build and browser review passed on the implementation slice. A final text-only Russian accessible-name correction retains the visible «Показать все» phrase for voice control; hosted CI is rerunning. Merge, release and production acceptance remain pending; public v229 is unchanged. The isolated release checkout is prepared but has not published a version.

