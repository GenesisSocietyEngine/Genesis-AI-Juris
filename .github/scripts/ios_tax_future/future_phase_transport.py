"""Source-bound transport composition; import never launches a tool.

Synthetic controls use explicit fake tools. A real caller must separately
authorize its checked-out source, POSIX group, platform and concrete adapters.
"""
from dataclasses import dataclass, replace
import datetime
import hashlib
import json
import math
import os
import pathlib
import re
import subprocess
import time
import types

REFERENCE_SOURCE = "9f2b733ab18d5b9dc89e1fce9217a5c5956d0b69"
REFERENCE_PATH = ".github/scripts/run_ios_tax_phase.py"
REFERENCE_BLOB = "616b94e8435426afc975b7c78b8c55a1361f7b02"
REFERENCE_SHA256 = "f3644a14de0066f4fa33bd9b85177276be15b81712f9065bb745d989c986fb94"
PREPARED_HASHES = {
    "apps/juris-mobile/integration_test/future_application_test.dart": "8baf2d5f705614f3f35ee0b6b0d151d68ffea89087aa6a0cc5287f7aeeeeca72",
    "apps/juris-mobile/test_driver/tax_future_data_driver.dart": "3068bd6c4c3ed8f24eef3c600fcbc2a3ef7a0e1034c116da474e27f2bbc8dd19",
    "apps/juris-mobile/test_driver/tax_future_driver_contract.dart": "5a2c940d0f7747738b605a2245a27f468b579a3212c8f644377e8da40a70497f",
    "apps/juris-mobile/test_driver/tax_future_driver_guard.dart": "89213b23f22b9363e7b73e6ae389591488c3dc794548aaa158921727d913b202",
    ".github/scripts/ios_tax_future/host_assertions.py": "1ccbcbca75cc2730d170cb4b315a4e8ef91324acb65eaae8b2788721d3c22c42",
}
PHASES = ("baseline-write", "baseline-read", "workspace-future", "tax-future-unsafe",
          "import-future-unsafe", "tax-future-safe", "import-future-safe",
          "tax-future-tmp", "tax-future-bak", "restored-read")
SELECTED_TEST = "production application future data preservation"
RECEIPT_SCHEMA = "tax-ios-future-application-v1"
TRANSPORT_SCHEMA = "tax-ios-future-phase-v1"
BUILD_SCHEMA = "tax-ios-future-build-v1"
TARGET = "integration_test/future_application_test.dart"
DRIVER = "test_driver/tax_future_data_driver.dart"


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def unique(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, "Duplicate proof key")
        value[key] = item
    return value


def read_json(path, limit=64 * 1024 * 1024):
    require(not path.is_symlink() and path.is_file(), "Proof must be a regular file")
    require(path.stat().st_size <= limit, "Proof exceeds bound")
    data = path.read_bytes()
    require(len(data) <= limit, "Proof grew beyond bound")
    value = json.loads(data, object_pairs_hook=unique,
                       parse_constant=lambda value: require(False, "Nonfinite proof number"))
    require(type(value) is dict, "Proof is not an object")
    return value


def save(path, value):
    data = json.dumps(value, indent=2, allow_nan=False).encode() + b"\n"
    with path.open("xb") as stream:
        stream.write(data)
        stream.flush()


def load_reference(repository):
    """Read only the pinned Git object, never downloaded artifact code."""
    def git(*args):
        result = subprocess.run(["git", "-C", str(repository), *args], capture_output=True, timeout=10)
        require(result.returncode == 0, "Pinned Git object unavailable")
        return result.stdout
    blob = git("rev-parse", f"{REFERENCE_SOURCE}:{REFERENCE_PATH}").decode().strip()
    require(blob == REFERENCE_BLOB, "Reference Git blob changed")
    source = git("cat-file", "blob", blob)
    require(sha(source) == REFERENCE_SHA256, "Reference source hash changed")
    module = types.ModuleType("juris_pinned_ios_transport_preparation")
    module.__file__ = f"git:{REFERENCE_SOURCE}:{REFERENCE_PATH}"
    exec(compile(source, module.__file__, "exec"), module.__dict__)
    require(module.PHASES == ("write", "read", "incomplete-write", "incomplete-read", "legacy-write", "legacy-read"),
            "Reference six-phase contract changed")
    return module


def verify_prepared(directory):
    for name, expected in PREPARED_HASHES.items():
        path = directory / name
        require(path.is_file() and not path.is_symlink(), "Prepared source missing or linked")
        require(sha(path.read_bytes()) == expected, f"Prepared source changed: {name}")
    return dict(PREPARED_HASHES)


@dataclass(frozen=True)
class PhaseSpec:
    phase: str
    device: str
    source: str
    nonce: str
    evidence: pathlib.Path
    app_root: pathlib.Path
    simulator_root: pathlib.PurePosixPath

    @property
    def index(self):
        require(self.phase in PHASES, "Unexpected future phase")
        return PHASES.index(self.phase)

    @property
    def outer_seconds(self):
        self.index
        return 300

    def validate(self):
        self.index
        require(re.fullmatch(r"[0-9a-f]{40}", self.source), "Invalid source")
        require(re.fullmatch(r"[0-9]+-[0-9]+", self.nonce), "Invalid nonce")
        require(re.fullmatch(r"[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}", self.device), "Invalid owned Simulator UUID")
        require(self.evidence.is_dir() and not self.evidence.is_symlink(), "Owned evidence directory missing")
        require(self.evidence.is_absolute() and self.app_root.is_absolute(), "Absolute host paths required")
        require(self.simulator_root.is_absolute() and ".." not in self.simulator_root.parts,
                "Invalid Simulator root")


def invocation_plan(spec, adapter_path, deadline_path):
    """A future tracked caller must use this real outer process-group deadline."""
    spec.validate()
    return {"preparation_only": True, "live_entry_allowed": False,
            "outer_seconds": spec.outer_seconds,
            "argv": ["python3", str(deadline_path), "--timeout-seconds", str(spec.outer_seconds),
                     "--label", "tax-future-" + spec.phase, "--", "python3", str(adapter_path), spec.phase],
            "source": spec.source, "nonce": spec.nonce}


def preparation_invocation_plan(spec, adapter_path, deadline_path):
    spec.validate()
    require(spec.index == 0, "Preparation requires the baseline phase")
    return {"preparation_only": True, "live_entry_allowed": False, "outer_seconds": 900,
            "argv": ["python3", str(deadline_path), "--timeout-seconds", "900",
                     "--label", "tax-future-prepare", "--", "python3", str(adapter_path), "prepare"],
            "source": spec.source, "nonce": spec.nonce}


def build_command(spec):
    return ["flutter", "build", "ios", "--verbose", "--simulator", "--debug", "--no-pub",
            f"--target={TARGET}", f"--dart-define=JURIS_ACCEPTANCE_SOURCE_SHA={spec.source}",
            f"--dart-define=JURIS_ACCEPTANCE_RUN_NONCE={spec.nonce}", "-d", spec.device]


def driver_environment(spec, pid, uri):
    return {"JURIS_FUTURE_PHASE": spec.phase, "JURIS_ACCEPTANCE_SOURCE_SHA": spec.source,
            "JURIS_ACCEPTANCE_RUN_NONCE": spec.nonce, "JURIS_FUTURE_EXPECTED_PID": str(pid),
            "JURIS_FUTURE_OUTPUT": str(spec.evidence), "VM_SERVICE_URL": uri}


def direct_driver_start(spec, sdk, pid, uri, preparation_sha, started_at):
    return {"schema": "tax-ios-future-direct-driver-v1", "source_sha": spec.source,
            "run_nonce": spec.nonce, "phase": spec.phase, "runner_pid": pid,
            "driver_sdk": sdk, "preparation_sha256": preparation_sha,
            "argv": [sdk["dart"], DRIVER], "cwd": str(spec.app_root),
            "environment": driver_environment(spec, pid, uri), "started_at": started_at,
            "status": "started", "runtime_acceptance": False}


def preparation_gate(spec, tools, external, authorize=None):
    synthetic = (getattr(external, "synthetic_only", None) is True and
                 getattr(tools, "synthetic_only", None) is True)
    require(synthetic or (getattr(external, "synthetic_only", None) is False and
                         getattr(tools, "synthetic_only", None) is False and
                         authorize is not None and authorize(spec, tools, external) is True),
            "Live entry refused without checked-source authorization")
    require(tools.reference_pin == (REFERENCE_SOURCE, REFERENCE_BLOB, REFERENCE_SHA256), "Generic transport is not pinned")
    require(external.prepared_hashes == PREPARED_HASHES, "Prepared target/driver identities changed")
    spec.validate()


def prepare_build(spec, tools, external, *, clock=time.monotonic, authorize=None):
    """Prepare once under a separate outer deadline; no installation or launch."""
    preparation_gate(spec, tools, external, authorize)
    require(spec.index == 0, "Preparation requires the baseline phase")
    started = clock()
    def current():
        require(not external.cancelled and clock() - started < 900, "Build deadline/cancellation expired")
    current()
    paths = [spec.evidence / name for name in
             ("prepare-start.json", "prepare.json", "prepared-bundle.json")]
    require(not any(path.exists() or path.is_symlink() for path in paths), "Build preparation evidence already exists")
    sdk = tools.driver_sdk_identity()
    tools.validate_driver_sdk(sdk)
    current()
    start = {"schema": BUILD_SCHEMA, "source_sha": spec.source, "run_nonce": spec.nonce,
             "simulator": spec.device, "target": TARGET, "argv": build_command(spec),
             "driver_sdk": sdk,
             "source_files": dict(PREPARED_HASHES), "host_pid": os.getpid(),
             "started_at": tools.utc_now().isoformat(), "timeout_seconds": 900,
             "status": "started", "build_completed": False, "runtime_acceptance": False}
    save(paths[0], start)
    result = external.build(start["argv"], spec.app_root, 900)
    current()
    require(type(result.returncode) is int and result.returncode == 0, "Flutter preparation build failed")
    bundle = spec.app_root / "build/ios/iphonesimulator/Runner.app"
    require(bundle.is_dir() and not bundle.is_symlink(), "Prepared application missing or linked")
    built = tools.manifest(bundle)
    current()
    require(type(built) is bytes and len(built) <= 64 * 1024 * 1024, "Prepared manifest exceeds bound")
    with paths[2].open("xb") as stream:
        stream.write(built)
    terminal = {**start, "status": "completed", "build_completed": True, "exit_code": 0,
                "completed_at": tools.utc_now().isoformat(), "elapsed_seconds": clock() - started,
                "bundle_manifest_sha256": sha(built)}
    current()
    save(paths[1], terminal)
    return terminal


def validate_preparation(spec, built):
    start = read_json(spec.evidence / "prepare-start.json")
    terminal_path = spec.evidence / "prepare.json"
    terminal = read_json(terminal_path)
    require(start["schema"] == terminal["schema"] == BUILD_SCHEMA, "Wrong preparation schema")
    require(start["status"] == "started" and start["build_completed"] is False and "exit_code" not in start,
            "Invalid preparation start")
    for key in ("schema", "source_sha", "run_nonce", "simulator", "target", "argv", "source_files",
                "driver_sdk", "host_pid", "started_at", "timeout_seconds", "runtime_acceptance"):
        require(start[key] == terminal[key], "Preparation start/terminal identity differs")
    require(start["source_sha"] == spec.source and start["run_nonce"] == spec.nonce and
            start["simulator"] == spec.device, "Stale preparation source/nonce/Simulator")
    require(start["target"] == TARGET and start["argv"] == build_command(spec) and
            start["source_files"] == PREPARED_HASHES, "Unexpected preparation build inputs")
    require(start["runtime_acceptance"] is False and start["timeout_seconds"] == 900,
            "Invalid preparation scope/deadline")
    require(type(start["host_pid"]) is int and start["host_pid"] > 0, "Invalid preparation host PID")
    require(terminal["status"] == "completed" and terminal["build_completed"] is True and
            type(terminal["exit_code"]) is int and terminal["exit_code"] == 0, "Preparation build did not complete")
    began, ended = (datetime.datetime.fromisoformat(value) for value in
                    (start["started_at"], terminal["completed_at"]))
    require(began.tzinfo is not None and ended.tzinfo is not None and began <= ended, "Invalid preparation timestamps")
    elapsed = terminal["elapsed_seconds"]
    require(type(elapsed) in (int, float) and math.isfinite(elapsed) and 0 <= elapsed < 900,
            "Invalid preparation elapsed time")
    path = spec.evidence / "prepared-bundle.json"
    require(path.is_file() and not path.is_symlink() and path.stat().st_size <= 64 * 1024 * 1024,
            "Prepared manifest missing or linked")
    require(path.read_bytes() == built and terminal["bundle_manifest_sha256"] == sha(built), "Prepared bundle changed")
    return sha(terminal_path.read_bytes())


def validate_receipt(receipt, spec, pid, prior):
    require(receipt.get("schema") == RECEIPT_SCHEMA, "Wrong future receipt schema")
    require(receipt.get("selected_test") == SELECTED_TEST, "Selected future test absent")
    require(receipt.get("phase") == receipt.get("completed_phase") == spec.phase,
            "Wrong completed phase")
    require(type(receipt.get("phase_index")) is int and receipt["phase_index"] == spec.index, "Wrong phase index")
    require(receipt.get("source_sha") == spec.source and receipt.get("run_nonce") == spec.nonce,
            "Receipt source/nonce mismatch")
    require(type(receipt.get("pid")) is int and receipt["pid"] == pid, "Receipt PID mismatch")
    require(pid > 0 and pid not in prior, "Runner PID reused")
    require(receipt.get("previous_pid") == (prior[-1] if prior else None), "Broken previous PID chain")
    require(receipt.get("platform") == "ios" and receipt.get("entry_method") == "programmatic_flutter_test",
            "Wrong platform/input evidence")
    require(receipt.get("interruption_evidence") is False, "Future fixture is not interruption evidence")
    image = spec.evidence / f"{spec.phase}-future.png"
    require(image.is_file() and not image.is_symlink(), "Actual screenshot missing")
    require(image.stat().st_size <= 4 * 1024 * 1024, "Screenshot exceeds bound")
    data = image.read_bytes()
    require(57 <= len(data) <= 4 * 1024 * 1024 and data.startswith(b"\x89PNG\r\n\x1a\n"), "Invalid screenshot")
    require(receipt.get("screenshot") == {"filename": image.name, "bytes": len(data), "sha256": sha(data)},
            "Screenshot identity mismatch")


def run_preparation(spec, tools, external, *, clock=time.monotonic, authorize=None):
    """Run one phase with explicit synthetic tools or checked real adapters."""
    preparation_gate(spec, tools, external, authorize)
    started = clock()
    def current():
        require(not external.cancelled and clock() - started < spec.outer_seconds, "Phase deadline/cancellation expired")
    def call(fn, *args, **kwargs):
        current()
        result = fn(*args, **kwargs)
        current()
        return result
    current()
    for phase in PHASES[spec.index:]:
        for suffix in (".json", "-transport.json", "-future.png", "-input-bundle.json"):
            require(not (spec.evidence / f"{phase}{suffix}").exists(), "Current/later proof already exists")
    previous = []
    earlier_records = []
    for phase in PHASES[:spec.index]:
        record = read_json(spec.evidence / f"{phase}-transport.json")
        require(record.get("schema") == TRANSPORT_SCHEMA and record.get("transport_complete") is True,
                "Earlier transport not complete")
        require(record.get("source_sha") == spec.source and record.get("run_nonce") == spec.nonce and
                record.get("phase") == phase and record.get("simulator") == spec.device, "Earlier identity changed")
        require(record.get("previous_pid") == (previous[-1] if previous else None), "Earlier process chain changed")
        pid = record.get("pid")
        require(type(pid) is int and pid > 0 and pid not in previous and record.get("process_absent") is True,
                "Earlier process absence missing")
        prior_path = spec.evidence / f"{phase}.json"
        prior_receipt = read_json(prior_path)
        require(record.get("receipt_sha256") == sha(prior_path.read_bytes()), "Earlier receipt bytes changed")
        validate_receipt(prior_receipt, replace(spec, phase=phase), pid, previous)
        previous.append(pid)
        earlier_records.append(record)
    bundle = spec.app_root / "build/ios/iphonesimulator/Runner.app"
    built = call(tools.manifest, bundle)
    preparation_sha = validate_preparation(spec, built)
    sdk = call(tools.driver_sdk_identity)
    tools.validate_driver_sdk(sdk)
    require(sdk == read_json(spec.evidence / "prepare.json")["driver_sdk"],
            "Driver SDK changed after application preparation")
    current()
    require(all(record.get("preparation_sha256") == preparation_sha for record in earlier_records),
            "Earlier preparation identity changed")
    require(all(record.get("driver_sdk") == sdk for record in earlier_records), "Earlier driver SDK changed")
    input_path = spec.evidence / f"{spec.phase}-input-bundle.json"
    with input_path.open("xb") as stream:
        stream.write(built)
    require((spec.evidence / "baseline-write-input-bundle.json").read_bytes() == built, "Build bundle changed")
    require(all(record.get("bundle_manifest_sha256") == sha(built) for record in earlier_records),
            "Earlier transport bundle identity changed")
    inventory = call(tools.command, ["ps", "-axo", "pid=,comm="]).stdout.decode("utf-8")
    require(not any(f"/Devices/{spec.device}/" in line and line.rstrip().endswith("/Runner.app/Runner")
                    for line in inventory.splitlines()), "Unexpected pre-existing isolated Runner")
    if spec.index == 0:
        call(tools.install_bundle, spec, bundle, built, timeout_seconds=120)
    else:
        first_install = read_json(spec.evidence / "baseline-write-install.json", 1024 * 1024)
        require(first_install.get("installation_completed") is True and first_install.get("exit_code") == 0 and
                first_install.get("source_sha") == spec.source and first_install.get("run_nonce") == spec.nonce and
                first_install.get("simulator") == spec.device and
                first_install.get("bundle_manifest_sha256") == sha(built), "First installation proof missing")
        save(spec.evidence / f"{spec.phase}-installation-reuse.json", {
            "installed_again": False, "first_install_sha256": sha((spec.evidence / "baseline-write-install.json").read_bytes()),
            "source_sha": spec.source, "run_nonce": spec.nonce, "phase": spec.phase})
    parent = spec.simulator_root / spec.device / "data/Containers"
    identities = {}
    for kind, root in (("app", "Bundle/Application"), ("data", "Data/Application")):
        argv = ["xcrun", "simctl", "get_app_container", spec.device, tools.APP, kind]
        result = call(tools.command, argv, check=False)
        save(spec.evidence / f"{spec.phase}-{kind}-container-command.json", {
            "argv": argv, "exit": result.returncode,
            "stdout": result.stdout.decode("utf-8", errors="strict"),
            "stderr": result.stderr.decode("utf-8", errors="strict"),
            "source_sha": spec.source, "run_nonce": spec.nonce})
        require(result.returncode == 0, "Container query failed")
        text = result.stdout.decode("utf-8", errors="strict").strip()
        path = pathlib.PurePosixPath(text)
        require(path.is_absolute() and ".." not in path.parts and "\\" not in text and "\x00" not in text,
                "Invalid container path")
        expected = parent / root
        require((path.name == "Runner.app" and path.parent.parent == expected) if kind == "app" else path.parent == expected,
                "Container outside owned Simulator")
        identity = call(external.directory_identity, path)
        require(set(identity) == {"device", "inode"} and all(type(v) is int and v > 0 for v in identity.values()),
                "Container descriptor identity invalid")
        identities[kind] = {"path": str(path), **identity}
    baseline_identity = spec.evidence / "baseline-write-containers.json"
    if spec.index == 0:
        save(baseline_identity, identities)
    require(read_json(baseline_identity) == identities, "Bound app/data container relocated")
    require(all(record.get("containers") == identities for record in earlier_records), "Earlier container identity changed")
    installed = pathlib.PurePosixPath(identities["app"]["path"])
    copied = call(tools.manifest, installed)
    require(copied == built, "Installed bundle differs")
    with (spec.evidence / f"{spec.phase}-installed-bundle.json").open("xb") as output:
        output.write(copied)
    executable = installed / "Runner"
    call(tools.existing_runner, executable)
    # The caller owns no-follow inventory/seed operations. This mandatory seam
    # permits the original snapshot after first install but before first launch.
    hook = call(external.before_launch, spec, json.loads(json.dumps(identities)), sha(built), tuple(previous))
    require(type(hook) is dict and set(hook) == {
        "source_sha", "run_nonce", "phase", "containers", "bundle_manifest_sha256",
        "inventory_file", "inventory_sha256", "inventory_bytes", "original_snapshot", "acceptance"},
        "Prelaunch hook proof shape invalid")
    require(hook["source_sha"] == spec.source and hook["run_nonce"] == spec.nonce and hook["phase"] == spec.phase and
            hook["containers"] == identities and hook["bundle_manifest_sha256"] == sha(built) and
            hook["original_snapshot"] is (spec.index == 0) and hook["acceptance"] is False,
            "Prelaunch hook identity changed")
    require(hook["inventory_file"] == f"{spec.phase}-prelaunch-inventory.json", "Unscoped hook inventory path")
    retained_inventory = spec.evidence / hook["inventory_file"]
    read_json(retained_inventory)  # Bounded, duplicate-free retained envelope.
    inventory_bytes = retained_inventory.read_bytes()
    require(type(hook["inventory_bytes"]) is int and hook["inventory_bytes"] == len(inventory_bytes) and
            hook["inventory_sha256"] == sha(inventory_bytes), "Hook raw inventory missing or changed")
    save(spec.evidence / f"{spec.phase}-prelaunch-hook.json", hook)
    for item in identities.values():
        require(call(external.directory_identity, pathlib.PurePosixPath(item["path"])) ==
                {key: item[key] for key in ("device", "inode")}, "Container replaced during prelaunch hook")
    require(call(tools.manifest, bundle) == built and call(tools.manifest, installed) == built,
            "Bundle changed during prelaunch hook")
    call(tools.existing_runner, executable)
    predicate = f'eventType == logEvent AND processImagePath == {json.dumps(str(executable))}'
    reader = None
    pid = None
    identity = None
    primary_error = None
    complete = False
    record = None
    try:
        current()
        reader = tools.LogReader(["xcrun", "simctl", "spawn", spec.device, "log", "stream", "--style", "json",
                                  "--predicate", predicate], spec.evidence / f"{spec.phase}-system.log")
        current()
        launch_start = tools.utc_now()
        launched = call(tools.command, ["xcrun", "simctl", "launch", spec.device, tools.APP, *tools.FLAGS], check=False)
        (spec.evidence / f"{spec.phase}-launch.stdout.log").write_bytes(launched.stdout)
        (spec.evidence / f"{spec.phase}-launch.stderr.log").write_bytes(launched.stderr)
        pid = tools.launch_pid(launched)
        require(pid not in previous, "Fresh launch reused prior PID")
        call(tools.process_matches, pid, executable)
        identity = call(tools.discover, reader, tools.LogIdentity(pid, executable, launch_start), spec, spec.evidence)
        tools.authenticated_uri(identity.uri)
        call(tools.process_matches, pid, executable)
        vm = call(tools.vm_identity, identity.uri, pid)
        require(vm.get("result", {}).get("pid") == pid, "VM identity mismatch")
        save(spec.evidence / f"{spec.phase}-vm.json", vm)
        save(spec.evidence / f"{spec.phase}-launch.json", {
            "schema": "tax-ios-future-launch-v1", "phase": spec.phase,
            "source_sha": spec.source, "run_nonce": spec.nonce, "simulator": spec.device,
            "launch_started_at": launch_start.isoformat(),
            "pid": pid, "executable": str(executable), "vm_uri": identity.uri,
            "vm_pid": vm["result"]["pid"], "bundle_manifest_sha256": sha(built),
            "driver_sdk": sdk,
            "preparation_sha256": preparation_sha, "acceptance": False})
        call(reader.drain, identity, spec.evidence / f"{spec.phase}-system-events.jsonl")
        driver_start = direct_driver_start(spec, sdk, pid, identity.uri, preparation_sha, tools.utc_now().isoformat())
        save(spec.evidence / f"{spec.phase}-driver-start.json", driver_start)
        try:
            driver = call(external.drive, driver_start["argv"], driver_start["environment"],
                          spec.app_root, min(240, spec.outer_seconds - (clock() - started)))
        except BaseException as error:
            save(spec.evidence / f"{spec.phase}-driver.json", {**driver_start, "status": "failed",
                 "completed_at": tools.utc_now().isoformat(), "exit_code": None, "error": str(error)})
            raise
        save(spec.evidence / f"{spec.phase}-driver.json", {**driver_start, "status": "completed",
             "completed_at": tools.utc_now().isoformat(), "exit_code": driver.returncode})
        require(len(driver.stdout) + len(driver.stderr) <= 16 * 1024 * 1024, "Driver retained output exceeds limit")
        (spec.evidence / f"{spec.phase}-driver.stdout.log").write_bytes(driver.stdout)
        (spec.evidence / f"{spec.phase}-driver.stderr.log").write_bytes(driver.stderr)
        require(type(driver.returncode) is int and driver.returncode == 0, "Future driver failed")
        output = driver.stdout.decode("utf-8", errors="strict")
        for marker in ("All tests passed.", f"tax_future selected_test={SELECTED_TEST} phase={spec.phase} source={spec.source}",
                       f"tax_future phase={spec.phase} source={spec.source} pid={pid} evidence=complete"):
            require(marker in output, "Selected-test completion marker missing")
        receipt = read_json(spec.evidence / f"{spec.phase}.json")
        validate_receipt(receipt, spec, pid, previous)
        call(reader.drain, identity, spec.evidence / f"{spec.phase}-system-events.jsonl")
        observed = call(tools.process_matches, pid, executable)
        (spec.evidence / f"{spec.phase}-process.txt").write_bytes(observed)
        current()  # A late RPC must not authorize a terminate after expiration.
        with (spec.evidence / "process.log").open("a", encoding="utf-8") as log:
            log.write(f"phase={spec.phase} driver_exit=0\n")
            log.write(f"phase={spec.phase} event=terminate pid={pid}\n")
            log.flush()
            call(tools.command, ["xcrun", "simctl", "terminate", spec.device, tools.APP])
            call(tools.stopped, pid)
            log.write(f"phase={spec.phase} event=process_absent pid={pid}\n")
        call(reader.close)
        call(reader.drain, identity, spec.evidence / f"{spec.phase}-system-events.jsonl", closing=True)
        require(call(tools.manifest, bundle) == built and call(tools.manifest, installed) == built,
                "Bundle changed during application phase")
        for item in identities.values():
            require(call(external.directory_identity, pathlib.PurePosixPath(item["path"])) ==
                    {key: item[key] for key in ("device", "inode")}, "Container replaced during phase")
        record = {"schema": TRANSPORT_SCHEMA, "phase": spec.phase, "phase_index": spec.index,
                  "source_sha": spec.source, "run_nonce": spec.nonce, "simulator": spec.device,
                  "pid": pid, "previous_pid": previous[-1] if previous else None,
                  "executable": str(executable), "vm_pid": vm["result"]["pid"],
                  "receipt_sha256": sha((spec.evidence / f"{spec.phase}.json").read_bytes()),
                  "selected_test": SELECTED_TEST,
                  "driver_sdk": sdk,
                  "preparation_sha256": preparation_sha,
                  "prelaunch_hook_sha256": sha((spec.evidence / f"{spec.phase}-prelaunch-hook.json").read_bytes()),
                  "bundle_manifest_sha256": sha(built), "containers": identities, "process_absent": True,
                  "transport_complete": True, "runtime_acceptance": False,
                  "remaining": ["host raw/semantic assertions", "native export audits", "cleanup", "actual macOS execution"]}
        complete = True
    except BaseException as error:
        primary_error = error
        if pid is not None:
            try:
                tools.live_failure_probe(spec, spec.evidence, pid, executable)
            except BaseException as probe_error:
                save(spec.evidence / f"{spec.phase}-probe-failure.json", {"error": str(probe_error), "acceptance": False})
        raise
    finally:
        try:
            if reader is not None:
                reader.close()
            if reader is not None and identity is not None:
                reader.drain(identity, spec.evidence / f"{spec.phase}-system-events.jsonl", closing=True)
        except BaseException as error:
            complete = False
            save(spec.evidence / f"{spec.phase}-cleanup-failure.json", {"error": str(error), "acceptance": False})
            if primary_error is None:
                raise
    current()
    require(complete, "Transport did not complete")
    save(spec.evidence / f"{spec.phase}-transport.json", record)
    return record


if __name__ == "__main__":
    raise SystemExit("Preparation only: live entry refused before canonical integration.")
