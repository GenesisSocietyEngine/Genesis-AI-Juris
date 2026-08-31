import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';

void main() {
  test('validate-scenario command matches the authoritative Rust protocol', () {
    final Map<String, dynamic> scenario = <String, dynamic>{
      'schema_version': '1.0',
      'metadata': <String, dynamic>{'id': 'studio_case'},
    };
    expect(
      jsonDecode(ScenarioBridgeCommand.validateScenario(scenario)),
      <String, dynamic>{
        'command': 'validate_scenario',
        'scenario': scenario,
      },
    );
  });

  test('create-session command matches the Rust bridge protocol', () {
    final Map<String, dynamic> decoded = jsonDecode(
      ScenarioBridgeCommand.createSession(
        scenario: <String, dynamic>{
          'schema_version': '1.0',
          'metadata': <String, dynamic>{'id': 'scenario_001'},
        },
        seed: 7,
      ),
    ) as Map<String, dynamic>;

    expect(decoded['command'], 'create_session');
    expect(decoded['seed'], 7);
    expect(decoded['scenario']['metadata']['id'], 'scenario_001');
  });

  test('dispatch, time, persistence, and disposal use stable IDs', () {
    expect(
      jsonDecode(
        ScenarioBridgeCommand.dispatch(
          sessionId: 42,
          actionId: 'audit_claim_file',
        ),
      ),
      <String, dynamic>{
        'command': 'dispatch',
        'session_id': 42,
        'action_id': 'audit_claim_file',
      },
    );
    expect(
      jsonDecode(
        ScenarioBridgeCommand.advanceTime(sessionId: 42, minutes: 1),
      ),
      <String, dynamic>{
        'command': 'advance_time',
        'session_id': 42,
        'minutes': 1,
      },
    );
    expect(
      jsonDecode(ScenarioBridgeCommand.saveSession(42)),
      <String, dynamic>{
        'command': 'save_session',
        'session_id': 42,
      },
    );
    expect(
      jsonDecode(ScenarioBridgeCommand.inspectSave('{"schema_version":1}')),
      <String, dynamic>{
        'command': 'inspect_save',
        'encoded_save': '{"schema_version":1}',
      },
    );
    expect(
      jsonDecode(
        ScenarioBridgeCommand.loadSession(
          scenario: <String, dynamic>{
            'metadata': <String, dynamic>{'id': 'scenario_001'},
          },
          encodedSave: '{"schema_version":1}',
        ),
      ),
      <String, dynamic>{
        'command': 'load_session',
        'scenario': <String, dynamic>{
          'metadata': <String, dynamic>{'id': 'scenario_001'},
        },
        'encoded_save': '{"schema_version":1}',
      },
    );
    expect(
      jsonDecode(ScenarioBridgeCommand.disposeSession(42)),
      <String, dynamic>{
        'command': 'dispose_session',
        'session_id': 42,
      },
    );
  });

  test('response parser preserves snapshot and typed errors', () {
    final ScenarioBridgeResponse snapshot = ScenarioBridgeResponse.parse(
      '{"type":"snapshot","session_id":3,"snapshot":{"stage_id":"intake"}}',
    );
    expect(snapshot.isError, isFalse);
    expect(snapshot.sessionId, 3);
    expect(snapshot.snapshot?['stage_id'], 'intake');

    final ScenarioBridgeResponse saved = ScenarioBridgeResponse.parse(
      '{"type":"session_saved","session_id":3,"encoded_save":"{}"}',
    );
    expect(saved.encodedSave, '{}');

    final ScenarioBridgeResponse inspected = ScenarioBridgeResponse.parse(
      '{"type":"save_inspected","scenario_id":"scenario_001",'
      '"scenario_fingerprint":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}',
    );
    expect(inspected.scenarioId, 'scenario_001');
    expect(
      inspected.scenarioFingerprint,
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    );
    final ScenarioBridgeResponse incompleteInspection =
        ScenarioBridgeResponse.parse(
      '{"type":"save_inspected","scenario_id":7,'
      '"scenario_fingerprint":false}',
    );
    expect(incompleteInspection.scenarioId, isNull);
    expect(incompleteInspection.scenarioFingerprint, isNull);

    final ScenarioBridgeResponse error = ScenarioBridgeResponse.parse(
      '{"type":"error","code":"action_unavailable","message":"No"}',
    );
    expect(error.isError, isTrue);
    expect(error.errorCode, 'action_unavailable');
    expect(error.errorMessage, 'No');

    final ScenarioBridgeResponse validation = ScenarioBridgeResponse.parse(
      '{"type":"scenario_validated","valid":false,"diagnostics":['
      '{"code":"SCN004_MISSING_INITIAL_STAGE","severity":"error",'
      '"path":"initial_stage","message":"Unknown stage"}]}',
    );
    expect(validation.valid, isFalse);
    expect(validation.diagnostics.single['path'], 'initial_stage');
  });
}
