# Workspace recovery/editor checkpoint

Reviewed PR #69 head `2eac66e109d95b14ca303eb6c21de63f3e7538a8` passed all 16
applicable checks and merged normally at `2026-09-30T15:39:27Z` as
`33c5c7867acf70add458ebee926db17d89b69711`. Fresh canonical-main readback and
ancestry confirmed that main contains the candidate. The GraphQL PR base SHA was
historical; canonical main was separately fetched as `d4d2902` before merge.

## Corrected-head application evidence

Final Android review found that editing current provenance mutated the retained
converted legacy request through a shared reference. The corrected editor clones
the active imported request. A regression failed on the prior implementation;
16 focused tests and the final schema-aligned case passed after correction.
Independent reviews, analysis/formatting and corrected-head Android replay passed.
APK SHA-256 `011bf8493d4e61dd1c4a4c74c792c5229528518d063b52bf565013c7dbddd74c`.
PID 18337 was absent before 19167; complete native requests/results matched after
cold reopen and the whole legacy record stayed unchanged. Saved/reopened artifact
SHA-256 `3a4ba3591702e59091bece460c38abb2cd00947ae8b8470bfc229ab35cc2c686`.

Both initial iOS application attempts timed out after building without an executed
selected test: push `36723087083` / job `109912925606`, artifact `11104067131`,
SHA-256 `8573aeed19b5a9b0ba9391429b5bc6e7982b8fc443ce77c914e2168d15b2ddb9`;
PR `36723093760` / job `109912949615`, artifact `11103479923`, SHA-256
`5503d6491439c754570f09d0182a32526fbbcf868c3f5eafd3426d09ec9c7400`.
Original ZIPs/logs remain retained. One failed-job retry per run used the unchanged
source; the startup cause is still unproven. No test or timeout gate was weakened.

| Executed application success | Attempt / job | Processes | Artifact / ZIP SHA-256 |
| --- | --- | --- | --- |
| Push 36723087083 | 2 / 109931116665 | 30240 → 41011 | 11104468193 / `1b51a517d488c61634b303c172f5c3a06c38595c3a8b8ed80206ab83b2800207` |
| PR 36723093760 | 2 / 109943287207 | 22318 → 31627 | 11106653744 / `1a8b38c60f2fc3ac9831f3d8592d7c04075dd49003018021d2faa34c368763ea` |

Both selected write/read tests explicitly passed, each prior PID was proved absent,
and two fresh native calculations matched complete saved artifacts, scenario,
workspace progress and native exchanges at revision 1. Both phase archives were
`x86_64`. Root independently downloaded/checksummed original ZIPs and verified
source-bound receipts and screenshots. PR write completed at `15:20:32.008038Z`;
read at `15:23:17.806346Z`; terminal job success at `15:23:37Z`. PR artifact is
386,663 bytes, expires `2026-10-14T15:23:23Z`; push is 386,661 bytes, expires
`2026-10-14T14:43:46Z`. Local receipt prefixes:
`.artifacts/pr68-ios-2026-09-30/ios-application-mobile-2eac-{pr,push}-attempt2`.
This harness builds twice from the same source; it is not PR #72's six-phase
unchanged-bundle acceptance, and programmatic entry is not OS-keyboard evidence.

## Corrected-head native XCTest evidence

Push `36723086930` / job `109912925605` explicitly passed
`RunnerTests.testNativeLogisticsLifecycle()` at `14:01:45.416332Z` (0.211 s).
Artifact `11103425117`, SHA-256
`cbeded0d23691b696093e7822ac485d2868094efabf776f6ee6ab6eaf976bb30`.
PR `36723093839` / job `109912950388` passed at `14:20:48.755036Z` (0.415 s).
Artifact `11103458406`, SHA-256
`b364f3993cdae377dcc871abc067c516b7b520086f4e2ee82339af9be3b22aaa`.
Both were attempt 1; both export audits, 27 fake cases and eight real macOS
fixtures passed. Initial archives were `arm64 x86_64`, prepared archives `x86_64`.

## Separate main evidence and remaining acceptance

Main `33c5c7867acf70add458ebee926db17d89b69711` has separate runs: Flutter
`36738411195`, Android `36738411167`, Rust `36738411125`, web/PDF `36738411123`,
native iOS `36738411118`, and iOS application `36738411212`. Flutter, Android,
Rust, web/PDF and native iOS passed. Native job `109967630402` explicitly executed
and passed `RunnerTests.testNativeLogisticsLifecycle()` at `15:59:12.970895Z`
(0.267 s, attempt 1), with both archive audits (`arm64 x86_64` initially,
`x86_64` prepared), 27 fake fixtures and eight real macOS fixtures. Artifact
`11109234262` is 179,809 bytes, expires `2026-10-14T15:59:13Z`, SHA-256
`54e6de7df7dcff9e48ecd0228267299c49af021382157062152735638da42557`.
Root downloaded its prepared identity and execution diagnostics separately from
the PR-head receipts.

Main application run `36738411212` / job `109966089741` also passed on attempt 1.
Write PID 34322 and read PID 47186 were distinct and each proved terminated.
Both selected tests passed; the full saved artifact/scenario/progress and freshly
executed native requests/results matched, with x86_64 export audits in both
phases. Artifact `11110678855` is 386,661 bytes, expires
`2026-10-14T16:10:56Z`, SHA-256
`2bf3f8655fe915d66e21f923d6ae59e0b3702b40f5f0fb9d464ac51d87f917c7`.
All six separate-main workflows therefore passed. This remains the two-build
write/read harness, not six-phase unchanged-bundle or interruption acceptance.

This accepts workspace recovery/editor development only. Sidecar preservation,
aggregate transactions and genuine aggregate interruption boundaries, full iOS
incomplete/legacy/future journeys and accessible interaction remain separate
candidates/evidence. Physical-device checks stay open per instruction; spoken
output and complete touch-gesture traversal are not established by visual focus.
Tax-v2 web preservation/editor and version-bound PDF output remain open. No release,
deployment or distribution is implied by this merge.
