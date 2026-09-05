import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/scenario_snapshot_mapper.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/dossier_projection.dart';
import 'package:juris_mobile/models/game_snapshot.dart';

void main() {
  final MobileCaseDefinition definition = _caseDefinition();

  test('legacy snapshot without dossier maps safely to no projection', () {
    final GameSnapshot snapshot = ScenarioSnapshotMapper.map(
      source: _snapshot()..remove('dossier'),
      caseDefinition: definition,
    );

    expect(snapshot.dossier, isNull);
  });

  test('maps only the nested authoritative dossier without inference', () {
    final Map<String, dynamic> source = _snapshot();
    final GameSnapshot snapshot = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: definition,
    );
    final DossierProjectionView dossier = snapshot.dossier!;

    // The surrounding legacy snapshot deliberately says closed/resolved. The
    // dossier remains the contradictory nested Rust projection and is never
    // reconstructed from those older presentation fields.
    expect(snapshot.isClosed, isTrue);
    expect(snapshot.stage, 'Resolved presentation stage');
    expect(dossier.procedure.stageId, 'hearing');
    expect(dossier.procedure.stageTitle, 'Hearing');
    expect(dossier.procedure.matterLifecycle, DossierLifecycleStatus.active);
    expect(dossier.procedure.matterStatus, DossierMatterStatus.open);
    expect(dossier.procedure.isClosed, isFalse);
    expect(dossier.judicialResult, DossierJudicialResult.lost);
    expect(
      dossier.judicialDecisionInstance,
      DossierJudicialDecisionInstance.firstInstance,
    );
    expect(
      dossier.facts.map((DossierFactView item) => item.id),
      <String>['known_fact_b', 'known_fact_a'],
    );
    expect(
      dossier.evidence.map((DossierEvidenceView item) => item.id),
      <String>['visible_evidence_b', 'visible_evidence_a'],
    );
    expect(dossier.deadlines.single.id, 'appeal_deadline');
    expect(
      dossier.deadlines.single.remedies.single.actionId,
      'file_appeal',
    );
    expect(dossier.outcome, isNull);
  });

  test('EN and RU preserve authoritative identity, order, and state', () {
    final Map<String, dynamic> source = _snapshot();
    final DossierProjectionView english = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: definition,
      locale: 'en',
    ).dossier!;
    final DossierProjectionView russian = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: definition,
      locale: 'ru',
    ).dossier!;

    expect(russian.projectionSchemaVersion, english.projectionSchemaVersion);
    expect(russian.procedure.stageId, english.procedure.stageId);
    expect(russian.procedure.matterStatus, english.procedure.matterStatus);
    expect(
      russian.facts.map((DossierFactView item) => item.id),
      english.facts.map((DossierFactView item) => item.id),
    );
    expect(
      russian.facts.map((DossierFactView item) => item.status),
      english.facts.map((DossierFactView item) => item.status),
    );
    expect(
      russian.evidence.map((DossierEvidenceView item) => item.id),
      english.evidence.map((DossierEvidenceView item) => item.id),
    );
    expect(
      russian.deadlines.single.remedies
          .map((DossierRemedyView item) => item.actionId),
      english.deadlines.single.remedies
          .map((DossierRemedyView item) => item.actionId),
    );
    expect(russian.procedure.stageTitle, 'Судебное заседание');
    expect(russian.facts.first.statement, 'Раскрытый факт Б');
    expect(russian.evidence.first.title, 'Раскрытое доказательство Б');
    expect(russian.deadlines.single.title, 'Подать апелляцию');
    expect(russian.deadlines.single.remedies.single.title, 'Подать жалобу');
    expect(english.procedure.stageTitle, 'Hearing');
  });

  test('future fields are ignored and future enum values remain unknown', () {
    final Map<String, dynamic> source = _snapshot();
    final Map<String, dynamic> dossier =
        source['dossier'] as Map<String, dynamic>;
    dossier['future_projection_metadata'] = <String, Object>{'revision': 2};
    final Map<String, dynamic> procedure =
        dossier['procedure'] as Map<String, dynamic>;
    procedure['matter_lifecycle'] = 'supreme_review';
    procedure['matter_status'] = 'stayed';
    (dossier['facts'] as List<dynamic>).first['status'] = 'corroborated';
    (dossier['deadlines'] as List<dynamic>).first['status'] = 'tolled';
    dossier['judicial_result'] = 'vacated';
    dossier['judicial_decision_instance'] = 'supreme_court';

    final DossierProjectionView mapped = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: definition,
    ).dossier!;

    expect(mapped.procedure.matterLifecycle, DossierLifecycleStatus.unknown);
    expect(mapped.procedure.matterStatus, DossierMatterStatus.unknown);
    expect(mapped.facts.first.status, DossierFactStatus.unknown);
    expect(mapped.deadlines.first.status, DossierDeadlineStatus.unknown);
    expect(mapped.judicialResult, DossierJudicialResult.unknown);
    expect(
      mapped.judicialDecisionInstance,
      DossierJudicialDecisionInstance.unknown,
    );
  });

  test('present but malformed required dossier data fails closed', () {
    final Map<String, dynamic> missingProcedure = _snapshot();
    (missingProcedure['dossier'] as Map<String, dynamic>).remove('procedure');
    final Map<String, dynamic> invalidEvidenceLinks = _snapshot();
    ((invalidEvidenceLinks['dossier'] as Map<String, dynamic>)['evidence']
            as List<dynamic>)
        .first['supports_fact_ids'] = 'known_fact_b';

    expect(
      () => ScenarioSnapshotMapper.map(
        source: missingProcedure,
        caseDefinition: definition,
      ),
      throwsFormatException,
    );
    expect(
      () => ScenarioSnapshotMapper.map(
        source: invalidEvidenceLinks,
        caseDefinition: definition,
      ),
      throwsFormatException,
    );
  });
}

MobileCaseDefinition _caseDefinition() {
  return MobileCaseDefinition.fromJson(<String, dynamic>{
    'case_id': 'dossier_mapper_fixture',
    'scenario_id': 'dossier_mapper_fixture',
    'sort_order': 999,
    'seed': 7,
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
      'metadata': <String, String>{'title': 'Dossier fixture'},
      'stages': <Map<String, dynamic>>[
        <String, dynamic>{'id': 'hearing', 'title': 'Hearing'},
        <String, dynamic>{
          'id': 'resolved_presentation',
          'title': 'Resolved presentation stage',
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
      'en': _caseText('Dossier fixture'),
      'ru': _caseText('Тест досье'),
    },
    'scenario_localizations': <String, dynamic>{
      'ru': <String, dynamic>{
        'stages': <String, dynamic>{
          'hearing': <String, String>{'title': 'Судебное заседание'},
        },
        'facts': <String, dynamic>{
          'known_fact_b': <String, String>{
            'statement': 'Раскрытый факт Б',
          },
          'known_fact_a': <String, String>{
            'statement': 'Раскрытый факт А',
          },
        },
        'evidence': <String, dynamic>{
          'visible_evidence_b': <String, String>{
            'title': 'Раскрытое доказательство Б',
            'description': 'Описание доказательства Б',
          },
          'visible_evidence_a': <String, String>{
            'title': 'Раскрытое доказательство А',
          },
        },
        'deadlines': <String, dynamic>{
          'appeal_deadline': <String, String>{
            'title': 'Подать апелляцию',
          },
        },
        'actions': <String, dynamic>{
          'file_appeal': <String, String>{
            'title': 'Подать жалобу',
            'description': 'Подать жалобу в срок.',
          },
        },
      },
    },
  });
}

Map<String, dynamic> _caseText(String caption) => <String, dynamic>{
      'caption': caption,
      'topic': 'Dossier',
      'short_title': caption,
      'synopsis': 'Test fixture.',
      'player_client_name': 'Client',
      'player_client_role': 'Claimant',
      'legal_issues': <String>['Appeal'],
    };

Map<String, dynamic> _snapshot() {
  return <String, dynamic>{
    'snapshot_schema_version': 1,
    'scenario_id': 'dossier_mapper_fixture',
    'seed': 7,
    'stage_id': 'resolved_presentation',
    'stage_title': 'Resolved presentation stage',
    'clock_minutes': 999,
    'clock_mode': 'foreground',
    'judicial_result': 'won',
    'judicial_decision_instance': 'appeal',
    'matter_lifecycle': 'closed',
    'is_closed': true,
    'resolved_outcome': 'presentation_only_outcome',
    'terminal': true,
    'flags': <String, bool>{},
    'facts': const <Map<String, dynamic>>[],
    'evidence': const <Map<String, dynamic>>[],
    'deadlines': const <Map<String, dynamic>>[],
    'inbox': const <Map<String, dynamic>>[],
    'available_actions': const <Map<String, dynamic>>[],
    'fired_event_ids': const <String>[],
    'outcome': <String, dynamic>{
      'id': 'presentation_only_outcome',
      'title': 'Presentation outcome',
      'summary': 'Not the dossier outcome.',
    },
    'dossier': <String, dynamic>{
      'projection_schema_version': 1,
      'procedure': <String, dynamic>{
        'stage_id': 'hearing',
        'stage_title': 'Hearing',
        'clock_minutes': 60,
        'matter_lifecycle': 'active',
        'is_closed': false,
        'matter_status': 'open',
      },
      'judicial_result': 'lost',
      'judicial_decision_instance': 'first_instance',
      'facts': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'known_fact_b',
          'statement': 'Known fact B',
          'status': 'proven',
        },
        <String, dynamic>{
          'id': 'known_fact_a',
          'statement': 'Known fact A',
          'status': 'disputed',
        },
      ],
      'evidence': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'visible_evidence_b',
          'title': 'Visible evidence B',
          'kind': 'document',
          'description': 'Evidence B description',
          'supports_fact_ids': <String>['known_fact_b'],
          'contradicts_fact_ids': <String>[],
        },
        <String, dynamic>{
          'id': 'visible_evidence_a',
          'title': 'Visible evidence A',
          'kind': 'email',
          'description': null,
          'supports_fact_ids': <String>[],
          'contradicts_fact_ids': <String>['known_fact_a'],
        },
      ],
      'deadlines': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'appeal_deadline',
          'title': 'File appeal',
          'due_at_minutes': 300,
          'status': 'open',
          'remedies': <Map<String, dynamic>>[
            <String, dynamic>{
              'action_id': 'file_appeal',
              'title': 'File appeal',
              'description': 'File the appeal in time.',
              'time_cost_minutes': 60,
              'cost_eur': 1500,
            },
          ],
        },
      ],
      'outcome': null,
    },
  };
}
