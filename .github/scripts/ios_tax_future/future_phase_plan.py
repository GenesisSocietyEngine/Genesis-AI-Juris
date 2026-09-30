"""Pure ignored preparation: no filesystem/process mutation or live authorization.

Inputs are already-retained host observations, not an authority to seed a device.
The future host must separately validate transport, selected test, actual disk,
container identity, process absence, cancellation and cleanup before any action.
"""
from dataclasses import dataclass
import base64
import hashlib
import importlib.util
import json
import math
import pathlib
import re
import struct

_path = pathlib.Path(__file__).resolve().with_name('host_assertions.py')
_spec = importlib.util.spec_from_file_location('future_plan_host_assertions', _path)
h = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(h)
PHASES = h.PHASES
MAX_JSON = 64 * 1024 * 1024
MAX_CHAIN = 128 * 1024 * 1024
MAX_INVENTORY = 16 * 1024 * 1024
MAX_PNG = 4 * 1024 * 1024
MAX_NODES = 1000000


def require(condition, message):
    if not condition:
        raise ValueError(message)


def encode(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')


def same(left, right):
    return encode(left) == encode(right)


def decode(data, limit=MAX_JSON):
    require(type(data) is bytes and 0 < len(data) <= limit, 'Missing or oversized JSON bytes')
    # Check depth before the standard decoder can recurse. Brackets in retained
    # original JSON strings do not count as receipt structure.
    text = data.decode('utf-8', errors='strict')
    depth = 0
    quoted = escaped = False
    for char in text:
        if quoted:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == '"':
                quoted = False
        elif char == '"':
            quoted = True
        elif char in '[{':
            depth += 1
            require(depth <= 64, 'JSON depth exceeds bound')
        elif char in ']}':
            depth -= 1
    def unique(pairs):
        answer = {}
        for key, value in pairs:
            require(key not in answer, 'Duplicate decoded JSON key')
            answer[key] = value
        return answer
    def invalid(_):
        raise ValueError('Nonfinite JSON number')
    value = json.loads(text, object_pairs_hook=unique, parse_constant=invalid)
    stack, nodes = [value], 0
    while stack:
        item = stack.pop()
        nodes += 1
        require(nodes <= MAX_NODES, 'JSON node limit exceeded')
        if type(item) is dict:
            stack.extend(item.values())
        elif type(item) is list:
            stack.extend(item)
        elif type(item) is float:
            require(math.isfinite(item), 'Nonfinite decoded number')
    require(type(value) is dict, 'Expected JSON object')
    return value


def frozen_inventory(records):
    require(type(records) is dict and len(records) <= 2048, 'Invalid inventory count')
    total, answer = 0, []
    for name, entry in records.items():
        require(type(name) is str and 0 < len(name) <= 1024 and '\\' not in name and '\0' not in name,
                'Invalid inventory path')
        parts = name.split('/')
        require(len(parts) <= 24 and all(p and p not in ('.', '..') for p in parts), 'Noncanonical path')
        require(parts[0] in h.ROOTS and all(len(p.encode('utf-8')) <= 255 for p in parts), 'Unowned path')
        if len(parts) > 1:
            require(same(records.get('/'.join(parts[:-1])), {'directory': True}), 'Missing parent directory')
        directory = same(entry, {'directory': True})
        require(len(parts) != 1 or directory, 'Root must be a directory')
        if directory:
            answer.append((name, None))
            continue
        require(type(entry) is dict and set(entry) == {'bytes', 'sha256', 'base64'}, 'Invalid raw record')
        require(type(entry['bytes']) is int and 0 <= entry['bytes'] <= MAX_INVENTORY, 'Invalid raw length')
        require(type(entry['base64']) is str and len(entry['base64']) <= 4 * ((MAX_INVENTORY + 2) // 3),
                'Encoded inventory exceeds bound')
        data = base64.b64decode(entry['base64'], validate=True)
        require(same(h.raw_record(data), entry), 'Raw inventory length/hash mismatch')
        total += len(data)
        require(total <= MAX_INVENTORY, 'Inventory exceeds byte budget')
        answer.append((name, data))
    return tuple(sorted(answer))


def records(entries):
    return {name: {'directory': True} if data is None else h.raw_record(data) for name, data in entries}


def png_metadata(phase, data):
    require(type(data) is bytes and 57 <= len(data) <= MAX_PNG, 'Missing or oversized PNG')
    require(data[:8] == b'\x89PNG\r\n\x1a\n', 'Invalid PNG signature')
    offset, chunks, image, ended = 8, 0, False, False
    while offset + 12 <= len(data):
        size = struct.unpack('>I', data[offset:offset + 4])[0]
        name = data[offset + 4:offset + 8]
        require(size <= MAX_PNG and offset + 12 + size <= len(data), 'Truncated PNG')
        if chunks == 0:
            require(name == b'IHDR' and size == 13 and all(struct.unpack('>II', data[offset + 8:offset + 16])),
                    'Missing nonempty PNG header')
        else:
            require(name != b'IHDR', 'Duplicate PNG header')
        chunks += 1
        image = image or (name == b'IDAT' and size > 0)
        offset += size + 12
        if name == b'IEND':
            require(size == 0 and offset == len(data), 'Invalid PNG end')
            ended = True
            break
    require(image and ended, 'Missing PNG image/end')
    return {'filename': phase + '-future.png', 'bytes': len(data), 'sha256': h.sha(data)}


_COMMON = {'schema', 'selected_test', 'phase', 'completed_phase', 'phase_index', 'control_sha256',
           'source_sha', 'run_nonce', 'pid', 'previous_pid', 'platform', 'support_path', 'entry_method',
           'constructed_fixture', 'interruption_evidence', 'before', 'after', 'native_calls',
           'clipboard_before', 'clipboard_after'}


def _keys(phase):
    if phase in ('baseline-write', 'baseline-read', 'restored-read'):
        return _COMMON | {'scenario', 'artifact', 'workspace_progress', 'workspace_envelope'}
    if phase == 'workspace-future':
        return _COMMON | {'persistent_recovery'}
    if phase.startswith('tax-future-'):
        return _COMMON | {'tax_read_only'} | ({'export', 'clipboard_export_base64'}
                if phase in ('tax-future-unsafe', 'tax-future-safe') else set())
    return _COMMON | {'import_before', 'expected_refusal', 'imported_raw_base64', 'navigation_progress_before_import'}


def _receipt(value, phase, source, nonce, previous, retained):
    require(set(value) == _keys(phase) | ({'screenshot'} if retained else set()), 'Unexpected receipt fields')
    require(value['schema'] == h.SCHEMA and value['selected_test'] == h.SELECTED, 'Wrong selected test/schema')
    require(value['phase'] == value['completed_phase'] == phase, 'Wrong phase')
    require(type(value['phase_index']) is int and value['phase_index'] == PHASES.index(phase), 'Wrong phase index')
    require(value['source_sha'] == source and value['run_nonce'] == nonce, 'Stale source/nonce')
    require(type(value['pid']) is int and value['pid'] > 0, 'Invalid PID')
    require(value['previous_pid'] == previous and type(value['previous_pid']) is type(previous), 'Broken previous PID')
    require(value['platform'] == 'ios' and value['entry_method'] == 'programmatic_flutter_test', 'Wrong execution scope')
    require(value['constructed_fixture'] is ('future' in phase) and value['interruption_evidence'] is False,
            'Wrong fixture scope')
    path = value['support_path']
    require(type(path) is str and path.startswith('/') and '\\' not in path and '\0' not in path,
            'Invalid support path')
    require(all(p and p not in ('.', '..') for p in path.split('/')[1:]), 'Noncanonical support path')
    for field in ('clipboard_before', 'clipboard_after'):
        require(value[field] is None or type(value[field]) is str, 'Invalid clipboard state')
    require(type(value['native_calls']) is list, 'Native evidence missing')
    for inventory in ('before', 'after', *(['import_before'] if 'import_before' in value else [])):
        frozen_inventory(value[inventory])
    for field in ('persistent_recovery', 'tax_read_only', 'navigation_progress_before_import'):
        if field in value:
            require(value[field] is True, 'Missing phase assertion')
    for call in value['native_calls']:
        require(type(call) is dict and all(field in call for field in ('request_json', 'response_json', 'request', 'response')),
                'Incomplete native exchange')
        for side in ('request', 'response'):
            require(type(call[side + '_json']) is str and same(decode(call[side + '_json'].encode()), call[side]),
                    'Native raw/object mismatch')


@dataclass(frozen=True)
class PriorPhase:
    receipt_json: bytes
    screenshot_png: bytes
    control_json: bytes | None


@dataclass(frozen=True)
class PhasePlan:
    phase: str
    source_sha: str
    run_nonce: str
    baseline_app_json: bytes | None
    baseline_inventory: tuple
    target_inventory: tuple
    control_json: bytes | None
    fixture_name: str | None
    fixture_placement: str | None
    fixture_bytes: bytes | None
    previous_pid: int | None
    prior_receipt_sha256: tuple
    preparation_only: bool = True
    mutation_authorized: bool = False
    acceptance: bool = False


def plan_phase(phase, source, nonce, *, initial_inventory, baseline_app_json=None, prior=()):
    """Return exact bytes only; never read app files, launch, mutate or accept.

    initial_inventory is the independently captured original authoring inventory
    in host raw-record form. PriorPhase entries must already have passed external
    transport/disk gates; this function independently checks their bounded shape,
    ordered identity, screenshots, control bytes and semantic assertions again.
    """
    require(phase in PHASES, 'Unexpected phase')
    require(type(source) is str and re.fullmatch('[0-9a-f]{40}', source), 'Invalid source')
    require(type(nonce) is str and len(nonce) <= 80 and re.fullmatch('[0-9]+-[0-9]+', nonce), 'Invalid nonce')
    require(type(prior) in (tuple, list) and len(prior) == PHASES.index(phase), 'Missing/extra prior phase')
    initial = frozen_inventory(initial_inventory)
    require(all(name in h.ROOTS and data is None for name, data in initial), 'Initial roots not absent/empty')
    if phase == 'baseline-write':
        require(baseline_app_json is None, 'Unexpected preexisting baseline')
        return PhasePlan(phase, source, nonce, None, initial, initial, None, None, None, None, None, ())
    require(type(baseline_app_json) is bytes, 'Exact app baseline bytes required')
    require(all(type(p) is PriorPhase and type(p.receipt_json) is bytes and type(p.screenshot_png) is bytes and
                (p.control_json is None or type(p.control_json) is bytes) for p in prior), 'Invalid prior proof')
    require(len(baseline_app_json) + sum(len(p.receipt_json) + len(p.screenshot_png) + len(p.control_json or b'') for p in prior)
            <= MAX_CHAIN, 'Proof chain exceeds aggregate bound')
    baseline = decode(baseline_app_json)
    _receipt(baseline, 'baseline-write', source, nonce, None, False)
    require(same(baseline['before'], records(initial)), 'Initial baseline inventory mismatch')
    artifact, scenario = baseline['artifact'], baseline['scenario']
    require(type(artifact) is dict and type(scenario) is dict, 'Malformed baseline pair')
    case = scenario.get('metadata', {}).get('id')
    require(type(case) is str and 0 < len(case.encode('utf-8')) <= 128 and '\0' not in case,
            'Case identifier must contain 1-128 exact UTF-8 bytes and no NUL')
    require(artifact.get('schema') == 'tax-authoring-artifact-v1' and artifact.get('case_id') == case,
            'Wrong baseline artifact identity')
    require(same(artifact.get('scenario'), scenario), 'Baseline scenario mismatch')
    require(type(artifact.get('request')) is dict and artifact['request'].get('context', {}).get('case_id') == case,
            'Baseline request case mismatch')
    revision = artifact.get('artifact_revision')
    require(type(revision) is str and re.fullmatch('[1-9][0-9]{0,19}', revision) and int(revision) <= 2**64 - 1,
            'Invalid saved revision')
    require(artifact['request']['context'].get('revision') == revision, 'Saved request revision mismatch')
    baseline_entries = frozen_inventory(baseline['after'])
    saved = dict(baseline_entries)
    workspace_bytes = saved.get('guided_studio_v1/workspace.json')
    tax_bytes = saved.get(f'tax_authoring_v1/{h.sha(case.encode("utf-8"))}.json')
    require(type(workspace_bytes) is bytes and type(tax_bytes) is bytes, 'Saved primary pair missing')
    # Disk primary JSON is also decoded strictly before shared semantic checks;
    # raw original bytes, including any BOM/formatting, remain the plan payload.
    workspace = decode(workspace_bytes.removeprefix(b'\xef\xbb\xbf'))
    saved_artifact = decode(tax_bytes.removeprefix(b'\xef\xbb\xbf'))
    require(same(workspace, baseline['workspace_envelope']) and same(saved_artifact, artifact),
            'Raw saved primary pair differs from baseline receipt')
    h.assert_saved_pair(baseline, baseline['after'])
    fixtures = h.make_fixtures(baseline)
    pids, receipts = [], []
    for index, proof in enumerate(prior):
        current = decode(proof.receipt_json)
        name = PHASES[index]
        _receipt(current, name, source, nonce, pids[-1] if pids else None, True)
        require(current['pid'] not in pids and current['support_path'] == baseline['support_path'], 'PID reuse/root mismatch')
        require(same(current['screenshot'], png_metadata(name, proof.screenshot_png)), 'Screenshot identity mismatch')
        if index == 0:
            require(same({k: v for k, v in current.items() if k != 'screenshot'}, baseline),
                    'App baseline differs from driver receipt beyond screenshot metadata')
        if proof.control_json is not None:
            decode(proof.control_json, 1024 * 1024)
        h.assert_control(proof.control_json, current, baseline_app_json)
        expected_before = dict(baseline_entries)
        fixture_name = _fixture_name(name)
        if name in fixtures['placements']:
            expected_before[fixtures['placements'][name]] = h.raw(fixtures['fixtures'][fixture_name])
        if index == 0:
            expected_before = dict(initial)
        require(same(current['before'], records(tuple(expected_before.items()))), 'Prior phase started from wrong seed')
        h.assert_phase(current, name, source, nonce, pids[-1] if pids else None,
                       current['before'], current['after'], baseline, fixtures)
        pids.append(current['pid'])
        receipts.append(current)
    key = _fixture_name(phase)
    fixture = h.raw(fixtures['fixtures'][key]) if key else None
    placement = fixtures['placements'].get(phase)
    target = dict(baseline_entries)
    if placement:
        target[placement] = fixture
    target_entries = frozen_inventory(records(tuple(target.items())))
    control = {'schema': 'ios-future-host-control-v1', 'phase': phase, 'phase_index': PHASES.index(phase),
               'source_sha': source, 'run_nonce': nonce, 'previous_pid': pids[-1],
               'baseline_sha256': h.sha(baseline_app_json),
               'fixture_base64': base64.b64encode(fixture).decode('ascii') if fixture is not None else None}
    control_bytes = encode(control)
    h.assert_control(control_bytes, {**control, 'control_sha256': h.sha(control_bytes)}, baseline_app_json)
    return PhasePlan(phase, source, nonce, baseline_app_json, baseline_entries, target_entries,
                     control_bytes, key, placement, fixture, pids[-1], tuple(h.sha(p.receipt_json) for p in prior))


def _fixture_name(phase):
    return {'workspace-future': 'workspace-future', 'tax-future-unsafe': 'tax-future-unsafe',
            'import-future-unsafe': 'tax-future-unsafe', 'tax-future-safe': 'tax-future-safe',
            'import-future-safe': 'tax-future-safe', 'tax-future-tmp': 'tax-future-safe',
            'tax-future-bak': 'tax-future-safe'}.get(phase)
