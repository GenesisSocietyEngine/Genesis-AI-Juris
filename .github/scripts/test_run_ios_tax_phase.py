#!/usr/bin/env python3
"""Portable controls; actual authenticated system-log proof requires macOS CI."""
import datetime
import importlib.util
import io
import json
import os
import pathlib
import queue
import runpy
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
EXE = "/isolated/Runner.app/Runner"


def log_event(**changes):
    return {"eventType": "logEvent", "processID": 123, "processImagePath": EXE,
            "machTimestamp": 1619938003043, "traceID": 9249785742145093636,
            "threadID": 107329, "senderProgramCounter": 6149920,
            "processImageUUID": "11111111-1111-4111-8111-111111111111",
            "senderImageUUID": "22222222-2222-4222-8222-222222222222",
            "senderImagePath": "/isolated/Runner.app/Frameworks/Flutter.framework/Flutter",
            "bootUUID": "",
            "timestamp": (phase.utc_now() - datetime.timedelta(seconds=1)).isoformat(),
            "eventMessage": "The Dart VM service is listening on " + URI, **changes}


def log_identity():
    return phase.LogIdentity(123, EXE, phase.utc_now() - datetime.timedelta(seconds=2))


class IdentityTests(unittest.TestCase):
    def observed_views(self):
        fixture = pathlib.Path(__file__).parent / "fixtures/ios_vm_announcement_views.json"
        return json.loads(fixture.read_text())["views"]

    def test_observed_two_views_deduplicate_by_exact_os_identity_in_both_orders(self):
        views = self.observed_views()
        dates = [datetime.datetime.fromisoformat(item["event"]["timestamp"]) for item in views]
        self.assertEqual(abs(dates[0] - dates[1]), datetime.timedelta(microseconds=478788))
        start = datetime.datetime.fromisoformat("2026-09-30T20:05:34+00:00")
        now = datetime.datetime.fromisoformat("2026-09-30T20:05:40+00:00")
        for ordered in (views, list(reversed(views))):
            with self.subTest(order=[item["origin"] for item in ordered]), \
                    patch.object(phase, "utc_now", return_value=now):
                identity = phase.LogIdentity(123, EXE, start)
                for item in ordered:
                    identity.observe(item["event"], item["origin"])
                identity.observe(ordered[0]["event"], ordered[0]["origin"])
                self.assertEqual(identity.uri, URI)
                self.assertEqual(identity.observations, ordered)
                self.assertEqual(identity.boot_uuid, "33333333-3333-4333-8333-333333333333")

    def test_observed_duplicate_rejects_conflicting_or_untyped_identity(self):
        views = self.observed_views()
        first, second = views[0]["event"], views[1]["event"]
        changes = [
            {"machTimestamp": first["machTimestamp"] + 1},
            {"traceID": first["traceID"] + 1},
            {"threadID": first["threadID"] + 1},
            {"senderProgramCounter": first["senderProgramCounter"] + 1},
            {"machTimestamp": float(first["machTimestamp"])},
            {"traceID": str(first["traceID"])},
            {"traceID": True},
            {"machTimestamp": 0},
            {"traceID": 2**64},
            {"senderImageUUID": "44444444-4444-4444-8444-444444444444"},
            {"processImageUUID": "44444444-4444-4444-8444-444444444444"},
            {"senderImagePath": "/another/Flutter"},
            {"processID": 124},
            {"processImagePath": "/another/Runner.app/Runner"},
            {"eventMessage": second["eventMessage"].replace("43210", "43211")},
            {"timestamp": "2020-01-01T00:00:00+00:00"},
            {"bootUUID": "44444444-4444-4444-8444-444444444444"},
        ]
        start = datetime.datetime.fromisoformat("2026-09-30T20:05:34+00:00")
        now = datetime.datetime.fromisoformat("2026-09-30T20:05:40+00:00")
        for change in changes:
            with self.subTest(change=change), patch.object(phase, "utc_now", return_value=now):
                identity = phase.LogIdentity(123, EXE, start)
                identity.observe({**first, "bootUUID": second["bootUUID"]}, "stream")
                with self.assertRaises(RuntimeError):
                    identity.observe({**second, **change}, "backfill")

    def test_full_authenticated_uri_from_exact_fresh_system_event(self):
        identity = log_identity()
        event = log_event()
        identity.observe(event, "stream")
        identity.observe(event, "backfill")
        self.assertEqual((identity.pid, identity.uri), (123, URI))
        self.assertEqual(identity.origins, ["stream", "backfill"])

    def test_metadata_only_backfill_difference_keeps_both_whole_records(self):
        identity = log_identity()
        event = log_event(activityIdentifier=1)
        retrospective = {**event, "activityIdentifier": 2, "source": "retrospective"}
        identity.observe(event, "stream")
        identity.observe(retrospective, "backfill")
        self.assertEqual(identity.uri, URI)
        self.assertEqual(identity.observations, [{"origin": "stream", "event": event},
                                              {"origin": "backfill", "event": retrospective}])

    def test_reject_missing_auth_and_unsafe_or_ambiguous_uri(self):
        for uri in ("http://127.0.0.1:43210/", "https://127.0.0.1:43210/token/",
                    "http://example.com:43210/token/", "http://127.0.0.1:43210/token/?x=1",
                    "http://user@127.0.0.1:43210/token/", "http://127.0.0.1:43210/token/#a",
                    "http://127.0.0.1:43210/token/ extra", "http://127.0.0.1:43210/../",
                    "http://127.0.0.1:0/token/", "http://127.0.0.1:65536/token/"):
            with self.subTest(uri=uri), self.assertRaises((RuntimeError, ValueError)):
                phase.authenticated_uri(uri)

    def test_wrong_pid_path_time_or_conflicting_announcement_fails(self):
        for changes in ({"processID": 124}, {"processID": True}, {"processImagePath": "/other/Runner"},
                        {"eventType": "activityCreateEvent"}, {"timestamp": "2020-01-01T00:00:00+00:00"},
                        {"timestamp": "2999-01-01T00:00:00+00:00"}, {"timestamp": "2026-09-30T01:00:00"}):
            with self.subTest(changes=changes), self.assertRaises(RuntimeError):
                log_identity().observe(log_event(**changes), "stream")
        identity = log_identity()
        event = log_event()
        identity.observe(event, "stream")
        with self.assertRaisesRegex(RuntimeError, "Ambiguous"):
            identity.observe({**event, "eventMessage": event["eventMessage"].replace("43210", "43211")}, "backfill")

    def test_ordinary_launch_requires_one_exact_pid(self):
        for output, code in ((phase.APP + ": 123\n", 0), (phase.APP + ": 123\n", 1),
                             (phase.APP + ": 123\n" + phase.APP + ": 124\n", 0), ("other: 123", 0)):
            result = subprocess.CompletedProcess([], code, output.encode(), b"")
            if output == phase.APP + ": 123\n" and code == 0:
                self.assertEqual(phase.launch_pid(result), 123)
            else:
                with self.assertRaises(RuntimeError):
                    phase.launch_pid(result)

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


class SystemLogTests(unittest.TestCase):
    def child(self, code, directory):
        return phase.LogReader([sys.executable, "-I", "-u", "-c", code], pathlib.Path(directory) / "system.log")

    def test_multiline_array_and_object_stream_with_escaped_strings(self):
        event = log_event(extra="brace } and escaped \" quote\nand next line")
        for raw in (json.dumps([event], indent=2), json.dumps(event, indent=2),
                    "Filtering the log data using predicate\n[" + json.dumps(event) + "]"):
            parser = phase.JsonLogObjects()
            records = []
            for char in raw:
                records.extend(parser.feed(char))
            records.extend(parser.feed("", final=True))
            self.assertEqual(records, [event])

    def test_duplicate_keys_malformed_and_truncated_records_fail(self):
        for raw in ('{"processID":123,"processID":124}', '[{"eventMessage":"truncated',
                    '[,{}]', '[{},]', '[{}{}]', '{"eventMessage":invalid}', '{} garbage'):
            with self.subTest(raw=raw), self.assertRaises(RuntimeError):
                phase.JsonLogObjects().feed(raw, final=True)

    def test_real_chunked_reader_and_separate_stderr_cleanup(self):
        payload = json.dumps(log_event(), indent=2)
        code = ("import sys,time;value=" + repr(payload) + ";sys.stdout.write(value[:20]);sys.stdout.flush();"
                "time.sleep(.05);sys.stdout.write(value[20:]);sys.stdout.flush();"
                "sys.stderr.write('diagnostic only\\n');sys.stderr.flush();time.sleep(30)")
        with tempfile.TemporaryDirectory() as temp:
            reader = self.child(code, temp)
            identity = log_identity()
            output = pathlib.Path(temp) / "events.jsonl"
            try:
                deadline = time.monotonic() + 2
                while identity.uri is None and time.monotonic() < deadline:
                    reader.drain(identity, output)
                    time.sleep(.01)
                self.assertEqual(identity.uri, URI)
                self.assertIsNone(reader.process.poll())
            finally:
                reader.close()
                reader.drain(identity, output, closing=True)
            self.assertIsNotNone(reader.process.poll())
            self.assertEqual((pathlib.Path(temp) / "system.log").read_text(), payload)
            self.assertEqual((pathlib.Path(temp) / "system.stderr.log").read_text(), "diagnostic only\n")
            self.assertIn("arrival_utc", json.loads(output.read_text()))

    def test_stale_log_file_rejected_before_child_creation(self):
        with tempfile.TemporaryDirectory() as temp:
            output = pathlib.Path(temp) / "system.log"
            output.write_text("The Dart VM service is listening on " + URI)
            with patch.object(phase.subprocess, "Popen") as create, self.assertRaisesRegex(RuntimeError, "already exists"):
                phase.LogReader(["must-not-start"], output)
            create.assert_not_called()

    def test_reader_exit_cannot_count_as_attachment(self):
        with tempfile.TemporaryDirectory() as temp:
            reader = self.child("pass", temp)
            try:
                reader.process.wait(timeout=2)
                with self.assertRaisesRegex(RuntimeError, "exited"):
                    reader.drain(log_identity(), pathlib.Path(temp) / "events.jsonl")
            finally:
                reader.close()

    def test_real_hung_reader_discovery_is_bounded_and_prior_proof_untouched(self):
        with tempfile.TemporaryDirectory() as temp:
            proof = pathlib.Path(temp) / "prior.json"
            proof.write_bytes(b'{"prior":"unchanged"}')
            started = time.monotonic()
            reader = self.child("import time;time.sleep(30)", temp)
            args = SimpleNamespace(phase="write", device="isolated")
            try:
                result = subprocess.CompletedProcess([], 0, b"[]", b"")
                with patch.object(phase, "command", return_value=result), self.assertRaisesRegex(RuntimeError, "timed out"):
                    phase.discover(reader, log_identity(), args, pathlib.Path(temp), seconds=.15)
            finally:
                reader.close()
            self.assertLess(time.monotonic() - started, 5)
            self.assertIsNotNone(reader.process.poll())
            self.assertEqual(proof.read_bytes(), b'{"prior":"unchanged"}')
            self.assertFalse((pathlib.Path(temp) / "write.json").exists())

    def test_cleanup_failure_remains_explicit(self):
        reader = object.__new__(phase.LogReader)
        reader.process = Mock()
        reader.process.poll.return_value = None
        reader.process.terminate.side_effect = PermissionError("denied")
        with self.assertRaises(PermissionError):
            reader.close()
        reader.process.kill.assert_not_called()

    def test_late_error_cannot_complete_after_reader_cleanup(self):
        reader = object.__new__(phase.LogReader)
        reader.events = queue.Queue()
        reader.events.put(UnicodeError("late malformed log"))
        with self.assertRaisesRegex(UnicodeError, "late malformed"):
            reader.drain(log_identity(), pathlib.Path("unused"), closing=True)

    def test_backfill_covers_stream_race_and_timeout_keeps_valid_stream(self):
        for timeout in (False, True):
            with self.subTest(timeout=timeout), tempfile.TemporaryDirectory() as temp:
                identity = log_identity()
                event = log_event()
                reader = Mock()
                if timeout:
                    reader.drain.side_effect = lambda *_args, **_kwargs: identity.observe(event, "stream")
                    effect = subprocess.TimeoutExpired(["log", "show"], 20, output=b"[partial", stderr=b"slow")
                else:
                    effect = None
                result = subprocess.CompletedProcess([], 0, json.dumps([event]).encode(), b"")
                with patch.object(phase, "command", side_effect=effect, return_value=result):
                    phase.discover(reader, identity, SimpleNamespace(phase="write", device="isolated"), pathlib.Path(temp))
                proof = json.loads((pathlib.Path(temp) / "write-discovery.json").read_text())
                self.assertEqual(proof["origins"], ["stream"] if timeout else ["backfill"])
                self.assertEqual(proof["backfill_status"]["status"], "timeout" if timeout else "completed")

    def test_late_valid_identity_cannot_complete_after_discovery_deadline(self):
        with tempfile.TemporaryDirectory() as temp:
            result = subprocess.CompletedProcess([], 0, json.dumps([log_event()]).encode(), b"")
            with patch.object(phase, "command", return_value=result), \
                 patch.object(phase.time, "monotonic", side_effect=[0, 2]), \
                 self.assertRaisesRegex(RuntimeError, "timed out"):
                phase.discover(Mock(), log_identity(), SimpleNamespace(phase="write", device="isolated"),
                               pathlib.Path(temp), seconds=1)
            self.assertFalse((pathlib.Path(temp) / "write-discovery.json").exists())


class PhaseLifecycleTests(unittest.TestCase):
    def exercise(self, driver_mode="success", preexisting=False, phase_name="write"):
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
            args = SimpleNamespace(phase=phase_name, device=device, evidence=evidence, source="a" * 40, nonce="12-1")
            if phase_name != "write":
                (evidence / "write-input-bundle.json").write_bytes(phase.manifest(bundle))
            reader = Mock()
            reader.process.pid = 456
            reader.started_at = phase.utc_now().isoformat()
            commands = []
            driver_commands = []
            lifecycle = []
            reader.close.side_effect = lambda: lifecycle.append("reader_closed")

            def native_command(command, **options):
                commands.append(command)
                if command[:2] == ["ps", "-axo"]:
                    output = f"123 {installed.as_posix()}/Runner\n".encode() if preexisting else b""
                elif command[:3] == ["xcrun", "simctl", "get_app_container"]:
                    output = str(installed).encode()
                elif command[:3] == ["xcrun", "simctl", "launch"]:
                    self.assertNotIn("--console-pty", command)
                    output = (phase.APP + ": 123\n").encode()
                    if driver_mode == "failed-launch":
                        return subprocess.CompletedProcess(command, 2, output, b"launch failed explicitly")
                else:
                    output = b""
                return subprocess.CompletedProcess(command, 0, output, b"")

            def driver(command, **options):
                if command[:3] == ["xcrun", "simctl", "install"]:
                    self.assertEqual(options["timeout"], 120)
                    if driver_mode == "failed-install":
                        return subprocess.CompletedProcess(command, 7, b"", b"install failed")
                    return native_command(command, **options)
                driver_commands.append(command)
                if command[:3] == ["flutter", "build", "ios"] and driver_mode == "failed-build":
                    raise subprocess.CalledProcessError(2, command)
                if command[:2] == ["flutter", "drive"]:
                    if driver_mode in ("failed", "failed-probe"):
                        raise subprocess.CalledProcessError(2, command)
                    if driver_mode != "missing":
                        receipt = {"schema": "tax-mobile-application-acceptance-v2", "phase": phase_name,
                                   "completed_phase": phase_name, "source_sha": args.source,
                                   "run_nonce": args.nonce, "pid": 124 if driver_mode == "wrong-pid" else 123,
                                   "selected_test": phase.TEST}
                        phase.write_json(evidence / f"{phase_name}.json", receipt)
                return subprocess.CompletedProcess(command, 0)

            def failed_probe(*_args):
                lifecycle.append("live_probe")
                if driver_mode == "failed-probe":
                    raise OSError("probe unavailable")

            previous = pathlib.Path.cwd()
            os.chdir(home)
            try:
                with patch.object(phase.pathlib.Path, "home", return_value=home), \
                     patch.object(phase, "command", side_effect=native_command), \
                     patch.object(phase.subprocess, "run", side_effect=driver), \
                     patch.object(phase, "LogReader", return_value=reader), \
                     patch.object(phase, "discover", return_value=SimpleNamespace(pid=123, uri=URI)), \
                     patch.object(phase, "live_failure_probe", side_effect=failed_probe) as live_probe, \
                     patch.object(phase, "process_matches", return_value=b"123 exact-owned-executable\n"), \
                     patch.object(phase, "vm_identity", return_value={"result": {"type": "VM", "pid": 123}}), \
                     patch.object(phase, "stopped") as absent:
                    if driver_mode != "success" or preexisting:
                        with self.assertRaises((RuntimeError, FileNotFoundError, subprocess.CalledProcessError)) as caught:
                            phase.run(args)
                        absent.assert_not_called()
                        self.assertFalse(any(cmd[:3] == ["xcrun", "simctl", "terminate"] for cmd in commands))
                        launch_file = evidence / f"{phase_name}-launch.json"
                        if launch_file.exists():
                            self.assertFalse(json.loads(launch_file.read_text())["complete"])
                        if not preexisting and driver_mode not in ("failed-launch", "failed-install", "failed-build"):
                            live_probe.assert_called_once_with(args, evidence, 123, installed / "Runner")
                            reader.close.assert_called()
                            self.assertLess(lifecycle.index("live_probe"), lifecycle.index("reader_closed"))
                        if driver_mode == "failed-probe":
                            self.assertIsInstance(caught.exception, subprocess.CalledProcessError)
                        if driver_mode == "failed-launch":
                            live_probe.assert_not_called()
                            self.assertEqual((evidence / "write-launch.stderr.log").read_bytes(), b"launch failed explicitly")
                            self.assertEqual((evidence / "write-launch.stdout.log").read_bytes(), (phase.APP + ": 123\n").encode())
                            self.assertFalse(any(cmd[:2] == ["flutter", "drive"] for cmd in driver_commands))
                        if driver_mode == "failed-install":
                            live_probe.assert_not_called()
                            reader.close.assert_not_called()
                            self.assertFalse(any(cmd[:3] == ["xcrun", "simctl", "launch"] for cmd in commands))
                            self.assertFalse(any(cmd[:2] == ["flutter", "drive"] for cmd in driver_commands))
                            self.assertFalse(json.loads((evidence / "write-install.json").read_text())["installation_completed"])
                        if driver_mode == "failed-build":
                            live_probe.assert_not_called()
                            reader.close.assert_not_called()
                            self.assertEqual(commands, [])
                            self.assertEqual(len(driver_commands), 1)
                            self.assertFalse((evidence / "write-install-start.json").exists())
                    else:
                        phase.run(args)
                        absent.assert_called_once_with(123)
                        self.assertTrue(json.loads((evidence / f"{phase_name}-launch.json").read_text())["complete"])
                        log = (evidence / "process.log").read_text()
                        self.assertLess(log.index("driver_exit=0"), log.index("event=terminate"))
                        self.assertLess(log.index("event=terminate"), log.index("event=process_absent"))
                        builds = [command for command in driver_commands if command[:3] == ["flutter", "build", "ios"]]
                        if phase_name == "write":
                            self.assertEqual(builds, [["flutter", "build", "ios", "--verbose", "--simulator", "--debug", "--no-pub",
                                                     "--target=" + phase.TARGET,
                                                     "--dart-define=JURIS_ACCEPTANCE_SOURCE_SHA=" + args.source,
                                                     "--dart-define=JURIS_ACCEPTANCE_RUN_NONCE=" + args.nonce,
                                                     "-d", device]])
                        else:
                            self.assertEqual(builds, [])
                        drives = [command for command in driver_commands if command[:2] == ["flutter", "drive"]]
                        self.assertEqual(len(drives), 1)
                        for command in driver_commands:
                            self.assertIn("--target=" + phase.TARGET, command)
                            self.assertIn("--dart-define=JURIS_ACCEPTANCE_SOURCE_SHA=" + args.source, command)
                            self.assertIn("--dart-define=JURIS_ACCEPTANCE_RUN_NONCE=" + args.nonce, command)
                            self.assertEqual(command.count("-d"), 1)
                            self.assertEqual(command[command.index("-d") + 1], device)
                        self.assertIn("--use-existing-app=" + URI, drives[0])
                        self.assertEqual((evidence / f"{phase_name}-input-bundle.json").read_bytes(),
                                         (evidence / "write-input-bundle.json").read_bytes())
            finally:
                os.chdir(previous)

    def test_success_binds_receipt_and_actual_termination_order(self):
        self.exercise()

    def test_later_phases_keep_the_built_bundle_without_another_build(self):
        for phase_name in phase.PHASES[1:]:
            with self.subTest(phase=phase_name):
                self.exercise(phase_name=phase_name)

    def test_failed_first_build_cannot_install_launch_or_drive(self):
        self.exercise("failed-build")

    def test_failed_missing_or_wrong_pid_driver_never_completes(self):
        for mode in ("failed", "missing", "wrong-pid"):
            with self.subTest(mode=mode):
                self.exercise(mode)

    def test_failed_probe_does_not_mask_original_driver_failure(self):
        self.exercise("failed-probe")

    def test_failed_launch_retains_both_streams_and_never_drives(self):
        self.exercise("failed-launch")

    def test_failed_install_cannot_launch_or_drive(self):
        self.exercise("failed-install")

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


class RetainedVerifierTests(unittest.TestCase):
    def fixture(self, directory):
        event = log_event(metadata="live")
        backfill_event = {**event, "metadata": "retrospective"}
        identity = log_identity()
        identity.observe(event, "stream")
        identity.observe(backfill_event, "backfill")
        status = {"status": "completed", "exit_code": 0}
        proof = {"pid": 123, "launch_started_at": identity.started.isoformat(),
                 "verified_at": phase.utc_now().isoformat(), "event": event,
                 "origins": identity.origins, "observations": identity.observations,
                 "backfill_status": status}
        phase.write_json(directory / "write-discovery.json", proof)
        phase.write_json(directory / "write-backfill-status.json", status)
        phase.write_json(directory / "write-backfill.json", [backfill_event])
        phase.write_json(directory / "write-system.log", [event])
        (directory / "write-system-events.jsonl").write_text(
            json.dumps({"arrival_utc": phase.utc_now().isoformat(), "event": event}) + "\n", encoding="utf-8")
        (directory / "write-launch.stdout.log").write_text(phase.APP + ": 123\n")
        return {"log_reader_pid": 456, "app_id": phase.APP, "executable": EXE, "vm_uri": URI,
                "log_reader_started_at": (identity.started - datetime.timedelta(seconds=1)).isoformat()}

    def test_retained_verifier_accepts_raw_origins_with_metadata_difference(self):
        verifier = runpy.run_path(str(pathlib.Path(__file__).with_name("verify_ios_tax_journeys.py")), run_name="test_verifier")
        with tempfile.TemporaryDirectory() as temp:
            directory = pathlib.Path(temp)
            launch = self.fixture(directory)
            verifier["verify_discovery"](directory, "write", launch, 123, phase.__dict__)

    def test_retained_verifier_rejects_changed_raw_identity_or_missing_provenance(self):
        verifier = runpy.run_path(str(pathlib.Path(__file__).with_name("verify_ios_tax_journeys.py")), run_name="test_verifier")
        for mode in ("raw-pid", "raw-missing", "forged-origin", "wrong-uri", "stale-time"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as temp:
                directory = pathlib.Path(temp)
                launch = self.fixture(directory)
                proof = json.loads((directory / "write-discovery.json").read_text())
                if mode == "raw-pid":
                    phase.write_json(directory / "write-system.log", [{**proof["event"], "processID": 124}])
                elif mode == "raw-missing":
                    phase.write_json(directory / "write-backfill.json", [])
                elif mode == "forged-origin":
                    proof["observations"][1]["event"]["metadata"] = "not present in raw origin"
                    phase.write_json(directory / "write-discovery.json", proof)
                elif mode == "wrong-uri":
                    launch["vm_uri"] = URI.replace("43210", "43211")
                else:
                    proof["launch_started_at"] = "2999-01-01T00:00:00+00:00"
                    phase.write_json(directory / "write-discovery.json", proof)
                with self.assertRaises((AssertionError, RuntimeError)):
                    verifier["verify_discovery"](directory, "write", launch, 123, phase.__dict__)
        absent = subprocess.CompletedProcess([], 1, b"", b"")
        with patch.object(phase, "command", return_value=absent):
            phase.stopped(123, seconds=.1)


class InstallationTests(unittest.TestCase):
    def args(self, directory):
        return SimpleNamespace(
            evidence=directory, phase="write", source="a" * 40,
            nonce="123-1", device="563A3ED8-9FAD-4092-8E63-69E424FDB86C",
        )

    def test_install_has_explicit_budget_and_retains_start_before_spawn(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            args = self.args(root)
            bundle = root / "Runner.app"
            built = b'[{"path":"Runner","sha256":"source-bound"}]\n'
            def install(argv, **options):
                self.assertEqual(options["timeout"], 120)
                self.assertFalse(options["check"])
                start = json.loads((root / "write-install-start.json").read_text())
                self.assertEqual(start["argv"], argv)
                self.assertEqual(start["source_sha"], args.source)
                self.assertEqual(start["run_nonce"], args.nonce)
                self.assertFalse(start["installation_completed"])
                self.assertNotIn("exit_code", start)
                self.assertFalse((root / "write-install.json").exists())
                return subprocess.CompletedProcess(argv, 0, b"installed\n", b"warning\n")
            with patch.object(phase.subprocess, "run", side_effect=install), \
                    patch.object(phase.time, "monotonic", side_effect=[100.0, 131.0]):
                phase.install_bundle(args, bundle, built)
            final = json.loads((root / "write-install.json").read_text())
            self.assertEqual(final["elapsed_seconds"], 31)
            self.assertEqual(final["exit_code"], 0)
            self.assertTrue(final["installation_completed"])
            self.assertFalse(final["runtime_acceptance"])
            self.assertEqual((root / "write-install.stdout.log").read_bytes(), b"installed\n")
            self.assertEqual((root / "write-install.stderr.log").read_bytes(), b"warning\n")

    def test_nonzero_install_retains_streams_and_cannot_advance(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            with patch.object(phase.subprocess, "run", return_value=
                              subprocess.CompletedProcess([], 7, b"partial", b"install denied")):
                with self.assertRaisesRegex(RuntimeError, "installation command failed"):
                    phase.install_bundle(self.args(root), root / "Runner.app", b"[]")
            final = json.loads((root / "write-install.json").read_text())
            self.assertEqual(final["exit_code"], 7)
            self.assertFalse(final["installation_completed"])
            self.assertEqual((root / "write-install.stderr.log").read_bytes(), b"install denied")
            self.assertFalse((root / "write.json").exists())

    def test_real_hung_install_is_bounded_preserves_proof_and_records_timeout(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            prior = root / "read.json"
            prior.write_bytes(b'{"retained":"prior source proof"}')
            original_run = subprocess.run
            def hung_install(argv, **options):
                self.assertTrue((root / "write-install-start.json").exists())
                return original_run(
                    [sys.executable, "-I", "-c",
                     "import time; print('install began',flush=True); time.sleep(30)"],
                    **options,
                )
            began = time.monotonic()
            with patch.object(phase.subprocess, "run", side_effect=hung_install):
                with self.assertRaises(subprocess.TimeoutExpired):
                    phase.install_bundle(self.args(root), root / "Runner.app", b"[]",
                                         timeout_seconds=.3)
            self.assertLess(time.monotonic() - began, 5)
            final = json.loads((root / "write-install.json").read_text())
            self.assertEqual(final["status"], "timeout")
            self.assertIsNone(final["exit_code"])
            self.assertFalse(final["installation_completed"])
            self.assertFalse(final["runtime_acceptance"])
            self.assertIn(b"install began", (root / "write-install.stdout.log").read_bytes())
            self.assertEqual(prior.read_bytes(), b'{"retained":"prior source proof"}')
            self.assertFalse((root / "write.json").exists())

    def test_start_error_is_retained_without_inferred_exit(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            with patch.object(phase.subprocess, "run", side_effect=FileNotFoundError("missing simctl")):
                with self.assertRaises(FileNotFoundError):
                    phase.install_bundle(self.args(root), root / "Runner.app", b"[]")
            final = json.loads((root / "write-install.json").read_text())
            self.assertEqual(final["status"], "start_failed")
            self.assertIsNone(final["exit_code"])
            self.assertFalse(final["installation_completed"])

    def test_output_limit_retains_bounded_evidence_but_rejects_zero_exit(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            with patch.object(phase.subprocess, "run", return_value=
                              subprocess.CompletedProcess([], 0, b"x" * (1024 * 1024 + 1), b"")):
                with self.assertRaisesRegex(RuntimeError, "output exceeds"):
                    phase.install_bundle(self.args(root), root / "Runner.app", b"[]")
            final = json.loads((root / "write-install.json").read_text())
            self.assertTrue(final["output_truncated"])
            self.assertFalse(final["installation_completed"])
            self.assertEqual((root / "write-install.stdout.log").stat().st_size, 512 * 1024)

    def test_outer_abort_leaves_only_incomplete_start_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            with patch.object(phase.subprocess, "run", side_effect=SystemExit(124)):
                with self.assertRaises(SystemExit):
                    phase.install_bundle(self.args(root), root / "Runner.app", b"[]")
            start = json.loads((root / "write-install-start.json").read_text())
            self.assertEqual(start["status"], "started")
            self.assertFalse(start["installation_completed"])
            self.assertNotIn("exit_code", start)
            self.assertFalse((root / "write-install.json").exists())
            self.assertFalse((root / "write.json").exists())

    def test_existing_install_evidence_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            old = root / "write-install-start.json"
            old.write_bytes(b"previous attempt")
            with patch.object(phase.subprocess, "run") as runner:
                with self.assertRaisesRegex(RuntimeError, "evidence already exists"):
                    phase.install_bundle(self.args(root), root / "Runner.app", b"[]")
                runner.assert_not_called()
            self.assertEqual(old.read_bytes(), b"previous attempt")


class InstallEvidenceTests(unittest.TestCase):
    def fixture(self, root):
        args = SimpleNamespace(evidence=root, phase="write", source="a" * 40,
                               nonce="12-1", device="AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE")
        bundle = pathlib.PurePosixPath("/work/repo/apps/juris-mobile/build/ios/iphonesimulator/Runner.app")
        built = b'[{"path":"Runner","sha256":"one-source"}]\n'
        with patch.object(phase.subprocess, "run", return_value=
                          subprocess.CompletedProcess([], 0, b"installed\n", b"")):
            phase.install_bundle(args, bundle, built)
        return args, built

    def test_source_owned_verifier_accepts_complete_install_command_proof(self):
        verifier = runpy.run_path(str(pathlib.Path(__file__).with_name("verify_ios_tax_journeys.py")))
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            args, built = self.fixture(root)
            verifier["verify_install"](root, args.phase, args.source, args.nonce, args.device, built)

    def test_source_owned_verifier_rejects_incomplete_or_tampered_install_proof(self):
        verifier = runpy.run_path(str(pathlib.Path(__file__).with_name("verify_ios_tax_journeys.py")))
        for mode in ("start-only", "timeout", "nonzero", "source", "manifest", "command", "log", "infinite-elapsed"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as temp:
                root = pathlib.Path(temp)
                args, built = self.fixture(root)
                start_path, final_path = root / "write-install-start.json", root / "write-install.json"
                start, terminal = json.loads(start_path.read_text()), json.loads(final_path.read_text())
                if mode == "start-only":
                    final_path.unlink()
                elif mode == "timeout":
                    terminal.update(status="timeout", exit_code=None, installation_completed=False)
                elif mode == "nonzero":
                    terminal.update(exit_code=7, installation_completed=False)
                elif mode == "source":
                    start["source_sha"] = terminal["source_sha"] = "b" * 40
                elif mode == "manifest":
                    start["bundle_manifest_sha256"] = terminal["bundle_manifest_sha256"] = "0" * 64
                elif mode == "command":
                    start["argv"][3] = terminal["argv"][3] = "unowned-simulator"
                elif mode == "infinite-elapsed":
                    terminal["elapsed_seconds"] = float("inf")
                else:
                    (root / "write-install.stdout.log").write_bytes(b"changed")
                phase.write_json(start_path, start)
                if mode != "start-only":
                    phase.write_json(final_path, terminal)
                with self.assertRaises((AssertionError, FileNotFoundError)):
                    verifier["verify_install"](root, args.phase, args.source, args.nonce, args.device, built)


if __name__ == "__main__":
    unittest.main()
