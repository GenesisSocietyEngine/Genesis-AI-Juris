"""Concrete macOS adapters for the source-owned future application harness.

This module has no CLI entry. The parent must use phase_deadline.py for each
build/phase, then require the separately replayed host, audit and cleanup gates.
"""
from dataclasses import dataclass
import os
import pathlib
import subprocess
import sys

import future_phase_transport as t
import host_command


@dataclass(frozen=True)
class LiveAuthorization:
    repository: pathlib.Path
    source: str
    nonce: str
    device: str

    def validate(self, spec):
        t.require(sys.platform == "darwin" and os.name == "posix", "Live future execution requires macOS")
        t.require(os.getpgrp() == os.getpid(), "Live adapter must lead the outer wrapper's owned group")
        spec.validate()
        t.require((spec.source, spec.nonce, spec.device) == (self.source, self.nonce, self.device),
                  "Live authorization source/nonce/device mismatch")
        t.require(spec.app_root == self.repository / "apps/juris-mobile", "Unexpected application root")
        t.require(spec.simulator_root == pathlib.PurePosixPath(pathlib.Path.home()) / "Library/Developer/CoreSimulator/Devices",
                  "Unexpected Simulator device root")
        for argv in (["rev-parse", "HEAD"], ["diff", "--quiet", "HEAD", "--"],
                     ["diff", "--cached", "--quiet", "--"]):
            result = subprocess.run(["git", "-C", str(self.repository), *argv], capture_output=True, timeout=10)
            t.require(result.returncode == 0, "Uncommitted source or unavailable Git identity")
            if argv[0] == "rev-parse":
                t.require(result.stdout.decode().strip() == self.source, "Checked-out source changed")
        t.verify_prepared(self.repository)
        # Every imported harness file must itself exist in this commit. A clean
        # tracked diff alone would not reject an untracked replacement module.
        scripts = pathlib.Path(__file__).resolve().parent
        t.require(scripts == self.repository / ".github/scripts/ios_tax_future", "Unowned helper location")
        for path in sorted(scripts.glob("*.py")):
            relative = path.relative_to(self.repository).as_posix()
            result = subprocess.run(["git", "-C", str(self.repository), "show", f"{self.source}:{relative}"],
                                    capture_output=True, timeout=10)
            t.require(result.returncode == 0 and result.stdout == path.read_bytes(), "Uncommitted helper: " + relative)
        return True


class ActualTools:
    synthetic_only = False
    reference_pin = (t.REFERENCE_SOURCE, t.REFERENCE_BLOB, t.REFERENCE_SHA256)
    METHODS = frozenset(("APP", "FLAGS", "utc_now", "command", "install_bundle", "existing_runner",
        "LogReader", "LogIdentity", "launch_pid", "process_matches", "discover", "authenticated_uri",
        "vm_identity", "stopped", "live_failure_probe", "driver_sdk_identity", "validate_driver_sdk"))

    def __init__(self, authorization):
        self.authorization = authorization
        self.reference = t.load_reference(authorization.repository)

    def __getattr__(self, name):
        if name not in self.METHODS:
            raise AttributeError(name)
        return getattr(self.reference, name)

    def manifest(self, path):
        # The generic implementation needs rglob/read_bytes. Container grammar
        # validation deliberately uses PurePosixPath in the transport contract.
        return self.reference.manifest(pathlib.Path(path))


class ActualExternal:
    synthetic_only = False

    def __init__(self, authorization, spec, bindings, cancellation):
        self.authorization, self.spec = authorization, spec
        self.bindings, self.cancellation = bindings, cancellation
        self.prepared_hashes = t.verify_prepared(authorization.repository)

    @property
    def cancelled(self):
        return self.cancellation.is_set()

    def directory_identity(self, path):
        t.require(not self.cancelled, "Cancellation forbids filesystem observation")
        return self.bindings.access.identity(path)

    def before_launch(self, spec, containers, bundle, prior):
        t.require(not self.cancelled, "Cancellation forbids prelaunch changes")
        return self.bindings.before_launch(spec, containers, bundle, prior)

    def build(self, argv, cwd, seconds):
        t.require(not self.cancelled and self.spec.index == 0 and argv == t.build_command(self.spec),
                  "Unexpected or cancelled preparation command")
        t.require(cwd == self.spec.app_root and seconds == 900, "Unexpected build directory/deadline")
        return host_command.run(argv, cwd, seconds, self.spec.evidence, "prepare-command",
                                max_bytes=64 * 1024 * 1024)

    def drive(self, argv, environment, cwd, seconds):
        spec = self.spec
        t.require(not self.cancelled and cwd == spec.app_root and 0 < seconds <= 240,
                  "Invalid or cancelled driver invocation")
        expected = {"JURIS_FUTURE_PHASE": spec.phase, "JURIS_ACCEPTANCE_SOURCE_SHA": spec.source,
                    "JURIS_ACCEPTANCE_RUN_NONCE": spec.nonce, "JURIS_FUTURE_OUTPUT": str(spec.evidence)}
        t.require(all(environment.get(k) == v for k, v in expected.items()), "Driver environment identity differs")
        t.require(set(environment) == set(expected) | {"JURIS_FUTURE_EXPECTED_PID", "VM_SERVICE_URL"},
                  "Unexpected driver environment fields")
        pid = environment["JURIS_FUTURE_EXPECTED_PID"]
        t.require(pid.isascii() and pid.isdecimal() and int(pid) > 0, "Invalid expected Runner PID")
        uri = environment["VM_SERVICE_URL"]
        reference = t.load_reference(self.authorization.repository)
        reference.authenticated_uri(uri)
        sdk = reference.driver_sdk_identity()
        reference.validate_driver_sdk(sdk)
        t.require(sdk == t.read_json(spec.evidence / "prepare.json")["driver_sdk"],
                  "Driver SDK changed before direct invocation")
        t.require(argv == [sdk["dart"], t.DRIVER], "Unexpected direct Dart driver command")
        result = host_command.run(argv, cwd, seconds, spec.evidence, spec.phase + "-driver-command",
                                  env={**os.environ, **environment})
        sys.stdout.buffer.write(result.stdout)
        sys.stdout.buffer.flush()
        sys.stderr.buffer.write(result.stderr)
        sys.stderr.buffer.flush()
        return result


def authorize(spec, tools, external):
    t.require(type(tools) is ActualTools and type(external) is ActualExternal,
              "Concrete live adapters required")
    authority = tools.authorization
    t.require(type(authority) is LiveAuthorization and external.authorization is authority and external.spec == spec,
              "Live adapters do not share this source authorization")
    return authority.validate(spec)
