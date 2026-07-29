import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:juris_mobile/data/native_scenario_bridge_client.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('iOS process symbols execute the Logistics FFI lifecycle',
      (WidgetTester tester) async {
    final String encodedBundle = await rootBundle.loadString(
      'assets/case_catalog/mobile_case_bundle.json',
    );
    final Map<String, dynamic> bundle =
        jsonDecode(encodedBundle) as Map<String, dynamic>;
    final Map<String, dynamic> logistics = (bundle['cases'] as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .firstWhere(
          (Map<String, dynamic> item) =>
              item['runtime_adapter'] == 'rust_scenario_v1',
        );
    final Map<String, dynamic> scenario =
        logistics['scenario'] as Map<String, dynamic>;
    final int seed = logistics['seed'] as int;
    final NativeScenarioBridgeClient bridge = NativeScenarioBridgeClient();

    Map<String, dynamic> execute(Map<String, dynamic> request) {
      return jsonDecode(bridge.execute(jsonEncode(request)))
          as Map<String, dynamic>;
    }

    final Map<String, dynamic> created = execute(<String, dynamic>{
      'command': 'create_session',
      'scenario': scenario,
      'seed': seed,
    });
    expect(created['type'], 'session_created');
    expect(
      (created['snapshot'] as Map<String, dynamic>)['stage_id'],
      'intake',
    );
    final int sessionId = created['session_id'] as int;

    final Map<String, dynamic> dispatched = execute(<String, dynamic>{
      'command': 'dispatch',
      'session_id': sessionId,
      'action_id': 'audit_claim_file',
    });
    expect(dispatched['type'], 'snapshot');
    final Map<String, dynamic> dispatchedSnapshot =
        dispatched['snapshot'] as Map<String, dynamic>;
    expect(dispatchedSnapshot['stage_id'], 'pre_action');
    expect(dispatchedSnapshot['clock_minutes'], 120);

    final Map<String, dynamic> snapshot = execute(<String, dynamic>{
      'command': 'snapshot',
      'session_id': sessionId,
    });
    expect(snapshot['type'], 'snapshot');
    expect(
      (snapshot['snapshot'] as Map<String, dynamic>)['stage_id'],
      'pre_action',
    );

    final Map<String, dynamic> disposed = execute(<String, dynamic>{
      'command': 'dispose_session',
      'session_id': sessionId,
    });
    expect(disposed['type'], 'session_disposed');
    expect(disposed['disposed'], isTrue);

    final Map<String, dynamic> disposedAgain = execute(<String, dynamic>{
      'command': 'dispose_session',
      'session_id': sessionId,
    });
    expect(disposedAgain['type'], 'session_disposed');
    expect(disposedAgain['disposed'], isFalse);

    final Map<String, dynamic> invalidHandle = execute(<String, dynamic>{
      'command': 'snapshot',
      'session_id': sessionId,
    });
    expect(invalidHandle['type'], 'error');
    expect(invalidHandle['code'], 'unknown_session');
  });
}
