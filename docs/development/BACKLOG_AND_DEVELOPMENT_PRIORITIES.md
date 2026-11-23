# CaseVant backlog and development priorities - 23 November 2026

## Verified baseline

Production remains **v231**, canonical source `099144c24853eedecc19e7e4396febbd50fb8bd1`; 224 current/retained assets and scoped signed-in EN/RU CV-045/CV-047 acceptance passed. **CV-046 / PR #354 is now merged** as `5acb87af107be0bc3936b70be42cc7492b2505fe` after all 18 checks passed on `a803131c90ee8e4e33130d8c5f14ad49d8289343`. Its release and live count/title acceptance remain pending. A merge is not a deployment.

The execution order below considers impact, readiness and dependencies. P1 rollout gates retain their severity even when external prerequisites prevent immediate work. Historical checkpoints remain in [progress](../../current_progress.md), [backlog](development_backlog.md) and the linked audits; they are not competing current plans.

## Ready work, in execution order

| Order | ID / severity | Outcome and acceptance | Status / next action |
| --- | --- | --- | --- |
| 1 | CV-032 / P2 release reliability | Retain the exact failed Runner report and separately identify recovery-device diagnostics. Preserve actual test assertions, rendering, retry limit and deadlines. | **In progress in PR #351.** Reconciled with current main. Added an independent final report capture so an early miss cannot suppress a late report; preserve early evidence and reject stale attempt identities. Fresh CI required. Underlying host graphics/System App faults remain unresolved. |
| 2 | CV-046 / P3 ready release | Correct work-count grammar and localized browser titles without losing task filters or authored names. | **Merged, awaiting release.** Build exact integrated main, retain previous assets, publish through Sites, verify EN/RU zero/one/plural counts, view changes, reload and 390px layouts. |
| 3 | CV-048 / P1 acceptance coverage | Extend representative authenticated example-package checks into a repeatable package matrix. | **Planned.** Inventory existing coverage first. Next bounded cohort: Logistics, GoldenShell and Desert Water, then remaining category/Canopy variants. Verify two independent copies, save/reopen, exact sources, hypothetical changes, report download and EN/RU narrow layouts. Preserve all existing test cases; handler and browser evidence remain separate. |
| 4 | CV-049 / P3 localization completeness | Audit remaining workspace browser-title routes and result-summary readability against the shipped EN/RU shell. | **Planned discovery.** CV-046 has an explicit route allowlist; `/activity` is not yet mapped, and work summaries retain 12px type. Confirm the user-visible gap before choosing a bounded amendment; do not change authored names or unrelated public-page metadata. |

## Higher-impact work awaiting a dependency

| Priority | ID | Required dependency | Acceptance before closure |
| --- | --- | --- | --- |
| P1 before identifiable uploads | CV-009 | Provisioned EU ClamAV plus processing, storage, logs and backup residency evidence; restore environment | Clean/blocked/unavailable scan paths, retention, legal holds and restore, then deployed EN/RU upload acceptance. Keep the synthetic/de-identified pilot limit until evidence exists. |
| P1 | CV-010 | Active independent synthetic client | Exact intake-version submission, same-version retries, reload, changed-version and revoked/foreign-recipient denial in EN/RU. |
| P2 / P3 | CV-029 / CV-028 | Same active test client | Upload interruption/recovery and panel-scoped translated success notices without repeating actions. |
| P2 | CV-008 | Controlled calendar-provider accounts and designated recipient mailbox | Initial import, timezone/DST, update, retirement, observed refresh delay and actual recipient-specific reminder delivery. |
| P2 acceptance follow-up | CV-011 | Second authorized test staff identity | Independent live Billing role denial/permissions; keep the existing EUR record/reconcile scope. No money-moving provider integration implied. |

No active independent client is recorded. Do not silently convert these dependency gates into new UI features or mark them verified using local fixtures.

## Subsequent development decisions

After the ready work and available acceptance gates: assess inspected source-packet coverage, versioned governed-output branding and moderated source-retrieval usability from the existing product roadmap. External signing, mailbox/SMS delivery, payment execution and rich Word-template fidelity require their own provider/data/permission contracts and acceptance; they are not claimed as MyCase parity or included in this iteration.

Review after each slice: functional behavior, wording, navigation, accessibility, existing-work preservation and actual verification evidence. Update progress and backlog together. Do not use repeated green CI to close an intermittent root cause without evidence.

[Current audit and implementation](../testing/backlog-priority-review-2026-11-23.md) · [CV-032 diagnostics](../testing/cv032-runner-recovery-evidence.md) · [v231 / CV-046 evidence](../testing/cv046-localization-and-v231-acceptance.md)
