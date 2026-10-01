# Six-phase harness and aggregate storage reconciliation

The isolated ordinary merge combines reviewed PR #72 source
`3ea9e65fb8ecf0007c47dc1cec7d10aeddf0bf7f` with accepted main
`0590eaf364c9cdb28abc73c2b8d2de208936ff49` (PR #75). Git's actual merge
reported one conflict, in `integration_test/native_tax_application_test.dart`.
The active PR #72 push run remains unchanged while this resolution is reviewed.

After PR #76 merged, the held reconciliation also incorporated accepted main
`3749593df4e249cd9e4ea0e69caf22d47cef43cb` by an ordinary conflict-free merge.
That advance has no mobile source, iOS application host-script or workflow delta
from `0590eaf`; the reviewed six-phase resolution remains identical. Its web
preservation foundation keeps its separate accepted PR #76 evidence.

The six-phase harness now obtains workspace and tax stores from main's
`StudioAuthoringServices.applicationSupport` bundle. Its observation wrapper
implements and forwards the conditional snapshot/write contract, returning
the original write futures and tracking them for settled-write assertions.
The production widget receives that same matched bundle. Existing workspace,
tax-store and native-bridge construction checkpoints remain; a new enclosing
authoring-services construction checkpoint records bundle setup.

All six phases, source/nonce-bound progression, distinct PID chain, retained
pair receipts, blank fresh-write guards, complete saved/native comparisons,
incomplete native/local errors, whole legacy-record preservation, repeated-save
revision checks, screenshots and application deadlines are unchanged. Host,
driver, export verifier and receipt verifier remain identical to PR #72's
reviewed source. No production storage or editor change was added beyond the
ordinary import of accepted main.

Local focused checks: 22 driver-guard, matched-authoring-service and workspace
session cases pass; harness/driver analysis reports no issues; project-configured
formatting reports zero changes; lock SHA-256 remains
`509ebe15d61d6579262fa4e31b839f801a447d457d80210be0a4ec259f0c6d42`.
An initial formatter invocation before package setup used a different style and
failed its telemetry write; unrelated formatting was removed, then the locked
project formatter check passed. An initial analysis command named a nonexistent
guard path; the corrected actual harness/driver paths passed. Neither initial
command is represented as a successful check.

This is a source reconciliation and local regression result. macOS application
execution, all six phases and the new merged head's applicable CI gates remain
pending; no main or product-release success is inferred from predecessor runs.
