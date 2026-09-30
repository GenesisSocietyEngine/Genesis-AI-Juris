#!/usr/bin/env python3
"""Portable controls; actual simctl console proof still requires macOS CI."""
import importlib.util
import io
import json
import os
import pathlib
import queue
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import Mock, patch
from types import SimpleNamespace

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("tax_phase", pathlib.Path(__file__).with_name("run_ios_tax_phase.py"))
phase = importlib.util.module_from_spec(spec)
spec.loader.exec_module(phase)
URI = "http://127.0.0.1:43210/a_b-C=+/".replace("+", "")


class IdentityTests(unittest.TestCase):
    def test_full_authenticated_uri_before_pid(self):
        identity = phase.ConsoleIdentity()
        identity.line("flutter: The Dart VM service is listening on " + URI)
        self.assertIsNone(identity.pid)
        identity.line(phase.APP + ": 123")
        self.assertEqual((identity.pid, identity.uri), (123, URI))

    def test_reject_missing_auth_and_unsafe_or_ambiguous_uri(self):
        for uri in ("http://127.0.0.1:43210/", "https://127.0.0.1:43210/token/",
                    "http://example.com:43210/token/", "http://127.0.0.1:43210/token/?x=1",
                    "http://user@127.0.0.1:43210/token/", "http://127.0.0.1:43210/token/#a",
                    "http://127.0.0.1:43210/token/ extra", "http://127.0.0.1:43210/../",
                    "http://127.0.0.1:0/token/", "http://127.0.0.1:65536/token/"):
            with self.subTest(uri=uri), self.assertRaises((RuntimeError, ValueError)):
                phase.authenticated_uri(uri)

    def test_duplicate_identity_fails(self):
        identity = phase.ConsoleIdentity()
        identity.line(phase.APP + ": 123")
        with self.assertRaisesRegex(RuntimeError, "Duplicate"):
            identity.line(phase.APP + ": 124")
        identity.line("The Dart VM service is listening on " + URI)
        with self.assertRaisesRegex(RuntimeError, "Duplicate"):
            identity.line("The Dart VM service is listening on " + URI)

    def test_receipt_must_match_fresh_phase_source_nonce_pid(self):
        receipt = {"schema": "tax-mobile-application-acceptance-v2", "phase": "write",
                   "completed_phase": "write", "source_sha": "a" * 40,
                   "run_nonce": "12-1", "pid": 123, "selected_test": phase.TEST}
        phase.validate_receipt(receipt, "write", "a" * 40, "12-1", 123)
        for key, bad in (("pid", 124), ("pid", True), ("phase", "read"),
                         ("source_sha", "b" * 40), ("run_nonce", "12-2"),
                         ("selected_test", "not selected")):
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                phase.validate_receipt({**receipt, key: bad}, "write", "a" * 40, "12-1", 123)

    def test_manifest_detects_changed_assets_and_symlink_target(self):
        with tempfile.TemporaryDirectory() as temp:
            bundle = pathlib.Path(temp)
            (bundle / "Runner").write_bytes(b"executable")
            (bundle / "assets").mkdir()
            (bundle / "assets/data").write_bytes(b"first")
            first = phase.manifest(bundle)
            self.assertEqual(first, phase.manifest(bundle))
            (bundle / "assets/data").write_bytes(b"second")
            self.assertNotEqual(first, phase.manifest(bundle))


class ConsoleTests(unittest.TestCase):
    def child(self, code, directory):
        return phase.Console([sys.executable, "-I", "-u", "-c", code], pathlib.Path(directory) / "console.log")

    def test_chunked_crlf_console_and_real_child_cleanup(self):
        code = ("import sys,time;sys.stdout.write('flutter: The Dart VM service is listen');sys.stdout.flush();"
                "time.sleep(.05);sys.stdout.write('ing on " + URI + "\\r\\n" + phase.APP + ": 123\\r\\n');"
                "sys.stdout.flush();time.sleep(30)")
        with tempfile.TemporaryDirectory() as temp:
            console = self.child(code, temp)
            try:
                result = console.identity(seconds=2)
                self.assertEqual((result.pid, result.uri), (123, URI))
                self.assertIsNone(console.process.poll())
            finally:
                console.close()
            self.assertIsNotNone(console.process.poll())
            retained = (pathlib.Path(temp) / "console.log").read_bytes()
            self.assertIn(b"\r\n", retained)

    def test_stale_console_file_rejected_before_child_creation(self):
        with tempfile.TemporaryDirectory() as temp:
            output = pathlib.Path(temp) / "console.log"
            output.write_text("The Dart VM service is listening on " + URI)
            with patch.object(phase.subprocess, "Popen") as create, self.assertRaisesRegex(RuntimeError, "already exists"):
                phase.Console(["must-not-start"], output)
            create.assert_not_called()

    def test_console_exit_cannot_count_as_attachment(self):
        with tempfile.TemporaryDirectory() as temp:
            console = self.child("print('launch failed')", temp)
            try:
                with self.assertRaisesRegex(RuntimeError, "closed"):
                    console.identity(seconds=2)
            finally:
                console.close()

    def test_real_hung_console_is_bounded_and_prior_proof_untouched(self):
        with tempfile.TemporaryDirectory() as temp:
            proof = pathlib.Path(temp) / "prior.json"
            proof.write_bytes(b'{"prior":"unchanged"}')
            started = time.monotonic()
            console = self.child("import time;time.sleep(30)", temp)
            try:
                with self.assertRaisesRegex(RuntimeError, "timed out"):
                    console.identity(seconds=.15)
            finally:
                console.close()
            self.assertLess(time.monotonic() - started, 5)
            self.assertIsNotNone(console.process.poll())
            self.assertEqual(proof.read_bytes(), b'{"prior":"unchanged"}')
            self.assertFalse((pathlib.Path(temp) / "write.json").exists())

    def test_cleanup_failure_remains_explicit(self):
        console = object.__new__(phase.Console)
        console.process = Mock()
        console.process.poll.return_value = None
        console.process.terminate.side_effect = PermissionError("denied")
        console.thread = Mock()
        with self.assertRaises(PermissionError):
            console.close()
        console.process.kill.assert_not_called()

    def test_post_identity_duplicate_and_late_reader_error_fail(self):
        console = object.__new__(phase.Console)
        console.process = Mock()
        console.process.poll.return_value = None
        console.events = queue.Queue()
        console.parser = phase.ConsoleIdentity()
        console.parser.line(phase.APP + ": 123")
        console.parser.line("The Dart VM service is listening on " + URI)
        console.events.put("The Dart VM service is listening on " + URI)
        with self.assertRaisesRegex(RuntimeError, "Duplicate"):
            console.ensure_live()
        console.process.poll.return_value = 0
        console.thread = Mock()
        console.thread.is_alive.return_value = False
        console.events.put(UnicodeError("late malformed console"))
        with self.assertRaisesRegex(UnicodeError, "late malformed"):
            console.close()


class PhaseLifecycleTests(unittest.TestCase):
    def exercise(self, driver_mode="success", preexisting=False):
        with tempfile.TemporaryDirectory() as temp:
            home = pathlib.Path(temp).resolve()
            evidence = home / "evidence"
            evidence.mkdir()
            bundle = home / "build/ios/iphonesimulator/Runner.app"
            bundle.mkdir(parents=True)
            (bundle / "Runner").write_bytes(b"one-compiled-source")
            device = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE"
            installed = home / "Library/Developer/CoreSimulator/Devices" / device / "data/Containers/Bundle/Application/owned/Runner.app"
            installed.mkdir(parents=True)
            (installed / "Runner").write_bytes(b"one-compiled-source")
            args = SimpleNamespace(phase="write", device=device, evidence=evidence, source="a" * 40, nonce="12-1")
            console = Mock()
            console.process.pid = 456
            console.identity.return_value = SimpleNamespace(pid=123, uri=URI)
            commands = []
            driver_commands = []

            def native_command(command, **options):
                commands.append(command)
                if command[:2] == ["ps", "-axo"]:
                    output = f"123 {installed.as_posix()}/Runner\n".encode() if preexisting else b""
                elif command[:3] == ["xcrun", "simctl", "get_app_container"]:
                    output = str(installed).encode()
                else:
                    output = b""
                return subprocess.CompletedProcess(command, 0, output, b"")

            def driver(command, **options):
                driver_commands.append(command)
                if command[:2] == ["flutter", "drive"]:
                    if driver_mode == "failed":
                        raise subprocess.CalledProcessError(2, command)
                    if driver_mode != "missing":
                        receipt = {"schema": "tax-mobile-application-acceptance-v2", "phase": "write",
                                   "completed_phase": "write", "source_sha": args.source,
                                   "run_nonce": args.nonce, "pid": 124 if driver_mode == "wrong-pid" else 123,
                                   "selected_test": phase.TEST}
                        phase.write_json(evidence / "write.json", receipt)
                return subprocess.CompletedProcess(command, 0)

            previous = pathlib.Path.cwd()
            os.chdir(home)
            try:
                with patch.object(phase.pathlib.Path, "home", return_value=home), \
                     patch.object(phase, "command", side_effect=native_command), \
                     patch.object(phase.subprocess, "run", side_effect=driver), \
                     patch.object(phase, "Console", return_value=console), \
                     patch.object(phase, "process_matches", return_value=b"123 exact-owned-executable\n"), \
                     patch.object(phase, "vm_identity", return_value={"result": {"type": "VM", "pid": 123}}), \
                     patch.object(phase, "stopped") as absent:
                    if driver_mode != "success" or preexisting:
                        with self.assertRaises((RuntimeError, FileNotFoundError, subprocess.CalledProcessError)):
                            phase.run(args)
                        absent.assert_not_called()
                        self.assertFalse(any(cmd[:3] == ["xcrun", "simctl", "terminate"] for cmd in commands))
                        launch_file = evidence / "write-launch.json"
                        if launch_file.exists():
                            self.assertFalse(json.loads(launch_file.read_text())["complete"])
                    else:
                        phase.run(args)
                        absent.assert_called_once_with(123)
                        self.assertTrue(json.loads((evidence / "write-launch.json").read_text())["complete"])
                        log = (evidence / "process.log").read_text()
                        self.assertLess(log.index("driver_exit=0"), log.index("event=terminate"))
                        self.assertLess(log.index("event=terminate"), log.index("event=process_absent"))
                        self.assertEqual(driver_commands[0][:7], ["flutter", "build", "ios", "--verbose", "--simulator", "--debug", "--no-pub"])
                        for command in driver_commands:
                            self.assertIn("--target=" + phase.TARGET, command)
                            self.assertIn("--dart-define=JURIS_ACCEPTANCE_SOURCE_SHA=" + args.source, command)
                            self.assertIn("--dart-define=JURIS_ACCEPTANCE_RUN_NONCE=" + args.nonce, command)
                        self.assertIn("--use-existing-app=" + URI, driver_commands[1])
            finally:
                os.chdir(previous)

    def test_success_binds_receipt_and_actual_termination_order(self):
        self.exercise()

    def test_failed_missing_or_wrong_pid_driver_never_completes(self):
        for mode in ("failed", "missing", "wrong-pid"):
            with self.subTest(mode=mode):
                self.exercise(mode)

    def test_existing_isolated_runner_is_rejected(self):
        self.exercise(preexisting=True)


class VmAndProcessTests(unittest.TestCase):
    def response(self, value):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.status = 200
        response.url = URI + "getVM"
        response.read.return_value = json.dumps(value).encode()
        return response

    def test_vm_pid_and_complete_rpc_identity_are_required(self):
        good = {"jsonrpc": "2.0", "result": {"type": "VM", "pid": 123}}
        for value, accepted in ((good, True), ({**good, "error": {}}, False),
                                ({"result": {"type": "VM", "pid": 123}}, False),
                                ({**good, "result": {"type": "VM", "pid": 124}}, False),
                                ({**good, "result": {"type": "VM", "pid": True}}, False)):
            opener = Mock()
            opener.open.return_value = self.response(value)
            with patch.object(phase.urllib.request, "build_opener", return_value=opener):
                if accepted:
                    self.assertEqual(phase.vm_identity(URI, 123), good)
                else:
                    with self.assertRaises(RuntimeError):
                        phase.vm_identity(URI, 123)
            opener.open.assert_called_once_with(URI + "getVM", timeout=10)

    def test_redirect_and_network_failure_do_not_attach(self):
        with self.assertRaisesRegex(RuntimeError, "redirects"):
            phase.NoRedirect().redirect_request(None, None, 302, "redirect", {}, "http://elsewhere/")
        opener = Mock()
        opener.open.side_effect = TimeoutError("read-only VM probe timeout")
        with patch.object(phase.urllib.request, "build_opener", return_value=opener), self.assertRaises(TimeoutError):
            phase.vm_identity(URI, 123)

    def test_exact_process_path_required(self):
        expected = pathlib.PurePosixPath("/isolated/Runner.app/Runner")
        for output, accepted in ((b"123 /isolated/Runner.app/Runner\n", True),
                                 (b"123 /other/Runner.app/Runner\n", False),
                                 (b"124 /isolated/Runner.app/Runner\n", False)):
            result = subprocess.CompletedProcess([], 0, output, b"")
            with patch.object(phase, "command", return_value=result):
                if accepted:
                    phase.process_matches(123, expected)
                else:
                    with self.assertRaises(RuntimeError):
                        phase.process_matches(123, expected)

    def test_unknown_process_state_is_not_absence(self):
        denied = subprocess.CompletedProcess([], 2, b"", b"denied")
        with patch.object(phase, "command", return_value=denied), self.assertRaisesRegex(RuntimeError, "establish"):
            phase.stopped(123, seconds=.1)
        absent = subprocess.CompletedProcess([], 1, b"", b"")
        with patch.object(phase, "command", return_value=absent):
            phase.stopped(123, seconds=.1)


if __name__ == "__main__":
    unittest.main()
