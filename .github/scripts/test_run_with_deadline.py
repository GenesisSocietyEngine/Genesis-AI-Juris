#!/usr/bin/env python3
import os
import pathlib
import subprocess
import sys
import tempfile
import time
import unittest

RUNNER = pathlib.Path(__file__).with_name("run_with_deadline.py")


class DeadlineTests(unittest.TestCase):
    def assert_status(self, result, expected):
        self.assertEqual(result.returncode, expected,
                         f"child stdout:\n{result.stdout}\nchild stderr:\n{result.stderr}")

    def run_command(self, code, timeout="2", grace="0.15"):
        return subprocess.run([sys.executable, "-I", str(RUNNER), "--timeout-seconds", timeout,
                               "--grace-seconds", grace, "--label", "fixture", "--",
                               sys.executable, "-u", "-c", code], capture_output=True, text=True, timeout=6)

    def test_success_retains_output(self):
        result = self.run_command("print('fixture-output')")
        self.assert_status(result, 0)
        self.assertIn("fixture-output", result.stdout)
        self.assertIn("event=exited code=0", result.stdout)

    def test_nonzero_retains_status_and_diagnostics(self):
        result = self.run_command("import sys; print('fixture-error',file=sys.stderr); sys.exit(7)")
        self.assert_status(result, 7)
        self.assertIn("fixture-error", result.stderr)

    def test_hang_has_real_host_deadline(self):
        started = time.monotonic()
        result = self.run_command("import time; print('started'); time.sleep(60)", timeout="0.2")
        self.assert_status(result, 124)
        self.assertLess(time.monotonic() - started, 4)
        self.assertIn("event=timeout", result.stderr)
        self.assertNotIn("event=exited code=0", result.stdout)

    @unittest.skipUnless(os.name == "posix", "POSIX group behavior is exercised by macOS CI")
    def test_zero_on_termination_is_still_timeout(self):
        result = self.run_command("import signal,time,sys; signal.signal(signal.SIGTERM,lambda *_:sys.exit(0)); time.sleep(60)", timeout="0.2")
        self.assert_status(result, 124)
        self.assertNotIn("event=exited code=0", result.stdout)

    @unittest.skipUnless(os.name == "posix", "POSIX descendant behavior is exercised by macOS CI")
    def test_descendant_cannot_survive_parent_early_exit(self):
        with tempfile.TemporaryDirectory() as folder:
            marker = pathlib.Path(folder) / "heartbeat"
            child = ("import signal,time,pathlib; signal.signal(signal.SIGTERM,signal.SIG_IGN); "
                     f"p=pathlib.Path({str(marker)!r}); "
                     "exec('while True:\\n p.write_text(str(time.monotonic()))\\n time.sleep(0.02)')")
            parent = f"import subprocess,sys,time; subprocess.Popen([sys.executable,'-u','-c',{child!r}]); time.sleep(60)"
            result = self.run_command(parent, timeout="0.5")
            self.assert_status(result, 124)
            self.assertTrue(marker.is_file(), result.stderr)
            before = marker.read_bytes()
            time.sleep(0.15)
            self.assertEqual(marker.read_bytes(), before, "descendant continued after group kill")

    def test_invalid_duration_refuses_before_child_launch(self):
        for value in ["0", "-1", "nan", "inf"]:
            result = self.run_command("print('must-not-launch')", timeout=value)
            self.assert_status(result, 2)
            self.assertNotIn("must-not-launch", result.stdout)


if __name__ == "__main__":
    unittest.main()
