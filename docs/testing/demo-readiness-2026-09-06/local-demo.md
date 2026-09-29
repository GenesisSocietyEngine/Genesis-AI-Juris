# Isolated Canopy candidate

Continue from authorized commit `47d99d08dc730e15ab881ba09de09692a4c7ba7c` in `codex/demo-readiness-canopy-2026-09-06`. Preserve that commit and `4bf8e73570e8b7a829137cf5496c763b5de8ee84`. The original checkout and dirty sibling are not implementation surfaces.

## Reproduce the available result

Use the repository's locked dependencies and Node 22.23.2. Install Poppler and put its `Library/bin` on PATH or set `POPPLER_BIN` to that directory. Then run:

```text
npm ci
npm run demo:canopy
```

In the supplied Windows worktree, the verified local tools can be selected without changing machine configuration:

```powershell
$env:Path = (Join-Path (Get-Location) '.artifacts/toolchains/node-v22.23.2-win-x64') + ';C:\Program Files\Git\bin;' + $env:Path
$env:POPPLER_BIN = Join-Path (Get-Location) '.artifacts/toolchains/poppler/poppler-25.07.0/Library/bin'
```

Run the two commands above from the isolated worktree root. To regenerate the unchanged ERP fallback as well, run `npm test` before the artifact verifier; the Canopy-only command does not execute the ERP test. Existing verified artifacts can be opened without running a server or reinstalling dependencies.

The command runs the existing isolated Miniflare route harness with disposable D1/R2, then verifies and renders its actual artifacts. It has no production connector, credential lookup, database migration endpoint or live AI dependency. The harness installs the published catalog as test fixtures exactly as the existing ERP test does. Synthetic trusted-dispatch inputs exercise application policies; they do not establish real login, ordinary registration or browser acceptance.

Open `.artifacts/canopy/index.html` after a successful run. It links four PDFs, four governed JSON files, four snapshot manifests, four separate PDF approval receipts, the actual comparison/final output-state receipt, eleven immutable source files and rendered PDF pages. `SHA256SUMS.txt` covers the generated packet. Exact candidate source identity and test results are recorded in [the final local handoff](handoff.md).

For the application surface, `/matters` links to `/canopy` behind the existing `OrganizationBoundary`. The page creates a normal private Matter and prepares sources, exact anchors, open evidence-status questions and pending proposals. It shows expected scenario comparisons and immutable sources. It does not publish catalog packages or claim to execute a simulation when a card is selected. Existing Studio publication, package linking and output review remain authoritative. Normal catalog installation/publication and an authenticated UI rehearsal are still required before treating this page as a complete meeting path.

## Components and contracts

| Component | Role |
| --- | --- |
| `app/canopy-fixture.ts` | Nine fictional documents, eleven immutable versions, four declared scenario packages, exact controlling sections for every graph edge |
| `app/canopy-workflow.ts` | Normal organization-scoped API orchestration for a new copy, explicit source/proposal review, reviewed scenario replay, evidence links and sealed outputs |
| `app/canopy/` | Featured packet preparation and accessible expected-scenario comparison |
| `app/matters/MattersClient.tsx` | Existing Matter workspace; adds Featured entry, selected-dossier navigation and the Canopy disclosure |
| `app/organization-client.ts` | Preserves the selected organization across the new private workspace links; selector remains a hint, not authorization |
| `app/dossier-governed-output-server.ts` | Existing sealed report model and PDF renderer; Canopy's accepted memo assertions precede the unchanged source/graph/audit appendix; renderer 1.1.0 |
| `scripts/build-canopy-review.ts` | Verifies exact local PDF/JSON/source/simulation bindings, renders every PDF page and creates the offline comparison |
| Existing dossier, Studio compiler, play-session and organization APIs | All persistence, review, authorization, graph validation, simulation receipts, approvals and stale-state authority |

No new dossier/case type, storage model, financial engine, anonymous private access, seed migration, auth bypass or reset endpoint was introduced. All scenario graphs use the existing `general_advisory@1.0.0` contract. The prepared Studio fallback is exercised through real play-session handlers. Canopy-specific Rust/mobile runtime parity is not claimed; the released canonical runtime and lock are unchanged.

## Decision and evidence semantics

| Scenario | Expected actual terminal | Controlling interpretation |
| --- | --- | --- |
| Base 1.0.0 | `conditional-pilot` | 300 signed versus 450 minimum, pending commissioning evidence and leadership; only non-production transition work |
| Upside 1.1.0 | `approve-operation` | Reviewed D03/D06 v2, signed 480 within capacity, declared leadership confirmation and accepted mandate assumptions |
| Downside 1.2.0 | `defer` | D07 stress: energy +25%, yield 85%, signed demand 300, payback 3.43; does not rewrite the D03 v2 baseline |
| Hard stop 1.3.0 | `no-go` | Explicitly reviewed failed/unavailable mandatory-clearance stress overrides attractive upside economics |

Package lineage is intentionally linear: Base → Upside → Downside → Hard stop. A clean copy starts again at Base. Direct Upside → Hard stop comparison through a newly linked package is not implemented.

Metric guards encode the immutable declared scenario. They are not measured agricultural, trust, legal or financial scores. The opening applies the reviewed declaration; every subsequent edge explicitly preserves all metrics. The failed mandatory-clearance latch has only the no-go branch available. D07 records transparent precomputed arithmetic and conservative underwriting; there is no new financial calculator.

Initial evidence-status requests make the Matter unready for reporting. Receiving a reviewed source answer records what is known, including gaps; it does not assert that production-release conditions are satisfied. Snapshot readiness, lifecycle status, recommendation and exact-output approval are separate states. The conditional pilot always prohibits production until the recorded conditions are independently accepted.

Prepared proposals are unattributed synthetic fixtures with no live model provenance. They remain pending until explicitly accepted, rejected or edited and accepted. Automated integration review exercises the normal API but is not presented as a human moderation receipt or cold-user observation.

PDF text is projected only from accepted assertions in the sealed snapshot. Later approval is bound to an exact PDF and appears in its separate receipt. Later evidence updates mark older outputs stale while preserving the PDF, original versions and audit history. The JSON output is not independently approved by the PDF approval.

## Evidence boundaries

- `implemented`: local source, helper, Featured packet UI, expected comparison, memo projection and reproducible verification command.
- `locally tested`: only commands/results in the final handoff, with exact candidate source identity.
- `historical CI verified`: the separately retained e025 main receipts; its 544 tests are never counted as tests of this source.
- `production verified`: no new claim. Current deployment identity, environment mapping and full migration/backup evidence remain unverified.
- `not verified`: normal registration/browser owner-reviewer flow, package publication in a normal environment, complete UI journey, phone handoff, ten full presentation rehearsals, three cold users and genuine captured video.

The original `preflight.md`, `evidence.json` and `SHA256SUMS.txt` are historical receipts from the retained documentation commits. Their original checksum applies to that recorded source state, including the earlier plan. The live `plan.md` is intentionally updated by the later owner clarification; do not rewrite the historical manifest to conceal that change.
