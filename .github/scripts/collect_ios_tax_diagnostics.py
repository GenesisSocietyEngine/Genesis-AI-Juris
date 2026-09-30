#!/usr/bin/env python3
"""Bounded, read-only evidence from this job's isolated Simulator after failure."""

import json
import os
from pathlib import Path, PurePosixPath
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


def resolve_runner(device, container_text, processes_text):
    """Select only one executable inside this Simulator's verified app bundle."""
    container = container_text.strip()
    uuid = r"[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}"
    match = re.fullmatch(
        rf"/(?:[^/\r\n]+/)*Library/Developer/CoreSimulator/Devices/({uuid})/"
        rf"data/Containers/Bundle/Application/{uuid}/Runner\.app", container)
    if (match is None or match[1].lower() != device.lower()
            or any(part in (".", "..") for part in container.split("/"))):
        raise ValueError("App container is not inside the selected Simulator")
    executable = str(PurePosixPath(container) / "Runner")
    matches = []
    for line in processes_text.splitlines():
        fields = line.split(None, 4)
        if len(fields) == 5 and fields[4] == executable:
            if not fields[0].isdigit() or int(fields[0]) <= 1:
                raise ValueError("Invalid Runner PID")
            matches.append(int(fields[0]))
    if len(matches) != 1:
        raise ValueError("Expected exactly one Runner in the selected app container")
    return {"pid": matches[0], "executable": executable}


def target_still_matches(target, process_text):
    lines = [line.split(None, 1) for line in process_text.splitlines() if line.strip()]
    return lines == [[str(target["pid"]), target["executable"]]]


def collect(device, evidence):
    output = Path(evidence) / "failure-diagnostics"
    output.mkdir(parents=True, exist_ok=False)
    deadline = time.monotonic() + 120
    bundle_id = "com.genesissocietyengine.jurisMobile"
    records = {"simulator": device, "acceptance": False, "commands": {}}

    def persist():
        (output / "manifest.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")

    def run(name, command):
        result = capture(command, output / (name + ".log"), deadline)
        records["commands"][name] = result
        persist()
        return result

    def completed(name):
        result = records["commands"][name]
        return result["status"] == "completed" and result["exit_code"] == 0

    run("host-processes", ["ps", "-axo", "pid=,ppid=,stat=,etime=,comm="])
    # Broad SpringBoard history previously consumed the command budget before
    # the log reached this app's launch. Give Runner/app-specific history priority.
    run("application-log", ["xcrun", "simctl", "spawn", device, "log", "show",
                            "--last", "15m", "--style", "compact", "--predicate",
                            'process == "Runner" OR '
                            'eventMessage CONTAINS "com.genesissocietyengine.jurisMobile"'])
    run("application-container", ["xcrun", "simctl", "get_app_container", device, bundle_id, "app"])
    try:
        if not completed("host-processes") or not completed("application-container"):
            raise ValueError("Runner identity inputs did not complete successfully")
        target = resolve_runner(device, (output / "application-container.log").read_text(encoding="utf-8"),
                                (output / "host-processes.log").read_text(encoding="utf-8"))
        records["runner_target"] = {"status": "matched", **target}
    except (ValueError, OSError) as error:
        target = None
        records["runner_target"] = {"status": "unverified", "error": str(error)}
    persist()
    if target is not None:
        commands = [
            ("runner-stacks", ["sample", str(target["pid"]), "3", "10", "-file", "/dev/stdout"]),
            ("runner-listeners", ["lsof", "-nP", "-a", "-p", str(target["pid"]), "-iTCP", "-sTCP:LISTEN"]),
        ]
        for name, command in commands:
            identity = name + "-identity"
            run(identity, ["ps", "-p", str(target["pid"]), "-o", "pid=,comm="])
            if (completed(identity)
                    and target_still_matches(target, (output / (identity + ".log")).read_text(encoding="utf-8"))):
                run(name, command)
            else:
                records["commands"][name] = {"command": command, "status": "identity_not_verified"}
                persist()
    run("screenshot", ["xcrun", "simctl", "io", device, "screenshot", str(output / "simulator.png")])
    run("springboard-log", ["xcrun", "simctl", "spawn", device, "log", "show",
                            "--last", "2m", "--style", "compact", "--predicate", 'process == "SpringBoard"'])
    run("simulator-state", ["xcrun", "simctl", "list", "devices", "--json"])
    run("installed-applications", ["xcrun", "simctl", "listapps", device])
    run("launch-services", ["xcrun", "simctl", "spawn", device, "launchctl", "list"])
    flutter = shutil.which("flutter")
    if flutter:
        lockfile = Path(flutter).resolve().parent / "cache" / "lockfile"
        run("flutter-cache-lock", ["lsof", str(lockfile)])
    print("Failure diagnostics retained; this does not establish application acceptance.")


def main():
    if len(sys.argv) != 3 or not re.fullmatch(
        r"[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}", sys.argv[1]
    ):
        raise SystemExit("usage: collect_ios_tax_diagnostics.py <simulator-uuid> <evidence-dir>")
    collect(sys.argv[1], sys.argv[2])


if __name__ == "__main__":
    main()
