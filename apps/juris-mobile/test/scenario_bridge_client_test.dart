import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';

void main() {
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

  test('dispatch and disposal use stable session and action IDs', () {
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

    final ScenarioBridgeResponse error = ScenarioBridgeResponse.parse(
      '{"type":"error","code":"action_unavailable","message":"No"}',
    );
    expect(error.isError, isTrue);
    expect(error.errorCode, 'action_unavailable');
    expect(error.errorMessage, 'No');
  });
}
