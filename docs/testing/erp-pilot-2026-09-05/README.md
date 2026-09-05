# Synthetic ERP pilot acceptance packet

Status: five automated journeys executed through the real API and isolated D1/R2.
The anonymous desktop entry now presents an immediate safe sign-in action;
authenticated browser/phone journeys and professional trials are still pending.

Use the existing versioned ERP case at `content/cases/failed_erp.json` and its authoritative scenario at `content/cases/failed_erp.scenario.json`. The three Markdown sources in this directory are fictitious companion evidence for a follow-on dossier demonstration; review and map them explicitly, rather than silently overwriting the authoritative case.

The separate `erp-d365-pilot.studio-draft.json` is an executable synthetic D365
bank-import incident with two remedy alternatives. The integration harness
publishes this fixture only into its disposable test catalog; it does not change
the released ERP case or publish a production template. Run
`node --experimental-sqlite --import tsx --test tests/p1-organization-erp.test.ts`.

## Documents

- `01-incident.md`: incident and scope.
- `02-event-log.md`: synthetic source timeline.
- `03-control-plan.md`: required controls and two proposed remedies.

## Five observable journeys

| Journey | Acceptance evidence | Current state |
| --- | --- | --- |
| Create/resume | Named dossier and scoped list/detail reopen; unknown identity and foreign organization denied | API PASS; anonymous sign-in entry PASS; authenticated return pending |
| Source versions | Three sources plus revised bytes/hashes; original remains downloadable; later source update makes output stale | API PASS; browser file selection pending |
| Reviewed decision | Explicit document, anchor and assertion review; actual play-session decisions complete before exact package linkage | API PASS; observed professional review pending |
| Roles | Separate organization and dossier roles; reviewer approves, viewer/foreign organization denied; revocation blocks reads and uploads in flight | API PASS with distinct persisted test organizations; browser accounts pending |
| Export/restore | Actual portrait PDF and JSON snapshot, exact source/scenario references, reopened output and stale approval rejection | API PASS; phone handoff/download and browser restore pending |

Record final build/source, actor role, inputs, start/end time, assistance, errors, expected/observed result, controlling evidence and output references for each journey. Product-owner review of synthetic realism is still required before presenting this as a flagship.

The web CI retains PDF/JSON evidence from the new API harness. Read the exact
source receipt in the implementation PR. These regressions do not substitute
for five browser journeys or professional trials. See
`docs/development/P1-ORGANIZATIONS-ERP-2026-09-05.md` for bounded validation-plane
isolation and the remaining identity/KMS/confidential activation gates.
