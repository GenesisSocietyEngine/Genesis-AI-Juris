"""Real child deadlines plus scoped cleanup controls; POSIX behavior stays explicit."""
import importlib.util
import os
import pathlib
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("future_phase_deadline", HERE / "phase_deadline.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Tests(unittest.TestCase):
    def invoke(self, code, seconds=2):
        return subprocess.run([sys.executable, "-I", str(HERE / "phase_deadline.py"),
            "--timeout-seconds", str(seconds), "--grace-seconds", "0.15", "--label", "control", "--",
            sys.executable, "-u", "-c", code], capture_output=True, text=True, timeout=8)

    def test_success_is_retained_and_child_reaped(self):
        result = self.invoke("print('actual-output')")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("actual-output", result.stdout)
        self.assertIn('"cleanup": "absent"', result.stdout)

    def test_nonzero_is_not_hidden_by_cleanup(self):
        result = self.invoke("import sys; print('actual-error', file=sys.stderr); sys.exit(7)")
        self.assertEqual(result.returncode, 7, result.stderr)
        self.assertIn("actual-error", result.stderr)

    def test_timeout_is_failure_and_bounded(self):
        started = time.monotonic()
        result = self.invoke("import time; time.sleep(60)", .2)
        self.assertEqual(result.returncode, 124, result.stderr)
        self.assertLess(time.monotonic() - started, 5)
        self.assertIn('"timed_out": true', result.stdout)

    def test_uncertain_cleanup_cannot_accept_normal_exit(self):
        deadline = mock.Mock()
        deadline.group_state.return_value = "unknown"
        child = mock.Mock(pid=1234)
        child.wait.return_value = 0
        events = []
        with mock.patch.object(m.subprocess, "Popen", return_value=child):
            code = m.run(["control"], seconds=2, grace=.01, label="control", retain=events.append, deadline=deadline)
        self.assertEqual(code, 1)
        deadline.stop_owned.assert_called_once_with(child, .01)
        self.assertEqual(events[-1]["cleanup"], "unknown")

    def test_late_observed_zero_is_timeout_even_after_reap(self):
        deadline = mock.Mock()
        deadline.group_state.return_value = 'absent'
        child = mock.Mock(pid=1234)
        clock = [10.0]
        def late_wait(timeout):
            self.assertEqual(timeout, 2)
            clock[0] = 13
            return 0
        child.wait.side_effect = late_wait
        events = []
        with mock.patch.object(m.subprocess, 'Popen', return_value=child), \
                mock.patch.object(m.time, 'monotonic', side_effect=lambda: clock[0]):
            code = m.run(['control'], seconds=2, grace=.01, label='control', retain=events.append, deadline=deadline)
        self.assertEqual(code, 124)
        self.assertTrue(events[-1]['timed_out'])
        self.assertEqual(events[-1]['cleanup'], 'absent')

    def test_terminal_retention_failure_preserves_original_timeout(self):
        deadline = mock.Mock()
        deadline.group_state.return_value = 'absent'
        child = mock.Mock(pid=1234)
        original = subprocess.TimeoutExpired(['control'], 2)
        child.wait.side_effect = original
        def retain(event):
            if event['event'] == 'terminal':
                raise OSError('retention failed')
        with mock.patch.object(m.subprocess, 'Popen', return_value=child):
            with self.assertRaises(subprocess.TimeoutExpired) as raised:
                m.run(['control'], seconds=2, grace=.01, label='control', retain=retain, deadline=deadline)
        self.assertIs(raised.exception, original)
        self.assertIsInstance(original.__cause__, OSError)
        self.assertIn('retention failed', original.__notes__[0])

    @unittest.skipUnless(os.name == "posix", "Real owned descendant groups require POSIX/macOS")
    def test_normal_parent_exit_cleans_term_ignoring_descendant(self):
        with tempfile.TemporaryDirectory() as folder:
            marker = pathlib.Path(folder) / "heartbeat"
            child = ("import pathlib,signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); "
                     f"p=pathlib.Path({str(marker)!r}); "
                     "exec('while True:\\n p.write_text(str(time.monotonic()))\\n time.sleep(.02)')")
            parent = ("import pathlib,subprocess,sys,time; "
                      f"subprocess.Popen([sys.executable,'-u','-c',{child!r}]); "
                      f"p=pathlib.Path({str(marker)!r}); limit=time.monotonic()+4; "
                      "exec('while not p.exists() and time.monotonic()<limit:\\n time.sleep(.02)'); "
                      "assert p.exists(); sys.exit(7)")
            result = self.invoke(parent, 6)
            self.assertEqual(result.returncode, 7, result.stderr)
            before = marker.read_bytes()
            time.sleep(.15)
            self.assertEqual(marker.read_bytes(), before)
            self.assertIn('"exit": 7', result.stdout)


if __name__ == "__main__":
    unittest.main()
