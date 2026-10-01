# Bounded Simulator installation command

The exact `7d6cd91fddec6d7cb706758b0afd8034546bd94b` PR application run
36766534214 / job 110062640743 failed before launch after a successful build.
Xcode reported 572.2 seconds; the full Flutter command reported 786.110 seconds.
`simctl install` then exceeded `command()`'s generic 30-second limit. The outer
`tax-write` process returned 1 at 19:59:02Z; it did not hit its 900-second deadline
or return 124. There was no launch, VM discovery, selected
test, completed phase or application acceptance.

The retained artifact 11121384477 is 3,427,662 bytes, SHA-256
`3c5d09191ab2c63a104b51c27e0f4f6f6a766aaab1adaf7f40b21950ec5a461a`.
Complete job-log SHA-256:
`e5a883bf5a762e11b0debd59752137827f957b2a5f24c4131390c3878a59dfdb`.
The root-local immutable receipt is under
`.artifacts/pr68-ios-2026-09-30/ios-application-v2-system-log-7d6-pr-36766534214-attempt-1/`.

Later diagnostics found the exact Simulator's installed application registration
and its Home-screen icon, but no running Runner. This does not substitute for a
successful installation command or the full installed-bundle check. The reason
installation exceeded 30 seconds is not established. The independent push run
passed installation and failed later during discovery; that separate failure
is recorded in [SYSTEM_LOG_DISCOVERY.md](SYSTEM_LOG_DISCOVERY.md).

The helper now gives installation an explicit 120-second command limit inside
the unchanged 900-second first-phase and 300-second later-phase limits. Existing
per-phase installation behavior is preserved. A slow build plus installation
can still exhaust the outer budget; this must remain a genuine failing timeout.
No application, financial, export, bundle, selected-test, source, nonce, PID or
six-phase assertion is relaxed.

Before spawn, the helper records exact argv, phase, source, nonce, Simulator,
input-bundle hash and start time. An outer kill leaves only incomplete start
evidence. Returned commands retain raw stdout/stderr and an explicit terminal
exit, timeout or spawn-error record. Only actual exit 0 with untruncated captured
output allows the existing installed-bundle check. Later container presence
cannot bypass this gate. The 1 MiB output check bounds retained output after
subprocess capture; it is not a live memory cap.

The offline six-phase verifier independently requires each new install start
and terminal record to agree with that phase's source/nonce/Simulator/bundle.
It checks command shape, successful exit, raw stream hashes, timestamps and a
finite nonnegative elapsed duration.
A start-only record, timeout, nonzero exit or changed source, command, bundle or
stream cannot produce acceptance.

Local validation: 40 integrated controls pass, including the original 28,
8 installation controls, 2 offline-verifier controls with 8 negative mutations,
and 2 stable system-log identity controls. One real hung
child must be stopped by a short injected command deadline while prior proof
bytes remain unchanged. The 31-second successful duration uses a controlled
clock; it is not a macOS timing claim. A unit interruption case verifies start-
only evidence; existing actual POSIX outer-deadline controls remain separate.

An initial 35-control attempt had 6 existing lifecycle-fixture errors because its
subprocess fake previously represented only Flutter build/drive and returned no
captured streams. The fixture now routes installation through its captured-
command fake; no production fallback or acceptance assertion was weakened.
Root and peer source reviews passed for the installation correction and offline
guard. The peer independently passed all 40 integrated controls. Fresh hosted
execution of all six application phases remains required for acceptance.
