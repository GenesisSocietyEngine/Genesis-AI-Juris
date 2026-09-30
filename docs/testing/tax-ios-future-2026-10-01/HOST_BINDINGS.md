# Future iOS host bindings and evidence replay

The host bindings connect the actual source-bound transport to stopped
filesystem preparation and verification. They preserve original authoring
bytes, prepare only the declared future-format fixture, and refuse the next
phase unless disk, application receipt, driver, native exchange and transport
evidence agree. This document records implementation checks, not an executed
iOS future-data journey.

The integration started from `6c86bfb5b2e41331860974342b863536c3a67916` in an
isolated worktree; recorded `origin/main` was `54d6d29868db0fe0fa4c570d89571cbfcd55ed18`.
The direct-Dart alignment follows the reviewed fast-forward to
`9f2b733ab18d5b9dc89e1fce9217a5c5956d0b69`. This slice owns
`future_host_bindings.py`, `future_phase_transport.py`, `live_adapter.py` and
their three tests under `.github/scripts/ios_tax_future/`.
Parent orchestration, authorization, deadlines, final verification and workflow
integration are separately owned. No Simulator was operated by these local
tests, and no source publication is implied by this note.

## Runtime contract

The parent must authorize the checked-out source and concrete macOS adapters
before invoking them. It builds once in the independent 900-second preparation
wrapper and runs each phase in its own 300-second wrapper. There is no
replacement build callback or no-op. The bindings load only the pinned
source-owned Git transport helper at `9f2b733`, blob
`616b94e8435426afc975b7c78b8c55a1361f7b02`, SHA-256
`f3644a14de0066f4fa33bd9b85177276be15b81712f9065bb745d989c986fb94`;
diagnostic artifacts never supply executable Python code.

Before the first Runner launch, `before_launch` records a full two-pass,
no-follow data-container snapshot. It does not guess the platform support
directory. After the selected application test and transport complete, the
parent calls `after_phase`. The application-reported support path is bound to
that original snapshot and the independently observed container identity.
Empty and absent authoring roots remain distinct. The original authoring
inventory and the subsequently saved financial baseline are separate objects.

For every later phase, the parent calls
`HostBindings.resume(first_spec, next_phase, ...)` before starting that phase's
transport. Resume requires a complete immutable ledger prefix, then freshly
queries stopped PID, app/data/support identities and the complete current
snapshot. A partial phase, later proof, changed file or source identity blocks
resume. An exclusive phase-start file prevents silently repeating an attempted
phase. The next callback restores every saved baseline generation, seeds only
the declared file when required, and writes the exact separate control. Import
fixtures exist only in the control; no financial result is injected.

`after_phase` compares whole application and driver receipt objects, removing
only driver screenshot metadata. It reads actual baseline, receipt, control
and export files plus every authoring generation. Complete saved primary
objects and full native command/response pairs are checked by the shared
semantic assertions. Unexpected `ios-future-` files, extra or changed exports,
reused export names and modified prior auxiliary bytes fail. A filename alone
never authorizes cleanup.

Only after all ten validated phases may `resume(first_spec, "restore-original",
...)` authorize guarded restoration. It restores original authoring roots and
removes only exact auxiliary bytes previously observed, validated and retained.
It does not delete the support directory, container, caches or Simulator. The
parent separately proves owned shutdown/deletion and preservation of every
pre-existing Simulator UUID. The result says `clipboard_restored: false`;
isolated Simulator deletion is not clipboard-restoration evidence.

## Ledger and preparation proof

Each exclusive `tax-ios-future-host-ledger-v1` record hashes its required raw
files, references the previous ledger digest, and binds the cumulative process
termination/absence log prefix. Candidate ledgers are replayed before commit.
Replay validates source, nonce, PID order, full pre/post disk inventories,
original projection, saved baseline, exact controls, actual exports, application
and driver receipts, PNG and native exchange semantics. It replays the pinned
log identity checks against raw stream/backfill events and discovery metadata,
including launch freshness, authenticated VM URI, OS event identity, executable
and getVM PID. A valid backfill-only discovery explicitly records the absence
of its lazily created stream-event file.

The `preparation_sha256` in each phase and launch record binds the separate
`prepare-start.json`, successful `prepare.json` and full prepared bundle.
Replay checks exact source files, device, target, normal Flutter argv, source
and nonce defines, host identity, 900-second budget, timestamps and complete
bundle equality. It also checks the actual build-command start/terminal and
raw output captures. Each driver command must likewise complete with exit 0,
no timeout or cleanup error, observed EOF, exact untruncated byte counts and
matching hashes. A completion marker by itself cannot satisfy this gate.
Direct `launch_started_at` must equal the discovery timestamp.

Preparation captures the pinned helper's `driver_sdk_identity`: Flutter
3.44.8, framework revision `058e0af2c2b57e369d905a03ac9748b0ebf543c6`,
Dart 3.12.2, the absolute cached SDK executable and its complete SHA-256.
The identity is frozen in both preparation records, freshly compared before
installation and again immediately before the actual direct driver command.
The command is exactly `[cached Dart, test_driver/tax_future_data_driver.dart]`.
The application remains independently launched, with the authenticated VM URI
and actual matching Runner PID checked before the driver receives them.

Each phase retains `-driver-start.json` and `-driver.json`, binding source,
nonce, phase, Runner PID, SDK, preparation digest, working directory, exact
argv and the selected environment. Ledger replay requires those records to
agree with the launch, prepared SDK and complete bounded `host_command`
captures, with a real integer exit 0. Missing, altered, failed or ambiguous
driver records cannot advance a phase. This replaces the old Flutter-drive
wrapper invocation; it changes neither the selected application test nor the
separate 900/300-second budgets. Synthetic controls use explicitly labelled
SDK fixtures and never execute those fixture paths.

The host uses `tax-ios-future-host-stage-v1`. Real verified stages report
`stage_proof: true` and always retain `runtime_acceptance: false`; the parent
final verifier alone combines all stages, native audits, cleanup and source
checks into final acceptance. Synthetic controls report `synthetic_only: true`,
`preparation_only: true` and `stage_proof: false`. Old preparation-ledger schemas
and synthetic ledgers cannot be replayed as real stage evidence.

Pure offline ledger replay after restoration is a separate review operation:
`replay_ledger(..., next_phase="restore-original", after_restoration=True)`.
This option requires all ten committed phases and a retained restoration file;
it rejects intermediate prefixes and candidate uncommitted ledgers. `resume`
never passes the option and still refuses already restored runs. The offline
option never grants mutation authority, and the final verifier must still
independently validate original restoration and owned lifecycle evidence.

## Validation and limits

The ignored prototype first used in-memory phase state. Root review correctly
identified that this could not survive independent per-phase process groups;
the evidence-ledger resume design corrected that before tracked integration.
Its final portable control run passed 20 groups with 2 explicit POSIX skips.
The pre-direct-Dart adapted integration's final run passed **25 groups with 2 explicit POSIX
skips**, 27 total, exit 0 in 81.626 seconds. This includes a fresh bindings
instance between every phase and before restoration, and offline replay after
restoration. Negative controls cover partial phases, changed source/nonce/PID,
current-disk changes, rehashed but inconsistent evidence, incorrect build
inputs, incomplete or failed build/driver captures, wrong preparation hash,
inconsistent launch timestamps and a fake backend mislabeled as real. Real
stages require the exact concrete POSIX access class.

That pre-alignment local log is retained at
`.artifacts/future-host-bindings-concrete-final.log`. Earlier adapted runs
passed 24 groups plus 2 skips, then 25 plus 2 before the concrete-access guard;
they remain separate from the final result. Owned Python AST checks passed.
Pre-alignment tested implementation SHA-256:
`6c3a3ff00a38df697db2142ae57f9dc309ef6429c360486578604ada623c111f`.
Pre-alignment tested test-file SHA-256:
`a7e4d8702a0e32b4ac8c1eafddc1fce4c83bb8058566469c83962d507d707026`.
Root independently reviewed this pre-alignment bindings version without a
remaining material finding. The new direct-Dart alignment is a separate
working-tree change, not an exact published-head CI result.

The direct-Dart alignment passed **55 transport tests**, **7 concrete-adapter
controls**, and **27 bindings tests plus 2 explicit POSIX skips** (29 total,
121.989 seconds). The bindings log is
`.artifacts/future-direct-dart-bindings.log`; the transport and adapter results
were retained in tool output. These checks include unchanged SDK before
installation, refusal of altered cached Dart paths/digests/versions, exact
authenticated URI and selected environment, failed/cancelled driver handling,
and ledger refusal for modified SDK, argv, environment, PID, preparation hash,
working directory, timestamps or terminal status. All owned Python AST and
whitespace checks passed. No runtime acceptance is inferred from these
synthetic fixtures or Windows checks.

Direct-Dart tested bindings SHA-256:
`387ba3e2121c3239d6037d1165cc6d7de46382fdcb2f196ddd70891db9371dfe`.
Direct-Dart tested bindings-test SHA-256:
`2bf2cd60a37552698e249803ac7b97738f040cd75928c5d7d51f612e31ea1f78`.
This alignment awaits independent review and actual macOS execution.

Controls use complete synthetic receipts and raw file inventories, not an
emulator or substitute runtime acceptance claim. POSIX tests exercise real
descriptor-relative reads/writes on supported hosts and explicitly skip on
Windows. macOS execution of those tests is required before application
acceptance. The actual ten-phase application journey, archive export audits,
final source-bound CI artifact and owned Simulator deletion remain necessary.
Constructed future-version fixtures do not establish interrupted writes,
physical-device behavior, mobile keyboard or spoken accessibility acceptance.

One local test-wrapper attempt selected a log path above the worktree and failed
before Python launched. The corrected command uses the explicit worktree
artifact path; no passing test result is attributed to that attempt.
