#!/usr/bin/env python3
"""Launch one isolated application phase through its owned authenticated console.

The caller retains the outer 900/300-second process-group deadline. This helper
never guesses a VM URI from a port and never changes VM authentication.
"""
import argparse
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


class ConsoleIdentity:
    def __init__(self):
        self.pid = None
        self.uri = None

    def line(self, value):
        pid = re.fullmatch(re.escape(APP) + r": ([1-9][0-9]*)", value.strip())
        if pid:
            require(self.pid is None, "Duplicate console PID")
            self.pid = int(pid.group(1))
        marker = "The Dart VM service is listening on "
        if marker in value:
            require(self.uri is None, "Duplicate console VM URI")
            self.uri = authenticated_uri(value.split(marker, 1)[1].strip())


class Console:
    def __init__(self, command, output):
        require(not output.exists(), "Console evidence already exists")
        self.process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        self.events = queue.Queue()
        self.parser = ConsoleIdentity()
        self.output = output
        self.thread = threading.Thread(target=self._read, daemon=True)
        self.thread.start()

    def _read(self):
        pending = b""
        count = 0
        try:
            with self.output.open("xb") as stream:
                while data := os.read(self.process.stdout.fileno(), 4096):
                    count += len(data)
                    require(count <= 4 * 1024 * 1024, "Owned console exceeds 4 MiB")
                    stream.write(data)
                    stream.flush()
                    sys.stdout.buffer.write(data)
                    sys.stdout.buffer.flush()
                    pending += data
                    while b"\n" in pending:
                        line, pending = pending.split(b"\n", 1)
                        self.events.put(line.rstrip(b"\r").decode("utf-8", errors="strict"))
                if pending:
                    self.events.put(pending.decode("utf-8", errors="strict"))
            self.events.put(None)
        except BaseException as error:
            self.events.put(error)

    def identity(self, seconds=60):
        result = self.parser
        limit = time.monotonic() + seconds
        while result.pid is None or result.uri is None:
            remaining = limit - time.monotonic()
            require(remaining > 0, "Fresh console VM discovery timed out")
            try:
                event = self.events.get(timeout=remaining)
            except queue.Empty:
                raise RuntimeError("Fresh console VM discovery timed out") from None
            if isinstance(event, BaseException):
                raise event
            require(event is not None, "Owned console closed before complete identity")
            result.line(event)
        require(self.process.poll() is None, "Owned console exited before attachment")
        return result

    def ensure_live(self):
        require(self.process.poll() is None, "Owned console exited before application termination")
        while True:
            try:
                event = self.events.get_nowait()
            except queue.Empty:
                return
            if isinstance(event, BaseException):
                raise event
            require(event is not None, "Owned console stream ended early")
            self.parser.line(event)

    def close(self):
        # Direct child only; it remains within the caller's task-owned group.
        if self.process.poll() is None:
            self.process.terminate()
        try:
            self.process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=3)
        self.thread.join(timeout=3)
        require(not self.thread.is_alive(), "Owned console reader did not close")
        self.process.stdout.close()
        while True:
            try:
                event = self.events.get_nowait()
            except queue.Empty:
                break
            if isinstance(event, BaseException):
                raise event
            if event is not None:
                self.parser.line(event)


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


def process_matches(pid, executable):
    result = command(["ps", "-p", str(pid), "-o", "pid=,comm="], check=False)
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
    command(["xcrun", "simctl", "install", args.device, str(bundle)])
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
    console = Console(["xcrun", "simctl", "launch", "--console-pty", args.device, APP, *FLAGS],
                      evidence / f"{args.phase}-console.log")
    primary_error = None
    try:
        identity = console.identity()
        process_matches(identity.pid, executable)
        vm = vm_identity(identity.uri, identity.pid)
        write_json(evidence / f"{args.phase}-vm.json", vm)
        console.ensure_live()
        process_matches(identity.pid, executable)
        launch = {"schema": "tax-ios-console-launch-v1", "phase": args.phase, "source_sha": args.source,
                  "run_nonce": args.nonce, "simulator": args.device, "app_id": APP,
                  "console_pid": console.process.pid, "pid": identity.pid, "executable": str(executable),
                  "vm_uri": identity.uri, "vm_pid": vm["result"]["pid"],
                  "bundle_manifest_sha256": hashlib.sha256(built).hexdigest(), "complete": False}
        write_json(evidence / f"{args.phase}-launch.json", launch)
        subprocess.run(["flutter", "drive", "--verbose", "--no-pub", "--keep-app-running",
                        f"--use-existing-app={identity.uri}", f"--target={TARGET}",
                        "--driver=test_driver/tax_application_driver.dart", *defines, "-d", args.device], check=True)
        receipt = json.loads((evidence / f"{args.phase}.json").read_text(encoding="utf-8"))
        validate_receipt(receipt, args.phase, args.source, args.nonce, identity.pid)
        console.ensure_live()
        observed = process_matches(identity.pid, executable)
        (evidence / f"{args.phase}-process.txt").write_bytes(observed)
        with (evidence / "process.log").open("a", encoding="utf-8") as log:
            log.write(f"phase={args.phase} driver_exit=0\n")
            log.write(f"phase={args.phase} event=terminate pid={identity.pid}\n")
            log.flush()
            command(["xcrun", "simctl", "terminate", args.device, APP])
            stopped(identity.pid)
            log.write(f"phase={args.phase} event=process_absent pid={identity.pid}\n")
        console.close()
        launch["complete"] = True
        write_json(evidence / f"{args.phase}-launch.json", launch)
    except BaseException as error:
        primary_error = error
        raise
    finally:
        try:
            console.close()
        except BaseException as cleanup_error:
            print(f"console cleanup_incomplete: {cleanup_error}", file=sys.stderr, flush=True)
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
