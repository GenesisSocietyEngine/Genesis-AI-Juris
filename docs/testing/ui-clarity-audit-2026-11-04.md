# UI/UX clarity audit — 4 November 2026

## Source and preservation

Canonical main/local starting source is `ef8513624e9739b317ae50f8b2b7c7f8dd5d4502`, clean and matching remote before editing. Both public origins still identify runtime `5e5840e23ac1da4141741accc178032a3273594b`; intervening main changes are documentation only. This slice uses a separate linked checkout and ports 4201/4202. The active user port 4199 preview, existing cases and unsaved tabs are not restarted, claimed or edited. No production case save/import/export/disposal or AI/provider action occurs.

## Findings and bounded implementation

1. **High — narrow organization/account controls occupy accidental parallel columns.** At actual production 390 × 640, the lower rail is 299 px wide but organization controls get 149.59 px and footer 133.41 px. Computed footer placement is grid-column 2 / grid-row 1. The earlier mobile header rule in workspace-design.css survives inside the newer drawer. Reset grid placement inside the drawer and explicitly give the lower rail one shrinkable column. Preserve all existing organization/account/departure handlers and owner-only visibility.
2. **Medium — Overview repeatedly names no destination.** Six empty-case warnings each render “Open the relevant control”, yet the existing resolver sends all six to the same brief builder. Group only exact equal callback targets (including node/type/developer fields), provide one named action and retain every original warning visibly below it. Non-empty cases keep distinct node-type targets and named record actions. Use a consistent accent frame and 44 px minimum target. Do not change validation, fabricate progress or hide evidence/authority warnings in hover text.
3. **Follow-up — Overview action return uses Review.** The actual application correctly focuses the existing brief editor; its Back to case actions control goes to Review. That is the current shared action-return behavior, not a verified return to Overview. Separately design origin-aware return with stale case/account/language fences and preserved Review finding identity. Do not mix it into this presentation-only slice.
4. **Follow-up — Review still repeats empty-case builder cards.** Review's action model retains finding-specific review IDs and return behavior. Any consolidation there needs a separate workflow design/test; grouping by visual title would lose that distinction. Measure it before extending this Overview treatment.

## Step review and checks

The implementation changes three presentation files and existing Overview tests. No persistence, schema, source IDs, factories, authority, recovery, source body or report/PDF input is changed. Grouping builds new presentation arrays; it never mutates draft or validation objects. React review checks instance-local render state, stable target keys, unchanged handlers, native button semantics, visible keyboard focus, long-text wrapping and no new dependencies.

Focused Overview/navigation checks pass 28/28, including distinct exact callback sets, all original EN/RU warning strings and immutable synthetic draft bytes. Strict typecheck and touched-component lint are run separately; full candidate/main CI is not inferred from focused checks.

### Browser observations

Production baseline uses a new blank test tab only. The original browser connection disappears during local preview opening; a fresh inventory identifies the authorized Chrome Maxim profile under its new connection. No existing user tab is reclaimed/reloaded to recover access.

Local synthetic component fixture uses the actual Navigation and Overview components, a clearly labelled synthetic session with a deliberately long organization/account name, and a callback sink. It has no real account/API authority, production handlers or persistence. At actual 390 × 640, document/scroll widths are both 375 px; organization, footer and lower rail each measure 303.35 px with one column and automatic footer placement. The long RU labels wrap; the visual drawer is retained. Native Escape closes the drawer and returns focus to Menu. The one Overview action measures 44 px; all six warnings remain visible. Native Enter yields the exact step 1 / studio-case-brief callback. These are component-browser checks, not authenticated persistence acceptance.

The full local application creates one blank unsaved test draft. Its Overview shows one Write case brief action and all six structural messages. Native Enter focuses the actual studio-case-brief textarea. Existing Back to case actions goes to Review and is explicitly recorded above. A complete narrow EN action-group screenshot is retained. No case content is entered, saved or sent to a provider.

### Continuing limits and delivery gates

Record short-height EN/RU final-candidate observations, non-empty destination labels and candidate/main CI separately as they complete. Production acceptance of this amendment remains pending until a new Sites receipt exists. The earlier exact 390 × 640 production capture anomaly, unattributed message-channel errors, S03/S05 authenticated saves, identity/timing, historical packages/artifacts/pagination, missing-original disclosures, full record/PDF locks and operator/commercial limits remain open in their existing scope. PR217 editor-restart run 41812300264 attempt 2 is now observed successful; the first DNS/artifact failure remains retained history, distinct from the earlier exact-runtime Tax launch failure and PR215 investigation.

## Final candidate review

Strict typecheck and touched-component lint pass with no errors/warnings; the strengthened exact callback-set check and existing navigation tests remain 28/28. At actual 390 × 480, EN/RU long synthetic organization/account labels remain in one 303.35 px column, page/scroll width both 375. Keyboard Tab reaches More at the bottom without overflow; Escape returns to Menu. Non-empty Canopy shows Review case context and Add evidence as two separate 44 px actions; Enter on Add evidence returns the exact step 3 / studio-evidence-composer / evidence target. This is the callback sink, not an inserted record or save.

Full local application is also inspected at actual 1280 × 800 (page/scroll width 1265), with a valid desktop screenshot. Temporary viewport operations affect the currently selected tab; measurements are taken from each bound page before classifying evidence. A mistakenly named desktop fixture image was measured as 390 × 480 and renamed short-en-canopy.jpg rather than counted as desktop proof. The static fixture does not serve the brand asset; its missing logo is a fixture limitation, while the full application serves the real logo. No product asset change is inferred from that fixture.
