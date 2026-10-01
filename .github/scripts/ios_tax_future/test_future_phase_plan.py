"""Offline synthetic controls only. No filesystem/process/Simulator mutation."""
import base64
import copy
import dataclasses
import json
import unittest
from unittest.mock import patch

import future_phase_plan as m

SOURCE = 'a' * 40
NONCE = '123-1'
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6WQAAAAASUVORK5CYII=')
INITIAL = {name: {'directory': True} for name in m.h.ROOTS}


def fixtures(case_id='supplier_transition_dispute'):
    scenario = {'schema_version': '1.0', 'metadata': {'id': case_id, 'unknown': ['retained']}}
    context = {'artifact_id': 'tax-fixture', 'case_id': scenario['metadata']['id'], 'revision': '1', 'scenario_fingerprint': 'b' * 64}
    request = {'context': context, 'input': {'assumptions': ' original  ', 'money': '25000000'}}
    source = {'case_id': context['case_id'], 'scenario_fingerprint': context['scenario_fingerprint']}
    binding = {'request': request, 'unknown': {'retained': 7}}
    calculation = {'context': context, 'result': {'saving': '5000000'}}
    artifact = {'schema': 'tax-authoring-artifact-v1', 'case_id': context['case_id'], 'artifact_revision': '1',
                'scenario': scenario, 'request': request, 'bindings': [], 'required_component_ids': [],
                'binding_draft': binding, 'source': source, 'calculation': calculation, 'unknown': {'exact': 'yes'}}
    workspace = {'schema_version': 1, 'scenario': scenario, 'active_stage': 'views', 'completed_stages': ['roles', 'describe', 'case_map']}
    target = f'tax_authoring_v1/{m.h.sha(context["case_id"].encode())}.json'
    disk = {**copy.deepcopy(INITIAL), 'guided_studio_v1/workspace.json': m.h.raw_record(b'\xef\xbb\xbf' + json.dumps(workspace, indent=2).encode() + b'\r\n'),
            target: m.h.raw_record(json.dumps(artifact, indent=1).encode() + b'\n'),
            target + '.bak': m.h.raw_record(b' opaque exact backup \r\n'),
            'authoring_import_v1/retained': {'directory': True},
            'authoring_import_v1/retained/empty': {'directory': True},
            'authoring_import_v1/retained/original.bin': m.h.raw_record(b'\x00\xff\xfeRAW')}
    command = {'command': 'tax_calculate', 'scenario': scenario, 'request': request, 'bindings': [], 'required_component_ids': []}
    response = {'type': 'tax_calculated', 'draft': binding, 'source': source, 'calculation': calculation}
    call = {'request': command, 'response': response, 'request_json': json.dumps(command), 'response_json': json.dumps(response)}
    baseline = {'schema': m.h.SCHEMA, 'selected_test': m.h.SELECTED, 'phase': 'baseline-write', 'completed_phase': 'baseline-write',
                'phase_index': 0, 'control_sha256': None, 'source_sha': SOURCE, 'run_nonce': NONCE,
                'pid': 100, 'previous_pid': None, 'platform': 'ios', 'support_path': '/owned/Library/Application Support',
                'entry_method': 'programmatic_flutter_test', 'constructed_fixture': False, 'interruption_evidence': False,
                'before': copy.deepcopy(INITIAL), 'after': disk, 'native_calls': [call], 'clipboard_before': None,
                'clipboard_after': None, 'scenario': scenario, 'artifact': artifact, 'workspace_envelope': workspace,
                'workspace_progress': {'active_stage': 'views', 'completed_stages': ['case_map', 'describe', 'roles']}}
    return baseline, target


def proof(data, control=None):
    return m.PriorPhase(m.encode({**data, 'screenshot': m.png_metadata(data['phase'], PNG)}), PNG, control)


def sequence(count=9):
    baseline, target = fixtures()
    baseline_bytes = json.dumps(baseline, indent=1).encode() + b'\n'
    prior = [proof(baseline)]
    plans = [m.plan_phase('baseline-write', SOURCE, NONCE, initial_inventory=INITIAL)]
    for index in range(1, count):
        phase = m.PHASES[index]
        plan = m.plan_phase(phase, SOURCE, NONCE, initial_inventory=INITIAL, baseline_app_json=baseline_bytes, prior=prior)
        plans.append(plan)
        common = {key: copy.deepcopy(baseline[key]) for key in m._COMMON}
        common.update(phase=phase, completed_phase=phase, phase_index=index, pid=100 + index, previous_pid=99 + index,
                      control_sha256=m.h.sha(plan.control_json), constructed_fixture='future' in phase,
                      before=m.records(plan.target_inventory), after=m.records(plan.target_inventory), native_calls=[])
        if phase in ('baseline-read', 'restored-read'):
            common.update({key: copy.deepcopy(baseline[key]) for key in ('scenario', 'artifact', 'workspace_progress', 'workspace_envelope', 'native_calls')})
        elif phase == 'workspace-future':
            common['persistent_recovery'] = True
        elif phase.startswith('tax-future-'):
            common['tax_read_only'] = True
            if phase in ('tax-future-unsafe', 'tax-future-safe'):
                common['export'] = {'path': 'tax-workspace-1-1.json', **m.h.raw_record(plan.fixture_bytes)}
                common['clipboard_export_base64'] = base64.b64encode(plan.fixture_bytes).decode()
        else:
            navigated = {**baseline['workspace_envelope'], 'active_stage': 'describe'}
            common['after']['guided_studio_v1/workspace.json.bak'] = copy.deepcopy(common['before']['guided_studio_v1/workspace.json'])
            common['after']['guided_studio_v1/workspace.json'] = m.h.raw_record(m.encode(navigated))
            common['import_before'] = copy.deepcopy(common['after'])
            common['imported_raw_base64'] = base64.b64encode(plan.fixture_bytes).decode()
            common['navigation_progress_before_import'] = True
            common['expected_refusal'] = ('Aggregate number would change value when imported. Original input is unchanged.'
                if phase.endswith('unsafe') else 'Unsupported analysis workspace. Original input is unchanged.')
        prior.append(proof(common, plan.control_json))
    return baseline_bytes, prior, plans, target


class PhasePlanningControls(unittest.TestCase):
    def plan(self, baseline, prior, phase=None, **changes):
        return m.plan_phase(phase or m.PHASES[len(prior)], changes.pop('source', SOURCE), changes.pop('nonce', NONCE),
                            initial_inventory=changes.pop('initial', INITIAL), baseline_app_json=baseline, prior=prior, **changes)

    def refused(self, fn):
        with self.assertRaises((ValueError, AssertionError, KeyError, TypeError, UnicodeError)):
            fn()

    def test_all_ten_phase_plans_exact_placements_and_restoration(self):
        baseline, prior, plans, target = sequence(10)
        self.assertEqual([p.phase for p in plans], list(m.PHASES))
        original = plans[1].baseline_inventory
        for p in plans:
            self.assertTrue(p.preparation_only)
            self.assertFalse(p.mutation_authorized or p.acceptance)
            if p.phase == 'baseline-write':
                self.assertIsNone(p.control_json)
                continue
            self.assertEqual(p.baseline_inventory, original)
            expected = dict(original)
            if p.fixture_placement:
                expected[p.fixture_placement] = p.fixture_bytes
            self.assertEqual(dict(p.target_inventory), expected)
            control = m.decode(p.control_json)
            self.assertEqual(set(control), {'schema', 'phase', 'phase_index', 'source_sha', 'run_nonce', 'previous_pid', 'baseline_sha256', 'fixture_base64'})
            self.assertEqual(control['baseline_sha256'], m.h.sha(baseline))
            self.assertEqual(p.previous_pid, 99 + m.PHASES.index(p.phase))
        for index in (4, 6):
            self.assertEqual(plans[index].target_inventory, original)
            self.assertIsNone(plans[index].fixture_placement)
            self.assertIsNotNone(plans[index].fixture_bytes)
        for index in (1, 9):
            self.assertEqual(plans[index].target_inventory, original)
            self.assertIsNone(m.decode(plans[index].control_json)['fixture_base64'])
        self.assertEqual(plans[7].fixture_placement, target + '.tmp')
        self.assertEqual(plans[8].fixture_placement, target + '.bak')
        m.h.assert_final_pair(m.decode(prior[1].receipt_json), m.decode(prior[-1].receipt_json))

    def test_baseline_app_bytes_not_driver_screenshot_record(self):
        baseline, prior, _, _ = sequence(1)
        self.refused(lambda: self.plan(prior[0].receipt_json, prior))
        bad = m.decode(baseline);bad['artifact']['unknown']['exact'] = 'changed'
        self.refused(lambda: self.plan(m.encode(bad), prior))
        bad = m.decode(prior[0].receipt_json);bad['clipboard_before'] = ''
        self.refused(lambda: self.plan(baseline, [dataclasses.replace(prior[0], receipt_json=m.encode(bad))]))

    def test_frozen_raw_generations_and_empty_directories(self):
        baseline, prior, _, target = sequence(1)
        plan = self.plan(baseline, prior)
        payload = dict(plan.target_inventory)
        self.assertTrue(payload['guided_studio_v1/workspace.json'].startswith(b'\xef\xbb\xbf'))
        self.assertEqual(payload[target + '.bak'], b' opaque exact backup \r\n')
        self.assertEqual(payload['authoring_import_v1/retained/original.bin'], b'\x00\xff\xfeRAW')
        self.assertIsNone(payload['authoring_import_v1/retained/empty'])
        with self.assertRaises(dataclasses.FrozenInstanceError):plan.phase = 'changed'
        records = m.records(plan.target_inventory);records.clear()
        self.assertEqual(dict(plan.target_inventory), payload)

    def test_absent_empty_and_nonempty_initial_roots_distinguished(self):
        a = m.plan_phase('baseline-write', SOURCE, NONCE, initial_inventory={})
        b = m.plan_phase('baseline-write', SOURCE, NONCE, initial_inventory=INITIAL)
        self.assertNotEqual(a.target_inventory, b.target_inventory)
        self.refused(lambda: m.plan_phase('baseline-write', SOURCE, NONCE, initial_inventory={**INITIAL, 'guided_studio_v1/workspace.json': m.h.raw_record(b'{}')}))
        baseline, prior, _, _ = sequence(1)
        self.refused(lambda: self.plan(baseline, prior, initial={}))

    def test_missing_extra_reordered_and_duplicate_prior_phases(self):
        baseline, prior, _, _ = sequence(4)
        for chain in (prior[:-1], prior + [prior[-1]], [prior[1], prior[0], *prior[2:]], [prior[0], prior[0], *prior[2:]]):
            self.refused(lambda chain=chain: self.plan(baseline, chain, phase=m.PHASES[4]))
        self.refused(lambda: self.plan(baseline, prior, phase='unexpected'))

    def test_source_nonce_phase_and_pid_chain_strict(self):
        baseline, prior, _, _ = sequence(3)
        for field, value in [('source_sha', 'b' * 40), ('run_nonce', '123-2'), ('phase', 'baseline-read'),
                             ('completed_phase', 'baseline-read'), ('phase_index', True), ('pid', True),
                             ('pid', 100), ('previous_pid', 7), ('support_path', '/other/root'),
                             ('selected_test', 'other'), ('constructed_fixture', False), ('interruption_evidence', True)]:
            with self.subTest(field=field, value=value):
                bad = m.decode(prior[-1].receipt_json);bad[field] = value
                self.refused(lambda: self.plan(baseline, [*prior[:-1], dataclasses.replace(prior[-1], receipt_json=m.encode(bad))]))
        for source, nonce in [('A' * 40, NONCE), (SOURCE, 'unit'), (SOURCE, '1-' + '1' * 81)]:
            self.refused(lambda: self.plan(baseline, prior, source=source, nonce=nonce))

    def test_screenshot_bytes_filename_metadata_and_shape(self):
        baseline, prior, _, _ = sequence(1)
        for png in (b'not a png', PNG[:-1], PNG + b'extra'):
            self.refused(lambda png=png: self.plan(baseline, [dataclasses.replace(prior[0], screenshot_png=png)]))
        for field, value in [('filename', 'other.png'), ('bytes', True), ('sha256', 'f' * 64)]:
            bad = m.decode(prior[0].receipt_json);bad['screenshot'][field] = value
            self.refused(lambda: self.plan(baseline, [dataclasses.replace(prior[0], receipt_json=m.encode(bad))]))

    def test_control_original_bytes_and_phase_fixture_required(self):
        baseline, prior, _, _ = sequence(4)
        for value in (None, b'{}'):
            self.refused(lambda value=value: self.plan(baseline, [*prior[:-1], dataclasses.replace(prior[-1], control_json=value)]))
        bad = m.decode(prior[-1].control_json);bad['fixture_base64'] = base64.b64encode(b'{}').decode()
        changed = m.encode(bad);receipt = m.decode(prior[-1].receipt_json);receipt['control_sha256'] = m.h.sha(changed)
        self.refused(lambda: self.plan(baseline, [*prior[:-1], m.PriorPhase(m.encode(receipt), PNG, changed)]))
        self.refused(lambda: self.plan(baseline + b' ', prior))

    def test_wrong_case_filename_schema_revision_and_saved_bytes(self):
        baseline, prior, _, target = sequence(1)
        for change in [lambda b: b['artifact'].update(case_id='other'),
                       lambda b: b['artifact'].update(schema='tax-authoring-artifact-v99'),
                       lambda b: b['artifact'].update(artifact_revision='18446744073709551616'),
                       lambda b: b['artifact']['request']['context'].update(case_id='other'),
                       lambda b: b['after'].__setitem__('tax_authoring_v1/wrong.json', b['after'].pop(target)),
                       lambda b: b['after'].__setitem__(target, m.h.raw_record(b'{}'))]:
            bad = m.decode(baseline);change(bad)
            self.refused(lambda: self.plan(m.encode(bad), [proof(bad)]))

    def test_native_exchange_and_full_pair_mismatch_refused(self):
        baseline, prior, _, _ = sequence(1)
        bad = m.decode(baseline);bad['native_calls'][0]['response']['calculation']['result']['saving'] = '0'
        self.refused(lambda: self.plan(m.encode(bad), [proof(bad)]))
        bad = m.decode(baseline);bad['native_calls'] = []
        self.refused(lambda: self.plan(m.encode(bad), [proof(bad)]))

    def test_duplicate_json_utf8_and_limits_fail_before_planning(self):
        baseline, prior, _, _ = sequence(1)
        for data in [baseline.rstrip()[:-1] + b',"phase":"baseline-write"}', b'\xff', b'{"x":NaN}',
                     b'{"x":1e999}', b'{"x":' + b'[' * 65 + b'0' + b']' * 65 + b'}']:
            self.refused(lambda data=data: self.plan(data, prior))
        with patch.object(m, 'MAX_JSON', 8):
            # Explicit limit exercises decoder without allocating huge fixtures.
            self.refused(lambda: m.decode(b'{"long":123}', m.MAX_JSON))
        with patch.object(m, 'MAX_CHAIN', 8):self.refused(lambda: self.plan(baseline, prior))
        with patch.object(m, 'MAX_NODES', 2):self.refused(lambda: m.decode(b'{"a":[1,2]}'))
        self.assertEqual(m.decode(b'{"raw":"[[[[ text ]]]]"}'), {'raw': '[[[[ text ]]]]'} )

    def test_duplicate_saved_primary_and_path_escapes_refused(self):
        baseline, _, _, target = sequence(1)
        bad = m.decode(baseline)
        raw = m.h.raw(bad['after'][target]).rstrip()
        bad['after'][target] = m.h.raw_record(raw[:-1] + b',"case_id":"supplier_transition_dispute"}')
        self.refused(lambda: self.plan(m.encode(bad), [proof(bad)]))
        for name in ('../outside', '/guided_studio_v1/a', 'guided_studio_v1/../a', 'guided_studio_v1//a', 'guided_studio_v1/./a'):
            self.refused(lambda name=name: m.frozen_inventory({**INITIAL, name: m.h.raw_record(b'x')}))

    def test_prior_seeds_cannot_redefine_expected_fixture_inventory(self):
        baseline, prior, _, target = sequence(4)
        bad = m.decode(prior[-1].receipt_json)
        # Self-consistent before/after/export must still match the exact approved fixture.
        for field in ('before', 'after'):bad[field][target] = m.h.raw_record(b'{"future":1}')
        bad['export'] = {'path': 'tax-workspace-1-1.json', **m.h.raw_record(b'{"future":1}')}
        bad['clipboard_export_base64'] = base64.b64encode(b'{"future":1}').decode()
        self.refused(lambda: self.plan(baseline, [*prior[:-1], dataclasses.replace(prior[-1], receipt_json=m.encode(bad))]))

    def test_exact_production_case_id_byte_limit_nul_and_bom(self):
        for case in ('', 'a' * 129, 'é' * 65, 'contains\0nul'):
            baseline, _ = fixtures(case)
            self.refused(lambda: self.plan(m.encode(baseline), [proof(baseline)]))
        for case in ('a' * 128, 'é' * 64, '\ufeffcase'):
            baseline, target = fixtures(case)
            plan = self.plan(m.encode(baseline), [proof(baseline)])
            self.assertIn(target, dict(plan.target_inventory))


if __name__ == '__main__':
    unittest.main(verbosity=2)
