"""Synthetic workflow controls: no real build, device or financial execution."""
import pathlib
import sys
import unittest
from unittest import mock

import orchestrator as m


class Owner:
    def __init__(self, events, failure=None):
        self.events, self.failure = events, failure
        self.created = self.completed = False
        self.udid = "synthetic-owned-device"

    def call(self, stage):
        self.events.append(stage)
        if self.failure == stage:
            raise RuntimeError(stage + " failed")

    def create(self, runtime, device_type):
        self.call("create")
        self.created = True
        return self.udid

    def boot(self):
        self.call("boot")

    def complete(self):
        self.call("complete")
        self.completed = True
        return {"lifecycle_complete": True}

    def failure_shutdown(self, *, cleanup_guard, reason):
        if not cleanup_guard():
            raise RuntimeError("cleanup expired")
        self.call("failure-shutdown")

    def failure_cleanup(self, *, cleanup_guard, reason):
        if not cleanup_guard():
            raise RuntimeError("cleanup expired")
        self.call("failure-delete")


class Tests(unittest.TestCase):
    def run_case(self, failure=None, owner_failure=None, verify=True):
        self.events, self.records = [], {}
        owner = Owner(self.events, owner_failure)
        def phase(name, device):
            self.assertEqual(device, owner.udid)
            self.events.append(name)
            if failure == name:
                raise RuntimeError(name + " failed")
        def final(device):
            self.assertTrue(owner.completed)
            self.events.append("verify")
            return {"runtime_acceptance": verify}
        return m.exercise(owner, "runtime", "type", phase=phase, verify=final,
            retain=lambda name, value: self.records.update({name: value}),
            diagnostics=lambda device, seconds: self.events.append("diagnostics"))

    def test_order_build_then_ten_phases_restore_delete_verify(self):
        self.assertTrue(self.run_case()["runtime_acceptance"])
        self.assertEqual(self.events, ["create", "boot", "prepare", *m.t.PHASES,
                                     "restore-original", "complete", "verify"])
        self.assertNotIn("failure.json", self.records)

    def test_each_failed_stage_stops_all_later_phases_and_cleans_only_owned(self):
        stages = ["prepare", *m.t.PHASES, "restore-original"]
        for index, stage in enumerate(stages):
            with self.subTest(stage=stage), self.assertRaisesRegex(RuntimeError, stage + " failed"):
                self.run_case(failure=stage)
            self.assertEqual(self.events, ["create", "boot", *stages[:index + 1],
                "diagnostics", "failure-shutdown", "failure-delete"])
            self.assertFalse(self.records["failure.json"]["runtime_acceptance"])

    def test_unproven_create_has_no_cleanup_authority(self):
        with self.assertRaisesRegex(RuntimeError, "create failed"):
            self.run_case(owner_failure="create")
        self.assertEqual(self.events, ["create"])

    def test_boot_or_completion_failure_is_retained_and_cannot_verify(self):
        for stage in ("boot", "complete"):
            with self.subTest(stage=stage), self.assertRaisesRegex(RuntimeError, stage + " failed"):
                self.run_case(owner_failure=stage)
            self.assertNotIn("verify", self.events)
            self.assertEqual(self.events[-3:], ["diagnostics", "failure-shutdown", "failure-delete"])

    def test_cleanup_failure_does_not_replace_primary_or_authorize_delete(self):
        with self.assertRaisesRegex(RuntimeError, "baseline-write failed"):
            self.run_case(failure="baseline-write", owner_failure="failure-shutdown")
        self.assertNotIn("failure-delete", self.events)
        self.assertEqual(self.records["failure.json"]["cleanup_failures"][0]["stage"], "owned-device-cleanup")

    def test_failed_final_verifier_has_no_success_or_repeated_device_mutation(self):
        with self.assertRaisesRegex(RuntimeError, "Final verifier"):
            self.run_case(verify=False)
        self.assertNotIn("failure-shutdown", self.events)
        self.assertFalse(self.records["failure.json"]["runtime_acceptance"])


if __name__ == "__main__":
    unittest.main()
