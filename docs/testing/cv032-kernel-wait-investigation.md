# CV-032 — targeted kernel wait evidence

19 November 2026. Started clean on #342 `aa661030b5d321c18f9ece185dd71f1189e5419d`, main `16304681`. Task branch `codex/cv032-kernel-wait-evidence`. #342 checks remain pending; an Android Kotlin artifact-resolution failure was retained and retried once unchanged. Both implicated plugin-portal/Maven Central POM endpoints returned HTTP 200 during read-only investigation; this does not establish the original remote failure's cause.

## Evidence gap and intended outcome

Retained failure 44537306213 shows RunningBoard in OSLaunchdJob submitAndStart / Mach IPC, but launchd_sim is mostly idle. Healthy launchd samples also contain idle waits and the managedappdistributiond throttling thread. Those user-space samples do not establish the outstanding request's destination, reply owner or kernel wait state. No reset, runtime change or timeout increase is justified as a confirmed fix.

The target-only report is based on the macOS spindump manual (Apple-authored manual reproduced at https://keith.github.io/xcode-man-pages/spindump.8.html): it captures user and kernel stacks; -onlyTarget restricts sampling to the numeric target, -noFile / -noBinary retain text through the existing bounded stdout capture, and -timelimit bounds the tool. Whether this hosted report exposes useful IPC owner details must be verified; it is not assumed.

## Implementation and review

After the selected device's RunningBoard sample, re-query that exact UUID's launch manager and the numeric PID/parent/full executable. Invoke only `sudo -n /usr/sbin/spindump <verified PID> 3 10 -onlyTarget -noFile -noBinary -timelimit 10`. No name selector, other target, interactive prompt, service mutation, report-file upload or acceptance path is added. Missing, changed or partial identity skips the privileged read-only capture. Permission/tool refusal remains diagnostic evidence; later captures continue. Require at least 22 seconds left before starting it; preserve the existing 120-second total, 20-second per-command and 4 MiB output limits.

Acceptance: exact-device fresh identity; no host/name-only sampling; noninteractive, target-only capture; refusal continuation; insufficient-budget skip; unchanged app launch, retry and acceptance. Local 33 diagnostic and 67 lifecycle tests pass, including all these cases. Diff review passes. Hosted report availability, useful kernel wait details and current iOS workflows remain pending. This is an evidence repair, not a resolved CV-032 root cause. Public v229 unchanged.
