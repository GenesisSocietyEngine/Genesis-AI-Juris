#!/usr/bin/env python3
"""Retain only an exact-attempt xcodebuild IPS crash report, if available."""
from datetime import datetime
import json
from pathlib import Path
import re
import sys
import time

LIMIT = 4 * 1024 * 1024


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError("Timestamp is not text")
    parsed = datetime.fromisoformat(re.sub(r"\s+([+-]\d{4})$", r"\1", value.replace("Z", "+00:00")))
    if parsed.tzinfo is None:
        raise ValueError("Timestamp has no timezone")
    return parsed.timestamp()


def identity(root):
    phases_path = root / "phases.log"
    if phases_path.is_symlink() or phases_path.stat().st_size > 65536:
        raise ValueError("Invalid phase evidence")
    phases = phases_path.read_text()
    starts = re.findall(r"phase=test event=attempt_start attempt=(\S+)", phases)
    if not starts or starts[-1] not in ("1", "2"):
        raise ValueError("No known current attempt")
    attempt = starts[-1]
    endings = re.findall(r"utc=(\S+) phase=test event=attempt_finished attempt=" + attempt + r" exit=(\d+) capture_exit=(\d+)", phases)
    if len(endings) != 1 or endings[0][1:] != ("134", "0"):
        raise ValueError("Current attempt is not a recorded xcodebuild abort")
    path = root / f"xcodebuild-attempt-{attempt}.identity"
    if path.is_symlink() or path.stat().st_size > 128:
        raise ValueError("Invalid process identity")
    fields = path.read_text().split()
    if len(fields) != 2 or not all(x.isdecimal() for x in fields):
        raise ValueError("Invalid process identity")
    pid, started = map(int, fields)
    ended = timestamp(endings[0][0])
    if pid <= 1 or not 0 <= ended - started <= 900:
        raise ValueError("Invalid attempt window")
    return pid, started, ended, attempt


def matches(raw, pid, started, ended):
    header, body = raw.split("\n", 1)
    metadata, report = json.loads(header), json.loads(body)
    if not isinstance(metadata, dict) or not isinstance(report, dict):
        return False
    return (metadata.get("bug_type") == "309"
            and report.get("procName") == "xcodebuild"
            and type(report.get("pid")) is int and report["pid"] == pid
            and re.fullmatch(r"/Applications/Xcode[^/]*\.app/Contents/Developer/usr/bin/xcodebuild", report.get("procPath", "")) is not None
            and started - 2 <= timestamp(report["procLaunch"]) <= ended
            and started <= timestamp(report["captureTime"]) <= ended + 2)


def collect(root, directories, *, identity_reader=identity, matcher=matches, name="xcodebuild", output_name=None):
    root = Path(root)
    output = root / (output_name or (name + "-abort"))
    output.mkdir(parents=True, exist_ok=False)
    record = {"acceptance": False, "status": "not_available"}
    try:
        pid, started, ended, attempt = identity_reader(root)
    except (ValueError, OSError) as error:
        record.update(status="identity_not_verified", reason=str(error))
    else:
        record.update(pid=pid, attempt=attempt)
        deadline = time.monotonic() + 10
        candidates = []
        inspected = 0
        total = 0
        exhausted = False
        for directory in directories:
            for path in Path(directory).glob(name + "*.ips"):
                inspected += 1
                if inspected > 64 or time.monotonic() >= deadline:
                    exhausted = True
                    break
                try:
                    stat = path.stat()
                    if path.is_symlink() or not started <= stat.st_mtime <= ended + 120 or stat.st_size > LIMIT:
                        continue
                    if total + stat.st_size > 8 * 1024 * 1024:
                        exhausted = True
                        break
                    with path.open("rb") as stream:
                        raw = stream.read(LIMIT + 1)
                    total += len(raw)
                    if len(raw) > LIMIT:
                        exhausted = True
                        break
                    if matcher(raw.decode("utf-8"), pid, started, ended):
                        candidates.append(raw)
                except (ValueError, OSError, KeyError, TypeError, UnicodeError):
                    continue
            if exhausted:
                break
        if exhausted:
            record["status"] = "budget_exhausted"
        elif len(candidates) == 1:
            (output / (name + ".ips")).write_bytes(candidates[0])
            record.update(status="captured", bytes=len(candidates[0]))
        elif len(candidates) > 1:
            record["status"] = "ambiguous"
    (output / "manifest.json").write_text(json.dumps(record, indent=2) + "\n")
    return record


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: collect_xcodebuild_abort.py <evidence-dir>")
    print(json.dumps(collect(sys.argv[1], [Path.home() / "Library/Logs/DiagnosticReports", Path("/Library/Logs/DiagnosticReports")])))
