import importlib.util
import hashlib
import io
import json
import pathlib
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("future_host_command", HERE / "host_command.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Tests(unittest.TestCase):
    def command(self, folder, code, seconds=2, **options):
        root = pathlib.Path(folder)
        return m.run([sys.executable, "-u", "-c", code], root, seconds, root, "fixture", **options)

    def test_raw_output_and_nonzero_retained(self):
        with tempfile.TemporaryDirectory() as folder:
            result = self.command(folder, "import sys; sys.stdout.buffer.write(b'raw\\r\\n'); sys.stderr.write('error'); sys.exit(9)")
            self.assertEqual((result.returncode, result.stdout, result.stderr), (9, b"raw\r\n", b"error"))
            proof = json.loads((pathlib.Path(folder) / "fixture-terminal.json").read_bytes())
            self.assertEqual(proof["exit"], 9)
            self.assertFalse(proof["runtime_acceptance"])
            self.assertEqual(proof["output"]["stdout.log"]["bytes"], 5)

    def test_timeout_retains_failure_and_raw_output(self):
        with tempfile.TemporaryDirectory() as folder:
            began = time.monotonic()
            with self.assertRaises(TimeoutError):
                self.command(folder, "import time; print('before-hang',flush=True); time.sleep(60)", .3)
            self.assertLess(time.monotonic() - began, 4)
            proof = json.loads((pathlib.Path(folder) / "fixture-terminal.json").read_bytes())
            self.assertTrue(proof["timed_out"])
            self.assertIsNotNone(proof["exit"])

    def test_output_limit_cannot_accept_zero_exit(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(RuntimeError, "output exceeded"):
                self.command(folder, "print('x'*2048)", max_bytes=1024)
            proof = json.loads((pathlib.Path(folder) / "fixture-terminal.json").read_bytes())
            self.assertTrue(proof["output_exceeded"])
            retained = [(pathlib.Path(folder) / ("fixture-" + name)).read_bytes()
                        for name in ("stdout.log", "stderr.log")]
            self.assertLessEqual(sum(map(len, retained)), 1024)
            for name, data in zip(("stdout.log", "stderr.log"), retained):
                self.assertEqual(proof["output"][name]["sha256"], hashlib.sha256(data).hexdigest())

    def test_both_streams_share_one_retained_bound(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(RuntimeError, "output exceeded"):
                self.command(folder, "import sys; print('x'*900); print('y'*900,file=sys.stderr)", max_bytes=1024)
            root = pathlib.Path(folder)
            self.assertLessEqual(sum((root / ("fixture-" + name)).stat().st_size
                                     for name in ("stdout.log", "stderr.log")), 1024)

    def test_existing_evidence_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder) / "fixture-start.json"
            path.write_bytes(b"original")
            with self.assertRaisesRegex(RuntimeError, "already exists"):
                self.command(folder, "raise AssertionError('must not launch')")
            self.assertEqual(path.read_bytes(), b"original")

    def test_spawn_failure_retains_original_error(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            with self.assertRaises(FileNotFoundError):
                m.run([str(root / "missing-executable")], root, 2, root, "fixture")
            proof = json.loads((root / "fixture-terminal.json").read_bytes())
            self.assertIsNone(proof["exit"])
            self.assertIsNotNone(proof["error"])

    def test_stream_creation_failure_preserves_error_without_launch(self):
        original = pathlib.Path.open
        def opening(path, *args, **kwargs):
            if path.name == "fixture-stderr.log" and args == ("xb",):
                raise OSError("original stream creation error")
            return original(path, *args, **kwargs)
        with tempfile.TemporaryDirectory() as folder:
            with mock.patch.object(pathlib.Path, "open", opening), mock.patch.object(m.subprocess, "Popen") as spawn:
                with self.assertRaisesRegex(OSError, "original stream creation error"):
                    self.command(folder, "raise AssertionError('must not launch')")
            spawn.assert_not_called()
            proof = json.loads((pathlib.Path(folder) / "fixture-terminal.json").read_bytes())
            self.assertEqual(proof["error"], "original stream creation error")
            self.assertFalse(proof["output"]["stderr.log"]["capture_complete"])

    def test_late_observed_zero_exit_is_still_deadline_failure(self):
        child = mock.Mock(pid=1234, returncode=0)
        child.poll.return_value = 0
        child.stdout, child.stderr = io.BytesIO(b"completed"), io.BytesIO(b"")
        with tempfile.TemporaryDirectory() as folder:
            with mock.patch.object(m.subprocess, "Popen", return_value=child), \
                 mock.patch.object(m.time, "monotonic", side_effect=[0, 3, 3, 3, 3]):
                with self.assertRaisesRegex(TimeoutError, "completed after"):
                    self.command(folder, "synthetic zero exit", seconds=2)
            proof = json.loads((pathlib.Path(folder) / "fixture-terminal.json").read_bytes())
            self.assertTrue(proof["timed_out"])
            self.assertEqual(proof["exit"], 0)

    def test_terminal_retention_failure_does_not_replace_timeout(self):
        original = m.save
        def retain(path, value):
            if path.name == "fixture-terminal.json":
                raise OSError("terminal disk failure")
            return original(path, value)
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(m, "save", side_effect=retain):
            with self.assertRaises(TimeoutError) as raised:
                self.command(folder, "import time; time.sleep(60)", .1)
            self.assertIsInstance(raised.exception.__cause__, OSError)
            self.assertIn("terminal disk failure", str(raised.exception.__cause__))


if __name__ == "__main__":
    unittest.main()
