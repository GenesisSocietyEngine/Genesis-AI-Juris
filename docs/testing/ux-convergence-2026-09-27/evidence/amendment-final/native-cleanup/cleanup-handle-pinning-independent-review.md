# Independent review: cleanup handle retention

Reviewed 2026-09-27. **No new substantive finding in the narrow correction.** The reviewed source now explicitly retains the native process handle before the fallback identity reads and termination. The termination branch remains NOT_RUN; the active aggregate must retain its emulator until root explicitly confirms final gate completion.

| Reviewed input | SHA-256 |
| --- | --- |
| `cleanup-owned-emulator.ps1` (14,442 bytes) | `6ec23539a69f8074a2841fc3a7ec32d68e6407bb908ab187d8006fff6350f631` |
| Archived old source, `cleanup-before-handle-pinning.ps1.source.txt` (14,123 bytes) | `2efb2390e401af6ebf7fddc6b5e274311e5a85a2bed793388d2a70ea4c68d415` |
| `cleanup-handle-pinning-receipt.json` | `77a5aa39a414973d79676ff422665573c8edcd5c059b0e369da98e12b7333294` |
| `cleanup-preparation_only-20260927T235106735Z.json` | `85e21f8ef743bb37cb413950e22d9a3bc53168619954198e67021fff7bb30060` |

The exact old/new diff has one changed fallback block. After the unchanged full CIM check and `Get-Process -Id` for a specific owned PID, a `try` block now evaluates `$taskHandle.Handle` before checking that same object's exact start timestamp and executable path. `Stop-Process -InputObject` receives that same object. Its `Dispose()` runs in `finally`, including when validation or termination throws. The action receipt is still added only after the stop command returns successfully. There is no new process lookup between the final object checks and stop, no expanded PID set, and no change to the AVD/serial guards, root-completion requirement, graceful serial-specific shutdown, wait limits or preservation comparisons.

This addresses the specific missing explicit native-handle retention identified by the separate reviewer. My earlier `cleanup-independent-review.md` cleared the old source's overall scope but did not identify that weakness; retain that earlier report as historical, and use this review with the corrected source identity for a future execution decision. Neither review proves an atomic operating-system transaction or an executed PID-reuse race test.

Independent static verification here: the PowerShell parser returned zero errors; exact source and receipt hashes match the supplied preparation record. The retained read-only preparation ran from 23:51:06.776Z to 23:51:09.023Z and records `READY_NOT_EXECUTED`, `executed: false`, no actions, two serial-specific identity commands with exit 0, and the exact expected launcher/QEMU identities (4116/25048, serial 5580, AVD UXGatePixel). It reports the original AVD configuration hash unchanged, all 18,661 file metadata entries unchanged, and the exact clean mobile checkout `5200b30cc50c77393c6f48b52ce91c0f30e70c64`. Configuration is byte-hashed; other AVD files are metadata-compared only. These remain the preparation runner's observations, not a fresh live inspection by this reviewer.

This review performed file reads, an exact diff and parser inspection only, then wrote this ignored report. It did not invoke the cleanup script, ADB, process discovery or termination; it made no tracked edit. Future cleanup success, fallback execution and aggregate success are unverified by this source review.
