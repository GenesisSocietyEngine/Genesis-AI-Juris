"""Preparation only: read-only POSIX data-container snapshot and pure projection.

No Simulator/process commands, writes to the container, or platform fallbacks.
The caller must bound its callbacks and durably retain evidence outside the app.
Two matching traversals detect observed changes; this is not an atomic snapshot.
"""
import copy
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import stat
import time

_spec = importlib.util.spec_from_file_location(
    "snapshot_mutator_primitives", pathlib.Path(__file__).with_name("safe_authoring_mutator.py"))
m = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m)

SCHEMA = "ios-future-initial-data-snapshot-preparation-v1"
MAX_ENTRIES = 2048
MAX_BYTES = 16 * 1024 * 1024
MAX_ENVELOPE_BYTES = 24 * 1024 * 1024
require = m.require


def posix_available():
    return m.posix_available() and os.scandir in os.supports_fd


def binding_checked(value):
    require(type(value) is dict and set(value) == {
        "source_sha", "run_nonce", "simulator", "container", "container_id"}, "Invalid binding fields")
    require(type(value["source_sha"]) is str and re.fullmatch(r"[0-9a-f]{40}", value["source_sha"]), "Invalid source")
    require(type(value["run_nonce"]) is str and re.fullmatch(r"[0-9]+-[0-9]+", value["run_nonce"]), "Invalid nonce")
    require(type(value["simulator"]) is str and
            re.fullmatch(r"[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}", value["simulator"]), "Invalid Simulator UUID")
    path = value["container"]
    require(type(path) is str and path.startswith("/") and not path.startswith("//"), "Invalid container path")
    m.components(path[1:])
    require(f"/Devices/{value['simulator']}/data/Containers/Data/Application/" in path,
            "Container is not within the exact owned Simulator")
    suffix = path.split(f"/Devices/{value['simulator']}/data/Containers/Data/Application/", 1)[1]
    require(len(m.components(suffix)) == 1, "Expected exact data container")
    identity = value["container_id"]
    require(type(identity) is list and len(identity) == 2 and
            all(type(n) is int and n > 0 for n in identity), "Invalid container identity")
    return copy.deepcopy(value)


def _identity(st):
    return [st.st_dev, st.st_ino, stat.S_IFMT(st.st_mode), st.st_nlink,
            st.st_size, st.st_mtime_ns, st.st_ctime_ns]


def _checked_entries(entries, identities, device):
    require(type(entries) is dict and type(identities) is dict and
            len(entries) <= MAX_ENTRIES and entries.keys() == identities.keys(), "Invalid inventory shape")
    total = 0
    for name, entry in entries.items():
        parts = m.components(name)
        require(all(type(p) is str for p in parts), "Invalid path")
        if len(parts) > 1:
            require(entries.get("/".join(parts[:-1])) == {"directory": True}, "Missing directory parent")
        ident = identities[name]
        require(type(ident) is list and len(ident) == 7 and
                all(type(n) is int and n >= 0 for n in ident) and ident[0] == device and ident[1] > 0,
                "Invalid entry identity")
        if type(entry) is dict and set(entry) == {"directory"} and entry["directory"] is True:
            require(ident[2] == stat.S_IFDIR, "Directory identity mismatch")
        else:
            data = m.decode(entry)
            require(ident[2] == stat.S_IFREG and ident[3] == 1 and ident[4] == len(data), "File identity mismatch")
            total += len(data)
            require(total <= MAX_BYTES, "Inventory exceeds byte budget")
    return copy.deepcopy(entries)


def _unique(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, "Duplicate JSON key")
        value[key] = item
    return value


def _decode_snapshot(data):
    require(type(data) is bytes and 0 < len(data) <= MAX_ENVELOPE_BYTES, "Snapshot envelope exceeds bound")
    text = data.decode("utf-8", errors="strict")
    require(text.encode("utf-8") == data, "Snapshot UTF-8 mismatch")
    # Bound nesting before json.loads allocates a deeply recursive structure.
    depth = nodes = 0
    quoted = escaped = False
    for ch in text:
        if quoted:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                quoted = False
        elif ch == '"':
            quoted = True
        elif ch in "[{":
            depth += 1
            nodes += 1
            require(depth <= 32, "Snapshot JSON depth exceeds bound")
        elif ch in "]}":
            depth -= 1
        elif ch in ",:":
            nodes += 1
        require(nodes <= 100000, "Snapshot JSON node budget exceeded")
    value = json.loads(text, object_pairs_hook=_unique,
                       parse_constant=lambda _: (_ for _ in ()).throw(RuntimeError("Nonfinite JSON")))
    require(type(value) is dict and set(value) == {
        "schema", "binding", "entries", "identities", "container_identity", "read_only",
        "preparation_only", "runtime_acceptance", "observed_stable_two_passes", "complete"},
        "Invalid snapshot fields")
    require(value["schema"] == SCHEMA and value["read_only"] is True and
            value["preparation_only"] is True and value["runtime_acceptance"] is False and
            value["observed_stable_two_passes"] is True and value["complete"] is True, "Incomplete snapshot")
    binding = binding_checked(value["binding"])
    root = value["container_identity"]
    require(type(root) is list and len(root) == 7 and
            all(type(n) is int and n >= 0 for n in root) and root[:2] == binding["container_id"] and
            root[2] == stat.S_IFDIR, "Wrong root identity")
    _checked_entries(value["entries"], value["identities"], binding["container_id"][0])
    return value


def project_authoring(snapshot_bytes, actual_support_path, expected_binding):
    """Project original roots from retained bytes; does not authorize restoration."""
    snapshot = _decode_snapshot(snapshot_bytes)
    binding = binding_checked(expected_binding)
    require(snapshot["binding"] == binding, "Snapshot source/container binding differs")
    require(type(actual_support_path) is str and actual_support_path.startswith(binding["container"] + "/"),
            "Support path outside bound container")
    relative = actual_support_path[len(binding["container"]) + 1:]
    parts = m.components(relative)
    entries = snapshot["entries"]
    first_absent = None
    for index in range(len(parts)):
        prefix = "/".join(parts[:index + 1])
        if prefix not in entries:
            first_absent = prefix
            break
        require(entries[prefix] == {"directory": True}, "Support prefix is not a directory")
    projected = {}
    if first_absent is None:
        start = relative + "/"
        for name, entry in entries.items():
            if name.startswith(start):
                tail = name[len(start):]
                if tail.split("/", 1)[0] in m.ROOTS:
                    projected[tail] = copy.deepcopy(entry)
    m.validate_entries(projected)
    return {"schema": "ios-future-original-authoring-projection-preparation-v1",
            "binding": binding, "snapshot_sha256": hashlib.sha256(snapshot_bytes).hexdigest(),
            "support_relative": relative, "support_before": "absent" if first_absent else "directory",
            "first_absent_prefix": first_absent, "entries": projected,
            "preparation_only": True, "mutation_authorized": False, "runtime_acceptance": False}


def collect(binding, probe, guard, retain, *, seconds=30):
    """Read twice, then retain exact bytes outside the app via caller callback.

    probe returns {binding, process_absent: True, before_first_launch: True}.
    guard/probe/retain must be independently bounded by the outer host deadline.
    Returns bytes only after retain acknowledges success and the final guard.
    """
    require(posix_available(), "Descriptor-relative POSIX safety required; no fallback")
    binding = binding_checked(binding)
    require(type(seconds) in (int, float) and 0 < seconds <= 60, "Invalid capture budget")
    deadline = time.monotonic() + seconds

    def tick():
        require(time.monotonic() < deadline and guard() is True, "Snapshot deadline/cancellation refused")
        require(time.monotonic() < deadline, "Snapshot guard exceeded deadline")

    def fresh():
        tick()
        value = probe()
        tick()
        require(type(value) is dict and set(value) == {"binding", "process_absent", "before_first_launch"} and
                value["binding"] == binding and value["process_absent"] is True and
                value["before_first_launch"] is True, "Fresh prelaunch identity/absence proof required")

    def traverse():
        entries, identities = {}, {}
        total = 0

        def names_at(fd):
            names = []
            with os.scandir(fd) as items:
                for item in items:
                    tick()
                    require(len(names) < MAX_ENTRIES, "Directory exceeds entry budget")
                    names.append(item.name)
            return sorted(names)

        def visit(parent, name, relative):
            nonlocal total
            tick()
            m.components(relative)
            require(len(entries) < MAX_ENTRIES, "Snapshot entry budget exhausted")
            before = os.stat(name, dir_fd=parent, follow_symlinks=False)
            ident = _identity(before)
            require(before.st_dev == binding["container_id"][0], "Cross-device entry refused")
            if stat.S_ISDIR(before.st_mode):
                entries[relative] = {"directory": True}
                identities[relative] = ident
                with m.descend(parent, [name]) as child:
                    require(_identity(os.fstat(child)) == ident, "Directory changed during open")
                    names = names_at(child)
                    for item in names:
                        require(len(m.components(item)) == 1, "Invalid directory child")
                        visit(child, item, relative + "/" + item)
                    require(names_at(child) == names and _identity(os.fstat(child)) == ident,
                            "Directory changed during traversal")
            else:
                require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1, "Nonregular or linked entry refused")
                require(before.st_size <= MAX_BYTES - total, "Snapshot byte budget exhausted")
                fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
                try:
                    require(_identity(os.fstat(fd)) == ident, "File changed during open")
                    chunks, size = [], 0
                    while True:
                        tick()
                        data = os.read(fd, min(65536, MAX_BYTES - total + 1 - size))
                        if not data:
                            break
                        chunks.append(data)
                        size += len(data)
                        require(total + size <= MAX_BYTES, "Snapshot byte budget exhausted")
                    require(_identity(os.fstat(fd)) == ident and size == before.st_size, "File changed during read")
                finally:
                    os.close(fd)
                total += size
                entries[relative], identities[relative] = m.raw(b"".join(chunks)), ident
            require(_identity(os.stat(name, dir_fd=parent, follow_symlinks=False)) == ident,
                    "Entry path changed during traversal")

        with m.absolute_directory(binding["container"]) as fd:
            root_identity = _identity(os.fstat(fd))
            require(root_identity[:2] == binding["container_id"], "Container identity changed")
            names = names_at(fd)
            for name in names:
                require(len(m.components(name)) == 1, "Invalid root child")
                visit(fd, name, name)
            require(names_at(fd) == names and _identity(os.fstat(fd)) == root_identity,
                    "Container changed during traversal")
        tick()
        return {"entries": entries, "identities": identities, "container_identity": root_identity}

    fresh()
    first = traverse()
    fresh()
    second = traverse()
    require(first == second, "Snapshot changed between traversals")
    fresh()
    result = {"schema": SCHEMA, "binding": binding, **first, "read_only": True,
              "preparation_only": True, "runtime_acceptance": False,
              "observed_stable_two_passes": True, "complete": True}
    encoded = (json.dumps(result, sort_keys=True, separators=(",", ":"), ensure_ascii=True) + "\n").encode("utf-8")
    _decode_snapshot(encoded)
    tick()
    require(retain(encoded) is True, "Durable external retention not acknowledged")
    fresh()
    return encoded
