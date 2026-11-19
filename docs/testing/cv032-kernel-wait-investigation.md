# CV-032 — targeted kernel wait evidence

19 November 2026. Started clean on #342 `aa661030b5d321c18f9ece185dd71f1189e5419d`, main `16304681`. Task branch `codex/cv032-kernel-wait-evidence`. #342 checks remain pending; an Android Kotlin artifact-resolution failure was retained and retried once unchanged. Both implicated plugin-portal/Maven Central POM endpoints returned HTTP 200 during read-only investigation; this does not establish the original remote failure's cause.

## Evidence gap and intended outcome

Retained failure 44537306213 shows RunningBoard in OSLaunchdJob submitAndStart / Mach IPC, but launchd_sim is mostly idle. Healthy launchd samples also contain idle waits and the managedappdistributiond throttling thread. Those user-space samples do not establish the outstanding request's destination, reply owner or kernel wait state. No reset, runtime change or timeout increase is justified as a confirmed fix.

The target-only report is based on the macOS spindump manual (Apple-authored manual reproduced at https://keith.github.io/xcode-man-pages/spindump.8.html): it captures user and kernel stacks; -onlyTarget restricts sampling to the numeric target, -noFile / -noBinary retain text through the existing bounded stdout capture, and -timelimit bounds the tool. Whether this hosted report exposes useful IPC owner details must be verified; it is not assumed.

## Implementation and review

After the selected device's RunningBoard sample, re-query that exact UUID's launch manager and the numeric PID/parent/full executable. Invoke only `sudo -n /usr/sbin/spindump <verified PID> 3 10 -onlyTarget -noFile -noBinary -timelimit 10`. No name selector, other target, interactive prompt, service mutation, report-file upload or acceptance path is added. Missing, changed or partial identity skips the privileged read-only capture. Permission/tool refusal remains diagnostic evidence; later captures continue. Require at least 22 seconds left before starting it; preserve the existing 120-second total, 20-second per-command and 4 MiB output limits.

Acceptance: exact-device fresh identity; no host/name-only sampling; noninteractive, target-only capture; refusal continuation; insufficient-budget skip; unchanged app launch, retry and acceptance. Local 33 diagnostic and 67 lifecycle tests pass, including all these cases. Diff review passes. Hosted report availability, useful kernel wait details and current iOS workflows remain pending. This is an evidence repair, not a resolved CV-032 root cause. Public v229 unchanged.

## Hosted verification and merge decision

Implementation source `d1769f4368723fdd7aed7291496483b485e73007`, PR #343: all 18 checks passed. Push editor 44547211947 and PR editor 44547266151 passed on attempt 1. Both downloaded artifacts independently pass `verify_ios_tax_journeys.py` with the exact source and run-attempt nonce, including six distinct processes, complete result pairs, fresh native calculation, incomplete-input error and preserved legacy state.

| Proof | Push editor | PR editor |
| --- | --- | --- |
| Six accepted PIDs | 20840, 28382, 31026, 32954, 35569, 38190 | 20412, 23695, 25119, 28020, 30656, 34144 |
| Bundle SHA-256 | 91ebdccf4016eac7be633db76c77e5beab5e2d40c7776b89b58858297ab58c0e | c46090ee3bc8dea5184cc87b518cbf3efcc4c6e21cb448b1b2cc6d0b17334f7a |
| Verified RunningBoard PID | 3145 | 3135 |
| Kernel report | completed, exit 0, 27,938 bytes, 7.162 seconds | completed, exit 0, 32,710 bytes, 7.730 seconds |
| Sum of diagnostic command durations | 119.381 seconds | 106.034 seconds |

Each report contains exactly one process header for the verified iOS runtime RunningBoard process and Stackshots user/kernel frames. Kernel frames are partly unsymbolicated. These are healthy-run baselines: neither identifies the outstanding IPC reply owner in a stalled launch. The push SpringBoard sample and both broad application-log queries timed out under existing limits; these are partial diagnostic records, not fully complete captures. Native lifecycle runs 44547211945 and 44547265777 both passed on attempt 1. Local 33 diagnostic and 67 lifecycle tests passed. Evidence is retained outside git under the task's `evidence` directory.

#342 remains OPEN at `aa661030b5d321c18f9ece185dd71f1189e5419d`: PR editor 44545598976 attempts 1 and 2 both failed at the first 120-second simctl launch. Both retained RunningBoard samples show the Spotlight queue waiting in OSLaunchdJob submitAndStart IPC. The unchanged push editor 44545581747 passed and its six-process proof independently verifies. Android 44545581658 passed attempt 2 after the original dependency-resolution log was retained; endpoint HTTP 200 checks and retry success do not prove the original remote cause.

Do not merge #342 while its editor check is failed. #343 includes #342 and is held behind that gate. The green results above belong to the implementation source; the documentation follow-up starts a fresh CI cycle and does not inherit a green status. Main remains `16304681353669012cd112603310bc0fed42a664`; public v229 is unchanged. CV-032 stays open. Next action: retain a recurrence's targeted kernel report and correlate the exact blocked request with device service history before selecting a behavioral workaround; no reset, runtime change, increased launch deadline or acceptance bypass is justified by the current healthy reports.

## Follow-up audit of #342 and #343 (19 November)

Started clean at #343 `d38b9a01f83c5fdd3e21d81ffb8bcc406c16e177`, with remote main still `16304681353669012cd112603310bc0fed42a664`. Retained current artifacts before requesting one unchanged retry per blocked PR: #342 editor 44545598976 attempt 3; #343 native 44555875759 attempt 2. Prior failures remain evidence, regardless of retry outcome.

Both current #343 editor artifacts independently pass all six-process assertions at exact source `d38b9a01f83c5fdd3e21d81ffb8bcc406c16e177`: PR 44555892113-1 accepts PIDs 18014/21401/23394/26240/28596/31250 with bundle SHA-256 `0d295ecc5bbe51ed7499c1d8e6a0be9523f78d6884e89f3d6c6fd669b13102a3`; push 44555875876-1 accepts PIDs 19477/23006/24115/26756/28435/31539 with bundle SHA-256 `3ad1fac6ae0d807780261d6d7dbbb5ecc00c7a1a40ae14b6c37e8fd7a5894e05`.

The PR kernel report captures only RunningBoard 2623 (27,434 bytes, 9.067 seconds); push captures only RunningBoard 3135 (39,268 bytes, 8.148 seconds). Both fresh identity checks and report commands complete successfully. Total command durations are 102.413 / 93.958 seconds. Both broad application-log queries time out; other captures complete. Neither kernel report contains submitAndStart. The healthy push report includes brief turnstile waits (one sample waiting on RunningBoard thread 0x17516, three samples waiting on UNKNOWN TASK thread 0x16686 after two hops). This confirms some owner metadata is available, but also that turnstile waits alone are not a failure classifier. Both healthy launchd samples contain managedappdistributiond throttling. No stalled kernel report or initiating behavioral cause is established; no additional instrumentation, service reset, runtime switch or timeout increase is justified by this comparison.

The new native failure 44555875759-1 is separate: `phases.log` records preparation start at 15:48:07 UTC, and GitHub terminates the preparation step at its 15-minute limit. The retained build log reaches Objective-C compilation/storyboard linking; no prepared identity or test execution is recorded. The paired native run 44555892069 passes. This establishes the failed phase, not the underlying reason for slow preparation. Keep preparation and launch-stall hypotheses separate. Local reruns pass 33 diagnostic and 67 lifecycle tests.

#342 integration: all 18 checks pass; editor 44545598976 attempt 3 independently verifies PIDs 17798/21430/22815/25393/26754/29786 and bundle SHA-256 `fa57fb0e16bf7b6aa8f079ea9fd063eb36e4b0312418bc48a158a0ee7fd40ed8`. Merged as `a7f45809e6d2fcdb6bddbf648c4583a1fed5babd`. The unchanged retry is not a cure. #343 then developed only documentation conflicts due to the parent squash merge. Main's tree equals the original #342 head; preserving #343's superseding progress/backlog entries retains every parent entry. Reconciliation changes no implementation and requires fresh CI. The current native retry remains pending at this checkpoint.

The still-running native retry is superseded by publishing the required merge reconciliation. Cancellation is not a pass or a second observed timeout; fresh native jobs on the reconciled source remain required.
