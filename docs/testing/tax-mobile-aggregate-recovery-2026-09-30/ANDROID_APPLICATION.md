# Android aggregate interruption application checkpoint

The bounded Android matrix passed on PR #75 source
`59234db97fec569ee82219047e07944d0455eee2`. This records that exact candidate;
later commits, CI jobs and main-branch receipts have separate identities. It
does not close all P3 or product-release acceptance.

The production `lib/main.dart` debug application ran on Android x64 emulator
`emulator-5556`, package `com.genesissocietyengine.juris_mobile`. The built APK
and independently pulled installed APK both contain 77,980,752 bytes and have
SHA-256 `94cb614afaada92821bb3d2e0dafaff166293d4af5e2a693d08e3bfed2f87b71`.
Installation used `adb install -r`; no existing application data was cleared.

The actual Export action supplied the platform clipboard, then the actual
Studio Import action consumed it. The complete saved synthetic artifact,
including its source, was retained. No programmatic input or journal fixture
was used for the interruption journeys.

| Verified interruption | Killed PID | Observed continuation |
| --- | ---: | --- |
| Verified staging before publication | 24859 | New PID 25631 preserved the exact old pair and inert staging; automatic native recalculation passed. |
| Published pending intent before finish | 26239 | New PID 26543 entered real recovery from identical stopped bytes. |
| Tax retirement during that recovery | 26543 | New PID 26980 completed the intended pair and explicitly recalculated through Rust. |
| Tax promoted, workspace promotion not started | 27950 | New PID 28437 entered real recovery from identical stopped bytes. |
| Workspace retirement during that recovery | 28437 | New PID 28838 completed the intended pair and explicitly recalculated through Rust. |

Each pause was matched to the exact Git blob, loaded Dart source, breakpoint,
frame, token, domain and VM/Android PID. Paused and stopped file hashes matched;
the old PID was absent before the next process. Both published transactions
completed with exact intended primary files and retained original/before/after
payloads plus retired originals. These are genuine process-death checks,
including two interruptions during recovery, rather than constructed disk states.

Imported artifacts intentionally advance revision 2 to 3 and clear cached results.
The subsequent cold journeys therefore pressed **Calculate** explicitly;
they do not claim automatic calculation from a null cache. Read-only runtime
traces captured native capabilities, preparation and `tax_calculate` returning
`tax_calculated`. Complete requests and normalized responses matched the original
saved inputs/results with the expected runtime revision 4. The saved imported
artifact remained revision 3 with a null cache. Actual screenshots show unchanged
250000.00/200000.00 inputs, EUR 50,000 annual benefit, EUR 500,000 horizon benefit
and EUR 347,634.95 NPV. Actual Continue navigation saved progress separately while
preserving the scenario and tax bytes.

Evidence is retained under
`.artifacts/pr68-ios-2026-09-30/android-aggregate-59234/` in the shared repository
workspace, outside Git. Principal files are:

- `journey-result.json`, SHA-256
  `29867430b432aef5e050c5459570422b8cd431dae3817ee5a4d99b61d3c18d6b`.
- `69-independent-verification.json`, SHA-256
  `7283090fec948dad7dcfa6c3fa375899adea192f9085a03fce132e95a0d20c80`.
- Boundary folders 10/20/22/40/51, native traces 13/30/55, settled pairs 26/54,
  input/result screenshots under `journey/`, and `FINAL_REVIEW.md`.
- `67-final-restored` and `68-final-cleanup.json`: exact original five files,
  absent journal/process, restored clipboard and standalone-file list, unchanged
  font/accessibility/IME settings, removed task debug forward.

An independent reviewer implemented `verify-aggregate-journey.py`; the executing
agent and root reviewed it and independently ran `--require-complete`, exit 0.
It rehashes actual APK/retained files and checks ordered source/frame/PID events,
complete native exchanges, recovery and restoration. Its complete flag applies
only to this five-boundary emulator matrix. Root also visually inspected the
final result screenshot. The helper does not operate the emulator or edit receipts.

Rejected/transient attempts remain excluded: the first pretty-file versus compact
clipboard byte-equality assumption, snapshot 24 taken during recovery, timed-out
observer 25 and guard-rejected observer 50. Each has retained diagnostics; later
source-bound successful evidence is identified above. Prior clipboard restoration
used a separately labelled, constructed opaque cleanup fixture and real Export,
then restored original files; that cleanup is not interruption/import acceptance.

Remaining acceptance includes physical devices, spoken screen-reader output,
full gesture/accessibility behavior, iOS application interruption/recovery,
stale/incomplete/legacy aggregate reconfirmation and wider conflict/future-state
journeys. No cross-process writer exclusion or power-loss durability is claimed.
This checkpoint does not establish P4/P5 web or PDF integration.
