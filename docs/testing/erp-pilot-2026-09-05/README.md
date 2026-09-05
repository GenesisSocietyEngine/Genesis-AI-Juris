# Synthetic ERP pilot acceptance packet

Status: prepared, not executed. No professional trial or tenant-isolation claim is recorded here.

Use the existing versioned ERP case at `content/cases/failed_erp.json` and its authoritative scenario at `content/cases/failed_erp.scenario.json`. The three Markdown sources in this directory are fictitious companion evidence for a follow-on dossier demonstration; review and map them explicitly, rather than silently overwriting the authoritative case.

## Documents

- `01-incident.md`: incident and scope.
- `02-event-log.md`: synthetic source timeline.
- `03-control-plan.md`: required controls and two proposed remedies.

## Five observable journeys

| Journey | Acceptance evidence | Current state |
| --- | --- | --- |
| Create/resume | Named dossier, lifecycle separate from readiness, original-tab sign-in/save, reopen exact state | NOT RUN |
| Source versions | Retain original/revised bytes and hashes; old anchors remain attributable; report freshness changes | NOT RUN |
| Reviewed decision | Human acceptance of proposed evidence, exact source anchors, versioned graph and snapshot-bound output | NOT RUN |
| Roles | Authorized current reviewer approval; viewer and foreign participant denied; later tenant tests require two real test tenants | NOT RUN |
| Export/restore | Portrait PDF, JSON/manifest, reopened references and supported phone flow; repeat legacy anonymous PDF | NOT RUN |

Record final build/source, actor role, inputs, start/end time, assistance, errors, expected/observed result, controlling evidence and output references for each journey. Product-owner review of synthetic realism is still required before presenting this as a flagship.

The recovery CI includes automated regressions; these do not substitute for five browser journeys or professional trials. Tenant/OIDC and confidential ingestion remain the later P1/Phase C scope.
