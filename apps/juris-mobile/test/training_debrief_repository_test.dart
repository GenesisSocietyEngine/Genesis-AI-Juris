import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/data/game_save_store.dart';
import 'package:juris_mobile/data/rust_scenario_repository.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/training_debrief.dart';

void main() {
  test('save reset and load restore the equal nested Training Debrief',
      () async {
    final _DebriefBridgeClient bridge = _DebriefBridgeClient();
    final _MemorySaveStore store = _MemorySaveStore();
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: _caseDefinition(),
      bridgeClient: bridge,
      saveStore: store,
    );

    expect(repository.snapshot.trainingDebrief, isNull);
    expect(repository.applyAction('finish_case').isRisky, isFalse);
    final List<Object?> completed = _debriefState(
      repository.snapshot.trainingDebrief!,
    );
    expect(
      repository.snapshot.trainingDebrief!.executedActions
          .map((TrainingDebriefActionView action) => action.actionId),
      <String>['finish_case'],
    );

    await repository.saveGame();
    repository.reset();
    expect(repository.snapshot.trainingDebrief, isNull);

    await repository.loadGame();
    expect(
      _debriefState(repository.snapshot.trainingDebrief!),
      completed,
    );
    expect(bridge.loadCount, 1);
    repository.dispose();
  });

  test('malformed loaded debrief preserves the existing active session',
      () async {
    final _DebriefBridgeClient bridge = _DebriefBridgeClient();
    final _MemorySaveStore store = _MemorySaveStore();
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: _caseDefinition(),
      bridgeClient: bridge,
      saveStore: store,
    );
    expect(repository.applyAction('finish_case').isRisky, isFalse);
    await repository.saveGame();
    final before = repository.snapshot;
    final int activeSessionId = bridge.lastDispatchSessionId!;
    bridge.malformedOnLoad = true;

    await expectLater(
      repository.loadGame(),
      throwsA(
        isA<GamePersistenceException>().having(
          (GamePersistenceException error) => error.code,
          'code',
          'invalid_loaded_snapshot',
        ),
      ),
    );

    expect(repository.snapshot, same(before));
    expect(
      _debriefState(repository.snapshot.trainingDebrief!),
      _debriefState(before.trainingDebrief!),
    );
    expect(bridge.lastLoadedSessionId, isNotNull);
    expect(bridge.disposedSessionIds, contains(bridge.lastLoadedSessionId));
    expect(bridge.disposedSessionIds, isNot(contains(activeSessionId)));
    repository.dispose();
    expect(bridge.activeSessionIds, isEmpty);
  });
}

List<Object?> _debriefState(TrainingDebriefView debrief) {
  return <Object?>[
    debrief.projectionSchemaVersion,
    debrief.scenarioId,
    debrief.resolvedOutcomeId,
    debrief.finalScenarioMinute,
    debrief.matterLifecycle,
    debrief.matterStatus,
    debrief.executedActions
        .map(
          (TrainingDebriefActionView action) => <Object?>[
            action.actionId,
            action.sequence,
            action.completionMinute,
            action.timeCostMinutes,
            action.costEur,
            action.billableMinutes,
          ],
        )
        .toList(growable: false),
    debrief.resources
        .map(
          (TrainingDebriefResourceView resource) => <Object?>[
            resource.resourceId,
            resource.initialValue,
            resource.currentValue,
          ],
        )
        .toList(growable: false),
    debrief.reflectionPromptIds,
  ];
}

MobileCaseDefinition _caseDefinition() {
  return MobileCaseDefinition.fromJson(<String, dynamic>{
    'case_id': 'training_debrief_repository_fixture',
    'scenario_id': 'training_debrief_repository_fixture',
    'sort_order': 999,
    'seed': 31,
    'status': 'playable',
    'difficulty': 'introductory',
    'jurisdiction': 'BE',
    'practice_area': 'civil_litigation',
    'player_client_id': 'client',
    'player_role': 'Counsel',
    'identity_file': 'test-only',
    'scenario_file': null,
    'scenario_available': true,
    'scenario': <String, dynamic>{
      'metadata': <String, String>{
        'id': 'training_debrief_repository_fixture',
        'title': 'Training Debrief repository fixture',
      },
      'clock': <String, String>{'mode': 'action_driven'},
      'stages': <Map<String, dynamic>>[
        <String, dynamic>{'id': 'intake', 'title': 'Intake'},
        <String, dynamic>{'id': 'resolved', 'title': 'Resolved'},
      ],
      'actions': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'finish_case',
          'title': 'Finish the case',
          'description': 'Resolve the fixture.',
          'time_cost_minutes': 60,
          'cost_eur': 500,
        },
      ],
      'outcomes': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'fixture_resolved',
          'title': 'Fixture resolved',
          'summary': 'The deterministic fixture is complete.',
        },
      ],
    },
    'runtime_adapter': 'rust_scenario_v1',
    'readiness': <String, bool>{
      'identity': true,
      'scenario_definition': true,
      'diagnostics': true,
      'path_simulation': true,
      'engine_runtime': true,
      'mobile_bundle': true,
    },
    'localizations': <String, dynamic>{
      'en': <String, dynamic>{
        'caption': 'Training Debrief repository fixture',
        'topic': 'Training',
        'short_title': 'Training',
        'synopsis': 'Test fixture.',
        'player_client_name': 'Client',
        'player_client_role': 'Claimant',
        'legal_issues': <String>['Training'],
      },
    },
    'scenario_localizations': const <String, dynamic>{},
  });
}

final class _DebriefBridgeClient implements ScenarioBridgeClient {
  int _nextSessionId = 1;
  final Map<int, bool> _terminalBySession = <int, bool>{};
  int loadCount = 0;
  int? lastDispatchSessionId;
  int? lastLoadedSessionId;
  bool malformedOnLoad = false;
  final List<int> disposedSessionIds = <int>[];

  Set<int> get activeSessionIds => Set<int>.unmodifiable(
        _terminalBySession.keys,
      );

  @override
  String execute(String encodedRequest) {
    final Map<String, dynamic> request =
        jsonDecode(encodedRequest) as Map<String, dynamic>;
    return switch (request['command']) {
      'create_session' => _create(),
      'dispatch' => _dispatch(
          request['session_id'] as int,
          request['action_id'] as String,
        ),
      'advance_time' => _response(
          'snapshot',
          request['session_id'] as int,
        ),
      'save_session' => _save(request['session_id'] as int),
      'load_session' => _load(request['encoded_save'] as String),
      'dispose_session' => _dispose(request['session_id'] as int),
      _ => jsonEncode(<String, dynamic>{
          'type': 'error',
          'code': 'unsupported_command',
          'message': 'Unsupported command',
        }),
    };
  }

  String _create() {
    final int sessionId = _nextSessionId++;
    _terminalBySession[sessionId] = false;
    return _response('session_created', sessionId);
  }

  String _dispatch(int sessionId, String actionId) {
    lastDispatchSessionId = sessionId;
    if (actionId != 'finish_case' || _terminalBySession[sessionId] != false) {
      return jsonEncode(<String, dynamic>{
        'type': 'error',
        'code': 'action_unavailable',
        'message': 'Unavailable action',
      });
    }
    _terminalBySession[sessionId] = true;
    return _response('snapshot', sessionId);
  }

  String _save(int sessionId) {
    return jsonEncode(<String, dynamic>{
      'type': 'session_saved',
      'session_id': sessionId,
      'encoded_save': jsonEncode(<String, dynamic>{
        'terminal': _terminalBySession[sessionId],
      }),
    });
  }

  String _load(String encodedSave) {
    final Map<String, dynamic> save =
        jsonDecode(encodedSave) as Map<String, dynamic>;
    final int sessionId = _nextSessionId++;
    _terminalBySession[sessionId] = save['terminal'] as bool;
    lastLoadedSessionId = sessionId;
    loadCount += 1;
    if (malformedOnLoad) {
      final Map<String, dynamic> response =
          jsonDecode(_response('session_loaded', sessionId))
              as Map<String, dynamic>;
      (response['snapshot'] as Map<String, dynamic>)['training_debrief'] =
          <String>[];
      return jsonEncode(response);
    }
    return _response('session_loaded', sessionId);
  }

  String _dispose(int sessionId) {
    disposedSessionIds.add(sessionId);
    final bool removed = _terminalBySession.remove(sessionId) != null;
    return jsonEncode(<String, dynamic>{
      'type': 'session_disposed',
      'session_id': sessionId,
      'disposed': removed,
    });
  }

  String _response(String type, int sessionId) {
    return jsonEncode(<String, dynamic>{
      'type': type,
      'session_id': sessionId,
      'snapshot': _snapshot(_terminalBySession[sessionId] ?? false),
    });
  }

  Map<String, dynamic> _snapshot(bool terminal) {
    return <String, dynamic>{
      'snapshot_schema_version': 1,
      'scenario_id': 'training_debrief_repository_fixture',
      'seed': 31,
      'stage_id': terminal ? 'resolved' : 'intake',
      'stage_title': terminal ? 'Resolved' : 'Intake',
      'clock_minutes': terminal ? 60 : 0,
      'clock_mode': 'action_driven',
      'judicial_result': null,
      'judicial_decision_instance': null,
      'matter_lifecycle': terminal ? 'closed' : 'active',
      'is_closed': terminal,
      'resolved_outcome': terminal ? 'fixture_resolved' : null,
      'terminal': terminal,
      'flags': <String, bool>{},
      'facts': const <Map<String, dynamic>>[],
      'evidence': const <Map<String, dynamic>>[],
      'deadlines': const <Map<String, dynamic>>[],
      'inbox': const <Map<String, dynamic>>[],
      'available_actions': terminal
          ? const <Map<String, dynamic>>[]
          : <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'finish_case',
                'title': 'Finish the case',
                'description': 'Resolve the fixture.',
                'time_cost_minutes': 60,
                'cost_eur': 500,
              },
            ],
      'fired_event_ids': const <String>[],
      'outcome': terminal
          ? <String, dynamic>{
              'id': 'fixture_resolved',
              'title': 'Fixture resolved',
              'summary': 'The deterministic fixture is complete.',
            }
          : null,
      if (terminal)
        'training_debrief': <String, dynamic>{
          'projection_schema_version': 1,
          'scenario_id': 'training_debrief_repository_fixture',
          'resolved_outcome_id': 'fixture_resolved',
          'final_scenario_minute': 60,
          'matter_lifecycle': 'closed',
          'matter_status': 'closed',
          'executed_actions': <Map<String, dynamic>>[
            <String, dynamic>{
              'action_id': 'finish_case',
              'sequence': 1,
              'completion_minute': 60,
              'time_cost_minutes': 60,
              'cost_eur': 500,
              'billable_minutes': 60,
            },
          ],
          'resources': <Map<String, dynamic>>[
            <String, dynamic>{
              'resource_id': 'spend_eur',
              'initial_value': 0,
              'current_value': 500,
            },
          ],
          'reflection_prompt_ids': <String>[
            'decisive_fact_or_evidence',
            'deadline_or_procedural_pressure',
            'time_or_budget_tradeoff',
            'alternative_replay_strategy',
          ],
        },
    };
  }
}

final class _MemorySaveStore implements GameSaveStore {
  String? encodedSave;

  @override
  Future<bool> exists(String slotId) async => encodedSave != null;

  @override
  Future<String> read(String slotId) async {
    final String? saved = encodedSave;
    if (saved == null) {
      throw const GameSaveStorageException(
        code: 'save_not_found',
        message: 'No save.',
      );
    }
    return saved;
  }

  @override
  Future<void> write(String slotId, String encodedSave) async {
    this.encodedSave = encodedSave;
  }
}
