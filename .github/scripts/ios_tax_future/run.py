#!/usr/bin/env python3
"""Exercise ten future-format application phases on one newly owned Simulator."""
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
import pathlib
import signal
import subprocess
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import future_phase_transport as t
import orchestrator
import owned_simulator_lifecycle as lifecycle


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def choose_pair(execute, retain):
    inventories = []
    for label, argv in (("runtime-selection", lifecycle.RUNTIME_LIST), ("type-selection", lifecycle.TYPE_LIST)):
        result = execute(argv, 30)
        retain(label + ".json", {"argv": list(argv), "exit": result.exit, "stdout": lifecycle.raw(result.stdout),
            "stderr": lifecycle.raw(result.stderr), "timed_out": result.timed_out, "error": result.error})
        t.require(type(result.exit) is int and result.exit == 0 and not result.timed_out and result.error is None,
                  "Simulator inventory selection failed")
        inventories.append(result.stdout)
    runtimes = lifecycle.unique_json(inventories[0]).get("runtimes", [])
    types = lifecycle.unique_json(inventories[1]).get("devicetypes", [])
    for runtime in runtimes:
        if runtime.get("isAvailable") is not True or not runtime.get("identifier", "").startswith("com.apple.CoreSimulator.SimRuntime.iOS-"):
            continue
        for device in types:
            if device.get("productFamily") != "iPhone":
                continue
            try:
                lifecycle.choose(*inventories, runtime["identifier"], device["identifier"])
                return runtime["identifier"], device["identifier"]
            except RuntimeError:
                continue
    raise RuntimeError("No available supported iPhone Simulator pair")


def outer_phase(name, device, *, evidence, source, nonce, overall_deadline):
    seconds = 900 if name == "prepare" else 300
    argv = [sys.executable, "-I", str(HERE / "phase_deadline.py"), "--timeout-seconds", str(seconds),
        "--label", "tax-future-" + name, "--", sys.executable, "-I", str(HERE / "phase_cli.py"),
        name, device, str(evidence), source, nonce]
    start = {"schema": "tax-ios-future-outer-v1", "source_sha": source, "run_nonce": nonce,
        "simulator": device, "phase": name, "timeout_seconds": seconds, "argv": argv,
        "started_at": utc(), "status": "started"}
    t.save(evidence / ("outer-" + name + "-start.json"), start)
    path = evidence / ("outer-" + name + "-phase.log")
    process, primary = None, None
    cleanup_errors = []
    try:
        t.require(time.monotonic() < overall_deadline, "Overall exercise deadline expired")
        with path.open("xb") as output:
            process = subprocess.Popen(argv, cwd=HERE.parents[2] / "apps/juris-mobile", stdin=subprocess.DEVNULL,
                stdout=output, stderr=subprocess.STDOUT, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
            process.wait(timeout=min(seconds + 10, max(.001, overall_deadline - time.monotonic())))
        t.require(time.monotonic() < overall_deadline, "Overall exercise deadline expired after phase")
        t.require(process.returncode == 0, "Bounded phase failed: " + name)
    except BaseException as error:
        primary = error
        if process is not None and process.poll() is None:
            # This wrapper handles TERM by stopping only its owned phase group.
            # Keep that cleanup bounded; never signal a process-name pattern.
            try:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=2)
            except BaseException as cleanup_error:
                cleanup_errors.append(str(cleanup_error))
    data = path.read_bytes() if path.is_file() else b""
    terminal = {**start, "status": "completed", "completed_at": utc(),
        "exit_code": None if process is None else process.returncode,
        "log": {"filename": path.name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()},
        "error": None if primary is None else str(primary), "cleanup_errors": cleanup_errors}
    try:
        t.save(evidence / ("outer-" + name + "-terminal.json"), terminal)
    except BaseException as retention_error:
        if primary is not None:
            primary.add_note("Outer terminal receipt could not be retained: " + str(retention_error))
            raise primary from retention_error
        raise
    if primary is not None:
        raise primary
    print(f"tax_future outer_phase={name} exit=0 log={path.name}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evidence", type=pathlib.Path)
    args = parser.parse_args()
    t.require(sys.platform == "darwin", "This application runner requires macOS")
    repository = HERE.parents[2]
    def git(*arguments):
        result = subprocess.run(["git", "-C", str(repository), *arguments], capture_output=True, timeout=10, check=True)
        return result.stdout.decode().strip()
    source, tree = git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}")
    git("diff", "--quiet", "HEAD", "--")
    git("diff", "--cached", "--quiet", "--")
    t.verify_prepared(repository)
    run_id, attempt = os.environ.get("GITHUB_RUN_ID", ""), os.environ.get("GITHUB_RUN_ATTEMPT", "")
    t.require(run_id.isascii() and run_id.isdecimal() and int(run_id) > 0 and
              attempt.isascii() and attempt.isdecimal() and int(attempt) > 0, "Exact CI run/attempt required")
    nonce = run_id + "-" + attempt
    evidence = args.evidence.resolve()
    evidence.mkdir(parents=False, exist_ok=False)
    retain = lambda name, value: t.save(evidence / name, value)
    exercise_started_at = utc()
    began = time.monotonic()
    deadline = began + 1800
    cancelled = False
    def interrupt(number, _frame):
        nonlocal cancelled
        cancelled = True
        raise InterruptedError(f"Application run cancelled by signal {number}")
    for number in (signal.SIGTERM, signal.SIGINT):
        signal.signal(number, interrupt)
    owner = lifecycle.OwnedSimulator(source, nonce, execute=lifecycle.execute_simctl,
        retain=lifecycle.JsonEvidence(evidence / "simulator-lifecycle"),
        guard=lifecycle.Deadline(deadline, permitted=lambda: not cancelled))
    runtime, device_type = choose_pair(lifecycle.execute_simctl, retain)
    source_recorded = False
    def phase(name, device):
        nonlocal source_recorded
        if not source_recorded:
            retain("source.identity.json", {"schema": "tax-ios-future-source-v1", "source_sha": source,
                "source_tree": tree, "run_nonce": nonce, "simulator": device,
                "app_root": str(repository / "apps/juris-mobile"),
                "host_evidence_root": str(evidence),
                "python_executable": sys.executable,
                "simulator_root": str(pathlib.Path.home() / "Library/Developer/CoreSimulator/Devices"),
                "run_id": int(run_id), "run_attempt": int(attempt), "github_job": os.environ.get("GITHUB_JOB"),
                "platform": sys.platform, "started_at": utc(),
                "exercise_started_at": exercise_started_at, "synthetic_only": False})
            source_recorded = True
        outer_phase(name, device, evidence=evidence, source=source, nonce=nonce, overall_deadline=deadline)
    def diagnostics(device, seconds):
        # Let the collector honor a shorter internal budget and finish its own
        # separately grouped children; never kill its parent mid-cleanup.
        module_spec = importlib.util.spec_from_file_location("future_failure_diagnostics", HERE.parent / "collect_ios_tax_diagnostics.py")
        collector = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(collector)
        collector.collect(device, evidence, budget_seconds=max(.1, min(120, seconds - 5)))
    def verify(device):
        remaining = deadline - time.monotonic()
        t.require(remaining > 0, "No final verification budget remains")
        checked = subprocess.run([sys.executable, "-I", str(HERE / "verify_future_journey.py"),
            str(evidence), source, nonce, device], capture_output=True, timeout=remaining, check=True)
        t.require(time.monotonic() < deadline, "Final verification completed after overall deadline")
        t.require(len(checked.stdout) + len(checked.stderr) <= 4 * 1024 * 1024 and not checked.stderr,
                  "Final verifier returned unexpected diagnostics or excess output")
        result = json.loads(checked.stdout, object_pairs_hook=t.unique)
        t.save(evidence / "verification.json", result)
        return result
    result = orchestrator.exercise(owner, runtime, device_type, phase=phase, verify=verify,
        retain=retain, diagnostics=diagnostics)
    print("tax future application ten-phase acceptance: PASS", flush=True)
    print(json.dumps(result, sort_keys=True), flush=True)


if __name__ == "__main__":
    main()
