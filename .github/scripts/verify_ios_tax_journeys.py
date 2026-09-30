#!/usr/bin/env python3
"""Verify retained application journeys; an uploaded artifact is not a pass."""
import hashlib
import datetime
import json
import math
import pathlib
import re
import runpy
import sys


def verify_install(root, phase, source, nonce, simulator, bundle):
    start = json.loads((root / f"{phase}-install-start.json").read_text())
    terminal = json.loads((root / f"{phase}-install.json").read_text())
    assert start["schema"] == terminal["schema"] == "tax-ios-install-command-v1"
    assert start["status"] == "started" and start["installation_completed"] is False
    assert "exit_code" not in start
    for key in ("schema", "source_sha", "run_nonce", "phase", "simulator", "argv",
                "bundle_manifest_sha256", "host_pid", "started_at", "timeout_seconds",
                "runtime_acceptance"):
        assert terminal[key] == start[key]
    assert start["source_sha"] == source and start["run_nonce"] == nonce
    assert start["phase"] == phase and start["simulator"] == simulator
    assert start["runtime_acceptance"] is False and start["timeout_seconds"] == 120
    assert type(start["host_pid"]) is int and start["host_pid"] > 0
    assert start["bundle_manifest_sha256"] == hashlib.sha256(bundle).hexdigest()
    argv = start["argv"]
    assert type(argv) is list and len(argv) == 5
    assert argv[:4] == ["xcrun", "simctl", "install", simulator]
    path = pathlib.PurePosixPath(argv[4])
    assert path.is_absolute() and ".." not in path.parts
    assert path.as_posix() == argv[4]
    assert argv[4].endswith("/apps/juris-mobile/build/ios/iphonesimulator/Runner.app")
    assert terminal["status"] == "completed"
    assert type(terminal["exit_code"]) is int and terminal["exit_code"] == 0
    assert terminal["installation_completed"] is True and terminal["output_truncated"] is False
    began = datetime.datetime.fromisoformat(start["started_at"])
    ended = datetime.datetime.fromisoformat(terminal["completed_at"])
    assert began.tzinfo is not None and ended.tzinfo is not None and began <= ended
    elapsed = terminal["elapsed_seconds"]
    assert type(elapsed) in (int, float) and math.isfinite(elapsed) and elapsed >= 0
    stdout = (root / f"{phase}-install.stdout.log").read_bytes()
    stderr = (root / f"{phase}-install.stderr.log").read_bytes()
    assert len(stdout) + len(stderr) <= 1024 * 1024
    assert hashlib.sha256(stdout).hexdigest() == terminal["stdout_sha256"]
    assert hashlib.sha256(stderr).hexdigest() == terminal["stderr_sha256"]


def verify_discovery(root, phase, launch, pid, discovery_tools):
    assert type(launch["log_reader_pid"]) is int and launch["log_reader_pid"] > 0
    assert (root / f"{phase}-launch.stdout.log").read_text().strip() == f"{launch['app_id']}: {pid}"
    discovery = json.loads((root / f"{phase}-discovery.json").read_text())
    assert discovery["pid"] == pid
    started = datetime.datetime.fromisoformat(discovery["launch_started_at"])
    verified = datetime.datetime.fromisoformat(discovery["verified_at"])
    assert started.tzinfo is not None and verified.tzinfo is not None and started <= verified
    reader_started = datetime.datetime.fromisoformat(launch["log_reader_started_at"])
    assert reader_started.tzinfo is not None and reader_started <= started
    event = discovery["event"]
    assert started <= datetime.datetime.fromisoformat(event["timestamp"]) <= verified
    fresh_identity = discovery_tools["LogIdentity"](pid, launch["executable"], started)
    fresh_identity.observe(event, "receipt")
    assert fresh_identity.uri == launch["vm_uri"]
    assert discovery["origins"] and set(discovery["origins"]) <= {"stream", "backfill"}
    stream_parser = discovery_tools["JsonLogObjects"]()
    stream_records = stream_parser.feed((root / f"{phase}-system.log").read_text(), final=True)
    event_file = root / f"{phase}-system-events.jsonl"
    arrivals = [json.loads(line) for line in event_file.read_text().splitlines()] if event_file.exists() else []
    assert [entry["event"] for entry in arrivals] == stream_records
    for entry in arrivals:
        assert datetime.datetime.fromisoformat(entry["arrival_utc"]).tzinfo is not None
        fresh_identity.observe(entry["event"], "stream")
    records_by_origin = {"stream": stream_records, "backfill": []}
    backfill = json.loads((root / f"{phase}-backfill-status.json").read_text())
    assert discovery["backfill_status"] == backfill
    if backfill.get("exit_code") == 0:
        backfill_parser = discovery_tools["JsonLogObjects"]()
        records = backfill_parser.feed((root / f"{phase}-backfill.json").read_text(), final=True)
        assert not backfill_parser.array or backfill_parser.closed
        for record in records:
            fresh_identity.observe(record, "backfill")
        records_by_origin["backfill"] = records
    else:
        assert discovery["origins"] == ["stream"]
    assert discovery["observations"]
    assert event in [entry["event"] for entry in discovery["observations"]]
    assert set(discovery["origins"]) == {entry["origin"] for entry in discovery["observations"]}
    for observation in discovery["observations"]:
        assert observation["event"] in records_by_origin[observation["origin"]]
        fresh_identity.observe(observation["event"], observation["origin"])


def verify(root: pathlib.Path, source: str, nonce: str) -> dict:
    assert re.fullmatch(r"[0-9a-f]{40}", source)
    assert nonce
    # The capture helper retains this exact committed dependency alongside this
    # verifier; no code from the downloaded artifact is executed.
    discovery_tools = runpy.run_path(str(pathlib.Path(__file__).with_name("run_ios_tax_phase.py")),
                                    run_name="source_discovery_validator")
    phases = ("write", "read", "incomplete-write", "incomplete-read", "legacy-write", "legacy-read")
    identity = (root / "source.identity").read_text()
    assert f"sha={source}\n" in identity and f"nonce={nonce}\n" in identity
    process_log = (root / "process.log").read_text()
    receipts = {}
    previous_pid = None
    bundle = (root / "write-bundle.json").read_bytes()
    assert json.loads(bundle)
    for index, phase in enumerate(phases):
        receipt = json.loads((root / f"{phase}.json").read_text())
        assert receipt["schema"] == "tax-mobile-application-acceptance-v2"
        assert receipt["source_sha"] == source and receipt["run_nonce"] == nonce
        assert receipt["phase"] == phase and receipt["platform"] == "ios"
        assert receipt["phase_index"] == index and receipt["completed_phase"] == phase
        assert receipt["entry_method"] == "programmatic_flutter_test"
        assert isinstance(receipt["pid"], int) and receipt["pid"] > 0
        assert receipt["previous_pid"] == previous_pid and receipt["pid"] != previous_pid
        previous_pid = receipt["pid"]
        assert f"phase={phase} driver_exit=0" in process_log
        assert f"phase={phase} event=process_absent pid={receipt['pid']}" in process_log
        phase_log = (root / f"{phase}.log").read_text()
        selected_test = "production application tax journey across process restart"
        assert receipt["selected_test"] == selected_test
        assert selected_test in phase_log
        assert "All tests passed." in phase_log
        assert f"tax_application selected_test={selected_test} phase={phase} source={source}" in phase_log
        assert f"tax_application phase={phase} source={source}" in phase_log
        assert (root / f"{phase}-bundle.json").read_bytes() == bundle
        assert (root / f"{phase}-input-bundle.json").read_bytes() == bundle
        assert (root / f"{phase}-installed-bundle.json").read_bytes() == bundle
        launch = json.loads((root / f"{phase}-launch.json").read_text())
        assert launch["schema"] == "tax-ios-system-log-launch-v1" and launch["complete"] is True
        assert launch["phase"] == phase and launch["source_sha"] == source and launch["run_nonce"] == nonce
        assert launch["pid"] == launch["vm_pid"] == receipt["pid"]
        assert launch["app_id"] == "com.genesissocietyengine.jurisMobile"
        assert launch["bundle_manifest_sha256"] == hashlib.sha256(bundle).hexdigest()
        assert f"simulator={launch['simulator']}\n" in identity
        assert f"/Devices/{launch['simulator']}/" in launch["executable"]
        assert launch["executable"].endswith("/Runner.app/Runner")
        verify_install(root, phase, source, nonce, launch["simulator"], bundle)
        verify_discovery(root, phase, launch, receipt["pid"], discovery_tools)
        vm = json.loads((root / f"{phase}-vm.json").read_text())
        assert vm["result"]["type"] == "VM" and vm["result"]["pid"] == receipt["pid"]
        shot = receipt["screenshot"]
        assert shot["filename"] == f"{phase}-editor.png"
        png = (root / shot["filename"]).read_bytes()
        assert png[:8] == b"\x89PNG\r\n\x1a\n" and len(png) == shot["bytes"] > 32
        assert hashlib.sha256(png).hexdigest() == shot["sha256"]
        exports = (root / f"{phase}-exports.log").read_text()
        architectures = re.findall(r"archive architectures \((\d+)\): ([^\n]+)", exports)
        assert len(architectures) == 1
        count, names = architectures[0]
        assert len(set(names.split())) == int(count) > 0
        for name in names.split():
            assert f"architecture {name} exact export set: PASS" in exports
        assert f"all {count} architecture slices exact export set: PASS" in exports
        receipts[phase] = receipt

    assert len({receipt["pid"] for receipt in receipts.values()}) == len(phases)

    def calculations(phase: str) -> list:
        return [call for call in receipts[phase]["native_calls"] if call["request"]["command"] == "tax_calculate"]

    for write, read in (("write", "read"), ("incomplete-write", "incomplete-read"), ("legacy-write", "legacy-read")):
        for key in ("artifact", "scenario", "workspace_progress"):
            assert receipts[write][key] == receipts[read][key], (write, read, key)
    for phase in ("write", "read", "legacy-write", "legacy-read"):
        assert len(calculations(phase)) == 1
        assert calculations(phase)[0]["response"]["type"] == "tax_calculated"
    assert calculations("write") == calculations("read")
    assert calculations("legacy-write") == calculations("legacy-read")
    incomplete = calculations("incomplete-write")
    assert len(incomplete) == 2
    assert incomplete[0]["response"]["type"] == "tax_calculated"
    assert incomplete[1]["response"]["type"] == "tax_error"
    assert "missing_tax_base" in json.dumps(incomplete[1]["response"]["detail"])
    assert calculations("incomplete-read") == []
    for phase in ("incomplete-write", "incomplete-read"):
        artifact = receipts[phase]["artifact"]
        assert artifact["calculation"] is None
        assert artifact["edit"]["baseline_tax_rate_bps"] == ""
        assert artifact["request"]["input"]["tax_input_basis"] == "rates"
    imports = [call for call in receipts["legacy-write"]["native_calls"] if call["request"]["command"] == "tax_import"]
    assert len(imports) == 1 and imports[0]["response"]["type"] == "tax_imported"
    legacy = imports[0]["response"]["legacy"]
    assert legacy["status"]["status"] == "converted"
    assert legacy["original_json"] == imports[0]["request"]["original_json"]
    assert hashlib.sha256(legacy["original_json"].encode()).hexdigest() == legacy["original_sha256"]
    for phase in ("legacy-write", "legacy-read"):
        artifact = receipts[phase]["artifact"]
        assert artifact["legacy"] == legacy
        assert artifact["request"]["input"]["override_owner"] == "SyntheticReviewer"
        assert artifact["request"]["input"]["override_as_of"] == "2026-09-30"
        assert legacy["status"]["draft"]["request"]["input"]["override_owner"] is None
        assert legacy["status"]["draft"]["request"]["input"]["override_as_of"] is None
    return {"schema": "tax-mobile-application-verification-v2", "source_sha": source, "run_nonce": nonce,
            "phases": list(phases), "pids": [receipts[p]["pid"] for p in phases],
            "same_bundle_sha256": hashlib.sha256(bundle).hexdigest(),
            "complete_pairs_equal": True, "fresh_native_reopen": True,
            "incomplete_native_error": True, "legacy_record_preserved": True}


if __name__ == "__main__":
    directory = pathlib.Path(sys.argv[1])
    result = verify(directory, sys.argv[2], sys.argv[3])
    (directory / "verification.json").write_text(json.dumps(result, indent=2) + "\n")
    print("tax application six-process acceptance: PASS")
    print(json.dumps(result))
