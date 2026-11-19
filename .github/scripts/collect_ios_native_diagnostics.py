#!/usr/bin/env python3
"""Capture only the worker recorded by this native XCTest attempt."""
import importlib.util
import json
from pathlib import Path
import re
import sys

UUID = r"[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}"


def read_bounded(path):
    if path.is_symlink() or path.stat().st_size > 1024 * 1024:
        raise ValueError("Untrusted or oversized identity evidence")
    return path.read_text(encoding="utf-8")


def select_worker(root, original):
    if not re.fullmatch(UUID, original):
        raise ValueError("Invalid original simulator")
    identity = read_bounded(root / "prepared.identity").splitlines()
    if len(identity) != 3 or identity[1] != original:
        raise ValueError("Prepared simulator identity does not match")
    attempts = re.findall(r"phase=test event=attempt_start attempt=(\S+)(?:\s|$)",
                          read_bounded(root / "phases.log"))
    if not attempts:
        raise ValueError("No native test attempt recorded")
    attempt = attempts[-1]
    if attempt not in ("1", "2"):
        raise ValueError("Unknown native test attempt")
    diagnostics = root / f"lifecycle-attempt-{attempt}.xcresult" / "Staging" / "1_Test" / "Diagnostics"
    # Do not follow links out of this job's result bundle.
    if any(p.is_symlink() for p in [diagnostics, *diagnostics.parents]
           if p == root or root in p.parents):
        raise ValueError("Linked evidence path")
    logs = list(diagnostics.glob("*/scheduling.log"))
    if not logs or len(logs) > 16:
        raise ValueError("Missing or excessive worker records")
    workers = set()
    for log in logs:
        if log.parent.is_symlink():
            raise ValueError("Linked worker record")
        for line in read_bounded(log).splitlines():
            if "Received worker from worker provider:" not in line:
                continue
            match = re.search(r"Received worker from worker provider: .*\[\d+: [^\r\n]+ \((" + UUID + r")\)\]$", line)
            if not match:
                raise ValueError("Malformed worker identity")
            workers.add(match[1].upper())
    if len(workers) != 1:
        raise ValueError("Expected exactly one current test worker")
    return next(iter(workers)), attempt


def collect_native(original, evidence, collector):
    root = Path(evidence)
    output = root / "native-diagnostics"
    output.mkdir(parents=True, exist_ok=False)
    record = {"acceptance": False, "original_simulator": original}
    try:
        worker, attempt = select_worker(root, original)
    except (ValueError, OSError, UnicodeError) as error:
        record.update(status="identity_not_verified", reason=str(error))
    else:
        record.update(status="selected", simulator=worker, attempt=attempt)
    (output / "selection.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    if record["status"] == "selected":
        collector(record["simulator"], output)
    return record


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: collect_ios_native_diagnostics.py <original-uuid> <evidence-dir>")
    spec = importlib.util.spec_from_file_location("diagnostics", Path(__file__).with_name("collect_ios_tax_diagnostics.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    print(json.dumps(collect_native(sys.argv[1], sys.argv[2], module.collect)))
