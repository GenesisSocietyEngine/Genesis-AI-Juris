#!/usr/bin/env python3
"""Exercise collector bounds without requiring Simulator tools."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).with_name("collect_ios_tax_diagnostics.py")
spec = importlib.util.spec_from_file_location("diagnostics", SCRIPT)
diagnostics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostics)


class CaptureTests(unittest.TestCase):
    def capture(self, script, *, seconds=5, limit=1024):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "output.log"
            result = diagnostics.capture([sys.executable, "-I", "-c", script], path,
                                         time.monotonic() + seconds, limit=limit)
            return result, path.read_bytes() if path.exists() else None

    def test_nonzero_exit_keeps_diagnostic(self):
        result, output = self.capture("import sys; print('launch failed'); sys.exit(7)")
        self.assertEqual(result["exit_code"], 7)
        self.assertEqual(result["status"], "completed")
        self.assertIn(b"launch failed", output)

    def test_hung_command_is_terminated(self):
        result, _ = self.capture("import time; time.sleep(30)", seconds=0.3)
        self.assertEqual(result["status"], "timeout")
        self.assertIsNotNone(result["exit_code"])
        self.assertLess(result["elapsed_seconds"], 3)

    def test_fast_large_output_is_truncated(self):
        result, output = self.capture("print('x' * 65536)")
        self.assertEqual(result["status"], "output_limit")
        self.assertEqual(len(output), 1024)

    def test_exhausted_budget_does_not_launch(self):
        result, output = self.capture("raise RuntimeError('must not run')", seconds=-1)
        self.assertEqual(result["status"], "budget_exhausted")
        self.assertIsNone(output)

    def test_missing_tool_is_recorded(self):
        with tempfile.TemporaryDirectory() as folder:
            result = diagnostics.capture([str(Path(folder) / "missing-tool")],
                                         Path(folder) / "output.log", time.monotonic() + 1)
            self.assertEqual(result["status"], "unavailable")

    def test_nonisolated_selector_rejected_before_writing(self):
        with tempfile.TemporaryDirectory() as folder:
            result = subprocess.run([sys.executable, "-I", str(SCRIPT), "booted", folder],
                                    capture_output=True, timeout=5)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(list(Path(folder).iterdir()), [])


class RunnerEvidenceTests(unittest.TestCase):
    bridge_path = "/usr/libexec/CoreSimulatorBridge"
    springboard_path = ("/Library/Developer/CoreSimulator/Volumes/iOS_22F77/Library/Developer/"
                       "CoreSimulator/Profiles/Runtimes/iOS 18.5.simruntime/Contents/Resources/"
                       "RuntimeRoot/System/Library/CoreServices/SpringBoard.app/SpringBoard")
    device_inventory = ("3066 1 S 08:01 launchd_sim\n3104 3066 Rs 07:59 " + bridge_path +
                        "\n3075 3066 Rs 07:59 " + springboard_path + "\n")
    service_executable = ("/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/"
                          "XPCServices/com.apple.CoreSimulator.CoreSimulatorService.xpc/Contents/MacOS/"
                          "com.apple.CoreSimulator.CoreSimulatorService")
    # Exact host-inventory row from failed run 44427840405; no app PID existed.
    service_process = " 2323     1 S    08:56 " + service_executable + "\n"
    device = "EAE525EA-129B-4F71-A068-68898B5F47B6"
    container = ("/Users/runner/Library/Developer/CoreSimulator/Devices/"
                 + device + "/data/Containers/Bundle/Application/"
                 "990D2207-1981-4F58-957D-182C42254F64/Runner.app")
    executable = container + "/Runner"
    process = "18448 2933 Ss 10:02 " + executable + "\n"

    def test_selects_exact_isolated_executable_not_other_runner(self):
        other = self.process.replace("18448", "11111").replace(self.device, "00000000-0000-0000-0000-000000000000")
        target = diagnostics.resolve_runner(self.device, self.container + "\n", other + self.process)
        self.assertEqual(target, {"pid": 18448, "executable": self.executable})

    def test_rejects_ambiguous_missing_and_unsafe_identity(self):
        for processes in ["", self.process + self.process.replace("18448", "18449"),
                          self.process.replace("18448", "0")]:
            with self.subTest(processes=processes), self.assertRaises(ValueError):
                diagnostics.resolve_runner(self.device, self.container, processes)
        for container in [self.container.replace(self.device, "00000000-0000-0000-0000-000000000000"),
                          self.container + "\nerror", self.container.replace("/Users/", "/../Users/"),
                          self.container + "/other.app"]:
            with self.subTest(container=container), self.assertRaises(ValueError):
                diagnostics.resolve_runner(self.device, container, self.process)

    def test_rechecks_pid_and_full_executable_without_arguments(self):
        target = {"pid": 18448, "executable": self.executable}
        self.assertTrue(diagnostics.target_still_matches(target, " 18448 " + self.executable + "\n"))
        for text in ["18449 " + self.executable, "18448 /another/Runner", "",
                     "18448 " + self.executable + " --argument", "18448 " + self.executable + "\n1 /other"]:
            self.assertFalse(diagnostics.target_still_matches(target, text))

    def collect(self, overrides=None):
        overrides = overrides or {}
        calls = []
        with tempfile.TemporaryDirectory() as folder:
            def fake_capture(command, destination, deadline):
                calls.append((destination.stem, command, deadline))
                name = destination.stem
                default = {"host-processes": self.process, "application-container": self.container + "\n"}
                if name.endswith("-identity"):
                    default[name] = "18448 " + self.executable + "\n"
                text, status, code = overrides.get(name, (default.get(name, "diagnostic\n"), "completed", 0))
                if status != "budget_exhausted":
                    destination.write_text(text, encoding="utf-8")
                return {"command": command, "status": status, "exit_code": code, "bytes": len(text.encode())}

            with mock.patch.object(diagnostics, "capture", side_effect=fake_capture), \
                    mock.patch.object(diagnostics.shutil, "which", return_value=None):
                diagnostics.collect(self.device, folder)
            manifest = json.loads((Path(folder) / "failure-diagnostics/manifest.json").read_text(encoding="utf-8"))
            return calls, manifest

    def test_app_history_precedes_separate_short_springboard_and_native_target(self):
        calls, result = self.collect()
        names = [name for name, _, _ in calls]
        commands = {name: command for name, command, _ in calls}
        self.assertLess(names.index("application-log"), names.index("springboard-log"))
        self.assertNotIn('process == "SpringBoard"', commands["application-log"][-1])
        self.assertIn('process == "Runner"', commands["application-log"][-1])
        self.assertIn("com.genesissocietyengine.jurisMobile", commands["application-log"][-1])
        self.assertEqual(commands["springboard-log"][commands["springboard-log"].index("--last") + 1], "2m")
        self.assertEqual(commands["runner-stacks"], ["sample", "18448", "3", "10", "-file", "/dev/stdout"])
        self.assertEqual(commands["runner-listeners"], ["lsof", "-nP", "-a", "-p", "18448", "-iTCP", "-sTCP:LISTEN"])
        for name in ("runner-stacks", "runner-listeners"):
            self.assertEqual(names[names.index(name) - 1], name + "-identity")
            self.assertEqual(commands[name + "-identity"], ["ps", "-p", "18448", "-o", "pid=,comm="])
        self.assertEqual(len({deadline for _, _, deadline in calls}), 1)
        self.assertFalse(result["acceptance"])
        self.assertEqual(result["runner_target"]["pid"], 18448)

    def test_vm_metadata_survives_disputed_path_and_unavailable_container(self):
        # Model the retained failure: ps reports the installed path, while an
        # announcement may carry another mapped-image path. Preserve, never trust.
        event = {"eventType": "logEvent", "processID": 18448,
                 "processImagePath": "/old/Runner.app/Runner",
                 "senderImagePath": "/old/Runner.app/Frameworks/Flutter.framework/Flutter",
                 "eventMessage": "The Dart VM service is listening on http://127.0.0.1:1234/test=/"}
        calls, result = self.collect({
            "vm-announcements": (json.dumps([event]), "completed", 0),
            "application-container": ("", "timeout", -15),
        })
        names = [name for name, _, _ in calls]
        query = next(command for name, command, _ in calls if name == "vm-announcements")
        self.assertLess(names.index("vm-announcements"), names.index("application-log"))
        self.assertEqual(query[3], self.device)
        self.assertEqual(query[query.index("--style") + 1], "json")
        self.assertIn('process == "Runner"', query[-1])
        self.assertIn("The Dart VM service is listening on ", query[-1])
        self.assertNotIn("ImagePath", query[-1])
        self.assertEqual(result["commands"]["vm-announcements"]["status"], "completed")
        self.assertEqual(result["runner_target"]["status"], "unverified")
        self.assertFalse(result["acceptance"])
        self.assertFalse(any(command[0] == "sample" for _, command, _ in calls))

    def test_service_history_is_device_scoped_and_not_bundle_filtered(self):
        calls, result = self.collect({"application-log": ("partial", "timeout", -15)})
        names = [name for name, _, _ in calls]
        query = next(command for name, command, _ in calls if name == "launch-service-log")
        self.assertEqual(query[:6], ["xcrun", "simctl", "spawn", self.device, "log", "show"])
        self.assertEqual(query[query.index("--last") + 1], "5m")
        self.assertEqual(query[query.index("--style") + 1], "json")
        self.assertEqual(query[-1], 'process == "runningboardd" OR process == "notifyd"')
        self.assertLess(names.index("launch-service-log"), names.index("application-log"))
        self.assertEqual(result["commands"]["launch-service-log"]["status"], "completed")
        self.assertEqual(len({deadline for _, _, deadline in calls}), 1)
        self.assertFalse(result["acceptance"])

    def test_service_history_failure_does_not_skip_other_evidence(self):
        for status, code in [("timeout", -15), ("output_limit", 0), ("budget_exhausted", None)]:
            with self.subTest(status=status):
                calls, result = self.collect({"launch-service-log": ("partial", status, code)})
                self.assertEqual(result["commands"]["launch-service-log"]["status"], status)
                self.assertIn("vm-announcements", [name for name, _, _ in calls])
                self.assertIn("application-log", [name for name, _, _ in calls])
                self.assertEqual(len({deadline for _, _, deadline in calls}), 1)
                self.assertFalse(result["acceptance"])

    def test_vm_metadata_timeout_does_not_skip_other_diagnostics(self):
        calls, result = self.collect({"vm-announcements": ("partial", "timeout", -15)})
        self.assertEqual(result["commands"]["vm-announcements"]["status"], "timeout")
        self.assertIn("application-log", [name for name, _, _ in calls])
        self.assertEqual(len({deadline for _, _, deadline in calls}), 1)
        self.assertFalse(result["acceptance"])

    def test_reused_pid_blocks_stacks_and_sockets_but_keeps_other_diagnostics(self):
        calls, result = self.collect({name + "-identity": ("18448 /another/app/Runner\n", "completed", 0)
                                     for name in ("runner-stacks", "runner-listeners")})
        names = [name for name, _, _ in calls]
        for name in ("runner-stacks", "runner-listeners"):
            self.assertNotIn(name, names)
            self.assertEqual(result["commands"][name]["status"], "identity_not_verified")
        self.assertIn("screenshot", names)

    def test_failed_or_incomplete_identity_never_samples_a_process(self):
        for status, code in [("completed", 7), ("timeout", -15), ("output_limit", 0), ("budget_exhausted", None)]:
            with self.subTest(status=status):
                calls, result = self.collect({"application-container": (self.container, status, code)})
                self.assertEqual(result["runner_target"]["status"], "unverified")
                self.assertFalse(any(command[0] == "sample" or (command[0] == "lsof" and "-p" in command)
                                     for _, command, _ in calls))

    def test_native_command_error_remains_evidence_not_acceptance(self):
        calls, result = self.collect({"runner-stacks": ("sample: permission denied\n", "completed", 7)})
        self.assertEqual(result["commands"]["runner-stacks"]["exit_code"], 7)
        self.assertIn("runner-listeners", [name for name, _, _ in calls])
        self.assertFalse(result["acceptance"])

    def test_service_stack_capture_survives_stalled_simulator_rpcs(self):
        calls, result = self.collect({
            "host-processes": (self.service_process, "completed", 0),
            "simulator-service-identity": ("2323 " + self.service_executable + "\n", "completed", 0),
            "application-container": ("", "timeout", -15),
            "installed-applications": ("", "timeout", -15),
        })
        names = [name for name, _, _ in calls]
        command = next(command for name, command, _ in calls if name == "simulator-service-stacks")
        self.assertEqual(command, ["sample", "2323", "3", "10", "-file", "/dev/stdout"])
        self.assertEqual(names[names.index("simulator-service-stacks") - 1], "simulator-service-identity")
        self.assertLess(names.index("simulator-service-stacks"), names.index("vm-announcements"))
        self.assertEqual(len({deadline for _, _, deadline in calls}), 1)
        self.assertEqual(result["simulator_service_target"]["pid"], 2323)
        self.assertEqual(result["runner_target"]["status"], "unverified")
        self.assertNotIn("runner-stacks", names)
        self.assertFalse(result["acceptance"])

    def test_service_inventory_rejects_missing_ambiguous_or_foreign_paths(self):
        for inventory in ("", self.process, self.service_process * 2,
                          self.service_process.replace("2323", "0"),
                          self.service_process.replace("/Library/", "/tmp/Library/", 1),
                          self.service_process.rstrip() + " --argument\n"):
            with self.subTest(inventory=inventory), self.assertRaises(ValueError):
                diagnostics.resolve_simulator_service(inventory)

    def test_service_sampling_rejects_reused_pid_and_failed_identity(self):
        for text, status, code in (("2323 /other/service", "completed", 0),
                                   ("2323 " + self.service_executable, "timeout", -15),
                                   ("2323 " + self.service_executable, "completed", 1),
                                   ("", "budget_exhausted", None)):
            with self.subTest(status=status, code=code):
                calls, result = self.collect({
                    "host-processes": (self.service_process, "completed", 0),
                    "simulator-service-identity": (text, status, code),
                })
                self.assertNotIn("simulator-service-stacks", [name for name, _, _ in calls])
                self.assertEqual(result["commands"]["simulator-service-stacks"]["status"], "identity_not_verified")
                self.assertIn("application-log", [name for name, _, _ in calls])

    def test_service_inventory_failure_never_samples_partial_identity(self):
        for status, code in (("timeout", -15), ("output_limit", 0), ("completed", 1),
                             ("budget_exhausted", None)):
            with self.subTest(status=status):
                calls, result = self.collect({"host-processes": (self.service_process, status, code)})
                self.assertEqual(result["simulator_service_target"]["status"], "unverified")
                self.assertFalse(any(name.startswith("simulator-service-") for name, _, _ in calls))

    def test_service_sample_timeout_preserves_later_diagnostics_and_budget(self):
        calls, result = self.collect({
            "host-processes": (self.service_process, "completed", 0),
            "simulator-service-identity": ("2323 " + self.service_executable, "completed", 0),
            "simulator-service-stacks": ("partial stack", "timeout", -15),
        })
        self.assertEqual(result["commands"]["simulator-service-stacks"]["status"], "timeout")
        self.assertIn("launch-services", [name for name, _, _ in calls])
        self.assertEqual(len({deadline for _, _, deadline in calls}), 1)
        self.assertFalse(result["acceptance"])

    def device_overrides(self):
        return {
            "device-launch-manager": ("3066\n", "completed", 0),
            "device-launch-processes": (self.device_inventory, "completed", 0),
            "device-bridge-manager": ("3066\n", "completed", 0),
            "device-springboard-manager": ("3066\n", "completed", 0),
            "device-bridge-identity": ("3104 3066 " + self.bridge_path, "completed", 0),
            "device-springboard-identity": ("3075 3066 " + self.springboard_path, "completed", 0),
        }

    def test_device_targets_exclude_other_simulators_and_host_services(self):
        other = self.device_inventory.replace("3066", "4066").replace("3104", "4104").replace("3075", "4075")
        targets = diagnostics.device_launch_targets("3066\n", other + self.device_inventory)
        self.assertEqual({name: value["pid"] for name, value in targets.items()}, {"bridge": 3104, "springboard": 3075})
        self.assertEqual(diagnostics.device_launch_targets("4066", other + self.device_inventory)["bridge"]["pid"], 4104)

    def test_invalid_manager_or_inventory_cannot_select_device_targets(self):
        for manager in ("1", "0", "3066\n4066", "not a PID"):
            with self.subTest(manager=manager), self.assertRaises(ValueError):
                diagnostics.device_launch_targets(manager, self.device_inventory)
        for inventory in ("", self.device_inventory * 2,
                          self.device_inventory.replace("launchd_sim", "/other/launchd_sim"),
                          self.device_inventory + "malformed\n"):
            with self.subTest(inventory=inventory), self.assertRaises(ValueError):
                diagnostics.device_launch_targets("3066", inventory)
        duplicate = self.device_inventory + "3105 3066 Rs 07:59 " + self.bridge_path + "\n"
        self.assertNotIn("bridge", diagnostics.device_launch_targets("3066", duplicate))

    def test_device_samples_precede_stalled_rpcs_with_one_budget(self):
        overrides = self.device_overrides()
        overrides["application-container"] = ("", "timeout", -15)
        calls, result = self.collect(overrides)
        names = [name for name, _, _ in calls]
        for name, pid in (("bridge", 3104), ("springboard", 3075)):
            prefix = "device-" + name
            command = next(command for n, command, _ in calls if n == prefix + "-stacks")
            self.assertEqual(command, ["sample", str(pid), "3", "10", "-file", "/dev/stdout"])
            self.assertLess(names.index(prefix + "-stacks"), names.index("application-container"))
            self.assertEqual(names[names.index(prefix + "-stacks") - 1], prefix + "-identity")
        self.assertEqual(len({deadline for _, _, deadline in calls}), 1)
        self.assertFalse(result["acceptance"])
        self.assertEqual(result["runner_target"]["status"], "unverified")

    def test_device_change_pid_reuse_or_partial_identity_blocks_sampling(self):
        for key, value in (
            ("device-launch-manager", ("3066", "timeout", -15)),
            ("device-launch-processes", (self.device_inventory, "output_limit", 0)),
            ("device-bridge-manager", ("4066", "completed", 0)),
            ("device-bridge-identity", ("3104 4066 " + self.bridge_path, "completed", 0)),
            ("device-bridge-identity", ("3104 3066 /other/bridge", "completed", 0)),
            ("device-bridge-identity", ("", "budget_exhausted", None)),
        ):
            with self.subTest(key=key, value=value):
                overrides = self.device_overrides(); overrides[key] = value
                calls, result = self.collect(overrides)
                self.assertNotIn("device-bridge-stacks", [name for name, _, _ in calls])
                self.assertFalse(result["acceptance"])

    def test_device_sample_failure_keeps_shared_budget_and_other_diagnostics(self):
        overrides = self.device_overrides()
        overrides["device-bridge-stacks"] = ("partial stack", "timeout", -15)
        calls, result = self.collect(overrides)
        self.assertEqual(result["commands"]["device-bridge-stacks"]["status"], "timeout")
        self.assertIn("device-springboard-stacks", [name for name, _, _ in calls])
        self.assertIn("application-log", [name for name, _, _ in calls])
        self.assertEqual(len({deadline for _, _, deadline in calls}), 1)

    def test_downstream_services_are_device_children_not_host_daemons(self):
        runtime = self.springboard_path.split("System/Library/")[0]
        inventory = (self.device_inventory + "150 1 Ss 11:00 /usr/libexec/runningboardd\n"
                     "141 1 Ss 11:00 /usr/sbin/notifyd\n"
                     "4713 3066 Ss 08:57 " + runtime + "usr/libexec/runningboardd\n"
                     "4746 3066 Ss 08:57 " + runtime + "usr/sbin/notifyd\n")
        targets = diagnostics.device_launch_targets("3066", inventory)
        self.assertEqual(list(targets), ["runningboard", "notifyd", "bridge", "springboard"])
        self.assertEqual(targets["runningboard"]["pid"], 4713)
        self.assertEqual(targets["notifyd"]["pid"], 4746)
        overrides = self.device_overrides()
        overrides["device-launch-processes"] = (inventory, "completed", 0)
        for name in ("runningboard", "notifyd"):
            target = targets[name]
            overrides["device-" + name + "-manager"] = ("3066", "completed", 0)
            overrides["device-" + name + "-identity"] = (
                f'{target["pid"]} 3066 {target["executable"]}', "completed", 0)
        calls, result = self.collect(overrides)
        names = [name for name, _, _ in calls]
        self.assertLess(names.index("device-runningboard-stacks"), names.index("device-bridge-stacks"))
        self.assertLess(names.index("device-notifyd-stacks"), names.index("device-bridge-stacks"))
        self.assertEqual(len({deadline for _, _, deadline in calls}), 1)
        self.assertFalse(result["acceptance"])


if __name__ == "__main__":
    unittest.main()
