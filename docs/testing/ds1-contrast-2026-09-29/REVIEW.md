# DS-1 text contrast acceptance - 29 September 2026

Result: PASS for the bounded DS-1 P2 text contrast amendment, supported by rendered browser measurements, state checks, representative screenshots and independent Codex review. This is not whole-product accessibility or release acceptance.

## Exact source and scope

- Base: `bd8b0e07fe4b9c0eded527e1825f0fa3eb66956c`.
- Branch: `codex/ds1-contrast-2026-09-29`.
- Owned checkout: `C:/PROJECTS/Genesis-Juris-DS1-2026-09-29`.
- Application source changed: `app/globals.css` only, eight inserted lines and one replaced line.
- Before CSS SHA256: `1bbb8063b8716d5533ba0e88eb32950a553720fec6fcda9e16d8086984116b7d`.
- After CSS SHA256: `74849b5b9221665fad2d97310a2ae0cfd79f33185d0ef227a69dc1ebce14af25`.
- Evidence owned: `docs/testing/ds1-contrast-2026-09-29/`.

This closes the assigned text contrast slice from section 2 of the runbook next steps. There are no application JS, data, authorization, PDF, theme-removal, typography or layout changes. DS-2 through DS-4 remain outside this slice. No deployment or GitHub push was performed by this contributor. The coordinator owns main integration, aggregate checks and rollout.

## Reproduced problems and amendment

1. Completed guide numbers inherited dark ink on Office dark green and Falcon After hours dark green. Set white numbers only for Office and the Falcon host. Generic After hours retains its passing dark ink on lighter green.
2. Office source and destination relation tags used dark ink on the workspace blue accent for hover, keyboard focus and active selection. Set white text for both endpoint directions in Office. The selector specificity (0,4) wins over the destination state rule (0,3), including the later workspace token overrides.
3. Idle graph numbers used the node palette foreground on the panel background, failing across Office and narrowly for the Falcon After hours trigger. Use the existing copy token for idle text. The existing later filled hover, focus and selected rules retain dark ink `rgb(6,16,25)` on their palette fills.

Semantic node colors, borders, labels, filled-state shadows and the global focus outline are preserved.

## Actual browser evidence

The local Vite application ran at `http://127.0.0.1:4197` from the exact source above, with fresh owned dependencies and pinned Node 22.23.2. Agent-browser 0.27.0 operated two isolated ordinary browser sessions and a separate native zoom session.

The supplied `synthetic-contrast-fixture.json` was imported through the actual Studio file input. It contains ten synthetic nodes covering all palette values and nine connections. The normal Studio user mode and training-simulation case produced three completed guide steps and the decision-map step. No React state, DOM class or CSS style injection was used to manufacture product states. Theme buttons and real route variants select Office/After hours and generic/Falcon. The helper uses read-only computed-style evaluation, direct existing event handlers, keyboard commands, pointer movement and evidence scroll positioning.

This unsealed synthetic Studio import is evidence for rendering these controls only. It does not resolve or test the separate governed source-v2 upload restriction, case playability, authenticated saving, organization/invitation workflows, production storage or legal/tax correctness. The fixture remained in an unauthenticated local tab; no client data or production credentials were used.

### Ordinary viewport coverage

`before-runtime.json` records four desktop scenarios (generic/Falcon x Office/After hours) at 1366 x 768. `after-runtime.json` records all twelve combinations at 1366 x 768, 1024 x 768 and 390 x 844. These sizes are browser viewport emulation at DPR 1 and CSS zoom 1, not native browser zoom or physical-device testing.

After coverage includes:

- 36 completed guide-number readings.
- 120 idle node readings: all ten palette colors in every scenario.
- 56 selected, 56 keyboard-focus and 56 hover node readings: all ten on desktop, representative trigger/cash-flow nodes on tablet/mobile.
- 96 endpoint readings: source and destination normal, hover, focus and active states in all twelve scenarios.
- 92 recorded focus outlines across guide, nodes and endpoints.

All 420 target text measurements meet 4.5:1 without rounding up. The lowest recorded scoped AFTER ratio is 5.11184069479057:1 for the unchanged Falcon dark inactive destination label. Every expected hover, focus and selection state is asserted; there is no document-level horizontal overflow in these twelve captures. Internal graph scrolling remains expected behavior. Visibility fields mean a nonzero rendered box and CSS visibility, not that every sampled control was simultaneously inside the viewport.

| Rendered mode | Completed guide before -> after | Source filled before -> after | Destination filled before -> after | All ten idle numbers before -> after |
|---|---|---|---|---|
| Office, generic and Falcon | 3.207 -> 5.975 | 2.904 -> 6.599 | 2.904 -> 6.599 | 1.585-2.900 -> 13.633 |
| Generic After hours | 8.322 -> 8.322 | 8.302 -> 8.302 | 8.671 -> 8.671 | 5.650-10.337 -> 14.911 |
| Falcon After hours | 3.357 -> 5.709 | 10.006 -> 10.006 | 7.404 -> 7.404 | 4.494-8.222 -> 12.507 |

Displayed ratios are rounded for readability; assertions use the full recorded values. Filled endpoint ratios are the same for hover, focus and active selection. All 120 matched desktop node hover/focus/selected before-and-after readings preserve foreground, background, contrast, outline and shadow exactly. Their dark ink contrast remains 6.315-11.554:1.

`validate-runtime.py` checks matrix completeness, actual shell classes, dimensions, ten palette values, state flags, ratios, selected dark ink, preserved filled-state colors/shadows/outlines, and current CSS hash. Its result is `runtime-summary.json`.

### Genuine Chrome 200% zoom

The independent helper used Chrome for Testing 154.0.8037.57 with a localhost-only extension calling `chrome.tabs.setZoom` and `getZoom`. Per-case receipts record native factor 1 -> 2, DPR 1.25 -> 2.5, halved CSS viewport dimensions, unchanged outer dimensions within each pair, HTML/body CSS zoom 1 and visual viewport scale 1. These are native zoom checks, separate from the ordinary emulated viewport matrix.

All four generic/Falcon x Office/After hours before-and-after cases validate the correct actual shell classes. Completed guides, all ten idle numbers, both endpoint active/focus states and all ten selected palette fills pass after the amendment. All forty selected-node readings retain dark ink. Native zoom hover coverage and a full sequential Tab-order audit were not claimed. The complete measurements, summaries, source receipt and exact instrumentation are in `native-zoom/`; its review documents the mechanism and limitations.

### Keyboard and focus scope

Ordinary checks establish a target focus, send real Shift+Tab then Tab, and record actual `:focus-visible`; native checks establish Tab modality then focus the target. Existing focus outlines remain `rgb(41,88,184)`, solid, with computed 3px width/offset in ordinary captures. Native 200% DPR 2.5 computes 2.8px width/offset despite the declared 3px rule. Raw evidence preserves those actual values.

The targeted controls visibly retain focus in the reviewed samples. Global focus styling was deliberately unchanged under the coordinator's bounded disposition. This is not an assessment of every focus contrast, touch target, text size, sequential keyboard route or screen-reader announcement. Screen-reader testing is NOT_RUN. No overall UX14/A14/A15 PASS is asserted.

## Independent review and recursive correction

- Writer: Codex contributor `/root/outgoing_history_review`.
- Independent source/cascade reviewer: root Codex, which accepted all three rules after inspecting globals and workspace token overrides.
- Independent native-zoom verifier: Codex helper `/root/outgoing_history_review/ds1_palette_inventory`, using its own session and source hash checks.
- Final root Codex visual review: eight representative PNGs (Office native-200 guide and source-focus pairs, Falcon dark native-200 guide pair, Office desktop destination pair). Root confirmed intended foreground changes, preserved state/focus geometry and layout in these samples, and accepted the bounded slice alongside the completed matrix and tests.
- No Claude review is claimed.

Three early ordinary capture attempts were rejected because smooth graph-centering raced pointer/focus sampling. The harness was corrected to use instant evidence scroll positioning and actual center-point pointer movement, then the complete baseline and after matrices were captured successfully. Those failed attempts are not counted as passes. The native verifier rejected an early dark-labelled attempt whose actual shell was Office, reran both dark modes through the actual theme handler and asserted shell classes in final aggregates. No application change was needed for these instrumentation issues.

## Existing tests and evidence retention

Pinned Node command:

```text
node --import tsx --test tests/studio-guided-wizard.test.ts tests/graph-viewport.test.ts tests/studio-expanded-graph.test.ts
```

Result: 12 passed, 0 failed, 0 skipped, exit 0. `affected-tests-receipt.json` records the exact Node version, command, source hash and log hash. `git diff --check` passes for the amendment. No redundant implementation-mirroring tests were added. The full 22-stage release verification belongs to the coordinator's immutable combined candidate after integration; this local evidence does not substitute for it.

The repository retains the two full ordinary matrices, two full native matrices and summaries, reproducible capture/validation instrumentation, synthetic fixture, source/test receipts, and a bounded set of 23 PNGs (17 ordinary and six native). Text evidence is canonicalized to UTF-8/LF for portable Git blob hashes; original capture bytes remain in the local raw directory. The original UTF-16 test log is retained exactly. `EVIDENCE_SHA256.json` hashes all retained evidence except itself, and every manifest hash is checked against the staged Git blob. Raw captures, failed attempts, installation/server logs, native raw command logs, browser profiles and binaries remain outside Git in the owned tools directory. PNGs show only the synthetic local fixture.

Representative images are named by phase/host/theme/viewport; native pairs live in `native-zoom/before/` and `native-zoom/after/`. The writer visually inspected Office desktop guide, tablet destination, mobile destination, Falcon dark guide and native Office focus samples. The independent root review above adds the corresponding before-and-after comparison; not every raw image was individually inspected.

## Reproduction and handoff

1. Use this exact CSS hash on the assigned base; install dependencies with the repository's pinned Node/npm in an owned checkout and start the local web server on 127.0.0.1:4197.
2. Open owned agent-browser sessions `ds1-contrast` at `/studio?lang=en` and `ds1-generic` at `/?lang=en&view=studio`. Import the supplied synthetic fixture through the actual file input in each.
3. Run `capture-runtime.py after` with the recorded local paths, then `validate-runtime.py`. To repeat the baseline, use a separate checkout of the recorded base and `before`; do not overwrite application source during a shared verification run.
4. For native zoom, copy the scoped instrumentation into an owned tools directory, follow `native-zoom/README.md`, run `run-matrix.mjs after`, then `summarize.mjs after`. The recorded harness paths document the original environment; adapt them for a new owned environment. Do not copy browser profiles or raw command logs into Git.
5. Integrate with then-current main normally, preserve the verified CSS bytes, run the full required aggregate gate and hosted checks, then perform the coordinator's approved rollout sequence. Do not treat this DS-1-only commit as production release approval.

Owned ordinary browser sessions and the local dev server were closed after evidence collection; the native verifier closed its own session. Profiles and raw evidence remain available locally for reproduction. See `cleanup-receipt.json` for recorded identities and residual-process limits.
