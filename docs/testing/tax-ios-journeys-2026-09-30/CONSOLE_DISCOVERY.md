# Owned console discovery and retained four-phase evidence

The `3ea9e65fb8ecf0007c47dc1cec7d10aeddf0bf7f` application push
`36754010665` / job `110019511951` passed write/read/incomplete-write/incomplete-read
but failed before the legacy-write VM connection. Artifact `11117308402`
(980,763 bytes), SHA-256
`5b3a89c2aa87b4954586b7b7045ed556cfdf50e9e620949e9a57f208d5f065fd`, and full
job-log SHA-256 `e38b9e952366e2d036afcde7114dde3cef1ee57a7b211cfe588968534185e3ca`
were retained before advancing the source. The hosted collector controls passed
13/13 and host deadline controls passed 11/11, including POSIX subprocess cases.

An independent local audit verifies the four-phase prefix: selected-test
completion, exact source/nonce and PID chain 31562 → 34531 → 37692 → 40940,
all four stopped processes, unchanged full bundle, screenshots and x86_64 audits.
Complete saved artifact/scenario/progress pairs match. Baseline outgoing inputs,
normalized native draft, source and calculation match the saved pair exactly.
The incomplete phase exercises Rust `missing_tax_base`, saves an exact blank
rate/null result, and reopens without a native calculation. Bundle-manifest
SHA-256 is `3566220de51ffcdfb70342b48d9ae602488a131ee66a2a511de4e35a2043dccd`.
Local evidence is under
`.artifacts/pr68-ios-2026-09-30/ios-application-v2-pr72-push-cleanup-36754010665-attempt-1/`,
including `verify-four-phase-prefix.py`, its result and `DIAGNOSIS.md`.
This prefix is not six-phase acceptance.

Legacy-write launched paused Runner PID 42404 and waited for the VM URI.
The existing 300-second host deadline returned 124. The later log-reader error
followed timeout teardown, so it does not prove a spontaneous reader failure.
Diagnostics rechecked the isolated executable and observed a loopback TCP
listener at 127.0.0.1:55824; that does not identify its service or authentication
path. The screenshot shows a white viewport. Application-log capture and stack
symbol processing reached their retained 20-second limits. No Rust deadlock,
product assertion failure or confirmed engine cause is claimed.

Pinned Flutter 3.44.8 (`058e0af2c2`) waits for a log-derived VM URI even when an
explicit device port is supplied. Its asynchronous simulator log reader started
442 ms after this launch, compared with 13 ms for a prior successful phase.
A discovery race is plausible but unproven. The harness now uses the supported
`simctl launch --console-pty` and `flutter drive --use-existing-app=<URI>` paths
to make the launch/connection relationship directly observable.

The first phase builds the same debug target with the same source/nonce defines
inside the unchanged 900-second outer deadline. All subsequent phases reuse
that bundle inside the existing 300-second deadlines. No phase define or
authentication-disabling flag is added. Before every launch, the helper rejects
an existing isolated Runner and compares the entire installed bundle with the
once-built source bundle. It captures only the fresh owned console, requiring
the launched PID and full authenticated loopback HTTP URI. Credentials,
redirects, queries, fragments, missing authentication paths and mismatched
processes fail. A bounded read-only `getVM` probe must return the same PID.

The unchanged driver then executes the selected test; its source/nonce/phase/PID
receipt must match this launch. The host rechecks the exact executable,
terminates that application, proves PID absence, closes only its console child,
then performs the existing offline full-bundle/export audits. The receipt
verifier additionally links console, VM, launch, installed bundle and phase PID.
All six phases, native comparisons, screenshots, legacy preservation and final
acceptance assertions remain mandatory. No port is converted into a guessed URI.

Eighteen local controls pass, including a real partial-line/CRLF console,
a real hung console bounded with child cleanup and unchanged prior proof,
failed/missing/wrong-PID driver results, pre-existing Runner rejection,
strict URI/RPC/path identity, duplicate identity and late stream errors.
Initial Windows-only fixture path mismatches and an unclosed test pipe were
corrected; the final run passes without that warning. These controls do not
prove macOS console transport. Actual authenticated console output, all six
executed phases and fresh exact-head CI remain required. Physical keyboard,
VoiceOver, device and iOS interruption acceptance remain separate.
