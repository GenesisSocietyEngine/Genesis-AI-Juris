# Post-format audit and release acceptance — 15 October 2026

## Scope and starting source

User request: re-run the audit, amend continuation instructions and proceed. Acceptance for this bounded slice: confirm the deployed/canonical source, inspect the previous asset-delivery failure, implement a repeatable failing static-delivery gate, freeze current source identities and correct stale continuation status. Preserve all saved cases, source packets, simulation recovery, approved artifacts and existing report locks. No new source material or user-edit merge is authorized by a technical audit result.

Before editing, local HEAD, canonical main and native Sites v134 source matched `076cee7c2816b8f03278190b4030a5def7f9c4e1`. The supported source helper independently returned that SHA for existing public project `appgprj_6a88a26d2f808191aa076b9fcd8dbce6`. The isolated checkout was clean. Another session owns root changes to Cargo.toml, docs/development/CURRENT_PROGRESS.md and docs/development/TAX_ECONOMICS_V2_INTEGRATION_PLAN.md; leave them untouched.

## Audit findings and amendments

1. **Release acceptance gap, high priority.** First v134 deployment reported success while required entry/JurisApp chunks returned 404, blocking hydration. Compatible v133 rollback recovered Studio. The chunks existed in the archive; a supported repackage/redeploy of identical saved v134 content recovered their HTTP delivery. Provider-side cause remains unconfirmed. Do not infer that a filename change was the root-cause fix. Native receipts must be followed by static-byte and applicable browser acceptance.
2. **Continuation status drift, medium priority.** The top of the backlog still described release 124 as the current layout baseline and pagination/format work as future. Replaced those leading statements with the dated v134 baseline, actual delivered format/report/navigation state, preserved synthetic IDs and explicit next coverage. Earlier notes remain historical context; native receipts determine the current release.
3. **Current factory protection, medium priority.** Freeze the ten deployed bilingual converted 2.5.0 source/copy identities before further content amendments. Existing 2.2/2.3/2.4 locks and factories remain unchanged. This slice changes no template, working-case field or persistence contract.
4. **Fresh browser coverage unavailable.** Authorized Chrome control timed out; reinitialization restored documentation/binding but the next session operation timed out again. Do not claim fresh authenticated save/reopen or narrow flows. Prior v134 evidence covers representative ERP/GreenFire copies 18–21; 10–17 remain historical synthetic cases. Remaining packages, account-switch browser races and moderated retrieval research stay open. No direct account API substitution, sign-out, permission change or test-case deletion was attempted.

## Step review — static verification implementation

Added `scripts/verify-deployment-assets.ts` and its testable helper. It binds the local manifest to the expected full source SHA, input digest and hosting digest; checks every unique lazy/entry JS, CSS and WASM file; then requests only validated same-origin static paths without cookies or account APIs. All manifest/path/bound validation happens before requests. Remote redirects are not followed. Non-200 status, HTML/wrong MIME, wrong/truncated/oversized bytes, timeouts or hash mismatches fail. Streaming bounds prevent unbounded response consumption. Concurrency and timeouts are bounded; receipts omit bodies, cookies, credentials and response headers.

The receipt explicitly marks deployed-source, browser-hydration and authenticated-workflow verification false. Exact assets can be retained across versions, so static success cannot independently establish active server source. Keep native Sites metadata and browser acceptance separate. The script does not publish, roll back, save cases or monitor continuously.

Meaningful tests use a real loopback HTTP server to reproduce the missing-chunk, login-HTML, redirect, modified, truncated, oversized and timeout failures, plus a successful exact-byte delivery. Additional cases reject unsafe manifests/targets before any HTTP request. The actual production manifest is checked locally against the exact build, and wrong source IDs fail. No broad dependency or runtime changes are needed.

## Measured starting-deployment audit

The current v134 build manifest contains 110 entries and **115 unique JS/CSS/WASM assets**. Read-only live audit verified **115/115** exact HTTP/MIME/size/hash matches at https://casevant.pro. Local build source/input/hosting identities matched the native v134 source baseline. Receipt: `.artifacts/deployment-assets-v134-audit.json` in the isolated checkout. This verifies present delivery, not the historical provider cause, uninterrupted availability or fresh browser behavior.

Reviewed the outgoing change: release tooling/tests/docs and an additional frozen template baseline only. No app/worker/public/data/schema/rendering change. Full/report/tax locks and original messages/document-gap disclosures remain untouched. Historical factory and registry tests remain required. Strict types, changed-file lint, focused checks, canonical web/PDF checks and exact merged packaging/publication form the final gate; final native receipt is recorded separately after integration.

Local checkpoint: **73 focused tests passed**, covering current production inventory/source rejection, real HTTP failure modes, frozen 2.3/2.4/2.5 bilingual identities and the original registry/Canopy identities. Strict types and changed-file lint passed. No baseline was regenerated to accommodate a changed template; the new 2.5 lock captures the previously deployed unchanged factory. No browser pass was inferred from these results.

## Amended next-stage execution

1. Run static acceptance after every supported Sites deployment and retain failed receipts beside rollback/recovery identities. Reconfirm native source independently. Keep authorized browser acceptance required for changed application flows.
2. When Chrome control is functioning, extend two-copy/source-packet/reopen/amend/hypothetical/conflict/cancel/download/narrow EN/RU acceptance to Logistics, GoldenShell and Desert Water, then remaining category/Canopy variants. Preserve all cases and record exact saved IDs and actual files.
3. Measure the four ERP retrieval tasks with representative humans before broad renderer work; ≤30 seconds per correct source/status answer is a proposed target, not a measured result. Preserve the complete historic Full export.
4. Inventory authentic document bodies or clearly labelled synthetic excerpts before new source content. Retain 43 missing original-document bodies and all 58 exact supplied fictional messages until a versioned amendment has inspected replacements. Additions imply no acceptance or domain approval.
5. Only add user-edit carry-forward through exact three-way conflict previews and full carrier preservation under a separately reviewed new-identity workflow. Cancellation writes nothing; stale writes fail. New-copy upgrade remains distinct.

See the amended canonical backlog and detailed product instructions for entry points, acceptance and release controls. Minor favicon.ico maintenance remains a separate bounded item; do not combine it with evidence migration or infer a production outage from a favicon-only 404.
