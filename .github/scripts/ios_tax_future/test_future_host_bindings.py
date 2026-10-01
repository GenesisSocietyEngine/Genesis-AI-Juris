"""Synthetic ordered controls; no Simulator, Flutter, process or VM invocation."""
import copy
import dataclasses
import json
import os
import pathlib
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import future_host_bindings as m
import test_future_phase_plan as fixture

UUID = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE"
DATA = f"/owned/Devices/{UUID}/data/Containers/Data/Application/exact"
APP = f"/owned/Devices/{UUID}/data/Containers/Bundle/Application/exact/Runner.app"
SUPPORT = DATA + "/Library/Application Support"
CONTAINERS = {"app": {"path": APP, "device": 1, "inode": 3},
              "data": {"path": DATA, "device": 1, "inode": 2}}
BUNDLE = b'[{"path":"Runner","bytes":4,"sha256":"' + b'a' * 64 + b'"}]\n'
SDK = {"flutter_root": "/synthetic/flutter", "dart": "/synthetic/flutter/bin/cache/dart-sdk/bin/dart",
       "dart_sha256": "d" * 64, "flutter_version": "3.44.8",
       "framework_revision": "058e0af2c2b57e369d905a03ac9748b0ebf543c6", "dart_version": "3.12.2"}


class FakeController:
    def __init__(self, access, binding, probe, guard, retain, controls):
        self.access, self.binding, self.probe = access, binding, probe
        self.guard, self.retain, self.controls = guard, retain, tuple(controls)

    def apply(self, expected, target, *, operation, declared_path=None):
        self.probe()
        self.assert_current(expected)
        actions = m.mut.plan(expected["entries"], target, self.controls)
        if operation == "seed":
            assert actions == [("write", declared_path)]
        if operation == "controls":
            assert all(action in ("write", "unlink") and name in self.controls for action, name in actions)
        assert operation in ("seed", "restore", "controls")
        self.retain({"event": "fake_apply", "operation": operation, "plan": actions})
        assert self.guard() is True
        self.access.events.append((operation, declared_path, copy.deepcopy(actions)))
        self.access.entries = copy.deepcopy(target)
        return self.access.snapshot(self.binding, self.controls)

    def assert_current(self, expected):
        assert expected == self.access.snapshot(self.binding, self.controls)


class FakeAccess:
    synthetic_only = True
    def __init__(self):
        self.entries = {}
        self.events = []
        self.changed = None
        self.original = {"Library": {"directory": True}, "Library/Application Support": {"directory": True},
                         **{"Library/Application Support/" + k: v for k, v in fixture.INITIAL.items()}}

    def identity(self, path):
        path = str(path)
        if path == APP:
            return {"device": 1, "inode": 3}
        if path == DATA:
            return {"device": 1, "inode": 2 + (1 if self.changed == "data" else 0)}
        if path == SUPPORT:
            return {"device": 1, "inode": 4 + (1 if self.changed == "support" else 0)}
        raise RuntimeError("Fake identity outside owned fixture")

    def collect(self, binding, probe, guard, retain):
        probe()
        assert guard() is True
        identities = {name: [1, 10 + i, stat.S_IFDIR if "directory" in value else stat.S_IFREG,
                      2 if "directory" in value else 1, value.get("bytes", 0), 123, 123]
                      for i, (name, value) in enumerate(self.original.items())}
        data = m.p.encode({"schema": m.initial.SCHEMA, "binding": binding, "entries": self.original,
            "identities": identities, "container_identity": [1, 2, stat.S_IFDIR, 2, 0, 123, 123],
            "read_only": True, "preparation_only": True, "runtime_acceptance": False,
            "observed_stable_two_passes": True, "complete": True})
        assert retain(data) is True
        probe()
        return data

    def snapshot(self, binding, controls=None):
        if controls is None:
            controls = (*m.CONTROLS, *sorted(k for k in self.entries if m.auxiliary(k) and k not in m.CONTROLS))
        entries = m.mut.validate_entries(self.entries, controls)
        return {"binding": copy.deepcopy(binding), "controls": list(controls), "entries": entries,
                "identities": {name: ([1, 100 + i, stat.S_IFDIR] if "directory" in value else
                                      [1, 100 + i, stat.S_IFREG, 1, value["bytes"], 123, 123])
                               for i, (name, value) in enumerate(sorted(entries.items()))}}

    def capture(self, binding, probe, guard, retain):
        assert guard() is True
        probe()
        return self.snapshot(binding)

    def controller(self, *args):
        return FakeController(self, *args)


class Harness:
    def __init__(self, root):
        baseline, target = fixture.fixtures()
        baseline["support_path"] = SUPPORT
        with patch.object(fixture, "fixtures", return_value=(baseline, target)):
            self.baseline, self.proofs, _, self.tax_path = fixture.sequence(10)
        # The two actual export operations must produce distinct names. Reusing
        # a filename would not prove unchanged prior export bytes.
        for index in (3, 5):
            value = m.p.decode(self.proofs[index].receipt_json)
            value["export"]["path"] = f"tax-workspace-{index}-1.json"
            self.proofs[index] = dataclasses.replace(self.proofs[index], receipt_json=m.p.encode(value))
        self.access = FakeAccess()
        self.allowed = True
        self.failure = None
        self.commands = []
        self.bundle = m.sha(BUNDLE)
        self.spec = m.t.PhaseSpec("baseline-write", UUID, fixture.SOURCE, fixture.NONCE,
            pathlib.Path(root).absolute(), pathlib.Path(root).absolute(), pathlib.PurePosixPath("/owned/Devices"))
        self.host = m.HostBindings(self.spec, guard=lambda: self.allowed, access=self.access,
                                   runner=self.run, synthetic=True)

    def run(self, argv):
        self.commands.append(argv)
        if argv[0] == "ps":
            value = b" 9 /unrelated/app\n"
            if self.failure == "running":
                value += f" 100 {APP}/Runner\n".encode()
            if self.failure == "old-pid":
                value += b" 100 /another/executable\n"
            if self.failure == "malformed-ps":
                value += b"unparseable\n"
        else:
            assert argv[:5] == ["xcrun", "simctl", "get_app_container", UUID, m.APP]
            value = ((APP if argv[-1] == "app" else DATA) + "\n").encode()
            if self.failure == "relocated":
                value = value.replace(b"exact", b"other")
        return subprocess.CompletedProcess(argv, 7 if self.failure == "exit" else 0, value, b"")

    def start(self, index):
        spec = dataclasses.replace(self.spec, phase=m.t.PHASES[index])
        prior = tuple(100 + i for i in range(index))
        hook = self.host.before_launch(spec, copy.deepcopy(CONTAINERS), self.bundle, prior)
        self.host.evidence.write(spec.phase + "-prelaunch-hook.json", m.p.encode(hook))
        return spec

    def app(self, spec):
        index = spec.index
        receipt = m.p.decode(self.proofs[index].receipt_json)
        previous_aux = {k: v for k, v in self.access.entries.items() if k.split("/")[0] not in m.mut.ROOTS}
        app_bytes = self.baseline if index == 0 else m.p.encode({k: v for k, v in receipt.items() if k != "screenshot"})
        self.access.entries = {**copy.deepcopy(receipt["after"]), **previous_aux,
                               m.RECEIPTS[index]: m.mut.raw(app_bytes)}
        if index == 0:
            self.access.entries[m.BASELINE] = m.mut.raw(self.baseline)
        if "export" in receipt:
            self.access.entries[receipt["export"]["path"]] = {k: v for k, v in receipt["export"].items() if k != "path"}
        self.host.evidence.write(spec.phase + ".json", self.proofs[index].receipt_json)
        self.host.evidence.write(spec.phase + "-future.png", self.proofs[index].screenshot_png)
        transport = {"schema": m.t.TRANSPORT_SCHEMA, "phase": spec.phase, "phase_index": index,
            "source_sha": spec.source, "run_nonce": spec.nonce, "simulator": UUID, "containers": CONTAINERS,
            "bundle_manifest_sha256": self.bundle, "receipt_sha256": m.sha(self.proofs[index].receipt_json),
            "prelaunch_hook_sha256": m.sha(self.host.evidence.read(spec.phase + "-prelaunch-hook.json")),
            "selected_test": m.t.SELECTED_TEST, "pid": 100 + index, "vm_pid": 100 + index,
            "previous_pid": 99 + index if index else None, "process_absent": True,
            "transport_complete": True, "runtime_acceptance": False, "executable": APP + "/Runner",
            "driver_sdk": copy.deepcopy(SDK)}
        self.transport_files(spec, transport)
        self.host.evidence.write(spec.phase + "-transport.json", m.p.encode(transport))
        return transport

    def transport_files(self, spec, transport):
        """Faithful synthetic retained transport shape, never runtime evidence."""
        phase, index, pid = spec.phase, spec.index, transport["pid"]
        out = self.host.evidence
        write = lambda suffix, value: out.write(phase + suffix, m.p.encode(value))
        out.write(phase + "-input-bundle.json", BUNDLE)
        out.write(phase + "-installed-bundle.json", BUNDLE)
        if index == 0:
            preparation = {"schema": m.t.BUILD_SCHEMA, "source_sha": spec.source, "run_nonce": spec.nonce,
                "simulator": UUID, "target": m.t.TARGET, "argv": m.t.build_command(spec), "source_files": m.t.PREPARED_HASHES,
                "driver_sdk": copy.deepcopy(SDK),
                "host_pid": 88, "started_at": "2025-01-01T00:00:00+00:00", "timeout_seconds": 900,
                "status": "started", "build_completed": False, "runtime_acceptance": False}
            out.write("prepare-start.json", m.p.encode(preparation))
            out.write("prepare.json", m.p.encode({**preparation, "status": "completed", "build_completed": True,
                "exit_code": 0, "completed_at": "2025-01-01T00:00:01+00:00", "elapsed_seconds": 1,
                "bundle_manifest_sha256": self.bundle}))
            out.write("prepared-bundle.json", BUNDLE)
            self.command_capture("prepare-command", m.t.build_command(spec), 900, 64 * 1024 * 1024,
                                 b"Synthetic successful build output\n", b"")
            out.write("baseline-write-containers.json", m.p.encode(CONTAINERS))
            start = {"schema": "tax-ios-install-command-v1", "runtime_acceptance": False,
                "source_sha": spec.source, "run_nonce": spec.nonce, "simulator": UUID, "phase": phase,
                "argv": ["xcrun", "simctl", "install", UUID, str(spec.app_root / "build/ios/iphonesimulator/Runner.app")],
                "bundle_manifest_sha256": self.bundle, "started_at": "2025-01-01T00:00:00+00:00", "host_pid": 77,
                "timeout_seconds": 120, "status": "started", "installation_completed": False}
            out.write("baseline-write-install-start.json", m.p.encode(start))
            out.write("baseline-write-install.json", m.p.encode({**start, "status": "completed", "exit_code": 0,
                "installation_completed": True, "output_truncated": False, "stdout_sha256": m.sha(b""), "stderr_sha256": m.sha(b"")}))
            out.write("baseline-write-install.stdout.log", b"")
            out.write("baseline-write-install.stderr.log", b"")
        else:
            write("-installation-reuse.json", {"installed_again": False,
                "first_install_sha256": m.sha(out.read("baseline-write-install.json")),
                "source_sha": spec.source, "run_nonce": spec.nonce, "phase": phase})
        for kind in ("app", "data"):
            write("-" + kind + "-container-command.json", {
                "argv": ["xcrun", "simctl", "get_app_container", UUID, m.APP, kind], "exit": 0,
                "stdout": CONTAINERS[kind]["path"] + "\n", "stderr": "", "source_sha": spec.source, "run_nonce": spec.nonce})
        executable = APP + "/Runner"
        uri = f"http://127.0.0.1:12345/fake-{index}=/"
        preparation_sha = m.sha(out.read("prepare.json"))
        transport["preparation_sha256"] = preparation_sha
        write("-launch.json", {"schema": "tax-ios-future-launch-v1", "phase": phase,
            "source_sha": spec.source, "run_nonce": spec.nonce, "simulator": UUID, "pid": pid,
            "driver_sdk": copy.deepcopy(SDK),
            "executable": executable, "vm_uri": uri, "vm_pid": pid, "bundle_manifest_sha256": self.bundle,
            "launch_started_at": "2025-01-01T00:00:00+00:00", "preparation_sha256": preparation_sha, "acceptance": False})
        out.write(phase + "-launch.stdout.log", f"{m.APP}: {pid}\n".encode())
        out.write(phase + "-launch.stderr.log", b"")
        write("-vm.json", {"jsonrpc": "2.0", "result": {"type": "VM", "pid": pid}})
        event = {"eventType": "logEvent", "processID": pid, "processImagePath": executable,
            "eventMessage": "The Dart VM service is listening on " + uri, "timestamp": "2025-01-01T00:00:01+00:00",
            "machTimestamp": 1000 + index, "traceID": 1, "threadID": 2, "senderProgramCounter": 3,
            "processImageUUID": UUID, "senderImageUUID": UUID, "bootUUID": UUID,
            "senderImagePath": APP + "/Frameworks/Flutter.framework/Flutter"}
        status = {"status": "completed", "exit_code": 0, "command": ["xcrun", "simctl", "spawn", UUID, "log", "show", "--last", "2m",
            "--style", "json", "--predicate", f"processID == {pid} AND processImagePath == {json.dumps(executable)}"]}
        write("-backfill-status.json", status)
        out.write(phase + "-backfill.json", b"[]")
        out.write(phase + "-backfill.stderr.log", b"")
        write("-discovery.json", {"launch_started_at": "2025-01-01T00:00:00+00:00", "pid": pid,
            "event": event, "origins": ["stream"], "observations": [{"origin": "stream", "event": event}],
            "backfill_status": status, "verified_at": "2025-01-01T00:00:02+00:00"})
        out.write(phase + "-system.log", m.p.encode(event) + b"\n")
        out.write(phase + "-system-events.jsonl", m.p.encode({"arrival_utc": "2025-01-01T00:00:01+00:00", "event": event}) + b"\n")
        out.write(phase + "-process.txt", f"{pid} {executable}\n".encode())
        out.write(phase + "-driver.stdout.log", (f"All tests passed.\ntax_future selected_test={m.t.SELECTED_TEST} phase={phase} source={spec.source}\n"
            f"tax_future phase={phase} source={spec.source} pid={pid} evidence=complete\n").encode())
        out.write(phase + "-driver.stderr.log", b"")
        driver_argv = [SDK["dart"], m.t.DRIVER]
        driver_start = m.t.direct_driver_start(spec, copy.deepcopy(SDK), pid, uri, preparation_sha, "2025-01-01T00:00:03+00:00")
        write("-driver-start.json", driver_start)
        write("-driver.json", {**driver_start, "status": "completed", "exit_code": 0,
                              "completed_at": "2025-01-01T00:00:04+00:00"})
        self.command_capture(phase + "-driver-command", driver_argv, 240, 16 * 1024 * 1024,
                             out.read(phase + "-driver.stdout.log"), b"")
        with (out.root / "process.log").open("ab") as stream:
            stream.write(f"phase={phase} driver_exit=0\nphase={phase} event=terminate pid={pid}\nphase={phase} event=process_absent pid={pid}\n".encode())

    def command_capture(self, label, argv, seconds, maximum, stdout, stderr):
        out = self.host.evidence
        start = {"argv": argv, "cwd": str(self.spec.app_root), "seconds": seconds, "max_bytes": maximum,
                 "started_at": "2025-01-01T00:00:00+00:00", "runtime_acceptance": False}
        out.write(label + "-start.json", m.p.encode(start))
        output = {}
        for name, data in (("stdout.log", stdout), ("stderr.log", stderr)):
            out.write(label + "-" + name, data)
            output[name] = {"observed_bytes": len(data), "retained_bytes": len(data), "eof": True,
                "bytes": len(data), "sha256": m.sha(data), "truncated": False, "capture_complete": True}
        out.write(label + "-terminal.json", m.p.encode({**start, "completed_at": "2025-01-01T00:00:01+00:00",
            "pid": 77, "exit": 0, "timed_out": False, "output_exceeded": False, "output": output,
            "error": None, "cleanup_errors": [], "descendant_cleanup": "required_by_outer_phase_deadline"}))

    def resume(self, next_phase):
        self.host = m.HostBindings.resume(self.spec, next_phase, guard=lambda: self.allowed,
                                         access=self.access, runner=self.run, synthetic=True)
        return self.host

    def phase(self, index):
        spec = self.start(index)
        return self.host.after_phase(spec, self.app(spec))


class PortableBindings(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.h = Harness(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def refused(self, fn):
        with self.assertRaises((RuntimeError, ValueError, AssertionError, KeyError, TypeError)):
            fn()

    def test_ten_phase_full_objects_raw_generations_and_original_restore(self):
        for index in range(10):
            result = self.h.phase(index)
            self.assertTrue(result["semantic_assertions_passed"])
            self.assertTrue(result["synthetic_only"])
            self.assertFalse(result["runtime_acceptance"])
        saved = m.p.decode(self.h.baseline)["after"]
        self.assertEqual(self.h.access.entries[self.h.tax_path + ".bak"], saved[self.h.tax_path + ".bak"])
        self.assertEqual(self.h.access.entries["authoring_import_v1/retained/original.bin"],
                         saved["authoring_import_v1/retained/original.bin"])
        self.assertEqual([name for operation, name, _ in self.h.access.events if operation == "seed"],
            ["guided_studio_v1/workspace.json", self.h.tax_path, self.h.tax_path,
             self.h.tax_path + ".tmp", self.h.tax_path + ".bak"])
        result = self.h.host.restore_original()
        self.assertEqual(result["entries"], fixture.INITIAL)
        self.assertTrue(self.h.host.cleaned)
        cleanup = m.p.decode(self.h.host.evidence.read("original-restoration.json"))
        self.assertFalse(cleanup["clipboard_restored"])
        self.assertTrue(cleanup["simulator_cleanup_pending"])
        self.assertIn("tax-workspace-3-1.json", cleanup["removed_auxiliary"])
        self.assertIn("tax-workspace-5-1.json", cleanup["removed_auxiliary"])

    def test_source_order_nonce_and_previous_pid_cannot_authorize_mutation(self):
        for field, value in (("phase", "baseline-read"), ("source", "b" * 40), ("nonce", "123-2")):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as root:
                h = Harness(root)
                self.refused(lambda: h.host.before_launch(dataclasses.replace(h.spec, **{field: value}), CONTAINERS, "b" * 64, ()))
                self.assertEqual(h.access.events, [])
        self.h.phase(0)
        self.refused(lambda: self.h.host.before_launch(dataclasses.replace(self.h.spec, phase="baseline-read"), CONTAINERS, "b" * 64, (99,)))
        self.assertEqual(self.h.access.events, [])

    def test_running_failed_relocated_and_malformed_probes_stop_before_launch(self):
        for failure in ("running", "exit", "relocated", "malformed-ps"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as root:
                h = Harness(root); h.failure = failure
                self.refused(lambda: h.start(0))
                self.assertFalse(h.host.prior)
                self.assertFalse(h.access.events)

    def test_stopped_previous_pid_and_container_support_replacement_refused(self):
        for failure in ("old-pid", "data", "support"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as root:
                h = Harness(root); h.phase(0)
                if failure == "old-pid":h.failure = failure
                else:h.access.changed = failure
                self.refused(lambda: h.start(1))
                self.assertFalse(h.access.events)

    def test_changed_saved_bytes_and_new_exports_never_grant_cleanup_authority(self):
        for name in ("tax-workspace-999-1.json", "ios-future-unknown.json", m.BASELINE, "guided_studio_v1/workspace.json"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as root:
                h = Harness(root); h.phase(0)
                h.access.entries[name] = m.mut.raw(b"unexpected")
                before = copy.deepcopy(h.access.entries)
                self.refused(lambda: h.start(1))
                self.assertEqual(h.access.entries, before)
                self.assertFalse(h.access.events)

    def test_preexisting_baseline_control_receipt_or_export_rejected_from_initial_snapshot(self):
        for name in (m.BASELINE, m.CONTROL, m.RECEIPTS[2], "ios-future-unknown.json", "tax-workspace-1-1.json"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as root:
                h = Harness(root)
                h.access.original["Library/Application Support/" + name] = m.mut.raw(b"preserve")
                spec = h.start(0); transport = h.app(spec)
                self.refused(lambda: h.host.after_phase(spec, transport))
                self.assertFalse(h.host.prior)

    def test_driver_and_actual_app_receipt_complete_object_must_match(self):
        spec = self.h.start(0); transport = self.h.app(spec)
        changed = m.p.decode(self.h.baseline); changed["artifact"]["unknown"]["exact"] = "changed"
        self.h.access.entries[m.RECEIPTS[0]] = m.mut.raw(m.p.encode(changed))
        self.refused(lambda: self.h.host.after_phase(spec, transport))
        self.assertFalse(self.h.host.prior)

    def test_actual_primary_disk_pair_not_only_receipt_self_consistency(self):
        spec = self.h.start(0); transport = self.h.app(spec)
        artifact = m.p.decode(m.mut.decode(self.h.access.entries[self.h.tax_path]))
        artifact["unknown"]["exact"] = "changed on disk"
        self.h.access.entries[self.h.tax_path] = m.mut.raw(m.p.encode(artifact))
        self.refused(lambda: self.h.host.after_phase(spec, transport))
        self.assertFalse(self.h.host.prior)

    def test_export_exact_bytes_prior_export_and_extra_export_checked(self):
        for kind in ("changed", "extra", "prior"):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as root:
                h = Harness(root)
                final = 5 if kind == "prior" else 3
                for index in range(final):h.phase(index)
                spec = h.start(final); transport = h.app(spec)
                name = f"tax-workspace-{3 if kind == 'prior' else final}-1.json" if kind != "extra" else "tax-workspace-99-1.json"
                h.access.entries[name] = m.mut.raw(b"extra/changed bytes")
                self.refused(lambda: h.host.after_phase(spec, transport))
                self.assertEqual(len(h.host.prior), final)
                self.refused(h.host.restore_original)

    def test_retained_transport_screenshot_and_prelaunch_bytes_are_bound(self):
        for kind in ("pid", "complete", "screenshot", "prelaunch"):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as root:
                h = Harness(root); spec = h.start(0); transport = h.app(spec)
                if kind == "pid":transport["pid"] = 77
                elif kind == "complete":transport["transport_complete"] = False
                elif kind == "screenshot":(pathlib.Path(root) / "baseline-write-future.png").write_bytes(fixture.PNG + b"x")
                else:(pathlib.Path(root) / "baseline-write-prelaunch-inventory.json").write_bytes(b"{}")
                self.refused(lambda: h.host.after_phase(spec, transport))

    def test_cancelled_failed_or_incomplete_run_cannot_restore(self):
        self.h.phase(0)
        self.refused(self.h.host.restore_original)
        self.assertFalse(self.h.access.events)
        with tempfile.TemporaryDirectory() as root:
            h = Harness(root); h.phase(0); h.allowed = False
            self.refused(lambda: h.start(1))
            self.refused(h.host.restore_original)
            self.assertFalse(h.access.events)

    def test_host_evidence_never_overwrites_existing_bytes(self):
        self.h.host.evidence.write("sentinel.json", b"original")
        with self.assertRaises(FileExistsError):self.h.host.evidence.write("sentinel.json", b"changed")
        self.assertEqual(self.h.host.evidence.read("sentinel.json"), b"original")
        self.refused(lambda: self.h.host.evidence.write("../outside", b"bad"))

    def test_windows_has_no_production_filesystem_fallback(self):
        with patch.object(m.initial, "posix_available", return_value=False):
            with self.assertRaisesRegex(RuntimeError, "no Windows fallback"):m.PosixAccess()
        self.refused(lambda: m.HostBindings(self.h.spec, guard=lambda: True, access=FakeAccess()))
        falsely_labelled = FakeAccess()
        falsely_labelled.synthetic_only = False
        self.refused(lambda: m.HostBindings(self.h.spec, guard=lambda: True, access=falsely_labelled, synthetic=False))

    def test_independent_phase_instances_replay_all_ten_then_restore(self):
        original = None
        for index in range(10):
            if index:
                previous_host = self.h.host
                self.h.resume(m.t.PHASES[index])
                self.assertIsNot(self.h.host, previous_host)
                self.assertEqual(len(self.h.host.prior), index)
                self.assertEqual(self.h.host.baseline, original)
            self.h.phase(index)
            original = self.h.host.baseline
        self.h.resume("restore-original")
        self.assertEqual(len(self.h.host.prior), 10)
        self.h.host.restore_original()
        self.assertEqual(self.h.access.entries, fixture.INITIAL)
        reviewed = m.replay_ledger(self.h.spec, "restore-original", self.h.host.evidence, True, after_restoration=True)
        self.assertEqual(len(reviewed["prior"]), 10)
        self.refused(lambda: m.replay_ledger(self.h.spec, "baseline-read", self.h.host.evidence, True, after_restoration=True))
        self.refused(lambda: self.h.resume("restore-original"))

    def test_resume_requires_complete_ordered_ledger_and_no_partial_later_files(self):
        for failure in ("missing", "truncated", "partial", "skipped", "wrong-next", "failure-proof"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as root:
                h = Harness(root); h.phase(0)
                ledger = pathlib.Path(root) / "baseline-write-ledger.json"
                if failure == "missing":ledger.unlink()
                elif failure == "truncated":ledger.write_bytes(b'{"schema":')
                elif failure == "partial":(pathlib.Path(root) / "baseline-read-binding-start.json").write_bytes(b"{}")
                elif failure == "skipped":(pathlib.Path(root) / "workspace-future-ledger.json").write_bytes(b"{}")
                elif failure == "failure-proof":(pathlib.Path(root) / "baseline-write-cleanup-failure.json").write_bytes(b"{}")
                before = copy.deepcopy(h.access.entries); actions = list(h.access.events); commands = len(h.commands)
                self.refused(lambda: h.resume("workspace-future" if failure == "wrong-next" else "baseline-read"))
                self.assertEqual(h.access.entries, before)
                self.assertEqual(h.access.events, actions)
                self.assertEqual(len(h.commands), commands)

    def test_resume_rechecks_fresh_current_disk_pid_identity_and_cancellation(self):
        for failure in ("disk", "running", "relocated", "support", "cancelled"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as root:
                h = Harness(root); h.phase(0)
                if failure == "disk":h.access.entries[m.BASELINE] = m.mut.raw(b"changed")
                elif failure == "support":h.access.changed = failure
                elif failure == "cancelled":h.allowed = False
                else:h.failure = failure
                before = copy.deepcopy(h.access.entries)
                self.refused(lambda: h.resume("baseline-read"))
                self.assertEqual(h.access.entries, before)
                self.assertFalse(h.access.events)

    def test_resume_rejects_source_nonce_and_synthetic_scope_switch(self):
        self.h.phase(0)
        for changed in (dataclasses.replace(self.h.spec, source="c" * 40), dataclasses.replace(self.h.spec, nonce="999-9")):
            self.refused(lambda: m.replay_ledger(changed, "baseline-read", self.h.host.evidence, True))
        self.refused(lambda: m.replay_ledger(self.h.spec, "baseline-read", self.h.host.evidence, False))

    def test_ledger_rehash_does_not_replace_semantic_transport_validation(self):
        for suffix, change in (("-vm.json", lambda v: v["result"].update(pid=999)),
                               ("-discovery.json", lambda v: v.update(launch_started_at="2025-01-02T00:00:00+00:00")),
                               ("-application-receipt.json", lambda v: v["artifact"].update(case_id="other")),
                               ("-postphase-inventory.json", lambda v: v["entries"].update({"tax-workspace-99-1.json": m.mut.raw(b"extra")}))):
            with self.subTest(suffix=suffix), tempfile.TemporaryDirectory() as root:
                h = Harness(root); h.phase(0)
                name = "baseline-write" + suffix
                path = pathlib.Path(root) / name
                value = m.p.decode(path.read_bytes()); change(value); path.write_bytes(m.p.encode(value))
                ledger_path = pathlib.Path(root) / "baseline-write-ledger.json"
                ledger = m.p.decode(ledger_path.read_bytes())
                ledger["files"][name] = {"bytes": path.stat().st_size, "sha256": m.sha(path.read_bytes())}
                ledger_path.write_bytes(m.p.encode(ledger))
                before = copy.deepcopy(h.access.entries); commands = len(h.commands)
                self.refused(lambda: h.resume("baseline-read"))
                self.assertEqual(h.access.entries, before)
                self.assertEqual(len(h.commands), commands)

    def test_prior_ledger_digest_and_process_prefix_are_required(self):
        self.h.phase(0); self.h.phase(1)
        first = pathlib.Path(self.tmp.name) / "baseline-write-ledger.json"
        first.write_bytes(first.read_bytes() + b"\n")
        self.refused(lambda: self.h.resume("workspace-future"))
        with tempfile.TemporaryDirectory() as root:
            h = Harness(root); h.phase(0)
            process = pathlib.Path(root) / "process.log"
            process.write_bytes(process.read_bytes().replace(b"process_absent", b"not_observed"))
            self.refused(lambda: h.resume("baseline-read"))

    def test_backfill_only_discovery_can_replay_explicit_absent_stream_records(self):
        spec = self.h.start(0); transport = self.h.app(spec)
        root = pathlib.Path(self.tmp.name)
        discovery_path = root / "baseline-write-discovery.json"
        discovery = m.p.decode(discovery_path.read_bytes())
        event = discovery["event"]
        discovery["origins"] = ["backfill"]
        discovery["observations"] = [{"origin": "backfill", "event": event}]
        discovery_path.write_bytes(m.p.encode(discovery))
        (root / "baseline-write-backfill.json").write_bytes(b"[" + m.p.encode(event) + b"]")
        (root / "baseline-write-system.log").write_bytes(b"")
        (root / "baseline-write-system-events.jsonl").unlink()
        self.h.host.after_phase(spec, transport)
        self.h.resume("baseline-read")
        self.assertEqual(len(self.h.host.prior), 1)
        (root / "baseline-write-system-events.jsonl").write_bytes(b"")
        self.refused(lambda: self.h.resume("baseline-read"))

    def observed_open_stream(self, h, *, event_change=None, tail=b""):
        """Reduced 7a PR log-stream shape; every process/VM identity is synthetic."""
        root = h.host.evidence.root
        event = m.p.decode((root / "baseline-write-discovery.json").read_bytes())["event"]
        if event_change:
            event_change(event)
        shape = pathlib.Path(__file__).with_name("fixtures").joinpath("open-system-stream.txt").read_bytes()
        self.assertEqual(shape.count(b'{"fixture": "VM_EVENT"}'), 1)
        raw = shape.replace(b'{"fixture": "VM_EVENT"}', json.dumps(event, indent=2).encode())
        parser = m.pinned_transport().JsonLogObjects()
        events = parser.feed(raw.decode(), final=True)
        self.assertTrue(parser.array)
        self.assertFalse(parser.closed)
        self.assertEqual(len(events), 2)
        (root / "baseline-write-system.log").write_bytes(raw + tail)
        (root / "baseline-write-system-events.jsonl").write_bytes(b"".join(
            m.p.encode({"arrival_utc": "2025-01-01T00:00:01+00:00", "event": value}) + b"\n"
            for value in events))

    def test_observed_owned_stream_complete_record_boundary_commits_and_replays(self):
        spec = self.h.start(0); transport = self.h.app(spec)
        self.observed_open_stream(self.h)
        self.h.host.after_phase(spec, transport)
        self.h.resume("baseline-read")
        self.assertEqual(len(self.h.host.prior), 1)

    def test_observed_stream_partial_object_separator_or_garbage_never_commits(self):
        for tail in (b",", b',{"eventType":', b"unexpected", b"]{}", b",,{}"):
            with self.subTest(tail=tail), tempfile.TemporaryDirectory() as root:
                h = Harness(root); spec = h.start(0); transport = h.app(spec)
                self.observed_open_stream(h, tail=tail)
                self.refused(lambda: h.host.after_phase(spec, transport))
                self.assertFalse((pathlib.Path(root) / "baseline-write-ledger.json").exists())

    def test_observed_stream_preserves_authenticated_pid_path_time_and_uri_checks(self):
        changes = (("processID", 999), ("processImagePath", "/other/Runner"),
                   ("timestamp", "2024-12-31T23:59:59+00:00"),
                   ("eventMessage", "The Dart VM service is listening on http://127.0.0.1:12345/"))
        for field, value in changes:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as root:
                h = Harness(root); spec = h.start(0); transport = h.app(spec)
                self.observed_open_stream(h, event_change=lambda event: event.update({field: value}))
                self.refused(lambda: h.host.after_phase(spec, transport))
                self.assertFalse((pathlib.Path(root) / "baseline-write-ledger.json").exists())

    def test_observed_stream_still_requires_exact_raw_and_wrapped_events(self):
        spec = self.h.start(0); transport = self.h.app(spec)
        self.observed_open_stream(self.h)
        path = self.h.host.evidence.root / "baseline-write-system-events.jsonl"
        path.write_bytes(b"\n".join(path.read_bytes().splitlines()[:-1]) + b"\n")
        self.refused(lambda: self.h.host.after_phase(spec, transport))
        self.assertFalse((self.h.host.evidence.root / "baseline-write-ledger.json").exists())

    def test_finite_successful_backfill_still_requires_closed_array(self):
        spec = self.h.start(0); transport = self.h.app(spec)
        self.observed_open_stream(self.h)
        root = self.h.host.evidence.root
        event = m.p.decode((root / "baseline-write-discovery.json").read_bytes())["event"]
        (root / "baseline-write-backfill.json").write_bytes(b"[" + m.p.encode(event))
        with self.assertRaisesRegex(RuntimeError, "Backfill truncated"):
            self.h.host.after_phase(spec, transport)
        self.assertFalse((root / "baseline-write-ledger.json").exists())

    def test_preparation_inputs_and_full_bundle_must_match_before_ledger_commit(self):
        cases = (("source_sha", "f" * 40), ("run_nonce", "555-9"), ("simulator", "FFFFFFFF-BBBB-CCCC-DDDD-EEEEEEEEEEEE"),
                 ("target", "integration_test/other.dart"), ("timeout_seconds", 300), ("source_files", {}),
                 ("build_completed", False), ("exit_code", 7))
        for key, value in cases:
            with self.subTest(key=key), tempfile.TemporaryDirectory() as root:
                h = Harness(root); spec = h.start(0); transport = h.app(spec)
                path = pathlib.Path(root) / "prepare.json"
                record = m.p.decode(path.read_bytes()); record[key] = value; path.write_bytes(m.p.encode(record))
                start_path = pathlib.Path(root) / "prepare-start.json"
                start = m.p.decode(start_path.read_bytes())
                if key in start:
                    start[key] = value
                    start_path.write_bytes(m.p.encode(start))
                changed_hash = m.sha(path.read_bytes())
                transport["preparation_sha256"] = changed_hash
                (pathlib.Path(root) / "baseline-write-transport.json").write_bytes(m.p.encode(transport))
                launch_path = pathlib.Path(root) / "baseline-write-launch.json"
                launch = m.p.decode(launch_path.read_bytes()); launch["preparation_sha256"] = changed_hash
                launch_path.write_bytes(m.p.encode(launch))
                self.refused(lambda: h.host.after_phase(spec, transport))
                self.assertFalse((pathlib.Path(root) / "baseline-write-ledger.json").exists())
        with tempfile.TemporaryDirectory() as root:
            h = Harness(root); spec = h.start(0); transport = h.app(spec)
            (pathlib.Path(root) / "prepared-bundle.json").write_bytes(BUNDLE + b"changed")
            self.refused(lambda: h.host.after_phase(spec, transport))
            self.assertFalse((pathlib.Path(root) / "baseline-write-ledger.json").exists())

    def test_build_and_driver_command_capture_must_be_complete_success(self):
        for label in ("prepare-command", "baseline-write-driver-command"):
            for field, value in (("timed_out", True), ("error", "capture failed"), ("exit", 1),
                                 ("cleanup_errors", ["pipe still open"]), ("output_exceeded", True), ("seconds", 901)):
                with self.subTest(label=label, field=field), tempfile.TemporaryDirectory() as root:
                    h = Harness(root); spec = h.start(0); transport = h.app(spec)
                    path = pathlib.Path(root) / (label + "-terminal.json")
                    record = m.p.decode(path.read_bytes()); record[field] = value; path.write_bytes(m.p.encode(record))
                    self.refused(lambda: h.host.after_phase(spec, transport))
                    self.assertFalse((pathlib.Path(root) / "baseline-write-ledger.json").exists())
            with tempfile.TemporaryDirectory() as root:
                h = Harness(root); spec = h.start(0); transport = h.app(spec)
                path = pathlib.Path(root) / (label + "-terminal.json")
                record = m.p.decode(path.read_bytes()); record["output"]["stdout.log"]["capture_complete"] = False
                path.write_bytes(m.p.encode(record))
                self.refused(lambda: h.host.after_phase(spec, transport))

    def test_direct_driver_sdk_command_environment_and_terminal_bind_before_ledger(self):
        cases = (("driver_sdk", {**SDK, "dart_sha256": "e" * 64}),
                 ("argv", ["flutter", "drive"]), ("runner_pid", 999),
                 ("environment", {"VM_SERVICE_URL": "http://127.0.0.1:12345/other=/"}),
                 ("preparation_sha256", "e" * 64), ("cwd", "/different"),
                 ("status", "failed"), ("exit_code", True), ("exit_code", 1),
                 ("error", "timeout"), ("started_at", "2025-01-01T00:00:00+00:00"))
        for field, value in cases:
            with self.subTest(field=field, value=value), tempfile.TemporaryDirectory() as root:
                h = Harness(root); spec = h.start(0); transport = h.app(spec)
                for suffix in ("-driver-start.json", "-driver.json"):
                    path = pathlib.Path(root) / ("baseline-write" + suffix)
                    record = m.p.decode(path.read_bytes())
                    if field in record or suffix == "-driver.json":
                        record[field] = value
                        path.write_bytes(m.p.encode(record))
                self.refused(lambda: h.host.after_phase(spec, transport))
                self.assertFalse((pathlib.Path(root) / "baseline-write-ledger.json").exists())

    def test_prepared_sdk_pins_and_launch_sdk_must_match(self):
        for field, value in (("dart", "/unrelated/dart"), ("dart_version", "3.12.3"),
                             ("framework_revision", "e" * 40)):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as root:
                h = Harness(root); spec = h.start(0); transport = h.app(spec)
                for name in ("prepare-start.json", "prepare.json"):
                    path = pathlib.Path(root) / name
                    record = m.p.decode(path.read_bytes()); record["driver_sdk"][field] = value
                    path.write_bytes(m.p.encode(record))
                self.refused(lambda: h.host.after_phase(spec, transport))
                self.assertFalse((pathlib.Path(root) / "baseline-write-ledger.json").exists())
        for name in ("baseline-write-launch.json", "baseline-write-transport.json"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as root:
                h = Harness(root); spec = h.start(0); transport = h.app(spec)
                path = pathlib.Path(root) / name
                record = m.p.decode(path.read_bytes()); record["driver_sdk"]["dart_sha256"] = "e" * 64
                path.write_bytes(m.p.encode(record))
                if name.endswith("transport.json"): transport = record
                self.refused(lambda: h.host.after_phase(spec, transport))
                self.assertFalse((pathlib.Path(root) / "baseline-write-ledger.json").exists())

    def test_preparation_hash_and_direct_launch_time_are_bound(self):
        for field, value in (("preparation_sha256", "f" * 64), ("launch_started_at", "2025-01-01T00:00:00.1+00:00")):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as root:
                h = Harness(root); spec = h.start(0); transport = h.app(spec)
                path = pathlib.Path(root) / "baseline-write-launch.json"
                record = m.p.decode(path.read_bytes()); record[field] = value; path.write_bytes(m.p.encode(record))
                self.refused(lambda: h.host.after_phase(spec, transport))
        with tempfile.TemporaryDirectory() as root:
            h = Harness(root); spec = h.start(0); transport = h.app(spec)
            transport["preparation_sha256"] = "e" * 64
            (pathlib.Path(root) / "baseline-write-transport.json").write_bytes(m.p.encode(transport))
            self.refused(lambda: h.host.after_phase(spec, transport))

    def test_preparation_schema_receipts_cannot_be_replayed_as_stage_evidence(self):
        self.h.phase(0)
        path = pathlib.Path(self.tmp.name) / "baseline-write-ledger.json"
        ledger = m.p.decode(path.read_bytes())
        self.assertEqual(ledger["schema"], "tax-ios-future-host-ledger-v1")
        self.assertTrue(ledger["preparation_only"])
        self.assertFalse(ledger["stage_proof"] or ledger["runtime_acceptance"])
        ledger["schema"] = "ios-future-host-ledger-preparation-v1"
        path.write_bytes(m.p.encode(ledger))
        self.refused(lambda: self.h.resume("baseline-read"))

    def test_post_restoration_review_never_accepts_intermediate_or_unrestored_chain(self):
        self.h.phase(0)
        for phase in m.t.PHASES[1:]:
            self.refused(lambda phase=phase: m.replay_ledger(self.h.spec, phase, self.h.host.evidence, True, after_restoration=True))
        self.refused(lambda: m.replay_ledger(self.h.spec, "restore-original", self.h.host.evidence, True, after_restoration=True))
        self.refused(lambda: self.h.resume("restore-original"))


@unittest.skipUnless(m.initial.posix_available(), "POSIX no-follow/dir_fd required; explicit Windows skip")
class ActualPosixBindings(unittest.TestCase):
    def test_directory_identity_and_export_links_refused(self):
        with tempfile.TemporaryDirectory() as root:
            base = pathlib.Path(root).resolve()
            support = base / "Support"; support.mkdir()
            access = m.PosixAccess()
            ident = access.identity(base)
            sid = access.identity(support)
            binding = {"source_sha": fixture.SOURCE, "run_nonce": fixture.NONCE,
                "container": str(base), "support": "Support", "container_id": [ident["device"], ident["inode"]],
                "support_id": [sid["device"], sid["inode"]]}
            probe = lambda: {"binding": binding, "stopped": True, "process_absent": True, "previous_pid": 100}
            (support / "tax-workspace-1-1.json").write_bytes(b"exact")
            observed = access.capture(binding, probe, lambda: True, lambda _: True)
            self.assertEqual(m.mut.decode(observed["entries"]["tax-workspace-1-1.json"]), b"exact")
            (support / "tax-workspace-2-1.json").symlink_to(support / "tax-workspace-1-1.json")
            with self.assertRaises(RuntimeError):access.capture(binding, probe, lambda: True, lambda _: True)

    def test_actual_control_write_and_exact_removal_preserve_unowned_cache(self):
        with tempfile.TemporaryDirectory() as root:
            base = pathlib.Path(root).resolve(); support = base / "Support"; support.mkdir()
            (support / "cache").write_bytes(b"not owned")
            access = m.PosixAccess(); cid = access.identity(base); sid = access.identity(support)
            binding = {"source_sha": fixture.SOURCE, "run_nonce": fixture.NONCE, "container": str(base),
                "support": "Support", "container_id": [cid["device"], cid["inode"]], "support_id": [sid["device"], sid["inode"]]}
            probe = lambda: {"binding": binding, "stopped": True, "process_absent": True, "previous_pid": 100}
            ctl = access.controller(binding, probe, lambda: True, lambda _: True, m.CONTROLS)
            before = ctl.inventory()
            written = ctl.apply(before, {m.CONTROL: m.mut.raw(b" exact control \n")}, operation="controls")
            self.assertEqual((support / m.CONTROL).read_bytes(), b" exact control \n")
            ctl.apply(written, {}, operation="controls")
            self.assertFalse((support / m.CONTROL).exists())
            self.assertEqual((support / "cache").read_bytes(), b"not owned")


if __name__ == "__main__":
    unittest.main()
