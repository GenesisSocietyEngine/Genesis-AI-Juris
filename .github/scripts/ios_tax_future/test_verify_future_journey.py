"""Portable contract/rejection controls. No Simulator or accepted runtime fixture."""
import copy
import dataclasses
import json
from pathlib import Path, PurePosixPath
import tempfile
import unittest
import subprocess
import sys
from unittest.mock import patch
from types import SimpleNamespace

import verify_future_journey as v
import test_owned_simulator_lifecycle as lf

SOURCE, NONCE, DEVICE = lf.SOURCE, lf.NONCE, lf.NEW


def identity():
    return {"schema": "tax-ios-future-source-v1", "source_sha": SOURCE, "source_tree": "b" * 40,
            "run_nonce": NONCE, "simulator": DEVICE, "app_root": "/checkout/apps/juris-mobile",
            "host_evidence_root": "/evidence/run", "python_executable": "/python/bin/python3",
            "simulator_root": "/Users/runner/Library/Developer/CoreSimulator/Devices", "run_id": 123,
            "run_attempt": 1, "github_job": "future_application", "platform": "darwin",
            "started_at": "2026-10-01T00:00:00+00:00", "exercise_started_at": "2026-09-30T23:59:50+00:00",
            "synthetic_only": False}


def write(root, name, value):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(value if type(value) is bytes else v.p.encode(value))


def lifecycle():
    events = []
    fake = lf.Fake()
    owner = v.life.OwnedSimulator(SOURCE, NONCE, execute=fake, retain=events.append, guard=lambda: True)
    owner.create(lf.RUNTIME, lf.TYPE)
    owner.boot()
    return owner.complete(), events


def outer(root, phase="baseline-write"):
    item = identity()
    seconds = 900 if phase == "prepare" else 300
    inner = [item["python_executable"], "-I", "/checkout/.github/scripts/ios_tax_future/phase_cli.py", phase,
             DEVICE, item["host_evidence_root"], SOURCE, NONCE]
    start = {"schema": "tax-ios-future-outer-v1", "source_sha": SOURCE, "run_nonce": NONCE, "simulator": DEVICE,
             "phase": phase, "timeout_seconds": seconds, "argv": [item["python_executable"], "-I",
             "/checkout/.github/scripts/ios_tax_future/phase_deadline.py", "--timeout-seconds", str(seconds),
             "--label", "tax-future-" + phase, "--", *inner], "started_at": item["started_at"], "status": "started"}
    events = [{"event": "started", "label": "tax-future-" + phase, "pid": 1234, "seconds": float(seconds), "argv": inner},
              {"event": "terminal", "label": "tax-future-" + phase, "pid": 1234, "exit": 0, "timed_out": False,
               "cancelled": False, "cleanup": "absent", "error": None, "runtime_acceptance": False}]
    log = b"captured application output\n" + b"".join(b"future_deadline " + v.p.encode(e) + b"\n" for e in events)
    filename = "outer-" + phase + "-phase.log"
    terminal = {**start, "status": "completed", "completed_at": "2026-10-01T00:00:02+00:00", "exit_code": 0,
                "log": {"filename": filename, "bytes": len(log), "sha256": v.sha(log)}, "error": None, "cleanup_errors": []}
    write(root, filename, log)
    write(root, "outer-" + phase + "-start.json", start)
    write(root, "outer-" + phase + "-terminal.json", terminal)
    return start, terminal, events


def replace_log(root, phase, end, events):
    filename = "outer-" + phase + "-phase.log"
    log = b"".join(b"future_deadline " + v.p.encode(e) + b"\n" for e in events)
    write(root, filename, log)
    end["log"] = {"filename": filename, "bytes": len(log), "sha256": v.sha(log)}
    write(root, "outer-" + phase + "-terminal.json", end)


def audit(arches=("arm64", "x86_64")):
    argv = ["bash", "/checkout/.github/scripts/verify_ios_ffi_exports.sh",
            "/checkout/apps/juris-mobile/ios/Generated/libjuris_mobile_ffi.a", "/rust/lib/rustlib/aarch64-apple-darwin/bin/llvm-nm", "/Xcode/bin/lipo"]
    lines = ["archive path: " + argv[2], "architecture inspector path: " + argv[4],
             "raw architecture list: " + " ".join(arches), f"archive architectures ({len(arches)}): " + " ".join(sorted(arches))]
    for arch in sorted(arches):
        lines += [f"architecture {arch} export audit: START", *v.EXPORTS, f"architecture {arch} exact export set: PASS"]
    lines += [f"all {len(arches)} architecture slices exact export set: PASS"]
    return argv, ("\n".join(lines) + "\n").encode()


def command(root, label, argv, out=b"", err=b""):
    start = {"argv": argv, "cwd": identity()["app_root"], "seconds": 60, "max_bytes": 16 * 1024 * 1024,
             "started_at": identity()["started_at"], "runtime_acceptance": False}
    terminal = {**start, "pid": 88, "exit": 0, "timed_out": False, "output_exceeded": False, "error": None,
                "cleanup_errors": [], "descendant_cleanup": "required_by_outer_phase_deadline",
                "completed_at": "2026-10-01T00:00:01+00:00", "output": {}}
    for name, data in (("stdout.log", out), ("stderr.log", err)):
        write(root, label + "-" + name, data)
        terminal["output"][name] = {"observed_bytes": len(data), "retained_bytes": len(data), "eof": True,
              "bytes": len(data), "sha256": v.sha(data), "truncated": False, "capture_complete": True}
    write(root, label + "-start.json", start)
    write(root, label + "-terminal.json", terminal)


class FinalVerifierControls(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).absolute()

    def rejected(self, callback, *args):
        with self.assertRaises((ValueError, RuntimeError, AssertionError, KeyError, TypeError)):
            callback(*args)

    def test_source_exact_host_paths_run_attempt_and_scope(self):
        self.assertEqual(v.validate_source(identity(), SOURCE, NONCE, DEVICE), PurePosixPath("/checkout"))
        for key, value in (("source_sha", "c" * 40), ("synthetic_only", True), ("run_attempt", True),
                           ("run_attempt", 2), ("platform", "win32"), ("app_root", "/checkout/../apps/juris-mobile"),
                           ("host_evidence_root", "/evidence//run"), ("python_executable", "python"),
                           ("simulator_root", "/other/Devices"), ("started_at", "2026-10-01T00:00:00"),
                           ("exercise_started_at", "2026-10-01T00:00:01Z")):
            with self.subTest(key=key, value=value):
                changed = identity(); changed[key] = value
                self.rejected(v.validate_source, changed, SOURCE, NONCE, DEVICE)

    def test_duplicate_json_and_changed_evidence_never_adopted(self):
        write(self.root, "duplicate.json", b'{"source":1,"source":2}')
        self.rejected(v.Evidence(self.root).object, "duplicate.json")
        write(self.root, "value", b"initial")
        reader = v.Evidence(self.root)
        self.assertEqual(reader.read("value"), b"initial")
        write(self.root, "value", b"changed")
        self.rejected(reader.stable_manifest)
        self.rejected(reader.read, "../escape")
        self.rejected(reader.read, "value", 2)

    def test_trusted_code_must_match_git_source_tree(self):
        with patch.object(v.subprocess, "run") as run:
            run.return_value.stdout = b"c" * 40 + b"\n"
            self.rejected(v.checked_source, identity())
            self.assertEqual(run.call_args.kwargs["timeout"], 10)
        write(self.root, "failure.json", {})
        self.rejected(v.verify, self.root, SOURCE, NONCE, DEVICE)

    def test_prepared_dart_pin_must_equal_exact_git_bytes(self):
        directory = self.root / ".github/scripts/ios_tax_future"
        directory.mkdir(parents=True)
        files = {".github/scripts/ios_tax_future/verify_future_journey.py": b"trusted verifier\n",
                 ".github/scripts/run_with_deadline.py": b"trusted deadline\n",
                 ".github/scripts/verify_ios_ffi_exports.sh": b"trusted export\n",
                 ".github/scripts/collect_ios_tax_diagnostics.py": b"trusted diagnostics\n",
                 "apps/juris-mobile/integration_test/future_application_test.dart": b"trusted Dart target\n"}
        for name, data in files.items():
            write(self.root, name, data)
        target = "apps/juris-mobile/integration_test/future_application_test.dart"
        def git(argv, **_options):
            return SimpleNamespace(stdout=(b"b" * 40 + b"\n") if argv[3] == "rev-parse" else files[argv[-1].split(":", 1)[1]])
        with patch.object(v, "HERE", directory), patch.object(v.subprocess, "run", side_effect=git), \
             patch.object(v.t, "PREPARED_HASHES", {target: v.sha(files[target])}):
            self.assertEqual(v.checked_source(identity())[target], v.sha(files[target]))
            with patch.dict(v.t.PREPARED_HASHES, {target: "0" * 64}):
                with self.assertRaisesRegex(ValueError, "Prepared source pin differs"):
                    v.checked_source(identity())
            write(self.root, target, b"changed uncommitted target\n")
            with self.assertRaisesRegex(ValueError, "Trusted verifier source differs"):
                v.checked_source(identity())

    def test_cli_failure_is_read_only_no_json_no_artifact_execution(self):
        write(self.root, "failure.json", {})
        write(self.root, "future_host_bindings.py", b"raise RuntimeError('artifact code must never execute')\n")
        before = {path.name: path.read_bytes() for path in self.root.iterdir()}
        for flags in (("-I",), ("-I", "-O")):
            result = subprocess.run([sys.executable, *flags, str(Path(v.__file__)), str(self.root), SOURCE, NONCE, DEVICE],
                                    capture_output=True, timeout=10)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, b"")
            self.assertNotIn(b"artifact code must never execute", result.stderr)
            self.assertIn(b"Optimized Python" if "-O" in flags else b"Failed run", result.stderr)
            self.assertEqual({path.name: path.read_bytes() for path in self.root.iterdir()}, before)

    def test_all_twelve_outer_budgets_and_same_interpreter(self):
        for phase in v.STAGES:
            outer(self.root, phase)
            v.validate_outer(v.Evidence(self.root), identity(), phase)
        start, end, _ = outer(self.root)
        end["argv"][0] = "/other/python"
        write(self.root, "outer-baseline-write-terminal.json", end)
        self.rejected(v.validate_outer, v.Evidence(self.root), identity(), "baseline-write")

    def test_outer_failure_missing_log_hash_and_uncertain_cleanup(self):
        for field, value in (("exit_code", 124), ("exit_code", False), ("error", "timed out"),
                             ("cleanup_errors", ["unknown group"]), ("completed_at", "2026-10-01T00:06:00+00:00")):
            with self.subTest(field=field):
                _, end, _ = outer(self.root); end[field] = value
                write(self.root, "outer-baseline-write-terminal.json", end)
                self.rejected(v.validate_outer, v.Evidence(self.root), identity(), "baseline-write")
        outer(self.root)
        write(self.root, "outer-baseline-write-phase.log", b"All tests passed.\n")
        self.rejected(v.validate_outer, v.Evidence(self.root), identity(), "baseline-write")

    def test_deadline_marker_cannot_replace_real_completed_group(self):
        mutations = (("cleanup", "present"), ("cleanup", "unknown"), ("exit", 124), ("timed_out", True),
                     ("cancelled", True), ("pid", 1235), ("error", "pipe read failed"), ("runtime_acceptance", True))
        for key, value in mutations:
            with self.subTest(key=key, value=value):
                _, end, events = outer(self.root)
                events[1][key] = value
                replace_log(self.root, "baseline-write", end, events)
                self.rejected(v.validate_outer, v.Evidence(self.root), identity(), "baseline-write")
        for select in (lambda e: e[:1], lambda e: e[::-1], lambda e: e + [e[1]]):
            _, end, events = outer(self.root)
            replace_log(self.root, "baseline-write", end, select(events))
            self.rejected(v.validate_outer, v.Evidence(self.root), identity(), "baseline-write")

    def test_complete_fake_lifecycle_contract_only(self):
        result, events = lifecycle()
        before, after = v.validate_lifecycle(result, events, identity())
        self.assertLessEqual(before, after)
        self.assertFalse(result["application_acceptance"])

    def test_shortened_lifecycle_budget_is_recorded_and_enforced(self):
        result, events = lifecycle()
        shortened = copy.deepcopy(events)
        shortened[0]["timeout_seconds"] = 1.25
        v.validate_lifecycle(result, shortened, identity())
        for value in (0, -1, True, 30.01, float("inf"), float("nan")):
            with self.subTest(value=value):
                changed = copy.deepcopy(events)
                changed[0]["timeout_seconds"] = value
                self.rejected(v.validate_lifecycle, result, changed, identity())
        changed = copy.deepcopy(events)
        changed[0]["timeout_seconds"] = 0.000000001
        # Keep an explicitly positive elapsed duration and consistent summary.
        changed[1]["utc"] = (v.utc(changed[0]["utc"]) + v.dt.timedelta(microseconds=1)).isoformat()
        result = copy.deepcopy(result)
        result["simulator_lifecycle"]["before_create"]["utc"] = changed[1]["utc"]
        changed[-1]["result"] = result
        self.rejected(v.validate_lifecycle, result, changed, identity())

    def test_total_budget_includes_creation_boot_restoration_and_deletion(self):
        item = identity()
        zero = v.utc(item["started_at"])
        intervals = [(zero + v.dt.timedelta(seconds=1 + 2 * i), zero + v.dt.timedelta(seconds=2 + 2 * i))
                     for i in range(12)]
        events = [{"utc": "2026-09-30T23:59:51Z"}, {"utc": "2026-10-01T00:00:26Z"}, {"event": "lifecycle-complete"}]
        booted, shutdown = v.utc("2026-09-30T23:59:59Z"), zero + v.dt.timedelta(seconds=25)
        v.validate_timeline(item, intervals, events, booted, shutdown)
        late = copy.deepcopy(events); late[-2]["utc"] = "2026-10-01T00:29:50Z"
        self.rejected(v.validate_timeline, item, intervals, late, booted, shutdown)
        self.rejected(v.validate_timeline, item, intervals, events, booted, zero + v.dt.timedelta(seconds=23))
        early = copy.deepcopy(events); early[0]["utc"] = "2026-09-30T23:59:49Z"
        self.rejected(v.validate_timeline, item, intervals, early, booted, shutdown)

    def test_lifecycle_terminal_failure_flags_raw_mutation_and_origin(self):
        result, events = lifecycle()
        for key, value in (("exit", False), ("timed_out", True), ("error", "truncated"), ("executor_invoked", False),
                           ("output_capture_incomplete", True), ("source_sha", "c" * 40), ("sequence", 99)):
            with self.subTest(key=key):
                changed = copy.deepcopy(events); changed[1][key] = value
                self.rejected(v.validate_lifecycle, result, changed, identity())
        changed = copy.deepcopy(events); changed[1]["stdout"]["base64"] = "e30="
        self.rejected(v.validate_lifecycle, result, changed, identity())
        changed = copy.deepcopy(result); changed["simulator_lifecycle"]["boot"]["utc"] = "2026-10-01T02:00:00Z"
        self.rejected(v.validate_lifecycle, changed, events, identity())

    def test_lifecycle_cannot_hide_unrelated_deletion_or_reuse(self):
        result, events = lifecycle()
        changed = copy.deepcopy(events)
        event = next(e for e in changed if e.get("role") == "pre_delete" and e["event"] == "command-terminal")
        item = v.life.unique_json(v.raw(event["stdout"]))
        item["devices"][lf.RUNTIME] = [d for d in item["devices"][lf.RUNTIME] if d["udid"] != lf.OLD]
        event["stdout"] = v.life.raw(v.p.encode(item))
        self.rejected(v.validate_lifecycle, result, changed, identity())
        changed = copy.deepcopy(events); changed[12]["before_ids"].append(DEVICE.lower())
        self.rejected(v.validate_lifecycle, result, changed, identity())
        self.rejected(v.validate_lifecycle, result, events + [events[-1]], identity())

    def test_lifecycle_boot_readiness_required_and_failure_cleanup_not_success(self):
        result, events = lifecycle()
        changed = copy.deepcopy(events)
        item = next(e for e in changed if e.get("role") == "after_boot" and e["event"] == "command-terminal")
        data = v.life.unique_json(v.raw(item["stdout"]))
        next(d for d in data["devices"][lf.RUNTIME] if d["udid"] == DEVICE)["state"] = "Booting"
        item["stdout"] = v.life.raw(v.p.encode(data))
        self.rejected(v.validate_lifecycle, result, changed, identity())
        changed = copy.deepcopy(result); changed["cleanup_mode"] = "failure_cleanup"
        self.rejected(v.validate_lifecycle, changed, events, identity())

    def test_restoration_preserves_exact_raw_and_all_control_removal(self):
        original = {"guided_studio_v1": {"directory": True},
                    "guided_studio_v1/workspace.json": v.life.raw(b'\xef\xbb\xbf{ "future": 18446744073709551617 }')}
        outside = {name: v.life.raw(("retained:" + name).encode()) for name in v.b.CONTROLS}
        outside["tax-workspace-1-2.json"] = v.life.raw(b"full original export")
        state = {"original": {"entries": original}, "last_snapshot": {"entries": {**original, **outside}}}
        restored = {"schema": v.b.SCHEMA, "source_sha": SOURCE, "run_nonce": NONCE, "original": original,
                    "final": original, "removed_auxiliary": outside, "clipboard_restored": False,
                    "simulator_cleanup_pending": True, "synthetic_only": False, "preparation_only": False,
                    "stage_proof": True, "runtime_acceptance": False}
        v.validate_restoration(restored, state, identity())
        for field, value in (("final", {}), ("removed_auxiliary", {}), ("clipboard_restored", True),
                             ("synthetic_only", True), ("runtime_acceptance", True)):
            changed = copy.deepcopy(restored); changed[field] = value
            self.rejected(v.validate_restoration, changed, state, identity())
        changed = copy.deepcopy(restored)
        changed["final"]["guided_studio_v1/workspace.json"] = v.life.raw(b'{"future":18446744073709552000.0}')
        self.rejected(v.validate_restoration, changed, state, identity())

    def test_complete_thin_and_universal_audit_output(self):
        for arches in (("arm64",), ("x86_64", "arm64")):
            argv, text = audit(arches)
            self.assertEqual(v.audit_output(text, argv), sorted(arches))

    def test_audit_missing_slice_fourth_symbol_tax_export_and_diagnostic_refuse(self):
        argv, text = audit()
        for changed in (text.replace(b"architecture arm64 exact export set: PASS\n", b""),
                        text.replace(b"juris_mobile_bridge_execute\n", b"juris_mobile_bridge_execute\njuris_mobile_bridge_fourth\n"),
                        text + b"juris_tax_calculate\n", text + b"llvm-nm: warning\n", text.replace(b" (2):", b" (1):"),
                        text.replace(b"raw architecture list: arm64 x86_64", b"raw architecture list: arm64 arm64")):
            self.rejected(v.audit_output, changed, argv)

    def export_files(self):
        argv, output = audit()
        runner = {"bytes": 17, "sha256": "a" * 64}
        write(self.root, "prepared-bundle.json", json.dumps([{"path": "Runner", **runner}]).encode())
        binaries = {"ios/Generated/libjuris_mobile_ffi.a": {"bytes": 100, "sha256": "b" * 64},
                    "build/ios/iphonesimulator/Runner.app/Runner": runner}
        for phase in v.t.PHASES:
            command(self.root, phase + "-export-command", argv, output)
            write(self.root, phase + "-exports.log", output)
            write(self.root, phase + "-binaries.json", binaries)
        return argv, output, binaries

    def test_ten_audits_require_actual_command_and_same_binary_full_bundle(self):
        _, _, binaries = self.export_files()
        self.assertEqual(len(v.validate_exports(v.Evidence(self.root), identity())), 10)
        changed = copy.deepcopy(binaries)
        changed["build/ios/iphonesimulator/Runner.app/Runner"]["sha256"] = "c" * 64
        write(self.root, v.t.PHASES[-1] + "-binaries.json", changed)
        self.rejected(v.validate_exports, v.Evidence(self.root), identity())
        write(self.root, v.t.PHASES[-1] + "-binaries.json", binaries)
        changed = copy.deepcopy(binaries)
        changed["ios/Generated/libjuris_mobile_ffi.a"]["sha256"] = "d" * 64
        write(self.root, v.t.PHASES[-1] + "-binaries.json", changed)
        self.rejected(v.validate_exports, v.Evidence(self.root), identity())

    def test_audit_nonzero_truncated_stderr_or_unexpected_tool_refuses(self):
        argv, out, _ = self.export_files()
        phase = v.t.PHASES[0]
        label = phase + "-export-command"
        for field, value in (("exit", 1), ("timed_out", True), ("cleanup_errors", ["not reaped"]), ("error", "failure")):
            command(self.root, label, argv, out)
            terminal = v.p.decode((self.root / (label + "-terminal.json")).read_bytes())
            terminal[field] = value
            write(self.root, label + "-terminal.json", terminal)
            self.rejected(v.validate_exports, v.Evidence(self.root), identity())
        command(self.root, label, argv, out, b"unexpected diagnostic")
        self.rejected(v.validate_exports, v.Evidence(self.root), identity())
        command(self.root, label, argv[:-1] + ["relative/lipo"], out)
        self.rejected(v.validate_exports, v.Evidence(self.root), identity())

    def test_real_replay_refuses_synthetic_ledger_even_with_restoration_marker(self):
        spec = v.t.PhaseSpec(v.t.PHASES[0], DEVICE, SOURCE, NONCE, self.root,
                             PurePosixPath(identity()["app_root"]), PurePosixPath(identity()["simulator_root"]))
        write(self.root, "process.log", b"")
        write(self.root, "original-restoration.json", {})
        write(self.root, v.t.PHASES[0] + "-ledger.json", {"schema": v.b.LEDGER_SCHEMA, "phase": v.t.PHASES[0],
              "phase_index": 0, "source_sha": SOURCE, "run_nonce": NONCE, "simulator": DEVICE,
              "previous_ledger_sha256": None, "synthetic_only": True, "preparation_only": True,
              "stage_proof": False, "runtime_acceptance": False, "files": {}, "process_log_prefix": v.life.raw(b"")})
        with self.assertRaisesRegex(RuntimeError, "Ledger source/order/scope"):
            v.b.replay_ledger(spec, "restore-original", v.Evidence(self.root), False, after_restoration=True)


if __name__ == "__main__":
    unittest.main()
