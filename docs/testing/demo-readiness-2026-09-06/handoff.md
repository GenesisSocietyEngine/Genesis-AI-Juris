# Canopy local candidate handoff — 6 September 2026

The isolated local candidate implements Project Canopy — Managed-site expansion gate and supplies actual reproducible API receipts, four snapshot-bound PDF/JSON outputs and an offline comparison. Production lane A remains BLOCKED. This handoff closes the authorized local implementation scope; it does not declare the complete live meeting path accepted.

## Candidate identity and entry points

- Branch: `codex/demo-readiness-canopy-2026-09-06`.
- Authorized starting commit: `47d99d08dc730e15ab881ba09de09692a4c7ba7c`; tree `25b069b15c14e58dbb4786912039369156ff8ed1`.
- Main ancestor: `e025131d87e35d4364d542acc5c84b6097eb657b`; tree `c47f1951d1573e8f72b6c7e6872239f8beb23c39`.
- Exact final local commit/tree and verification log hashes: [candidate-identity.json](../../../.artifacts/canopy/candidate-identity.json), written after the local commit to avoid a self-referential tracked SHA.
- [Open the offline packet](../../../.artifacts/canopy/index.html), [checksums](../../../.artifacts/canopy/SHA256SUMS.txt), [actual comparison and final output states](../../../.artifacts/canopy/comparison.json), [PDF verification](../../../.artifacts/canopy/pdf-verification.json), [visual review](../../../.artifacts/canopy/visual-review.md).
- [Components and reproduction](local-demo.md), [ten-minute presenter script](presenter-script.md), [fallback and video storyboard](fallback-plan.md), [production evidence matrix and unapplied change proposal](production-verification.md).

Both prior documentation commits and their original evidence receipts remain ancestors. The original dirty checkout was preserved. No push, PR change, merge, deployment, production migration, environment change or outreach was performed in this local lane.

## Implemented result

The new fixture contains D01–D09, with eleven immutable source versions including D03/D06 v1 and v2. Every graph edge has precise source bindings. The reviewed scenario declarations use the existing Studio compiler and play-session contracts, with 14 nodes and 13 edges. Normal dossier APIs provide storage, review, snapshots, exact-output approvals and stale-state authority.

The `/canopy` Featured page prepares a private Matter, sources, anchors, evidence questions and pending proposals, and displays expected scenario differences. The helper implements explicit source/proposal review, deterministic replay, sealing and clean-copy creation. The local route harness exercises those operations and the normal authorization policies in disposable Miniflare D1/R2. Prepared proposals have no live-model provenance and require explicit review. Automated review assertions are not human-review observations.

| Scenario | Actual completed terminal | Controlling difference | Final output state |
| --- | --- | --- | --- |
| Base | `studio-conditional-pilot` | 300 signed versus 450 minimum; commissioning/leadership gaps; production prohibited pending release conditions | Approved PDF retained, later stale after D03/D06 versions change |
| Upside | `studio-approve-operation` | Reviewed v2 evidence, signed 480 within capacity, accepted commissioning and declared staffing | Approved PDF retained, later stale after authoritative assertion change |
| Downside | `studio-defer` | Energy +25%, yield 85%, signed-demand stress 300, payback 3.43 years | Approved PDF retained, later stale after authoritative assertion change |
| Hard stop | `studio-no-go` | Failed/unavailable mandatory clearance terminates before financial gates, even with attractive economics | Current exact PDF approval at the end of the local run |

The workflow preserves original source bytes, prior outputs and audit history; a second clean copy has distinct dossier/document IDs and pending reviews. Snapshot reporting readiness does not authorize production. PDF approval belongs to the exact PDF only; JSON is separately hashed, not implicitly approved.

## Fresh local verification

All log paths below are relative to this worktree's `.artifacts/` directory. Test commands used only synthetic local configuration and disposable storage.

| Check | Actual result | Log |
| --- | --- | --- |
| Full current-code suite | **558 passed, 0 failed, 0 skipped**, including ERP and all four Canopy scenarios | `canopy-full-regression-retest.log` |
| Navigation correction verification | 12/12 passed | `canopy-navigation-retest.log` |
| Strict typecheck, parity lock and application build | PASS; 18 deterministic canonical routes, bundle `18144245b2eb11345a96d86a18ead0804ceef7d26aa3492ad67c6924ebbbe012` | `canopy-build.log`, `canopy-typecheck.log` |
| ESLint | PASS | `canopy-lint.log` |
| Production-only and full dependency audits | Both report 0 vulnerabilities | `canopy-audit-production.log`, `canopy-audit-all.log` |
| Existing report corpus | 47 PDFs, 702 pages/PNGs passed; 55 visual baseline hashes matched | `canopy-report-corpus.log` |
| Canopy artifact verifier | Four receipt chains passed; 170 A4 portrait pages rendered and checked; source/output hashes and snapshot bindings verified | `canopy-artifact-verification.log` |
| Migration 0019 | Fresh/upgrade fixtures, expected 9 tables/5 indexes/19 triggers, active-member backfill, guards and FK rollback; organization isolation through route tests | Included in full suite |

The first `npm test` built successfully and reported 557 passes plus one outdated literal-link expectation. After correcting that assertion, the navigation tests and entire 558-test suite passed. The original failure log `canopy-full-test.log` is retained. The final suite command was `node --experimental-sqlite --import tsx --test '--test-name-pattern=^(?!Canopy:)' tests/rendered-html.test.mjs tests/*.test.ts`; despite the pattern, its recorded execution includes the Canopy parent and all four nested scenarios, with zero skipped tests. Do not describe it as a partial suite.

Node 22.23.2, npm 10.9.8 and Poppler 25.07.0 were used locally with the locked dependencies. No lockfile or dependency version changed. Build-file checks in `rendered-html.test.mjs` do not constitute browser DOM acceptance. The new migration upgrade fixtures do not cover a populated pre-0019 document-version/snapshot/output history; that limit is recorded in the production matrix.

## Snapshot artifacts

Every report starts with a two-page executive memorandum and retains the full source, graph and audit appendix. All 170 pages passed automated rendering/A4/nonblank checks; representative memo and graph pages were visually inspected. No clipped nodes, overlapping labels, truncated titles or broken connector pairs were found on inspected pages.

| Scenario | PDF | Pages | Snapshot ID |
| --- | --- | --- | --- |
| Base | [PDF](../../../.artifacts/canopy/base-dossier.pdf) · [JSON](../../../.artifacts/canopy/base-governed.json) | 36 | `snapshot_c468c311e1aa46499433a05cbd9589d3` |
| Upside | [PDF](../../../.artifacts/canopy/upside-dossier.pdf) · [JSON](../../../.artifacts/canopy/upside-governed.json) | 41 | `snapshot_6f8abad390ae4835b18fbd8caeb15c58` |
| Downside | [PDF](../../../.artifacts/canopy/downside-dossier.pdf) · [JSON](../../../.artifacts/canopy/downside-governed.json) | 44 | `snapshot_7e7821d805794d0090c021d383844555` |
| Hard stop | [PDF](../../../.artifacts/canopy/hard_stop-dossier.pdf) · [JSON](../../../.artifacts/canopy/hard_stop-governed.json) | 49 | `snapshot_b3cb80ab3d1043ae9fc280f6171c881b` |

PDF SHA-256:

```text
6b11de1d9950fad9be7a3bcaa59de85ec0284258aa4c2a31f3db794b23eb3c81  base-dossier.pdf
50f242188541a260dd5f0b747bbe126d505d16f01402765a34dd9927bbaec3e9  upside-dossier.pdf
60eccce3311cddab0ce7d2d00e3997e10f486c509084c791e0128fe51035b727  downside-dossier.pdf
ea7a80044e7f289d499591f8688ca431f2d6f072690d036566b06fe5f3840bd5  hard_stop-dossier.pdf
```

Two nonblocking visual caveats remain: the Alternatives-and-exit citation starts page 2 in the inspected Base/Downside memo; Downside retains the 480-pack source baseline beside the declared 300-pack stress assumption. The presenter script explicitly distinguishes baseline from stress. Rendered images under `pages/` are real PDF screenshots, not application/browser screenshots.

The unchanged ERP source packet and its current-candidate route tests passed. The offline fallback includes its exported PDF, snapshot and original source/Studio files. That retained ERP snapshot was deliberately made stale by its test; no standalone offline ERP approval receipt is claimed. Signature Crop and the 110-second video remain storyboards.

## Remaining gates and precise scope limits

| Classification | State |
| --- | --- |
| `implemented` | Local fixtures, reviewed-declaration graph, normal-API helper, Featured packet preparation, expected comparison, memo projection and offline receipt viewer |
| `locally tested` | Fresh results above; artifact verifier binds source/package/session references, snapshot hashes, PDF/JSON and exact PDF approval; it does not independently replay an exported full session event log |
| `historical CI verified` | Retained e025 main CI receipts only; its earlier 544 tests and native results are not tests of this candidate |
| `production verified` | No new production acceptance claim; current deployment ID/mapping, active environment and full schema/journal/backup evidence remain unverified |
| `not verified` | Ordinary two-account registration, Chrome/Edge owner-reviewer acceptance, normal catalog publication, full authenticated UI journey, real phone, ten consecutive presentation journeys, three cold users, captured video and offline presentation-device opening |

The package lineage is linear: Base → Upside → Downside → Hard stop. Direct Upside → Hard stop is not implemented. Featured cards show expected decisions; they do not execute simulations. Normal Studio publication and an authenticated rehearsal must still establish the meeting path. Canopy-specific Rust/mobile execution is not claimed; released canonical runtime and parity files remain unchanged.

Lane A needs the single current deployment receipt already requested, followed by exact deployment/source/environment/domain mapping and production migration/recovery evidence. The conditional environment proposal remains unapplied. Production changes, push/PR/merge/deploy and rollback require separate explicit approval. Authorization for ordinary synthetic registration persists after P0 and supported-browser access are available; do not ask for that authorization again.
