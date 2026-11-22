# CaseVant backlog and development priorities · 22 November 2026

Current public version: **v229**, confirmed through Sites on 22 November. Canonical base for this audit: PR #350, `d77267b3`. This file is the current work order; historical milestones remain in [development_backlog.md](development_backlog.md) and their linked evidence. Local verification is not production acceptance.

## Current implementation

CV-042/043/044 address the confirmed sign-in fragment loss, Home count grammar and Home readability/accessibility findings. Typecheck and 30 focused tests pass; synthetic EN/RU browser checks pass on desktop/narrow layouts. Production build passes; integration and production acceptance are pending. [Audit and acceptance](../testing/ux-graphic-audit-2026-11-22.md).

## Next unblocked work

| Order | Item | Deliverable and acceptance |
| --- | --- | --- |
| 1 | CV-042 · P2; CV-043/044 · P3 · Current candidate | Complete build/CI, integrate and release exact reviewed source. Verify real EN/RU sign-in retains source/document fragment, Home counts agree at zero/one/multiple, and summary actions preserve their filters. Recheck 390px readability. |
| 2 | CV-045 · P2 · Navigation hierarchy | Reduce case-header/navigation density and reveal the selected case section in the horizontal tab viewport. Preserve every route, exact case/document/thread context and unsaved-work guards. Compare EN/RU desktop and 390px before publication. |
| 3 | CV-046 · P3 · Remaining count/title localization | Correct task result counts (observed `1 matching items`) and localized browser titles. Verify zero/one/few/many and language switching; preserve user-authored names. |
| Separate CI track | CV-032 · P2 · iOS startup investigation | PR #351 remains open at `6473dac0`; do not mix its independent diagnostic work into this UX branch. Retain exact Runner/System App failure evidence and verify workflows before claiming a root-cause fix. Passing retries do not close this item. |

## Work awaiting a dependency

| Priority | Item | Dependency and acceptance |
| --- | --- | --- |
| P1 before broader upload use | CV-009 · EU upload rollout | Provisioned EU scanner, runtime/storage/backup residency evidence and restore environment. Verify clean, blocked and unavailable paths plus legal-hold-aware recovery before enabling identifiable files. [Evidence](../testing/cv009-portal-upload-rollout.md). |
| P1 | CV-010 · Server-authorized intake receipts | An active synthetic client. Verify exact-version submission, idempotent retries and reload in EN/RU, including changed-version, revoked and foreign-recipient denial. [Evidence](../testing/cv010-server-intake-receipts.md). |
| P2 | CV-029 · Client upload recovery | An active synthetic client. Verify definitive rejection clears selection and consent; interrupted receipts retain same-action retry in EN/RU. |
| P3 | CV-028 · Portal notices | The same active client. Verify translated confirmation stays within its originating panel. |
| P2 | CV-008 · Calendar providers | Controlled Outlook/Google accounts and designated test mailbox; verify import, time zones, updates, retirement and actual reminder delivery. |
| Follow-up | CV-011 · Billing role acceptance | A second authorized test staff identity; verify role boundaries for the shipped EUR register. |

No active test client is available. CV-010/028/029 stay pending; this iteration creates no invitation or client grant. Local synthetic notice/draft tests are separate from live recipient acceptance.
