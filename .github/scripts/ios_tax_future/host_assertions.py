"""PREPARATION ONLY. Offline assertions and regular-file snapshot helpers.

No simctl, process control, installation, storage mutation or acceptance fixture
is performed by this module. Future integration must reuse PR72 transport proof.
"""
import base64,hashlib,json,pathlib,re,stat

PHASES=('baseline-write','baseline-read','workspace-future','tax-future-unsafe',
        'import-future-unsafe','tax-future-safe','import-future-safe',
        'tax-future-tmp','tax-future-bak','restored-read')
ROOTS=('guided_studio_v1','tax_authoring_v1','authoring_import_v1')
SELECTED='production application future data preservation'
SCHEMA='tax-ios-future-application-v1'
def sha(data):return hashlib.sha256(data).hexdigest()
def raw_record(data):return {'bytes':len(data),'sha256':sha(data),'base64':base64.b64encode(data).decode('ascii')}
def raw(record):
    assert set(record)=={'bytes','sha256','base64'}
    data=base64.b64decode(record['base64'],validate=True)
    assert len(data)==record['bytes'] and sha(data)==record['sha256']
    return data
def validate_inventory(value):
    for name,entry in value.items():
        path=pathlib.PurePosixPath(name)
        assert path.as_posix()==name
        assert not path.is_absolute() and '..' not in path.parts and '\\' not in name
        assert path.parts[0] in ROOTS
        if len(path.parts)==1:assert entry=={'directory':True}
        else:assert value.get(path.parent.as_posix())=={'directory':True},'Missing parent directory entry'
        if entry!={'directory':True}:raw(entry)
    return value
def snapshot_support(container,support):
    """Read observed paths only; caller binds container to actual simctl output.

    Reject symlinks from container down, including authoring directory parents.
    Retain directory inventory as well as every complete regular file.
    """
    container=pathlib.Path(container).resolve(strict=True);support=pathlib.Path(support)
    assert support.is_absolute() and '..' not in support.parts,'Noncanonical support path refused'
    relative=support.relative_to(container)
    cursor=container
    for part in relative.parts:
        cursor=cursor/part
        assert cursor.is_relative_to(container)
        assert not cursor.is_symlink() and cursor.is_dir()
    support=cursor;answer={}
    for root in ROOTS:
        folder=support/root
        if not folder.exists():assert not folder.is_symlink();continue
        assert not folder.is_symlink() and folder.is_dir()
        answer[root]={'directory':True}
        for child in sorted(folder.rglob('*')):
            mode=child.lstat().st_mode
            assert stat.S_ISREG(mode) or stat.S_ISDIR(mode),'symlink/special file refused'
            name=child.relative_to(support).as_posix()
            answer[name]={'directory':True} if stat.S_ISDIR(mode) else raw_record(child.read_bytes())
    return validate_inventory(answer)
def make_fixtures(baseline):
    """Return labelled constructed bytes. No filesystem or device writes."""
    assert baseline['schema']==SCHEMA and baseline['completed_phase']=='baseline-write'
    artifact=baseline['artifact'];case_id=artifact['case_id']
    assert case_id==baseline['scenario']['metadata']['id']
    assert artifact['scenario']==baseline['scenario']
    assert artifact['schema']=='tax-authoring-artifact-v1'
    # Same raw grammar as Android's independently retained178/174-byte controls.
    # Rebind ONLY case_id if the actual UI baseline uses another identity.
    def tax(number):
        return ('\ufeff{ "schema": "tax-authoring-artifact-v99",\r\n "case_id": '+
                json.dumps(case_id,ensure_ascii=False)+', "amount": '+number+
                ', "rate": 1.2300e+0, "unknown": { "escaped": "\\u00e9" } }\r\n').encode('utf8')
    workspace={'schema_version':99,'scenario':baseline['scenario'],
               'active_stage':baseline['workspace_progress']['active_stage'],
               'completed_stages':baseline['workspace_progress']['completed_stages'],
               'unknown':{'preserve':['future-layout',{'coefficient':'1.2300e+0'}]}}
    fixtures={'workspace-future':('\ufeff'+json.dumps(workspace,ensure_ascii=False,indent=2)+'\r\n').encode('utf8'),
              'tax-future-unsafe':tax('18446744073709551617'),
              'tax-future-safe':tax('9007199254740991')}
    target=f'tax_authoring_v1/{sha(case_id.encode("utf8"))}.json'
    return {'schema':'ios-future-constructed-fixtures-v1','constructed_fixture':True,
            'interruption_evidence':False,'case_id':case_id,'tax_target':target,
            'fixtures':{name:raw_record(data) for name,data in fixtures.items()},
            'placements':{'workspace-future':'guided_studio_v1/workspace.json',
                          'tax-future-unsafe':target,'tax-future-safe':target,
                          'tax-future-tmp':target+'.tmp','tax-future-bak':target+'.bak'},
            'auxiliary_fixture':'tax-future-safe'}
def calculate_calls(receipt):
    result=[]
    for call in receipt['native_calls']:
        assert json.loads(call['request_json'])==call['request']
        assert json.loads(call['response_json'])==call['response']
        if call['request']['command']=='tax_calculate':result.append(call)
    return result
def assert_control(control_bytes,receipt,baseline_bytes):
    if receipt['phase']=='baseline-write':
        assert control_bytes is None and receipt['control_sha256'] is None
        return
    assert control_bytes is not None and len(control_bytes)<=1048576
    def strict_object(pairs):
        result={}
        for key,value in pairs:
            assert key not in result,'Duplicate control key'
            result[key]=value
        return result
    control=json.loads(control_bytes,object_pairs_hook=strict_object)
    assert set(control)=={'schema','phase','phase_index','source_sha','run_nonce','previous_pid','baseline_sha256','fixture_base64'}
    assert control['schema']=='ios-future-host-control-v1'
    assert sha(control_bytes)==receipt['control_sha256']
    assert sha(baseline_bytes)==control['baseline_sha256']
    for key in ('phase','phase_index','source_sha','run_nonce','previous_pid'):assert control[key]==receipt[key]
    assert type(control['phase_index']) is int and control['phase_index']==PHASES.index(control['phase'])
    assert type(control['previous_pid']) is int and control['previous_pid']>0
    expected_fixture={'workspace-future':'workspace-future',
                      'tax-future-unsafe':'tax-future-unsafe','import-future-unsafe':'tax-future-unsafe',
                      'tax-future-safe':'tax-future-safe','import-future-safe':'tax-future-safe',
                      'tax-future-tmp':'tax-future-safe','tax-future-bak':'tax-future-safe'}.get(control['phase'])
    if expected_fixture:
        expected=make_fixtures(json.loads(baseline_bytes))['fixtures'][expected_fixture]
        assert base64.b64decode(control['fixture_base64'],validate=True)==raw(expected),'Fixture bytes do not match declared phase and baseline'
    else:assert control['fixture_base64'] is None
def assert_saved_pair(receipt,disk):
    validate_inventory(disk)
    case_id=receipt['scenario']['metadata']['id']
    assert type(case_id) is str and case_id and receipt['artifact']['case_id']==case_id
    target=f'tax_authoring_v1/{sha(case_id.encode("utf8"))}.json'
    workspace=json.loads(raw(disk['guided_studio_v1/workspace.json']).decode('utf-8-sig'))
    artifact=json.loads(raw(disk[target]).decode('utf-8-sig'))
    assert workspace==receipt['workspace_envelope'],'Whole saved workspace differs from receipt'
    assert set(workspace)=={'schema_version','scenario','active_stage','completed_stages'}
    assert workspace['schema_version']==1 and workspace['scenario']==receipt['scenario']
    assert type(workspace['completed_stages']) is list and all(type(item) is str for item in workspace['completed_stages'])
    assert len(set(workspace['completed_stages']))==len(workspace['completed_stages'])
    assert {'active_stage':workspace['active_stage'],'completed_stages':sorted(workspace['completed_stages'])}==receipt['workspace_progress']
    assert artifact==receipt['artifact'],'Whole saved analysis differs from receipt'
def assert_phase(receipt,phase,source,nonce,previous_pid,host_before,host_after,baseline,fixtures):
    """Only semantic assertions; transport/log/screenshot verification remains required."""
    assert receipt['schema']==SCHEMA and receipt['selected_test']==SELECTED
    assert receipt['phase']==receipt['completed_phase']==phase and phase in PHASES
    assert receipt['phase_index']==PHASES.index(phase)
    assert receipt['source_sha']==source and receipt['run_nonce']==nonce
    assert receipt['platform']=='ios' and receipt['entry_method']=='programmatic_flutter_test'
    assert type(receipt['pid']) is int and receipt['pid']>0 and receipt['pid']!=previous_pid
    assert receipt['previous_pid']==previous_pid and receipt['interruption_evidence'] is False
    assert validate_inventory(receipt['before'])==validate_inventory(host_before)
    assert validate_inventory(receipt['after'])==validate_inventory(host_after)
    calls=calculate_calls(receipt)
    if phase=='workspace-future':
        assert receipt['persistent_recovery'] is True and not calls
        assert host_before==host_after
        assert raw(host_before['guided_studio_v1/workspace.json'])==raw(fixtures['fixtures'][phase])
    elif phase.startswith('tax-future-'):
        assert receipt['tax_read_only'] is True and not calls
        assert all(call['request']['command'] not in ('tax_prepare','tax_capabilities','tax_calculate') for call in receipt['native_calls'])
        assert host_before==host_after
        fixture=phase if phase.endswith(('safe','unsafe')) else 'tax-future-safe'
        assert raw(host_before[fixtures['placements'][phase]])==raw(fixtures['fixtures'][fixture])
        if phase in ('tax-future-safe','tax-future-unsafe'):
            export=dict(receipt['export']);name=export.pop('path')
            assert re.fullmatch(r'tax-workspace-[0-9]+-[0-9]+\.json',name)
            assert raw(export)==raw(fixtures['fixtures'][fixture])
            assert base64.b64decode(receipt['clipboard_export_base64'],validate=True)==raw(export)
        else:
            assert host_before[fixtures['tax_target']]==baseline['after'][fixtures['tax_target']]
    elif phase.startswith('import-future-'):
        # Actual navigation may change only workspace progress before import.
        import_before=validate_inventory(receipt['import_before'])
        assert import_before==host_after and not calls
        target='guided_studio_v1/workspace.json'
        backup=target+'.bak'
        assert set(import_before)<=set(host_before)|{backup}
        assert set(host_before)<=set(import_before)
        for name in host_before:
            if name not in (target,backup):assert import_before[name]==host_before[name]
        prior=json.loads(raw(host_before[target]).decode('utf-8-sig'))
        navigated=json.loads(raw(import_before[target]).decode('utf-8-sig'))
        assert navigated=={**prior,'active_stage':'describe'}
        if import_before[target]!=host_before[target]:
            assert import_before[backup]==host_before[target]
        elif backup in host_before:
            assert import_before[backup]==host_before[backup]
        key='tax-future-unsafe' if phase.endswith('unsafe') else 'tax-future-safe'
        assert base64.b64decode(receipt['imported_raw_base64'],validate=True)==raw(fixtures['fixtures'][key])
        expected=('Aggregate number would change value when imported. Original input is unchanged.'
                  if phase.endswith('unsafe') else 'Unsupported analysis workspace. Original input is unchanged.')
        assert receipt['expected_refusal']==expected
    else:
        assert_saved_pair(receipt,host_after)
        if phase=='baseline-write':
            assert all(name in ROOTS and entry=={'directory':True} for name,entry in host_before.items()),'Bootstrap requires absent or empty owned roots'
        assert len(calls)==1 and calls[0]['response']['type']=='tax_calculated'
        assert receipt['artifact']['scenario']==receipt['scenario']
        artifact=receipt['artifact'];command=calls[0]['request'];response=calls[0]['response']
        assert command['scenario']==artifact['scenario']
        assert command['request']==artifact['request']
        assert command['bindings']==artifact['bindings']
        assert command['required_component_ids']==artifact['required_component_ids']
        assert response['draft']==artifact['binding_draft']
        assert response['source']==artifact['source']
        assert response['calculation']==artifact['calculation']
        if phase!='baseline-write':
            assert host_before==host_after==baseline['after']
            for field in ('scenario','artifact','workspace_progress'):assert receipt[field]==baseline[field]
def assert_final_pair(baseline_read,restored_read):
    for field in ('scenario','artifact','workspace_progress','workspace_envelope'):assert baseline_read[field]==restored_read[field]
    assert baseline_read['pid']!=restored_read['pid']
    assert calculate_calls(baseline_read)==calculate_calls(restored_read),'Full fresh native request/response mismatch'
def assert_owned_simulator_deleted(host):
    """Verify retained host observations; this function never invokes simctl.

    The integrating verifier separately binds host source/nonce to the exact
    checkout/job. Fresh ownership requires observed absence before creation,
    matching create output and list entry, then exact-UUID delete and absence.
    """
    lifecycle=host['simulator_lifecycle'];udid=lifecycle['udid']
    assert re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}',udid)
    assert lifecycle['source_sha']==host['source_sha'] and re.fullmatch(r'[0-9a-f]{40}',host['source_sha'])
    assert lifecycle['run_nonce']==host['run_nonce'] and re.fullmatch(r'[A-Za-z0-9_-]{1,80}',host['run_nonce'])
    def command(name,argv):
        entry=lifecycle[name]
        assert entry['argv']==argv and type(entry['exit']) is int and entry['exit']==0
        # Historical preparation fixtures have only argv/exit/raw streams. Rich
        # lifecycle records must never hide an explicit timeout, non-execution,
        # truncated capture or executor error behind a nominal exit-zero value.
        assert entry.get('timed_out',False) is False
        assert entry.get('error') is None and entry.get('executor_error') is None
        assert entry.get('executor_invoked',True) is True
        assert entry.get('output_capture_incomplete',False) is False
        raw(entry['stderr'])
        return raw(entry['stdout'])
    def devices(name):
        result=json.loads(command(name,['xcrun','simctl','list','devices','--json']))
        assert type(result['devices']) is dict
        found={}
        for runtime,group in result['devices'].items():
            assert type(group) is list
            for device in group:
                key=device['udid'].lower()
                assert key not in found
                found[key]=(runtime,device)
        return found
    before=devices('before_create')
    assert udid.lower() not in before,'Simulator was not newly owned'
    create=lifecycle['create'];name='Juris Tax Future '+host['run_nonce']
    argv=create['argv']
    assert len(argv)==6 and argv[:4]==['xcrun','simctl','create',name]
    assert argv[4].startswith('com.apple.CoreSimulator.SimDeviceType.')
    assert argv[5].startswith('com.apple.CoreSimulator.SimRuntime.')
    assert command('create',argv).decode('ascii').strip()==udid
    created=devices('after_create')
    assert set(before)<=set(created),'Pre-existing Simulator disappeared during creation'
    assert created[udid.lower()][0]==argv[5],'Created Simulator runtime differs'
    assert created[udid.lower()][1]['name']==name
    command('shutdown',['xcrun','simctl','shutdown',udid])
    stopped=devices('after_shutdown')
    assert set(before)<=set(stopped),'Pre-existing Simulator disappeared during shutdown'
    assert stopped[udid.lower()][0]==argv[5]
    assert stopped[udid.lower()][1]['name']==name and stopped[udid.lower()][1]['state']=='Shutdown'
    command('delete',['xcrun','simctl','delete',udid])
    final=devices('after_delete')
    assert udid.lower() not in final,'Owned Simulator still exists'
    assert set(before)<=set(final),'Pre-existing Simulator disappeared during deletion'
def assert_cleanup(original,final,original_exports,final_exports,clipboard_before,clipboard_after,host):
    assert validate_inventory(original)==validate_inventory(final)
    assert original_exports==final_exports
    assert host['settings_before']==host['settings_after']
    assert host['remaining_owned_pids']==[] and host['remaining_owned_forwards']==[]
    assert host['owned_control_files_remaining']==[] and host['process_absent'] is True
    if host['cleanup_mode']=='reused_simulator_restored':
        assert clipboard_before==clipboard_after # null may never be silently mapped to empty.
        assert host['clipboard_restored'] is True
    else:
        assert host['cleanup_mode']=='isolated_simulator_destroyed'
        assert host['clipboard_restored'] is False # Destruction is not clipboard restoration.
        assert_owned_simulator_deleted(host)
    # Host must separately match getVM + actual executable PID, full installed
    # bundle, structured system-log URI, selected test success, PNG and audits.
