# iOS VM discovery from the actual system-log route

Development correction, 2026-09-30. Intended outcome: execute all six existing
application phases through a source-bound, authenticated VM connection, keeping
every native, persistence, PID, bundle, screenshot and export assertion. Actual
macOS execution of this correction is pending. No application acceptance or
physical-device/VoiceOver claim follows from the local controls.

## Original failure, retained before correction

Both application workflows at `bd472b316c663571c578e4beecbe4ee30f00e907` failed
before the first driver or selected test. Each debug build succeeded; the owned
simctl console returned a PID but no VM URI before its 60-second discovery
deadline. Zero phase receipts completed. The two native workflows separately
passed the selected XCTest, both product audits, 27 fake and 8 real fixtures.

| Event | Application run / job | Build duration | PID | Artifact / ZIP SHA-256 |
| --- | --- | --- | --- | --- |
| push | 36760793990 / 110042517283 | 503.163 s | 33708 | 11119547409 / `471bc77fb6d911301345237305ad795caca062cd1fb4caf8af4309c3280a8054` |
| PR | 36760800700 / 110042543589 | 671.858 s | 42248 | 11118939787 / `e6d35f2aa8d0ba702aef0c870ff1c29077840d1c483a5c18fb246369b98a98df` |

Complete job-log hashes are respectively
`e611a77c07249d120f58e0921a15d84f269eda347ea8ada0c7789f615350b1bc` and
`9912735f112fd5e2b6cb34718365d88077575aad807a07e8af8ce58a4c9fe8c5`.
Original ZIPs, raw metadata, full logs and extracted files remain under
`.artifacts/pr68-ios-2026-09-30/ios-application-v2-pr72-console-{push-36760793990,pr-36760800700}-attempt-1/`.

The push SpringBoard log records Runner33708 exiting by SIGTERM at
19:03:00.459–.465. Its PID line arrives in the complete job log only at
19:03:01.279728, consistent with parent-output buffering. The helper closed its
simctl console before outer diagnostics started at 19:03:02, leaving no live
Runner for sampling. [Apple's Simulator command-line presentation](https://developer.apple.com/videos/play/wwdc2019/418/)
documents signal forwarding through the console. This explains a diagnostic
gap; it does not establish an independent application crash or engine deadlock.

## Verified announcement route and correction

The pinned Flutter SDK is 3.44.8, framework
`058e0af2c2b57e369d905a03ac9748b0ebf543c6`; its Dart revision is
`d684a576a6aa954ae107a03b2b4e1d61c3bebe93`.
[Dart's service announcement](https://raw.githubusercontent.com/dart-lang/sdk/d684a576a6aa954ae107a03b2b4e1d61c3bebe93/sdk/lib/_internal/vm/bin/vmservice_server.dart)
calls `serverPrint`, then `print`. The Flutter service isolate installs its
`dart:_internal._printClosure` hook, which routes through `Logger_PrintString`,
`UIDartState::LogMessage` and the iOS `FlutterDartProject` callback to
`FlutterLogger.logDirect`. [The pinned iOS logger](https://github.com/flutter/flutter/blob/058e0af2c2b57e369d905a03ac9748b0ebf543c6/engine/src/flutter/shell/platform/darwin/common/framework/Source/Logger.swift)
selects `SyslogOutputWriter` and uses `vsyslog(LOG_ALERT)`. Thus console stdout
alone was an unsupported discovery assumption. The pinned Flutter
`simulators.dart` uses `simctl spawn <device> log stream --style json`.

The replacement starts an owned unified-log stream before an ordinary short
simctl launch. It retains the launch's stdout/stderr and rejects a nonzero exit
or anything other than one exact app/PID line. Full JSON objects supply the VM
announcement, with exact numeric PID, full installed executable path, log-event
type and an aware timestamp no earlier than the precise launch start. The full
authenticated loopback URI must still pass the original URL restrictions,
read-only `getVM` PID check and selected-test receipt PID check. No port guessing,
authentication change, publication change or production code change is used.

A stream banner or opening JSON bracket is not treated as subscription-ready.
One independently bounded query of the previous two minutes, scoped to the new
PID and exact executable, covers an announcement emitted before subscription;
the precise timestamp gate rejects old records. A query timeout/nonzero is
retained and cannot provide identity; an independently valid live event can
still establish identity. The discovery deadline remains 60 seconds. Duplicate
keys, malformed records, ambiguous identity or late errors fail closed.
Multiline objects, escaped newlines and array/object-stream framing are parsed
as JSON. Identical verified identity fields may have different ancillary
metadata in live versus retrospective output; both whole records and origins
are retained. Conflicting identity remains an error.

On failure, a bounded read-only PID/executable and screenshot probe occurs
before log-reader cleanup. Cleanup targets only the reader child; it does not
terminate the failed Runner. The existing outer collector can therefore inspect
the still-live application before the workflow shuts down its isolated
Simulator. Probe failure cannot replace the original failure. Successful phases
still explicitly terminate Runner and prove PID absence before completion.

The independent verifier replays the exact committed parser against raw log
files, checks the selected events' provenance and full identity, and preserves
all six existing application assertions. The local artifact capture helper
retains both exact Git blobs beside the verifier; it executes no code from the
downloaded artifact. The first-phase 900-second, subsequent 300-second, app and
driver deadlines and both native export audits remain unchanged.

## Validation and review

Focused controls: 28 pass locally, including real chunked reader subprocesses,
separate stderr, bounded hung discovery, stale evidence, malformed/duplicate
JSON, wrong PID/path/time, unsafe URI, conflicting and metadata-only records,
backfill-only discovery, retained backfill timeout plus valid stream, late
identity rejection, failed launch stream retention, missing/wrong driver proof,
live-probe ordering and primary-error preservation. The retained verifier also
passes a raw-origin positive control and rejects changed PID, missing raw record,
forged origin, wrong URI and stale time. An initial synthetic JSONL fixture used
pretty JSON; it was corrected to actual one-record-per-line data, without
relaxing the assertions. These tests do not establish macOS system-log delivery.
Root and peer independent source reviews passed; each independently ran the
preceding 26-case set. Hosted execution remains pending.

The earlier `3ea9e65` four-phase prefix remains source-specific; its missing
legacy phases are still open. Future-envelope and actual interrupted-write iOS
journeys remain a separately planned slice. Physical devices, audible screen
reader output and full gesture acceptance remain open.
