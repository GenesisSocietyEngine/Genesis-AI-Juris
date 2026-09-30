# Bounded iOS application driver correction

Base source: `0a6590a8eca135c5c94623730fa5869a98a5537d`. The intent is to
fail promptly with useful evidence when the application cannot complete a
phase. No source cause for the black screenshots is claimed. All six phase
assertions, whole-input/native response checks, previous/new PID rules, exact
selected test, screenshot and source/nonce validation remain mandatory.

The two diagnostic runs failed at different observed stages:

- PR run 36740038224 / job 109971733133: Xcode completed in 196.7s at 16:03:03Z.
  Runner PID 21080 launched, VM/DDS connected, selected test logged at 16:03:40Z,
  and phase `write` started at 16:03:42.925266Z. `request_data` warned only after
  1,200,015ms. No phase receipt completed. At failure Runner remained live;
  screenshot is black. ZIP artifact 11111397834, 170,429 bytes,
  SHA `9f9d9a29d4ba2ea6b3af28ab11b40599c7bbf91853b8dd7293bf8ff59603813f`.
  Full job-log SHA
  `0e0c6a2047c046442aa5e79c6dad688872e9ac0e0a062671de46bf76697ad350`.
- Push run 36740035469 / job 109971727903: Xcode completed in 392.2s at 16:16:59Z.
  Verbose output ends at `simctl launch` and its log stream, with no returned
  PID, VM connection, selected test or phase receipt. Failure diagnostics still
  found Runner PID 30867 live and a black screenshot; listapps and app-container
  commands each hit their 20s bound. ZIP artifact 11112700877, 167,323 bytes,
  SHA `4a16b51b0e7866b92b9bed79fc15d22ab89014e59f8f57991cda34b8086f99e7`.
  Full job-log SHA
  `cfc587aa7bd6e5ff8c25441457324734c6a87572717948fcf4e3eb3cfbfd7c70`.

Both complete logs, metadata, immutable ZIPs and extracted diagnostics are in
the shared root `.artifacts/pr68-ios-2026-09-30/ios-application-v2-pr72-{pr,push}-diagnostics-<run>-attempt-1/`.
Both terminal failures were captured before any successor publication.

The last PR app marker precedes native bridge construction and the first
awaited workspace read at test line 71, then fresh-storage checks and the first
`pumpWidget` at 108. Existing logs cannot select a particular await as the cause.
Installed Flutter 3.44.8 source establishes a harness weakness: Live binding
uses `Timeout.none`; a pump waits on `_pendingFrame.future` without a timeout;
`pumpAndSettle` and the harness 45s loop check deadlines only between pumps.
FlutterDriver's `_warnIfSlow` logs at its timeout but returns the original
pending future. Thus `integrationDriver(timeout:20min)` was not a hard bound.

The Dart correction replaces the wrapper with the same public FlutterDriver
and integration-test Response APIs, under a real 4-minute deadline. Checkpoints
and 45-second awaited-stage bounds identify support/proof/storage construction,
native ABI construction, first widget/first rendered frame and UI pumping.
An explicit 3-minute application test timeout provides an additional bound.
Failure diagnostics use only local read-only getVM/getIsolate/getStack RPCs,
strip application locals, cap isolate/frame counts and retained output, and
have independent RPC, total diagnostic and close limits. The driver exits 1
after failure because Future.timeout cannot cancel underlying work. Success
markers follow every unchanged report check and successful close.

The driver guard does not cover Flutter/simctl startup before the driver runs.
The complementary Python host wrapper starts a dedicated POSIX process group,
inherits output and preserves ordinary exit status. It bounds the first build
phase to 15 minutes and each prebuilt phase to 5 minutes, then sends TERM and,
after a bounded grace period, KILL to the owned group even if its parent has
already exited. A timed-out command always returns 124, including a child that
handles TERM by exiting zero. Bash pipefail prevents acceptance after timeout.
This covers the separately observed push launch-stage stall without removing
any phase assertion. The workflow still owns isolated simulator cleanup.

Focused Dart verification: **8/8 pass**, analysis of all five Dart files clean,
formatter reports zero changes, diff whitespace check clean. Controls cover
never-completing request/diagnostics/close, primary-error retention, close
failure, late reply, read-only RPC allowlist and frame-local exclusion, RPC
nonresponse, and an actual child process with a live event source that must
exit 1 within its wall-clock test bound and preserve exact preexisting proof
bytes without a success marker. The first child test used an incorrectly
resolved SDK directory URI; trailing-slash correction passed the final suite.

The host wrapper's first Windows negative control exposed an unconditional
`SIGKILL` reference, unavailable on Windows: cleanup failed and the child test
hit its 60-second sleep. Platform-specific termination corrected this; both
owned process IDs were checked absent afterward. Final Windows host controls
passed four tests, with two POSIX-only tests explicitly skipped. Independent
review reran that result and checked group ownership, parent-exit handling and
the unchanged fail-closed Bash pipeline. The macOS workflow now runs all six
controls, including a TERM handler that returns zero and a TERM-ignoring
descendant whose parent exits early. Those POSIX runtime results remain pending
until exact-source CI executes them.

Logs: `.artifacts/deadlines-tests-final.log`,
`.artifacts/deadlines-analysis-final.log`, `.artifacts/deadlines-format-final.log`,
`.artifacts/deadlines-host-tests-final.log` and
`.artifacts/deadlines-collector-tests-final.log` (six collector controls pass).
The explicit FlutterDriver SDK dev dependency was already transitive; the lock
change only marks it direct-dev, with no version changes. No iOS runtime
success is claimed for this correction. New exact-source CI must
still execute and pass all six phases.

The corrected source `962e71053bd026014f87f1ecd49ef6f7eef9a67c` then produced
a terminal push application failure in run `36747853715`, job `109998512423`.
Both macOS Python suites passed all six cases, including POSIX process-group
controls. Xcode completed its 184.5-second build at 17:05:57Z; `simctl launch`
returned Runner PID 18448 at 17:06:29Z. Flutter waited for a VM-service URI,
without a connected VM/driver, selected test, app checkpoint or phase receipt.
The host `tax-write` deadline fired at 17:16:19Z, 900 seconds after its start,
and the step returned 124 even though Flutter's shutdown printed exit zero.
Collector/upload completed. Artifact `11114496143` contains 206,234 bytes,
SHA-256 `316825bbe4715add4a38981aa29d8356da4b50c688c3e874007106ba057fba9e`;
the complete log SHA-256 is
`965e08512b0f755cb987ec0f54a65dab43eee0581e1bc8c51ba1a259eb1516a9`.

The screenshot shows a white application area with status/home bars; the
verified app process remained live. Its bounded system-log capture only reached
17:01:33–17:03:20 SpringBoard history before the 20-second cutoff, with no Runner,
app identifier or VM-service entry. That capture precedes the actual launch and
cannot establish engine failure or a lost service announcement. Flutter's
installed simulator launcher waits on a log-derived VM URI; neither possibility
is resolved by the retained evidence.

The follow-on collector prioritizes Runner/app-specific history, separates a
two-minute SpringBoard window and adds native stack/listening-socket evidence
only after matching one PID to the full app executable returned by this isolated
Simulator's container query. It rechecks the PID and executable before each
native command; ambiguous, truncated, failed or changed identity prevents the
command. The sampling command uses a three-second period with ten-millisecond
intervals, following the [documented sampling interface](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/LaunchTime/Articles/MeasuringLaunch.html),
with output directed into the existing capped capture. No process arguments,
environment, application storage, calculation behavior or six-phase assertion
changes. Existing 120-second collector, 20-second command and 4 MiB output bounds
remain; nonzero/unavailable results are retained as diagnostics.

All 13 local collector regressions pass, including exact/foreign/ambiguous PID
selection, changed-PID refusal, priority of app logs, shared deadline and native
tool-error retention. Actual `sample`/socket collection on macOS remains pending;
these tests establish selection and failure handling, not iOS application success.

The independent PR application run at the same `962e710` source failed earlier:
run `36747861519`, job `109998547879`, from 17:17:09 to 17:17:32Z. All six collector
controls passed, but `test_hang_has_real_host_deadline` observed child exit 1
instead of required 124. The assertion omitted the captured child output, so
its cause cannot be recovered from this log. No Simulator, build, selected test
or application phase ran; no artifact directory existed to upload. The complete
retained log SHA-256 is
`befeb7e98f5580ab2239176f6d94b8f7bbf84964c340208d4387457230cbcb73`.
This is distinct from the push run's verified host timeout after app launch.

The narrow follow-up adds captured stdout and stderr to every host-test status
assertion. Expected statuses, time bounds, subprocess commands and production
deadline behavior remain unchanged. It neither diagnoses nor fixes the unknown
PR smoke-test exit, and a new hosted run must execute the same six controls.

At source `f245149d04f1b03c3f129849b3a8c6bd113c6bd8`, push application run
`36752988890`, job `110016052915`, failed the same smoke control before setup.
This time the retained child diagnostics establish that the 0.2-second timeout
fired, then `os.killpg(2038, 0)` raised `PermissionError: [Errno 1]` while checking
the owned group during cleanup. No app phase or artifact exists. The complete
log SHA-256 is
`b182da29c85d32a008ea1b34480614432801c244f24078c7bf6249894353b307`.
The same source's PR application run `36752995910`, job `110016077684`,
also failed before setup: collector 13/13 passed, then the same deadline
control hit `PermissionError` probing owned PID 1647 after timeout. Its full
log SHA-256 is
`b76e1e165d57beb481447beeaef6fc6c97c7e99085d06c85ea0117ad0c91c3d4`.
Both terminal failures are retained independently, without an artifact or phase.

Apple's [killpg contract](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/killpg.2.html)
does not treat permission denial as proof of absence. The inspected
[XNU implementation](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/kern_sig.c#L1612-L1621)
can also return EPERM when its group iteration finds no eligible member after
filtering zombies. A post-TERM zombie window is therefore consistent with the
trace, but is not established as this runner's cause.

The bounded correction distinguishes present, absent and unknown group states.
Only `ProcessLookupError` establishes absence; permission denial retains an
explicit diagnostic and keeps the original group eligible for bounded cleanup.
Denied TERM/KILL is recorded without expanding the signal target or seeking
additional privilege. A still-present or unknown group after cleanup emits
`cleanup_incomplete` with its state; timeout still exits 124 and cannot pass.
Unexpected OS errors remain errors. Existing wait bounds and all application
acceptance assertions remain unchanged.

Local host controls pass nine cases, with the two actual POSIX controls skipped
on Windows. Added deterministic cases cover denied-probe then absence,
persistent signal/probe denial, an exited parent with a surviving descendant
group, a still-present group after force, and an unexpected OS error. These
controls test failure semantics, not macOS cleanup or application success.

At source `040c5805e09531eed45baee4198669b0e2d5c9d4`, push application run
`36781636633`, job `110113058076`, failed before toolchain setup at
21:48:01Z. Collector controls passed 13/13. The host suite ran 11 cases,
with `test_descendant_cannot_survive_parent_early_exit` failing because its
heartbeat file did not exist. The wrapper returned the required 124 after
its 0.5-second fixture timeout. The missing heartbeat does not establish
that a descendant survived cleanup: the fixture had not established that
the nested Python process was ready before its deadline. The complete log
SHA-256 is `eb656d69d29821d1be5747ef30520980e31f3f37b9c629381d9b4f4d878fd20a`.
No application evidence directory or artifact existed; zero application
phases ran. The companion PR job passed that smoke step and was left running.

The test-only correction separates bounded fixture startup from the behavior
under test. It creates a new owned process group, waits at most five seconds
for the parent and TERM-ignoring child to report readiness and for the child's
heartbeat to change, then calls the actual `stop_owned`. At the forced signal
it requires that TERM has already ended the parent while the child still
belongs to the same group. It requires forced cleanup, the parent's TERM
exit, and a stopped heartbeat. A `finally` block targets only that fixture's
original group even if an assertion fails. The separate real `main` deadline
control still requires exit 124; production deadlines and cleanup code are
unchanged.

Locally, nine host controls pass and the two real POSIX controls remain
explicitly skipped on Windows. Root and independent peer source reviews passed;
root reran the final suite. Actual macOS execution of the revised readiness
control remains pending; no cleanup/runtime acceptance is inferred from the
Windows run.
