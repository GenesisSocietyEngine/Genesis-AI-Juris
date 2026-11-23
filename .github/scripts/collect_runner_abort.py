#!/usr/bin/env python3
"""Retain only the Runner identified by the latest failed native attempt."""
import importlib.util
import json
from pathlib import Path
import re
import sys

spec = importlib.util.spec_from_file_location('abort', Path(__file__).with_name('collect_xcodebuild_abort.py'))
abort = importlib.util.module_from_spec(spec)
spec.loader.exec_module(abort)


def read(path, limit=65536):
    if path.is_symlink() or path.stat().st_size > limit:
        raise ValueError('Invalid identity evidence')
    return path.read_text()


def identity(root):
    phases = read(root / 'phases.log')
    attempts = re.findall(r'phase=test event=attempt_start attempt=(\S+)', phases)
    if not attempts or attempts[-1] not in ('1', '2'):
        raise ValueError('No current attempt')
    attempt = attempts[-1]
    endings = re.findall(r'utc=(\S+) phase=test event=attempt_finished attempt=' + attempt + r' exit=(\d+) capture_exit=(\d+)', phases)
    if len(endings) != 1 or endings[0][1:] != ('65', '0'):
        raise ValueError('Current attempt is not a captured test failure')
    log = read(root / f'lifecycle-attempt-{attempt}.log', 1024 * 1024)
    pids = re.findall(r'Runner \((\d+)\) encountered an error \(Early unexpected exit[^\n]*Test crashed with signal abrt before starting test execution', log)
    if len(pids) != 1:
        raise ValueError('No unique crashed Runner PID')
    fields = read(root / f'xcodebuild-attempt-{attempt}.identity', 128).split()
    if len(fields) != 2 or not all(x.isdecimal() for x in fields):
        raise ValueError('Invalid attempt start identity')
    started = int(fields[1]); ended = abort.timestamp(endings[0][0])
    pid = int(pids[0])
    if pid <= 1 or not 0 <= ended - started <= 900:
        raise ValueError('Invalid attempt window')
    return pid, started, ended, attempt


def matches(raw, pid, started, ended):
    header, body = raw.split('\n', 1)
    meta, report = json.loads(header), json.loads(body)
    if not isinstance(meta, dict) or not isinstance(report, dict):
        return False
    uuid = r'[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}'
    path = report.get('procPath', '')
    if not isinstance(path, str):
        return False
    device = re.fullmatch(r'/Users/[^/]+/Library/Developer/(CoreSimulator/Devices|XCTestDevices)/(' + uuid + r')/data/Containers/Bundle/Application/' + uuid + r'/Runner.app/Runner', path)
    if not device:
        return False
    bundle = report.get('bundleInfo')
    bundle_matches = isinstance(bundle, dict) and bundle.get('CFBundleIdentifier') == 'com.genesissocietyengine.jurisMobile'
    # Unsigned XCTest-host reports omit bundleInfo. Require the exact clone
    # coalition to agree with its executable path, in addition to PID/time.
    unsigned_clone = ('bundleInfo' not in report and device[1] == 'XCTestDevices'
                      and report.get('coalitionName') == 'com.apple.CoreSimulator.SimDevice.' + device[2])
    return (meta.get('bug_type') == '309' and report.get('procName') == 'Runner'
            and type(report.get('pid')) is int and report['pid'] == pid
            and (bundle_matches or unsigned_clone)
            and started <= abort.timestamp(report['procLaunch']) <= ended
            and started <= abort.timestamp(report['captureTime']) <= ended + 2)



def collect(root, directories, *, final=False):
    # Keep before-recovery evidence immutable. Crash reports can arrive later,
    # and a second attempt must be matched against its own current identity.
    return abort.collect(root, directories, identity_reader=identity, matcher=matches,
                         name='Runner', output_name='Runner-abort-final' if final else 'Runner-abort')


if __name__ == '__main__':
    if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] != '--final'):
        raise SystemExit('usage: collect_runner_abort.py <evidence-dir> [--final]')
    print(json.dumps(collect(sys.argv[1], [Path.home() / 'Library/Logs/DiagnosticReports', Path('/Library/Logs/DiagnosticReports')], final=len(sys.argv) == 3)))
