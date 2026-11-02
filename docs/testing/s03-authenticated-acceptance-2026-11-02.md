# S03 authenticated acceptance and saved-case access recovery — 2 November 2026

**Delivered — public v170.** Runtime `c3c46f98959ef03526bd300307b7ea4c7d2c5ff2`; [native receipt](receipts/s03-saved-access-v170-2026-11-02.json). Post-deploy interactive checks remain blocked by the Chrome extension requirement at the user’s direction. Earlier observations below are explicitly from v169; the outage retry is covered by local component/actual-handler evidence and exact-main gates, not a fresh production outage simulation.


## Outcome and scope

Production v169/runtime `4a5848c7b614daf50696922619cc16c51597e46b` was reverified against canonical main `2bcba31cf65c6bf05c45f3e47a60f2e82e23ba93`: all 579 application/hosting inputs match. The existing Sites source helper opened that exact main before implementation. The authorized Chrome identity was confirmed through the normal account UI. No credentials, tokens, private original case bodies or download history were extracted.

Two independently opened, clearly labelled synthetic Canopy copies now exist as saved identities **50 and 51**. Each first save used one header Enter activation and visibly confirmed Saved to workspace. Both independently reopened and amended. A separate stale #50 tab attempted one save after the writer advanced: the UI reported **Save conflict — edits remain open**. A normal separate saved-version read retained the winning amended title. The stale tab was not retried, overwritten, discarded or deleted. This is observed browser conflict behavior; exact handler/CAS denial is separate local evidence, not a captured production HTTP409.

The final normal catalogue contains 51 rows: all 49 original identity/title/version metadata tuples are unchanged, plus only the two synthetic identities. Original stored bodies were not read for a byte-for-byte comparison. Every original and synthetic case is retained.

## Actual downloaded files

The user supplied `C:\Users\User\Downloads`. Only four exact run-specific known filenames were read; no directory scanning or download-history access was used. Originals remain untouched. Raw copies and private baseline metadata stay in ignored local artifacts, not this repository.

| Actual file | Bytes | SHA256 |
| --- | ---: | --- |
| A first-save sealed JSON | 23,587 | `7bada72a9899719ef47987565c036de019c9e277fe43c315efaf0ba365de3384` |
| A amended Base PDF | 34,711 | `7a5ab799741dfac433b84b114c9442225a8efc51da02d4d2035a23544b0e6646` |
| B current amended sealed JSON | 23,800 | `409d9ca88a7f76d863a83388c0cd458804161faf10f046b2d92ca4211e3582ce` |
| B amended Base PDF | 34,722 | `e4fc5a1e621a3cc6d69ca0042cf76054cc684e9da53672c5a5544fbf76e56c10` |

Both JSON files are schema4/case2.0.0, category `general_advisory`, 14nodes/13links; graph, category and source are deep-equal between independent copies. Stable source is `project_canopy_managed_site_expansion`2.0.0, fingerprint `sha256-e8df94bed5cc24a4b56093b21b24101839cd7501080d01b4bfb0f1bb7e4b3702`. Fingerprint, normalized core and case/draft protection carriers match. These offline structural checks do not verify server HMAC authority.

Normal application file import accepted current B through the existing server verification path and exposed saved identity51. No save followed that import. The older A snapshot was refused after A advanced; its raw bytes remain available. No current-source substitution, seal-policy weakening or owner token was introduced. This older-file refusal is not legitimate unsupported-owner recovery acceptance.

Both actual Base PDFs are three A4 pages. A's three rendered pages and B's first page were visually inspected; remaining B text equals A after title/whitespace normalization. Titles reflect their respective amendments; draft/internal/conditional and separate human-review qualifications remain visible. UI report receipts are recorded separately from actual PDF bytes. The complete 254-page ERP Full artifact and all report locks remain unchanged.

## Finding and bounded correction

One fresh saved #50 URL showed an empty Describe placeholder with unavailable access status. Normal reload recovered the saved case. Connectivity cause is unproven. The concrete UX gap is no saved-opening-specific retry and premature placeholder workflow synchronization.

The correction shows an explicit bilingual notice only for an unresolved valid saved ID while session authority is unavailable. Refresh access invokes the existing authority refresh; it does not grant access, write a case, call a provider or replace work. The requested step/panel stays pending until access resolves. Ordinary local drafts remain usable during unavailable access. Loaded, anonymous, revoked and signing-out states preserve existing authority handling. No source/factory, seal, persistence, merge or report contract changes.

Review: native button/status/description, single-flight disabled retry, safe positive ID parsing, static import so recovery does not require a lazy chunk, existing styles and scope preserved. Strict types pass; changed-file lint has zero errors and seven existing JurisApp warnings. The focused parent-handler/authority/recovery/persistence suite passes **61 tests**, including five added regressions. The loopback synthetic component fixture demonstrates busy/failure/retry/recovered presentation, EN/RU at390×480, no horizontal overflow and a46px action. Its zero-write/modelled-promise evidence is explicitly not a production authority observation.

## Explicit acceptance limits

- Download-event interface timed out although files actually arrived. General history was denied by automatic review; browser-internal Downloads URLs were prohibited. Neither was bypassed. Exact user-supplied local files resolved the byte-proof limit.
- Native blank-draft Cancel remains unconfirmed after input timeouts; do not infer a product cancellation defect. No unsaved tab may be discarded to simplify testing.
- Same-tab A→B identity/timing isolation is unobserved. Separate profiles are not equivalent. No cookies/tokens are transferred.
- No already-authorized unsupported-owner synthetic row has been identified through normal operator controls. Do not manufacture one or claim older A refusal closes it.
- Fresh browser continuation encountered an extension-update requirement after the successful production and component observations. Subsequent interactive checks are not inferred to pass.
- Original-artifact/historical pagination/native acceptance,43missing-original disclosures, operator qualified review and commercial readiness limits remain open. No pilot consent, recruitment, analytics, pricing, outreach or customer-data/provider processing is added.

## Release and next execution

This review initially records a candidate, not a new production version. Require candidate and exact-main web/PDF gates, verified CI build adoption, existing Sites save/deploy receipt and fresh runtime checks before claiming publication. Preserve v169 receipt and paused v167 caption-boundary observation. Do not republish delivered catalogue controls merely to close documentation.

After the bounded retry correction, reproduce remaining S05 correction destinations before changing them; then assess manual-choice and measured density/locale slices separately. Resume isolated authority/native cancellation and legitimate owner recovery only when their normal authorized test contexts are available. Keep browser, actual file, component, real-handler and original-artifact evidence distinct.


## Final delivery review

PR203 is normally merged. Candidate and exact-main gates pass: 1844tests/0fail/3inherited skips plus2HTML, strict types/lint/history/contracts, packaged browser/Worker/tax,47-report/bilingual/tax PDF locks and zero findings in both audits. Verified exact-main archive digest/source/tree and all580inputs precede adoption. Existing public Sites deployment succeeds, both origins verify189/189assets and exact runtime, and configuration/storage bindings remain unchanged. Only v169 current-manifest assets are retained. The receipt records native workflow state separately; web publication does not assert native completion.

The requested Chrome continuation is explicitly blocked. No further browser attempts, network manipulation, forced sign-out, case overwrite or deletion follows that instruction. The final unsaved synthetic stale title is retained in the ignored browser checkpoint; the browser tab is not deliberately navigated, saved or closed. The extension also blocked refreshing its handoff mark, so continued tab availability is not asserted. User original tabs are untouched. The actual source of the access connectivity failure remains unproven; the delivered correction addresses its observed UI recovery gap.

This closure updates instructions and receipts only. Application and hosting input equality is verified again after integration; no duplicate Sites release is made. Remaining S03/S05 and commercial readiness work stays bounded by the next-execution instructions.
