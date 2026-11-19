#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("native", Path(__file__).with_name("collect_ios_native_diagnostics.py"))
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
BASE = "08AEF2F6-6BFD-48DC-9538-9B3FB7DE50B9"
CLONE = "47C09D31-E4A3-48AD-B8C9-87900279957D"
OTHER = "69EB2361-953A-4312-8222-C737F9876525"


class WorkerTests(unittest.TestCase):
    def fixture(self, root, worker=CLONE, attempt=1):
        (root / "prepared.identity").write_text("a"*40 + "\n" + BASE + "\nplan\n")
        (root / "phases.log").write_text(f"utc=now phase=test event=attempt_start attempt={attempt}\n")
        folder = root / f"lifecycle-attempt-{attempt}.xcresult/Staging/1_Test/Diagnostics/RunnerTests-session"
        folder.mkdir(parents=True, exist_ok=True)
        log = folder / "scheduling.log"
        log.write_text(f"2026-11-19 19:36:29 +0000: Received worker from worker provider: 0x7f81be28a490 [0: Clone 1 of iPhone 16 Pro ({worker})]\n")
        return log

    def test_selects_clone_not_original(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);self.fixture(root);collector=Mock()
            record=native.collect_native(BASE,root,collector)
            collector.assert_called_once_with(CLONE,root/'native-diagnostics')
            self.assertFalse(record['acceptance'])

    def test_latest_attempt_only(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);self.fixture(root);self.fixture(root,OTHER,2)
            self.assertEqual(native.select_worker(root,BASE),(OTHER,'2'))

    def test_missing_or_ambiguous_worker_never_captures(self):
        for case in ['missing','ambiguous','malformed','oversize','wrong_base','no_attempt']:
            with self.subTest(case=case), tempfile.TemporaryDirectory() as folder:
                root=Path(folder);log=self.fixture(root)
                if case=='missing':log.unlink()
                if case=='ambiguous':log.write_text(log.read_text()+log.read_text().replace(CLONE,OTHER))
                if case=='malformed':log.write_text(log.read_text().replace(CLONE,'not-a-uuid'))
                if case=='oversize':log.write_text('x'*(1024*1024+1))
                if case=='wrong_base':(root/'prepared.identity').write_text('a\n'+OTHER+'\nplan\n')
                if case=='no_attempt':(root/'phases.log').write_text('phase=prepare event=start\n')
                collector=Mock();record=native.collect_native(BASE,root,collector)
                collector.assert_not_called();self.assertEqual(record['status'],'identity_not_verified')

    def test_stale_attempt_not_used_when_current_missing(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);self.fixture(root)
            (root/'phases.log').write_text('phase=test event=attempt_start attempt=2\n')
            collector=Mock();native.collect_native(BASE,root,collector);collector.assert_not_called()

    def test_unknown_latest_attempt_does_not_fall_back(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);self.fixture(root)
            with (root/'phases.log').open('a') as log:
                log.write('phase=test event=attempt_start attempt=3\n')
            collector=Mock();native.collect_native(BASE,root,collector);collector.assert_not_called()

    def test_linked_identity_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);self.fixture(root);collector=Mock()
            with patch.object(Path,'is_symlink',return_value=True):
                record=native.collect_native(BASE,root,collector)
            collector.assert_not_called();self.assertEqual(record['status'],'identity_not_verified')

    def test_existing_capture_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);self.fixture(root);collector=Mock()
            native.collect_native(BASE,root,collector)
            with self.assertRaises(FileExistsError):native.collect_native(BASE,root,collector)
            self.assertEqual(collector.call_count,1)

if __name__=='__main__':unittest.main()
