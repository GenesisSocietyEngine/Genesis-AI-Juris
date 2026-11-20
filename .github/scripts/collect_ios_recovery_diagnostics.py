#!/usr/bin/env python3
"""Capture the explicitly recorded recovery device, never relabel it as a worker."""
import importlib.util
import json
from pathlib import Path
import re
import sys

spec = importlib.util.spec_from_file_location('native', Path(__file__).with_name('collect_ios_native_diagnostics.py'))
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)


def select(root, original):
    if not re.fullmatch(native.UUID, original):
        raise ValueError('Invalid recovery device')
    identity = native.read_bounded(root / 'prepared.identity').splitlines()
    if len(identity) != 3 or identity[1] != original:
        raise ValueError('Prepared device does not match')
    phases = native.read_bounded(root / 'phases.log')
    events = re.findall(r'phase=test event=(attempt_start|bootstrap_retry|recovery_boot_wait|recovery_boot_ready)([^\n]*)', phases)
    if len(events) != 3 or events[0] != ('attempt_start', ' attempt=1') or events[1] != ('bootstrap_retry', '') or events[2] != ('recovery_boot_wait', ' simulator=' + original):
        raise ValueError('No unique unfinished recovery boot wait')
    return original


def collect(root, original, collector):
    root = Path(root); output = root / 'recovery-diagnostics'; output.mkdir(exist_ok=False)
    record = {'acceptance': False, 'role': 'recovery_destination', 'status': 'identity_not_verified'}
    try:
        record.update(simulator=select(root, original), status='selected')
    except (ValueError, OSError, UnicodeError) as error:
        record['reason'] = str(error)
    (output / 'selection.json').write_text(json.dumps(record, indent=2) + '\n')
    if record['status'] == 'selected':
        collector(record['simulator'], output)
    return record


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: collect_ios_recovery_diagnostics.py <device> <evidence>')
    spec = importlib.util.spec_from_file_location('diagnostics', Path(__file__).with_name('collect_ios_tax_diagnostics.py'))
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    print(json.dumps(collect(sys.argv[2], sys.argv[1], module.collect)))
