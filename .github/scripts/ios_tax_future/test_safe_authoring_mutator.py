"""Temporary synthetic controls only. POSIX tests skip on unsupported hosts."""
import copy
import importlib.util
import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("mutator", pathlib.Path(__file__).with_name("safe_authoring_mutator.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class PortableControls(unittest.TestCase):
    def test_rejects_noncanonical_paths(self):
        for name in ("", "/tmp", "../tmp", "a/../b", "a/./b", "a//b", "a/", "a\\b", "a\0b",
                     "/".join(["a"] * 25), "a" * 256):
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                m.components(name)

    def test_raw_exact_bytes_preserve_bom_large_number_and_line_endings(self):
        data = b'\xef\xbb\xbf{ "schema":99,"n":18446744073709551617 }\r\n'
        self.assertEqual(m.decode(m.raw(data)), data)
        for key, value in (("bytes", len(data) + 1), ("sha256", "0" * 64), ("base64", "*bad*")):
            with self.subTest(key=key), self.assertRaises(Exception):
                m.decode({**m.raw(data), key: value})

    def test_inventory_requires_owned_roots_and_all_parents(self):
        for entries in ({"outside": m.raw(b"x")}, {"guided_studio_v1": m.raw(b"x")},
                        {"guided_studio_v1/a/b": m.raw(b"x")},
                        {"guided_studio_v1": {"directory": True}, "guided_studio_v1/../x": m.raw(b"x")}):
            with self.subTest(entries=entries), self.assertRaises(RuntimeError):
                m.validate_entries(entries)

    def test_controls_are_only_explicit_separate_files(self):
        self.assertEqual(m.validate_entries({"control.json": m.raw(b"exact")}, ["control.json"]),
                         {"control.json": m.raw(b"exact")})
        for controls in (["control.json", "control.json"], ["guided_studio_v1"], ["a/b"],
                         [".__juris_future_1-1_1"]):
            with self.subTest(controls=controls), self.assertRaises(RuntimeError):
                m.controls_list(controls)
        with self.assertRaises(RuntimeError):
            m.validate_entries({"control.json": {"directory": True}}, ["control.json"])

    def test_exact_plan_distinguishes_missing_empty_and_generations(self):
        current = {"guided_studio_v1": {"directory": True},
                   "guided_studio_v1/workspace.json": m.raw(b"before"),
                   "tax_authoring_v1": {"directory": True},
                   "tax_authoring_v1/empty": {"directory": True},
                   "tax_authoring_v1/a.tmp": m.raw(b"tmp")}
        target = {"guided_studio_v1": {"directory": True},
                  "guided_studio_v1/workspace.json": m.raw(b"after"),
                  "authoring_import_v1": {"directory": True}}
        original = copy.deepcopy(current)
        self.assertEqual(m.plan(current, target), [
            ("unlink", "tax_authoring_v1/a.tmp"), ("rmdir", "tax_authoring_v1/empty"),
            ("rmdir", "tax_authoring_v1"), ("mkdir", "authoring_import_v1"),
            ("write", "guided_studio_v1/workspace.json")])
        self.assertEqual(current, original)

    def test_type_replacement_plan_orders_removal_before_creation(self):
        current = {"guided_studio_v1": {"directory": True}, "guided_studio_v1/x": m.raw(b"file")}
        target = {"guided_studio_v1": {"directory": True}, "guided_studio_v1/x": {"directory": True},
                  "guided_studio_v1/x/child": m.raw(b"data")}
        self.assertEqual(m.plan(current, target), [("unlink", "guided_studio_v1/x"),
                         ("mkdir", "guided_studio_v1/x"), ("write", "guided_studio_v1/x/child")])

    def test_size_and_file_count_limits_precede_mutation(self):
        with self.assertRaises(RuntimeError):
            m.validate_entries({"guided_studio_v1": {"directory": True},
                                **{f"guided_studio_v1/{i}": m.raw(b"") for i in range(m.MAX_ENTRIES)}})
        with self.assertRaises(RuntimeError):
            m.decode({"bytes": m.MAX_BYTES + 1, "base64": "", "sha256": "0" * 64})

    @unittest.skipIf(m.posix_available(), "POSIX host exercises actual filesystem controls")
    def test_unsupported_host_refuses_before_any_hook(self):
        def forbidden():
            self.fail("Unsupported host called a mutation hook")
        with self.assertRaisesRegex(RuntimeError, "POSIX"):
            m.Controller({}, forbidden, forbidden, forbidden)


@unittest.skipUnless(m.posix_available(), "Requires real POSIX dir_fd and O_NOFOLLOW; no Windows fallback")
class PosixTemporaryFilesystem(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        # Resolve only the test's owned temporary anchor (macOS /var is a link).
        self.container = pathlib.Path(self.temp.name).resolve() / "container"
        self.support = self.container / "Library/Application Support"
        self.support.mkdir(parents=True)
        self.binding = {"source_sha": "a" * 40, "run_nonce": "123-1",
                        "container": self.container.as_posix(), "support": "Library/Application Support",
                        "container_id": [self.container.stat().st_dev, self.container.stat().st_ino],
                        "support_id": [self.support.stat().st_dev, self.support.stat().st_ino]}
        self.events = []
        self.proof = {"binding": copy.deepcopy(self.binding), "stopped": True,
                      "process_absent": True, "previous_pid": 123}
        self.allowed = True
        self.controller = m.Controller(self.binding, lambda: copy.deepcopy(self.proof),
                                       lambda: self.allowed, self.events.append, controls=["control.json"])

    def tearDown(self):
        self.temp.cleanup()

    def baseline(self):
        root = self.support / "guided_studio_v1"
        root.mkdir()
        (root / "empty").mkdir()
        (root / "workspace.json").write_bytes(b"original\r\n")
        (root / "workspace.json.bak").write_bytes(b"older")
        return self.controller.inventory()

    def test_exact_seed_restore_and_empty_directory_roundtrip(self):
        baseline = self.baseline()
        target = copy.deepcopy(baseline["entries"])
        target["guided_studio_v1/workspace.json"] = m.raw(b'\xef\xbb\xbf{"schema_version":99}\r\n')
        changed = self.controller.apply(baseline, target, operation="seed", declared_path="guided_studio_v1/workspace.json")
        self.assertEqual(changed["entries"], target)
        restored = self.controller.apply(changed, baseline["entries"], operation="restore")
        self.assertEqual(restored["entries"], baseline["entries"])
        self.assertTrue((self.support / "guided_studio_v1/empty").is_dir())
        self.assertFalse(any(p.name.startswith(".__juris_future_") for p in self.support.rglob("*")))
        self.assertEqual(self.events[0]["snapshot"], baseline)
        self.assertTrue(all(e["runtime_acceptance"] is False for e in self.events))

    def test_exact_original_missing_roots_restored(self):
        initial = self.controller.inventory()
        target = {"tax_authoring_v1": {"directory": True}, "tax_authoring_v1/empty": {"directory": True},
                  "tax_authoring_v1/a.json": m.raw(b"opaque")}
        seeded = self.controller.apply(initial, target, operation="restore")
        restored = self.controller.apply(seeded, initial["entries"], operation="restore")
        self.assertEqual(restored["entries"], {})
        self.assertFalse((self.support / "tax_authoring_v1").exists())

    def test_explicit_control_write_and_cleanup_leave_unowned_file(self):
        foreign = self.support / "flutter-cache"
        foreign.write_bytes(b"keep")
        initial = self.controller.inventory()
        target = {"control.json": m.raw(b"source-bound-control")}
        written = self.controller.apply(initial, target, operation="controls")
        self.controller.apply(written, {}, operation="controls")
        self.assertEqual(foreign.read_bytes(), b"keep")

    def test_symlink_hardlink_and_special_file_refused(self):
        root = self.support / "tax_authoring_v1"
        root.mkdir()
        external = self.container.parent / "external"
        external.write_bytes(b"outside")
        link = root / "linked"
        for create in (lambda: link.symlink_to(external), lambda: os.link(external, link), lambda: os.mkfifo(link)):
            create()
            with self.assertRaises(RuntimeError):
                self.controller.inventory()
            link.unlink()
        self.assertEqual(external.read_bytes(), b"outside")

    def test_replaced_container_or_support_refused(self):
        initial = self.controller.inventory()
        renamed = self.container.with_name("retained-original")
        self.container.rename(renamed)
        self.support.mkdir(parents=True)
        with self.assertRaisesRegex(RuntimeError, "Container"):
            self.controller.apply(initial, {}, operation="restore")

    def test_new_file_or_same_bytes_new_inode_refused(self):
        baseline = self.baseline()
        extra = self.support / "guided_studio_v1/new"
        extra.write_bytes(b"unexpected")
        with self.assertRaisesRegex(RuntimeError, "Unexpected filesystem"):
            self.controller.apply(baseline, baseline["entries"], operation="restore")
        extra.unlink()
        path = self.support / "guided_studio_v1/workspace.json"
        replacement = path.with_name("replacement")
        replacement.write_bytes(path.read_bytes())
        replacement.replace(path)
        with self.assertRaisesRegex(RuntimeError, "Unexpected filesystem"):
            self.controller.apply(baseline, baseline["entries"], operation="restore")

    def test_running_stale_binding_and_late_cancel_do_not_mutate(self):
        baseline = self.baseline()
        for change in ({"stopped": False}, {"process_absent": False}, {"previous_pid": True},
                       {"binding": {**self.binding, "run_nonce": "another"}}):
            old = copy.deepcopy(self.proof)
            self.proof.update(change)
            with self.assertRaises(RuntimeError):
                self.controller.apply(baseline, {}, operation="restore")
            self.proof = old
        def late_probe():
            self.allowed = False
            return copy.deepcopy(self.proof)
        self.controller.probe = late_probe
        with self.assertRaisesRegex(RuntimeError, "guard"):
            self.controller.apply(baseline, {}, operation="restore")
        self.assertEqual((self.support / "guided_studio_v1/workspace.json").read_bytes(), b"original\r\n")

    def test_declared_seed_and_control_scope_cannot_broaden(self):
        baseline = self.baseline()
        with self.assertRaisesRegex(RuntimeError, "declared"):
            self.controller.apply(baseline, {}, operation="seed", declared_path="guided_studio_v1/workspace.json")
        with self.assertRaisesRegex(RuntimeError, "authoring"):
            self.controller.apply(baseline, {}, operation="controls")
        self.assertEqual(self.controller.inventory(), baseline)

    def test_partial_temporary_failure_retained_then_scoped_cleanup(self):
        baseline = self.baseline()
        target = copy.deepcopy(baseline["entries"])
        target["guided_studio_v1/workspace.json"] = m.raw(b"future opaque bytes")
        original_write = os.write
        count = 0
        def interrupted(fd, data):
            nonlocal count
            count += 1
            if count == 1:
                return original_write(fd, data[:3])
            raise OSError("synthetic interrupted write")
        with patch.object(m.os, "write", side_effect=interrupted), self.assertRaisesRegex(OSError, "synthetic"):
            self.controller.apply(baseline, target, operation="seed", declared_path="guided_studio_v1/workspace.json")
        failed = next(e for e in self.events if e["event"] == "failed")
        temporary = next(n for n in failed["observed"]["entries"] if ".__juris_future_" in n)
        self.assertEqual(m.decode(failed["observed"]["entries"][temporary]), b"fut")
        self.assertEqual(self.controller.inventory(), baseline)
        self.assertTrue(any(e["event"] == "temporary_cleanup_complete" for e in self.events))
        self.assertFalse(any(e["event"] == "complete" for e in self.events))

    def test_late_cancel_after_temp_creation_forbids_cleanup_until_reauthorized(self):
        baseline = self.controller.inventory()
        def retain(event):
            self.events.append(event)
            if event["event"] == "temporary_created":
                self.allowed = False
        self.controller.retain = retain
        with self.assertRaisesRegex(RuntimeError, "guard"):
            self.controller.apply(baseline, {"control.json": m.raw(b"future-control")}, operation="controls")
        self.assertFalse((self.support / "control.json").exists())
        self.assertEqual(len(self.controller.owned_temporaries), 1)
        self.assertFalse(any(e["event"] == "temporary_cleanup_complete" for e in self.events))
        # Test-only explicit renewed authorization; the controller never resets it.
        self.allowed = True
        self.controller.cleanup_temporaries()
        self.assertEqual(self.controller.inventory(), baseline)

    def test_existing_temporary_name_is_preserved(self):
        baseline = self.baseline()
        retained = self.support / "guided_studio_v1/.__juris_future_123-1_1"
        retained.write_bytes(b"pre-existing")
        baseline = self.controller.inventory()
        target = copy.deepcopy(baseline["entries"])
        target["guided_studio_v1/workspace.json"] = m.raw(b"different")
        with self.assertRaises(FileExistsError):
            self.controller.apply(baseline, target, operation="seed", declared_path="guided_studio_v1/workspace.json")
        self.assertEqual(self.controller.inventory(), baseline)
        self.assertEqual(retained.read_bytes(), b"pre-existing")


if __name__ == "__main__":
    unittest.main()
