# Native CI and Help activation follow-up — 4 November 2026

## Starting source and preservation

Canonical/local main is `8d4f97a8eea5b4ee09b1a5678c892e2774f544bb`, clean before this slice. Public v175 still reports runtime `e6addb90fe3ab60eb16b1f079868c1530fec6ebd` on both origins. All 587 application input receipts and hosting hash match; the main/runtime difference is documentation only. Native source, workflows and locks are identical between those two commits. No production case or existing user tab was opened, edited, saved, deleted or reloaded. No additional Sites publication is warranted for this QA slice.

## Completed and failed CI, kept separate

- Docs-main web/PDF run [41751668728](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/41751668728) passes. Latest native lifecycle run [41751668870](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/41751668870) also passes.
- Runtime-head iOS runs 41749025881 / 41749026118 were **cancelled**, not successful or application failures. Their cancellation follows the next main push and is consistent with the workflows' `cancel-in-progress: true` / ref-based groups. Do not repeatedly supersede live acceptance with docs-only main updates; observe an existing valid run to its terminal result before integrating closure documentation.
- Candidate editor run [41747681207](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/41747681207) reports its application step successful, then fails artifact creation with `ENOTFOUND`. The artifact list is empty. This is an evidence-upload failure, not independently verified six-phase application acceptance. Retain the failed run; do not suppress the upload gate or invent its missing artifact.
- Latest editor run [41751668621](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/41751668621) genuinely fails in `legacy-write`, checkpoint `legacy-cancel-probe-3`. The original stack is `AnimatedPadding` constructor → `Dialog.build`, asserting `padding.isNonNegative` at Flutter 3.44.8 / Dart 3.12.2. Preparation and earlier phases are not this failure.

The retained latest failure artifact is ID `13286869327`, SHA-256 `bd4c6f23c4bc362cdaf0b268ebad02b8f3bf684cb821d306a32d7f2781dbab7a`, 1,534,379 bytes, 145 ZIP entries. Digest, byte count, source `8d4f97a…` and safe extraction paths were verified before inspection. Raw archive and extracted diagnostics stay under ignored `.artifacts/ios-tax-failure-41751668621*`; original bytes are retained.

## Confirmed diagnostic defect and bounded correction

The first actual framework record contains only `metrics.snapshot_error_type: FlutterError`: looking up the first AlertDialog's inherited context threw and erased all raw view metrics. A later test-failure record reports zero bottom view inset, after the original rendering failure. It cannot establish the failed frame's values or cause.

The correction separates a stable raw-view snapshot from optional dialog/context lookup. Optional ancestry failure retains the raw metrics and its own error marker. Actual Dialog elements are inspected individually, including offstage routes, with per-element failure markers. Raw and dialog view insets/padding, explicit/themed inset padding and a labelled derived effective padding are retained without normalization. The pinned default comes from [Flutter 3.44.8's Dialog implementation](https://github.com/flutter/flutter/blob/3.44.8/packages/flutter/lib/src/material/dialog.dart), which adds view insets to resolved inset padding. Derived data is not substituted into the application.

The collector still forwards every original framework error, marks evidence unaccepted, bounds records/strings/depth and preserves negative/non-finite values. Three regressions cover optional lookup failure retaining raw values, raw lookup failure retaining available dialog values, and a real Dialog assertion with a deliberately negative synthetic inset. The latter expects the assertion and checks raw/derived values: it is diagnostic coverage, **not a production padding fix or reproduction of the native event's origin**.

No production UI, input/storage format, assertions, source/PID/nonce/bundle checks, VM authentication, 900/300-second deadlines or six-phase data checks change. Do not clamp unknown geometry. Next: validate the collector tests and execute the real native journey; if the assertion recurs, use the failed frame's complete raw/derived evidence to correct only the demonstrated cause.

## Help activation investigation

Five fresh-tab first pointer activations without prior playback succeed:

| Surface | Locale | Requested chapter | Observed terminal state |
| --- | --- | --- | --- |
| Standalone training | EN | 2:00 | 120 seconds, readyState 4, paused |
| Help | EN | 2:00 | 120 seconds, readyState 4, paused |
| Standalone training, measured 488 × 750 CSS viewport | EN | 3:30 | 210 seconds, readyState 4, paused |
| Earliest-action Help sequence | EN | 2:00 | Loading status, then 120 seconds / readyState 4 |
| Help | RU | 2:00 | Localized loading status, then 120 seconds / readyState 4 |

Each initially exposed a loading notice and video focus; all players retain zero subtitle tracks. The earliest trial initially had no visible heading; documented locators waited for the actionable controls. Browser cache was shared and was not cleared: these are fresh-tab observations, not cold-network acceptance. The earlier miss is **not reproduced or diagnosed**; do not add a speculative controller/hydration patch or claim universal first-click success. Valid desktop EN/RU chapter captures are retained under `.artifacts/help-update-20261103/followup-*chapter120-20261104.jpg`.

## Narrow capture retry and explicit limit

Actual 390 × 480 CSS viewport measurements still show page width 371 with functioning controls. Viewport screenshot and documented tab screenshot surfaces time out in `Page.captureScreenshot`. Full-page mode returns a file, but inspection shows repeated viewport tiles rather than the page: reject it as visual acceptance. A second measured 488 × 750 mobile-width trial also times out. Normal captures work.

A read-only loopback wrapper on port 4198 attempted to display the real public Help pages in 390 × 480 frames; public `X-Frame-Options: DENY` / CSP `frame-ancestors 'none'` prevents this. The policy was not weakened or proxied around. Native desktop inventory exposes no targetable CaseVant Chrome window; the browser visibility option is unsupported. Stop these alternatives rather than fabricate narrow evidence. The temporary server was stopped; overrides reset and only agent-created test tabs were used. No browser zoom or security preferences changed.

## Acceptance still required

Collector formatting is checked with official hash-verified Dart 3.12.2 in ignored task tools, language version 3.6 matching pubspec. Flutter analysis/widget tests and actual native acceptance remain required for the candidate. A passing diagnostic regression is not closure of the application padding assertion. Preserve all failure artifacts and the distinction between cancelled, upload-failed and application-failed runs.

Keep the existing S03/S05, legitimate owner recovery, same-tab identity/timing, original-artifact/historical-pagination, 43 missing originals, native/operator/commercial limits and v167 history. All factories, carriers, saved bytes, recovery and PDF locks remain unchanged. No governed merging, provider processing, disposal, analytics, pricing or outreach is added.
