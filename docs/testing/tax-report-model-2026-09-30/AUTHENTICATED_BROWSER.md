# Authenticated browser report evidence and incomplete login return

The 2026-09-30 local application exercise verified actual PDF/JSON downloads,
fresh Rust parity and an authoritative account-history event. It also found an
unexpected unload prompt on successful-login return. The complete
logout/restart/new-login/history journey remains open; no release acceptance is
inferred from the completed report segment.

## Source and runtime

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
