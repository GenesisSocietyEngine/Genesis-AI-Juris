# DS-1 independent native Chrome 200% verification

Result: PASS for the scoped target-control text contrast and preservation checks. This is not overall A15 or release acceptance.

Source: bd8b0e07fe4b9c0eded527e1825f0fa3eb66956c plus the coordinator's three-rule CSS amendment.

- CSS before SHA256 (coordinator recorded): 1bbb8063b8716d5533ba0e88eb32950a553720fec6fcda9e16d8086984116b7d
- CSS after SHA256 (independently checked): 74849b5b9221665fad2d97310a2ae0cfd79f33185d0ef227a69dc1ebce14af25
- Browser: Chrome for Testing 154.0.8037.57, owned session ds1-zoom-probe.
- Import: actual UI file input, synthetic-contrast-fixture.json; no React state or DOM class edits.
- Routes: /?lang=en&view=studio (generic), /studio?lang=en (Falcon).
- Theme: actual navigation theme button handler at 100%, shell classes asserted; then native 200%.

## Results (ratios)

| Mode | Guide before -> after | Source active/focus before -> after | Destination active/focus before -> after | All ten idle nodes before -> after |
|---|---|---|---|---|
| Generic office | 3.207 -> 5.975 | 2.904 -> 6.599 | 2.904 -> 6.599 | 1.585-2.900 -> 13.633 |
| Falcon office | 3.207 -> 5.975 | 2.904 -> 6.599 | 2.904 -> 6.599 | 1.585-2.900 -> 13.633 |
| Generic after-hours | 8.322 -> 8.322 | 8.302 -> 8.302 | 8.671 -> 8.671 | 5.650-10.337 -> 14.911 |
| Falcon after-hours | 3.357 -> 5.709 | 10.006 -> 10.006 | 7.404 -> 7.404 | 4.494-8.222 -> 12.507 |

Forty selected-node checks (ten palette values across four modes) retain rgb(6,16,25) and contrast 6.315-11.554. This includes the office themes where a broad color override could otherwise regress selected text.

All four AFTER cases have genuine chrome.tabs.getZoom factor 2, baseline factor 1, DPR 1.25 -> 2.5, CSS viewport dimensions halved and unchanged outer dimensions within each before/after-zoom pair. HTML/body CSS zoom remain 1. No device emulation calls were used. Browser window dimensions differ slightly between independent session launches; these captures are not aligned pixel-diff baselines.

## Focus and scope

Endpoint focus measurements use Tab to establish keyboard modality followed by direct target focus; the actual browser :focus-visible state is asserted. Active source/destination states and inactive focus states are measured separately. This is not a complete sequential Tab-order audit.

The unchanged global focus rule declares a 3px solid rgb(41,88,184) outline with 3px offset. In this native 200%, DPR2.5 browser, getComputedStyle reports 2.8px width and 2.8px offset; report.json preserves those actual values. No broader focus-ring conformance claim is made.

Computed contrast is calculated from rendered opaque foreground/background colors; measurements retain font size, state, rectangle, selection, opacity and raw colors. The validator rejects missing states, wrong host/theme, lost selected dark ink, incorrect zoom receipts and missing screenshots. Inactive translucent relation-tag backgrounds are recorded but are not assigned contrast ratios by this scoped check.

The first generic dark-labelled attempt retained the office theme; that attempt was rejected, both dark modes were rerun through the actual theme handler, and the final BEFORE aggregate validates the correct four shell classes. The AFTER harness asserts these classes before any capture.

## Evidence

Full measurements: before/report.json, after/report.json.
Validated condensed data: before/summary.json, after/summary.json.
Source receipt: after/source-provenance.json.

Suggested representative image pairs for the repository (raw directories contain additional captures):
- before/generic-office-guide.png and after/generic-office-guide.png
- before/generic-office-source-focus.png and after/generic-office-source-focus.png
- before/falcon-after-hours-guide.png and after/falcon-after-hours-guide.png

The office guide, office focus and corrected generic dark guide screenshots were visually inspected; the amended Falcon dark guide was also visually inspected. The entire set of 24 screenshots per phase was not individually visually reviewed.

Reusable instrumentation: run-matrix.mjs, summarize.mjs, manifest.json, background.js, bridge.js, probe-100.js, probe-200.js. README.md contains launch commands. The current harness adds read-only outline measurements to the original capture method. Do not include profile/ or raw commands.json in a repository evidence commit unless separately justified.

Official API: https://developer.chrome.com/docs/extensions/reference/api/tabs#method-setZoom

Both matrix runs finished; only the owned browser session was closed. No application source, Git state, credentials, production environment or other browser session was changed by this verifier.
