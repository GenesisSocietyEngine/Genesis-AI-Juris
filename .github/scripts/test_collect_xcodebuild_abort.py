#!/usr/bin/env python3
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location("abort",Path(__file__).with_name("collect_xcodebuild_abort.py"))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
START=1795132800  # 2026-11-20 00:00:00 UTC

class AbortTests(unittest.TestCase):
    def fixture(self, folder):
        root=Path(folder)/'evidence';root.mkdir()
        reports=Path(folder)/'reports';reports.mkdir()
        (root/'phases.log').write_text('phase=test event=attempt_start attempt=1\nutc=2026-11-20T00:00:12Z phase=test event=attempt_finished attempt=1 exit=134 capture_exit=0\n')
        (root/'xcodebuild-attempt-1.identity').write_text(f'1234 {START}\n')
        body={'pid':1234,'procName':'xcodebuild','procPath':'/Applications/Xcode_16.4.app/Contents/Developer/usr/bin/xcodebuild','procLaunch':'2026-11-20 00:00:00.000 +0000','captureTime':'2026-11-20 00:00:12.000 +0000'}
        return root,reports,body

    def report(self,reports,body,name='xcodebuild-test.ips'):
        p=reports/name;p.write_text(json.dumps({'bug_type':'309'})+'\n'+json.dumps(body));os.utime(p,(START+12,START+12));return p

    def test_exact_report_only(self):
        with tempfile.TemporaryDirectory() as folder:
            root,reports,body=self.fixture(folder);p=self.report(reports,body)
            self.report(reports,{**body,'pid':999},'xcodebuild-other.ips')
            r=module.collect(root,[reports]);self.assertEqual(r['status'],'captured')
            self.assertFalse(r['acceptance']);self.assertEqual((root/'xcodebuild-abort/xcodebuild.ips').read_bytes(),p.read_bytes())

    def test_wrong_identity_or_time_never_copied(self):
        for changes in [{'pid':999},{'procName':'Runner'},{'procPath':'/tmp/xcodebuild'},{'procLaunch':'2026-11-19 00:00:00 +0000'},{'captureTime':'2026-11-20 01:00:00 +0000'}]:
            with self.subTest(changes=changes),tempfile.TemporaryDirectory() as folder:
                root,reports,body=self.fixture(folder);self.report(reports,{**body,**changes})
                self.assertEqual(module.collect(root,[reports])['status'],'not_available')
                self.assertFalse((root/'xcodebuild-abort/xcodebuild.ips').exists())

    def test_no_identity_or_nonabort_is_refused(self):
        for case in ['missing','success','old_attempt']:
            with self.subTest(case=case),tempfile.TemporaryDirectory() as folder:
                root,reports,body=self.fixture(folder);self.report(reports,body)
                if case=='missing':(root/'xcodebuild-attempt-1.identity').unlink()
                if case=='success':p=root/'phases.log';p.write_text(p.read_text().replace('exit=134','exit=0'))
                if case=='old_attempt':p=root/'phases.log';p.write_text(p.read_text()+'phase=test event=attempt_start attempt=2\n')
                self.assertEqual(module.collect(root,[reports])['status'],'identity_not_verified')

    def test_ambiguous_reports_are_not_uploaded(self):
        with tempfile.TemporaryDirectory() as folder:
            root,reports,body=self.fixture(folder);self.report(reports,body);self.report(reports,body,'xcodebuild-duplicate.ips')
            self.assertEqual(module.collect(root,[reports])['status'],'ambiguous')

    def test_malformed_and_oversized_reports_are_not_uploaded(self):
        for raw in ['not json','[]\n[]','x'*(module.LIMIT+1)]:
            with tempfile.TemporaryDirectory() as folder:
                root,reports,body=self.fixture(folder);p=self.report(reports,body);p.write_text(raw);os.utime(p,(START+12,START+12))
                self.assertEqual(module.collect(root,[reports])['status'],'not_available')

    def test_report_count_budget_refuses_partial_selection(self):
        with tempfile.TemporaryDirectory() as folder:
            root,reports,body=self.fixture(folder)
            for i in range(65):self.report(reports,{**body,'pid':i+100},f'xcodebuild-{i}.ips')
            self.assertEqual(module.collect(root,[reports])['status'],'budget_exhausted')

if __name__=='__main__':unittest.main()
