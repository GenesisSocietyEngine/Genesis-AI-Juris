#!/usr/bin/env python3
import os
import contextlib
import errno
import io
import itertools
import pathlib
import subprocess
import sys
import tempfile
import time
import types
import unittest
from unittest import mock

RUNNER = pathlib.Path(__file__).with_name("run_with_deadline.py")


def load_runner():
    module = types.ModuleType("deadline_fixture")
    exec(compile(RUNNER.read_text(encoding="utf-8"), str(RUNNER), "exec"), module.__dict__)
    return module


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

    def exercise_mock_timeout(self, signal_effect):
        module = load_runner()
        process = mock.Mock(pid=4242)
        process.poll.return_value = -15
        process.wait.side_effect = [subprocess.TimeoutExpired("fixture", 0.2), -15]
        output, diagnostics = io.StringIO(), io.StringIO()
        with (mock.patch.object(module.os, "name", "posix"),
              mock.patch.object(module.os, "killpg", side_effect=signal_effect, create=True) as killpg,
              mock.patch.object(module.signal, "SIGKILL", 9, create=True),
              mock.patch.object(module.subprocess, "Popen", return_value=process) as popen,
              mock.patch.object(module.time, "monotonic", side_effect=itertools.count(0, 0.1)),
              mock.patch.object(module.time, "sleep"),
              contextlib.redirect_stdout(output), contextlib.redirect_stderr(diagnostics)):
            code = module.main(["--timeout-seconds", "0.2", "--grace-seconds", "0.15",
                                "--label", "fixture", "--", "owned-fixture"])
        self.assertEqual(code, 124)
        self.assertIn("event=timeout", diagnostics.getvalue())
        self.assertNotIn("event=exited", output.getvalue())
        popen.assert_called_once_with(["owned-fixture"], start_new_session=True)
        self.assertTrue(all(call.args[0] == 4242 for call in killpg.call_args_list))
        self.assertLess(len(killpg.call_args_list), 12)
        return diagnostics.getvalue(), killpg.call_args_list

    def test_denied_probe_then_absent_keeps_timeout(self):
        probes = 0

        def signal_effect(_pid, sig):
            nonlocal probes
            if sig == 0:
                probes += 1
                if probes == 1:
                    raise PermissionError(errno.EPERM, "denied probe")
                raise ProcessLookupError(errno.ESRCH, "gone")

        diagnostics, _ = self.exercise_mock_timeout(signal_effect)
        self.assertIn("event=group_probe_denied", diagnostics)
        self.assertNotIn("event=cleanup_incomplete", diagnostics)

    def test_persistent_denial_retains_unknown_cleanup_and_timeout(self):
        def denied(_pid, _sig):
            raise PermissionError(errno.EPERM, "denied")

        diagnostics, calls = self.exercise_mock_timeout(denied)
        self.assertIn("event=group_probe_denied", diagnostics)
        self.assertIn("event=group_signal_denied pid=4242 force=0", diagnostics)
        self.assertIn("event=group_signal_denied pid=4242 force=1", diagnostics)
        self.assertIn("event=cleanup_incomplete pid=4242 group_state=unknown", diagnostics)
        self.assertTrue(any(call.args[1] == 9 for call in calls))

    def test_exited_parent_does_not_hide_present_descendant_group(self):
        killed = False

        def signal_effect(_pid, sig):
            nonlocal killed
            if sig == 9:
                killed = True
            if sig == 0 and killed:
                raise ProcessLookupError(errno.ESRCH, "gone")

        diagnostics, calls = self.exercise_mock_timeout(signal_effect)
        self.assertTrue(any(call.args[1] == 9 for call in calls))
        self.assertNotIn("event=cleanup_incomplete", diagnostics)

    def test_present_group_after_force_is_explicitly_incomplete(self):
        diagnostics, _ = self.exercise_mock_timeout(lambda _pid, _sig: None)
        self.assertIn("event=cleanup_incomplete pid=4242 group_state=present", diagnostics)

    def test_unexpected_group_probe_error_is_not_ignored(self):
        module = load_runner()
        with (mock.patch.object(module.os, "name", "posix"),
              mock.patch.object(module.os, "killpg", side_effect=OSError(errno.EIO, "unexpected"), create=True)):
            with self.assertRaises(OSError) as raised:
                module.group_state(mock.Mock(pid=4242))
        self.assertEqual(raised.exception.errno, errno.EIO)


if __name__ == "__main__":
    unittest.main()
