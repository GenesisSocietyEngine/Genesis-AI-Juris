# Reviewed source convergence — 29 September 2026

## Sources and scope

- GitHub main before convergence: `8b3ebd73e80f5ef91f8e96588827d6fb31123da7`.
- Reviewed amendment head: `5873ed4397998fc3b9ba84b88b8135dce70f49bf`, obtained from the trusted canonical checkout.
- Amendment aggregate PASS applies only to `efadf24fc186288ce4ee25da5f5a7d9d1eb6baff`.
- Existing main includes organization/invitation candidate `741472684ad8e581ccedb1b6ff8639c6fc26acee` which that aggregate excluded.
- This convergence preserves both histories. It does not certify or deploy the combined source.

## Independent review and resolution

Independent source review approved the amendment versions of the three overlapping files: `.github/workflows/web.yml`, `app/case-report.ts`, and `tests/case-report.test.ts`.
The workflow preserves full history and uses the independently tested migration-history preflight. The report preserves supported LF/CRLF/CR lines, ordered boundary assertions and renderer 5. Unsupported controls remain rejected by governed validation.
Exactly five PDF image hashes change, as documented in the retained `../inv01-p1-amendment-2026-09-29/BASELINE_REVIEW.md`. Comparison rules, fonts, page/layout policy and tolerances are unchanged.

Blob comparison with prior main confirms preservation of `app/organizations/OrganizationsClient.tsx`, `tests/email-invitations.test.ts`, `tests/organization-context-continuity.test.ts`, `.gitignore`, `AGENTS.md`, `parity/mobile-parity.lock.json`, and `package-lock.json`.
Independent publication review inspected the outgoing five-commit history, text/compressed evidence, PDF fixtures and metadata; no high-confidence credentials or private-client indicators were identified. Synthetic examples remain labeled. Images received byte/format review, not OCR.
Original first-failure records and later retest evidence are retained. No blanket staging of canonical untracked files, ownership override, production mutation or live messaging was performed.

## Acceptance boundary

Targeted integration test results and the resulting source SHA will be recorded in `INTEGRATION_RECEIPT.md` after execution. At this merge point those checks are pending.
The full 22-stage gate has not been rerun on this combined source. Earlier local PASS cannot be transferred to it.
Existing-main hosted failures require separate closure: full development-dependency audit, PDF baseline comparison, and iOS native-lifecycle timeout. A source merge is not a production GO.
The current Codex instructions and complete runbook matrix will be linked from `CODEX_NEXT_STEPS.md` in this directory.
