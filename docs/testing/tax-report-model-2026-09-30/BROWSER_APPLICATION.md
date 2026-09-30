# Actual browser tax report journey

On 2026-09-30 the P4C saved browser artifact was opened in the integrated P5 application, freshly calculated through packaged Rust, previewed and downloaded as a PDF. The downloaded PDF completed, all 27 tax-model rows matched extracted text, and all four pages rendered without clipping. The scoped v3 receipt survived a browser restart and correctly changed between current and stale as report settings changed. The separate receipt JSON file delivery remains unverified.

## Source and environment

This is local application evidence from the reviewed integration working tree, not evidence attributed to its earlier base commit or to main CI. The build/packaging receipt records base `92532d93d3724582f98464431c8fd69164885994`, dirty source, and application-input SHA-256 `8d86dff80f8f70b905406b55a85060df11d60697ee6c96ebc104cfc3e01d25af`. Root subsequently committed the reviewed source and reconciled canonical main; exact committed-source checks remain a separate checkpoint.

The actual UI ran through the Vite/Vinext development server at `http://127.0.0.1:4320` in Chrome `138.0.7204.97`, driven by agent-browser `0.38.1`, with Node `22.23.2`. Emitted production browser/Worker/SSR packaging evidence is separate. The browser profile was copied only after the original P4C profile closed; the original profile and saved artifact were retained unchanged.

The fixture supplies a synthetic local account by substituting only `/api/me` and `/api/workspace-session`. Source editing, authoring state, packaged Rust execution, device save/reopen, PDF rendering, download dispatch and scoped device receipt persistence use application code. This is not a live authenticated server/account-history journey. Actual Worker plus ephemeral D1 authorization/history evidence is recorded separately.

## Journey and retained evidence

Artifacts below are retained under `.artifacts/p5-application-browser/` in the integration worktree.

1. The initial actual PDF preview refused the source premise's unsupported U+1F4B6 glyph. `unsupported-glyph-ui.txt` and its screenshot retain that refusal. The text was then explicitly edited through the existing Publishable case context UI, changing only that glyph to `EUR`, reviewed, and explicitly rebound to the tax artifact. `explicit-premise-edit.json` retains the before/after text. No implicit text normalization or input substitution was used.
2. The edited artifact was freshly calculated, saved on device, then the browser was closed and reopened. `corrected-reopened-before.json` records no current calculation; `corrected-reopened-calculated.json` records the next successful fresh result. The complete source/request/result and saved authoring state were retained. The same capture was independently passed through the native C ABI and the two-profile/two-language PDF cohort.
3. The actual report used English, Tax position memorandum, Base decision report, internal audience, draft classification, economics included and decision tree excluded. There was no recorded reviewer approval or exact account workspace-version claim. `actual-report-options.json` records the active options and preview identity; the actual download timestamp is `2026-09-30T17:47:44.380Z` in the receipt.
4. Actual Preview PDF succeeded. Actual Download PDF generated `downloads/web_tax_contract-v1.2.3-tax_position_memorandum-internal.pdf`, **37,601 bytes**, SHA-256 **`184dd52cf884e137bcf42c9637133c194da5dbd5d2f51e325b2574ab07bfebc4`**. `download-events.json` records completed download GUID `d0c9560c-d315-4c03-85c6-e7adb70d7984`, matching file size and filename.
5. Poppler `25.07.0` identified four A4 pages. `actual-tax-memo-en.txt`, `actual-tax-memo-en.pdfinfo.txt` and `actual-tax-memo-en-1.png` through `-4.png` retain text, metadata and rendered pages. Every page was visually inspected; root independently inspected the financial table page. Inputs, results, assumptions and retained-import disclosure were unclipped. The PDF is not tagged; this does not establish PDF accessibility.
6. `verify-evidence.mjs` matched **all 27 rows** of the actual fresh browser tax report model against extracted downloaded-PDF text: 11 input rows, 13 result rows, assumptions, and two retained-import rows. It compared the complete model with the independently native-verified model for this same artifact. Unknown effective tax base remained `Unavailable`, zero stayed zero, and inactive unknown tax rates were omitted. No TypeScript financial recomputation was used for this check.

The complete fresh capture SHA-256 is `6dd269a95e6e8b98e33595b64aac77c62dace479376e9e543a04b1170094ca02`; input hash is `ecd641852283f26780a3dffe5ec110a4630c69d7cd78477964bf48bb74efe1a5`; binding hash is `c3a5fed6d750bf0f5fb6ae576cc79f97a4ca968df86959684ac2315f7ab7ee0b`. The native proof is `.artifacts/browser-native-parity-2026-09-30T1746/receipt.json`; the separate same-artifact four-PDF/34-page cohort is `.artifacts/browser-native-pdf-parity-2026-09-30T1747/receipt.json` (SHA-256 `0e46be36dd91f086b707da199f026af6353870a535b3b237a17883bee04ef82f`). Those generated cohort files are distinct from the four-page actual UI download.

## Scoped receipt and freshness

`device-receipt-v3.raw.json` contains the exact **1,800-byte** persisted string, SHA-256 `08d955dc1291cb4a3f14833f6e5704af8b194ee4d49038070ee4c42b3cd6b688`, read after the browser restarted. Its key is:

```text
genesis-juris-tax-report-receipt:v3:fb6d389e82001e941a5c2fdc54973c63f0527d75a6942fb77da2a2b4141cb918:web_tax_contract:tax_position_memorandum
```

The receipt binds the exact attachment/source, artifact revision 21, complete transport/calculation versions, input and binding hashes, evidence fingerprint and outer report/presentation identities. The verifier checks those fields against the observed browser model and fresh snapshot. Storage capture before opening the report dialog has an empty DOM `receipts` array but contains this exact persisted key/string; it is not an absence-of-storage result.

Root independently reconstructed the report using the actual captured draft and active browser options with fresh packaged Node Rust, then required deep equality of the **entire** stored v3 receipt with the resulting receipt. All tax, case, layout, presentation, publication and version fields matched. The supplemental proof is `independent-receipt-parity.json`; it does not claim JSON file delivery. Root also independently inspected the readable stale-state screenshot.

After fresh preview, the actual dialog displayed **Current content and layout receipt found**. Selecting Medium instead of Base removed the prior preview and displayed **Previous report is stale**. Restoring Base and requesting another fresh preview restored the current label. The stored raw string remained byte-identical throughout. Captures are `receipt-current-after-reopen-preview.json`, `receipt-stale-after-format-change.json`, `receipt-current-restored.json`; readable, visually inspected screenshots are `receipt-current-visible.png` and `receipt-stale-visible.png`. Initial offscreen element crops were blank and are not accepted visual evidence.

## Download diagnostic and remaining limits

The first automation download-wrapper attempts failed and produced no accepted file. A default persistent-profile CDP download directory plus an ordinary application button click then completed the PDF above. The separately attempted receipt JSON produced a 2,036-byte `downloadWillBegin`/`inProgress` sequence (GUID `2a64ec43-2247-4644-b49f-c7c29d9fa8ee`) but no completion event or file. The browser debugging endpoint subsequently stopped responding. Only the verified isolated browser process was restarted, retaining saved data.

After restart, Chrome's actual download history showed the completed named PDF and two older failed UUID items; the latest JSON GUID was absent. No automatic-download or safe-browsing permission prompt was observed. `download-history-after-restart.txt`, its screenshot, and `download-preferences-observed.json` retain the bounded diagnostic. The cause is unproven: neither a product defect nor an automation-only cause is asserted. Exact device receipt capture is not claimed as successful JSON file delivery.

The final machine-readable browser evidence is `receipt.json`, SHA-256 `879d5124d96894ba47ce76b7743be450af4139aa3ac2f3686989e7fa25688338`; its verifier passed. This closes the bounded actual browser edit/rebind/save/reopen/fresh calculation/PDF/device-receipt journey for the tested fixture. Separate exact-source CI, live authenticated account browser coverage, receipt JSON file delivery, physical mobile journeys and spoken accessibility acceptance are not established here.
