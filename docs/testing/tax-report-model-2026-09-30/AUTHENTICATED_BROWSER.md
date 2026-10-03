# Authenticated browser report evidence and corrected login return

The first 2026-09-30 local exercise on `8bfa5e7` verified report output and
history but found an unexpected unload prompt on successful-login return.
The corrected local source `53ae4ec` subsequently completed the full
login/report/sign-out/browser-restart/new-login/history journey. Both outcomes
remain source-specific local evidence; neither establishes production-provider,
hosted CI or release acceptance. The original failure is retained below.

## Corrected local application journey on `53ae4ec`

Source `53ae4ec500bb48619e16bad31d657ec0dbb4a70a`, tree
`dabecc6f76564069aa3865e943830cdb1018db9d`, application-input digest
`35f178afbdb51f4509f5e3c19525f2b32ff1aec62714794cd3f6494cd8920c98`
approves departure only after a successful, current-authority login or profile
save. Failed or stale responses leave unsaved-form protection intact; a thrown
navigation restores protection. The regression suite exercises actual handlers
and the real navigation controller. Before the fix, four of its fourteen cases
failed; the corrected combined focused suite passed 46 cases.

The full verified production build supplied the actual Worker and matched
client assets, migrated ephemeral D1 and R2 to Miniflare 5.20260916.0-alpha /
workerd 1.20260916.1. Edge 154.0.4258.37 used a fresh owned profile. Only a
synthetic credential and the complete original 86,532-byte saved case were
seeded; no sessions, report events or new calculations/receipts were seeded.
Historical cached fields in that case were retained.

The actual wrong-password form submission returned 401 and kept the form.
The return link opened the normal unsaved-changes prompt and Stay here preserved
the inputs. Successful login completed at 21:55:20.753Z and automatically
returned to the exact saved-case Studio URL without a JavaScript dialog.
Preview and PDF download each performed a fresh Rust calculation. JSON download
delivered the matching existing receipt, generated at 21:56:27.155Z.

| Actual download | Bytes | SHA-256 | Completed browser download GUID |
| --- | --- | --- | --- |
| PDF | 37,601 | `53ea2aaf7f05ec90a085a1cd50bd2db08ac04f0d4fee7031aeefffb3035ae03d` | `ca12cbd0-c791-4094-8548-6d6d73add892` |
| Receipt JSON | 2,036 | `7ff8058ff6a67caadf086aaf644c488b47c6a51ecbc4b45304d247cae0746391` | `b2405eee-deb4-4a03-8550-fffc56f313d3` |

The real history POST returned 201 at 21:56:28.374Z. Its whole receipt matched
the subsequent history GET, expanded rendered details and sole D1 report event.
Actual sign-out revoked session 1 at 21:58:09.847Z and left zero cookies.
Browser PID 17708 and port 59616 were proved absent before the same profile
restarted as PID 28356 on port 51573, initially with zero cookies. A new actual
login completed at 22:00:10.606Z and automatically returned to the same case.
A fresh preview reproduced the complete prior model; history displayed the
same receipt as matching current content/settings, with no second report event
or new download. The complete stored case remained unchanged throughout.

Final UI sign-out revoked session 2 at 22:02:16.391Z and again left zero cookies.
The Worker disposed normally at 22:02:45.930Z. Independent cleanup at
22:03:04.0267082Z found both browser PIDs, Worker PID 30112, child PID 28620,
their three ports and processes using the owned profile absent. Both observers
recorded zero JavaScript-dialog events and zero runtime exceptions.

Independent review binds 437 retained file hashes, complete observed browser
preparations/tax models and a fresh Node Rust reconstruction, whole receipts,
history/D1, the preserved saved case, session transitions and cleanup. Its
receipt SHA-256 is
`6315adba3f34a4b62859376541493af7e21838f05f828310877857e14f2eeee7`.
There is no directly captured browser Rust wire trace; complete observed output
and independent reconstruction are the parity evidence. All four pages of the
actual downloaded PDF were rendered and viewed; all 27 model rows/notes and ten
source fields matched, without clipping, overlap or glyph defects. PDF review
receipt SHA-256 is
`025d8912efa4a15021bc502e15cb722ddd3a7105554cb94c054b3d6e95c1c352`.
The closed Edge History database independently records both exact GUIDs as
completed with matching byte counts and no interruption.

The first successful login body was captured. The second login finished with
status 200 but body retrieval lost its resource after navigation; neither logout
had a captured body or loadingFinished event. Page transitions, cookies and D1 creation/revocation
provide the separately retained evidence. Initial rapid fill/click commands that
produced no HTTP request remain recorded and are not counted as logins.
The profile-save handoff has actual-handler coverage, not a browser profile-edit
journey. The PDF remains untagged; semantic reading order, spoken accessibility,
physical devices and provider-backed identity remain open.

Evidence is local to the `account-confirmed-return` worktree under
`.artifacts/authenticated-browser-worker/`, including the full runtime,
`browser-2026-09-30/`, `independent-pdf-review/` and final independent audit.
Credentials, profiles and database snapshots are excluded from publication.
The clean-source full web suite passed at 22:14:52.342Z: 1,154 passes, zero
failures/cancellations and three existing opt-in migration-mode skips (1,157
tests total). Its full log SHA-256 is
`f3a212efcc900489098e85ab3d8fd979825899c63c947751ec5d353f241d4934`.
This is local execution; PR/main execution remains separate.

## Published account correction at `073a638`

PR [#79](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/79) is
published at `073a6382aa03ca7227e36fc134b82180d5e9d700`, tree
`08e985ad544168249683bae745f68ac2247ed952`. All 18 applicable checks passed at
that exact head. Its 429 application inputs are byte-identical to the locally
exercised `53ae4ec500bb48619e16bad31d657ec0dbb4a70a`, with application digest
`35f178afbdb51f4509f5e3c19525f2b32ff1aec62714794cd3f6494cd8920c98`.
The authenticated browser journey and local full suite remain evidence from
`53ae4ec`; these hosted checks remain evidence from `073a638`.

Both native events explicitly passed `RunnerTests.testNativeLogisticsLifecycle()`,
initial arm64/x86_64 and prepared x86_64 export audits, 27 fake verifier controls
and eight real macOS fixtures. Both application events passed all six selected
write/read, incomplete and legacy phases, complete saved/native/legacy equality,
six terminated processes and six x86_64 export audits. Their exact-source
verifier uses the older Flutter-drive transport from that dependency; these
results do not establish execution of PR #72's newer direct-Dart correction.

| Event | Run / job | Test evidence | Artifact / bytes / SHA-256 |
| --- | --- | --- | --- |
| Native push | 36785488641 / 110125770859 | XCTest 23:04:27.484407Z, 0.557 s | 11131405742 / 180,770 / `92b9dad3969e7a31ec0c04b092b62ebdda4593c59ef0f6b94513746f65a20308` |
| Native PR | 36785523641 / 110125886670 | XCTest 23:12:22.528101Z, 0.202 s | 11131940495 / 180,058 / `9751f5afcf81d6edd6662204969b89ffdc9ca52cf92690e65440ad389ae85118` |
| Application push | 36785488707 / 110125770911 | Six executed phases; PIDs 23725, 29207, 34038, 40250, 43474, 47770 | 11130651413 / 2,142,518 / `6db4af135c3e284a0bba10eb3e595bf8eca7793ea52195d29b9ca9d3b596136b` |
| Application PR | 36785523702 / 110125886404 | Six executed phases; PIDs 38610, 49331, 53666, 57939, 61982, 67822 | 11132261504 / 2,180,245 / `3255a7a2313678453679c1c7674ad86ae2542215974327b1f167de56129a4e41` |

All four original ZIPs and 396 extracted files passed independent integrity
verification. The final receipt is
`.artifacts/pr68-ios-2026-09-30/pr79-073-ci/FINAL_RECEIPT.json`, SHA-256
`0aef6d929c158d79bd019d919acb16ea79c120432fcd226f5c8b513e91f76dab`.
Three reopened-editor viewports from each application event were visually
reviewed; they do not establish keyboard, enlarged-text or screen-reader behavior.

For the authorized production update, independent review confirmed current
main `54d6d29868db0fe0fa4c570d89571cbfcd55ed18` was already an ancestor of this
exact candidate. PR #79 was normally retargeted to main without changing source.
All eighteen gates remained successful; no new pending check or unresolved
review appeared. The reviewed 33-path scope includes the earlier six-phase
transport, matching Miniflare dependency correction and account-return fix.
PR #79 merged normally at 2026-10-01T00:02:07Z as
`1a8b7ee23c61ae3efc78283a0a29538ecae2bd86`. Fresh fetch confirms containment and
the identical complete `08e985ad` tree. No force or rule bypass was used.
Subsequent main execution and production deployment are separate evidence;
the newer `9f2b733` transport correction continues in PR #72. Provider-backed
identity, tagged-PDF, physical-device and spoken-accessibility acceptance remain open.

## Original `8bfa5e7` source and runtime

The clean compiled source was `8bfa5e75007216b7dcf5b5a5e8f48c657192e387`,
tree `a612a8ba7b5e202c1f7542a8ba2948da22149184`, application-input digest
`328943c120582421858bfcfeed6acf03170744d94ed6a789a21a2dfbae886aef`.
This is local source evidence, distinct from PR #77, PR #72 and main execution.
The actual emitted production Worker ran through Miniflare
5.20260916.0-alpha/workerd 1.20260916.1 with migrated ephemeral D1/R2.
The fixture seeded only synthetic credentials and the entire previously saved
case: 86,532 raw bytes, SHA-256
`b54ef649d797f05d484a1ec87f8acc9243ff489ddd3efe7ab7d0039edf21dc80`.
No sessions, report events or new calculation results/receipts were seeded;
historical cached fields in the whole saved case stayed unchanged.

Chrome 138 submitted the actual login form and received a real 200 response
and HttpOnly/Secure/SameSite=Lax session cookie. Its return navigation stalled.
After the owned browser was closed and restarted with the same profile, that
real cookie authorized opening the saved case. This establishes session
continuity across that restart, not a successful initial return journey.
The observer recorded real requests/downloads and read application state; it
did not intercept network responses or inject application state.

## Completed report and history segment

Actual UI actions opened Preview, downloaded the PDF and then downloaded its
receipt JSON. Preview and PDF download each freshly executed Rust. Both browser
preparations, the entire tax model/presentation and an independent fresh Node
Rust reconstruction matched. The receipt generation time was
`2026-09-30T21:13:28.169Z`.

| Actual download | Bytes | SHA-256 | Completed browser download GUID |
| --- | --- | --- | --- |
| PDF | 37,601 | `97c8cec1aba56a0f67c913b2afd601fe54972ca19a8c39297b6f5e64eaa6212c` | `b49cb5ad-8e90-40f7-9e48-136fa68f692c` |
| Receipt JSON | 2,036 | `464e2a19ea5fe7fe42acacad309de64c5e3e25458117cd4cf2151814829a10ae` | `688c589e-d026-48bf-abe7-db5ca49ef2e8` |

The real history POST returned 201 and event ID 1 at 21:13:29.075Z. Two
subsequent complete history responses and the D1 row matched the complete
receipt and format. Refreshing history did not add a duplicate event. The UI
displayed the account recording confirmation, current-content/settings match
and expanded server receipt details. All nine complete saved-case responses
and four independently compared D1 snapshots retained the original whole case.

Independent review extracted, rendered and viewed all four pages of the actual
downloaded PDF. All 27 model rows/section notes and ten source fields matched;
no clipping, overlap or glyph defect was found in these pages. The PDF is
untagged: accessible semantic reading order and screen-reader acceptance remain
open. No replacement PDF was generated for this review.

Actual Sign out revoked session 1 at 21:16:38.834Z and left zero browser cookies.
Its response status was 200; navigation aborted response-body capture, so a
complete logout body is not claimed. A fresh same-profile browser started with
zero cookies, but its new successful login again stalled before history reopen.

## Retained return-navigation failure

A bounded comparison on Edge 154 reproduced the failure. In the instrumented
attempt, the actual login response finished at 21:29:18.794Z, followed by a
script-initiated request to return to Studio and a `Page.javascriptDialogOpening`
event at 21:29:18.795Z: type `beforeunload`, `hasBrowserHandler: true`.
No dialog-closed event or completed navigation followed. A direct target
dialog-accept probe returned `No dialog is showing`; it did not accept a dialog.
This proves an unexpected unload prompt during this confirmed-login return,
without establishing why that separate probe failed or explaining every older
CDP stall. Further browser permutations stopped after this reproduction.

The source form guard still reports a pending operation when successful login
immediately calls `location.assign`, before the handler's final busy-state
update. A bounded correction must preserve failed/stale-authority and ordinary
unsaved-form protection and must receive fresh actual-browser evidence before
the full return/relogin/history gate can close.

Final D1 comparison preserved the sole report event and complete original case.
The instrumented Edge logout revoked session 3; its new login created session
4. Synthetic sessions 2 and 4 were still active immediately before disposal;
they are not claimed to have been explicitly revoked. No Edge report/download
action or additional event occurred.

## Retention and cleanup

Evidence is under the isolated `ci-miniflare-handshake` worktree's ignored
`.artifacts/authenticated-browser-worker/` directory. Credentials, database
snapshots and browser profiles remain local and are excluded from publication.
The independent report verification receipt is
`independent-verification/2026-09-30T21-19-24.453Z-download-history/receipt.json`,
SHA-256 `3e2ab48893d1f9844423842724a794b17219c3aa0eb46cd0dfb9b8df71e43c1f`.
The four-page PDF review receipt is `independent-pdf-review/receipt.json`,
SHA-256 `1b7dcb4b18925e1db2d9a969275f6f8f200b6a893a98dcd509fcb77b2285a23a`.
Edge's `edge-2026-09-30/final-d1-verification.json` has SHA-256
`f30afe99c1e252aea535f65429b6d050234de2d383acf3ee5c8806ba05ac8348`.

The Worker wrote a final snapshot and disposed normally at 21:36:45.063Z,
exiting zero. Independent observations at 21:37:23Z and 21:39:19Z confirmed
the helper, all six owned browser/helper PIDs, their six listening ports and
owned runtime children absent. Cleanup receipts are retained in
`runs/2026-09-30T21-01-12.444Z-29616/`: `cleanup.json` SHA-256
`0ca17b205b090ef152b9bcd93c5ca9e254a37a763dce345f35052c07eff9a326`,
`external-cleanup.json` SHA-256
`e0d88ea54201296bdf1731f98a6a14b83b6ffe24488c362655aa04eb38d1660a`,
and `external-runtime-cleanup.json` SHA-256
`eba9327d0545d45971aa5241e9d5d89564e515b0964d68d41a6edae52a80859b`.

An earlier helper startup failed while counting a discovered D1 table and was
disposed without a browser session. The exact failing table was not retained.
The reviewed correction counts source-declared tables, retains the full table
inventory and fails on missing declared tables. That harness failure, earlier
login stalls and unsuccessful dialog probes remain retained. None is relabelled
as a passing application journey.
