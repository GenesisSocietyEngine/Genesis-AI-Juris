"""Ignored preparation controls: real POSIX tests skip without dir_fd safety."""
import copy
import hashlib
import importlib.util
import json
import os
import pathlib
import stat
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("initial_snapshot", pathlib.Path(__file__).with_name("initial_data_snapshot.py"))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
UUID = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE"
CONTAINER = f"/owned/Devices/{UUID}/data/Containers/Data/Application/exact"


def binding():
    return {"source_sha": "a" * 40, "run_nonce": "123-1", "simulator": UUID,
            "container": CONTAINER, "container_id": [1, 2]}


def encoded(entries=None):
    entries = entries or {}
    identities = {}
    for index, (name, record) in enumerate(entries.items(), 3):
        directory = record.get("directory") is True
        identities[name] = [1, index, stat.S_IFDIR if directory else stat.S_IFREG,
                            2 if directory else 1, 0 if directory else record.get("bytes", 0), 123, 123]
    return json.dumps({"schema": s.SCHEMA, "binding": binding(), "entries": entries,
                       "identities": identities, "container_identity": [1, 2, stat.S_IFDIR, 2, 0, 123, 123],
                       "read_only": True, "preparation_only": True, "runtime_acceptance": False,
                       "observed_stable_two_passes": True, "complete": True}).encode()


class PortableProjection(unittest.TestCase):
    def project(self, data, support="Library/Application Support", expected=None):
        return s.project_authoring(data, CONTAINER + "/" + support, expected or binding())

    def test_absent_prefix_and_empty_support_roots_are_distinct(self):
        result = self.project(encoded())
        self.assertEqual(result["first_absent_prefix"], "Library")
        self.assertEqual(result["entries"], {})
        base = {"Library": {"directory": True}, "Library/Application Support": {"directory": True}}
        result = self.project(encoded(base))
        self.assertEqual(result["support_before"], "directory")
        self.assertIsNone(result["first_absent_prefix"])
        base["Library/Application Support/tax_authoring_v1"] = {"directory": True}
        result = self.project(encoded(base))
        self.assertEqual(result["entries"], {"tax_authoring_v1": {"directory": True}})
        result = self.project(encoded({"Library": {"directory": True}}))
        self.assertEqual(result["first_absent_prefix"], "Library/Application Support")

    def test_preserves_whole_raw_generations_and_only_projects_owned_roots(self):
        raw = b'\xef\xbb\xbf{ "n":18446744073709551617, "v":1.2300e+0 }\r\n'
        entries = {"Library": {"directory": True}, "Library/Application Support": {"directory": True},
                   "Library/Application Support/tax_authoring_v1": {"directory": True},
                   "Library/Application Support/tax_authoring_v1/empty": {"directory": True},
                   "Library/Application Support/cache": s.m.raw(b"other runtime data"),
                   "Documents": {"directory": True}}
        for suffix in ("", ".tmp", ".bak"):
            entries["Library/Application Support/tax_authoring_v1/case.json" + suffix] = s.m.raw(raw)
        data = encoded(entries)
        result = self.project(data)
        self.assertEqual(result["snapshot_sha256"], hashlib.sha256(data).hexdigest())
        self.assertEqual(len(result["entries"]), 5)
        self.assertEqual(s.m.decode(result["entries"]["tax_authoring_v1/case.json"]), raw)
        self.assertFalse(result["runtime_acceptance"])
        self.assertFalse(result["mutation_authorized"])
        result["entries"].clear()
        self.assertEqual(len(self.project(data)["entries"]), 5)

    def test_rejects_outside_traversal_alias_and_file_parent_support(self):
        for support in (CONTAINER, CONTAINER + "-sibling/Library", "/elsewhere", CONTAINER + "/../Library",
                        CONTAINER + "/Library//Support", CONTAINER + "/Library/./Support", CONTAINER + "/Library\\Support"):
            with self.subTest(path=support), self.assertRaises(RuntimeError):
                s.project_authoring(encoded(), support, binding())
        with self.assertRaisesRegex(RuntimeError, "prefix"):
            self.project(encoded({"Library": s.m.raw(b"not directory")}))

    def test_stale_binding_and_malformed_shape_are_rejected(self):
        for key, value in (("source_sha", "b" * 40), ("run_nonce", "123-2"), ("container_id", [1, 3])):
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                self.project(encoded(), expected={**binding(), key: value})
        for key, value in (("complete", False), ("read_only", False), ("runtime_acceptance", True),
                           ("schema", "future"), ("observed_stable_two_passes", False)):
            changed = json.loads(encoded()); changed[key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                self.project(json.dumps(changed).encode())

    def test_duplicate_json_utf8_nonfinite_depth_and_node_bounds(self):
        for data in (b'{"schema":1,"schema":2}', b'\xff', b'{"x":NaN}', b'[' * 33 + b']' * 33,
                     b'[' + b'0,' * 100001 + b'0]'):
            with self.subTest(bytes=len(data)), self.assertRaises((RuntimeError, UnicodeError)):
                self.project(data)
        with patch.object(s, "MAX_ENVELOPE_BYTES", 5), self.assertRaises(RuntimeError):
            self.project(encoded())

    def test_parent_identity_hash_and_entry_bounds(self):
        for entries in ({"missing/child": s.m.raw(b"x")}, {"../escape": s.m.raw(b"x")},
                        {"Library": {"directory": 1}}, {"Library": {"directory": True, "extra": 1}}):
            with self.subTest(entries=entries), self.assertRaises(RuntimeError):
                self.project(encoded(entries))
        original = json.loads(encoded({"file": s.m.raw(b"x")}))
        for key, value in (("bytes", 2), ("sha256", "0" * 64), ("base64", "@@")):
            changed = copy.deepcopy(original); changed["entries"]["file"][key] = value
            with self.subTest(key=key), self.assertRaises(Exception):
                self.project(json.dumps(changed).encode())
        for index, value in ((0, 2), (2, stat.S_IFLNK), (3, 2), (4, 99)):
            changed = copy.deepcopy(original); changed["identities"]["file"][index] = value
            with self.subTest(index=index), self.assertRaises(RuntimeError):
                self.project(json.dumps(changed).encode())
        with patch.object(s, "MAX_ENTRIES", 0), self.assertRaises(RuntimeError):
            self.project(encoded({"file": s.m.raw(b"")}))

    def test_invalid_owned_container_shapes(self):
        for changes in ({"simulator": UUID.lower()}, {"container": "/outside"},
                        {"container": CONTAINER + "/child"}, {"container_id": [True, 2]},
                        {"container": CONTAINER + "/../elsewhere"}, {"run_nonce": "bad"}):
            with self.subTest(changes=changes), self.assertRaises(RuntimeError):
                s.binding_checked({**binding(), **changes})

    @unittest.skipIf(s.posix_available(), "Actual POSIX collector exercised separately")
    def test_unsupported_platform_refuses_before_callbacks(self):
        def forbidden(*_): self.fail("Unsupported collector invoked callback")
        with self.assertRaisesRegex(RuntimeError, "POSIX"):
            s.collect(binding(), forbidden, forbidden, forbidden)


@unittest.skipUnless(s.posix_available(), "Requires real POSIX fd/O_NOFOLLOW/scandir; no Windows fallback")
class PosixReadOnlyCollector(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.home = pathlib.Path(self.temp.name).resolve()
        self.container = self.home / f"Devices/{UUID}/data/Containers/Data/Application/exact"
        self.container.mkdir(parents=True)
        info = self.container.stat()
        self.binding = {**binding(), "container": self.container.as_posix(), "container_id": [info.st_dev, info.st_ino]}
        self.events = []
        self.allowed = True
        self.proof = {"binding": self.binding, "process_absent": True, "before_first_launch": True}

    def tearDown(self): self.temp.cleanup()

    def capture(self, probe=None, retain=None):
        def record(data): self.events.append(data); return True
        return s.collect(self.binding, probe or (lambda: copy.deepcopy(self.proof)),
                         lambda: self.allowed, retain or record)

    def test_empty_directories_raw_files_and_no_mutation(self):
        (self.container / "Library/Application Support/tax_authoring_v1/empty").mkdir(parents=True)
        path = self.container / "Library/Application Support/tax_authoring_v1/case.bak"
        raw = b'\xef\xbb\xbf{"v":18446744073709551617}\r\n'; path.write_bytes(raw)
        data = self.capture()
        self.assertEqual(self.events, [data])
        self.assertEqual(path.read_bytes(), raw)
        projected = s.project_authoring(data, (self.container / "Library/Application Support").as_posix(), self.binding)
        self.assertEqual(s.m.decode(projected["entries"]["tax_authoring_v1/case.bak"]), raw)
        self.assertTrue(projected["entries"]["tax_authoring_v1/empty"]["directory"])

    def test_missing_support_and_zero_byte_files(self):
        (self.container / "zero").write_bytes(b"")
        data = self.capture()
        result = s.project_authoring(data, (self.container / "Library/Application Support").as_posix(), self.binding)
        self.assertEqual(result["first_absent_prefix"], "Library")
        self.assertEqual(json.loads(data)["entries"]["zero"]["bytes"], 0)

    def test_symlinks_hardlinks_and_fifo_refused(self):
        outside = self.home / "outside"; outside.write_bytes(b"private")
        for mode in ("symlink", "hardlink", "fifo"):
            target = self.container / "entry"
            if mode == "symlink": target.symlink_to(outside)
            elif mode == "hardlink": os.link(outside, target)
            else: os.mkfifo(target)
            try:
                with self.subTest(mode=mode), self.assertRaises(RuntimeError): self.capture()
                self.assertEqual(self.events, [])
                self.assertEqual(outside.read_bytes(), b"private")
            finally: target.unlink()

    def test_container_link_and_changed_identity_refused(self):
        original = self.binding["container_id"]
        self.binding["container_id"] = [original[0], original[1] + 1]
        with self.assertRaisesRegex(RuntimeError, "Container identity"): self.capture()
        self.binding["container_id"] = original
        moved = self.container.with_name("moved"); self.container.rename(moved)
        self.container.symlink_to(moved, target_is_directory=True)
        with self.assertRaises(OSError): self.capture()
        self.assertEqual(self.events, [])

    def test_changed_between_passes_is_not_retained(self):
        path = self.container / "file"; path.write_bytes(b"before")
        count = 0
        def probe():
            nonlocal count
            count += 1
            if count == 2: path.write_bytes(b"after")
            return copy.deepcopy(self.proof)
        with self.assertRaisesRegex(RuntimeError, "between traversals"): self.capture(probe=probe)
        self.assertEqual(self.events, [])

    def test_rename_during_open_is_rejected(self):
        path = self.container / "file"; path.write_bytes(b"old")
        original = s.os.open
        def changed(name, *args, **kwargs):
            if name == "file":
                path.unlink(); path.write_bytes(b"new-content")
            return original(name, *args, **kwargs)
        with patch.object(s, "posix_available", return_value=True), \
             patch.object(s.os, "open", side_effect=changed), self.assertRaisesRegex(RuntimeError, "changed during open"):
            self.capture()
        self.assertEqual(self.events, [])

    def test_cancellation_and_absence_failure_cannot_retain(self):
        for key in ("process_absent", "before_first_launch"):
            changed = {**self.proof, key: False}
            with self.subTest(key=key), self.assertRaises(RuntimeError): self.capture(probe=lambda: changed)
        self.allowed = False
        with self.assertRaisesRegex(RuntimeError, "cancellation"): self.capture()
        self.assertEqual(self.events, [])

    def test_retention_error_and_late_cancellation_do_not_return_success(self):
        with self.assertRaisesRegex(RuntimeError, "retention"):
            self.capture(retain=lambda _: False)
        def late(_): self.allowed = False; return True
        with self.assertRaisesRegex(RuntimeError, "cancellation"): self.capture(retain=late)

    def test_file_and_entry_budgets_fail_before_retention(self):
        (self.container / "file").write_bytes(b"too large")
        with patch.object(s, "MAX_BYTES", 2), self.assertRaisesRegex(RuntimeError, "byte budget"): self.capture()
        with patch.object(s, "MAX_ENTRIES", 0), self.assertRaisesRegex(RuntimeError, "entry budget"): self.capture()
        self.assertEqual(self.events, [])


if __name__ == "__main__": unittest.main(verbosity=2)
