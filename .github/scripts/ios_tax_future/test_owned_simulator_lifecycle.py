"""Portable fake-command controls. Never invokes xcrun, Simulator, or a device."""
import copy
import importlib.util
import json
import pathlib
import tempfile
import unittest
import subprocess

import owned_simulator_lifecycle as m

SOURCE = 'a' * 40
NONCE = '123-1'
RUNTIME = 'com.apple.CoreSimulator.SimRuntime.iOS-18-6'
TYPE = 'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro'
OLD = '11111111-1111-4111-8111-111111111111'
NEW = '22222222-2222-4222-8222-222222222222'
EXTRA = '33333333-3333-4333-8333-333333333333'


def encode(value):
    return json.dumps(value).encode()


def device(identifier, name, state='Shutdown'):
    return {'udid': identifier, 'name': name, 'state': state,
            'deviceTypeIdentifier': TYPE, 'isAvailable': True}


class Fake:
    def __init__(self):
        self.items = {OLD: device(OLD, 'pre-existing')}
        self.runtime = {'identifier': RUNTIME, 'isAvailable': True, 'version': '18.6',
                        'supportedDeviceTypes': [{'identifier': TYPE, 'name': 'iPhone 16 Pro', 'productFamily': 'iPhone'}]}
        self.types = copy.deepcopy(self.runtime['supportedDeviceTypes'])
        self.calls = []
        self.override = None
        self.after = None

    def __call__(self, argv, timeout):
        self.calls.append((argv, timeout))
        if self.override:
            result = self.override(argv)
            if result is not None:
                return result
        if argv == m.DEVICE_LIST:
            result = m.CommandResult(0, encode({'devices': {RUNTIME: list(self.items.values())}}))
        elif argv == m.RUNTIME_LIST:
            result = m.CommandResult(0, encode({'runtimes': [self.runtime]}))
        elif argv == m.TYPE_LIST:
            result = m.CommandResult(0, encode({'devicetypes': self.types}))
        elif argv[2] == 'create':
            self.items[NEW] = device(NEW, argv[3])
            result = m.CommandResult(0, (NEW + '\n').encode())
        elif argv[2] == 'boot':
            self.items[argv[3]]['state'] = 'Booted'
            result = m.CommandResult(0)
        elif argv[2] == 'bootstatus':
            result = m.CommandResult(0, b'Synthetic readiness\n')
        elif argv[2] == 'shutdown':
            self.items[argv[3]]['state'] = 'Shutdown'
            result = m.CommandResult(0)
        elif argv[2] == 'delete':
            del self.items[argv[3]]
            result = m.CommandResult(0)
        else:
            raise AssertionError(f'Unexpected command {argv}')
        if self.after:
            self.after(argv)
        return result


class LifecycleControls(unittest.TestCase):
    def setUp(self):
        self.fake = Fake()
        self.events = []
        self.allowed = True
        self.owner = m.OwnedSimulator(SOURCE, NONCE, execute=self.fake,
                                     retain=self.events.append, guard=lambda: self.allowed)

    def create(self):
        self.assertEqual(self.owner.create(RUNTIME, TYPE), NEW)

    def mutations(self):
        return [argv for argv, _ in self.fake.calls if argv[2] in ('create','boot','shutdown','delete')]

    def test_complete_exact_owned_lifecycle_matches_existing_host_assertion(self):
        self.create()
        self.owner.boot()
        self.assertEqual(self.owner.query()['device']['udid'], NEW)
        result = self.owner.complete()
        spec = importlib.util.spec_from_file_location('host_assertions', pathlib.Path(__file__).with_name('host_assertions.py'))
        verifier = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(verifier)
        verifier.assert_owned_simulator_deleted(result)
        self.assertTrue(result['lifecycle_complete'])
        self.assertFalse(result['application_acceptance'])
        self.assertFalse(result['clipboard_restored'])
        self.assertEqual(set(self.fake.items), {OLD})
        for argv in self.mutations()[1:]:
            self.assertEqual(argv[3], NEW)
        self.assertEqual(self.mutations()[0], ('xcrun','simctl','create','Juris Tax Future '+NONCE,TYPE,RUNTIME))
        self.assertTrue(all(0 < timeout <= 180 for _, timeout in self.fake.calls))
        starts = [e for e in self.events if e['event']=='command-start']
        ends = [e for e in self.events if e['event']=='command-terminal']
        self.assertEqual(len(starts), len(ends))
        for start, end in zip(starts, ends):
            self.assertEqual((start['sequence'],start['argv']), (end['sequence'],end['argv']))
            self.assertEqual(end['source_sha'], SOURCE)
            self.assertEqual(end['run_nonce'], NONCE)
            self.assertFalse(end['application_acceptance'])
        with self.assertRaises(RuntimeError):
            self.owner.complete()

    def test_invalid_source_nonce_refuse_before_commands(self):
        for source, nonce in [('A'*40,NONCE),(SOURCE,'123/1'),(SOURCE,'')]:
            with self.subTest(source=source,nonce=nonce), self.assertRaises(RuntimeError):
                m.OwnedSimulator(source,nonce,execute=self.fake,retain=self.events.append,guard=lambda:True)
        self.assertFalse(self.fake.calls)

    def test_failed_booted_device_shutdown_then_delete_keeps_failure(self):
        self.create()
        self.owner.boot()
        result = self.owner.failure_shutdown(cleanup_guard=lambda: True, reason='phase failed')
        self.assertTrue(result['cleanup_only'])
        self.assertTrue(self.owner.failed)
        self.assertEqual(self.fake.items[NEW]['state'], 'Shutdown')
        self.owner.failure_cleanup(cleanup_guard=lambda: True, reason='phase failed')
        self.assertEqual(set(self.fake.items), {OLD})
        with self.assertRaises(RuntimeError):
            self.owner.complete()

    def test_failure_shutdown_refuses_unknown_replaced_or_cancelled_ownership(self):
        with self.assertRaisesRegex(RuntimeError, 'No proven'):
            self.owner.failure_shutdown(cleanup_guard=lambda: True, reason='create failed')
        for changed in ('name', 'state', 'guard'):
            self.setUp()
            self.create()
            self.owner.boot()
            if changed == 'name':
                self.fake.items[NEW]['name'] = 'foreign'
            elif changed == 'state':
                self.fake.items[NEW]['state'] = 'Unknown'
            before = list(self.mutations())
            with self.assertRaises(RuntimeError):
                self.owner.failure_shutdown(cleanup_guard=lambda: changed != 'guard', reason='failed')
            self.assertEqual(self.mutations(), before)

    def test_failed_already_shutdown_device_is_not_shutdown_twice(self):
        self.create()
        result = self.owner.failure_shutdown(cleanup_guard=lambda: True, reason='build failed')
        self.assertIsNone(result['shutdown'])
        self.assertEqual([v[2] for v in self.mutations()], ['create'])

    def test_unavailable_runtime_unsupported_type_and_missing_inventory_refuse_create(self):
        for kind in ('unavailable','unsupported','family','duplicate'):
            with self.subTest(kind=kind):
                self.setUp()
                if kind=='unavailable':self.fake.runtime['isAvailable']=False
                elif kind=='unsupported':self.fake.runtime['supportedDeviceTypes']=[]
                elif kind=='family':self.fake.types[0]['productFamily']='iPad'
                else:self.fake.types.append(copy.deepcopy(self.fake.types[0]))
                with self.assertRaises(RuntimeError):self.create()
                self.assertFalse(self.mutations())

    def test_malformed_duplicate_device_inventory_refused(self):
        for raw in (b'{"devices":{},"devices":{}}', b'{}', encode({'devices':{RUNTIME:[device(OLD,'a'),device(OLD,'b')]}})):
            with self.subTest(raw=raw):
                self.setUp();self.fake.override=lambda argv:m.CommandResult(0,raw) if argv==m.DEVICE_LIST else None
                with self.assertRaises(RuntimeError):self.create()
                self.assertFalse(self.mutations())

    def test_existing_task_name_never_reused_or_swept(self):
        self.fake.items[OLD]['name']='Juris Tax Future '+NONCE
        with self.assertRaisesRegex(RuntimeError,'already exists'):self.create()
        self.assertFalse(self.mutations())
        self.assertIn(OLD,self.fake.items)

    def test_unknown_or_foreign_create_uuid_never_booted_or_cleaned(self):
        for output in (OLD.encode(),b'no uuid', (NEW+'\n'+EXTRA).encode()):
            with self.subTest(output=output):
                self.setUp();self.fake.override=lambda argv:m.CommandResult(0,output) if argv[2]=='create' else None
                with self.assertRaises(RuntimeError):self.create()
                with self.assertRaisesRegex(RuntimeError,'No proven'):self.owner.failure_cleanup(cleanup_guard=lambda:True,reason='failed create')
                self.assertEqual([a[2] for a in self.mutations()],['create'])

    def test_nonzero_and_timed_out_create_retain_raw_no_ownership(self):
        for response in (m.CommandResult(9,NEW.encode(),b'failure'),m.CommandResult(-9,NEW.encode(),b'partial',True,'timeout')):
            with self.subTest(response=response):
                self.setUp();self.fake.override=lambda argv:response if argv[2]=='create' else None
                with self.assertRaises(RuntimeError):self.create()
                terminal=[e for e in self.events if e['event']=='command-terminal'][-1]
                self.assertEqual(terminal['stdout'],m.raw(response.stdout))
                self.assertEqual(terminal['stderr'],m.raw(response.stderr))
                self.assertFalse(self.owner.created)

    def test_late_cancel_after_create_does_not_boot_or_guess_cleanup(self):
        self.fake.after=lambda argv:setattr(self,'allowed',False) if argv[2]=='create' else None
        with self.assertRaisesRegex(RuntimeError,'authorization'):self.create()
        self.assertIn(NEW,self.fake.items)
        with self.assertRaisesRegex(RuntimeError,'No proven'):self.owner.failure_cleanup(cleanup_guard=lambda:True,reason='cancelled create')
        self.assertEqual([a[2] for a in self.mutations()],['create'])

    def test_ownership_name_type_runtime_and_state_rechecked_before_boot(self):
        for field,value in [('name','other'),('deviceTypeIdentifier',TYPE+'-other'),('runtime',RUNTIME+'-other'),('state','Booted'),('isAvailable',False)]:
            with self.subTest(field=field):
                self.setUp();self.create()
                if field=='runtime':
                    self.fake.override=lambda argv:m.CommandResult(0,encode({'devices':{RUNTIME:[self.fake.items[OLD]],value:[self.fake.items[NEW]]}})) if argv==m.DEVICE_LIST else None
                else:self.fake.items[NEW][field]=value
                with self.assertRaises(RuntimeError):self.owner.boot()
                self.assertEqual([a[2] for a in self.mutations()],['create'])

    def test_preexisting_uuid_loss_blocks_next_mutation(self):
        self.create();del self.fake.items[OLD]
        with self.assertRaisesRegex(RuntimeError,'Pre-existing'):self.owner.boot()
        self.assertEqual([a[2] for a in self.mutations()],['create'])

    def test_bootstatus_failure_and_wrong_state_never_complete(self):
        self.create()
        self.fake.override=lambda argv:m.CommandResult(1,b'',b'not ready') if argv[2]=='bootstatus' else None
        with self.assertRaises(RuntimeError):self.owner.boot()
        with self.assertRaises(RuntimeError):self.owner.complete()
        with self.assertRaisesRegex(RuntimeError,'state'):self.owner.failure_cleanup(cleanup_guard=lambda:True,reason='booted diagnostic')
        self.assertFalse(any(a[2]=='delete' for a in self.mutations()))

    def test_failure_cleanup_only_for_proven_fresh_shutdown_never_acceptance(self):
        self.create()
        self.fake.override=lambda argv:m.CommandResult(1,b'',b'boot failed') if argv[2]=='boot' else None
        with self.assertRaises(RuntimeError):self.owner.boot()
        self.allowed=False
        result=self.owner.failure_cleanup(cleanup_guard=lambda:True,reason='explicit scoped cleanup after failure')
        self.assertTrue(result['cleanup_only'])
        self.assertFalse(result['lifecycle_complete'])
        self.assertNotIn('simulator_lifecycle',result)
        self.assertFalse(any(e['event']=='lifecycle-complete' for e in self.events))
        self.assertEqual(set(self.fake.items),{OLD})
        with self.assertRaises(RuntimeError):self.owner.complete()

    def test_failure_cleanup_cancel_guard_blocks_delete(self):
        self.create()
        with self.assertRaisesRegex(RuntimeError,'authorization'):
            self.owner.failure_cleanup(cleanup_guard=lambda:False,reason='cleanup cancelled')
        self.assertIn(NEW,self.fake.items)
        self.assertEqual([a[2] for a in self.mutations()],['create'])

    def test_shutdown_delete_and_post_delete_failures_never_complete(self):
        for kind in ('shutdown','delete','still_present','foreign_missing'):
            with self.subTest(kind=kind):
                self.setUp();self.create();self.owner.boot()
                if kind in ('shutdown','delete'):
                    self.fake.override=lambda argv:m.CommandResult(1,b'',b'failure') if argv[2]==kind else None
                elif kind=='still_present':
                    self.fake.override=lambda argv:m.CommandResult(0) if argv[2]=='delete' else None
                else:
                    self.fake.after=lambda argv:self.fake.items.pop(OLD,None) if argv[2]=='delete' else None
                with self.assertRaises(RuntimeError):self.owner.complete()
                self.assertFalse(any(e['event']=='lifecycle-complete' for e in self.events))

    def test_failed_intent_retention_prevents_command(self):
        def refused(event):raise OSError('evidence destination unavailable')
        self.owner.retain=refused
        with self.assertRaises(OSError):self.create()
        self.assertFalse(self.fake.calls)

    def test_cancel_after_retained_start_has_terminal_without_execution(self):
        def retain(event):
            self.events.append(event)
            if event['event']=='command-start':self.allowed=False
        self.owner.retain=retain
        with self.assertRaisesRegex(RuntimeError,'authorization'):self.create()
        self.assertFalse(self.fake.calls)
        self.assertEqual([e['event'] for e in self.events],['command-start','command-terminal'])
        self.assertFalse(self.events[-1]['executor_invoked'])

    def test_executor_timeout_exception_retains_known_partial_streams(self):
        def timeout(argv, seconds):
            raise subprocess.TimeoutExpired(argv, seconds, output=b'partial stdout', stderr=b'partial stderr')
        self.owner.execute=timeout
        with self.assertRaises(subprocess.TimeoutExpired):self.create()
        terminal=self.events[-1]
        self.assertEqual(terminal['stdout'],m.raw(b'partial stdout'))
        self.assertEqual(terminal['stderr'],m.raw(b'partial stderr'))
        self.assertTrue(terminal['output_capture_incomplete'])

    def test_evidence_records_immutable_and_exclusive(self):
        with tempfile.TemporaryDirectory() as temp:
            sink=m.JsonEvidence(pathlib.Path(temp)/'owned')
            event={'event':'example','nested':{'value':1}}
            sink(event);event['nested']['value']=2
            path=sink.directory/'0001-example.json'
            self.assertEqual(json.loads(path.read_text())['nested']['value'],1)
            with self.assertRaises(FileExistsError):m.JsonEvidence(sink.directory)

    def test_absolute_budget_includes_intent_retention_and_caps_executor(self):
        clock = [10.0]
        self.owner.guard = m.Deadline(14.5, clock=lambda: clock[0])
        def retain(event):
            self.events.append(event)
            if event['event'] == 'command-start':
                clock[0] += 1
        self.owner.retain = retain
        self.owner._call('bounded-list', m.DEVICE_LIST)
        self.assertEqual(self.events[0]['timeout_seconds'], 4.5)
        self.assertEqual(self.fake.calls[0][1], 3.5)

    def test_expired_retention_never_launches_and_late_zero_never_accepts(self):
        for stage in ('retention', 'executor'):
            with self.subTest(stage=stage):
                self.setUp()
                clock = [0.0]
                self.owner.guard = m.Deadline(1, clock=lambda: clock[0])
                if stage == 'retention':
                    def retain(event):
                        self.events.append(event)
                        clock[0] = 2
                    self.owner.retain = retain
                else:
                    self.fake.after = lambda argv: clock.__setitem__(0, 2)
                with self.assertRaisesRegex(RuntimeError, 'authorization'):
                    self.owner._call('bounded-list', m.DEVICE_LIST)
                self.assertEqual(bool(self.fake.calls), stage == 'executor')
                self.assertEqual(self.events[-1]['executor_invoked'], stage == 'executor')

    def test_executor_error_preserved_when_terminal_retention_fails(self):
        def fail(argv, seconds):
            raise TimeoutError('primary command deadline')
        def retain(event):
            if event['event'] == 'command-terminal':
                raise OSError('disk full')
        self.owner.execute, self.owner.retain = fail, retain
        with self.assertRaisesRegex(TimeoutError, 'primary command deadline') as raised:
            self.owner._call('bounded-list', m.DEVICE_LIST)
        self.assertIsInstance(raised.exception.__cause__, OSError)
        self.assertIn('disk full', raised.exception.__notes__[0])

    def test_absolute_budget_cancellation_and_invalid_deadline(self):
        allowed = [True]
        deadline = m.Deadline(4.5, clock=lambda: 1, permitted=lambda: allowed[0])
        self.assertEqual(deadline.remaining(), 3.5)
        allowed[0] = False
        self.assertFalse(deadline())
        self.assertEqual(deadline.remaining(), 0)
        for value in (float('nan'), float('inf'), -float('inf')):
            with self.assertRaises(RuntimeError):
                m.Deadline(value)

    def test_real_executor_refuses_non_macos_without_spawning(self):
        if m.sys.platform=='darwin':self.skipTest('Portable control specifically checks non-macOS refusal')
        with self.assertRaisesRegex(RuntimeError,'macOS'):m.execute_simctl(m.DEVICE_LIST,1)


if __name__=='__main__':unittest.main()
