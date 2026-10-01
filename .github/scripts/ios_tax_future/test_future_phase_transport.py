"""Synthetic tools only. Never invokes simctl, Flutter or a live VM."""
import dataclasses
import datetime
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import types
import unittest

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("future_phase_transport", HERE / "future_phase_transport.py")
m = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = m
spec.loader.exec_module(m)
REPOSITORY = HERE.parents[2]
REF = m.load_reference(REPOSITORY)
PREPARED = m.verify_prepared(REPOSITORY)
DEVICE = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE"
# Shape-faithful synthetic SDK; no executable or local Flutter is consulted.
SDK = {"flutter_root": "/synthetic/flutter", "dart": "/synthetic/flutter/bin/cache/dart-sdk/bin/dart",
       "dart_sha256": "d" * 64, "flutter_version": "3.44.8",
       "framework_revision": REF.FLUTTER_REVISION, "dart_version": "3.12.2"}


class FakeReader:
    def __init__(self, owner):
        self.owner = owner
        self.closed = False
        owner.events.append("reader-start")
    def drain(self, identity, evidence, closing=False):
        self.owner.events.append("drain-close" if closing else "drain")
        if closing and self.owner.failure == "late-log":
            raise RuntimeError("late matching identity conflict")
    def close(self):
        self.owner.events.append("reader-close")
        self.closed = True
        if self.owner.failure == "cleanup":
            raise RuntimeError("reader cleanup failed")


class FakeTools:
    synthetic_only = True
    reference_pin = (m.REFERENCE_SOURCE, m.REFERENCE_BLOB, m.REFERENCE_SHA256)
    APP, FLAGS = REF.APP, REF.FLAGS
    utc_now = staticmethod(REF.utc_now)
    LogIdentity = REF.LogIdentity
    authenticated_uri = staticmethod(REF.authenticated_uri)
    launch_pid = staticmethod(REF.launch_pid)
    validate_driver_sdk = staticmethod(REF.validate_driver_sdk)
    def __init__(self, current, app, device):
        self.current = current
        self.app = app
        self.device = device
        self.events = []
        self.failure = None
        self.pid = 100
        self.installs = 0
        self.external = None
        self.reader = None
        self.manifests = 0
        self.sdk = dict(SDK)
    def driver_sdk_identity(self):
        self.events.append("driver-sdk")
        return dict(self.sdk)
    def manifest(self, path):
        self.manifests += 1
        value = REF.manifest(self.app / "build/ios/iphonesimulator/Runner.app")
        if self.failure == "installed-bundle" and isinstance(path, pathlib.PurePosixPath):
            return value + b"changed"
        if self.failure == "post-bundle" and "drive" in self.events:
            return value + b"changed"
        return value
    def command(self, argv, timeout=30, check=True):
        if argv[0] == "ps":
            text = b""
            if self.failure == "preexisting":
                text = f" 123 /fake/Devices/{DEVICE}/data/Containers/Bundle/Application/A/Runner.app/Runner\n".encode()
            return subprocess.CompletedProcess(argv, 0, text, b"")
        command = argv[2]
        self.events.append(command)
        if command == "get_app_container":
            kind = argv[-1]
            text = f"/fake/Devices/{DEVICE}/data/Containers/" + (
                "Bundle/Application/APP/Runner.app" if kind == "app" else "Data/Application/DATA")
            if self.failure == "foreign-container":
                text = text.replace(DEVICE, "FFFFFFFF-BBBB-CCCC-DDDD-EEEEEEEEEEEE")
            if self.failure == "container-dotdot":
                text = text.replace("/DATA", "/../DATA")
            return subprocess.CompletedProcess(argv, 7 if self.failure == "container-query" else 0, text.encode(), b"")
        if command == "launch":
            if self.failure != "reused-pid":
                self.pid += 1
            return subprocess.CompletedProcess(argv, 7 if self.failure == "launch" else 0,
                                               f"{self.APP}: {self.pid}\n".encode(), b"launch diagnostic")
        if command == "terminate":
            if self.failure == "terminate":
                raise RuntimeError("terminate failed")
            return subprocess.CompletedProcess(argv, 0, b"", b"")
        raise AssertionError(argv)
    def install_bundle(self, spec, bundle, built, timeout_seconds):
        self.events.append("install")
        self.installs += 1
        assert timeout_seconds == 120
        value = {"source_sha": spec.source, "run_nonce": spec.nonce, "simulator": spec.device,
                 "bundle_manifest_sha256": m.sha(built), "installation_completed": self.failure != "install",
                 "exit_code": 1 if self.failure == "install" else 0}
        m.save(spec.evidence / "baseline-write-install.json", value)
        if self.failure == "install":
            raise RuntimeError("install failed")
    def existing_runner(self, executable):
        self.events.append("existing-runner")
        if self.failure == "hook-runner" and "before-launch" in self.events:
            raise RuntimeError("unexpected Runner after hook")
    def LogReader(self, argv, output):
        self.reader = FakeReader(self)
        if self.failure == "expired-reader":
            self.external.now = 1000
        return self.reader
    def process_matches(self, pid, executable):
        self.events.append("process-match")
        if self.failure == "process":
            raise RuntimeError("wrong executable")
        return f"{pid} {executable}".encode()
    def discover(self, reader, identity, spec, evidence):
        self.events.append("discover")
        self.discovery_started_at = identity.started
        if self.failure == "discovery":
            raise RuntimeError("discovery timeout")
        identity.uri = "http://127.0.0.1:12345/synthetic-auth=/"
        if self.failure == "bad-uri":
            identity.uri = "http://example.com:12345/synthetic-auth=/"
        return identity
    def vm_identity(self, uri, pid):
        self.events.append("getVM")
        return {"jsonrpc": "2.0", "result": {"type": "VM", "pid": pid + (1 if self.failure == "wrong-vm" else 0)}}
    def stopped(self, pid):
        self.events.append("stopped")
        if self.failure == "still-live":
            raise RuntimeError("Runner still live")
    def live_failure_probe(self, spec, evidence, pid, executable):
        self.events.append("live-probe")
        if self.failure == "probe":
            raise RuntimeError("probe failed")


class FakeExternal:
    synthetic_only = True
    prepared_hashes = PREPARED
    def __init__(self, tools):
        self.tools = tools
        tools.external = self
        self.cancelled = False
        self.now = 0
        self.builds = []
        self.build_elapsed = 0
        self.drives = []
        self.receipt_mutation = None
        self.identity_changed = False
    def build(self, argv, cwd, seconds):
        self.builds.append((argv, cwd, seconds))
        self.tools.events.append("build")
        self.now += self.build_elapsed
        if self.tools.failure == "build":
            raise RuntimeError("build timeout")
        if self.tools.failure == "build-expired":
            self.now += 901
        if self.tools.failure == "build-cancelled":
            self.cancelled = True
        if self.tools.failure == "build-no-runner":
            (cwd / "build/ios/iphonesimulator/Runner.app/Runner").unlink()
        return subprocess.CompletedProcess(argv, 1 if self.tools.failure == "build-nonzero" else 0, b"build output", b"")
    def directory_identity(self, path):
        return {"device": 1, "inode": (3 if str(path).endswith("DATA") else 2) + (10 if self.identity_changed else 0)}
    def before_launch(self, spec, containers, bundle_hash, previous):
        self.tools.events.append("before-launch")
        if self.tools.failure == "hook-failure":
            raise RuntimeError("host snapshot failed")
        path = spec.evidence / f"{spec.phase}-prelaunch-inventory.json"
        m.save(path, {"synthetic_only": True, "original": spec.index == 0, "roots": {}})
        raw = path.read_bytes()
        proof = {"source_sha": spec.source, "run_nonce": spec.nonce, "phase": spec.phase,
                 "containers": containers, "bundle_manifest_sha256": bundle_hash,
                 "inventory_file": path.name, "inventory_sha256": m.sha(raw), "inventory_bytes": len(raw),
                 "original_snapshot": spec.index == 0, "acceptance": False}
        if self.tools.failure == "hook-wrong-source":
            proof["source_sha"] = "0" * 40
        if self.tools.failure == "hook-raw-change":
            path.write_bytes(raw + b"changed")
        if self.tools.failure == "hook-container":
            self.identity_changed = True
        if self.tools.failure == "hook-bundle":
            (self.tools.app / "build/ios/iphonesimulator/Runner.app/Runner").write_bytes(b"changed")
        if self.tools.failure == "hook-expired":
            self.now = 1000
        return proof
    def drive(self, argv, env, cwd, seconds):
        self.drives.append((argv, env, cwd, seconds))
        self.tools.events.append("drive")
        phase = env["JURIS_FUTURE_PHASE"]
        index = m.PHASES.index(phase)
        evidence = pathlib.Path(env["JURIS_FUTURE_OUTPUT"])
        pid = int(env["JURIS_FUTURE_EXPECTED_PID"])
        prior = None if not index else m.read_json(evidence / f"{m.PHASES[index-1]}-transport.json")["pid"]
        png = b"\x89PNG\r\n\x1a\n" + b"synthetic-not-image-decoding-proof" + b"0" * 30
        image = evidence / f"{phase}-future.png"
        image.write_bytes(png)
        receipt = {"schema": m.RECEIPT_SCHEMA, "selected_test": m.SELECTED_TEST, "phase": phase,
                   "completed_phase": phase, "phase_index": index, "source_sha": env["JURIS_ACCEPTANCE_SOURCE_SHA"],
                   "run_nonce": env["JURIS_ACCEPTANCE_RUN_NONCE"], "pid": pid, "previous_pid": prior,
                   "platform": "ios", "entry_method": "programmatic_flutter_test", "interruption_evidence": False,
                   "screenshot": {"filename": image.name, "bytes": len(png), "sha256": m.sha(png)}}
        if self.receipt_mutation:
            self.receipt_mutation(receipt)
        if self.tools.failure != "missing-receipt":
            m.save(evidence / f"{phase}.json", receipt)
        if self.tools.failure == "corrupt-image":
            image.write_bytes(png + b"changed")
        output = (f"All tests passed.\ntax_future selected_test={m.SELECTED_TEST} phase={phase} "
                  f"source={env['JURIS_ACCEPTANCE_SOURCE_SHA']}\ntax_future phase={phase} "
                  f"source={env['JURIS_ACCEPTANCE_SOURCE_SHA']} pid={pid} evidence=complete\n").encode()
        if self.tools.failure == "missing-marker":
            output = b"All tests passed."
        if self.tools.failure == "expired-driver":
            self.now = 1000
        if self.tools.failure == "cancelled-driver":
            self.cancelled = True
        if self.tools.failure == "post-container":
            self.identity_changed = True
        return subprocess.CompletedProcess(argv, 1 if self.tools.failure in ("driver", "probe") else 0, output, b"diagnostic")


class Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = pathlib.Path(self.temp.name)
        self.evidence = root / "evidence"
        self.evidence.mkdir()
        self.app = root / "app"
        bundle = self.app / "build/ios/iphonesimulator/Runner.app"
        bundle.mkdir(parents=True)
        (bundle / "Runner").write_bytes(b"synthetic bundle")
        self.tools = FakeTools(None, self.app, DEVICE)
        self.external = FakeExternal(self.tools)
        self.prepare()
        self.tools.events.clear()
    def tearDown(self):
        self.temp.cleanup()
    def phase(self, name="baseline-write"):
        return m.PhaseSpec(name, DEVICE, m.REFERENCE_SOURCE, "123-1", self.evidence, self.app, pathlib.PurePosixPath("/fake/Devices"))
    def run_phase(self, name="baseline-write"):
        return m.run_preparation(self.phase(name), self.tools, self.external, clock=lambda: self.external.now)
    def prepare(self):
        return m.prepare_build(self.phase(), self.tools, self.external, clock=lambda: self.external.now)
    def assert_failure(self, failure, *, after_first=False):
        if after_first:
            self.run_phase()
        self.tools.failure = failure
        phase = "baseline-read" if after_first else "baseline-write"
        with self.assertRaises(Exception):
            self.run_phase(phase)
        self.assertFalse((self.evidence / f"{phase}-transport.json").exists())
    def test_all_ten_phases_build_install_once_and_keep_bundle(self):
        original_phases = REF.PHASES
        records = [self.run_phase(phase) for phase in m.PHASES]
        self.assertEqual(1, len(self.external.builds))
        build, _, seconds = self.external.builds[0]
        self.assertEqual(build, ["flutter", "build", "ios", "--verbose", "--simulator", "--debug", "--no-pub",
                                 f"--target={m.TARGET}",
                                 f"--dart-define=JURIS_ACCEPTANCE_SOURCE_SHA={m.REFERENCE_SOURCE}",
                                 "--dart-define=JURIS_ACCEPTANCE_RUN_NONCE=123-1", "-d", DEVICE])
        self.assertLessEqual(seconds, 900)
        self.assertEqual(1, self.tools.installs)
        self.assertEqual(10, len(set(r["pid"] for r in records)))
        self.assertEqual(1, len(set(r["bundle_manifest_sha256"] for r in records)))
        self.assertEqual(original_phases, REF.PHASES)
        self.assertTrue(all(r["runtime_acceptance"] is False for r in records))
        for argv, env, _, seconds in self.external.drives:
            self.assertEqual(argv, [SDK["dart"], m.DRIVER])
            REF.authenticated_uri(env["VM_SERVICE_URL"])
            self.assertGreater(int(env["JURIS_FUTURE_EXPECTED_PID"]), 0)
            self.assertLessEqual(seconds, 240)
        for phase, record in zip(m.PHASES, records):
            start = m.read_json(self.evidence / (phase + "-driver-start.json"))
            terminal = m.read_json(self.evidence / (phase + "-driver.json"))
            self.assertEqual(start["driver_sdk"], SDK)
            self.assertEqual(record["driver_sdk"], SDK)
            self.assertEqual(terminal, {**start, "status": "completed", "exit_code": 0,
                                       "completed_at": terminal["completed_at"]})
    def test_live_entry_refused_before_any_tool(self):
        self.external.synthetic_only = False
        with self.assertRaisesRegex(RuntimeError, "Live entry refused"):
            self.run_phase()
        self.assertEqual([], self.tools.events)
    def test_source_and_target_pins_refused(self):
        self.tools.reference_pin = ("x", "y", "z")
        with self.assertRaisesRegex(RuntimeError, "not pinned"):
            self.run_phase()
        self.tools.reference_pin = (m.REFERENCE_SOURCE, m.REFERENCE_BLOB, m.REFERENCE_SHA256)
        self.external.prepared_hashes = {}
        with self.assertRaisesRegex(RuntimeError, "identities changed"):
            self.run_phase()
    def test_outer_invocation_budgets_and_phase_allowlist(self):
        for index, phase in enumerate(m.PHASES):
            plan = m.invocation_plan(self.phase(phase), "adapter.py", "deadline.py")
            self.assertEqual(300, plan["outer_seconds"])
            self.assertEqual("--timeout-seconds", plan["argv"][2])
            self.assertFalse(plan["live_entry_allowed"])
        with self.assertRaisesRegex(RuntimeError, "Unexpected"):
            m.invocation_plan(self.phase("write"), "adapter.py", "deadline.py")
        plan = m.preparation_invocation_plan(self.phase(), "adapter.py", "deadline.py")
        self.assertEqual(900, plan["outer_seconds"])
        self.assertEqual(["--timeout-seconds", "900"], plan["argv"][2:4])
        self.assertEqual("prepare", plan["argv"][-1])
        with self.assertRaisesRegex(RuntimeError, "baseline"):
            m.preparation_invocation_plan(self.phase("baseline-read"), "adapter.py", "deadline.py")
    def test_build_failure_prevents_install(self):
        for failure in ("build", "build-nonzero", "build-expired", "build-cancelled", "build-no-runner"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                self.evidence = pathlib.Path(directory)
                self.external.now, self.external.cancelled = 0, False
                self.tools.failure = failure
                with self.assertRaises(RuntimeError):
                    self.prepare()
                self.assertTrue((self.evidence / "prepare-start.json").is_file())
                self.assertFalse((self.evidence / "prepare.json").exists())
                with self.assertRaises(Exception):
                    self.run_phase()
                self.assertNotIn("install", self.tools.events)
                self.assertNotIn("launch", self.tools.events)
    def test_install_failure_prevents_launch(self):
        self.assert_failure("install")
        self.assertNotIn("launch", self.tools.events)
    def test_preexisting_runner_prevents_install(self):
        self.assert_failure("preexisting")
        self.assertEqual(0, self.tools.installs)
    def test_container_query_failure_retains_original_exit(self):
        self.assert_failure("container-query")
        self.assertEqual(7, m.read_json(self.evidence / "baseline-write-app-container-command.json")["exit"])
        self.assertNotIn("launch", self.tools.events)
    def test_foreign_container_refused(self):
        self.assert_failure("foreign-container")
    def test_traversal_container_refused(self):
        self.assert_failure("container-dotdot")
    def test_installed_bundle_mismatch_refused(self):
        self.assert_failure("installed-bundle")
        self.assertNotIn("launch", self.tools.events)
    def test_failed_launch_retains_streams(self):
        self.assert_failure("launch")
        self.assertEqual(b"launch diagnostic", (self.evidence / "baseline-write-launch.stderr.log").read_bytes())
        self.assertTrue(self.tools.reader.closed)
    def test_discovery_failure_probes_live_before_reader_close(self):
        self.assert_failure("discovery")
        self.assertLess(self.tools.events.index("live-probe"), self.tools.events.index("reader-close"))
        self.assertNotIn("terminate", self.tools.events)
    def test_nonloopback_auth_identity_refused(self):
        self.assert_failure("bad-uri")
        self.assertNotIn("drive", self.tools.events)
    def test_vm_pid_mismatch_refused(self):
        self.assert_failure("wrong-vm")
    def test_driver_nonzero_not_completed(self):
        self.assert_failure("driver")
        self.assertNotIn("terminate", self.tools.events)
    def test_missing_selected_marker_not_completed(self):
        self.assert_failure("missing-marker")
    def test_missing_receipt_not_completed(self):
        self.assert_failure("missing-receipt")
    def test_receipt_source_pid_test_schema_phase_mutations(self):
        for field, value in (("source_sha", "0" * 40), ("pid", 777), ("selected_test", "other"),
                             ("schema", "future"), ("phase", "read"), ("previous_pid", 1), ("phase_index", True)):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                original = self.evidence
                self.evidence = pathlib.Path(directory)
                for name in ("prepare-start.json", "prepare.json", "prepared-bundle.json"):
                    (self.evidence / name).write_bytes((original / name).read_bytes())
                self.external.receipt_mutation = lambda r, f=field, v=value: r.update({f: v})
                with self.assertRaises(RuntimeError):
                    self.run_phase()
                self.assertFalse((self.evidence / "baseline-write-transport.json").exists())
                self.evidence = original
    def test_corrupt_retained_screenshot_refused(self):
        self.assert_failure("corrupt-image")
    def test_timeout_after_driver_cannot_late_terminate(self):
        self.assert_failure("expired-driver")
        self.assertNotIn("terminate", self.tools.events)
        self.assertTrue(self.tools.reader.closed)
    def test_cancel_after_driver_cannot_late_terminate(self):
        self.assert_failure("cancelled-driver")
        self.assertNotIn("terminate", self.tools.events)
    def test_expired_reader_still_owned_cleanup(self):
        self.assert_failure("expired-reader")
        self.assertTrue(self.tools.reader.closed)
        self.assertNotIn("launch", self.tools.events)
    def test_probe_failure_does_not_replace_driver_error(self):
        self.tools.failure = "probe"
        with self.assertRaisesRegex(RuntimeError, "Future driver failed"):
            self.run_phase()
        self.assertTrue((self.evidence / "baseline-write-probe-failure.json").exists())
    def test_late_log_conflict_refused(self):
        self.assert_failure("late-log")
    def test_cleanup_error_refused(self):
        self.assert_failure("cleanup")
    def test_still_live_refused(self):
        self.assert_failure("still-live")
    def test_post_phase_bundle_refused(self):
        self.assert_failure("post-bundle")
    def test_post_phase_container_replacement_refused(self):
        self.assert_failure("post-container")
    def test_next_phase_container_inode_replacement_refused(self):
        self.run_phase()
        self.external.identity_changed = True
        with self.assertRaisesRegex(RuntimeError, "relocated"):
            self.run_phase("baseline-read")
        self.assertEqual(1, self.tools.installs)
    def test_reused_pid_refused(self):
        self.assert_failure("reused-pid", after_first=True)
    def test_stale_later_proof_refused(self):
        m.save(self.evidence / "legacy-read.json", {})  # Not an allowlisted future phase: harmless unrelated evidence.
        m.save(self.evidence / "restored-read.json", {})
        with self.assertRaisesRegex(RuntimeError, "Current/later"):
            self.run_phase()
    def test_previous_incomplete_transport_refused(self):
        self.run_phase()
        path = self.evidence / "baseline-write-transport.json"
        record = m.read_json(path)
        record["transport_complete"] = False
        path.write_text(json.dumps(record))
        with self.assertRaisesRegex(RuntimeError, "Earlier transport"):
            self.run_phase("baseline-read")
    def test_first_install_proof_cannot_be_relabelled(self):
        self.run_phase()
        path = self.evidence / "baseline-write-install.json"
        record = m.read_json(path)
        record["exit_code"] = 1
        path.write_text(json.dumps(record))
        with self.assertRaisesRegex(RuntimeError, "installation proof"):
            self.run_phase("baseline-read")
    def test_earlier_bundle_record_tamper_refused(self):
        self.run_phase()
        path = self.evidence / "baseline-write-transport.json"
        record = m.read_json(path)
        record["bundle_manifest_sha256"] = "0" * 64
        path.write_text(json.dumps(record))
        with self.assertRaisesRegex(RuntimeError, "Earlier transport bundle"):
            self.run_phase("baseline-read")
    def test_earlier_container_record_tamper_refused(self):
        self.run_phase()
        path = self.evidence / "baseline-write-transport.json"
        record = m.read_json(path)
        record["containers"]["data"]["inode"] = 999
        path.write_text(json.dumps(record))
        with self.assertRaisesRegex(RuntimeError, "Earlier container identity"):
            self.run_phase("baseline-read")
    def test_prior_receipt_bytes_changed_refused(self):
        self.run_phase()
        path = self.evidence / "baseline-write.json"
        path.write_bytes(path.read_bytes() + b" ")
        with self.assertRaisesRegex(RuntimeError, "Earlier receipt bytes"):
            self.run_phase("baseline-read")
    def test_prior_screenshot_bytes_changed_refused(self):
        self.run_phase()
        path = self.evidence / "baseline-write-future.png"
        path.write_bytes(path.read_bytes() + b"changed")
        with self.assertRaisesRegex(RuntimeError, "Screenshot identity"):
            self.run_phase("baseline-read")
    def test_prelaunch_hook_failure_prevents_launch(self):
        self.assert_failure("hook-failure")
        self.assertNotIn("launch", self.tools.events)
    def test_prelaunch_hook_source_refused(self):
        self.assert_failure("hook-wrong-source")
    def test_prelaunch_hook_retained_raw_change_refused(self):
        self.assert_failure("hook-raw-change")
    def test_prelaunch_hook_container_replacement_refused(self):
        self.assert_failure("hook-container")
        self.assertNotIn("reader-start", self.tools.events)
    def test_prelaunch_hook_bundle_replacement_refused(self):
        self.assert_failure("hook-bundle")
        self.assertNotIn("reader-start", self.tools.events)
    def test_prelaunch_hook_runner_appearance_refused(self):
        self.assert_failure("hook-runner")
        self.assertNotIn("launch", self.tools.events)
    def test_prelaunch_hook_expiry_refused(self):
        self.assert_failure("hook-expired")
        self.assertNotIn("launch", self.tools.events)
    def test_duplicate_proof_keys_refused(self):
        path = self.evidence / "duplicate.json"
        path.write_text('{"pid":1,"pid":2}')
        with self.assertRaisesRegex(RuntimeError, "Duplicate"):
            m.read_json(path)

    def test_runtime_missing_preparation_cannot_build_or_install(self):
        (self.evidence / "prepare.json").unlink()
        with self.assertRaises(Exception):
            self.run_phase()
        self.assertEqual(1, len(self.external.builds))
        self.assertNotIn("install", self.tools.events)
        self.assertNotIn("launch", self.tools.events)

    def test_preparation_cannot_run_twice_or_from_later_phase(self):
        with self.assertRaisesRegex(RuntimeError, "already exists"):
            self.prepare()
        with self.assertRaisesRegex(RuntimeError, "baseline"):
            m.prepare_build(self.phase("baseline-read"), self.tools, self.external)
        self.assertEqual(1, len(self.external.builds))

    def test_runtime_rejects_changed_preparation_before_install(self):
        start_path, final_path = self.evidence / "prepare-start.json", self.evidence / "prepare.json"
        original_start, original_final = start_path.read_bytes(), final_path.read_bytes()
        mutations = [("source_sha", "0" * 40), ("run_nonce", "123-2"), ("simulator", "other"),
                     ("target", "other.dart"), ("argv", ["flutter", "wrong"]), ("source_files", {}),
                     ("host_pid", True), ("timeout_seconds", 901), ("status", "failed"),
                     ("exit_code", 1), ("build_completed", False), ("elapsed_seconds", float("inf")),
                     ("elapsed_seconds", 900), ("bundle_manifest_sha256", "0" * 64)]
        for key, value in mutations:
            with self.subTest(key=key, value=value):
                start = json.loads(original_start)
                final = json.loads(original_final)
                if key in start and key not in ("status", "build_completed"):
                    start[key] = value
                final[key] = value
                start_path.write_text(json.dumps(start), encoding="utf-8")
                final_path.write_text(json.dumps(final), encoding="utf-8")
                with self.assertRaises(Exception):
                    self.run_phase()
                self.assertNotIn("install", self.tools.events)
                self.assertNotIn("launch", self.tools.events)
        start_path.write_bytes(original_start)
        final_path.write_bytes(original_final)

    def test_preparation_manifest_and_application_tamper_cannot_launch(self):
        path = self.evidence / "prepared-bundle.json"
        original = path.read_bytes()
        path.write_bytes(original + b" ")
        with self.assertRaisesRegex(RuntimeError, "bundle changed"):
            self.run_phase()
        path.write_bytes(original)
        (self.app / "build/ios/iphonesimulator/Runner.app/Runner").write_bytes(b"changed")
        with self.assertRaisesRegex(RuntimeError, "bundle changed"):
            self.run_phase()
        self.assertNotIn("install", self.tools.events)
        self.assertNotIn("launch", self.tools.events)

    def test_runtime_budget_starts_after_long_preparation(self):
        self.evidence = self.evidence / "long-build"
        self.evidence.mkdir()
        self.external.build_elapsed = 899
        prepared = self.prepare()
        self.assertEqual(899, prepared["elapsed_seconds"])
        record = self.run_phase()
        self.assertTrue(record["transport_complete"])
        self.assertEqual(240, self.external.drives[0][3])
        self.assertEqual(record["preparation_sha256"], m.sha((self.evidence / "prepare.json").read_bytes()))
        launch = m.read_json(self.evidence / "baseline-write-launch.json")
        self.assertEqual(record["preparation_sha256"], launch["preparation_sha256"])

    def test_launch_binds_exact_discovery_start_timestamp(self):
        started = datetime.datetime(2026, 10, 1, 0, 1, 2, 345678, tzinfo=datetime.timezone.utc)
        self.tools.utc_now = lambda: started
        self.run_phase()
        launch = m.read_json(self.evidence / "baseline-write-launch.json")
        self.assertEqual(started.isoformat(), launch["launch_started_at"])
        self.assertEqual(started, self.tools.discovery_started_at)

    def test_prior_transport_cannot_rebind_preparation(self):
        self.run_phase()
        path = self.evidence / "baseline-write-transport.json"
        record = m.read_json(path)
        record["preparation_sha256"] = "0" * 64
        path.write_text(json.dumps(record), encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "Earlier preparation"):
            self.run_phase("baseline-read")
        self.assertEqual(1, self.tools.installs)

    def test_changed_or_invalid_sdk_refuses_before_install(self):
        for key, value in (("dart_sha256", "e" * 64), ("dart", "/unrelated/dart"),
                           ("framework_revision", "f" * 40), ("dart_version", "3.12.3")):
            with self.subTest(key=key):
                self.tools.sdk = {**SDK, key: value}
                with self.assertRaises(RuntimeError):
                    self.run_phase()
                self.assertNotIn("install", self.tools.events)
                self.assertNotIn("launch", self.tools.events)

    def test_prepared_sdk_identity_and_prior_phase_sdk_are_bound(self):
        start_path = self.evidence / "prepare-start.json"
        start = m.read_json(start_path)
        start["driver_sdk"]["dart_sha256"] = "e" * 64
        start_path.write_text(json.dumps(start), encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "Preparation start/terminal"):
            self.run_phase()
        self.assertNotIn("install", self.tools.events)
        start["driver_sdk"] = dict(SDK)
        start_path.write_text(json.dumps(start), encoding="utf-8")
        self.run_phase()
        path = self.evidence / "baseline-write-transport.json"
        record = m.read_json(path); record["driver_sdk"]["dart_sha256"] = "e" * 64
        path.write_text(json.dumps(record), encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "Earlier driver SDK"):
            self.run_phase("baseline-read")
        self.assertEqual(1, self.tools.installs)


if __name__ == "__main__":
    unittest.main(verbosity=2)
