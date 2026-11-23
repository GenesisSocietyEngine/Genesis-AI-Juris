# v230 acceptance and CV-045 / CV-047 · 23 November 2026

## Released source and production evidence

PR #352 merged after 18 successful checks on `acec0173b2499bd2d83c3766f2c3e71fe7c86b7b`. Canonical squash `dcc98b2bc4c34823d3dcc8047ffcbe181cfdd154`; Sites mirror `7707b2550031958b4fcf262af55df205004c0123`. Official Sites helper published v230; deployment succeeded. No migrations or binding changes. See [native receipt](receipts/cv042-044/release-v230.json) and [asset verification](receipts/cv042-044/v230-assets.json): 166 current plus 90 retained immutable assets, 256 checks, zero failures.

Signed-in production checks used the existing owner and synthetic cases without new writes, invitations or grants:

- EN and RU normal OAuth sign-in restored the exact case, Evidence section, language and source fragment. The original document version 2 was present.
- Home: 2 accessible cases, 0 today, 1 overdue task, 1 open work in both languages with correct agreement. Today and overdue actions opened their exact filters (0 and 1 results).
- RU accessible action retained visible «Показать все». Summary text measured 14px; 390px EN/RU layouts readable, no document horizontal overflow.
- **CV-047 confirmed:** restored fragment alone did not reveal a source rendered after the async case load. On desktop the source top was 4598px while viewport height was 720px and scroll remained zero. URL retention passes; complete source landing acceptance needs this follow-up.

## Candidate changes

CV-045: compact header retains full title, case identity, status and commands. Technical details move into existing Case checks disclosure. Horizontal tabs reveal the selected section on selection, language change and resize without scrolling the page. Home's duplicate section menu becomes a keyboard-operable disclosure; all destinations remain available.

CV-047: recognize only valid `source-*` fragments on Evidence entries without an explicit target, then use the existing authorized exact-record resolver after case loading. Existing target precedence, case identity checks, missing/denied record handling and focus cancellation remain in force. No generic hash selector or implicit review acceptance.

## Verification

- 71 focused tests pass: source-review-presentation, section-visibility, b1-workspace-render, home-dashboard, saved-case-navigation-restore, save-clarity-context and navigation-shell. Typecheck and production build pass.
- Local real-parent browser fixture: EN/RU compact case header; RU desktop header about 148px; selected Evidence visible at 1265px/900px; End keyboard selects and focuses Audit; reload and language switching preserve section. Mobile select and case identity remain visible at 390px.
- Home EN keyboard Enter expands/collapses section menu; Reminders and Workflow templates remain reachable. RU Reminders-to-Home route works; EN desktop and RU 390px presentation reviewed.
- CV-047 synthetic EN/RU fragment entries focus `source-qa-anchor` after load, add exact target to URL and reveal the source in the 390×844 viewport (top about 630px). Reload and language switching retain the exact source. No fixture writes. Production fix acceptance remains pending; desktop exact-source visibility is not separately claimed.
- Synthetic Home transport has no Recent activities response; its retry state is a fixture limit, not a new production regression.
- React review: effects clean up ResizeObserver/animation callbacks; tab strip scrolling does not introduce page scrolling. Existing controlled draft and authorization regressions pass.

## Remaining gates

Candidate CI, integration, release and live EN/RU acceptance remain pending. CV-046 is next unblocked product work. CV-010/028/029 still need an active test client; CV-009 needs EU infrastructure evidence. CV-032/#351 remains independent. No invitation or access grant created for this iteration.
