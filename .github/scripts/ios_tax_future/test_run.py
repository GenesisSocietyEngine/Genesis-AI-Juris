"""Inventory selection controls: fake commands only, no Simulator operations."""
import importlib.util
from pathlib import Path
import unittest

import owned_simulator_lifecycle as life
from test_owned_simulator_lifecycle import Fake, RUNTIME, TYPE

spec = importlib.util.spec_from_file_location('future_run_controls', Path(__file__).with_name('run.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class SelectionControls(unittest.TestCase):
    def setUp(self):
        self.fake, self.clock, self.records = Fake(), [0.0], {}
        self.guard = life.Deadline(1800, clock=lambda: self.clock[0])

    def select(self, retain=None):
        return m.choose_pair(self.fake, retain or (lambda name, value: self.records.update({name: value})),
                             self.guard, clock=lambda: self.clock[0])

    def test_one_startup_read_then_ordinary_query_no_device_mutation(self):
        self.assertEqual(self.select(), (RUNTIME, TYPE))
        self.assertEqual(self.fake.calls, [(life.RUNTIME_LIST, 120), (life.TYPE_LIST, 30)])
        self.assertEqual(set(self.records), {'runtime-selection-start.json', 'runtime-selection.json',
                                            'type-selection-start.json', 'type-selection.json'})
        self.assertFalse(self.records['runtime-selection.json']['runtime_acceptance'])

    def test_slow_success_inside_startup_allowance_can_select(self):
        self.fake.after = lambda argv: self.clock.__setitem__(0, self.clock[0] + (45 if argv == life.RUNTIME_LIST else 1))
        self.assertEqual(self.select(), (RUNTIME, TYPE))
        self.assertEqual(self.records['runtime-selection.json']['elapsed_seconds'], 45)

    def test_timeout_partial_json_nonzero_and_error_never_retry_or_create(self):
        for result in (life.CommandResult(-9, timed_out=True, error='deadline'),
                       life.CommandResult(0, b'{"runtimes":[]}', timed_out=True),
                       life.CommandResult(1, b'{"runtimes":[]}'),
                       life.CommandResult(0, b'{"runtimes":[]}', error='incomplete')):
            with self.subTest(result=result):
                self.setUp()
                self.fake.override = lambda argv: result
                with self.assertRaisesRegex(RuntimeError, 'selection failed'):
                    self.select()
                self.assertEqual(len(self.fake.calls), 1)
                self.assertNotIn('type-selection-start.json', self.records)

    def test_absolute_remainder_caps_startup_and_retention_is_charged(self):
        self.guard = life.Deadline(12, clock=lambda: self.clock[0])
        def retain(name, value):
            self.records[name] = value
            if name.endswith('-start.json'):
                self.clock[0] += 2
        self.assertEqual(self.select(retain), (RUNTIME, TYPE))
        self.assertEqual([seconds for _, seconds in self.fake.calls], [10, 8])
        self.assertEqual(self.records['runtime-selection-start.json']['timeout_seconds'], 12)

    def test_expired_intent_does_not_invoke_any_command(self):
        def retain(name, value):
            self.records[name] = value
            self.clock[0] = 1801
        with self.assertRaisesRegex(RuntimeError, 'expired while retaining'):
            self.select(retain)
        self.assertFalse(self.fake.calls)

    def test_late_zero_is_rejected_before_next_query(self):
        self.fake.after = lambda argv: self.clock.__setitem__(0, 121)
        with self.assertRaisesRegex(RuntimeError, 'allocated deadline'):
            self.select()
        self.assertEqual(len(self.fake.calls), 1)
        self.assertEqual(self.records['runtime-selection.json']['exit'], 0)

    def test_cancelled_or_unsupported_inventory_never_creates(self):
        self.guard = life.Deadline(1800, clock=lambda: 0, permitted=lambda: False)
        with self.assertRaisesRegex(RuntimeError, 'cancellation'):
            self.select()
        self.assertFalse(self.fake.calls)
        self.setUp()
        self.fake.runtime['supportedDeviceTypes'] = []
        with self.assertRaisesRegex(RuntimeError, 'supported iPhone'):
            self.select()
        self.assertEqual(len(self.fake.calls), 2)

    def test_command_error_survives_failed_diagnostic_retention(self):
        original = TimeoutError('initial inventory timeout')
        def execute(argv):
            raise original
        self.fake.override = execute
        def retain(name, value):
            if not name.endswith('-start.json'):
                raise OSError('disk full')
        with self.assertRaises(TimeoutError) as raised:
            self.select(retain)
        self.assertIs(raised.exception, original)
        self.assertIsInstance(original.__cause__, OSError)

    def test_returned_command_failure_survives_failed_terminal_retention(self):
        self.fake.override = lambda argv: life.CommandResult(-9, timed_out=True, error='inventory timed out')
        def retain(name, value):
            if not name.endswith('-start.json'):
                raise OSError('disk full')
        with self.assertRaisesRegex(RuntimeError, 'exit=-9.*inventory timed out') as raised:
            self.select(retain)
        self.assertIsInstance(raised.exception.__cause__, OSError)
        self.assertEqual(len(self.fake.calls), 1)


if __name__ == '__main__':
    unittest.main()
