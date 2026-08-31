import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/studio_authoring_repository.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';

void main() {
  test('validation and route execution stay behind the Rust JSON bridge', () {
    final _StudioBridge bridge = _StudioBridge();
    final StudioAuthoringRepository repository =
        StudioAuthoringRepository(bridge);
    final StudioScenarioDraft draft = StudioScenarioDraft.guidedExample();

    final StudioValidationResult validation = repository.validate(draft);
    final StudioRouteTestResult route =
        repository.runFirstAvailableRoute(draft);

    expect(validation.valid, isTrue);
    expect(validation.diagnostics, isEmpty);
    expect(route.executedActionIds, <String>['assess_case', 'close_case']);
    expect(route.outcomeId, 'guided_resolution');
    expect(bridge.commands.first, 'validate_scenario');
    expect(bridge.commands.last, 'dispose_session');
  });

  test('Rust diagnostics block route execution', () {
    final StudioAuthoringRepository repository =
        StudioAuthoringRepository(_InvalidStudioBridge());
    final StudioValidationResult validation =
        repository.validate(StudioScenarioDraft.guidedExample());

    expect(validation.valid, isFalse);
    expect(validation.diagnostics.single.code, 'SCN004_MISSING_INITIAL_STAGE');
  });
}

final class _StudioBridge implements ScenarioBridgeClient {
  final List<String> commands = <String>[];
  int _turn = 0;

  @override
  String execute(String encodedRequest) {
    final Map<String, dynamic> request =
        jsonDecode(encodedRequest) as Map<String, dynamic>;
    final String command = request['command'] as String;
    commands.add(command);
    switch (command) {
      case 'validate_scenario':
        return jsonEncode(<String, dynamic>{
          'type': 'scenario_validated',
          'valid': true,
          'diagnostics': <dynamic>[],
        });
      case 'create_session':
        _turn = 0;
        return jsonEncode(<String, dynamic>{
          'type': 'session_created',
          'session_id': 54,
          'snapshot': _snapshot('assess_case'),
        });
      case 'dispatch':
        _turn += 1;
        return jsonEncode(<String, dynamic>{
          'type': 'snapshot',
          'session_id': 54,
          'snapshot': _turn == 1
              ? _snapshot('close_case')
              : <String, dynamic>{
                  'available_actions': <dynamic>[],
                  'resolved_outcome': 'guided_resolution',
                },
        });
      case 'dispose_session':
        return '{"type":"session_disposed","session_id":54,"disposed":true}';
      default:
        throw StateError('Unexpected command $command');
    }
  }

  Map<String, dynamic> _snapshot(String actionId) => <String, dynamic>{
        'available_actions': <Map<String, dynamic>>[
          <String, dynamic>{'id': actionId},
        ],
      };
}

final class _InvalidStudioBridge implements ScenarioBridgeClient {
  @override
  String execute(String encodedRequest) {
    return jsonEncode(<String, dynamic>{
      'type': 'scenario_validated',
      'valid': false,
      'diagnostics': <Map<String, dynamic>>[
        <String, dynamic>{
          'code': 'SCN004_MISSING_INITIAL_STAGE',
          'severity': 'error',
          'path': 'initial_stage',
          'message': 'Unknown stage.',
        },
      ],
    });
  }
}
