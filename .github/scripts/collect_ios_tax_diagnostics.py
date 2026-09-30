#!/usr/bin/env python3
"""Bounded, read-only evidence from this job's isolated Simulator after failure."""

import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time


def capture(command, destination, deadline, *, limit=4 * 1024 * 1024):
    """Bound wall time and retained output without buffering tool logs in RAM."""
    started = time.monotonic()
    record = {"command": command, "status": "not_started"}
    if started >= deadline:
        record["status"] = "budget_exhausted"
        return record
    process = None
    with destination.open("xb") as output:
        try:
            process = subprocess.Popen(
                command, stdout=output, stderr=subprocess.STDOUT,
                start_new_session=os.name == "posix",
            )
            command_deadline = min(deadline, started + 20)
            while process.poll() is None:
                if destination.stat().st_size >= limit:
                    record["status"] = "output_limit"
                    break
                if time.monotonic() >= command_deadline:
                    record["status"] = "timeout"
                    break
                time.sleep(0.1)
            else:
                record["status"] = "completed"
        except OSError as error:
            record.update(status="unavailable", error=str(error))
        finally:
            if process is not None and process.poll() is None:
                try:
                    if os.name == "posix":
                        os.killpg(process.pid, signal.SIGTERM)
                    else:
                        process.terminate()
                except ProcessLookupError:
                    pass
                try:
                    process.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    try:
                        if os.name == "posix":
                            os.killpg(process.pid, signal.SIGKILL)
                        else:
                            process.kill()
                    except ProcessLookupError:
                        pass
                    process.wait(timeout=1)
            # A fast command may finish between polls after producing too much.
            if destination.stat().st_size > limit:
                output.truncate(limit)
                record["status"] = "output_limit"
    record.update(exit_code=process.returncode if process else None,
                  bytes=destination.stat().st_size,
                  elapsed_seconds=round(time.monotonic() - started, 3))
    return record


def main():
    if len(sys.argv) != 3 or not re.fullmatch(
        r"[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}", sys.argv[1]
    ):
        raise SystemExit("usage: collect_ios_tax_diagnostics.py <simulator-uuid> <evidence-dir>")
    device = sys.argv[1]
    output = Path(sys.argv[2]) / "failure-diagnostics"
    output.mkdir(parents=True, exist_ok=False)
    deadline = time.monotonic() + 120
    bundle_id = "com.genesissocietyengine.jurisMobile"
    commands = [
        ("host-processes", ["ps", "-axo", "pid=,ppid=,stat=,etime=,comm="]),
        ("simulator-state", ["xcrun", "simctl", "list", "devices", "--json"]),
        ("installed-applications", ["xcrun", "simctl", "listapps", device]),
        ("launch-services", ["xcrun", "simctl", "spawn", device, "launchctl", "list"]),
        ("application-container", ["xcrun", "simctl", "get_app_container", device, bundle_id, "app"]),
        ("application-log", ["xcrun", "simctl", "spawn", device, "log", "show",
                             "--last", "15m", "--style", "compact", "--predicate",
                             'process == "Runner" OR process == "SpringBoard" OR '
                             'eventMessage CONTAINS "com.genesissocietyengine.jurisMobile"']),
        ("screenshot", ["xcrun", "simctl", "io", device, "screenshot",
                        str(output / "simulator.png")]),
    ]
    flutter = shutil.which("flutter")
    if flutter:
        lockfile = Path(flutter).resolve().parent / "cache" / "lockfile"
        commands.insert(1, ("flutter-cache-lock", ["lsof", str(lockfile)]))
    records = {"simulator": device, "acceptance": False, "commands": {}}
    for name, command in commands:
        records["commands"][name] = capture(command, output / (name + ".log"), deadline)
        (output / "manifest.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print("Failure diagnostics retained; this does not establish application acceptance.")


if __name__ == "__main__":
    main()
