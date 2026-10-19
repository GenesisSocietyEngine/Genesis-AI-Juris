# Review and connection remediation: execution plan

19 October 2026. This plan takes priority over the next-slice order in the 18 October refinement plan. Historical delivery receipts remain valid for their exact sources; they are not acceptance of this candidate. Follow repository AGENTS.md and the [audit record](../testing/review-connections-2026-10-19.md).

## Current source and release boundary

- Production was rechecked as public Sites v146 at https://casevant.pro. Its recorded runtime is `4b32993283c03f7b02d7c5f1edc27230d19a4d62`; canonical main is `f03890445cd985b1535cc4f267b05888ba506ed3`.
- [PR 140](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/140) contains the review/connection correction. The audit began at `ee9da238f3c936baa12aefb846f3283848020802`. Subsequent corrections need their own exact-head CI result. None of this candidate is claimed deployed.
- That head's full web run built successfully and reported 1,623 passed, one failed, three skipped. The failure was an obsolete assertion for the removed inline destination selector. PDF visual verification passed, including the 47-PDF cohort, bilingual Base/Medium and tax-v2. Later packaging/security jobs were skipped after the test failure; they are not passed evidence.
- The supported Sites helper's hidden-stdin credential handoff was rejected again by automatic approval policy (`sandbox_approval` disabled). No source-open receipt, package or deployment resulted. Do not try another credential transport or manually bypass the helper. Source correction/checkpoint delivery can continue separately.

## Step 1 — finish the bounded correction (application + UX)

Outcome: a user can identify the blocking issue, open its correction, inspect existing connections, deliberately add a new connection, and save the working draft without ambiguity.

| Area | Required behavior | Positive and adverse acceptance |
| --- | --- | --- |
| Reports | Review needed is a native button opening focused Review actions | Click and keyboard activation; EN/RU; correct context/node target; return to Review; no automatic save, privacy change or evidence approval |
| Blocker priority | Correction action matches the displayed blocker | Read-only, pending/failed analysis, oversized draft, private visibility and validation warning; oversized private case must not send the user to visibility first |
| Connections | Existing incoming/outgoing edges are visible separately from Add connection | Selection alone makes no edit; chosen target remains after add/search/paging; connected destination cannot be added twice; reverse edges retain their actual direction; missing endpoints remain explicit |
| Search | Active destination filter remains clearable | With 13 candidates, filter to the last candidate and add it; remaining 12 stay reachable after clearing; at 200 nodes, options stay bounded to one page plus selected target |
| Persistence | Edge addition uses the existing history/save path | Add → undo → redo → Save → independent reopen/export; graph fingerprints/history and unrelated fields retained; selection itself is transient, the saved connection is durable |
| Attention | Exact validation findings have red frames plus readable text | Main map, list, expanded map and inspector; selected/focused border remains visible; correction clears marker; case-level context never paints unrelated nodes |
| Reachability | Explain connected-but-unreachable and missing Trigger separately | No-start model directs to a connected Trigger composer, preserving existing edges; disconnected component targets its exact node; invalid-only links do not count as valid connections |
| Focus | A node action reveals its real control | Starting from List or Overview, open Review and inspect affected node; return to detail at readable zoom and focus/scroll to the exact node; case-level actions do not rearrange the map |

Review after this step: inspect wording, keyboard focus, long labels and narrow/short-height layout. Ensure warning text does not cover connection handles. Check local deferred-panel failure/retry retains current case/authority props. Do not weaken server validation or automatically connect/rewrite the user's model to make indicators green.

Professional-model follow-up: the current structural validator still uses directed Trigger reachability. This release clarifies that existing requirement. Whether non-playable professional cases should use a different connectivity rule requires a separate category-aware client/server contract review; do not silently relax publication gates in a presentation patch.

## Step 2 — verification (QA + application)

Use pinned Node 22.23.2 and the unchanged lockfile. Run the following focused cohort, TypeScript and changed-file lint, then canonical web/PDF release CI on the final candidate. Preserve the 325,000-byte entry cap and aim for at most 320,000 bytes; record measured current bytes rather than copying v146's count.

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --import tsx --test tests/studio-review-connections.test.ts tests/studio-performance.test.ts tests/action-destinations.test.ts tests/studio-expanded-graph.test.ts
node --experimental-sqlite --import tsx --test tests/studio-continuity.test.ts tests/studio-revisions.test.ts tests/studio-editing.test.ts tests/studio-session-authority.test.ts tests/category-demos.test.ts tests/domain-integrity.test.ts
node scripts/build-portable.mjs
```

Browser matrix: desktop and narrow/short-height, EN and RU, editable and inspection-only, map/list/expanded, empty/filter/no-match/long-label cases. Use a new clearly labelled synthetic case only when writes are necessary. Test actual first-click Save and independent reopen after the changed connection flow. Keep all existing cases, including the user's case 42 and unsaved tabs, untouched. Handler/component tests establish logic, not browser geometry or authenticated persistence.

Record exact commands, source SHA, pass/fail/skip counts and artifacts under docs/testing. Do not add overlapping cohorts together. If preview or authentication is unavailable, state the exact unverified checks; never mark the row complete from source inspection alone.

## Step 3 — ordinary integration and rollout (release owner)

1. Re-read canonical main, PR head, required checks and current Sites version/source. Preserve concurrent work. Review only intended source/docs; no credentials, user records, generated databases or local artifacts. Push the reviewed checkpoint and update PR 140 with the final scope and evidence.
2. Resolve failing checks and material findings. Use ordinary PR/main controls, without force-push, rule bypass or changing historical visual/source locks to obtain a pass. A pending deployment gate is not proof of a failed source checkpoint.
3. Once the supported execution environment permits it, get a fresh source credential for existing project `appgprj_6a88a26d2f808191aa076b9fcd8dbce6` and open through `site-workflow.mjs` using hidden stdin. Keep the complete successful opening result. Preserve public audience and D1/R2 bindings.
4. Build exact merged main with a clean checkout and verified raw release-input hashes/sourceCommit. Do not release a PR build as if it were the merged source. If canonical main moves, reconcile before packaging.
5. Obtain the actual current live predecessor's saved archive, verify its recorded hash and extract into an owned artifact directory. After the build, run `scripts/retain-client-assets.ts` with `--previous-dist`, `--expected-previous-commit` and `--expected-current-commit`. Never hard-code v145 or use an unpublished candidate as predecessor; v146 is only the last confirmed live state.
6. Package with the supported helper, passing the successful opening result, ordered remaining checks/build commands and absolute archive path. Save that exact verified commit/archive with Sites, then deploy the returned saved version to the existing audience. Retain the compatible predecessor for rollback.
7. Confirm terminal native deployment status. Run `scripts/verify-deployment-assets.ts` against both casevant.pro and the native origin with exact current and predecessor commits. Require bytes/MIME for current and retained assets, then inspect the changed live flow and authenticated synthetic save/reopen/export. Static success alone is not hydration or account-workflow evidence.
8. If deployment or changed-flow verification fails, retain receipts, diagnose the specific failure and use the compatible saved-version rollback procedure if needed. Do not edit user data as part of rollback. Close this plan only with exact main/source/version/deployment identity, measured checks and explicit remaining limits.

## Ordered work after this release

| Priority / owner | Concrete next action | Completion evidence |
| --- | --- | --- |
| P1 QA + data | Inventory all 18 package/version carriers before implementation; exercise old-client and unknown-field roundtrips | Placements, source/tax/evidence/protection retained; unknown versions recoverable; cancel writes nothing; stale CAS refused; independent A/B save/reopen/export matrix with historical imports |
| P1 application + QA | Test real same-tab A→B account transitions using authorized identities | Late-response and cancellation evidence without disturbing existing sessions; separate-profile tests do not close this row |
| P1 product + operator | Prepare service-readiness and permitted-data evidence packet | Actual access/retention/export/deletion, AI processing, incident/recovery and support-owner review; no implicit policy changes or claim of unrestricted confidential use |
| P2 UX | Measure the four retrieval tasks before further report redesign | At least five evaluators; authorization, evidence gap, responsible actor and next action; proposed median 30 seconds/80% qualified-answer targets remain hypotheses |
| P2 commercial lead | Prepare consented pilot with 5–8 users across 2–3 organizations | Distinguish buyer/user, alternatives, repeat use, willingness to pay and support effort; approved data boundaries and stop conditions before recruitment; no invented demand or price |
| P2 content + domain | Acquire source bodies with exact versions and provenance | Preserve the 43 missing-original disclosures until authentic bodies or clearly labelled synthetic excerpts exist; immutable IDs/sections/hashes and source-qualified citations |
| P2 QA | Extend browser/touch coverage | Safari/Firefox/Edge, narrow/short-height palette, pointer fallback and exact save/reopen; retain all synthetic evidence |
| Conditional data + governance | Design user-edit carry-forward only when requested | Historical/current/working three-way comparison, per-conflict choices, full carriers, new identity and zero-write cancellation; independent template copies are not this feature |

Preserve the complete 254-page Full output, current Base/PDF locks, historical factories/hashes and every saved case. Each new slice starts with its own user outcome and acceptance, ends with an evidence review, and updates this ledger without relabelling planned work as delivered.
