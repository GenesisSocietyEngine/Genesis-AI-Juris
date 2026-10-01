"""Concrete adapter boundaries, with no Flutter or Simulator invocation."""
import importlib.util
import io
import pathlib
import subprocess
import sys
import tempfile
import threading
import unittest
import types
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
for name in ("future_phase_transport", "host_command", "live_adapter"):
    spec = importlib.util.spec_from_file_location(name, HERE / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
m = sys.modules["live_adapter"]
t = sys.modules["future_phase_transport"]
REPO = HERE.parents[2]
SDK = {"flutter_root": "/synthetic/flutter", "dart": "/synthetic/flutter/bin/cache/dart-sdk/bin/dart",
       "dart_sha256": "d" * 64, "flutter_version": "3.44.8",
       "framework_revision": "058e0af2c2b57e369d905a03ac9748b0ebf543c6", "dart_version": "3.12.2"}


class Tests(unittest.TestCase):
    def authorization(self):
        return m.LiveAuthorization(REPO, "a" * 40, "123-1", "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE")

    def test_non_macos_refuses_before_commands(self):
        with mock.patch.object(m.sys, "platform", "win32"), mock.patch.object(m.subprocess, "run") as run:
            with self.assertRaisesRegex(RuntimeError, "requires macOS"):
                self.authorization().validate(None)
        run.assert_not_called()

    def test_pure_container_path_gets_concrete_manifest(self):
        tools = m.ActualTools(self.authorization())
        with tempfile.TemporaryDirectory() as directory:
            bundle = pathlib.Path(directory)
            (bundle / "Runner").write_bytes(b"actual fixture bytes")
            with mock.patch.object(tools.reference, "manifest", wraps=tools.reference.manifest) as manifest:
                result = tools.manifest(pathlib.PurePath(bundle))
            self.assertIsInstance(manifest.call_args.args[0], pathlib.Path)
            self.assertIn(b'"path":"Runner"', result)

    def test_unlisted_generic_function_is_not_exposed(self):
        tools = m.ActualTools(self.authorization())
        with self.assertRaises(AttributeError):
            tools.run

    def test_fake_live_adapters_cannot_authorize(self):
        with self.assertRaisesRegex(RuntimeError, "Concrete live adapters"):
            m.authorize(None, mock.Mock(), mock.Mock())

    def test_cancelled_build_refuses_without_process(self):
        with tempfile.TemporaryDirectory() as folder:
            authority = self.authorization()
            spec = t.PhaseSpec("baseline-write", authority.device, authority.source, authority.nonce,
                pathlib.Path(folder), REPO / "apps/juris-mobile", pathlib.PurePosixPath("/owned/Devices"))
            cancellation = threading.Event()
            cancellation.set()
            external = m.ActualExternal(authority, spec, None, cancellation)
            with mock.patch.object(m.host_command, "run") as run:
                with self.assertRaisesRegex(RuntimeError, "cancelled preparation"):
                    external.build(t.build_command(spec), spec.app_root, 900)
            run.assert_not_called()

    def direct_fixture(self, folder):
        authority = self.authorization()
        spec = t.PhaseSpec("baseline-write", authority.device, authority.source, authority.nonce,
            pathlib.Path(folder), REPO / "apps/juris-mobile", pathlib.PurePosixPath("/owned/Devices"))
        t.save(spec.evidence / "prepare.json", {"driver_sdk": dict(SDK)})
        external = m.ActualExternal(authority, spec, None, threading.Event())
        environment = t.driver_environment(spec, 123, "http://127.0.0.1:12345/synthetic=/")
        return spec, external, environment

    def test_direct_driver_uses_pinned_sdk_exact_environment_and_capped_capture(self):
        with tempfile.TemporaryDirectory() as folder:
            spec, external, environment = self.direct_fixture(folder)
            reference = t.load_reference(REPO)
            argv = [SDK["dart"], t.DRIVER]
            expected = subprocess.CompletedProcess(argv, 0, b"actual captured stdout", b"captured stderr")
            stdout, stderr = io.BytesIO(), io.BytesIO()
            with mock.patch.object(t, "load_reference", return_value=reference), \
                 mock.patch.object(reference, "driver_sdk_identity", return_value=dict(SDK)), \
                 mock.patch.object(m.host_command, "run", return_value=expected) as run, \
                 mock.patch.object(m.sys, "stdout", types.SimpleNamespace(buffer=stdout)), \
                 mock.patch.object(m.sys, "stderr", types.SimpleNamespace(buffer=stderr)):
                result = external.drive(argv, environment, spec.app_root, 240)
            self.assertIs(result, expected)
            self.assertEqual(run.call_args.args, (argv, spec.app_root, 240, spec.evidence, "baseline-write-driver-command"))
            self.assertEqual({key: run.call_args.kwargs["env"][key] for key in environment}, environment)
            self.assertEqual(stdout.getvalue(), expected.stdout)
            self.assertEqual(stderr.getvalue(), expected.stderr)

    def test_direct_driver_rejects_sdk_argv_uri_environment_and_cancel_before_spawn(self):
        for change in ("sdk", "argv", "uri", "pid", "extra", "cancelled"):
            with self.subTest(change=change), tempfile.TemporaryDirectory() as folder:
                spec, external, environment = self.direct_fixture(folder)
                reference = t.load_reference(REPO)
                sdk, argv = dict(SDK), [SDK["dart"], t.DRIVER]
                if change == "sdk": sdk["dart_sha256"] = "e" * 64
                if change == "argv": argv = ["flutter", "drive"]
                if change == "uri": environment["VM_SERVICE_URL"] = "http://example.com:12345/synthetic=/"
                if change == "pid": environment["JURIS_FUTURE_EXPECTED_PID"] = "0"
                if change == "extra": environment["OTHER"] = "unexpected"
                if change == "cancelled": external.cancellation.set()
                with mock.patch.object(t, "load_reference", return_value=reference), \
                     mock.patch.object(reference, "driver_sdk_identity", return_value=sdk), \
                     mock.patch.object(m.host_command, "run") as run:
                    with self.assertRaises(RuntimeError):
                        external.drive(argv, environment, spec.app_root, 240)
                run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
