#!/usr/bin/env python3
"""Exercise collector bounds without requiring Simulator tools."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).with_name("collect_ios_tax_diagnostics.py")
spec = importlib.util.spec_from_file_location("diagnostics", SCRIPT)
diagnostics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostics)


class CaptureTests(unittest.TestCase):
    def capture(self, script, *, seconds=5, limit=1024):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "output.log"
            result = diagnostics.capture([sys.executable, "-I", "-c", script], path,
                                         time.monotonic() + seconds, limit=limit)
            return result, path.read_bytes() if path.exists() else None

    def test_nonzero_exit_keeps_diagnostic(self):
        result, output = self.capture("import sys; print('launch failed'); sys.exit(7)")
        self.assertEqual(result["exit_code"], 7)
        self.assertEqual(result["status"], "completed")
        self.assertIn(b"launch failed", output)

    def test_hung_command_is_terminated(self):
        result, _ = self.capture("import time; time.sleep(30)", seconds=0.3)
        self.assertEqual(result["status"], "timeout")
        self.assertIsNotNone(result["exit_code"])
        self.assertLess(result["elapsed_seconds"], 3)

    def test_fast_large_output_is_truncated(self):
        result, output = self.capture("print('x' * 65536)")
        self.assertEqual(result["status"], "output_limit")
        self.assertEqual(len(output), 1024)

    def test_exhausted_budget_does_not_launch(self):
        result, output = self.capture("raise RuntimeError('must not run')", seconds=-1)
        self.assertEqual(result["status"], "budget_exhausted")
        self.assertIsNone(output)

    def test_missing_tool_is_recorded(self):
        with tempfile.TemporaryDirectory() as folder:
            result = diagnostics.capture([str(Path(folder) / "missing-tool")],
                                         Path(folder) / "output.log", time.monotonic() + 1)
            self.assertEqual(result["status"], "unavailable")

    def test_nonisolated_selector_rejected_before_writing(self):
        with tempfile.TemporaryDirectory() as folder:
            result = subprocess.run([sys.executable, "-I", str(SCRIPT), "booted", folder],
                                    capture_output=True, timeout=5)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(list(Path(folder).iterdir()), [])


class RunnerEvidenceTests(unittest.TestCase):
    device = "EAE525EA-129B-4F71-A068-68898B5F47B6"
    container = ("/Users/runner/Library/Developer/CoreSimulator/Devices/"
                 + device + "/data/Containers/Bundle/Application/"
                 "990D2207-1981-4F58-957D-182C42254F64/Runner.app")
    executable = container + "/Runner"
    process = "18448 2933 Ss 10:02 " + executable + "\n"

    def test_selects_exact_isolated_executable_not_other_runner(self):
        other = self.process.replace("18448", "11111").replace(self.device, "00000000-0000-0000-0000-000000000000")
        target = diagnostics.resolve_runner(self.device, self.container + "\n", other + self.process)
        self.assertEqual(target, {"pid": 18448, "executable": self.executable})

    def test_rejects_ambiguous_missing_and_unsafe_identity(self):
        for processes in ["", self.process + self.process.replace("18448", "18449"),
                          self.process.replace("18448", "0")]:
            with self.subTest(processes=processes), self.assertRaises(ValueError):
                diagnostics.resolve_runner(self.device, self.container, processes)
        for container in [self.container.replace(self.device, "00000000-0000-0000-0000-000000000000"),
                          self.container + "\nerror", self.container.replace("/Users/", "/../Users/"),
                          self.container + "/other.app"]:
            with self.subTest(container=container), self.assertRaises(ValueError):
                diagnostics.resolve_runner(self.device, container, self.process)

    def test_rechecks_pid_and_full_executable_without_arguments(self):
        target = {"pid": 18448, "executable": self.executable}
        self.assertTrue(diagnostics.target_still_matches(target, " 18448 " + self.executable + "\n"))
        for text in ["18449 " + self.executable, "18448 /another/Runner", "",
                     "18448 " + self.executable + " --argument", "18448 " + self.executable + "\n1 /other"]:
            self.assertFalse(diagnostics.target_still_matches(target, text))

    def collect(self, overrides=None):
        overrides = overrides or {}
        calls = []
        with tempfile.TemporaryDirectory() as folder:
            def fake_capture(command, destination, deadline):
                calls.append((destination.stem, command, deadline))
                name = destination.stem
                default = {"host-processes": self.process, "application-container": self.container + "\n"}
                if name.endswith("-identity"):
                    default[name] = "18448 " + self.executable + "\n"
                text, status, code = overrides.get(name, (default.get(name, "diagnostic\n"), "completed", 0))
                if status != "budget_exhausted":
                    destination.write_text(text, encoding="utf-8")
                return {"command": command, "status": status, "exit_code": code, "bytes": len(text.encode())}

            with mock.patch.object(diagnostics, "capture", side_effect=fake_capture), \
                    mock.patch.object(diagnostics.shutil, "which", return_value=None):
                diagnostics.collect(self.device, folder)
            manifest = json.loads((Path(folder) / "failure-diagnostics/manifest.json").read_text(encoding="utf-8"))
            return calls, manifest

    def test_app_history_precedes_separate_short_springboard_and_native_target(self):
        calls, result = self.collect()
        names = [name for name, _, _ in calls]
        commands = {name: command for name, command, _ in calls}
        self.assertLess(names.index("application-log"), names.index("springboard-log"))
        self.assertNotIn('process == "SpringBoard"', commands["application-log"][-1])
        self.assertIn('process == "Runner"', commands["application-log"][-1])
        self.assertIn("com.genesissocietyengine.jurisMobile", commands["application-log"][-1])
        self.assertEqual(commands["springboard-log"][commands["springboard-log"].index("--last") + 1], "2m")
        self.assertEqual(commands["runner-stacks"], ["sample", "18448", "3", "10", "-file", "/dev/stdout"])
        self.assertEqual(commands["runner-listeners"], ["lsof", "-nP", "-a", "-p", "18448", "-iTCP", "-sTCP:LISTEN"])
        for name in ("runner-stacks", "runner-listeners"):
            self.assertEqual(names[names.index(name) - 1], name + "-identity")
            self.assertEqual(commands[name + "-identity"], ["ps", "-p", "18448", "-o", "pid=,comm="])
        self.assertEqual(len({deadline for _, _, deadline in calls}), 1)
        self.assertFalse(result["acceptance"])
        self.assertEqual(result["runner_target"]["pid"], 18448)

    def test_reused_pid_blocks_stacks_and_sockets_but_keeps_other_diagnostics(self):
        calls, result = self.collect({name + "-identity": ("18448 /another/app/Runner\n", "completed", 0)
                                     for name in ("runner-stacks", "runner-listeners")})
        names = [name for name, _, _ in calls]
        for name in ("runner-stacks", "runner-listeners"):
            self.assertNotIn(name, names)
            self.assertEqual(result["commands"][name]["status"], "identity_not_verified")
        self.assertIn("screenshot", names)

    def test_failed_or_incomplete_identity_never_samples_a_process(self):
        for status, code in [("completed", 7), ("timeout", -15), ("output_limit", 0), ("budget_exhausted", None)]:
            with self.subTest(status=status):
                calls, result = self.collect({"application-container": (self.container, status, code)})
                self.assertEqual(result["runner_target"]["status"], "unverified")
                self.assertFalse(any(command[0] == "sample" or (command[0] == "lsof" and "-p" in command)
                                     for _, command, _ in calls))

    def test_native_command_error_remains_evidence_not_acceptance(self):
        calls, result = self.collect({"runner-stacks": ("sample: permission denied\n", "completed", 7)})
        self.assertEqual(result["commands"]["runner-stacks"]["exit_code"], 7)
        self.assertIn("runner-listeners", [name for name, _, _ in calls])
        self.assertFalse(result["acceptance"])


if __name__ == "__main__":
    unittest.main()
