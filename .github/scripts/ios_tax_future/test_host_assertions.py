"""Verifier logic controls only: never application acceptance evidence."""
import copy,json,pathlib,tempfile,unittest
import host_assertions as h
class PreparationControls(unittest.TestCase):
    def baseline(self):
        source={'metadata':{'id':'supplier_transition_dispute'},'schema_version':'1.0'}
        return {'schema':h.SCHEMA,'completed_phase':'baseline-write','scenario':source,
                'artifact':{'schema':'tax-authoring-artifact-v1','case_id':'supplier_transition_dispute','scenario':source},
                'workspace_progress':{'active_stage':'case_map','completed_stages':[]}}
    def test_exact_android_grammar(self):
        fixtures=h.make_fixtures(self.baseline())
        unsafe=h.raw(fixtures['fixtures']['tax-future-unsafe']);safe=h.raw(fixtures['fixtures']['tax-future-safe'])
        self.assertEqual(len(unsafe),178);self.assertEqual(len(safe),174)
        self.assertEqual(h.sha(unsafe),'0f883c3751585257a9fa4ddf0c5cdda7598497fef47b0bf606f5234879778d00')
        self.assertIn(b'1.2300e+0',unsafe);self.assertIn(b'\\u00e9',unsafe)
        self.assertEqual(unsafe.replace(b'18446744073709551617',b'9007199254740991'),safe)
    def test_raw_inventory_detects_lexical_change_and_path_escape(self):
        record=h.raw_record(b'\xef\xbb\xbf{"n":1.2300e+0}\r\n')
        bad=copy.deepcopy(record);bad['base64']=h.raw_record(b'{"n":1.23}')['base64']
        with self.assertRaises(AssertionError):h.raw(bad)
        with self.assertRaises(AssertionError):h.validate_inventory({'../workspace.json':record})
        with self.assertRaises(AssertionError):h.validate_inventory({'/workspace.json':record})
    def test_whole_native_exchange_required(self):
        call={'request_json':'{"command":"tax_calculate","x":1}','response_json':'{"type":"tax_calculated","unknown":{"a":2}}',
              'request':{'command':'tax_calculate','x':1},'response':{'type':'tax_calculated','unknown':{'a':2}}}
        first={'pid':1,'scenario':{},'artifact':{},'workspace_progress':{},'workspace_envelope':{},'native_calls':[call]}
        second=copy.deepcopy(first);second['pid']=2;h.assert_final_pair(first,second)
        second['native_calls'][0]['response']['unknown']['a']=3
        with self.assertRaises(AssertionError):h.assert_final_pair(first,second)
    def test_message_alone_cannot_prove_future_preservation(self):
        fixture=h.make_fixtures(self.baseline());phase='tax-future-safe'
        disk={'tax_authoring_v1':{'directory':True},fixture['tax_target']:fixture['fixtures'][phase]}
        receipt={'schema':h.SCHEMA,'selected_test':h.SELECTED,'phase':phase,'completed_phase':phase,
                 'phase_index':h.PHASES.index(phase),
                 'source_sha':'a'*40,'run_nonce':'unit-control','platform':'ios','entry_method':'programmatic_flutter_test',
                 'pid':2,'previous_pid':1,'interruption_evidence':False,'before':disk,'after':disk,'native_calls':[],
                 'tax_read_only':True,'export':{'path':'tax-workspace-1-1.json',**fixture['fixtures'][phase]},
                 'clipboard_export_base64':fixture['fixtures'][phase]['base64']}
        h.assert_phase(receipt,phase,'a'*40,'unit-control',1,disk,disk,{},fixture)
        bad=copy.deepcopy(receipt);bad['export']=dict(bad['export'])
        bad['export'].update(h.raw_record(b'{"schema":"future"}'))
        with self.assertRaises(AssertionError):h.assert_phase(bad,phase,'a'*40,'unit-control',1,disk,disk,{},fixture)
        bad=copy.deepcopy(receipt);bad['pid']=1
        with self.assertRaises(AssertionError):h.assert_phase(bad,phase,'a'*40,'unit-control',1,disk,disk,{},fixture)
    def test_null_clipboard_not_empty_and_no_unremoved_controls(self):
        host={'settings_before':{},'settings_after':{},'remaining_owned_pids':[],
              'remaining_owned_forwards':[],'owned_control_files_remaining':[],'process_absent':True,
              'cleanup_mode':'reused_simulator_restored','clipboard_restored':True}
        h.assert_cleanup({}, {}, {}, {}, None,None,host)
        with self.assertRaises(AssertionError):h.assert_cleanup({}, {}, {}, {}, None,'',host)
        host['owned_control_files_remaining']=['control.json']
        with self.assertRaises(AssertionError):h.assert_cleanup({}, {}, {}, {}, None,None,host)
    def test_control_binds_exact_bytes_and_rejects_duplicate_field(self):
        control={'schema':'ios-future-host-control-v1','phase':'baseline-read','phase_index':1,
                 'source_sha':'a'*40,'run_nonce':'unit-control','previous_pid':1,
                 'baseline_sha256':h.sha(b'baseline'),'fixture_base64':None}
        encoded=json.dumps(control).encode();receipt={**control,'control_sha256':h.sha(encoded)}
        h.assert_control(encoded,receipt,b'baseline')
        with self.assertRaises(AssertionError):h.assert_control(encoded,receipt,b'changed')
        duplicate=encoded[:-1]+b',"phase":"baseline-read"}'
        receipt['control_sha256']=h.sha(duplicate)
        with self.assertRaises(AssertionError):h.assert_control(duplicate,receipt,b'baseline')
    def test_control_fixture_matches_every_declared_phase_and_baseline(self):
        baseline=self.baseline();encoded_baseline=json.dumps(baseline).encode()
        fixtures=h.make_fixtures(baseline)['fixtures']
        expected={'workspace-future':'workspace-future','tax-future-unsafe':'tax-future-unsafe',
                  'import-future-unsafe':'tax-future-unsafe','tax-future-safe':'tax-future-safe',
                  'import-future-safe':'tax-future-safe','tax-future-tmp':'tax-future-safe','tax-future-bak':'tax-future-safe'}
        for phase,key in expected.items():
            with self.subTest(phase=phase):
                control={'schema':'ios-future-host-control-v1','phase':phase,'phase_index':h.PHASES.index(phase),
                         'source_sha':'a'*40,'run_nonce':'unit-control','previous_pid':1,
                         'baseline_sha256':h.sha(encoded_baseline),'fixture_base64':fixtures[key]['base64']}
                def check(value,baseline_bytes=encoded_baseline):
                    data=json.dumps(value).encode()
                    h.assert_control(data,{**value,'control_sha256':h.sha(data)},baseline_bytes)
                check(control)
                # Rehashing a syntactically valid, different fixture must not make it pass.
                other='tax-future-unsafe' if key!='tax-future-unsafe' else 'tax-future-safe'
                bad={**control,'fixture_base64':fixtures[other]['base64']}
                with self.assertRaises(AssertionError):check(bad)
                value=json.loads(h.raw(fixtures[key]).decode('utf-8-sig'))
                bad={**control,'fixture_base64':h.raw_record(json.dumps(value).encode())['base64']}
                with self.assertRaises(AssertionError):check(bad)
                changed=copy.deepcopy(baseline);changed['scenario']['metadata']['id']='another-case'
                changed['artifact']['case_id']='another-case';changed_bytes=json.dumps(changed).encode()
                bad={**control,'baseline_sha256':h.sha(changed_bytes)}
                with self.assertRaises(AssertionError):check(bad,changed_bytes)
        for phase in ('baseline-read','restored-read'):
            control={'schema':'ios-future-host-control-v1','phase':phase,'phase_index':h.PHASES.index(phase),
                     'source_sha':'a'*40,'run_nonce':'unit-control','previous_pid':1,
                     'baseline_sha256':h.sha(encoded_baseline),'fixture_base64':fixtures['tax-future-safe']['base64']}
            data=json.dumps(control).encode()
            with self.assertRaises(AssertionError):h.assert_control(data,{**control,'control_sha256':h.sha(data)},encoded_baseline)
    def test_saved_pair_binds_whole_disk_objects_and_actual_case_filename(self):
        receipt=self.baseline()
        receipt['workspace_envelope']={'schema_version':1,'scenario':receipt['scenario'],
            'active_stage':'case_map','completed_stages':['roles','describe']}
        receipt['workspace_progress']['completed_stages']=['describe','roles']
        target=h.make_fixtures(receipt)['tax_target']
        disk={'guided_studio_v1':{'directory':True},'tax_authoring_v1':{'directory':True},
              'guided_studio_v1/workspace.json':h.raw_record(json.dumps(receipt['workspace_envelope']).encode()),
              target:h.raw_record(json.dumps(receipt['artifact']).encode())}
        h.assert_saved_pair(receipt,disk)
        # Self-consistent receipt edits cannot redefine the observed disk baseline.
        bad=copy.deepcopy(receipt)
        bad['scenario']['metadata']['new_field']={'retained':'different'}
        with self.assertRaises(AssertionError):h.assert_saved_pair(bad,disk)
        bad=copy.deepcopy(receipt);bad['artifact']['unknown']={'nested':['changed']}
        with self.assertRaises(AssertionError):h.assert_saved_pair(bad,disk)
        bad=copy.deepcopy(receipt);bad['workspace_progress']['completed_stages'].reverse()
        with self.assertRaises(AssertionError):h.assert_saved_pair(bad,disk)
        bad_disk=copy.deepcopy(disk)
        bad_disk['tax_authoring_v1/wrong-case.json']=bad_disk.pop(target)
        with self.assertRaises(KeyError):h.assert_saved_pair(receipt,bad_disk)
        bad_disk=copy.deepcopy(disk);changed=copy.deepcopy(receipt['artifact']);changed['new']={'x':1}
        bad_disk[target]=h.raw_record(json.dumps(changed).encode())
        with self.assertRaises(AssertionError):h.assert_saved_pair(receipt,bad_disk)
        bad=copy.deepcopy(receipt);bad['workspace_envelope']['completed_stages']=['describe','describe']
        bad_disk=copy.deepcopy(disk)
        bad_disk['guided_studio_v1/workspace.json']=h.raw_record(json.dumps(bad['workspace_envelope']).encode())
        with self.assertRaises(AssertionError):h.assert_saved_pair(bad,bad_disk)
    def test_empty_roots_are_observable_and_missing_parents_rejected(self):
        with tempfile.TemporaryDirectory(dir=pathlib.Path(__file__).parent) as temp:
            root=pathlib.Path(temp).resolve();support=root/'Support';support.mkdir()
            self.assertEqual(h.snapshot_support(root,support),{})
            expected={}
            for name in h.ROOTS:
                (support/name).mkdir();expected[name]={'directory':True}
                self.assertEqual(h.snapshot_support(root,support),expected)
            (support/h.ROOTS[0]/'workspace.json').write_bytes(b'{}')
            populated=h.snapshot_support(root,support)
            self.assertNotEqual(populated,expected)
            self.assertEqual(h.raw(populated[h.ROOTS[0]+'/workspace.json']),b'{}')
            host={'settings_before':{},'settings_after':{},'remaining_owned_pids':[],
                  'remaining_owned_forwards':[],'owned_control_files_remaining':[],'process_absent':True,
                  'cleanup_mode':'reused_simulator_restored','clipboard_restored':True}
            with self.assertRaises(AssertionError):h.assert_cleanup({},expected,{}, {},None,None,host)
            with self.assertRaises(AssertionError):h.validate_inventory({h.ROOTS[0]:h.raw_record(b'{}')})
            with self.assertRaises(AssertionError):h.validate_inventory({h.ROOTS[0]+'/workspace.json':h.raw_record(b'{}')})
    def test_isolated_cleanup_proves_exact_owned_creation_and_deletion_not_clipboard_restore(self):
        udid='11111111-2222-3333-4444-555555555555';nonce='control-1'
        runtime='com.apple.CoreSimulator.SimRuntime.iOS-26-0'
        original={'udid':'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee','name':'Pre-existing','state':'Shutdown'}
        created={'udid':udid,'name':'Juris Tax Future '+nonce,'state':'Shutdown'}
        def command(argv,stdout):return {'argv':argv,'exit':0,'stdout':h.raw_record(stdout),'stderr':h.raw_record(b'')}
        def listing(entries,runtime_id=runtime):return command(['xcrun','simctl','list','devices','--json'],json.dumps({'devices':{runtime_id:entries}}).encode())
        lifecycle={'udid':udid,'source_sha':'a'*40,'run_nonce':nonce,
            'before_create':listing([original]),'after_create':listing([original,created]),
            'create':command(['xcrun','simctl','create','Juris Tax Future '+nonce,
                             'com.apple.CoreSimulator.SimDeviceType.iPhone-17','com.apple.CoreSimulator.SimRuntime.iOS-26-0'],(udid+'\n').encode()),
            'shutdown':command(['xcrun','simctl','shutdown',udid],b''),'after_shutdown':listing([original,created]),
            'delete':command(['xcrun','simctl','delete',udid],b''),'after_delete':listing([original])}
        host={'cleanup_mode':'isolated_simulator_destroyed','clipboard_restored':False,
              'source_sha':'a'*40,'run_nonce':nonce,'simulator_lifecycle':lifecycle,
              'settings_before':{},'settings_after':{},'remaining_owned_pids':[],
              'remaining_owned_forwards':[],'owned_control_files_remaining':[],'process_absent':True}
        h.assert_cleanup({}, {}, {}, {},None,'fixture text',host)
        controls=[('before_create',lifecycle['after_create']),('after_delete',lifecycle['after_create']),
                  ('after_create',listing([created])),('after_delete',listing([])),
                  ('after_create',listing([original,created],'com.apple.CoreSimulator.SimRuntime.iOS-25-0')),
                  ('after_shutdown',listing([original,{**created,'state':'Booted'}])),
                  ('shutdown',command(['xcrun','simctl','shutdown','all'],b'')),
                  ('shutdown',command(['xcrun','simctl','shutdown',original['udid']],b'')),
                  ('delete',command(['xcrun','simctl','delete','all'],b'')),
                  ('create',command(lifecycle['create']['argv'],b'aaaaaaaa-2222-3333-4444-555555555555\n'))]
        for key,value in controls:
            bad=copy.deepcopy(host);bad['simulator_lifecycle'][key]=value
            with self.subTest(key=key),self.assertRaises(AssertionError):h.assert_cleanup({}, {}, {}, {},None,None,bad)
        bad=copy.deepcopy(host);bad['simulator_lifecycle']['delete']['exit']=1
        with self.assertRaises(AssertionError):h.assert_cleanup({}, {}, {}, {},None,None,bad)
        bad=copy.deepcopy(host);bad['simulator_lifecycle']['shutdown']['exit']=1
        with self.assertRaises(AssertionError):h.assert_cleanup({}, {}, {}, {},None,None,bad)
        bad=copy.deepcopy(host);del bad['simulator_lifecycle']['shutdown']
        with self.assertRaises(KeyError):h.assert_cleanup({}, {}, {}, {},None,None,bad)
        bad=copy.deepcopy(host);bad['clipboard_restored']=True
        with self.assertRaises(AssertionError):h.assert_cleanup({}, {}, {}, {},None,None,bad)
        # The richer lifecycle adapter's zero exit is insufficient if it also
        # reports a timeout, incomplete capture or no actual executor call.
        rich=copy.deepcopy(host)
        stages=('before_create','create','after_create','shutdown','after_shutdown','delete','after_delete')
        for stage in stages:
            rich['simulator_lifecycle'][stage].update(timed_out=False,error=None,executor_invoked=True)
        h.assert_cleanup({}, {}, {}, {},None,None,rich)
        for stage in stages:
            for field,value in (('timed_out',True),('timed_out',0),('error','output truncated; no acceptance'),
                                ('error',''),('executor_invoked',False),('executor_invoked',1),
                                ('executor_error','timeout'),('output_capture_incomplete',True)):
                bad=copy.deepcopy(rich);bad['simulator_lifecycle'][stage][field]=value
                with self.subTest(stage=stage,field=field,value=value),self.assertRaises(AssertionError):
                    h.assert_cleanup({}, {}, {}, {},None,None,bad)
    def test_support_containment_and_regular_file_snapshot(self):
        with tempfile.TemporaryDirectory(dir=pathlib.Path(__file__).parent) as temp:
            root=pathlib.Path(temp).resolve();support=root/'container'/'Library'/'Application Support';support.mkdir(parents=True)
            directory=support/'tax_authoring_v1';directory.mkdir();(directory/'example.json').write_bytes(b'{"schema":"future"}')
            container=root/'container';snapshot=h.snapshot_support(container,support)
            self.assertEqual(h.raw(snapshot['tax_authoring_v1/example.json']),b'{"schema":"future"}')
            self.assertEqual(snapshot['tax_authoring_v1'],{'directory':True})
            with self.assertRaises(ValueError):h.snapshot_support(container,root)
            outside=root/'outside';(outside/'tax_authoring_v1').mkdir(parents=True)
            (outside/'tax_authoring_v1'/'probe.json').write_bytes(b'{"must_not_read":true}')
            with self.assertRaises(AssertionError):h.snapshot_support(container,container/'..'/'outside')
if __name__=='__main__':unittest.main()
