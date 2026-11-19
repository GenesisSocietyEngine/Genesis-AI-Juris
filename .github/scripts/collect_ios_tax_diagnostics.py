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


def resolve_simulator_service(processes_text):
    """Identify the host service without depending on a stalled simctl RPC.

    This is diagnostic-only, not an app PID or a device acceptance identity.
    Refuse ambiguous services and paths not observed on the hosted runner.
    """
    executable = ("/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/"
                  "XPCServices/com.apple.CoreSimulator.CoreSimulatorService.xpc/Contents/MacOS/"
                  "com.apple.CoreSimulator.CoreSimulatorService")
    matches = []
    for line in processes_text.splitlines():
        fields = line.split(None, 4)
        if len(fields) == 5 and fields[4] == executable:
            if not fields[0].isdigit() or int(fields[0]) <= 1:
                raise ValueError("Invalid CoreSimulator service PID")
            matches.append(int(fields[0]))
    if len(matches) != 1:
        raise ValueError("Expected exactly one host CoreSimulator service")
    return {"pid": matches[0], "executable": executable}


def device_launch_targets(manager_text, processes_text):
    """Bind launch services to the launchd queried inside this exact device."""
    if not re.fullmatch(r"[0-9]+", manager_text.strip()) or int(manager_text) <= 1:
        raise ValueError("Invalid device launch manager PID")
    manager = int(manager_text)
    rows = {}
    for line in processes_text.splitlines():
        fields = line.split(None, 4)
        if len(fields) != 5 or not fields[0].isdigit() or not fields[1].isdigit():
            raise ValueError("Malformed process inventory")
        pid, parent = int(fields[0]), int(fields[1])
        if pid in rows:
            raise ValueError("Ambiguous process inventory")
        rows[pid] = (parent, fields[4])
    if rows.get(manager) != (1, "launchd_sim"):
        raise ValueError("Device manager is not the isolated launchd_sim")
    patterns = {
        "bridge": r"/usr/libexec/CoreSimulatorBridge",
        "springboard": (r"/Library/Developer/CoreSimulator/Volumes/[^/]+/Library/Developer/"
                        r"CoreSimulator/Profiles/Runtimes/[^/]+\.simruntime/Contents/Resources/"
                        r"RuntimeRoot/System/Library/CoreServices/SpringBoard\.app/SpringBoard"),
    }
    targets = {}
    for name, pattern in patterns.items():
        matches = [{"pid": pid, "parent": parent, "executable": path}
                   for pid, (parent, path) in rows.items()
                   if pid > 1 and parent == manager and re.fullmatch(pattern, path)
                   and not any(part in (".", "..") for part in path.split("/"))]
        if len(matches) == 1:
            targets[name] = matches[0]
    return targets


def device_target_still_matches(target, manager_text, process_text):
    lines = [line.split(None, 2) for line in process_text.splitlines() if line.strip()]
    return (manager_text.strip() == str(target["parent"]) and
            lines == [[str(target["pid"]), str(target["parent"]), target["executable"]]])


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

    # Launch can block at the per-device FrontBoard request while the shared
    # host service remains idle. Resolve the device's own bootstrap manager,
    # then use only its exact-path children; never sample by process name alone.
    manager_command = ["xcrun", "simctl", "spawn", device, "launchctl", "managerpid"]
    run("device-launch-manager", manager_command)
    run("device-launch-processes", ["ps", "-axo", "pid=,ppid=,stat=,etime=,comm="])
    try:
        if not completed("device-launch-manager") or not completed("device-launch-processes"):
            raise ValueError("Device launch identity did not complete")
        targets = device_launch_targets(
            (output / "device-launch-manager.log").read_text(encoding="utf-8"),
            (output / "device-launch-processes.log").read_text(encoding="utf-8"))
        records["device_launch_targets"] = targets
    except (ValueError, OSError) as error:
        targets = {}
        records["device_launch_identity_error"] = str(error)
    persist()
    for name, target in targets.items():
        prefix = "device-" + name
        run(prefix + "-manager", manager_command)
        run(prefix + "-identity", ["ps", "-p", str(target["pid"]), "-o", "pid=,ppid=,comm="])
        command = ["sample", str(target["pid"]), "3", "10", "-file", "/dev/stdout"]
        if (completed(prefix + "-manager") and completed(prefix + "-identity") and
                device_target_still_matches(target,
                    (output / (prefix + "-manager.log")).read_text(encoding="utf-8"),
                    (output / (prefix + "-identity.log")).read_text(encoding="utf-8"))):
            run(prefix + "-stacks", command)
        else:
            records["commands"][prefix + "-stacks"] = {"command": command, "status": "identity_not_verified"}
            persist()

    run("host-processes", ["ps", "-axo", "pid=,ppid=,stat=,etime=,comm="])
    # A first-launch timeout can also stall container/listapps RPCs, preventing
    # Runner sampling. Capture the host service first, independently of simctl.
    # It is shared host infrastructure: never use its PID as app/device proof.
    try:
        if not completed("host-processes"):
            raise ValueError("Host process inventory did not complete successfully")
        service = resolve_simulator_service((output / "host-processes.log").read_text(encoding="utf-8"))
        records["simulator_service_target"] = {"status": "matched", **service}
    except (ValueError, OSError) as error:
        service = None
        records["simulator_service_target"] = {"status": "unverified", "error": str(error)}
    persist()
    if service is not None:
        run("simulator-service-identity", ["ps", "-p", str(service["pid"]), "-o", "pid=,comm="])
        command = ["sample", str(service["pid"]), "3", "10", "-file", "/dev/stdout"]
        if (completed("simulator-service-identity") and target_still_matches(
                service, (output / "simulator-service-identity.log").read_text(encoding="utf-8"))):
            run("simulator-service-stacks", command)
        else:
            records["commands"]["simulator-service-stacks"] = {
                "command": command, "status": "identity_not_verified"}
            persist()
    # Exact-path discovery can return nothing even when a later compact log has
    # a VM announcement. Retain OS path/sender metadata without filtering on the
    # disputed path, before broad history consumes the shared diagnostic budget.
    # This is diagnostic-only: never feed these records into VM authorization.
    run("vm-announcements", ["xcrun", "simctl", "spawn", device, "log", "show",
                             "--last", "15m", "--style", "json", "--predicate",
                             'eventType == logEvent AND process == "Runner" AND '
                             'eventMessage CONTAINS "The Dart VM service is listening on "'])
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
