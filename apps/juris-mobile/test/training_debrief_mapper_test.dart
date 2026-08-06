import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/scenario_snapshot_mapper.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/models/training_debrief.dart';

void main() {
  final MobileCaseDefinition definition = _caseDefinition();

  test('missing and null Training Debrief remain hidden', () {
    final Map<String, dynamic> missing = _snapshot()
      ..remove('training_debrief');
    final Map<String, dynamic> explicitNull = _snapshot()
      ..['training_debrief'] = null;

    expect(
      ScenarioSnapshotMapper.map(
        source: missing,
        caseDefinition: definition,
      ).trainingDebrief,
      isNull,
    );
    expect(
      ScenarioSnapshotMapper.map(
        source: explicitNull,
        caseDefinition: definition,
      ).trainingDebrief,
      isNull,
    );
  });

  test('maps only nested debrief in authoritative order with EN/RU text', () {
    final Map<String, dynamic> source = _snapshot();
    source['resources'] = <String, int>{
      'authorized_budget_eur': 0,
      'spend_eur': 0,
    };
    source['available_actions'] = <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 'unexecuted_hidden_action',
        'title': 'Do not disclose',
        'description': 'This is not part of the completed run.',
        'time_cost_minutes': 1,
      },
    ];

    final GameSnapshot english = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: definition,
    );
    final GameSnapshot russian = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: definition,
      locale: 'ru',
    );
    final TrainingDebriefView en = english.trainingDebrief!;
    final TrainingDebriefView ru = russian.trainingDebrief!;

    expect(en.scenarioId, 'training_debrief_fixture');
    expect(en.resolvedOutcomeId, 'resolved_position');
    expect(en.resolvedOutcomeTitle, 'Resolved position');
    expect(en.finalScenarioMinute, 195);
    expect(en.matterLifecycle, TrainingDebriefMatterLifecycle.closed);
    expect(en.matterStatus, TrainingDebriefMatterStatus.closed);
    expect(
      en.executedActions.map(
        (TrainingDebriefActionView action) => action.actionId,
      ),
      <String>['z_first_decision', 'a_second_decision'],
    );
    expect(
      en.executedActions.map(
        (TrainingDebriefActionView action) => action.sequence,
      ),
      <int>[1, 2],
    );
    expect(en.totalActionTimeMinutes, 195);
    expect(en.totalBillableMinutes, 165);
    expect(en.totalActionCostEur, 2400);
    expect(
      en.resources.map(
        (TrainingDebriefResourceView resource) => resource.currentValue,
      ),
      <int>[10000, 2400],
    );
    expect(
      en.executedActions.any((TrainingDebriefActionView action) =>
          action.actionId == 'unexecuted_hidden_action'),
      isFalse,
    );

    expect(ru.scenarioTitle, 'Тест разбора прохождения');
    expect(ru.resolvedOutcomeTitle, 'Позиция завершена');
    expect(
      ru.executedActions.map(
        (TrainingDebriefActionView action) => action.title,
      ),
      <String>['Первое решение', 'Второе решение'],
    );
    expect(
      ru.resources.map(
        (TrainingDebriefResourceView resource) => resource.label,
      ),
      <String>['Утверждённый бюджет', 'Расходы'],
    );
    expect(
      ru.reflectionPromptIds,
      <String>[
        'decisive_fact_or_evidence',
        'deadline_or_procedural_pressure',
        'time_or_budget_tradeoff',
        'alternative_replay_strategy',
      ],
    );
  });

  test('future enum and stable-ID values degrade without inference', () {
    final Map<String, dynamic> source = _snapshot();
    final Map<String, dynamic> debrief =
        source['training_debrief'] as Map<String, dynamic>;
    debrief['matter_lifecycle'] = 'supreme_review';
    debrief['matter_status'] = 'stayed';
    debrief['future_projection_field'] = true;
    debrief['executed_actions'] = <Map<String, dynamic>>[
      <String, dynamic>{
        'action_id': 'future_action',
        'sequence': 1,
        'completion_minute': 5,
        'time_cost_minutes': 5,
        'cost_eur': 0,
        'billable_minutes': 5,
      },
    ];
    debrief['resources'] = <Map<String, dynamic>>[
      <String, dynamic>{
        'resource_id': 'future_resource',
        'initial_value': 10,
        'current_value': 7,
      },
    ];
    debrief['reflection_prompt_ids'] = <String>['future_prompt'];

    final TrainingDebriefView mapped = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: definition,
    ).trainingDebrief!;

    expect(mapped.matterLifecycle, TrainingDebriefMatterLifecycle.unknown);
    expect(mapped.matterStatus, TrainingDebriefMatterStatus.unknown);
    expect(mapped.executedActions.single.actionId, 'future_action');
    expect(mapped.executedActions.single.title, 'future_action');
    expect(mapped.resources.single.resourceId, 'future_resource');
    expect(mapped.resources.single.label, 'future resource');
    expect(mapped.reflectionPromptIds, <String>['future_prompt']);
  });

  test('present malformed required debrief data throws FormatException', () {
    final Map<String, dynamic> wrongOuterType = _snapshot()
      ..['training_debrief'] = <String>[];
    final Map<String, dynamic> missingSequence = _snapshot();
    final Map<String, dynamic> missingSequenceDebrief =
        missingSequence['training_debrief'] as Map<String, dynamic>;
    final List<dynamic> executedActions =
        missingSequenceDebrief['executed_actions'] as List<dynamic>;
    (executedActions.first as Map<String, dynamic>).remove('sequence');
    final Map<String, dynamic> malformedPrompt = _snapshot();
    (malformedPrompt['training_debrief']
        as Map<String, dynamic>)['reflection_prompt_ids'] = <Object>[7];

    for (final Map<String, dynamic> source in <Map<String, dynamic>>[
      wrongOuterType,
      missingSequence,
      malformedPrompt,
    ]) {
      expect(
        () => ScenarioSnapshotMapper.map(
          source: source,
          caseDefinition: definition,
        ),
        throwsFormatException,
      );
    }
  });
}

MobileCaseDefinition _caseDefinition() {
  return MobileCaseDefinition.fromJson(<String, dynamic>{
    'case_id': 'training_debrief_fixture',
    'scenario_id': 'training_debrief_fixture',
    'sort_order': 999,
    'seed': 23,
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
        'id': 'training_debrief_fixture',
        'title': 'Training Debrief fixture',
      },
      'stages': <Map<String, dynamic>>[
        <String, dynamic>{'id': 'resolved', 'title': 'Resolved'},
      ],
      'actions': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'z_first_decision',
          'title': 'First decision',
        },
        <String, dynamic>{
          'id': 'a_second_decision',
          'title': 'Second decision',
        },
      ],
      'outcomes': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'resolved_position',
          'title': 'Resolved position',
        },
      ],
    },
    'runtime_adapter': 'scenario_definition_v1',
    'readiness': <String, bool>{
      'identity': true,
      'scenario_definition': true,
      'diagnostics': true,
      'path_simulation': true,
      'engine_runtime': true,
      'mobile_bundle': true,
    },
    'localizations': <String, dynamic>{
      'en': _caseText('Training Debrief fixture'),
      'ru': _caseText('Тест разбора прохождения'),
    },
    'scenario_localizations': <String, dynamic>{
      'ru': <String, dynamic>{
        'metadata': <String, dynamic>{
          'title': 'Тест разбора прохождения',
        },
        'actions': <String, dynamic>{
          'z_first_decision': <String, String>{'title': 'Первое решение'},
          'a_second_decision': <String, String>{'title': 'Второе решение'},
        },
        'outcomes': <String, dynamic>{
          'resolved_position': <String, String>{
            'title': 'Позиция завершена',
          },
        },
        'resources': <String, dynamic>{
          'authorized_budget_eur': <String, String>{
            'label': 'Утверждённый бюджет',
          },
          'spend_eur': <String, String>{'label': 'Расходы'},
        },
      },
    },
  });
}

Map<String, dynamic> _caseText(String caption) => <String, dynamic>{
      'caption': caption,
      'topic': 'Training',
      'short_title': caption,
      'synopsis': 'Test fixture.',
      'player_client_name': 'Client',
      'player_client_role': 'Claimant',
      'legal_issues': <String>['Training'],
    };

Map<String, dynamic> _snapshot() {
  return <String, dynamic>{
    'snapshot_schema_version': 1,
    'scenario_id': 'training_debrief_fixture',
    'seed': 23,
    'stage_id': 'resolved',
    'stage_title': 'Resolved',
    'clock_minutes': 195,
    'clock_mode': 'foreground',
    'judicial_result': null,
    'judicial_decision_instance': null,
    'matter_lifecycle': 'closed',
    'is_closed': true,
    'resolved_outcome': 'different_top_level_outcome',
    'terminal': true,
    'flags': <String, bool>{},
    'facts': const <Map<String, dynamic>>[],
    'evidence': const <Map<String, dynamic>>[],
    'deadlines': const <Map<String, dynamic>>[],
    'inbox': const <Map<String, dynamic>>[],
    'available_actions': const <Map<String, dynamic>>[],
    'fired_event_ids': const <String>[],
    'outcome': <String, dynamic>{
      'id': 'different_top_level_outcome',
      'title': 'Different top-level outcome',
      'summary': 'Must not drive the nested debrief.',
    },
    'training_debrief': <String, dynamic>{
      'projection_schema_version': 1,
      'scenario_id': 'training_debrief_fixture',
      'resolved_outcome_id': 'resolved_position',
      'final_scenario_minute': 195,
      'matter_lifecycle': 'closed',
      'matter_status': 'closed',
      'executed_actions': <Map<String, dynamic>>[
        <String, dynamic>{
          'action_id': 'z_first_decision',
          'sequence': 1,
          'completion_minute': 75,
          'time_cost_minutes': 75,
          'cost_eur': 900,
          'billable_minutes': 60,
        },
        <String, dynamic>{
          'action_id': 'a_second_decision',
          'sequence': 2,
          'completion_minute': 195,
          'time_cost_minutes': 120,
          'cost_eur': 1500,
          'billable_minutes': 105,
        },
      ],
      'resources': <Map<String, dynamic>>[
        <String, dynamic>{
          'resource_id': 'authorized_budget_eur',
          'initial_value': 10000,
          'current_value': 10000,
        },
        <String, dynamic>{
          'resource_id': 'spend_eur',
          'initial_value': 0,
          'current_value': 2400,
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
