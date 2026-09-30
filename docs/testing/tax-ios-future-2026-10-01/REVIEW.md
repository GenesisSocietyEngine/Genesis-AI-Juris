# iOS future-format application checkpoint

This slice makes future-format preservation executable against the actual iOS
application and shared Rust engine. Its development base is PR #72 source
`9f2b733ab18d5b9dc89e1fce9217a5c5956d0b69`; canonical main at preparation was
`54d6d29868db0fe0fa4c570d89571cbfcd55ed18`. The original user checkout and its
unrelated edits remain untouched. This branch contains test infrastructure and
review notes, with no production calculation or editor behavior change.

Acceptance requires a terminal, exact-source macOS run of the selected
`production application future data preservation` test in all ten phases:
baseline-write, baseline-read, workspace-future, tax-future-unsafe,
import-future-unsafe, tax-future-safe, import-future-safe, tax-future-tmp,
tax-future-bak and restored-read. Local fake fixtures, a successful build, an
uploaded artifact or a printed completion marker do not satisfy this gate.

## Application and preservation contract

The test exercises production widgets and persistence services, and observes
the real native request/response boundary without replacing the Rust engine.
Baseline and restored reads require identical full authoring inputs and freshly
recomputed native results. Future inputs cover a BOM/CRLF unsafe integer
`18446744073709551617` and a distinct safe integer `9007199254740991`, so numeric
preservation refusal cannot be confused with future-version refusal. Raw current,
temporary and backup generations and exported bytes must remain intact.

The harness creates one new Simulator UUID. It installs one fully hashed bundle
and reuses that installation across ten distinct app processes. Before first
launch it captures the original authoring roots, including absent and empty
roots. After the complete chain it restores those exact bytes, removes only its
validated control/export files, shuts down and deletes that owned Simulator,
and proves unrelated Simulator identities remain. Clipboard restoration is
explicitly false: this isolated Simulator is destroyed instead.

The checked Git transport is pinned to PR #72's direct cached-Dart correction.
Preparation freezes Flutter 3.44.8, framework
`058e0af2c2b57e369d905a03ac9748b0ebf543c6`, Dart 3.12.2 and executable identity.
Every phase rechecks that SDK, binds the authenticated VM URI to the actual
Runner PID/executable, and requires the driver's actual zero exit and complete
raw output. The original tax and gameplay XCTest workflow remains separate.

## Reviewed execution boundary

Preparation has a 900-second limit; each app phase and final restoration has a
300-second limit. The complete normal exercise, including creation, boot,
restoration, deletion and final verification, has a 1,800-second monotonic budget.
Failure gets a separate 180-second allowance for diagnostics and freshly
re-proven owned-device cleanup. Failed phases cannot launch a later phase or
restore an incomplete authoring chain. Cleanup cannot turn failure into success.

Each phase owns a new POSIX process group. Both normal and failed child exits
require bounded group cleanup. Host command logs use capped readers and retain
actual exit, truncation and capture-completeness metadata. Simulator inventory
output has a bounded returned capture; its temporary disk output is polled and
is not claimed to have a hard instantaneous disk cap.

Independent review found and corrected late-observed zero exits, preservation of
the primary timeout when terminal logging fails, aggregate cleanup budgets,
and an outer-log name collision with immutable phase replay. The final verifier
accepts a shortened positive lifecycle command budget only within that role's
maximum and checks the actual elapsed interval against the retained cap.

The read-only final verifier replays all real phase ledgers, twelve outer
commands, original restoration, rich lifecycle records, and ten per-architecture
export audits. Each audit still requires exactly the three mobile exports and
rejects extra tax exports or diagnostics. Trusted checked-out Git helpers execute;
downloaded artifact contents never execute. Details and controls are recorded in
[HOST_BINDINGS.md](HOST_BINDINGS.md) and [FINAL_VERIFIER.md](FINAL_VERIFIER.md).

## Validation and remaining gates

Focused Windows controls passed: 55 transport, 7 concrete adapter, 26 Simulator
lifecycle, 9 bounded command, 6 orchestration and 15 shared diagnostic controls.
The deadline suite passed six controls with one POSIX-only case skipped; the
binding suite passed 27 with two POSIX-only cases skipped. The final verifier
passed 20 portable groups. The five Dart target/driver/control files analyzed
without issues; all 16 Dart protocol controls passed with random seed 27182 and
the existing dependency lock unchanged. The integrated Python run passed 195
controls with 23 POSIX-only skips (218 total, 122.966 seconds); the subsequently
added isolated CLI and exact prepared-source pin cases passed in the final
20-group verifier run.
These are implementation controls, not application runtime evidence.

Root and independent reviewers inspected the orchestration, deadline, capture,
direct-Dart and final-verifier boundaries. Findings above were corrected and
rechecked. Actual macOS POSIX controls and ten-phase runtime evidence are still
pending at initial publication. Review retained PNGs separately after a complete
run; structure/hash validation alone is not visual inspection.

These constructed future temporary/backup fixtures do not establish genuine
interrupted-write recovery. Actual iOS process-interruption journeys remain a
separate P3 item. Physical devices, spoken screen-reader behavior, mobile
keyboard/gesture coverage and enlarged-text acceptance remain open under the
user's instruction to use CI and emulators. Provider identity, run/job/attempt,
source SHA, archive architectures, executed tests and artifact API digest must
accompany any later acceptance. PR-head evidence and subsequent main evidence
must be recorded separately; this checkpoint is not product-release approval.
