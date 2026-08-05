import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/scenario_snapshot_mapper.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/dossier_projection.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/screens/dossier_screen.dart';
import 'package:juris_mobile/screens/matter_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MobileCaseDefinition desertWater;

  setUpAll(() async {
    final String encoded = await rootBundle.loadString(
      'assets/case_catalog/mobile_case_bundle.json',
    );
    final CaseCatalogBundle bundle = CaseCatalogBundle.fromJson(
      jsonDecode(encoded) as Map<String, dynamic>,
    );
    desertWater = bundle.cases.singleWhere(
      (MobileCaseDefinition item) =>
          item.caseId == 'us_environmental_desert_water_001',
    );
  });

  test('Desert Water bundle freezes complete EN/RU stable-ID inventories', () {
    final Map<String, dynamic> scenario = desertWater.scenario!;
    final Map<String, dynamic> russian =
        desertWater.scenarioLocalizations['ru']!;

    expect(desertWater.sortOrder, 50);
    expect(desertWater.seed, 20260804);
    expect(desertWater.scenarioId, 'desert_water_groundwater_claim');
    expect(desertWater.runtimeAdapter, 'rust_scenario_v1');
    expect(scenario['clock'], <String, dynamic>{'mode': 'foreground'});
    expect(scenario['initial_resources'], <String, dynamic>{
      'authorized_budget_eur': 60000,
      'billable_minutes': 0,
      'spend_eur': 0,
    });
    expect(russian['schema_version'], 1);
    expect(russian['scenario_id'], desertWater.scenarioId);
    expect(russian['locale'], 'ru');

    const Map<String, ({int count, List<String> fields})> contract =
        <String, ({int count, List<String> fields})>{
      'stages': (count: 8, fields: <String>['title']),
      'actions': (
        count: 27,
        fields: <String>['title', 'description'],
      ),
      'deadlines': (count: 5, fields: <String>['title']),
      'inbox_items': (
        count: 10,
        fields: <String>['subject', 'body'],
      ),
      'facts': (count: 10, fields: <String>['statement']),
      'evidence': (count: 13, fields: <String>['title']),
      'outcomes': (
        count: 2,
        fields: <String>['title', 'summary'],
      ),
    };

    for (final MapEntry<String, ({int count, List<String> fields})> entry
        in contract.entries) {
      final List<Map<String, dynamic>> canonical = _objectList(
        scenario[entry.key],
      );
      final Map<String, dynamic> localized = _object(russian[entry.key]);
      expect(canonical, hasLength(entry.value.count), reason: entry.key);
      expect(
        localized.keys.toSet(),
        canonical
            .map((Map<String, dynamic> item) => item['id']! as String)
            .toSet(),
        reason: '${entry.key} must use the exact canonical stable-ID set',
      );
      for (final Map<String, dynamic> item in canonical) {
        final String id = item['id']! as String;
        final Map<String, dynamic> translation = _object(localized[id]);
        final List<String> requiredFields = <String>[
          ...entry.value.fields,
          if (entry.key == 'evidence' && item['description'] != null)
            'description',
        ];
        for (final String field in requiredFields) {
          final String value = translation[field]! as String;
          expect(value.trim(), isNotEmpty, reason: '${entry.key}.$id.$field');
          expect(
            value,
            matches(RegExp('[А-Яа-яЁё]')),
            reason: '${entry.key}.$id.$field must not fall back to English',
          );
        }
      }
    }

    final Map<String, dynamic> metadata = _object(russian['metadata']);
    for (final String field in <String>['title', 'summary']) {
      expect(metadata[field], isNotEmpty);
      expect(metadata[field], matches(RegExp('[А-Яа-яЁё]')));
    }
    expect(
      _objectList(scenario['actions']).every(
        (Map<String, dynamic> action) =>
            (action['cost_eur']! as int) > 0 &&
            (action['time_cost_minutes']! as int) > 0 &&
            action['billable_minutes'] == action['time_cost_minutes'],
      ),
      isTrue,
    );
  });

  test('maps exact authoritative budget checkpoints without clock fallback',
      () {
    final Map<String, dynamic> scenario = desertWater.scenario!;
    final List<Map<String, dynamic>> actions = _objectList(
      scenario['actions'],
    );
    final List<
        ({
          int clock,
          int spend,
          int billable,
          int remaining,
          String actionId,
          int actionCost,
          int actionTime,
          String actionTimeLabel,
          String timeLabel,
        })> checkpoints = <({
      int clock,
      int spend,
      int billable,
      int remaining,
      String actionId,
      int actionCost,
      int actionTime,
      String actionTimeLabel,
      String timeLabel,
    })>[
      (
        clock: 1728,
        spend: 37050,
        billable: 855,
        remaining: 22950,
        actionId: 'interview_affected_residents',
        actionCost: 2400,
        actionTime: 120,
        actionTimeLabel: '2h',
        timeLabel: '12:48',
      ),
      (
        clock: 1848,
        spend: 39450,
        billable: 975,
        remaining: 20550,
        actionId: 'map_wells_and_exposure_periods',
        actionCost: 2200,
        actionTime: 90,
        actionTimeLabel: '1h 30m',
        timeLabel: '14:48',
      ),
      (
        clock: 1938,
        spend: 41650,
        billable: 1065,
        remaining: 18350,
        actionId: 'prepare_expert_evidence',
        actionCost: 5500,
        actionTime: 180,
        actionTimeLabel: '3h',
        timeLabel: '16:18',
      ),
    ];

    for (final checkpoint in checkpoints) {
      final Map<String, dynamic> action = actions.singleWhere(
        (Map<String, dynamic> item) => item['id'] == checkpoint.actionId,
      );
      final Map<String, dynamic> source = _openingSnapshot(desertWater)
        ..['clock_minutes'] = checkpoint.clock
        ..['resources'] = <String, dynamic>{
          'authorized_budget_eur': 60000,
          'billable_minutes': checkpoint.billable,
          'spend_eur': checkpoint.spend,
        }
        ..['available_actions'] = <Map<String, dynamic>>[
          _actionSnapshot(action),
        ];
      final GameSnapshot mapped = ScenarioSnapshotMapper.map(
        source: source,
        caseDefinition: desertWater,
      );

      expect(mapped.authorizedBudgetEur, 60000);
      expect(mapped.spendEur, checkpoint.spend);
      expect(mapped.remainingBudgetEur, checkpoint.remaining);
      expect(mapped.billableMinutes, checkpoint.billable);
      expect(mapped.dayLabel, 'Day 2');
      expect(mapped.timeLabel, checkpoint.timeLabel);
      expect(mapped.actions.single.id, checkpoint.actionId);
      expect(action['cost_eur'], checkpoint.actionCost);
      expect(action['time_cost_minutes'], checkpoint.actionTime);
      expect(mapped.actions.single.costEur, checkpoint.actionCost);
      expect(mapped.actions.single.timeLabel, checkpoint.actionTimeLabel);
    }
  });

  test('EN and RU map identical authoritative opening Dossier state', () {
    final Map<String, dynamic> source = _openingSnapshot(desertWater);
    final DossierProjectionView english = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: desertWater,
      locale: 'en',
    ).dossier!;
    final DossierProjectionView russian = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: desertWater,
      locale: 'ru',
    ).dossier!;

    expect(russian.procedure.stageId, english.procedure.stageId);
    expect(russian.procedure.clockMinutes, english.procedure.clockMinutes);
    expect(russian.procedure.matterStatus, english.procedure.matterStatus);
    expect(
      russian.facts.map((DossierFactView item) => (item.id, item.status)),
      english.facts.map((DossierFactView item) => (item.id, item.status)),
    );
    expect(
      russian.evidence.map(
        (DossierEvidenceView item) => (
          item.id,
          item.kind,
          item.supportsFactIds.join('|'),
          item.contradictsFactIds.join('|'),
        ),
      ),
      english.evidence.map(
        (DossierEvidenceView item) => (
          item.id,
          item.kind,
          item.supportsFactIds.join('|'),
          item.contradictsFactIds.join('|'),
        ),
      ),
    );
    expect(
      russian.deadlines.map(
        (DossierDeadlineView item) => (
          item.id,
          item.dueAtMinutes,
          item.status,
          item.remedies
              .map((DossierRemedyView remedy) => remedy.actionId)
              .join('|'),
        ),
      ),
      english.deadlines.map(
        (DossierDeadlineView item) => (
          item.id,
          item.dueAtMinutes,
          item.status,
          item.remedies
              .map((DossierRemedyView remedy) => remedy.actionId)
              .join('|'),
        ),
      ),
    );
    expect(
      english.facts.map((DossierFactView item) => item.id),
      <String>[
        'community_reports_shared_exposure',
        'medical_causation_requires_individual_proof',
      ],
    );
    expect(
      english.evidence.map((DossierEvidenceView item) => item.id),
      <String>['community_well_register', 'public_facility_permit'],
    );
    expect(russian.procedure.stageTitle, 'Приём обращения жителей');
    expect(russian.facts.first.statement, contains('Жители'));

    final String englishProjection = jsonEncode(_dossierJson(english));
    final String russianProjection = jsonEncode(_dossierJson(russian));
    for (final String hiddenId in <String>[
      'groundwater_plume_links_facility_to_wells',
      'operator_received_prior_contamination_notice',
      'hydrogeology_source_assessment',
      'internal_notice_correspondence',
    ]) {
      expect(englishProjection, isNot(contains(hiddenId)));
      expect(russianProjection, isNot(contains(hiddenId)));
    }
  });

  testWidgets('active Matter and Dossier screens expose no hidden EN/RU text',
      (WidgetTester tester) async {
    final Map<String, dynamic> source = _openingSnapshot(desertWater);
    final GameSnapshot english = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: desertWater,
      locale: 'en',
    );
    final GameSnapshot russian = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: desertWater,
      locale: 'ru',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: MatterScreen(
          snapshot: english,
          onShowActions: () {},
          onShowDossier: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Community well register'),
      240,
      scrollable: find.byType(Scrollable).last,
      maxScrolls: 20,
    );
    await tester.pumpAndSettle();
    expect(find.text('Community well register'), findsOneWidget);
    expect(find.text('Hydrogeological source assessment'), findsNothing);
    expect(find.text('Internal contamination-notice correspondence'),
        findsNothing);

    await tester.pumpWidget(
      MaterialApp(
        home: DossierScreen(dossier: english.dossier!, locale: 'en'),
      ),
    );
    expect(
      find.text(
        'The groundwater plume links the Caldera facility to the affected wells.',
      ),
      findsNothing,
    );
    expect(find.text('Hydrogeological source assessment'), findsNothing);

    await tester.pumpWidget(
      MaterialApp(
        home: DossierScreen(dossier: russian.dossier!, locale: 'ru'),
      ),
    );
    expect(
      find.text(
        'Шлейф загрязнения грунтовых вод связывает объект Caldera с затронутыми скважинами.',
      ),
      findsNothing,
    );
    expect(
        find.text('Гидрогеологическое заключение об источнике'), findsNothing);
  });
}

Map<String, dynamic> _openingSnapshot(MobileCaseDefinition definition) {
  final Map<String, dynamic> scenario = definition.scenario!;
  final List<Map<String, dynamic>> facts = _objectList(scenario['facts']);
  final List<Map<String, dynamic>> evidence = _objectList(scenario['evidence']);
  final List<Map<String, dynamic>> deadlines =
      _objectList(scenario['deadlines']);
  final List<Map<String, dynamic>> inbox = _objectList(scenario['inbox_items']);
  final List<Map<String, dynamic>> actions = _objectList(scenario['actions']);
  final Set<String> visibleFactIds = facts
      .where((Map<String, dynamic> item) => item['initial_status'] != 'unknown')
      .map((Map<String, dynamic> item) => item['id']! as String)
      .toSet();
  final List<Map<String, dynamic>> visibleFacts = facts
      .where((Map<String, dynamic> item) => visibleFactIds.contains(item['id']))
      .toList(growable: false)
    ..sort((Map<String, dynamic> left, Map<String, dynamic> right) =>
        (left['id']! as String).compareTo(right['id']! as String));
  final List<Map<String, dynamic>> visibleEvidence = evidence
      .where((Map<String, dynamic> item) => item['initially_available'] == true)
      .toList(growable: false)
    ..sort((Map<String, dynamic> left, Map<String, dynamic> right) =>
        (left['id']! as String).compareTo(right['id']! as String));
  final List<Map<String, dynamic>> activeDeadlines = deadlines
      .where((Map<String, dynamic> item) => item['activation_event'] == null)
      .toList(growable: false)
    ..sort((Map<String, dynamic> left, Map<String, dynamic> right) {
      final int leftDue = _dueMinutes(_object(left['due_at']));
      final int rightDue = _dueMinutes(_object(right['due_at']));
      return leftDue != rightDue
          ? leftDue.compareTo(rightDue)
          : (left['id']! as String).compareTo(right['id']! as String);
    });
  final Map<String, dynamic> openingAction = actions.singleWhere(
    (Map<String, dynamic> item) => item['id'] == 'accept_residents_mandate',
  );

  return <String, dynamic>{
    'snapshot_schema_version': 1,
    'scenario_id': definition.scenarioId,
    'seed': definition.seed,
    'stage_id': 'community_intake',
    'stage_title': 'Community intake',
    'clock_minutes': 0,
    'clock_mode': 'foreground',
    'judicial_result': null,
    'judicial_decision_instance': null,
    'matter_lifecycle': 'active',
    'is_closed': false,
    'resolved_outcome': null,
    'terminal': false,
    'flags': <String, bool>{},
    'resources': _object(scenario['initial_resources']),
    'facts': facts
        .where(
          (Map<String, dynamic> item) => item['initial_status'] != 'unknown',
        )
        .map(
          (Map<String, dynamic> item) => <String, dynamic>{
            'id': item['id'],
            'statement': item['statement'],
            'status': item['initial_status'],
          },
        )
        .toList(growable: false),
    'evidence': evidence
        .where(
          (Map<String, dynamic> item) => item['initially_available'] == true,
        )
        .map(
          (Map<String, dynamic> item) => <String, dynamic>{
            'id': item['id'],
            'title': item['title'],
            'kind': item['kind'],
            'description': item['description'],
            'available': item['initially_available'],
          },
        )
        .toList(growable: false),
    'deadlines': deadlines
        .where(
          (Map<String, dynamic> item) => item['activation_event'] == null,
        )
        .map(
          (Map<String, dynamic> item) => <String, dynamic>{
            'id': item['id'],
            'title': item['title'],
            'due_at_minutes': _dueMinutes(_object(item['due_at'])),
            'status': 'open',
            'completion_action_ids': item['completion_actions'],
          },
        )
        .toList(growable: false),
    'inbox': inbox
        .where(
          (Map<String, dynamic> item) => item['initially_visible'] == true,
        )
        .map(
          (Map<String, dynamic> item) => <String, dynamic>{
            'id': item['id'],
            'subject': item['subject'],
            'body': item['body'],
            'visible': item['initially_visible'],
            'resolved': false,
            'action_required': item['action_required'],
          },
        )
        .toList(growable: false),
    'available_actions': <Map<String, dynamic>>[
      _actionSnapshot(openingAction),
    ],
    'fired_event_ids': <String>[],
    'outcome': null,
    'dossier': <String, dynamic>{
      'projection_schema_version': 1,
      'procedure': <String, dynamic>{
        'stage_id': 'community_intake',
        'stage_title': 'Community intake',
        'clock_minutes': 0,
        'matter_lifecycle': 'active',
        'is_closed': false,
        'matter_status': 'open',
      },
      'judicial_result': null,
      'judicial_decision_instance': null,
      'facts': visibleFacts
          .map(
            (Map<String, dynamic> item) => <String, dynamic>{
              'id': item['id'],
              'statement': item['statement'],
              'status': item['initial_status'],
            },
          )
          .toList(growable: false),
      'evidence': visibleEvidence
          .map(
            (Map<String, dynamic> item) => <String, dynamic>{
              'id': item['id'],
              'title': item['title'],
              'kind': item['kind'],
              'description': item['description'],
              'supports_fact_ids': _stringList(item['supports_facts'])
                  .where(visibleFactIds.contains)
                  .toList(growable: false),
              'contradicts_fact_ids': _stringList(item['contradicts_facts'])
                  .where(visibleFactIds.contains)
                  .toList(growable: false),
            },
          )
          .toList(growable: false),
      'deadlines': activeDeadlines
          .map(
            (Map<String, dynamic> item) => <String, dynamic>{
              'id': item['id'],
              'title': item['title'],
              'due_at_minutes': _dueMinutes(_object(item['due_at'])),
              'status': 'open',
              'remedies': <Map<String, dynamic>>[],
            },
          )
          .toList(growable: false),
      'outcome': null,
    },
  };
}

Map<String, dynamic> _actionSnapshot(Map<String, dynamic> action) =>
    <String, dynamic>{
      'id': action['id'],
      'title': action['title'],
      'description': action['description'],
      'time_cost_minutes': action['time_cost_minutes'],
      'cost_eur': action['cost_eur'],
      'billable_minutes': action['billable_minutes'],
    };

Map<String, dynamic> _dossierJson(DossierProjectionView dossier) {
  return <String, dynamic>{
    'stage': dossier.procedure.stageId,
    'facts': dossier.facts
        .map((DossierFactView item) => <String>[item.id, item.statement])
        .toList(growable: false),
    'evidence': dossier.evidence
        .map((DossierEvidenceView item) => <Object?>[
              item.id,
              item.title,
              item.description,
              item.supportsFactIds,
              item.contradictsFactIds,
            ])
        .toList(growable: false),
    'deadlines': dossier.deadlines
        .map((DossierDeadlineView item) => item.id)
        .toList(growable: false),
  };
}

int _dueMinutes(Map<String, dynamic> dueAt) =>
    (dueAt['day']! as int) * 1440 + (dueAt['minute_of_day']! as int);

Map<String, dynamic> _object(dynamic value) =>
    (value as Map<dynamic, dynamic>).cast<String, dynamic>();

List<Map<String, dynamic>> _objectList(dynamic value) =>
    (value as List<dynamic>)
        .map((dynamic item) => _object(item))
        .toList(growable: false);

List<String> _stringList(dynamic value) =>
    (value as List<dynamic>? ?? const <dynamic>[]).cast<String>();
