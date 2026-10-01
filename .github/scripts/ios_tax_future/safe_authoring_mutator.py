"""PREPARATION ONLY: bounded POSIX authoring seed/restore, never a simulator CLI.

All runtime identity/absence observations remain supplied by the reviewed host.
This module refuses Windows instead of emulating descriptor-relative safety.
"""
import base64
import contextlib
import copy
import hashlib
import os
import pathlib
import re
import stat
import sys
import time

ROOTS = ("guided_studio_v1", "tax_authoring_v1", "authoring_import_v1")
MAX_ENTRIES = 2048
MAX_BYTES = 16 * 1024 * 1024
MAX_DEPTH = 24


def require(value, message):
    if not value:
        raise RuntimeError(message)


def components(name):
    require(type(name) is str and name and len(name) <= 1024, "Invalid relative path")
    require("\\" not in name and "\0" not in name, "Invalid path separator")
    parts = name.split("/")
    require(len(parts) <= MAX_DEPTH and all(p and p not in (".", "..") for p in parts),
            "Noncanonical or deep relative path")
    require(all(len(p.encode("utf-8")) <= 255 for p in parts), "Oversized path component")
    return parts


def raw(data):
    require(type(data) is bytes and len(data) <= MAX_BYTES, "Invalid raw bytes")
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
            "base64": base64.b64encode(data).decode("ascii")}


def decode(entry):
    require(type(entry) is dict and set(entry) == {"bytes", "sha256", "base64"}, "Invalid raw record")
    require(type(entry["bytes"]) is int and 0 <= entry["bytes"] <= MAX_BYTES, "Invalid byte count")
    require(type(entry["base64"]) is str and len(entry["base64"]) <= 4 * ((MAX_BYTES + 2) // 3),
            "Oversized encoded record")
    data = base64.b64decode(entry["base64"], validate=True)
    require(raw(data) == entry, "Raw record hash or length mismatch")
    return data


def controls_list(controls):
    require(type(controls) in (list, tuple) and len(controls) <= 32, "Invalid explicit controls")
    require(len(set(controls)) == len(controls), "Repeated control")
    for name in controls:
        require(len(components(name)) == 1 and name not in ROOTS and
                not name.startswith(".__juris_future_"), "Control must be an explicit separate file")
    return tuple(controls)


def validate_entries(entries, controls=(), *, temporary=()):
    controls = controls_list(controls)
    for name in temporary:
        require(re.fullmatch(r"\.__juris_future_[0-9]+-[0-9]+_[1-9][0-9]*", name) is not None,
                "Invalid owned temporary control")
    controls = (*controls, *temporary)
    require(type(entries) is dict and len(entries) <= MAX_ENTRIES, "Too many entries")
    total = 0
    for name, entry in entries.items():
        parts = components(name)
        require(parts[0] in ROOTS or (len(parts) == 1 and name in controls), "Unowned path")
        directory = entry == {"directory": True}
        require(not (len(parts) == 1 and name in controls and directory), "Control is a directory")
        if len(parts) == 1 and name in ROOTS:
            require(directory, "Authoring root is not a directory")
        if len(parts) > 1:
            require(entries.get("/".join(parts[:-1])) == {"directory": True}, "Missing parent directory")
        if not directory:
            total += len(decode(entry))
            require(total <= MAX_BYTES, "Inventory exceeds byte budget")
    return copy.deepcopy(entries)


def plan(current, target, controls=()):
    """Pure bounded plan: missing and empty roots remain different states."""
    current, target = validate_entries(current, controls), validate_entries(target, controls)
    deleted_files, deleted_dirs, created_dirs, writes = [], [], [], []
    for name, old in current.items():
        new = target.get(name)
        if old == {"directory": True}:
            if new != old:
                deleted_dirs.append(name)
        elif new is None or new == {"directory": True}:
            deleted_files.append(name)
    for name, new in target.items():
        old = current.get(name)
        if new == {"directory": True}:
            if old != new:
                created_dirs.append(name)
        elif old != new:
            writes.append(name)
    return ([('unlink', n) for n in sorted(deleted_files)] +
            [('rmdir', n) for n in sorted(deleted_dirs, key=lambda n: (-len(components(n)), n))] +
            [('mkdir', n) for n in sorted(created_dirs, key=lambda n: (len(components(n)), n))] +
            [('write', n) for n in sorted(writes)])


def posix_available():
    return (os.name == "posix" and hasattr(os, "O_NOFOLLOW") and hasattr(os, "O_DIRECTORY") and
            all(f in os.supports_dir_fd for f in (os.open, os.stat, os.mkdir, os.unlink, os.rmdir, os.rename))
            and os.listdir in os.supports_fd)


def node_id(value):
    common = [value.st_dev, value.st_ino, stat.S_IFMT(value.st_mode)]
    return common if stat.S_ISDIR(value.st_mode) else common + [value.st_nlink, value.st_size, value.st_mtime_ns, value.st_ctime_ns]


@contextlib.contextmanager
def descend(base, parts):
    fd = os.dup(base)
    try:
        for part in parts:
            next_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        yield fd
    finally:
        os.close(fd)


@contextlib.contextmanager
def absolute_directory(path):
    require(type(path) is str and path.startswith("/") and not path.startswith("//"), "Expected canonical POSIX container")
    parts = components(path[1:])
    base = os.open("/", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        with descend(base, parts) as fd:
            yield fd
    finally:
        os.close(base)


class Controller:
    """No process control; hooks must re-query exact container and stopped PID.

    binding contains source_sha/run_nonce/container/support/container_id/support_id.
    support is a canonical relative path observed from the actual app getter.
    probe() must return that exact binding plus stopped=True, process_absent=True,
    previous_pid=<positive integer>. guard() rechecks host deadline/cancel epoch.
    retain(event) must synchronously persist outside the application container.
    """
    def __init__(self, binding, probe, guard, retain, controls=(), seconds=30):
        require(posix_available(), "Descriptor-relative POSIX filesystem support required")
        require(set(binding) == {"source_sha", "run_nonce", "container", "support", "container_id", "support_id"},
                "Invalid binding fields")
        require(re.fullmatch(r"[0-9a-f]{40}", binding["source_sha"]) is not None, "Invalid source")
        require(re.fullmatch(r"[0-9]+-[0-9]+", binding["run_nonce"]) is not None, "Invalid nonce")
        components(binding["support"])
        for key in ("container_id", "support_id"):
            require(type(binding[key]) is list and len(binding[key]) == 2 and
                    all(type(v) is int and v >= 0 for v in binding[key]), "Invalid directory identity")
        require(0 < seconds <= 60, "Invalid operation budget")
        self.binding, self.controls = copy.deepcopy(binding), controls_list(controls)
        self.probe, self.guard, self.retain = probe, guard, retain
        self.deadline = time.monotonic() + seconds
        self.counter = 0
        self.temporary_controls = []
        self.owned_temporaries = {}

    def tick(self):
        require(time.monotonic() < self.deadline, "Mutation budget exhausted")
        require(self.guard() is True, "Deadline/cancellation guard refused")

    def stopped(self):
        self.tick()
        proof = self.probe()
        self.tick()  # A slow/late hook is never permission to mutate afterward.
        require(type(proof) is dict and proof.get("binding") == self.binding and
                proof.get("stopped") is True and proof.get("process_absent") is True and
                type(proof.get("previous_pid")) is int and proof["previous_pid"] > 0,
                "Fresh exact stopped-process proof required")
        return proof

    @contextlib.contextmanager
    def support(self):
        self.tick()
        with absolute_directory(self.binding["container"]) as container:
            require(node_id(os.fstat(container))[:2] == self.binding["container_id"], "Container identity changed")
            with descend(container, components(self.binding["support"])) as support:
                require(node_id(os.fstat(support))[:2] == self.binding["support_id"], "Support identity changed")
                yield support

    def read(self, parent, name):
        self.tick()
        before = os.stat(name, dir_fd=parent, follow_symlinks=False)
        require(before.st_dev == self.binding["support_id"][0], "Cross-device entry refused")
        if stat.S_ISDIR(before.st_mode):
            return {"directory": True}, node_id(before)
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1, "Nonregular or linked file refused")
        require(before.st_size <= MAX_BYTES, "File exceeds byte budget")
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
        try:
            require(node_id(os.fstat(fd)) == node_id(before), "File changed during open")
            chunks, size = [], 0
            while True:
                self.tick()
                data = os.read(fd, min(65536, MAX_BYTES + 1 - size))
                if not data:
                    break
                chunks.append(data)
                size += len(data)
                require(size <= MAX_BYTES, "File exceeds byte budget")
            require(node_id(os.fstat(fd)) == node_id(before), "File changed during read")
            require(node_id(os.stat(name, dir_fd=parent, follow_symlinks=False)) == node_id(before),
                    "File path changed during read")
            return raw(b"".join(chunks)), node_id(before)
        finally:
            os.close(fd)

    def inventory(self):
        entries, identities, total = {}, {}, 0
        def visit(parent, name, relative):
            nonlocal total
            components(relative)
            require(len(entries) < MAX_ENTRIES, "Inventory entry budget exhausted")
            entry, identity = self.read(parent, name)
            entries[relative], identities[relative] = entry, identity
            if entry == {"directory": True}:
                with descend(parent, [name]) as child:
                    require(node_id(os.fstat(child)) == identity, "Directory changed during open")
                    names = sorted(os.listdir(child))
                    require(len(names) <= MAX_ENTRIES, "Directory entry budget exhausted")
                    for item in names:
                        require(len(components(item)) == 1, "Invalid directory child")
                        visit(child, item, relative + "/" + item)
                    require(sorted(os.listdir(child)) == names, "Directory changed during traversal")
                    require(node_id(os.stat(name, dir_fd=parent, follow_symlinks=False)) == identity,
                            "Directory path changed during traversal")
            else:
                total += entry["bytes"]
                require(total <= MAX_BYTES, "Inventory byte budget exhausted")
        with self.support() as support:
            for name in (*ROOTS, *self.controls, *self.temporary_controls):
                try:
                    os.stat(name, dir_fd=support, follow_symlinks=False)
                except FileNotFoundError:
                    continue
                visit(support, name, name)
        validate_entries(entries, self.controls, temporary=self.temporary_controls)
        return {"binding": copy.deepcopy(self.binding), "controls": list(self.controls),
                "entries": entries, "identities": identities}

    def checkpoint(self, expected):
        proof = self.stopped()
        actual = self.inventory()
        require(actual == expected, "Unexpected filesystem change; mutation refused")
        self.tick()
        return proof

    def capture_entry(self, parent, name, relative, expected):
        entry, identity = self.read(parent, name)
        expected["entries"][relative] = entry
        expected["identities"][relative] = identity

    def before_mutation(self, parent, relative, expected):
        self.checkpoint(expected)
        parts = components(relative)
        with self.support() as support, descend(support, parts[:-1]) as reopened:
            require(node_id(os.fstat(parent)) == node_id(os.fstat(reopened)), "Held parent was replaced")
        if relative in expected["entries"]:
            entry, identity = self.read(parent, parts[-1])
            require(entry == expected["entries"][relative] and identity == expected["identities"][relative],
                    "Target changed before mutation")
        else:
            try:
                os.stat(parts[-1], dir_fd=parent, follow_symlinks=False)
            except FileNotFoundError:
                pass
            else:
                raise RuntimeError("Unexpected target appeared before mutation")
        self.tick()

    def apply(self, expected, target, *, operation, declared_path=None):
        """Apply exact current->target; caller retains initial snapshots separately."""
        require(operation in ("seed", "restore", "controls"), "Unknown mutation operation")
        require(expected.get("binding") == self.binding and expected.get("controls") == list(self.controls),
                "Snapshot binding mismatch")
        target = validate_entries(target, self.controls)
        actions = plan(expected["entries"], target, self.controls)
        if operation == "seed":
            require(declared_path is not None and len(components(declared_path)) > 1 and
                    components(declared_path)[0] in ROOTS and actions == [("write", declared_path)],
                    "A fixture seed may change only its declared existing-parent file")
        if operation == "controls":
            require(all(action in ("write", "unlink") and name in self.controls for action, name in actions),
                    "Control operation changed authoring state")
        expected = copy.deepcopy(expected)
        proof = self.checkpoint(expected)
        self.retain({"event": "before", "operation": operation, "proof": proof,
                     "snapshot": copy.deepcopy(expected), "target": target, "plan": actions,
                     "runtime_acceptance": False})
        try:
            for action, relative in actions:
                self.checkpoint(expected)
                parts = components(relative)
                with self.support() as support, descend(support, parts[:-1]) as parent:
                    if action == "write":
                        self.write(parent, parts[-1], relative, target[relative], expected)
                    else:
                        self.before_mutation(parent, relative, expected)
                        if action == "mkdir":
                            os.mkdir(parts[-1], mode=0o700, dir_fd=parent)
                            self.capture_entry(parent, parts[-1], relative, expected)
                        elif action == "unlink":
                            os.unlink(parts[-1], dir_fd=parent)
                            del expected["entries"][relative], expected["identities"][relative]
                        else:
                            os.rmdir(parts[-1], dir_fd=parent)
                            del expected["entries"][relative], expected["identities"][relative]
                    os.fsync(parent)
                self.checkpoint(expected)
                self.retain({"event": "applied", "action": action, "path": relative,
                             "snapshot": copy.deepcopy(expected), "runtime_acceptance": False})
            require(expected["entries"] == target, "Final target inventory mismatch")
            self.checkpoint(expected)
            self.retain({"event": "complete", "operation": operation,
                         "snapshot": copy.deepcopy(expected), "runtime_acceptance": False})
            return expected
        except BaseException as error:
            failure = {"event": "failed", "operation": operation, "error": str(error),
                       "last_verified": copy.deepcopy(expected), "runtime_acceptance": False}
            try:
                failure["observed"] = self.inventory()
            except BaseException as capture_error:
                failure["observation_error"] = str(capture_error)
            try:
                self.retain(failure)
            except BaseException as retention_error:
                print(f"Failure retention incomplete: {retention_error}", file=sys.stderr)
            else:
                # Cleanup is itself guarded. A deadline/cancellation never
                # grants an exception to mutate, even for an owned temp.
                try:
                    self.cleanup_temporaries()
                except BaseException as cleanup_error:
                    print(f"Owned temporary cleanup incomplete: {cleanup_error}", file=sys.stderr)
            raise

    def cleanup_temporaries(self):
        for relative, created_id in list(self.owned_temporaries.items()):
            expected = self.inventory()
            self.checkpoint(expected)
            require(relative in expected["entries"] and
                    expected["identities"][relative][:2] == created_id,
                    "Owned temporary was replaced or moved")
            self.retain({"event": "temporary_cleanup_before", "path": relative,
                         "snapshot": copy.deepcopy(expected), "runtime_acceptance": False})
            parts = components(relative)
            with self.support() as support, descend(support, parts[:-1]) as parent:
                self.before_mutation(parent, relative, expected)
                os.unlink(parts[-1], dir_fd=parent)
                os.fsync(parent)
            del expected["entries"][relative], expected["identities"][relative]
            if len(parts) == 1:
                self.temporary_controls.remove(relative)
            del self.owned_temporaries[relative]
            self.checkpoint(expected)
            self.retain({"event": "temporary_cleanup_complete", "path": relative,
                         "snapshot": copy.deepcopy(expected), "runtime_acceptance": False})

    def write(self, parent, name, relative, entry, expected):
        data = decode(entry)
        self.counter += 1
        temp = f".__juris_future_{self.binding['run_nonce']}_{self.counter}"
        prefix = relative.rsplit("/", 1)[0] + "/" if "/" in relative else ""
        temp_relative = prefix + temp
        # A support-level temporary is an explicit internal scope entry, never
        # inferred permission to remove arbitrary support files.
        if not prefix:
            self.temporary_controls.append(temp)
        self.retain({"event": "temporary_planned", "path": temp_relative, "target": relative,
                     "bytes": raw(data), "runtime_acceptance": False})
        self.before_mutation(parent, temp_relative, expected)
        fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=parent)
        try:
            self.owned_temporaries[temp_relative] = node_id(os.fstat(fd))[:2]
            self.retain({"event": "temporary_created", "path": temp_relative,
                         "identity": node_id(os.fstat(fd)), "target": relative,
                         "runtime_acceptance": False})
            offset = 0
            while offset < len(data):
                self.tick()
                written = os.write(fd, data[offset:offset + 65536])
                require(written > 0, "Short temporary write")
                offset += written
            os.fsync(fd)
        finally:
            os.close(fd)
        self.capture_entry(parent, temp, temp_relative, expected)
        require(expected["entries"][temp_relative] == entry, "Temporary content mismatch")
        self.before_mutation(parent, relative, expected)
        os.rename(temp, name, src_dir_fd=parent, dst_dir_fd=parent)
        del self.owned_temporaries[temp_relative]
        expected["entries"][relative] = expected["entries"].pop(temp_relative)
        # Rename can update file ctime; capture only the known promoted file.
        expected["identities"].pop(temp_relative)
        self.capture_entry(parent, name, relative, expected)
        if not prefix:
            self.temporary_controls.remove(temp)
