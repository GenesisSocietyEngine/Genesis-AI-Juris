# Native process identity correction: independent source review

Reviewed 28 September 2026 before the coordinator's retry. **No substantive issue found in this bounded correction.** The exact original ownership guards remain; the proposal corrects a comparison between timestamps recorded at different precision without adding a tolerance. This note is source clearance, not evidence of successful shutdown or assembly.

The reviewer read and compared the two scripts, the retained failed execution receipt and the recorded read-only diagnosis. The reviewer did not execute PowerShell cleanup, the assembler, a parser/syntax run, an ADB command, a process query, a token read, a browser/network action, a test or a build. Only this ignored note was written. The author's parser-only PASS is reported separately; this review does not convert it into a runtime result.

## Exact reviewed bytes

| Artifact | SHA-256 |
|---|---|
| Corrected `cleanup-owned-emulator-native-identity.ps1` | `a1dcc3fb93efa2bc2042a88fe487386ffbfe434d1ea563e6dda7883e76342dad` |
| Original retained `cleanup-owned-emulator.ps1` | `6ec23539a69f8074a2841fc3a7ec32d68e6407bb908ab187d8006fff6350f631` |
| Corrected `../ux-reconciliation-auth/assemble-final-status-native-identity.mjs` | `b3e1909306d7338a8923fa85ea12fee92a68bf516882cad087f31c65e2a91d16` |
| Original retained `../ux-reconciliation-auth/assemble-final-status.mjs` | `b5b4c2182a33edb7a978c051e0e27703ad833329c57619d21e9048eaefe47c62` |
| `cleanup-native-identity-diagnosis.json` | `1e6f90e993e2f4182704ffbaa2c6531f5ec17a781cdecb63d4b16cbab1989474` |
| Failed actual `cleanup-execute-20260928T010043566Z.json` | `087923b2ab0f86bb33d42da1fdf0cf47116f4f89f075a77eb7d71ab18a6cc97f` |

## Observed failure and diagnosis

The retained first execution has `STOPPED_FOR_REVIEW` and error `Fallback process handle no longer matches owned instance.` It records only the graceful ADB attempt, which exited zero but returned `KO: missing authentication token` and an unknown-command response. Exit zero therefore does not establish a successful graceful shutdown. No successful fallback action was recorded in that receipt; its error location precedes the fallback termination call.

The diagnosis records a subsequent read-only host observation of the two original process identities, with matching CIM/native paths and an acquired native handle. PID 4116 has CIM creation `2026-09-27T20:35:08.4851430Z` and native creation `2026-09-27T20:35:08.4851438Z`; PID 25048 has CIM creation `2026-09-27T20:35:09.6325920Z` and native creation `2026-09-27T20:35:09.6325926Z`. These differ by 8 and 6 100-nanosecond ticks. The diagnosis identifies its successful host tool observation separately from its preparation timestamp and retains the preceding sandbox metadata-access failure. This review relies on that recorded observation; it is not a new live process attestation.

## Minimal source change

The cleanup diff adds the two exact observed `nativeCreationUtc` constants. The original CIM creation times, exact parents, paths, required task-only command-line tokens, launch-receipt checks, AVD/serial checks, original-profile preservation, source guards, bounded waits and error handling remain unchanged. It adds no token reading, console-authentication workaround, generic process termination, ADB-server termination, user-AVD mutation or broader process selection.

During fallback, the script retains the native handle before the final checks. It then rechecks the complete original CIM identity after acquiring that handle, compares that handle's native creation time and executable path with the exact recorded values, and calls `Stop-Process` on the same object. Disposal remains in `finally`. A changed/absent process or mismatched identity still fails closed; no tolerance or rounding can admit a replacement instance.

The successful fallback receipt adds its observed `nativeCreationUtc` beside the original CIM creation identity. The separate assembler changes only the corresponding proof check: an exact native-time map for these same two PIDs and exact equality for each fallback receipt action. It retains the pinned original ownership/preservation receipt, same-serial graceful action, at most two unique owned fallback PIDs, exact original creation checks, action interval, four ADB argument sequences and final process/serial absence requirements. A graceful operation that returns a failure message can only be followed by a successful final cleanup claim if the existing fallback and final readback requirements actually pass; it is not represented as a graceful success.

## Required execution evidence

The original script, failed execution receipt and original assembler remain byte-exact at the hashes above. Preserve the failed attempt in the final history. The coordinator must separately execute the reviewed correction only under its existing authorized cleanup scope, retain the actual result and verify final preservation/absence before assembly. Any changed source, new PID/identity, failed readback or cleanup error needs review rather than relaxation. Final Markdown and copied receipts still require independent output review; source clearance does not certify the future result or close product acceptance gaps.
