"""Source-bound host filesystem callbacks; no automatic live entry.

No build/install/launch/terminate/delete operation is exposed here. A reviewed
orchestrator must supply the outer deadline and exact owned transport identity.
The parent owns checked-source authorization, independent process-group
deadlines and final acceptance. A host phase proof is not final acceptance.
"""
import copy
import dataclasses
import datetime
import functools
import hashlib
import json
import math
import os
import pathlib
import re
import subprocess

import future_phase_plan as p
import future_phase_transport as t
import initial_data_snapshot as initial
import safe_authoring_mutator as mut

SCHEMA = "tax-ios-future-host-stage-v1"
BASELINE = "ios-future-baseline.json"
CONTROL = "ios-future-control.json"
RECEIPTS = tuple(f"ios-future-receipt-{phase}.json" for phase in t.PHASES)
CONTROLS = (BASELINE, CONTROL, *RECEIPTS)
EXPORT = re.compile(r"tax-workspace-[0-9]+-[0-9]+\.json\Z")
APP = "com.genesissocietyengine.jurisMobile"
LEDGER_SCHEMA = "tax-ios-future-host-ledger-v1"


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def auxiliary(name):
    return name.startswith("ios-future-") or EXPORT.fullmatch(name) is not None


class Evidence:
    """Exclusive, fsynced host files; no overwrite of earlier evidence."""
    def __init__(self, root):
        self.root = pathlib.Path(root)
        require(self.root.is_absolute() and self.root.is_dir() and not self.root.is_symlink(),
                "Existing owned evidence directory required")
        self.serial = 0
        # Resume appends distinct events; it never overwrites the prior run's
        # diagnostics. Phase authority still comes solely from replay below.
        for item in self.root.iterdir():
            match = re.fullmatch(r"host-event-([0-9]{6})\.json", item.name)
            if match:
                require(item.is_file() and not item.is_symlink(), "Invalid retained event")
                self.serial = max(self.serial, int(match[1]))

    def write(self, name, data):
        require(type(data) is bytes and len(data) <= p.MAX_CHAIN, "Invalid evidence bytes")
        require(type(name) is str and len(mut.components(name)) == 1, "Flat owned evidence name required")
        path = self.root / name
        with path.open("xb") as stream:
            require(stream.write(data) == len(data), "Short evidence write")
            stream.flush()
            os.fsync(stream.fileno())
        require(path.read_bytes() == data, "Evidence readback differs")
        return {"filename": name, "bytes": len(data), "sha256": sha(data)}

    def event(self, value):
        self.serial += 1
        return self.write(f"host-event-{self.serial:06d}.json", p.encode(value))

    def read(self, name, limit=p.MAX_JSON):
        require(len(mut.components(name)) == 1, "Flat evidence name required")
        path = self.root / name
        require(not path.is_symlink() and path.is_file() and path.stat().st_size <= limit,
                "Missing, linked or oversized retained proof")
        data = path.read_bytes()
        require(len(data) <= limit, "Retained proof grew beyond bound")
        return data


class PosixAccess:
    """Actual descriptor-relative operations; refuses Windows before any I/O."""
    synthetic_only = False

    def __init__(self):
        require(initial.posix_available(), "POSIX descriptor support required; no Windows fallback")

    def identity(self, path):
        with mut.absolute_directory(str(path)) as fd:
            value = os.fstat(fd)
            return {"device": value.st_dev, "inode": value.st_ino}

    def collect(self, binding, probe, guard, retain):
        return initial.collect(binding, probe, guard, retain)

    def controller(self, binding, probe, guard, retain, controls):
        return mut.Controller(binding, probe, guard, retain, controls=controls)

    def capture(self, binding, probe, guard, retain):
        # Discover only exact export-family names, then include those names in
        # the no-follow, full-byte controller inventory. Discovery is no grant
        # of cleanup authority; HostBindings separately validates provenance.
        probe()
        with mut.absolute_directory(binding["container"]) as container:
            require(mut.node_id(os.fstat(container))[:2] == binding["container_id"], "Container replaced")
            with mut.descend(container, mut.components(binding["support"])) as support:
                require(mut.node_id(os.fstat(support))[:2] == binding["support_id"], "Support identity changed")
                names = sorted(name for name in os.listdir(support) if auxiliary(name))
        require(len(names) <= 28, "Too many retained controls/exports")
        controls = (*CONTROLS, *[name for name in names if name not in CONTROLS])
        mut.controls_list(controls)
        ctl = self.controller(binding, probe, guard, retain, controls)
        first = ctl.inventory()
        ctl.checkpoint(first)
        with mut.absolute_directory(binding["container"]) as container:
            with mut.descend(container, mut.components(binding["support"])) as support:
                require(names == sorted(name for name in os.listdir(support) if auxiliary(name)),
                        "Control/export inventory changed during capture")
        ctl.checkpoint(first)
        return first


class HostBindings:
    """An ordered run with exclusive retained phase commits and fail-stop state.

    `runner` is a bounded CompletedProcess provider for read-only simctl/ps;
    default is subprocess.run(timeout=5). Fake access/runner injection requires
    synthetic=True and is labelled in every summary. No live entry is supplied.
    Call before_launch from the transport seam, then after_phase only after the
    complete transport record has been retained and Runner has stopped.
    """
    def __init__(self, first_spec, *, guard, access=None, runner=None, synthetic=False):
        first_spec.validate()
        require(first_spec.index == 0, "Run must start at baseline-write")
        self.first = first_spec
        self.guard = guard
        self.access = access if access is not None else PosixAccess()
        require(self.access.synthetic_only is synthetic, "Fake access requires explicit synthetic mode")
        require(synthetic or type(self.access) is PosixAccess, "Real stages require concrete POSIX access")
        require(runner is None or synthetic is True, "Custom runner allowed only for labelled fake controls")
        self.runner = runner or (lambda argv: subprocess.run(argv, capture_output=True, timeout=5, check=False))
        self.synthetic = synthetic
        self.app_id = APP
        self.evidence = Evidence(first_spec.evidence)
        self.containers = None
        self.bundle = None
        self.initial_bytes = None
        self.original = None
        self.baseline = None
        self.support_binding = None
        self.prior = []
        self.last_snapshot = None
        self.before = None
        self.pending = None
        self.failed = False
        self.cleaned = False
        self.hook = None

    @classmethod
    def resume(cls, first_spec, next_phase, **options):
        """Replay a complete prefix, then recheck real stopped disk identity.

        Only a clean next phase or final original restoration may resume. A
        partially attempted phase is a failure, never inferred completion.
        This calls no captured code and uses no object deserialization/pickle.
        """
        host = cls(first_spec, **options)
        try:
            host.tick()
            state = replay_ledger(first_spec, next_phase, host.evidence, host.synthetic)
            for field, value in state.items():
                setattr(host, field, value)
            pid = p.decode(host.prior[-1].receipt_json)["pid"]
            current = host.capture(pid)
            require(current == host.last_snapshot, "Current stopped files differ from replayed ledger")
            host.event({"event": "resume_verified", "next_phase": next_phase,
                        "prior_phases": len(host.prior), "previous_pid": pid})
            return host
        except BaseException:
            host.failed = True
            raise

    def tick(self):
        require(not self.failed and not self.cleaned and self.guard() is True, "Host guard refused")

    def event(self, value):
        self.tick()
        return self.evidence.event({"schema": SCHEMA, "source_sha": self.first.source,
            "run_nonce": self.first.nonce, "synthetic_only": self.synthetic,
            "preparation_only": self.synthetic, "runtime_acceptance": False, **value})

    def command(self, argv):
        self.tick()
        require(argv == ["ps", "-axo", "pid=,comm="] or argv in [
            ["xcrun", "simctl", "get_app_container", self.first.device, self.app_id, kind]
            for kind in ("app", "data")], "Only exact read-only identity commands allowed")
        self.event({"event": "command_start", "argv": argv})
        try:
            result = self.runner(argv)
        except BaseException as error:
            self.evidence.event({"event": "command_failed", "argv": argv,
                "error": str(error), "runtime_acceptance": False})
            raise
        self.tick()
        require(type(result.stdout) is bytes and type(result.stderr) is bytes and
                len(result.stdout) + len(result.stderr) <= 1024 * 1024, "Invalid command capture")
        self.event({"event": "command_result", "argv": argv, "exit": result.returncode,
                    "stdout": mut.raw(result.stdout), "stderr": mut.raw(result.stderr)})
        require(type(result.returncode) is int and result.returncode == 0, "Identity command failed")
        return result.stdout.decode("utf-8", errors="strict")

    def directory_identity(self, path):
        self.tick()
        value = self.access.identity(path)
        self.tick()
        require(type(value) is dict and set(value) == {"device", "inode"} and
                all(type(v) is int and v > 0 for v in value.values()), "Invalid directory identity")
        return value

    def observe(self, previous_pid=None):
        """Fresh exact app/data paths and descriptor identities plus absent PID."""
        require(self.containers is not None, "Container binding absent")
        for kind in ("app", "data"):
            observed = self.command(["xcrun", "simctl", "get_app_container", self.first.device, self.app_id, kind])
            require(observed.strip() == self.containers[kind]["path"], "Container relocated")
            value = self.directory_identity(pathlib.PurePosixPath(observed.strip()))
            require(value == {key: self.containers[kind][key] for key in ("device", "inode")}, "Container replaced")
        rows = self.command(["ps", "-axo", "pid=,comm="]).splitlines()
        for row in rows:
            fields = row.strip().split(None, 1)
            require(len(fields) == 2 and fields[0].isdigit(), "Malformed process inventory")
            pid, executable = int(fields[0]), fields[1]
            require(pid > 0 and pid != previous_pid, "Previous Runner PID still present")
            require(not (f"/Devices/{self.first.device}/" in executable and executable.endswith("/Runner.app/Runner")),
                    "Owned Simulator Runner still present")
        self.tick()

    def initial_binding(self):
        item = self.containers["data"]
        return initial.binding_checked({"source_sha": self.first.source, "run_nonce": self.first.nonce,
            "simulator": self.first.device, "container": item["path"], "container_id": [item["device"], item["inode"]]})

    def initial_probe(self):
        require(not self.prior and self.pending == "baseline-write", "Initial snapshot must precede first phase")
        self.observe()
        return {"binding": self.initial_binding(), "process_absent": True, "before_first_launch": True}

    def stopped_probe(self, pid):
        self.observe(pid)
        require(self.directory_identity(pathlib.PurePosixPath(self.support_path)) ==
                dict(zip(("device", "inode"), self.support_binding["support_id"])), "Support replaced")
        return {"binding": copy.deepcopy(self.support_binding), "stopped": True,
                "process_absent": True, "previous_pid": pid}

    @property
    def support_path(self):
        return self.support_binding["container"] + "/" + self.support_binding["support"]

    def capture(self, pid):
        return self.access.capture(self.support_binding, lambda: self.stopped_probe(pid), self.guard,
                                   lambda event: self.event({"event": "filesystem", "detail": event}))

    def checked_spec(self, spec):
        spec.validate()
        require(all(getattr(spec, key) == getattr(self.first, key) for key in
                    ("device", "source", "nonce", "evidence", "app_root", "simulator_root")), "Phase identity changed")
        require(spec.index == len(self.prior), "Phase repeated, skipped or reordered")

    def before_launch(self, spec, containers, bundle_hash, previous):
        try:
            self.tick()
            self.checked_spec(spec)
            require(self.pending is None, "Previous phase has not been validated")
            self.evidence.write(f"{spec.phase}-binding-start.json", p.encode({
                "schema": SCHEMA, "phase": spec.phase, "source_sha": spec.source,
                "run_nonce": spec.nonce, "simulator": spec.device,
                "synthetic_only": self.synthetic, "runtime_acceptance": False}))
            require(previous == tuple(p.decode(item.receipt_json)["pid"] for item in self.prior), "Previous PID chain changed")
            require(type(bundle_hash) is str and re.fullmatch("[0-9a-f]{64}", bundle_hash), "Invalid bundle hash")
            require(type(containers) is dict and set(containers) == {"app", "data"}, "Invalid containers")
            for kind, suffix in (("app", "Bundle/Application"), ("data", "Data/Application")):
                item = containers[kind]
                require(set(item) == {"path", "device", "inode"}, "Invalid container fields")
                require(type(item["path"]) is str and all(type(item[k]) is int and item[k] > 0 for k in ("device", "inode")),
                        "Invalid container value types")
                path = pathlib.PurePosixPath(item["path"])
                expected = spec.simulator_root / spec.device / "data/Containers" / suffix
                require(str(path) == item["path"] and ".." not in path.parts and "\\" not in str(path), "Noncanonical container")
                require((path.name == "Runner.app" and path.parent.parent == expected) if kind == "app" else path.parent == expected,
                        "Container outside owned Simulator")
                require(self.directory_identity(path) == {k: item[k] for k in ("device", "inode")}, "Input container identity differs")
            if self.containers is None:
                self.containers, self.bundle = copy.deepcopy(containers), bundle_hash
            require(containers == self.containers and bundle_hash == self.bundle, "Container/bundle changed")
            self.pending = spec.phase
            if spec.index == 0:
                def retain(data):
                    self.evidence.write("initial-data-snapshot.json", data)
                    return True
                self.initial_bytes = self.access.collect(self.initial_binding(), self.initial_probe, self.guard, retain)
                initial._decode_snapshot(self.initial_bytes)
                require(self.evidence.read("initial-data-snapshot.json") == self.initial_bytes, "Initial snapshot retention differs")
                payload = self.initial_bytes
            else:
                current = self.capture(previous[-1])
                require(current == self.last_snapshot, "Stopped filesystem changed since validated prior phase")
                plan = p.plan_phase(spec.phase, spec.source, spec.nonce, initial_inventory=self.original["entries"],
                                    baseline_app_json=self.baseline, prior=self.prior)
                controls = tuple(current["controls"])
                ctl = self.access.controller(self.support_binding, lambda: self.stopped_probe(previous[-1]), self.guard,
                    lambda event: self.event({"event": "filesystem", "detail": event}), controls)
                outside = {k: v for k, v in current["entries"].items() if k.split("/")[0] not in mut.ROOTS}
                restored = {**p.records(plan.baseline_inventory), **outside}
                current = ctl.apply(current, restored, operation="restore")
                if plan.fixture_placement:
                    seeded = {**current["entries"], plan.fixture_placement: mut.raw(plan.fixture_bytes)}
                    current = ctl.apply(current, seeded, operation="seed", declared_path=plan.fixture_placement)
                target = {**current["entries"], CONTROL: mut.raw(plan.control_json)}
                current = ctl.apply(current, target, operation="controls")
                self.before = copy.deepcopy(current)
                payload = p.encode(current)
            metadata = self.evidence.write(f"{spec.phase}-prelaunch-inventory.json", payload)
            self.hook = {"source_sha": spec.source, "run_nonce": spec.nonce, "phase": spec.phase,
                "containers": copy.deepcopy(containers), "bundle_manifest_sha256": bundle_hash,
                "inventory_file": metadata["filename"], "inventory_sha256": metadata["sha256"],
                "inventory_bytes": metadata["bytes"], "original_snapshot": spec.index == 0, "acceptance": False}
            return copy.deepcopy(self.hook)
        except BaseException:
            self.failed = True
            raise

    def after_phase(self, spec, transport):
        try:
            self.tick()
            self.checked_spec(spec)
            require(self.pending == spec.phase, "Missing prelaunch preparation")
            receipt_bytes = self.evidence.read(f"{spec.phase}.json")
            receipt = p.decode(receipt_bytes)
            png = self.evidence.read(f"{spec.phase}-future.png", p.MAX_PNG)
            require(receipt["screenshot"] == p.png_metadata(spec.phase, png), "Actual screenshot differs")
            hook_bytes = self.evidence.read(f"{spec.phase}-prelaunch-hook.json")
            require(p.decode(hook_bytes) == self.hook, "Prelaunch hook changed")
            prelaunch_bytes = self.evidence.read(self.hook["inventory_file"])
            require(sha(prelaunch_bytes) == self.hook["inventory_sha256"] and
                    len(prelaunch_bytes) == self.hook["inventory_bytes"], "Prelaunch retained inventory changed")
            require(p.decode(self.evidence.read(f"{spec.phase}-transport.json")) == transport, "Transport retention differs")
            for key, value in {"schema": t.TRANSPORT_SCHEMA, "phase": spec.phase, "phase_index": spec.index,
                "source_sha": spec.source, "run_nonce": spec.nonce, "simulator": spec.device,
                "containers": self.containers, "bundle_manifest_sha256": self.bundle,
                "preparation_sha256": sha(self.evidence.read("prepare.json")),
                "receipt_sha256": sha(receipt_bytes), "selected_test": t.SELECTED_TEST,
                "prelaunch_hook_sha256": sha(hook_bytes),
                "pid": receipt["pid"], "vm_pid": receipt["pid"], "previous_pid": receipt["previous_pid"],
                "process_absent": True, "transport_complete": True, "runtime_acceptance": False}.items():
                require(type(transport.get(key)) is type(value) and transport[key] == value, f"Transport mismatch: {key}")
            prior_pids = tuple(p.decode(v.receipt_json)["pid"] for v in self.prior)
            t.validate_receipt(receipt, spec, receipt["pid"], prior_pids)
            if spec.index == 0:
                self.original = initial.project_authoring(self.initial_bytes, receipt["support_path"], self.initial_binding())
                relative = self.original["support_relative"]
                sid = self.directory_identity(pathlib.PurePosixPath(receipt["support_path"]))
                self.support_binding = {"source_sha": spec.source, "run_nonce": spec.nonce,
                    "container": self.containers["data"]["path"], "container_id": self.initial_binding()["container_id"],
                    "support": relative, "support_id": [sid["device"], sid["inode"]]}
                snap = initial._decode_snapshot(self.initial_bytes)
                prefix = relative + "/"
                original_aux = {k[len(prefix):]: v for k, v in snap["entries"].items() if k.startswith(prefix)
                    and auxiliary(k[len(prefix):])}
                require(not original_aux, "Fresh run has preexisting control, receipt, baseline or export")
                self.evidence.write("original-authoring-projection.json", p.encode(self.original))
            else:
                require(receipt["support_path"] == self.support_path, "Application support relocated")
            current = self.capture(receipt["pid"])
            self.evidence.write(f"{spec.phase}-postphase-inventory.json", p.encode(current))
            entries = current["entries"]
            app_bytes = mut.decode(entries[RECEIPTS[spec.index]])
            require(p.decode(app_bytes) == {k: v for k, v in receipt.items() if k != "screenshot"}, "Driver/app receipt differs beyond screenshot")
            self.evidence.write(f"{spec.phase}-application-receipt.json", app_bytes)
            if spec.index == 0:
                self.baseline = mut.decode(entries[BASELINE])
                require(self.baseline == app_bytes, "Actual app baseline differs from baseline-write receipt")
                self.evidence.write("actual-application-baseline.json", self.baseline)
                before = self.original["entries"]
                control = None
                expected_aux = {BASELINE: entries[BASELINE], RECEIPTS[0]: entries[RECEIPTS[0]]}
            else:
                before = {k: v for k, v in self.before["entries"].items() if k.split("/")[0] in mut.ROOTS}
                control = mut.decode(entries[CONTROL])
                expected_aux = {k: v for k, v in self.before["entries"].items() if k.split("/")[0] not in mut.ROOTS}
                expected_aux[RECEIPTS[spec.index]] = entries[RECEIPTS[spec.index]]
            after = {k: v for k, v in entries.items() if k.split("/")[0] in mut.ROOTS}
            baseline = p.decode(self.baseline)
            fixtures = p.h.make_fixtures(baseline)
            p.h.assert_control(control, receipt, self.baseline)
            p.h.assert_phase(receipt, spec.phase, spec.source, spec.nonce, prior_pids[-1] if prior_pids else None,
                             before, after, baseline, fixtures)
            if spec.phase in ("tax-future-safe", "tax-future-unsafe"):
                export = receipt["export"]
                name = export["path"]
                require(EXPORT.fullmatch(name) and name not in expected_aux, "Export name reused or unowned")
                expected_aux[name] = {k: v for k, v in export.items() if k != "path"}
                require(entries.get(name) == expected_aux[name], "Actual export file differs from receipt")
                self.evidence.write(f"{spec.phase}-actual-export.bin", mut.decode(entries[name]))
            actual_aux = {k: v for k, v in entries.items() if k.split("/")[0] not in mut.ROOTS}
            require(actual_aux == expected_aux, "Unexpected, missing or changed control/receipt/export")
            candidate = p.PriorPhase(receipt_bytes, png, control)
            # Reuse the pure planner to verify the whole prior chain before it
            # becomes authority for another mutation. Final phase uses the
            # same strict receipt shape and complete native pair assertion.
            p._receipt(receipt, spec.phase, spec.source, spec.nonce, prior_pids[-1] if prior_pids else None, True)
            if spec.index < len(t.PHASES) - 1:
                p.plan_phase(t.PHASES[spec.index + 1], spec.source, spec.nonce,
                    initial_inventory=self.original["entries"], baseline_app_json=self.baseline,
                    prior=(*self.prior, candidate))
            else:
                p.h.assert_final_pair(p.decode(self.prior[1].receipt_json), receipt)
            self.observe(receipt["pid"])
            summary = {"schema": SCHEMA, "phase": spec.phase, "source_sha": spec.source,
                "run_nonce": spec.nonce, "pid": receipt["pid"], "receipt_sha256": sha(receipt_bytes),
                "application_receipt_sha256": sha(app_bytes), "baseline_sha256": sha(self.baseline),
                "preparation_sha256": sha(self.evidence.read("prepare.json")),
                "postphase_sha256": sha(p.encode(current)), "semantic_assertions_passed": True,
                "synthetic_only": self.synthetic, "preparation_only": self.synthetic,
                "stage_proof": not self.synthetic, "runtime_acceptance": False}
            self.evidence.write(f"{spec.phase}-host-validation.json", p.encode(summary))
            commit_ledger(spec, self.evidence, self.synthetic)
            self.prior.append(candidate)
            self.last_snapshot = copy.deepcopy(current)
            self.pending = None
            return summary
        except BaseException:
            self.failed = True
            raise

    def restore_original(self):
        """Only after all ten phases; not permission to clean a failed run.

        Failure cleanup needs the separate exact owned Simulator lifecycle
        proof and parent orchestration decision. This method never deletes the
        support directory, container, Simulator, caches or unrelated files.
        """
        try:
            self.tick()
            require(len(self.prior) == len(t.PHASES) and self.pending is None, "Complete phase chain required")
            pid = p.decode(self.prior[-1].receipt_json)["pid"]
            current = self.capture(pid)
            require(current == self.last_snapshot, "Filesystem changed before original restoration")
            ctl = self.access.controller(self.support_binding, lambda: self.stopped_probe(pid), self.guard,
                lambda event: self.event({"event": "filesystem", "detail": event}), tuple(current["controls"]))
            outside = {k: v for k, v in current["entries"].items() if k.split("/")[0] not in mut.ROOTS}
            restored = ctl.apply(current, {**self.original["entries"], **outside}, operation="restore")
            # Every auxiliary byte was independently observed, accepted and
            # retained above. No filename-only or glob deletion authority.
            restored = ctl.apply(restored, self.original["entries"], operation="controls")
            require(restored["entries"] == self.original["entries"], "Original authoring roots not restored")
            require(self.capture(pid)["entries"] == self.original["entries"], "Post-restoration capture changed")
            self.evidence.write("original-restoration.json", p.encode({"schema": SCHEMA,
                "source_sha": self.first.source, "run_nonce": self.first.nonce,
                "original": self.original["entries"], "final": restored["entries"],
                "removed_auxiliary": outside, "clipboard_restored": False,
                "simulator_cleanup_pending": True, "synthetic_only": self.synthetic,
                "preparation_only": self.synthetic, "stage_proof": not self.synthetic, "runtime_acceptance": False}))
            self.cleaned = True
            return restored
        except BaseException:
            self.failed = True
            raise


@functools.lru_cache(maxsize=1)
def pinned_transport():
    # Source-owned immutable Git object, never executable diagnostic content.
    return t.load_reference(pathlib.Path(__file__).resolve().parents[3])


def phase_files(index):
    phase = t.PHASES[index]
    suffixes = (".json", "-future.png", "-binding-start.json", "-prelaunch-hook.json",
        "-prelaunch-inventory.json", "-transport.json", "-postphase-inventory.json",
        "-application-receipt.json", "-host-validation.json", "-input-bundle.json",
        "-installed-bundle.json", "-launch.json", "-launch.stdout.log", "-launch.stderr.log",
        "-vm.json", "-process.txt", "-driver.stdout.log", "-driver.stderr.log",
        "-driver-start.json", "-driver.json",
        "-driver-command-start.json", "-driver-command-terminal.json",
        "-driver-command-stdout.log", "-driver-command-stderr.log",
        "-app-container-command.json", "-data-container-command.json", "-discovery.json",
        "-system.log", "-system-events.jsonl", "-backfill.json", "-backfill.stderr.log", "-backfill-status.json")
    names = [phase + suffix for suffix in suffixes]
    if index == 0:
        names += ["initial-data-snapshot.json", "original-authoring-projection.json",
                  "actual-application-baseline.json", "baseline-write-containers.json",
                  "baseline-write-install-start.json", "baseline-write-install.json",
                  "baseline-write-install.stdout.log", "baseline-write-install.stderr.log",
                  "prepare-start.json", "prepare.json", "prepared-bundle.json",
                  "prepare-command-start.json", "prepare-command-terminal.json",
                  "prepare-command-stdout.log", "prepare-command-stderr.log"]
    else:
        names += [phase + "-installation-reuse.json"]
    if phase in ("tax-future-unsafe", "tax-future-safe"):
        names += [phase + "-actual-export.bin"]
    return tuple(sorted(names))


def commit_ledger(spec, evidence, synthetic):
    """Validate candidate bytes before the exclusive durable commit file."""
    files = {}
    for name in phase_files(spec.index):
        if name == spec.phase + "-system-events.jsonl" and not (evidence.root / name).exists():
            require(not (evidence.root / name).is_symlink(), "Linked missing events refused")
            # A successful discovery may come wholly from the retained
            # retrospective query. The source reader creates JSONL lazily.
            files[name] = {"absent": True}
            continue
        data = evidence.read(name)
        files[name] = {"bytes": len(data), "sha256": sha(data)}
    process = evidence.read("process.log", 1024 * 1024)
    previous = evidence.read(t.PHASES[spec.index - 1] + "-ledger.json") if spec.index else None
    value = {"schema": LEDGER_SCHEMA, "phase": spec.phase, "phase_index": spec.index,
        "source_sha": spec.source, "run_nonce": spec.nonce, "simulator": spec.device,
        "previous_ledger_sha256": sha(previous) if previous is not None else None,
        "files": files, "process_log_prefix": mut.raw(process), "synthetic_only": synthetic,
        "preparation_only": synthetic, "stage_proof": not synthetic, "runtime_acceptance": False}
    data = p.encode(value)
    name = spec.phase + "-ledger.json"
    replay_ledger(dataclasses.replace(spec, phase=t.PHASES[0]),
                  t.PHASES[spec.index + 1] if spec.index < 9 else "restore-original",
                  evidence, synthetic, candidate=(name, data))
    evidence.write(name, data)


def checked_snapshot(value, binding):
    require(type(value) is dict and set(value) == {"binding", "controls", "entries", "identities"}, "Invalid disk snapshot")
    require(p.same(value["binding"], binding), "Disk binding changed")
    controls = mut.controls_list(value["controls"])
    require(set(CONTROLS) <= set(controls) and all(auxiliary(name) for name in controls), "Unowned disk controls")
    entries = mut.validate_entries(value["entries"], controls)
    require(set(entries) == set(value["identities"]), "Disk identity inventory differs")
    for name, record in entries.items():
        identity = value["identities"][name]
        directory = record == {"directory": True}
        require(type(identity) is list and len(identity) == (3 if directory else 7) and
                all(type(n) is int and n >= 0 for n in identity) and identity[0] == binding["container_id"][0] and
                identity[1] > 0 and identity[2] == (0o040000 if directory else 0o100000), "Invalid disk node identity")
        if not directory:
            require(identity[3] == 1 and identity[4] == record["bytes"], "Linked or changed disk file")
    return value


def replay_command(read, label, argv, cwd, maximum_seconds, maximum_bytes, *, exact_seconds=False):
    """Require successful complete bounded raw output, not only a marker."""
    start = p.decode(read(label + "-start.json"))
    terminal = p.decode(read(label + "-terminal.json"))
    require(set(start) == {"argv", "cwd", "seconds", "max_bytes", "started_at", "runtime_acceptance"},
            "Unexpected command start fields")
    require(start["argv"] == argv and start["cwd"] == str(cwd) and start["runtime_acceptance"] is False and
            type(start["max_bytes"]) is int and start["max_bytes"] == maximum_bytes, "Unexpected command identity")
    seconds = start["seconds"]
    require(type(seconds) in (int, float) and math.isfinite(seconds) and 0 < seconds <= maximum_seconds and
            (not exact_seconds or seconds == maximum_seconds), "Unexpected command deadline")
    require(all(p.same(terminal.get(k), v) for k, v in start.items()), "Command start/terminal differs")
    require(type(terminal.get("pid")) is int and terminal["pid"] > 0 and type(terminal.get("exit")) is int and
            terminal["exit"] == 0 and terminal.get("timed_out") is False and terminal.get("output_exceeded") is False and
            terminal.get("error") is None and terminal.get("cleanup_errors") == [] and
            terminal.get("descendant_cleanup") == "required_by_outer_phase_deadline", "Command failed or cleanup incomplete")
    began, ended = (datetime.datetime.fromisoformat(value) for value in (start["started_at"], terminal["completed_at"]))
    require(began.tzinfo is not None and ended.tzinfo is not None and began <= ended, "Invalid command timestamps")
    require(type(terminal.get("output")) is dict and set(terminal["output"]) == {"stdout.log", "stderr.log"}, "Missing command captures")
    total = 0
    for stream in ("stdout.log", "stderr.log"):
        data = read(label + "-" + stream)
        require(p.same(terminal["output"][stream], {"observed_bytes": len(data), "retained_bytes": len(data),
            "eof": True, "bytes": len(data), "sha256": sha(data), "truncated": False, "capture_complete": True}),
            "Command capture incomplete or changed")
        total += len(data)
    require(total <= maximum_bytes, "Command output exceeds bound")


def replay_preparation(spec, read, built):
    start, terminal = (p.decode(read(name)) for name in ("prepare-start.json", "prepare.json"))
    expected = {"schema": t.BUILD_SCHEMA, "source_sha": spec.source, "run_nonce": spec.nonce,
        "simulator": spec.device, "target": t.TARGET, "argv": t.build_command(spec),
        "source_files": t.PREPARED_HASHES, "timeout_seconds": 900, "runtime_acceptance": False}
    require(all(p.same(start.get(k), v) and p.same(terminal.get(k), v) for k, v in expected.items()),
            "Preparation source/device/target/build inputs differ")
    require(start.get("status") == "started" and start.get("build_completed") is False and "exit_code" not in start,
            "Invalid preparation start")
    require(type(start.get("host_pid")) is int and start["host_pid"] > 0 and
            all(p.same(start.get(k), terminal.get(k)) for k in ("host_pid", "started_at", "driver_sdk")), "Preparation host identity differs")
    pinned_transport().validate_driver_sdk(start.get("driver_sdk"))
    require(terminal.get("status") == "completed" and terminal.get("build_completed") is True and
            type(terminal.get("exit_code")) is int and terminal["exit_code"] == 0, "Preparation did not complete")
    began, ended = (datetime.datetime.fromisoformat(value) for value in (start["started_at"], terminal["completed_at"]))
    elapsed = terminal.get("elapsed_seconds")
    require(began.tzinfo is not None and ended.tzinfo is not None and began <= ended and
            type(elapsed) in (int, float) and math.isfinite(elapsed) and 0 <= elapsed < 900, "Invalid preparation timing")
    require(read("prepared-bundle.json") == built and terminal.get("bundle_manifest_sha256") == sha(built),
            "Prepared full bundle differs")
    replay_command(read, "prepare-command", t.build_command(spec), spec.app_root, 900, 64 * 1024 * 1024, exact_seconds=True)
    return sha(read("prepare.json"))


def replay_transport(spec, read, transport, containers, bundle, prior_pids, process_prefix):
    """Pure replay of retained bundle, launch, log/getVM and selected-test proof."""
    ref = pinned_transport()
    phase = spec.phase
    pid = transport["pid"]
    executable = containers["app"]["path"] + "/Runner"
    require(transport.get("executable") == executable, "Transport executable differs")
    built = read(phase + "-input-bundle.json")
    require(sha(built) == bundle and built == read(phase + "-installed-bundle.json"), "Input/installed bundle differs")
    preparation_sha = replay_preparation(spec, read, built)
    require(transport.get("preparation_sha256") == preparation_sha, "Transport preparation identity differs")
    sdk = p.decode(read("prepare.json"))["driver_sdk"]
    require(p.same(transport.get("driver_sdk"), sdk), "Transport driver SDK differs")
    manifest = p.decode(b'{"entries":' + built + b'}')["entries"]
    require(type(manifest) is list and any(type(v) is dict and v.get("path") == "Runner" for v in manifest), "Bundle lacks Runner")
    for kind in ("app", "data"):
        record = p.decode(read(phase + "-" + kind + "-container-command.json"))
        require(set(record) == {"argv", "exit", "stdout", "stderr", "source_sha", "run_nonce"} and
                record.get("argv") == ["xcrun", "simctl", "get_app_container", spec.device, APP, kind] and
                type(record.get("exit")) is int and record["exit"] == 0 and record.get("source_sha") == spec.source and
                record.get("run_nonce") == spec.nonce and type(record.get("stdout")) is str and
                record["stdout"].strip() == containers[kind]["path"] and type(record.get("stderr")) is str,
                "Container query proof differs")
    install = p.decode(read("baseline-write-install.json"))
    expected_argv = ["xcrun", "simctl", "install", spec.device, str(spec.app_root / "build/ios/iphonesimulator/Runner.app")]
    require(install.get("schema") == "tax-ios-install-command-v1" and install.get("runtime_acceptance") is False and
            install.get("source_sha") == spec.source and install.get("run_nonce") == spec.nonce and
            install.get("simulator") == spec.device and install.get("argv") == expected_argv and
            install.get("bundle_manifest_sha256") == bundle and install.get("phase") == "baseline-write" and
            install.get("status") == "completed" and type(install.get("exit_code")) is int and install["exit_code"] == 0 and
            install.get("installation_completed") is True and install.get("output_truncated") is False and not install.get("error"),
            "Actual first installation did not complete")
    start = p.decode(read("baseline-write-install-start.json"))
    require(start.get("schema") == "tax-ios-install-command-v1" and start.get("runtime_acceptance") is False and
            start.get("status") == "started" and start.get("installation_completed") is False and
            all(p.same(start.get(k), install.get(k)) for k in ("source_sha", "run_nonce", "simulator", "phase", "argv", "bundle_manifest_sha256", "started_at", "host_pid", "timeout_seconds")),
            "Install start/terminal identity differs")
    for stream in ("stdout", "stderr"):
        require(sha(read("baseline-write-install." + stream + ".log")) == install.get(stream + "_sha256"), "Install output changed")
    require(len(read("baseline-write-install.stdout.log")) + len(read("baseline-write-install.stderr.log")) <= 1024 * 1024,
            "Install output exceeded actual capture bound")
    if spec.index:
        reuse = p.decode(read(phase + "-installation-reuse.json"))
        require(reuse == {"installed_again": False, "first_install_sha256": sha(read("baseline-write-install.json")),
            "source_sha": spec.source, "run_nonce": spec.nonce, "phase": phase}, "Installation reuse differs")
    launch = p.decode(read(phase + "-launch.json"))
    for key, expected in {"schema": "tax-ios-future-launch-v1", "phase": phase,
        "source_sha": spec.source, "run_nonce": spec.nonce, "simulator": spec.device, "pid": pid,
        "vm_pid": pid, "executable": executable, "bundle_manifest_sha256": bundle,
        "preparation_sha256": preparation_sha, "driver_sdk": sdk, "acceptance": False}.items():
        require(p.same(launch.get(key), expected), "Launch identity differs: " + key)
    ref.authenticated_uri(launch["vm_uri"])
    require(read(phase + "-launch.stdout.log").decode("utf-8").strip() == f"{APP}: {pid}", "Launch PID stdout differs")
    vm = p.decode(read(phase + "-vm.json"))
    require(vm.get("jsonrpc") == "2.0" and "error" not in vm and vm.get("result", {}).get("type") == "VM" and
            type(vm["result"].get("pid")) is int and vm["result"]["pid"] == pid, "getVM mismatch")
    discovery = p.decode(read(phase + "-discovery.json"))
    require(launch.get("launch_started_at") == discovery.get("launch_started_at"), "Direct/discovered launch time differs")
    started = datetime.datetime.fromisoformat(discovery["launch_started_at"])
    verified = datetime.datetime.fromisoformat(discovery["verified_at"])
    require(started.tzinfo is not None and verified.tzinfo is not None and started <= verified and
            type(discovery.get("pid")) is int and discovery["pid"] == pid, "Discovery time/PID differs")
    identity = ref.LogIdentity(pid, executable, started)
    status = p.decode(read(phase + "-backfill-status.json"))
    require(status == discovery["backfill_status"], "Backfill status differs")
    require(status.get("command") == ["xcrun", "simctl", "spawn", spec.device, "log", "show", "--last", "2m",
        "--style", "json", "--predicate", f"processID == {pid} AND processImagePath == {json.dumps(executable)}"], "Backfill command differs")
    observed = []
    if status.get("exit_code") == 0:
        require(status.get("status") == "completed", "Backfill status inconsistent")
        parser = ref.JsonLogObjects()
        for event in parser.feed(read(phase + "-backfill.json").decode("utf-8"), final=True):
            identity.observe(event, "backfill")
            observed.append(event)
        require(not parser.array or parser.closed, "Backfill truncated")
    parser = ref.JsonLogObjects()
    stream_events = parser.feed(read(phase + "-system.log").decode("utf-8"), final=True)
    require(not parser.array or parser.closed, "System log truncated")
    wrapped = [p.decode(line) for line in read(phase + "-system-events.jsonl").splitlines() if line.strip()]
    require([v["event"] for v in wrapped] == stream_events, "Parsed/raw system log differs")
    for event in stream_events:
        identity.observe(event, "stream")
        observed.append(event)
    require(identity.uri == launch["vm_uri"] and discovery["event"] in observed and
            discovery["event"] in [v["event"] for v in identity.observations], "Accepted VM event missing from raw log")
    require(discovery["observations"] and all(v in identity.observations for v in discovery["observations"]) and
            set(discovery["origins"]) <= set(identity.origins), "Discovery observations differ")
    require(all(datetime.datetime.fromisoformat(v["event"]["timestamp"]) <= verified for v in discovery["observations"]),
            "Discovery claims an observation after verification")
    require(read(phase + "-process.txt").decode("utf-8").strip().split(maxsplit=1) == [str(pid), executable], "Observed Runner process differs")
    output = read(phase + "-driver.stdout.log").decode("utf-8")
    driver_start, driver_terminal = (p.decode(read(phase + suffix)) for suffix in ("-driver-start.json", "-driver.json"))
    expected_start = t.direct_driver_start(spec, sdk, pid, launch["vm_uri"], preparation_sha, driver_start.get("started_at"))
    require(p.same(driver_start, expected_start), "Direct driver source, SDK, argv or environment differs")
    require(p.same(driver_terminal, {**expected_start, "status": "completed", "exit_code": 0,
            "completed_at": driver_terminal.get("completed_at")}), "Direct driver did not complete successfully")
    began, ended = (datetime.datetime.fromisoformat(value) for value in
                    (driver_start["started_at"], driver_terminal["completed_at"]))
    require(began.tzinfo is not None and ended.tzinfo is not None and verified <= began <= ended,
            "Direct driver timestamps precede verified VM identity")
    driver_argv = [sdk["dart"], t.DRIVER]
    replay_command(read, phase + "-driver-command", driver_argv, spec.app_root, 240, 16 * 1024 * 1024)
    for stream in ("stdout", "stderr"):
        require(read(phase + "-driver." + stream + ".log") == read(phase + "-driver-command-" + stream + ".log"),
                "Driver transport/command output differs")
    for marker in ("All tests passed.", f"tax_future selected_test={t.SELECTED_TEST} phase={phase} source={spec.source}",
                   f"tax_future phase={phase} source={spec.source} pid={pid} evidence=complete"):
        require(marker in output, "Selected-test completion missing")
    expected_process = "".join(f"phase={name} driver_exit=0\nphase={name} event=terminate pid={value}\nphase={name} event=process_absent pid={value}\n"
        for name, value in zip(t.PHASES[:spec.index + 1], (*prior_pids, pid)))
    require(process_prefix.decode("utf-8").replace("\r\n", "\n") == expected_process, "Terminate/absence chain differs")


def replay_ledger(first_spec, next_phase, evidence, synthetic, *, candidate=None, after_restoration=False):
    """Pure bounded bytes replay. Returns state, never filesystem authority.

    Retained files are evidence, not a cryptographic attestation. The final
    resumed callback must independently compare their state with stopped disk.
    """
    first_spec.validate()
    require(first_spec.index == 0 and next_phase in (*t.PHASES[1:], "restore-original"), "Invalid resume target")
    require(type(after_restoration) is bool and (not after_restoration or
            (next_phase == "restore-original" and candidate is None)), "Post-restoration review requires the full committed chain")
    if after_restoration:
        restored = evidence.root / "original-restoration.json"
        require(restored.is_file() and not restored.is_symlink(), "Post-restoration review requires retained restoration evidence")
    count = 10 if next_phase == "restore-original" else t.PHASES.index(next_phase)
    for item in evidence.root.iterdir():
        require(after_restoration or item.name != "original-restoration.json", "Already restored run cannot resume")
        require(not any(item.name.startswith(phase + "-") and
                        ("failure" in item.name or "probe-failed" in item.name) for phase in t.PHASES[:count]),
                "Retained phase failure prevents resume")
        for phase in t.PHASES[count:]:
            require(item.name != phase + ".json" and not item.name.startswith(phase + "-"), "Partial or later phase evidence exists")
    cache = {}
    total = 0
    def read(name):
        nonlocal total
        if name not in cache:
            data = candidate[1] if candidate is not None and name == candidate[0] else evidence.read(name)
            total += len(data)
            require(total <= 512 * 1024 * 1024, "Ledger replay aggregate bound exceeded")
            cache[name] = data
        return cache[name]
    previous_ledger = None
    prior = []
    state = {}
    current_process = evidence.read("process.log", 1024 * 1024)
    for index in range(count):
        spec = dataclasses.replace(first_spec, phase=t.PHASES[index])
        phase = spec.phase
        ledger_bytes = read(phase + "-ledger.json")
        ledger = p.decode(ledger_bytes)
        expected_header = {"schema": LEDGER_SCHEMA, "phase": phase, "phase_index": index,
            "source_sha": spec.source, "run_nonce": spec.nonce, "simulator": spec.device,
            "previous_ledger_sha256": sha(previous_ledger) if previous_ledger is not None else None,
            "synthetic_only": synthetic, "preparation_only": synthetic, "stage_proof": not synthetic, "runtime_acceptance": False}
        require(set(ledger) == set(expected_header) | {"files", "process_log_prefix"} and
                all(p.same(ledger[k], v) for k, v in expected_header.items()), "Ledger source/order/scope differs")
        require(set(ledger["files"]) == set(phase_files(index)), "Ledger inventory missing/extra files")
        for name, record in ledger["files"].items():
            if record == {"absent": True}:
                path = evidence.root / name
                require(name == phase + "-system-events.jsonl" and not path.exists() and not path.is_symlink(),
                        "Unexpected absent/appeared ledger file")
                cache[name] = b""
                continue
            data = read(name)
            require(p.same(record, {"bytes": len(data), "sha256": sha(data)}), "Retained ledger bytes changed: " + name)
        process_prefix = mut.decode(ledger["process_log_prefix"])
        require(current_process.startswith(process_prefix), "Retained process prefix changed")
        transport = p.decode(read(phase + "-transport.json"))
        hook = p.decode(read(phase + "-prelaunch-hook.json"))
        receipt_bytes = read(phase + ".json")
        receipt = p.decode(receipt_bytes)
        png = read(phase + "-future.png")
        prior_pids = tuple(p.decode(v.receipt_json)["pid"] for v in prior)
        t.validate_receipt(receipt, spec, receipt["pid"], prior_pids)
        p._receipt(receipt, phase, spec.source, spec.nonce, prior_pids[-1] if prior_pids else None, True)
        require(receipt["screenshot"] == p.png_metadata(phase, png), "PNG differs")
        if index == 0:
            containers = p.decode(read("baseline-write-containers.json"))
            require(set(containers) == {"app", "data"}, "Invalid original containers")
            for kind, suffix in (("app", "Bundle/Application"), ("data", "Data/Application")):
                item = containers[kind]
                require(set(item) == {"path", "device", "inode"} and all(type(item[k]) is int and item[k] > 0 for k in ("device", "inode")), "Invalid original container identity")
                path = pathlib.PurePosixPath(item["path"])
                parent = spec.simulator_root / spec.device / "data/Containers" / suffix
                require(str(path) == item["path"] and ".." not in path.parts and "\\" not in str(path) and
                        ((path.name == "Runner.app" and path.parent.parent == parent) if kind == "app" else path.parent == parent), "Unowned original container")
            initial_bytes = read("initial-data-snapshot.json")
            snapshot = initial._decode_snapshot(initial_bytes)
            binding = initial.binding_checked({"source_sha": spec.source, "run_nonce": spec.nonce,
                "simulator": spec.device, "container": containers["data"]["path"],
                "container_id": [containers["data"][k] for k in ("device", "inode")]})
            original = initial.project_authoring(initial_bytes, receipt["support_path"], binding)
            require(p.same(original, p.decode(read("original-authoring-projection.json"))), "Original projection changed")
            prefix = original["support_relative"] + "/"
            require(not any(name.startswith(prefix) and auxiliary(name[len(prefix):]) for name in snapshot["entries"]), "Initial auxiliary ownership missing")
            baseline_bytes = read("actual-application-baseline.json")
            bundle = sha(read(phase + "-input-bundle.json"))
            state = {"containers": containers, "bundle": bundle, "initial_bytes": initial_bytes,
                     "original": original, "baseline": baseline_bytes}
        containers, bundle = state["containers"], state["bundle"]
        for key, expected in {"schema": t.TRANSPORT_SCHEMA, "phase": phase, "phase_index": index,
            "source_sha": spec.source, "run_nonce": spec.nonce, "simulator": spec.device, "containers": containers,
            "bundle_manifest_sha256": bundle, "receipt_sha256": sha(receipt_bytes), "selected_test": t.SELECTED_TEST,
            "prelaunch_hook_sha256": sha(read(phase + "-prelaunch-hook.json")), "pid": receipt["pid"], "vm_pid": receipt["pid"],
            "previous_pid": receipt["previous_pid"], "process_absent": True, "transport_complete": True, "runtime_acceptance": False}.items():
            require(p.same(transport.get(key), expected), "Replayed transport mismatch: " + key)
        prelaunch = read(phase + "-prelaunch-inventory.json")
        require(hook == {"source_sha": spec.source, "run_nonce": spec.nonce, "phase": phase, "containers": containers,
            "bundle_manifest_sha256": bundle, "inventory_file": phase + "-prelaunch-inventory.json",
            "inventory_sha256": sha(prelaunch), "inventory_bytes": len(prelaunch), "original_snapshot": index == 0, "acceptance": False}, "Prelaunch hook differs")
        start = p.decode(read(phase + "-binding-start.json"))
        require(start == {"schema": SCHEMA, "phase": phase, "source_sha": spec.source, "run_nonce": spec.nonce,
            "simulator": spec.device, "synthetic_only": synthetic, "runtime_acceptance": False}, "Phase start differs")
        replay_transport(spec, read, transport, containers, bundle, prior_pids, process_prefix)
        current = p.decode(read(phase + "-postphase-inventory.json"))
        if index == 0:
            support_binding = current["binding"]
            require(set(support_binding) == {"source_sha", "run_nonce", "container", "support", "container_id", "support_id"} and
                    all(p.same(support_binding[k], v) for k, v in {"source_sha": spec.source, "run_nonce": spec.nonce,
                    "container": containers["data"]["path"], "support": state["original"]["support_relative"],
                    "container_id": [containers["data"][k] for k in ("device", "inode")]}.items()) and
                    type(support_binding["support_id"]) is list and len(support_binding["support_id"]) == 2 and
                    all(type(n) is int and n > 0 for n in support_binding["support_id"]), "Unbound support identity")
            state["support_binding"] = support_binding
        checked_snapshot(current, state["support_binding"])
        require(receipt["support_path"] == state["support_binding"]["container"] + "/" + state["support_binding"]["support"], "Support path changed")
        entries = current["entries"]
        app_bytes = read(phase + "-application-receipt.json")
        require(mut.decode(entries[RECEIPTS[index]]) == app_bytes and
                p.same(p.decode(app_bytes), {k: v for k, v in receipt.items() if k != "screenshot"}), "Application/driver/disk receipt differs")
        require(mut.decode(entries[BASELINE]) == state["baseline"], "Actual baseline file changed")
        if index == 0:
            require(prelaunch == state["initial_bytes"] and app_bytes == state["baseline"], "Original/baseline raw distinction lost")
            before, control = state["original"]["entries"], None
            expected_aux = {BASELINE: entries[BASELINE], RECEIPTS[0]: entries[RECEIPTS[0]]}
        else:
            prepared = checked_snapshot(p.decode(prelaunch), state["support_binding"])
            plan = p.plan_phase(phase, spec.source, spec.nonce, initial_inventory=state["original"]["entries"],
                                baseline_app_json=state["baseline"], prior=prior)
            before = {k: v for k, v in prepared["entries"].items() if k.split("/")[0] in mut.ROOTS}
            require(before == p.records(plan.target_inventory), "Prepared fixture differs from complete replayed plan")
            old_aux = {k: v for k, v in state["last_snapshot"]["entries"].items() if k.split("/")[0] not in mut.ROOTS}
            old_aux[CONTROL] = mut.raw(plan.control_json)
            require({k: v for k, v in prepared["entries"].items() if k.split("/")[0] not in mut.ROOTS} == old_aux,
                    "Prepared controls/exports changed or omitted")
            control = mut.decode(entries[CONTROL])
            require(control == plan.control_json, "Retained actual control differs from deterministic plan")
            expected_aux = {**old_aux, RECEIPTS[index]: entries[RECEIPTS[index]]}
        after = {k: v for k, v in entries.items() if k.split("/")[0] in mut.ROOTS}
        baseline = p.decode(state["baseline"])
        p.h.assert_control(control, receipt, state["baseline"])
        p.h.assert_phase(receipt, phase, spec.source, spec.nonce, prior_pids[-1] if prior_pids else None,
                         before, after, baseline, p.h.make_fixtures(baseline))
        if phase in ("tax-future-safe", "tax-future-unsafe"):
            export = receipt["export"]
            require(EXPORT.fullmatch(export["path"]) and export["path"] not in expected_aux, "Export ownership reused")
            expected_aux[export["path"]] = {k: v for k, v in export.items() if k != "path"}
            require(mut.decode(entries[export["path"]]) == read(phase + "-actual-export.bin"), "Actual export bytes differ")
        require({k: v for k, v in entries.items() if k.split("/")[0] not in mut.ROOTS} == expected_aux, "Actual auxiliary inventory differs")
        summary = p.decode(read(phase + "-host-validation.json"))
        require(summary == {"schema": SCHEMA, "phase": phase, "source_sha": spec.source,
            "run_nonce": spec.nonce, "pid": receipt["pid"], "receipt_sha256": sha(receipt_bytes),
            "application_receipt_sha256": sha(app_bytes), "baseline_sha256": sha(state["baseline"]),
            "preparation_sha256": sha(read("prepare.json")),
            "postphase_sha256": sha(p.encode(current)), "semantic_assertions_passed": True,
            "synthetic_only": synthetic, "preparation_only": synthetic, "stage_proof": not synthetic,
            "runtime_acceptance": False}, "Host validation differs")
        prior.append(p.PriorPhase(receipt_bytes, png, control))
        if index == 9:
            p.h.assert_final_pair(p.decode(prior[1].receipt_json), receipt)
        state["last_snapshot"] = current
        previous_ledger = ledger_bytes
    state["prior"] = prior
    return state


if __name__ == "__main__":
    raise SystemExit("No standalone entry: use the authorized parent and its owned phase deadline.")
