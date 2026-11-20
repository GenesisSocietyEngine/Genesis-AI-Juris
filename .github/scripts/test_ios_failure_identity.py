import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock


def load(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

runner=load('collect_runner_abort')
recovery=load('collect_ios_recovery_diagnostics')
DEVICE='11111111-1111-1111-1111-111111111111'
START=1795132800

class IdentityTests(unittest.TestCase):
    def fixture(self, folder):
        root=Path(folder);(root/'reports').mkdir()
        (root/'prepared.identity').write_text('source\n'+DEVICE+'\nplan\n')
        (root/'phases.log').write_text('phase=test event=attempt_start attempt=1\nutc=2026-11-20T00:00:12Z phase=test event=attempt_finished attempt=1 exit=65 capture_exit=0\nphase=test event=bootstrap_retry\nphase=test event=recovery_boot_wait simulator='+DEVICE+'\n')
        (root/'xcodebuild-attempt-1.identity').write_text(f'1234 {START}\n')
        (root/'lifecycle-attempt-1.log').write_text('Runner (5678) encountered an error (Early unexpected exit, operation never finished bootstrapping - no restart will be attempted. (Underlying Error: Test crashed with signal abrt before starting test execution.))\n')
        body={'pid':5678,'procName':'Runner','bundleInfo':{'CFBundleIdentifier':'com.genesissocietyengine.jurisMobile'},'procPath':f'/Users/runner/Library/Developer/CoreSimulator/Devices/{DEVICE}/data/Containers/Bundle/Application/{DEVICE}/Runner.app/Runner','procLaunch':'2026-11-20T00:00:01Z','captureTime':'2026-11-20T00:00:11Z'}
        return root,body

    def report(self,root,body,name='Runner-test.ips'):
        p=root/'reports'/name;p.write_text(json.dumps({'bug_type':'309'})+'\n'+json.dumps(body));os.utime(p,(START+12,START+12));return p

    def test_exact_crash(self):
        with tempfile.TemporaryDirectory() as folder:
            root,body=self.fixture(folder);self.report(root,body)
            record=runner.collect(root,[root/'reports'])
            self.assertEqual(record['status'],'captured');self.assertFalse(record['acceptance'])
            self.assertTrue((root/'Runner-abort/Runner.ips').exists())

    def test_unrelated_crash_refused(self):
        for change in [{'pid':1234},{'procName':'Other'},{'bundleInfo':{}},{'bundleInfo':[]},{'procPath':'/tmp/Runner'},{'procLaunch':'2026-11-19T00:00:01Z'},{'captureTime':'2026-11-21T00:00:01Z'}]:
            with self.subTest(change=change),tempfile.TemporaryDirectory() as folder:
                root,body=self.fixture(folder);self.report(root,{**body,**change})
                self.assertEqual(runner.collect(root,[root/'reports'])['status'],'not_available')

    def test_ambiguous_crash_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            root,body=self.fixture(folder);self.report(root,body);self.report(root,body,'Runner-other.ips')
            self.assertEqual(runner.collect(root,[root/'reports'])['status'],'ambiguous')

    def test_stale_or_uncaptured_attempt_refused(self):
        for suffix in ['phase=test event=attempt_start attempt=2\n','utc=2026-11-20T00:00:12Z phase=test event=attempt_finished attempt=1 exit=65 capture_exit=0\n']:
            with tempfile.TemporaryDirectory() as folder:
                root,body=self.fixture(folder);self.report(root,body);p=root/'phases.log';p.write_text(p.read_text()+suffix)
                self.assertEqual(runner.collect(root,[root/'reports'])['status'],'identity_not_verified')

    def test_recovery_is_explicit_original(self):
        with tempfile.TemporaryDirectory() as folder:
            root,_=self.fixture(folder);callback=Mock();record=recovery.collect(root,DEVICE,callback)
            self.assertEqual(record['role'],'recovery_destination');self.assertFalse(record['acceptance'])
            callback.assert_called_once_with(DEVICE,root/'recovery-diagnostics')

    def test_recovery_stale_ready_missing_or_wrong_refused(self):
        for change in ['ready','attempt2','missing','wrong','duplicate']:
            with self.subTest(change=change),tempfile.TemporaryDirectory() as folder:
                root,_=self.fixture(folder);p=root/'phases.log';s=p.read_text()
                if change=='ready':s+='phase=test event=recovery_boot_ready simulator='+DEVICE+'\n'
                if change=='attempt2':s+='phase=test event=attempt_start attempt=2\n'
                if change=='missing':s=s.replace('recovery_boot_wait','unknown')
                if change=='wrong':(root/'prepared.identity').write_text('source\nother\nplan\n')
                if change=='duplicate':s+='phase=test event=bootstrap_retry\n'
                p.write_text(s);callback=Mock();record=recovery.collect(root,DEVICE,callback)
                self.assertEqual(record['status'],'identity_not_verified');callback.assert_not_called()

if __name__=='__main__':unittest.main()
