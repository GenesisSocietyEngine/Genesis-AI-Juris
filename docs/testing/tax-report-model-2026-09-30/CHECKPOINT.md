# Shared Rust editor and version-bound reports checkpoint

PR [#77](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/77)
implements the web tax editor and fresh Rust-backed report output. This record
separates local application evidence, exact PR-head CI and subsequent main
evidence. All 18 applicable checks passed at reviewed head
`d40caa7b84c0b887933251283495edd86220ab08`, including both executed native
XCTests and both application events. The push application's original pre-test
timeout remains recorded below; its single unchanged-source retry passed.
The PR merged normally at 19:30:19Z on 2026-09-30 as
`54d6d29868db0fe0fa4c570d89571cbfcd55ed18`.
At the PR #77 checkpoint, no deployment or full product-release acceptance was claimed. Later web production v105 is recorded in the separate deployment receipt.

A subsequent [authenticated browser exercise](AUTHENTICATED_BROWSER.md) found an
unexpected successful-login unload prompt on local source `8bfa5e7`. Corrected
local source `53ae4ec` completed actual login, PDF/JSON delivery, authoritative
history, sign-out, browser restart, new login and history reopen, with full
observed-model/fresh-Rust parity and unchanged saved inputs. This closes that
bounded local journey; hosted source gates and production-provider acceptance
remain separate from this accepted checkpoint and the retained earlier failure.

The account correction is now published in PR #79 at
`073a6382aa03ca7227e36fc134b82180d5e9d700`, with all 18 checks passing, including
both executed native XCTests and both verified six-phase application journeys.
All 429 application inputs match the actual local `53ae4ec` browser source.
The [account publication record](AUTHENTICATED_BROWSER.md#published-account-correction-at-073a638)
keeps those local and hosted sources separate and records every iOS run/job and
artifact. Independent review confirmed it already contained canonical main;
the PR was retargeted without a source change and merged normally, with all
eighteen gates green, as `1a8b7ee23c61ae3efc78283a0a29538ecae2bd86` at
2026-10-01T00:02:07Z. Fresh fetch confirms the identical tested tree. Subsequent
main execution and authorized production deployment remain separate; no provider
or accessibility acceptance is inferred.

## Source and reviewed behavior

The accepted preservation foundation is PR #76, head
`409208e412cc677c7a23a4c32acc4453852c94d1`, merged as
`3749593df4e249cd9e4ea0e69caf22d47cef43cb`. PR #77 reconciles that main source
through an ordinary merge. Its complete tree,
`cbb17353e25e99c0823fe66cc9eeb1cc6b483381`, equals the separately tested local
commit `5b48d30c12aec845cda0fc0a9b6d8b87ef08f53f`. Those are distinct source
identities; equal trees do not relabel one run as another source's execution.

The editor preserves exact financial strings and unsupported generations,
requires current source/rate confirmation, and freshly calculates through the
shared Rust module after reopen. Both tax report profiles use a verified fresh
snapshot and bind source, input, calculation, content and presentation versions.
Preview and download execute independently; changed inputs, account or component
lifetime reject late output. Separate v3 device/account receipts contain compact
identity claims without private financial payloads. The production history route
freshly reconstructs the exact report and rechecks saved bytes and authority at
insertion. Earlier v2 receipt behavior remains separately covered.

Independent review covered the editor, model, renderer, actual dialog handlers,
receipt preservation, server authorization and source-bound evidence. Review
corrected the inherited missing-input report lead, full-response legacy FX
projection, input/account/unmount fencing, and test transport/localized-label
fixtures. No financial fallback or acceptance guard was relaxed. Detailed review:
[editor](../tax-web-editor-2026-09-30/REVIEW.md), [model and history](REVIEW.md),
[PDF integration](PDF_INTEGRATION.md).

The hosted Codex review service reported its usage limit on PR #77 at 18:07 UTC;
no hosted final-head review is claimed. Independent source and evidence reviews
completed without a remaining material finding. Ordinary merge controls and all
applicable checks still apply.

## Exact local committed-source validation

Pinned Node 22.23.2 on clean `5b48d30` completed the full production build and
the full suite: **1,140 passed, zero failed, three skipped**, 1,143 total,
886.17 seconds. The wrapper verified the same clean source before and after.
The retained result is
`.artifacts/ci-logs/p5-5b48d30-final-fulltests-result.json`, SHA-256
`b5f97d8e2f915cfcc651ac855abe63f6c31a645a0186ba52acd54e0fc04ae08c`;
the complete log SHA-256 is
`b17fd4cd7da4285561613b5866eb3f3f01add15b54039674d92fb9c1f0305128`.

The same clean source passed actual emitted-Worker execution and all 49 complete
Rust responses per browser/RSC/SSR host, including canonical source parity and
missing/corrupt/CSP-blocked initialization refusal. Worker receipt
`.artifacts/tax-report-worker/2026-09-30T18-08-29.201Z-9396/receipt.json`
has SHA-256 `bef13e14475d09786ada790351ba4ec31697f35f76a9706839fecd9a99d49e68`.
The packaging receipt SHA-256 is
`04812f4724ae384e81f579322ffd3271cd1c09c43a31c03b91e2483ad8a10a64`.
Both bind application inputs
`8d86dff80f8f70b905406b55a85060df11d60697ee6c96ebc104cfc3e01d25af`.

Earlier interrupted and failing local suites remain recorded in [REVIEW.md](REVIEW.md).
Host memory exhaustion was not established: the helper's restricted-token
`uv_os_get_passwd ENOMEM` also occurred after the suites stopped and disappeared
under the unrestricted process token. The later deterministic first-use harness
failure was corrected with a test-only transport to the actual Node Rust module.
The first clean-source packaging attempt lacked `CHROME_BIN` and failed before
browser execution; the explicit Chrome-path retry passed. These failures are
retained and are not substituted for the terminal successful checks above.

## Exact PR-head web and Worker execution

Both events executed source `d40caa7` with clean checkout, pinned Node 22.23.2,
the complete build, two passing D1 migration-breakpoint tests, **1,140 passing tests / three
skips / zero failures**, and zero findings in full and production dependency
audits. Each independently matched all **49 complete responses per host** to
the exact Git corpus, plus canonical source cases and all initialization controls.

| Event | Run / web job | Diagnostic artifact / bytes / SHA-256 |
| --- | --- | --- |
| Push | [36756604570 / 110028335940](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36756604570/job/110028335940) | 11116857378 / 837,243 / `5325b1c5062e3f8b49a86b187945a0e3d8266d9fed9dc49e8cda748020307a0e` |
| PR | [36756607521 / 110028346459](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36756607521/job/110028346459) | 11117510979 / 837,107 / `c7912aba9b4e9f79dc7be16c592cd98bc0cb7f2883756339db3d9981cf0966ca` |

Both production Worker runs used actual emitted `dist/server/index.js`, workerd
and migrated ephemeral D1: login 200, v3 history 201, retry/read 200,
forged/incomplete/future source 409, one exact receipt event. Replacing WASM with
an empty valid module independently produced 409 and zero events. The Worker
receipt SHA-256 is `87cbff8e74839dd7a6efe144118c2536e23f6c999601b98d4b3b0b1862e9d3fe`
(push) and `b50cbe83f9b39cd8796648bd8f1e08fd66574c00ed60fa228d433a8f4f8b6697`
(PR). Both retain exact source/clean identity and the application digest above.

## Executed native iOS gate

PR run [36756607541 / job 110028346554](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36756607541/job/110028346554)
explicitly passed `RunnerTests.testNativeLogisticsLifecycle()` at
`2026-09-30T18:37:29.376115Z`, 0.272 seconds, on exact `d40caa7`.
Initial arm64/x86_64 and prepared x86_64 export audits passed, with all 27 fake
fixtures and eight real macOS fixtures. Retained artifact `11117424957`,
183,114 bytes, has SHA-256
`fdaac4eded01abf91941f573b2ec5722b8478461b12462de9bdbe31fd06a9290`.
The companion push run `36756604592` / job `110028625291` explicitly passed
the same XCTest at `18:41:37.023288Z`, 0.197 seconds, with both audits and the
complete verifier fixture matrix. Retained artifact `11117529212`, 179,868
bytes, has SHA-256
`ba56b082c3436dfac22497084d55502246e4c6a70e1fb6897442f214e7a7c3ee`.

PR application run `36756607644` / job `110028348046` separately passed
write/terminate/reopen/read, with distinct terminated PIDs 42472 → 56122,
two actual native calculations, complete saved/native equality, screenshots
and both x86_64 export audits. Artifact `11118975757`, 386,692 bytes, has
SHA-256 `38b5a7c0a0daa08c290777db083b4785f9bebc752d28ac48b2ae451c36298f14`.
Push application run `36756604573` / job `110028674370` attempt 1 reached
the 30-minute exercise timeout at 19:12:16Z. Its write log reports a successful
549.1-second Xcode build but no executed test or phase receipt. Artifact
`11119263800`, 21,847 bytes, has SHA-256
`f319a1fa3d6f5ac77bb3e5da0b41dcc92cd0500e39d95c58954ce53eedb57a07`;
complete job log SHA-256 is
`de0a864d91e631de4505131abadf0650e188d568462bf8b47dd015df1cee2adf`.
The single unchanged-source failed-job retry passed: attempt 2, job
`110054242626`, executed both selected write/read tests with terminated PIDs
22068 and 28613, complete saved-input/result and fresh-native equality,
screenshots and both x86_64 audits. Artifact `11120182738`, 400,197 bytes, has
SHA-256 `3e01886f26c9057ddfc55b77844739fdf849420a144e44a50de7e891788bc334`;
complete job log SHA-256 is
`f02285dd57656c3dbf599498408b7c117d11dab18857072091ebd67ba6a9b6e7`.
The original timeout remains a failed attempt and is not relabelled as success.
These two-phase journeys do not
establish PR #72's separate six-phase or broader interruption acceptance.

## Distinct tax and legacy PDF gates

Both final-head PDF jobs passed: push `110028335438`, PR `110028346152`, in the
same two runs above. Each actually executed the fresh-Rust **22-PDF / 164-page**
tax cohort and the separate unchanged **47-PDF / 760-page** historical suite.
All PDFs and rendered PNGs were hash-verified, all 22 localized profile labels
matched, and the existing visual baseline passed unchanged. Artifact upload alone
was not treated as test execution.

| Event / cohort | Artifact | ZIP bytes | ZIP SHA-256 |
| --- | --- | --- | --- |
| Push / tax | 11118010071 | 15,067,535 | `3eb75668af99ace424200ecd4d23835122770c70a04ede748b56a0317ccc5b5a` |
| Push / legacy | 11117620903 | 105,260,594 | `18b653e61199264bbadebc9bbaa99edf4533d207714e3250bcd3ab092ebc3e9f` |
| PR / tax | 11116806814 | 15,067,520 | `ee6057430b0d3b0ce843c04c9e49680dc5449875ced1fa165625f7b64704633e` |
| PR / legacy | 11116966571 | 105,260,596 | `4620a489662dd86b15061114a6ff7f647b41748e6beac7e74eeb5b5d9daff68f` |

Tax receipt SHA-256: push
`f198e00bfb29046b9d86a5894cc22fc0abf8a682ea87ea417784b8837433f00e`,
PR `b2d7306a9c842ad45f88495c70e98196ed76b73b94cc7916f361f42d14e89a9f`.
Original ZIPs, API records, complete logs and independent verification receipts
are retained under the root workspace's ignored
`.artifacts/pr68-ios-2026-09-30/pr77-5b48-ci/`. Its historical directory name does
not change the exact `d40caa7` source recorded inside each final run.

## Separate main execution

Fresh canonical-main readback confirms merge
`54d6d29868db0fe0fa4c570d89571cbfcd55ed18` contains the tested PR head and
has the identical complete tree `cbb17353e25e99c0823fe66cc9eeb1cc6b483381`.
All nine jobs in its six workflows passed independently, including the executed
native XCTest and the actual two-phase application journey. No main execution
is inferred from the accepted PR-head results or equal tree.

Main web run `36766137153`, job `110060663014`, executed 1,140 passing tests,
zero failures and three skips, plus both D1 migration controls, all 49 Rust
responses per packaged host, initialization/compile guards, the actual Worker
positive and empty-WASM refusal cases, and zero audit findings. Diagnostic
artifact `11121771220` is 837,484 bytes, SHA-256
`cfa1e84781355c433aad0a66b4c5c8cfc67ca98fd3d4eb7a3443247fb8e52ffe`.
The Worker receipt SHA-256 is
`efea4eb268d5e2d740bd2b0487d55ee43184a944174ae8d41546682adf2019d6`.
Its separate PDF job `110060663522` executed and verified the 22/164 tax cohort
and 47/760 legacy cohort, including the unchanged visual baseline:

| Main cohort | Artifact | ZIP bytes | ZIP SHA-256 |
| --- | --- | --- | --- |
| Tax | 11121555858 | 15,067,528 | `f867cd62e9944020477ff9b70e418819a4ac428f0ca000d9b38aa776eacc1d9e` |
| Legacy | 11121555873 | 105,260,596 | `047f00dbd52807b8be655d3c90834cc43649939a604b22551b3c38262010a9d0` |

All three Rust jobs in run `36766136764`, Android run `36766136889` / job
`110060660789`, and Flutter run `36766136725` / job `110060660430` passed.
Complete non-iOS API records, logs, ZIPs and verified receipts are retained in
`.artifacts/pr68-ios-2026-09-30/main-54d6-ci/`; `MAIN_VERIFICATION.json` has
SHA-256 `ed644ef6d7d330b3e27f8756d29d76495fc33e479b3484fbf0908628a9901d2a`.

Main native run `36766136864` / job `110060661043` explicitly executed
`RunnerTests.testNativeLogisticsLifecycle()` at 19:41:43.082946Z, passing in
0.204 seconds. Initial arm64/x86_64 and prepared x86_64 export audits passed,
with 27 fake and eight real macOS fixtures. Artifact `11123020377` is 179,341
bytes, SHA-256 `63ca375ecea8ff916885e9359600254d47647fb84b0caf4e9bf19ac589bc3ac9`;
complete log SHA-256 is
`2a722ca6b39886638f9d838e2586ad21267ad259fc3b02e33ad9041836a957ed`.
The separate application run `36766136856` / job `110060662719` passed both
selected write/read tests, PIDs 41674 and 53440, with both processes verified
stopped. Complete saved inputs/results matched, with two fresh native
calculations, verified screenshots and both x86_64 export audits. Artifact
`11123118607` is 386,664 bytes, SHA-256
`f2f34de96e4898ad9d47f18c6821b6fa8cb316e054de11439c99d705cb555b36`;
complete log SHA-256 is
`c20a1f0c603f1fb0f52322ab6531881999b17a55c581fc57c3eb2a0a87e66d7f`.
Its independently checked receipt is
`.artifacts/pr68-ios-2026-09-30/ios-application-report-main-54d6-receipt.json`.
This two-phase main execution does not establish PR #72's longer six-phase,
future-version or interrupted-write application acceptance.

## Application evidence and remaining acceptance

The [actual browser journey](BROWSER_APPLICATION.md) establishes explicit source
edit/rebind, device save, browser restart/reopen, fresh Rust calculation, a
completed PDF download and persistent/current/stale v3 receipt behavior. Its
synthetic account endpoints do not establish a live authenticated browser history
journey. The [same-artifact native/PDF comparison](NATIVE_BROWSER_PARITY.md)
matches the entire fresh browser result through the native C ABI and all four
profile/language PDFs, with 34 rendered pages. The actual UI's four-page PDF is
a separate observed download, not one of those generated cohort files.

The [browser record](BROWSER_APPLICATION.md) now also closes actual application-button
JSON delivery on clean local `5b48d30`: the real dialog downloaded a new PDF and
its 2,036-byte receipt, with terminal GUID events, saved files and closed-profile
History. The entire observed model/receipt matched fresh independent Node Rust.
Only the two synthetic identity endpoints were mocked; earlier failed delivery
and setup attempts remain recorded separately.
The later [authenticated local journey](AUTHENTICATED_BROWSER.md) separately
exercises real login/history routes in the emitted production Worker with a
synthetic credential, including sign-out and a fresh login after browser restart.
Remaining acceptance includes subsequent main execution and hosted production journeys,
provider-backed identity, PDF tagging/accessibility, spoken mobile accessibility
and physical-device checks. P3's broader iOS application matrix and interrupted aggregate-write
journeys remain source-specific mobile work. User instruction is to use CI and
emulators and leave physical-device checks open. No current deployment is changed.
