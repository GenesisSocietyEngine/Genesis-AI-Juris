/// Editable incomplete storage fixture. It deliberately does not claim a
/// native calculation; request hashes are opaque identities in widget tests.
Map<String, dynamic> taxArtifactFixture([String text = 'unfinished']) {
  final Map<String, dynamic> input = {
    'currency': 'EUR',
    'tax_input_basis': 'amounts',
    'tax_base_mode': 'derived',
    'assumptions': '',
    for (final String field in [
      'baseline_annual_tax_cost',
      'optimized_annual_tax_cost',
      'implementation_cost',
      'annual_maintenance_cost',
      'terminal_tax_or_unwind_cost'
    ])
      field: '0',
    'annual_tax_base_override': null,
    'baseline_tax_rate_bps': 0,
    'optimized_tax_rate_bps': 0,
    'analysis_horizon_months': 12,
    'annual_discount_rate_bps': 0,
    'benefit_realization_bps': 10000,
  };
  return {
    'schema': 'tax-authoring-artifact-v1',
    'case_id': 'case1',
    'scenario': {
      'metadata': {'id': 'case1'},
      'facts': <dynamic>[],
      'retained_unknown': {
        'nested': [1, null, '  exact source  ']
      },
    },
    'artifact_revision': '1',
    'request': {
      'input_schema': 'tax-economics-input-v2',
      'transport_protocol': 'tax-economics-json-v1',
      'application_policy': 'tax-editor-v1',
      'context': {
        'case_id': 'case1',
        'artifact_id': 'tax_case1',
        'revision': '1',
        'scenario_fingerprint': 'fixture-fingerprint',
      },
      'input': input,
    },
    'edit': {
      for (final String field in [
        'baseline_annual_tax_cost',
        'optimized_annual_tax_cost',
        'implementation_cost',
        'annual_maintenance_cost',
        'terminal_tax_or_unwind_cost'
      ])
        field: '0.00',
      'annual_tax_base_override': '',
      for (final String field in [
        'baseline_tax_rate_bps',
        'optimized_tax_rate_bps',
        'analysis_horizon_months',
        'annual_discount_rate_bps',
        'benefit_realization_bps'
      ])
        field: '${input[field]}',
    }..['baseline_annual_tax_cost'] = text,
    'bindings': <dynamic>[],
    'benefits': <dynamic>[],
    'required_component_ids': <dynamic>[],
    'legacy': {
      'schema': 'web_rates_fx_v1',
      'original_json': ' { "unrecognized": 1.2300e+0 } ',
      'original_sha256': 'opaque-original-hash',
      'status': {
        'status': 'unavailable',
        'reason': {
          'code': 'invalid_legacy',
          'field': 'legacy',
          'reason': 'fixture'
        },
      },
      'retained_extension': {'fx': 'original'},
    },
    'calculation': null,
    'unknown_extension': [1, 2],
  };
}
