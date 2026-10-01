#!/usr/bin/env python3
"""Offline verification of one complete, source-bound future-format iOS run.

Only checked-out source modules execute. Retained files are bounded input data,
not executable helpers or independent attestations of a device or CI provider.
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE))
import future_host_bindings as b
import future_phase_plan as p
import future_phase_transport as t
import host_assertions as h
import owned_simulator_lifecycle as life
import safe_authoring_mutator as mut

HEX = re.compile(r"[0-9a-f]{64}\Z")
MAX_FILE = 64 * 1024 * 1024
MAX_TOTAL = 768 * 1024 * 1024
STAGES = ("prepare", *t.PHASES, "restore-original")
EXPORTS = ("juris_mobile_bridge_abi_version", "juris_mobile_bridge_execute", "juris_mobile_bridge_string_free")


def require(value, message):
    if not value:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def utc(value):
    require(type(value) is str and len(value) <= 40, "Missing UTC timestamp")
    result = dt.datetime.fromisoformat(value)
    require(result.tzinfo is not None and result.utcoffset() == dt.timedelta(0), "Timestamp is not UTC")
    return result


def posix(value):
    require(type(value) is str and 0 < len(value) <= 4096 and not any(c in value for c in "\x00\r\n\\"), "Invalid host path")
    path = PurePosixPath(value)
    require(path.is_absolute() and str(path) == value and ".." not in path.parts and not value.startswith("//"), "Noncanonical host path")
    return path


class Evidence:
    """Bounded regular-file reader; recheck every used file before returning."""
    def __init__(self, root):
        self.root = Path(root)
        require(self.root.is_absolute() and self.root.is_dir() and not self.root.is_symlink(), "Invalid evidence root")
        self.cache = {}
        self.total = 0

    def _read(self, name, limit):
        parts = PurePosixPath(name).parts
        require(type(name) is str and parts and str(PurePosixPath(name)) == name and
                not PurePosixPath(name).is_absolute() and all(v not in (".", "..") for v in parts) and
                "\\" not in name, "Invalid evidence filename")
        path = self.root
        for part in parts[:-1]:
            path = path / part
            require(path.is_dir() and not path.is_symlink(), "Linked or missing evidence directory")
        path = path / parts[-1]
        before = path.lstat()
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size <= limit, "Evidence is linked, nonregular, or oversized: " + name)
        with path.open("rb") as stream:
            opened = os.fstat(stream.fileno())
            require((before.st_dev, before.st_ino, before.st_size) ==
                    (opened.st_dev, opened.st_ino, opened.st_size), "Evidence changed before read")
            data = stream.read(limit + 1)
        after = path.lstat()
        identity = lambda item: (item.st_dev, item.st_ino, item.st_size, item.st_mode, item.st_nlink,
                                 item.st_mtime_ns, item.st_ctime_ns)
        require(identity(before) == identity(after) and len(data) == before.st_size and len(data) <= limit, "Evidence changed during read")
        return data

    def read(self, name, limit=MAX_FILE):
        require(type(limit) is int and 0 < limit <= MAX_FILE, "Invalid read bound")
        if name not in self.cache:
            data = self._read(name, limit)
            self.total += len(data)
            require(self.total <= MAX_TOTAL, "Evidence aggregate byte bound exceeded")
            self.cache[name] = data
        require(len(self.cache[name]) <= limit, "Cached evidence exceeds requested bound")
        return self.cache[name]

    def object(self, name, limit=MAX_FILE):
        return p.decode(self.read(name, limit), limit=limit)

    def stable_manifest(self):
        for name, data in self.cache.items():
            require(self._read(name, MAX_FILE) == data, "Evidence changed after verification: " + name)
        return {name: {"bytes": len(data), "sha256": sha(data)} for name, data in sorted(self.cache.items())}


def validate_source(value, source, nonce, device):
    fields = {"schema", "source_sha", "source_tree", "run_nonce", "simulator", "app_root",
              "host_evidence_root", "python_executable", "simulator_root", "run_id", "run_attempt",
              "github_job", "platform", "started_at", "exercise_started_at", "synthetic_only"}
    require(set(value) == fields and value["schema"] == "tax-ios-future-source-v1", "Unexpected source identity schema")
    require(re.fullmatch(r"[0-9a-f]{40}", source) is not None and value["source_sha"] == source and
            re.fullmatch(r"[0-9a-f]{40}", value["source_tree"]) is not None, "Source identity differs")
    require(type(value["run_id"]) is int and value["run_id"] > 0 and type(value["run_attempt"]) is int and
            value["run_attempt"] > 0 and nonce == f'{value["run_id"]}-{value["run_attempt"]}' and
            value["run_nonce"] == nonce, "Run/attempt nonce differs")
    require(re.fullmatch(r"[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}", device) is not None and
            value["simulator"] == device, "Simulator identity differs")
    require(value["platform"] == "darwin" and value["synthetic_only"] is False and
            type(value["github_job"]) is str and re.fullmatch(r"[A-Za-z0-9_-]{1,100}", value["github_job"]), "Not a real macOS job identity")
    app = posix(value["app_root"])
    require(app.parts[-2:] == ("apps", "juris-mobile"), "Unexpected application root")
    posix(value["host_evidence_root"])
    posix(value["python_executable"])
    simulator = posix(value["simulator_root"])
    require(simulator.parts[-4:] == ("Library", "Developer", "CoreSimulator", "Devices"), "Unexpected Simulator root")
    require(utc(value["exercise_started_at"]) <= utc(value["started_at"]), "Exercise began after first phase identity")
    return app.parent.parent


def checked_source(identity):
    """Bind trusted local verifier code to the expected Git source, not artifact code."""
    repository = HERE.parents[2]
    def git(*args):
        result = subprocess.run(["git", "-C", str(repository), *args], capture_output=True, timeout=10, check=True)
        return result.stdout
    source = identity["source_sha"]
    require(git("rev-parse", source + "^{tree}").decode().strip() == identity["source_tree"], "Git source tree differs")
    paths = [file.relative_to(repository).as_posix() for file in HERE.glob("*.py") if not file.name.startswith("test_")]
    paths += [".github/scripts/run_with_deadline.py", ".github/scripts/verify_ios_ffi_exports.sh",
              ".github/scripts/collect_ios_tax_diagnostics.py"]
    paths = sorted(set(paths) | set(t.PREPARED_HASHES))
    result = {}
    for name in paths:
        expected = git("show", source + ":" + name)
        actual = (repository / name).read_bytes()
        require(actual.replace(b"\r\n", b"\n") == expected.replace(b"\r\n", b"\n"), "Trusted verifier source differs: " + name)
        result[name] = sha(expected)
        require(name not in t.PREPARED_HASHES or result[name] == t.PREPARED_HASHES[name], "Prepared source pin differs from Git: " + name)
    return result


def validate_outer(evidence, identity, phase):
    repository = PurePosixPath(identity["app_root"]).parent.parent
    directory = repository / ".github/scripts/ios_tax_future"
    python = identity["python_executable"]
    seconds = 900 if phase == "prepare" else 300
    inner = [python, "-I", str(directory / "phase_cli.py"), phase, identity["simulator"],
             identity["host_evidence_root"], identity["source_sha"], identity["run_nonce"]]
    argv = [python, "-I", str(directory / "phase_deadline.py"), "--timeout-seconds", str(seconds),
            "--label", "tax-future-" + phase, "--", *inner]
    start = evidence.object("outer-" + phase + "-start.json", 65536)
    end = evidence.object("outer-" + phase + "-terminal.json", 65536)
    expected = {"schema": "tax-ios-future-outer-v1", "source_sha": identity["source_sha"],
                "run_nonce": identity["run_nonce"], "simulator": identity["simulator"], "phase": phase,
                "timeout_seconds": seconds, "argv": argv, "status": "started", "started_at": start.get("started_at")}
    require(p.same(start, expected), "Outer start identity/command differs: " + phase)
    require(set(end) == set(start) | {"completed_at", "exit_code", "log", "error", "cleanup_errors"} and
            all(p.same(end[k], v) for k, v in start.items() if k != "status") and end["status"] == "completed" and
            type(end["exit_code"]) is int and end["exit_code"] == 0 and end["error"] is None and
            end["cleanup_errors"] == [], "Outer phase failed or incomplete: " + phase)
    began, ended = utc(start["started_at"]), utc(end["completed_at"])
    require(began <= ended and (ended - began).total_seconds() <= seconds + 10, "Outer wall budget exceeded")
    filename = "outer-" + phase + "-phase.log"
    log = evidence.read(filename)
    require(p.same(end["log"], {"filename": filename, "bytes": len(log), "sha256": sha(log)}), "Outer log differs")
    events = []
    for line in log.decode("utf-8", errors="strict").splitlines():
        if line.startswith("future_deadline "):
            events.append(p.decode(line.removeprefix("future_deadline ").encode()))
    require(len(events) == 2, "Missing/ambiguous process deadline proof")
    first, last = events
    pid = first.get("pid")
    # JSON numeric spelling may differ (900 versus 900.0); require numeric value/type explicitly.
    require(type(pid) is int and pid > 0 and set(first) == {"event", "label", "pid", "seconds", "argv"} and
            first["event"] == "started" and first["label"] == "tax-future-" + phase and
            type(first["seconds"]) in (int, float) and first["seconds"] == seconds and first["argv"] == inner,
            "Deadline start differs")
    require(p.same(last, {"event": "terminal", "label": "tax-future-" + phase, "pid": pid, "exit": 0,
            "timed_out": False, "cancelled": False, "cleanup": "absent", "error": None, "runtime_acceptance": False}),
            "Deadline failed or owned group remains")
    return began, ended


def raw(record):
    require(type(record) is dict and set(record) == {"bytes", "sha256", "base64"}, "Invalid raw command record")
    data = mut.decode(record)
    require(len(data) <= life.MAX_OUTPUT, "Lifecycle raw capture too large")
    return data


def validate_lifecycle(result, events, identity):
    source, nonce, device = (identity[k] for k in ("source_sha", "run_nonce", "simulator"))
    require(set(result) == {"source_sha", "run_nonce", "cleanup_mode", "clipboard_restored", "lifecycle_complete",
                           "application_acceptance", "simulator_lifecycle"}, "Unexpected lifecycle result")
    require(result["source_sha"] == source and result["run_nonce"] == nonce and result["lifecycle_complete"] is True and
            result["application_acceptance"] is False and result["clipboard_restored"] is False,
            "Lifecycle source/scope differs")
    h.assert_owned_simulator_deleted(result)
    retained = result["simulator_lifecycle"]
    require(set(retained) == {"source_sha", "run_nonce", "udid", "before_create", "runtimes", "device_types",
            "create", "after_create", "boot", "bootstatus", "shutdown", "after_shutdown", "delete", "after_delete"},
            "Unexpected lifecycle command inventory")
    require(retained["udid"] == device, "Lifecycle UUID differs")
    roles = ("before_create", "runtimes", "device_types", "pre_create", "create", "after_create",
             "pre_boot", "boot", "pre_bootstatus", "bootstatus", "after_boot", "pre_shutdown", "shutdown",
             "after_shutdown", "pre_delete", "delete", "after_delete")
    require(len(events) == 2 * len(roles) + 2, "Missing or additional lifecycle events")
    common = {"source_sha": source, "run_nonce": nonce, "application_acceptance": False}
    for event in events:
        require(all(p.same(event.get(k), v) for k, v in common.items()), "Lifecycle event source/scope differs")
    ownership = events[12]
    require(ownership.get("event") == "ownership" and ownership.get("udid") == device and
            ownership.get("name") == "Juris Tax Future " + nonce, "Missing fresh ownership")
    require(set(ownership) == set(common) | {"event", "udid", "runtime", "device_type", "name", "before_ids", "observed"}, "Unexpected ownership fields")
    runtime, dtype = ownership["runtime"], ownership["device_type"]
    life.choose(raw(retained["runtimes"]["stdout"]), raw(retained["device_types"]["stdout"]), runtime, dtype)
    commands = events[:12] + events[13:-1]
    records, previous = {}, None
    for index, role in enumerate(roles):
        start, end = commands[index * 2:index * 2 + 2]
        seconds = 180 if role == "bootstatus" else 60 if role in ("boot", "shutdown", "delete") else 30
        budget = start.get("timeout_seconds")
        if role == "create":
            argv = ["xcrun", "simctl", "create", ownership["name"], dtype, runtime]
        elif role in ("boot", "shutdown", "delete", "bootstatus"):
            argv = ["xcrun", "simctl", role, device] + (["-b"] if role == "bootstatus" else [])
        else:
            argv = list(life.RUNTIME_LIST if role == "runtimes" else life.TYPE_LIST if role == "device_types" else life.DEVICE_LIST)
        require(set(start) == set(common) | {"event", "sequence", "role", "argv", "timeout_seconds", "utc"} and
                start["event"] == "command-start" and type(start["sequence"]) is int and start["sequence"] == index + 1 and
                start["role"] == role and start["argv"] == argv and type(budget) in (int, float) and
                math.isfinite(budget) and 0 < budget <= seconds, "Lifecycle command start differs")
        require(set(end) == set(common) | {"event", "role", "argv", "exit", "stdout", "stderr", "timed_out", "error",
                "sequence", "executor_invoked", "utc"} and end["event"] == "command-terminal" and
                end["role"] == role and type(end["sequence"]) is int and end["sequence"] == index + 1 and
                end["argv"] == argv and type(end["exit"]) is int and end["exit"] == 0 and
                end["timed_out"] is False and end["error"] is None and end["executor_invoked"] is True,
                "Lifecycle command failed or capture incomplete")
        out, err = raw(end["stdout"]), raw(end["stderr"])
        require(len(out) + len(err) <= life.MAX_OUTPUT, "Lifecycle combined output bound exceeded")
        began, ended = utc(start["utc"]), utc(end["utc"])
        require(began <= ended and (previous is None or previous <= began) and
                (ended - began).total_seconds() <= budget, "Lifecycle time/order differs")
        previous = ended
        record = {k: v for k, v in end.items() if k not in (*common, "event", "role")}
        if role in retained:
            require(p.same(retained[role], record), "Lifecycle terminal does not match retained raw origin")
        records[role] = (start, end, out)
    require(p.same(events[-1], {**common, "event": "lifecycle-complete", "result": result}), "Lifecycle completion event differs")
    protected = life.devices(records["pre_create"][2])
    initial = life.devices(records["before_create"][2])
    require(set(initial) <= set(protected) and device.lower() not in protected and
            ownership["before_ids"] == sorted(protected), "Pre-create identity differs")
    states = {"after_create": {"Shutdown"}, "pre_boot": {"Shutdown"}, "pre_bootstatus": {"Booted", "Booting"},
              "after_boot": {"Booted"}, "pre_shutdown": {"Booted"}, "after_shutdown": {"Shutdown"}, "pre_delete": {"Shutdown"}}
    for role in ("pre_create", *states, "after_delete"):
        observed = life.devices(records[role][2])
        for key, item in (initial if role == "pre_create" else protected).items():
            require(key in observed, "Pre-existing Simulator disappeared")
            later = observed[key]
            require(item["runtime"] == later["runtime"] and item["device"]["name"] == later["device"]["name"] and
                    item["device"].get("deviceTypeIdentifier") == later["device"].get("deviceTypeIdentifier"), "Pre-existing Simulator identity changed")
        if role in states:
            own = observed.get(device.lower())
            require(own is not None and own["runtime"] == runtime and own["device"]["name"] == ownership["name"] and
                    own["device"].get("deviceTypeIdentifier") == dtype and own["device"].get("isAvailable") is True and
                    own["device"]["state"] in states[role], "Owned Simulator state or identity differs")
            if role == "after_create":
                require(p.same(own, ownership["observed"]), "Ownership observation differs")
    require(device.lower() not in life.devices(records["after_delete"][2]), "Owned Simulator remains")
    return utc(records["after_boot"][1]["utc"]), utc(records["pre_shutdown"][0]["utc"])


def validate_restoration(restored, state, identity):
    original = state["original"]["entries"]
    outside = {k: v for k, v in state["last_snapshot"]["entries"].items() if k.split("/")[0] not in mut.ROOTS}
    expected = {"schema": b.SCHEMA, "source_sha": identity["source_sha"], "run_nonce": identity["run_nonce"],
                "original": original, "final": original, "removed_auxiliary": outside, "clipboard_restored": False,
                "simulator_cleanup_pending": True, "synthetic_only": False, "preparation_only": False,
                "stage_proof": True, "runtime_acceptance": False}
    require(p.same(restored, expected), "Original restoration, auxiliary bytes, or scope differs")
    p.frozen_inventory(original)
    mut.validate_entries(outside, tuple(outside))
    require(all(k.split("/")[0] in mut.ROOTS for k in original), "Original contains owned control/export files")
    require(all(b.auxiliary(k) and "/" not in k for k in outside), "Unrecognized removed auxiliary")
    require(set(b.CONTROLS) <= set(outside), "Missing retained control removal")


def audit_output(data, argv):
    text = data.decode("utf-8", errors="strict")
    lines = text.splitlines()
    require(len(lines) >= 10 and lines[0] == "archive path: " + argv[2] and
            lines[1] == "architecture inspector path: " + argv[4] and lines[2].startswith("raw architecture list: "),
            "Archive audit command/output differs")
    raw_arches = lines[2].removeprefix("raw architecture list: ").split(" ")
    require(0 < len(raw_arches) <= 16 and all(re.fullmatch(r"[A-Za-z0-9_]+", arch) for arch in raw_arches) and
            len(set(raw_arches)) == len(raw_arches), "Invalid architecture list")
    arches = sorted(raw_arches)
    expected = lines[:3] + [f"archive architectures ({len(arches)}): " + " ".join(arches)]
    for arch in arches:
        expected += [f"architecture {arch} export audit: START", *EXPORTS, f"architecture {arch} exact export set: PASS"]
    expected += [f"all {len(arches)} architecture slices exact export set: PASS"]
    require(text == "\n".join(expected) + "\n", "Export audit is missing slices, symbols, or has unexpected diagnostics")
    return arches


def validate_exports(evidence, identity):
    app = PurePosixPath(identity["app_root"])
    bundle = p.decode(b'{"entries":' + evidence.read("prepared-bundle.json") + b'}')["entries"]
    require(type(bundle) is list, "Invalid bundle manifest")
    runners = [entry for entry in bundle if type(entry) is dict and entry.get("path") == "Runner"]
    require(len(runners) == 1 and set(runners[0]) == {"path", "bytes", "sha256"}, "Missing unique regular Runner binary")
    result, common = {}, None
    archive, runner = "ios/Generated/libjuris_mobile_ffi.a", "build/ios/iphonesimulator/Runner.app/Runner"
    for phase in t.PHASES:
        label = phase + "-export-command"
        start = evidence.object(label + "-start.json")
        argv = start.get("argv")
        require(type(argv) is list and len(argv) == 5 and argv[:3] == ["bash",
                str(app.parent.parent / ".github/scripts/verify_ios_ffi_exports.sh"), str(app / archive)], "Unexpected export audit argv")
        require(posix(argv[3]).name == "llvm-nm" and posix(argv[4]).name == "lipo", "Unexpected export tools")
        b.replay_command(evidence.read, label, argv, app, 60, 16 * 1024 * 1024, exact_seconds=True)
        out = evidence.read(label + "-stdout.log")
        require(evidence.read(label + "-stderr.log") == b"" and evidence.read(phase + "-exports.log") == out,
                "Audit stderr or retained output differs")
        arches = audit_output(out, argv)
        binaries = evidence.object(phase + "-binaries.json")
        require(set(binaries) == {archive, runner}, "Missing archive/Runner hashes")
        for record in binaries.values():
            require(type(record) is dict and set(record) == {"bytes", "sha256"} and
                    type(record["bytes"]) is int and record["bytes"] > 0 and type(record["sha256"]) is str and HEX.fullmatch(record["sha256"]), "Invalid binary identity")
        require(p.same(binaries[runner], {k: runners[0][k] for k in ("bytes", "sha256")}), "Audited Runner differs from installed bundle")
        current = {"binaries": binaries, "architectures": arches, "argv": argv}
        require(common is None or p.same(current, common), "Archive, bundle, tools or architectures changed across phases")
        common = current
        result[phase] = current
    return result


def validate_timeline(identity, intervals, events, booted, shutdown):
    began = utc(identity["exercise_started_at"])
    source_time = utc(identity["started_at"])
    require(began <= utc(events[0]["utc"]) <= booted <= source_time <= intervals[0][0] and
            all(a[1] <= c[0] for a, c in zip(intervals, intervals[1:])) and intervals[-1][1] <= shutdown,
            "Application phases fall outside ordered exercise/owned boot lifecycle")
    # The final lifecycle event embeds the complete result; its preceding event
    # is the actual after-delete inventory command terminal with a UTC timestamp.
    ended = utc(events[-2]["utc"])
    require(shutdown <= ended and (ended - began).total_seconds() < 1800,
            "Complete create/application/restoration/delete exercise exceeds overall budget")


def verify(evidence, source, nonce, device):
    require(__debug__, "Optimized Python cannot verify inherited assertions")
    reader = Evidence(evidence)
    require(not (reader.root / "failure.json").exists() and not (reader.root / "failure.json").is_symlink(), "Failed run cannot be accepted")
    identity = reader.object("source.identity.json", 65536)
    validate_source(identity, source, nonce, device)
    code = checked_source(identity)
    first = t.PhaseSpec(t.PHASES[0], device, source, nonce, reader.root,
                        PurePosixPath(identity["app_root"]), PurePosixPath(identity["simulator_root"]))
    state = b.replay_ledger(first, "restore-original", reader, False, after_restoration=True)
    validate_restoration(reader.object("original-restoration.json"), state, identity)
    require({item.name for item in reader.root.iterdir() if item.name.startswith("outer-")} ==
            {f"outer-{name}-{suffix}" for name in STAGES for suffix in ("start.json", "terminal.json", "phase.log")},
            "Missing or extra outer phase records")
    intervals = [validate_outer(reader, identity, name) for name in STAGES]
    directory = reader.root / "simulator-lifecycle"
    require(directory.is_dir() and not directory.is_symlink(), "Missing lifecycle raw records")
    files = sorted(directory.iterdir())
    require(0 < len(files) <= 100, "Invalid lifecycle event count")
    events = []
    for index, path in enumerate(files, 1):
        event = reader.object("simulator-lifecycle/" + path.name)
        require(path.name == f'{index:04d}-{event.get("event")}.json', "Lifecycle record sequence differs")
        events.append(event)
    booted, shutdown = validate_lifecycle(reader.object("lifecycle-complete.json"), events, identity)
    validate_timeline(identity, intervals, events, booted, shutdown)
    audits = validate_exports(reader, identity)
    receipts = [p.decode(item.receipt_json) for item in state["prior"]]
    return {"schema": "tax-ios-future-verification-v1", "source_sha": source, "source_tree": identity["source_tree"],
            "run_nonce": nonce, "simulator": device, "run_id": identity["run_id"], "run_attempt": identity["run_attempt"],
            "github_job": identity["github_job"], "runtime_acceptance": True, "selected_test": t.SELECTED_TEST,
            "phases": [{"phase": phase, "pid": receipt["pid"]} for phase, receipt in zip(t.PHASES, receipts)],
            "archive_audits": audits, "original_authoring_restored": True, "owned_controls_removed": True,
            "simulator_cleanup": "isolated_simulator_destroyed", "clipboard_restored": False,
            "trusted_source_files": code, "evidence_files": reader.stable_manifest(),
            "scope": "Ten future-format application phases; constructed disk fixtures, real application/native execution.",
            "remaining": ["Actual interruption/power-loss coverage is separate", "Physical device and accessibility acceptance is separate",
                          "PNG structure/hashes are checked; decoding and visual review remain separate", "CI/provider identity must be checked against retained run/artifact metadata"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evidence", type=Path)
    parser.add_argument("source")
    parser.add_argument("nonce")
    parser.add_argument("device")
    args = parser.parse_args()
    print(json.dumps(verify(args.evidence.resolve(), args.source, args.nonce, args.device), sort_keys=True, indent=2))


if __name__ == "__main__":
    main()
