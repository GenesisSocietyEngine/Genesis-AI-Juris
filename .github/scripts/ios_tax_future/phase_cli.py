#!/usr/bin/env python3
"""One checked-source future application phase, invoked by phase_deadline.py."""
import argparse
import hashlib
import pathlib
import re
import signal
import subprocess
import sys
import threading
import time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))  # Only source-owned sibling modules, never artifact code.
import future_phase_transport as t
import host_command
from live_adapter import ActualExternal, ActualTools, LiveAuthorization, authorize


def audit(spec, repository):
    def read(argv):
        result = subprocess.run(argv, capture_output=True, timeout=10, check=True)
        t.require(not result.stderr, "Unexpected tool discovery diagnostic")
        return result.stdout.decode("utf-8").strip()
    version = read(["rustc", "-vV"])
    host = re.findall(r"^host: ([A-Za-z0-9_.-]+)$", version, re.MULTILINE)
    t.require(len(host) == 1, "Missing Rust host")
    nm = pathlib.Path(read(["rustc", "--print", "sysroot"])) / "lib/rustlib" / host[0] / "bin/llvm-nm"
    lipo = read(["xcrun", "--find", "lipo"])
    archive = spec.app_root / "ios/Generated/libjuris_mobile_ffi.a"
    runner = spec.app_root / "build/ios/iphonesimulator/Runner.app/Runner"
    identities = {str(path.relative_to(spec.app_root)): {"bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path in (archive, runner)}
    result = host_command.run(["bash", str(repository / ".github/scripts/verify_ios_ffi_exports.sh"),
        str(archive), str(nm), lipo], spec.app_root, 60, spec.evidence, spec.phase + "-export-command")
    t.require(result.returncode == 0 and not result.stderr, "Per-architecture export audit failed")
    with (spec.evidence / (spec.phase + "-exports.log")).open("xb") as stream:
        stream.write(result.stdout)
    t.save(spec.evidence / (spec.phase + "-binaries.json"), identities)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("prepare", *t.PHASES, "restore-original"))
    parser.add_argument("device")
    parser.add_argument("evidence", type=pathlib.Path)
    parser.add_argument("source")
    parser.add_argument("nonce")
    args = parser.parse_args()
    repository = HERE.parents[2]
    first = t.PhaseSpec(t.PHASES[0], args.device, args.source, args.nonce,
        args.evidence.resolve(), repository / "apps/juris-mobile",
        pathlib.PurePosixPath(pathlib.Path.home()) / "Library/Developer/CoreSimulator/Devices")
    spec = first if args.phase in ("prepare", "restore-original") else t.replace(first, phase=args.phase)
    authority = LiveAuthorization(repository, args.source, args.nonce, args.device)
    authority.validate(spec)
    cancelled = threading.Event()
    started = time.monotonic()
    seconds = 900 if args.phase == "prepare" else 300

    def guard():
        return not cancelled.is_set() and time.monotonic() - started < seconds

    def interrupt(number, _frame):
        cancelled.set()
        raise InterruptedError(f"Phase cancelled by signal {number}")

    for number in (signal.SIGTERM, signal.SIGINT):
        signal.signal(number, interrupt)
    tools = ActualTools(authority)
    if args.phase == "prepare":
        external = ActualExternal(authority, spec, None, cancelled)
        t.prepare_build(spec, tools, external, authorize=authorize)
        print("tax_future build_preparation=complete runtime_acceptance=false", flush=True)
        return
    from future_host_bindings import HostBindings
    bindings = (HostBindings(first, guard=guard) if args.phase == t.PHASES[0] else
                HostBindings.resume(first, args.phase, guard=guard))
    if args.phase == "restore-original":
        bindings.restore_original()
        print("tax_future original_authoring_restored=true simulator_cleanup=pending", flush=True)
        return
    external = ActualExternal(authority, spec, bindings, cancelled)
    record = t.run_preparation(spec, tools, external, authorize=authorize)
    bindings.after_phase(spec, record)
    t.require(guard(), "Phase expired before archive audit")
    audit(spec, repository)
    t.require(guard(), "Phase expired after archive audit")
    print(f"tax_future phase={args.phase} host_semantics=passed exports=passed runtime_acceptance=false", flush=True)


if __name__ == "__main__":
    main()
