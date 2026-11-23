# CV-046 localization and v231 acceptance · 23 November 2026

## Release and CI

PR #353 merged as `099144c24853eedecc19e7e4396febbd50fb8bd1` after all 18 checks passed. The initial native run 45125743802 and editor run 45125737038 timed out. Only their failed jobs were retried, on unchanged head `7a6074a1df757d388d12989b70406967c5e6bd46`; both attempt-2 runs passed. Editor artifacts independently verify all six write/read processes; native internal lifecycle attempt 1 passed on the workflow rerun. Retained initial failure diagnostics do not establish a new cause or close CV-032. PR #351 remains separate.

Exact merged main was built and published as **v231**. Sites mirror `af1d5e89f90cbd614b1923e9b63cbeefb92b0d75`, environment revision 42, unchanged public audience and bindings. Checkout-only CRLF differences were normalized to committed bytes before the final release build; source provenance and previous-version retention passed. All **224/224** live assets match (166 current, 58 retained from v230). [Native receipt](receipts/cv045-cv047-v231.json) and [asset receipt](receipts/cv045-cv047-v231-assets.json).

## CV-045 and CV-047 live acceptance

- Signed-in owner on casevant.pro, existing synthetic release-audit case, no persistent data changes.
- EN/RU exact Evidence URL resolves source `source_anchor_cbb6101229894248b1ef5b08d1493a64`, document version 2, through authorized loading. Focus lands on that exact source after asynchronous loading and reload. Desktop source top approximately 517px in 1280×720; mobile top approximately 630px in 390×844. Language switching retains exact identity. [Live Russian evidence](receipts/v231-evidence-ru.jpg).
- Desktop keyboard End selects Audit; its complete selected tab remains visible in RU and EN. Reload retains Audit. Compact case identity remains present. Case details/checks disclosure still contains working Technical details with revision 10.
- At measured 390px width, mobile section selector opens Audit; EN/RU content stays within the viewport without document horizontal overflow. Home disclosure starts collapsed, keyboard Enter exposes all 12 section destinations; Tasks opens from that menu. Russian Home disclosure also exposes 12 destinations. This verifies route availability, not a fresh end-to-end audit of each destination's module.
- Local synthetic desktop exact-source acceptance also passes EN/RU and RU reload; no fixture writes. The missing-fragment fixture does not implement the disposition endpoint, so it is not claimed as live denial acceptance. Existing negative controller regressions remain the evidence for missing/denied sources. No fresh sign-out/OAuth cycle in v231; v230's separately recorded OAuth URL restoration is unchanged.

CV-045 and CV-047 are production-verified for the requested navigation, exact-link, reload and responsive flows.

## CV-046 candidate

Outcome: grammatically correct filtered-work and loaded-case counts, and browser tab labels that follow the current workspace view and language without exposing authored names or private identifiers.

- `workResultSummary` handles counts independently: English singular/plural and Russian one/few/many, including zero, teens and 21/22/25. Existing filtered result and authorized case arrays are unchanged.
- Shared pure workspace view definitions feed both navigation and browser titles. A small root client effect updates known workspace route titles on locale/view changes. Unknown/public routes retain their existing metadata. This is hydrated browser title localization, not a change to server-rendered SEO metadata.
- Local real WorkClient fixture: EN 18, 6, 1 and 0 results; RU 6, 1 and 0 results. Search `prospective` survives language switches, reload and Tasks → Reminders → Tasks. Browser titles switch immediately between Tasks/Задачи and follow Reminders. Authored `Call prospective client` stays intact.
- 390px EN/RU checks: no document horizontal overflow; Russian result text and controls remain readable. [Russian mobile preview](receipts/cv046-mobile-ru.jpg).
- **35 focused tests**, TypeScript and production build pass. Test matrix covers zero/one/few/many/teens and independent loaded-case totals. Existing navigation, departure guards, saved-context and Home regressions pass. Sandbox Node/esbuild restrictions required rerunning the affected tooling outside the sandbox; successful results are from those completed runs.
- React review: one title synchronization effect, primitive dependencies, no added fetches or draft state; shared constants avoid importing a styled component into the title formatter. No storage, authorization, provider or migration changes.

CV-046 remains a tested candidate pending CI, merge, release and live acceptance. CV-010/028/029 await an active client; CV-009 awaits EU infrastructure evidence; CV-032 remains open. No new invitations or grants created.
