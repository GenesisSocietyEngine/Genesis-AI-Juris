# Integrated AI Studio — implementation review

Baseline: canonical/main and local HEAD dff6f4b384a9f3f3694ff8386b2fb9b3b53a598f; clean isolated checkout owned by this task. Production is public v188, runtime 5d7cc10210c561982698b640ec8fde92dab98cd3. Source was opened through the existing Sites project before editing.

Outcome: AI Studio sits directly after Case overview in a shared workspace tab row. Entering Studio presents the existing brief editor, truthful case indicators, and editable document-flow canvas together. Case links stay in the same tab and retain a safe return destination. Existing explicit stage links, saved case identities and proposal/review/apply behavior remain valid.

Acceptance: EN/RU desktop and narrow layouts; visible brief, indicators and canvas on ordinary entry; keyboard operation; explicit Sources/Review/Reports navigation; prompt and draft preservation across internal tabs; guarded external departure; no implicit attachment to a governed case; existing authority, save, history, report and recovery checks. No real case records are edited during browser acceptance.

Implementation and release evidence will be recorded below. This is not yet a production-release claim.

## Implementation review

The shared `WorkTabs` replaces the work-only tab row and is also rendered by the existing Studio editor. AI Studio follows Case overview and is a primary sidebar destination. The existing `/studio` route and all explicit saved-stage URLs remain valid; no new server authority or duplicate editor owner is introduced. Decision-package/report links enter the workbench in the same tab and retain the safe governed-case return context without passing that case ID to the saved Studio loader.

The default workbench reuses the prompt, canvas, palette, history, sources, review and report handlers. Four indicators count current records, evidence records, connections and review items; pending checks display a dash. Workbench/Overview/explicit-stage selection remains distinct in URL history. AI proposals still require review and explicit apply. Technical view remains available from the other Studio sections. Map controls, guided-brief help, report requirements and full AI data-use information use disclosures.

Browser acceptance used the real local application at 127.0.0.1:4173, with anonymous synthetic input only. Ordinary entry displays the prompt, indicators and editable canvas; a manual Trigger increments records from zero to one. Sources → Workbench retains the exact prompt. Home opens the unsaved-departure dialog; Stay retains it. At actual 390×720, English and Russian sections retain the prompt; document width is 375 CSS px with no page overflow, and the textarea is 325.6 px wide. The responsive override was reset. Development hot replacement restarted the isolated synthetic editor while source changed, so final continuity was repeated after the layout refinements. Some browser clicks reported a timeout despite completing; resulting UI state, not the timeout, is the evidence.

React review: one editor/controller owner; no added network requests or provider calls; lightweight indicator derivation; shared navigation retains the existing document-level departure guard; mobile navigation scrolls only its selected tab into view; native buttons/links/details retain keyboard operation. Local TypeScript check passes. Initial regression findings were stale source-shape assertions (updated for the intentional layout) and a stale pre-change build manifest (requires the candidate build); release checks remain pending below.
