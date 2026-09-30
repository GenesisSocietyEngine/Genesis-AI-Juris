#!/usr/bin/env python3
"""Launch one isolated application phase using its authenticated system log.

The caller retains the outer 900/300-second process-group deadline. This helper
never guesses a VM URI from a port and never changes VM authentication.
"""
import argparse
import codecs
import datetime
import hashlib
import json
import os
import pathlib
import queue
import re
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request

APP = "com.genesissocietyengine.jurisMobile"
TEST = "production application tax journey across process restart"
PHASES = ("write", "read", "incomplete-write", "incomplete-read", "legacy-write", "legacy-read")
TARGET = "integration_test/native_tax_application_test.dart"
FLAGS = ("--enable-dart-profiling", "--disable-vm-service-publication", "--start-paused",
         "--enable-checked-mode", "--verify-entry-points")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def manifest(bundle):
    result = []
    for path in sorted(bundle.rglob("*"), key=lambda p: p.relative_to(bundle).as_posix()):
        name = path.relative_to(bundle).as_posix()
        if path.is_symlink():
            result.append({"path": name, "symlink": str(path.readlink())})
        elif path.is_file():
            data = path.read_bytes()
            result.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    require(any(entry["path"] == "Runner" for entry in result), "Bundle lacks Runner")
    return json.dumps(result, sort_keys=True, separators=(",", ":")).encode() + b"\n"


def authenticated_uri(value):
    uri = urllib.parse.urlsplit(value)
    require(uri.scheme == "http" and uri.hostname in ("127.0.0.1", "::1"), "VM URI must be loopback HTTP")
    require(uri.username is None and uri.password is None and not uri.query and not uri.fragment,
            "VM URI cannot contain credentials, query or fragment")
    require(uri.port is not None and 1 <= uri.port <= 65535, "VM URI port invalid")
    require(re.fullmatch(r"/[A-Za-z0-9_=-]+/", uri.path) is not None, "VM URI requires complete authentication path")
    require(uri.netloc == (f"[{uri.hostname}]:{uri.port}" if uri.hostname == "::1" else f"{uri.hostname}:{uri.port}"),
            "VM URI authority must be canonical")
    return value


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)


class JsonLogObjects:
    """Accept Apple's multiline object stream or array, never raw-text URIs."""
    def __init__(self):
        self.pending = ""
        self.started = False
        self.array = False
        self.closed = False
        self.after_value = False
        self.after_comma = False
        self.decoder = json.JSONDecoder(object_pairs_hook=self.unique_object)

    @staticmethod
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, "Duplicate system-log JSON key")
            result[key] = value
        return result

    def feed(self, text, *, final=False):
        self.pending += text
        values = []
        while True:
            self.pending = self.pending.lstrip()
            if not self.pending:
                break
            if not self.started:
                if "Filtering the log data using ".startswith(self.pending) and not final:
                    break
                if self.pending.startswith("Filtering the log data using "):
                    if "\n" not in self.pending:
                        break
                    _, self.pending = self.pending.split("\n", 1)
                    continue
                # A header or '[' is not a subscription-readiness guarantee.
                if self.pending[0] == "[":
                    self.array = True
                    self.pending = self.pending[1:]
                self.started = True
                continue
            require(not self.closed, "Unexpected data after system-log array")
            if self.pending[0] == ",":
                require(self.after_value and not self.after_comma, "Unexpected system-log separator")
                self.pending = self.pending[1:]
                self.after_value, self.after_comma = False, True
                continue
            if self.pending[0] == "]":
                require(self.array and not self.after_comma, "Unexpected system-log array end")
                self.closed = True
                self.pending = self.pending[1:]
                continue
            require(self.pending[0] == "{", "Unexpected system-log data")
            require(not self.array or not self.after_value, "Missing system-log array separator")
            try:
                value, end = self.decoder.raw_decode(self.pending)
            except json.JSONDecodeError:
                break  # A split object is retried after the next bounded chunk.
            require(type(value) is dict, "System-log record is not an object")
            values.append(value)
            self.after_value, self.after_comma = True, False
            self.pending = self.pending[end:]
        if final:
            require(not self.pending.strip(), "Malformed or truncated system-log JSON")
            require(not self.after_comma, "Truncated system-log separator")
        return values


class LogIdentity:
    def __init__(self, pid, executable, started):
        self.pid = pid
        self.executable = str(executable)
        self.started = started
        self.uri = None
        self.event = None
        self.key = None
        self.boot_uuid = None
        self.origins = []
        self.observations = []

    def observe(self, event, origin):
        marker = "The Dart VM service is listening on "
        message = event.get("eventMessage")
        if not isinstance(message, str) or marker not in message:
            return
        require(event.get("eventType") == "logEvent", "Wrong VM log event type")
        require(type(event.get("processID")) is int and event["processID"] == self.pid,
                "VM log PID differs from fresh launch")
        require(event.get("processImagePath") == self.executable, "VM log executable mismatch")
        timestamp = datetime.datetime.fromisoformat(event["timestamp"])
        require(timestamp.tzinfo is not None and self.started <= timestamp <= utc_now(),
                "VM log timestamp is outside fresh launch")
        match = re.fullmatch(r"(?:flutter: )?The Dart VM service is listening on (\S+)", message.strip())
        require(match is not None, "Malformed VM announcement")
        uri = authenticated_uri(match[1])
        # Actual stream/show views of one event differed in wall time by
        # 0.478788s. Both timestamps must be fresh, but the exact OS event IDs,
        # sender/thread and announcement bind the duplicate, not wall time.
        for field in ("machTimestamp", "traceID", "threadID", "senderProgramCounter"):
            value = event.get(field)
            require(type(value) is int and 0 < value <= 2**64 - 1,
                    f"Invalid VM log integer identity: {field}")
        uuid_pattern = r"[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}"
        for field in ("processImageUUID", "senderImageUUID"):
            require(isinstance(event.get(field), str) and
                    re.fullmatch(uuid_pattern, event[field]) is not None,
                    f"Invalid VM log image identity: {field}")
        sender = str(pathlib.PurePosixPath(self.executable).parent / "Frameworks/Flutter.framework/Flutter")
        require(event.get("senderImagePath") == sender, "VM log sender is not installed Flutter")
        boot = event.get("bootUUID")
        require(isinstance(boot, str) and (boot == "" or re.fullmatch(uuid_pattern, boot) is not None),
                "Invalid VM log boot identity")
        key = (event["eventType"], event["processID"], event["processImagePath"],
               event["machTimestamp"], event["traceID"], event["threadID"],
               event["senderProgramCounter"], event["processImageUUID"],
               event["senderImageUUID"], event["senderImagePath"], message.strip())
        require(self.key is None or self.key == key, "Ambiguous VM system-log identity")
        require(not boot or self.boot_uuid is None or self.boot_uuid == boot,
                "Ambiguous VM log boot identity")
        if boot:
            self.boot_uuid = boot
        self.uri, self.key = uri, key
        if self.event is None:
            self.event = event
        if origin not in self.origins:
            self.origins.append(origin)
        observation = {"origin": origin, "event": event}
        if observation not in self.observations:
            self.observations.append(observation)


class LogReader:
    def __init__(self, command, output):
        require(not output.exists() and not output.with_suffix(".stderr.log").exists(),
                "System-log evidence already exists")
        self.started_at = utc_now().isoformat()
        self.process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.total_bytes = 0
        self.counter_lock = threading.Lock()
        self.events = queue.Queue()
        self.output = output
        self.threads = [threading.Thread(target=self._read, args=(channel,), daemon=True)
                        for channel in ("stdout", "stderr")]
        for thread in self.threads:
            thread.start()

    def _read(self, channel):
        decoder = codecs.getincrementaldecoder("utf-8")("strict")
        parser = JsonLogObjects()
        pipe = getattr(self.process, channel)
        destination = self.output if channel == "stdout" else self.output.with_suffix(".stderr.log")
        try:
            with destination.open("xb") as stream:
                while data := os.read(pipe.fileno(), 4096):
                    with self.counter_lock:
                        self.total_bytes += len(data)
                        require(self.total_bytes <= 4 * 1024 * 1024, "Owned system log exceeds 4 MiB")
                    stream.write(data)
                    stream.flush()
                    text = decoder.decode(data)
                    if channel == "stdout":
                        for event in parser.feed(text):
                            self.events.put((utc_now().isoformat(), event))
                tail = decoder.decode(b"", final=True)
                if channel == "stdout":
                    for event in parser.feed(tail, final=True):
                        self.events.put((utc_now().isoformat(), event))
            self.events.put((channel, None))
        except BaseException as error:
            self.events.put(error)

    def drain(self, identity, evidence, *, closing=False):
        if not closing:
            require(self.process.poll() is None, "Owned system-log reader exited early")
        while True:
            try:
                event = self.events.get_nowait()
            except queue.Empty:
                return
            if isinstance(event, BaseException):
                raise event
            arrival, value = event
            if value is None:
                require(closing, "Owned system-log stream ended early")
                continue
            with evidence.open("a", encoding="utf-8") as output:
                output.write(json.dumps({"arrival_utc": arrival, "event": value}) + "\n")
            identity.observe(value, "stream")

    def close(self):
        # Direct child only; it remains within the caller's task-owned group.
        if self.process.poll() is None:
            self.process.terminate()
        try:
            self.process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=3)
        for thread in self.threads:
            thread.join(timeout=3)
        require(not any(thread.is_alive() for thread in self.threads), "Owned log reader did not close")
        self.process.stdout.close()
        self.process.stderr.close()


def launch_pid(result):
    text = result.stdout.decode("utf-8", errors="strict").strip()
    match = re.fullmatch(re.escape(APP) + r": ([1-9][0-9]*)", text)
    require(result.returncode == 0 and match is not None, "Ordinary launch did not return exactly one PID")
    return int(match[1])


def discover(reader, identity, args, evidence, seconds=60):
    deadline = time.monotonic() + seconds
    events = evidence / f"{args.phase}-system-events.jsonl"
    reader.drain(identity, events)
    # Do not infer readiness from the stream header. The exact new PID/path and
    # timestamp gate makes a short retrospective query cover any subscription race.
    predicate = f"processID == {identity.pid} AND processImagePath == {json.dumps(identity.executable)}"
    query = ["xcrun", "simctl", "spawn", args.device, "log", "show", "--last", "2m",
             "--style", "json", "--predicate", predicate]
    backfill = {"command": query, "started_at": utc_now().isoformat()}
    try:
        result = command(query, timeout=min(20, seconds), check=False)
        backfill.update(status="completed", exit_code=result.returncode)
        stdout, stderr = result.stdout, result.stderr
    except subprocess.TimeoutExpired as error:
        backfill.update(status="timeout", error=str(error))
        stdout, stderr = error.output or b"", error.stderr or b""
    if len(stdout) + len(stderr) > 1024 * 1024:
        stdout, stderr = stdout[:512 * 1024], stderr[:512 * 1024]
        backfill.update(status="output_limit", exit_code=None)
    (evidence / f"{args.phase}-backfill.json").write_bytes(stdout)
    (evidence / f"{args.phase}-backfill.stderr.log").write_bytes(stderr)
    backfill["completed_at"] = utc_now().isoformat()
    write_json(evidence / f"{args.phase}-backfill-status.json", backfill)
    if backfill.get("exit_code") == 0:
        parser = JsonLogObjects()
        for event in parser.feed(stdout.decode("utf-8", errors="strict"), final=True):
            identity.observe(event, "backfill")
        require(not parser.array or parser.closed, "Truncated backfill array")
    while True:
        reader.drain(identity, events)
        require(time.monotonic() < deadline, "Fresh system-log VM discovery timed out")
        if identity.uri is not None:
            write_json(evidence / f"{args.phase}-discovery.json", {
                "launch_started_at": identity.started.isoformat(), "pid": identity.pid,
                "event": identity.event, "origins": identity.origins,
                "observations": identity.observations,
                "backfill_status": backfill, "verified_at": utc_now().isoformat(),
            })
            return identity
        time.sleep(0.1)


def live_failure_probe(args, evidence, pid, executable):
    """Read-only evidence before reader cleanup; never terminate failed Runner."""
    record = {"pid": pid, "acceptance": False, "captured_at": utc_now().isoformat()}
    try:
        observed = process_matches(pid, executable, timeout=5)
        (evidence / f"{args.phase}-failure-process.txt").write_bytes(observed)
        record["process_matched"] = True
        result = command(["xcrun", "simctl", "io", args.device, "screenshot",
                          str(evidence / f"{args.phase}-failure-live.png")], timeout=10, check=False)
        record["screenshot_exit"] = result.returncode
        record["screenshot_stderr"] = result.stderr.decode("utf-8", errors="replace")
    except BaseException as error:
        record["error"] = str(error)
    write_json(evidence / f"{args.phase}-failure-live.json", record)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("VM service redirects are forbidden")


def vm_identity(uri, expected_pid):
    authenticated_uri(uri)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(uri + "getVM", timeout=10) as response:
        require(response.status == 200 and response.url == uri + "getVM", "Unexpected VM HTTP response")
        data = response.read(1024 * 1024 + 1)
    require(len(data) <= 1024 * 1024, "VM response exceeds 1 MiB")
    value = json.loads(data)
    require(value.get("jsonrpc") == "2.0" and "error" not in value, "VM RPC failed")
    vm = value.get("result", {})
    require(vm.get("type") == "VM" and type(vm.get("pid")) is int and vm["pid"] == expected_pid,
            "VM PID differs from fresh launched Runner")
    return value


def command(args, timeout=30, check=True):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    require(len(result.stdout) + len(result.stderr) <= 1024 * 1024, "Command output exceeds 1 MiB")
    if check:
        require(result.returncode == 0, f"Command failed: {args[0:3]}: {result.stderr.decode(errors='replace')}")
    return result


def install_bundle(args, bundle, built, timeout_seconds=120):
    """Bound only installation; the caller's existing phase deadline still wins."""
    require(0 < timeout_seconds <= 120, "Invalid install command deadline")
    evidence = args.evidence.resolve()
    paths = {name: evidence / f"{args.phase}-install{suffix}" for name, suffix in (
        ("start", "-start.json"), ("terminal", ".json"),
        ("stdout", ".stdout.log"), ("stderr", ".stderr.log"))}
    require(not any(path.exists() for path in paths.values()), "Install evidence already exists")
    argv = ["xcrun", "simctl", "install", args.device, str(bundle)]
    started = time.monotonic()
    identity = {
        "schema": "tax-ios-install-command-v1", "source_sha": args.source,
        "run_nonce": args.nonce, "phase": args.phase, "simulator": args.device,
        "argv": argv, "bundle_manifest_sha256": hashlib.sha256(built).hexdigest(),
        "host_pid": os.getpid(), "started_at": utc_now().isoformat(),
        "timeout_seconds": timeout_seconds, "installation_completed": False,
        "runtime_acceptance": False,
    }
    # An outer deadline may kill us during installation. Never infer a terminal
    # command exit from a later container query or from this durable start record.
    write_json(paths["start"], {**identity, "status": "started"})
    stdout, stderr, failure = b"", b"", None
    terminal = {**identity}
    try:
        result = subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                timeout=timeout_seconds, check=False)
        stdout, stderr = result.stdout, result.stderr
        terminal.update(status="completed", exit_code=result.returncode)
    except subprocess.TimeoutExpired as error:
        stdout, stderr, failure = error.output or b"", error.stderr or b"", error
        terminal.update(status="timeout", exit_code=None, error=str(error))
    except OSError as error:
        failure = error
        terminal.update(status="start_failed", exit_code=None, error=str(error))
    limited = len(stdout) + len(stderr) > 1024 * 1024
    if limited:
        stdout, stderr = stdout[:512 * 1024], stderr[:512 * 1024]
    paths["stdout"].write_bytes(stdout)
    paths["stderr"].write_bytes(stderr)
    terminal.update(
        completed_at=utc_now().isoformat(), elapsed_seconds=time.monotonic() - started,
        output_truncated=limited,
        stdout_sha256=hashlib.sha256(stdout).hexdigest(),
        stderr_sha256=hashlib.sha256(stderr).hexdigest(),
        installation_completed=(terminal["status"] == "completed" and
                                terminal["exit_code"] == 0 and not limited),
    )
    write_json(paths["terminal"], terminal)
    if failure is not None:
        raise failure
    require(not limited, "Install output exceeds 1 MiB")
    require(terminal["installation_completed"], "Simulator installation command failed")


def process_matches(pid, executable, timeout=30):
    result = command(["ps", "-p", str(pid), "-o", "pid=,comm="], timeout=timeout, check=False)
    text = result.stdout.decode("utf-8", errors="strict").strip()
    require(result.returncode == 0 and text.split(maxsplit=1) == [str(pid), str(executable)],
            "Launched Runner PID/executable mismatch")
    return result.stdout


def existing_runner(executable):
    result = command(["ps", "-axo", "pid=,comm="])
    for line in result.stdout.decode("utf-8", errors="strict").splitlines():
        columns = line.strip().split(maxsplit=1)
        if len(columns) == 2 and columns[1] == str(executable):
            raise RuntimeError("Unexpected existing Runner for isolated application")


def stopped(pid, seconds=5):
    limit = time.monotonic() + seconds
    while time.monotonic() < limit:
        result = command(["ps", "-p", str(pid), "-o", "pid="], check=False)
        if result.returncode == 1 and not result.stdout.strip():
            return
        require(result.returncode == 0, "Cannot establish application process state")
        time.sleep(0.25)
    raise RuntimeError("Application PID survived termination")


def validate_receipt(receipt, phase, source, nonce, pid):
    require(receipt.get("schema") == "tax-mobile-application-acceptance-v2", "Wrong receipt schema")
    require(receipt.get("phase") == receipt.get("completed_phase") == phase, "Wrong completed phase")
    require(receipt.get("source_sha") == source and receipt.get("run_nonce") == nonce, "Wrong receipt source/nonce")
    require(receipt.get("pid") == pid and type(receipt.get("pid")) is int, "Receipt PID differs from launch")
    require(receipt.get("selected_test") == TEST, "Selected test absent")


def run(args):
    evidence = args.evidence.resolve()
    require(evidence.is_dir(), "Evidence directory missing")
    require(not (evidence / f"{args.phase}.json").exists(), "Phase receipt already exists")
    bundle = pathlib.Path("build/ios/iphonesimulator/Runner.app").resolve()
    defines = [f"--dart-define=JURIS_ACCEPTANCE_SOURCE_SHA={args.source}",
               f"--dart-define=JURIS_ACCEPTANCE_RUN_NONCE={args.nonce}"]
    if args.phase == "write":
        subprocess.run(["flutter", "build", "ios", "--verbose", "--simulator", "--debug", "--no-pub",
                        f"--target={TARGET}", *defines], check=True)
    require(bundle.is_dir(), "Prebuilt application missing")
    built = manifest(bundle)
    (evidence / f"{args.phase}-input-bundle.json").write_bytes(built)
    baseline = evidence / "write-input-bundle.json"
    require(baseline.read_bytes() == built, "Application bundle changed between phases")
    # An existing app is rejected before reinstalling; installation must not mask
    # an unexpected live process or use a different isolated application's files.
    inventory = command(["ps", "-axo", "pid=,comm="]).stdout.decode("utf-8", errors="strict")
    require(not any(f"/Devices/{args.device}/" in line and line.rstrip().endswith("/Runner.app/Runner")
                    for line in inventory.splitlines()), "Unexpected pre-existing isolated Runner")
    install_bundle(args, bundle, built)
    container = command(["xcrun", "simctl", "get_app_container", args.device, APP, "app"]).stdout.decode().strip()
    expected_parent = pathlib.Path.home() / "Library/Developer/CoreSimulator/Devices" / args.device / "data/Containers/Bundle/Application"
    installed = pathlib.Path(container)
    require(installed.name == "Runner.app" and installed.parent.parent == expected_parent,
            "Installed container is outside selected Simulator")
    copied = manifest(installed)
    require(copied == built, "Installed bundle differs from built application")
    (evidence / f"{args.phase}-installed-bundle.json").write_bytes(copied)
    executable = installed / "Runner"
    existing_runner(executable)
    predicate = f'eventType == logEvent AND processImagePath == {json.dumps(str(executable))}'
    reader = LogReader(["xcrun", "simctl", "spawn", args.device, "log", "stream", "--style", "json",
                        "--predicate", predicate], evidence / f"{args.phase}-system.log")
    primary_error = None
    identity = None
    pid = None
    try:
        started = utc_now()
        launched = command(["xcrun", "simctl", "launch", args.device, APP, *FLAGS], check=False)
        (evidence / f"{args.phase}-launch.stdout.log").write_bytes(launched.stdout)
        (evidence / f"{args.phase}-launch.stderr.log").write_bytes(launched.stderr)
        pid = launch_pid(launched)
        process_matches(pid, executable)
        identity = discover(reader, LogIdentity(pid, executable, started), args, evidence)
        process_matches(identity.pid, executable)
        vm = vm_identity(identity.uri, identity.pid)
        write_json(evidence / f"{args.phase}-vm.json", vm)
        reader.drain(identity, evidence / f"{args.phase}-system-events.jsonl")
        process_matches(identity.pid, executable)
        launch = {"schema": "tax-ios-system-log-launch-v1", "phase": args.phase, "source_sha": args.source,
                  "run_nonce": args.nonce, "simulator": args.device, "app_id": APP,
                  "log_reader_pid": reader.process.pid, "pid": identity.pid, "executable": str(executable),
                  "log_reader_started_at": reader.started_at,
                  "vm_uri": identity.uri, "vm_pid": vm["result"]["pid"],
                  "bundle_manifest_sha256": hashlib.sha256(built).hexdigest(), "complete": False}
        write_json(evidence / f"{args.phase}-launch.json", launch)
        subprocess.run(["flutter", "drive", "--verbose", "--no-pub", "--keep-app-running",
                        f"--use-existing-app={identity.uri}", f"--target={TARGET}",
                        "--driver=test_driver/tax_application_driver.dart", *defines, "-d", args.device], check=True)
        receipt = json.loads((evidence / f"{args.phase}.json").read_text(encoding="utf-8"))
        validate_receipt(receipt, args.phase, args.source, args.nonce, identity.pid)
        reader.drain(identity, evidence / f"{args.phase}-system-events.jsonl")
        observed = process_matches(identity.pid, executable)
        (evidence / f"{args.phase}-process.txt").write_bytes(observed)
        with (evidence / "process.log").open("a", encoding="utf-8") as log:
            log.write(f"phase={args.phase} driver_exit=0\n")
            log.write(f"phase={args.phase} event=terminate pid={identity.pid}\n")
            log.flush()
            command(["xcrun", "simctl", "terminate", args.device, APP])
            stopped(identity.pid)
            log.write(f"phase={args.phase} event=process_absent pid={identity.pid}\n")
        reader.close()
        reader.drain(identity, evidence / f"{args.phase}-system-events.jsonl", closing=True)
        launch["complete"] = True
        write_json(evidence / f"{args.phase}-launch.json", launch)
    except BaseException as error:
        primary_error = error
        if pid is not None:
            try:
                live_failure_probe(args, evidence, pid, executable)
            except BaseException as probe_error:
                print(f"live failure probe unavailable: {probe_error}", file=sys.stderr, flush=True)
        raise
    finally:
        try:
            reader.close()
            if identity is not None:
                reader.drain(identity, evidence / f"{args.phase}-system-events.jsonl", closing=True)
        except BaseException as cleanup_error:
            print(f"system-log cleanup_incomplete: {cleanup_error}", file=sys.stderr, flush=True)
            if primary_error is None:
                raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=PHASES)
    parser.add_argument("device")
    parser.add_argument("evidence", type=pathlib.Path)
    parser.add_argument("source")
    parser.add_argument("nonce")
    args = parser.parse_args()
    require(re.fullmatch(r"[0-9A-Fa-f-]{36}", args.device) is not None, "Invalid Simulator ID")
    require(re.fullmatch(r"[0-9a-f]{40}", args.source) is not None, "Invalid source SHA")
    require(re.fullmatch(r"[0-9]+-[0-9]+", args.nonce) is not None, "Invalid run nonce")
    run(args)


if __name__ == "__main__":
    main()
