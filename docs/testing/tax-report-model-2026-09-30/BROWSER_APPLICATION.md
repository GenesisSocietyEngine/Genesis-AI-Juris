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
4. Actual Preview PDF succeeded. The initial actual Download PDF generated `downloads/web_tax_contract-v1.2.3-tax_position_memorandum-internal.pdf`, **37,601 bytes**, observed SHA-256 **`184dd52cf884e137bcf42c9637133c194da5dbd5d2f51e325b2574ab07bfebc4`**. `download-events.json` records completed download GUID `d0c9560c-d315-4c03-85c6-e7adb70d7984`, matching file size and filename. A later bounded retry reused that browser destination and replaced this first binary; its original observed hash, text, four renders, event log and receipt remain retained. The separately preserved retry binary and complete content/render equality are recorded below.
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

## Bounded follow-up: JSON control and actual retry

After publication preparation, one explicit tiny `application/json` control completed in the same isolated profile and download directory: **51 bytes**, SHA-256 `28d8df41cca04319a4affbc73cd6430c3b875bd9b66599a22b44e1d25c422229`, completed GUID `e84a390e-8520-48ea-99cf-793d605a4c07`. It was a local file-origin control, not a tax receipt or application acceptance substitute. No browser security setting was relaxed.

The unchanged actual application was then reopened from clean source `5b48d30c12aec845cda0fc0a9b6d8b87ef08f53f` (the same file tree as reconciled PR head `d40caa7b84c0b887933251283495edd86220ab08`). No source or financial input was edited. A fresh actual PDF download again completed, GUID `598ed166-f1bd-4984-bcd2-6cd0362f3b97`, **37,601 bytes**, SHA-256 **`24026865ed3ab161c0df6390a604867d7e014eba91911cd1f9e2067038071c94`**. The configured Chrome destination reused the original filename. The retry is now retained separately as `actual-receipt-retry-report.pdf`, with its own metadata/text and four `actual-receipt-retry-report-1400-*.png` pages.

The retry verifier requires byte-identical extracted text and all four rendered PNGs at the original 1400-pixel scale, plus all 27 tax-model rows. It passed. The first comparison used a different render scale and was not treated as a content mismatch; matching the original scale yielded four exact PNG hash matches. The PDF binary differs because it is a separately generated download; it is not relabelled as the initial binary.

The actual **Download receipt JSON** action again emitted its filename and received **2,036 bytes**, but had no completion event or saved JSON file during the bounded observer. The observer's 30-second timer began before the PDF and JSON actions; its untimestamped events do not establish a full 30 seconds after the JSON request. Its GUID is `aa448036-de28-46dd-bf40-44b5cf5b4924`, filename timestamp `2026-09-30T18-20-11.717Z`; the CLI subsequently timed out with OS error 10060. The owned isolated browser and local server were stopped. No product correction was justified by this evidence.

`json-control-events.json`, `actual-receipt-retry-events.json`, `verify-retry-evidence.mjs` and `json-download-diagnostic.json` retain this bounded comparison. Generic JSON delivery works in the tested control; actual receipt delivery is still unverified. The different origins and flows, plus the unresponsive automation connection, leave the cause unresolved. The earlier scoped persistence/current/stale receipt evidence remains valid and distinct from file delivery.

Root subsequently read the closed task profile's History database in immutable read-only mode and verified its file hash stayed unchanged. `closed-profile-download-rows.json` (SHA-256 `36a2cc50316c9c34ce3051d358b7fef80f8c5bdd2019753c3428f2b853844cb6`) retains six bounded download rows. Both PDF GUIDs and the tiny JSON control have their expected final paths and full byte counts; the first actual receipt has empty paths and no completion time, and the latest actual receipt GUID is absent. This post-stop database view supplies no additional successful receipt file delivery and does not identify the original stall's cause.

A later same-origin diagnostic used the unchanged production download helper on clean `5b48d30`, a copy of the closed profile and a fresh output directory. Its small 56-byte JSON control was canceled 72.9 milliseconds after its own timestamped start; responsive Chrome displayed **Failed - Download error**. The actual retained receipt and actual application action were not dispatched after this failed control. The configured output path used mixed separators; the directory existed, and no permissions or browser security settings changed. The cause remains unproven. Original PDF, receipt and profile hashes stayed unchanged, and the owned browser/server stopped. The ignored `receipt-json-controlled/result.json` has SHA-256 `b090c6b42cde0b27dca690f67d6ce1fb0682fafba5d87a662532fd731f435d53`; its review, exact events, visible download state and cleanup receipts are retained alongside it.

One subsequent control used a fully normalized native Windows path, with Node and .NET path equality checked. Both same-origin downloads through the unchanged helper completed: the 56-byte control in 267.5 ms and the exact 2,036-byte historical receipt in 163.7 ms. The latter has SHA-256 `469c89e283f0fbebbe75717d57f42c21816deeb122f7c1572978c45e905fa339` and retains the historical generatedAt; it is not a newly generated application receipt. Complete files, timestamped GUID events and closed-profile History were independently verified. The fresh process/profile/directory also differed, so this comparison does not prove separators alone caused the preceding cancellation.

Actual application setup then failed to establish the synthetic account context. An automation command opened a separate temporary context; after returning to the explicit copied-profile endpoint, the account still remained signed out. No actual report preparation, fresh Rust operation or receipt-button click was executed in this follow-up. The copied v2 draft and all four original evidence/profile hashes remained unchanged, and all owned processes/listeners were stopped. The ignored `receipt-json-native-path/result.json` has SHA-256 `c44e83a77a45bb366960645cff98b917d0f241ad707a4688c850eb085035617d`. These successful download controls narrow the diagnostic scope; actual application-button delivery and live authenticated browser acceptance remain open.


## Completed actual receipt-button delivery

A subsequent application journey on clean `5b48d30c12aec845cda0fc0a9b6d8b87ef08f53f` completed both actual Download PDF and Download receipt JSON actions. This is local committed-source evidence, distinct from equal-tree PR77 head and main execution. The earlier unsuccessful deliveries and setup attempts above remain unchanged.

A fresh copy of the closed profile restored its existing complete v2 draft. Only the two original synthetic identity endpoints were intercepted; no application, financial input, Rust response, model, receipt or component state was substituted. The initial CLI fixture lacked the JSON content type required by the actual session guard, so the draft did not load. Exact endpoint interception with the required JSON header then established the original account context. This explains that bounded fixture failure, not the earlier init-script or download stalls; no product guard changed.

The actual dialog freshly prepared its preview and downloaded a new four-page PDF, then exposed the receipt button. That actual button delivered the new receipt generated at `2026-09-30T20:33:12.185Z`:

| Actual output | GUID | Bytes / SHA-256 |
| --- | --- | --- |
| PDF | `cb90159a-3fa7-4b27-b8fb-5e167a0576cf` | 37,601 / `ad395726de8caaabadcbc274a9ae52df827bf7f34a008b31ce133407952fc134` |
| Receipt JSON | `2ead824f-2f84-4977-80bb-dcb576aae88b` | 2,036 / `73361034d23c538b91253c07b81b38e02af3c2b76e0b0f93ac6a9c46ced8ec28` |

The JSON event started at 20:33:57.582Z and reached terminal completion at 20:33:57.870Z, 287.809 milliseconds later. Both independent per-GUID observers reached completion, and both closed-profile History rows show complete byte counts and no interruption. The actual saved JSON equals every displayed and stored receipt field after the application's unchanged serialization.

Fresh independent Node Rust reconstruction using the actual captured browser draft/options matches the entire tax model and receipt. All 27 model rows match the actual PDF text, and all four 1400-pixel rendered pages were visually inspected. Complete saved-draft bytes remain unchanged; the original four evidence/profile hashes also remain unchanged. The owned browser/server and listeners on 4320/60199 were absent after cleanup at 20:38:06.713Z.

Evidence is retained in the report worktree's ignored `.artifacts/receipt-json-application-final/`, including complete events, files, read-only model/DOM capture, independent parity, closed History, renders and cleanup. Primary `result.json` SHA-256 is `d01c4d5797d1e2e35ea3789885c62a02858db8e6857b92941d79836a2e754e1a`.

This closes local actual application-button JSON delivery under the explicitly synthetic identity fixture. Live authenticated browser/account-history testing, PDF tagging/accessibility and physical/spoken mobile acceptance remain open.
