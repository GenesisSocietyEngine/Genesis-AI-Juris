#!/usr/bin/env python3
"""Exercise collector bounds without requiring Simulator tools."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

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


if __name__ == "__main__":
    unittest.main()
