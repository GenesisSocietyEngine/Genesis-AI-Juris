import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/scenario_snapshot_mapper.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/game_snapshot.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MobileCaseDefinition caseDefinition;

  setUpAll(() async {
    final String encoded = await rootBundle.loadString(
      'assets/case_catalog/mobile_case_bundle.json',
    );
    final CaseCatalogBundle bundle = CaseCatalogBundle.fromJson(
      jsonDecode(encoded) as Map<String, dynamic>,
    );
    caseDefinition = bundle.cases.first;
  });

  test('maps lost post-judgment as open with remedy actions', () {
    final GameSnapshot snapshot = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: 'lost',
        judicialDecisionInstance: 'first_instance',
        lifecycle: 'post_judgment',
        isClosed: false,
        actions: const <String>['file_appeal', 'waive_appeal'],
      ),
      caseDefinition: caseDefinition,
    );

    expect(snapshot.judicialResult, JudicialResult.lost);
    expect(
      snapshot.judicialDecisionInstance,
      JudicialDecisionInstance.firstInstance,
    );
    expect(snapshot.caseResultStatus, CaseResultStatus.lostAtFirstInstance);
    expect(
      snapshot.matterLifecycle,
      MatterLifecycleStatus.postJudgment,
    );
    expect(snapshot.isClosed, isFalse);
    expect(snapshot.outcomeSummary, isNull);
    expect(
      snapshot.actions.map((GameActionView action) => action.id),
      containsAll(<String>['file_appeal', 'waive_appeal']),
    );
  });

  test('maps explicit final loss closure and terminal outcome', () {
    final GameSnapshot snapshot = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: 'lost',
        judicialDecisionInstance: 'first_instance',
        lifecycle: 'closed',
        isClosed: true,
        outcomeId: 'final_loss',
      ),
      caseDefinition: caseDefinition,
    );

    expect(snapshot.judicialResult, JudicialResult.lost);
    expect(snapshot.matterLifecycle, MatterLifecycleStatus.closed);
    expect(snapshot.isClosed, isTrue);
    expect(snapshot.outcomeSummary?.finalStatus, 'final_loss');
  });

  test('maps won enforcement state without treating it as closed', () {
    final GameSnapshot snapshot = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: 'won',
        judicialDecisionInstance: 'appeal',
        lifecycle: 'enforcement',
        isClosed: false,
        actions: const <String>['complete_enforcement'],
      ),
      caseDefinition: caseDefinition,
    );

    expect(snapshot.judicialResult, JudicialResult.won);
    expect(snapshot.matterLifecycle, MatterLifecycleStatus.enforcement);
    expect(snapshot.caseResultStatus, CaseResultStatus.wonOnAppeal);
    expect(snapshot.isClosed, isFalse);
    expect(snapshot.actions.single.id, 'complete_enforcement');
  });

  test('does not label an appellate loss as a first-instance result', () {
    final GameSnapshot snapshot = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: 'lost',
        judicialDecisionInstance: 'appeal',
        lifecycle: 'appeal',
        isClosed: false,
      ),
      caseDefinition: caseDefinition,
    );

    expect(snapshot.caseResultStatus, CaseResultStatus.lostOnAppeal);
  });

  test('recognizes a closed appellate-success outcome', () {
    final GameSnapshot snapshot = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: 'won',
        judicialDecisionInstance: 'appeal',
        lifecycle: 'closed',
        isClosed: true,
        outcomeId: 'appellate_success',
      ),
      caseDefinition: caseDefinition,
    );

    expect(snapshot.caseResultStatus, CaseResultStatus.wonOnAppeal);
  });

  test('does not invent a cassation remittal from result and court instance',
      () {
    final GameSnapshot snapshot = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: 'won',
        judicialDecisionInstance: 'cassation',
        lifecycle: 'cassation',
        isClosed: false,
      ),
      caseDefinition: caseDefinition,
    );

    expect(snapshot.judicialResult, JudicialResult.won);
    expect(
      snapshot.judicialDecisionInstance,
      JudicialDecisionInstance.cassation,
    );
    expect(snapshot.caseResultStatus, CaseResultStatus.ongoing);
    expect(
      snapshot.caseResultStatus,
      isNot(CaseResultStatus.remittedAfterCassation),
    );
  });

  test('nullable and future judicial-result values parse safely', () {
    final GameSnapshot absent = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: null,
        judicialDecisionInstance: null,
        lifecycle: 'active',
        isClosed: false,
      ),
      caseDefinition: caseDefinition,
    );
    final GameSnapshot future = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: 'vacated_for_retrial',
        judicialDecisionInstance: 'supreme_court_review',
        lifecycle: 'future_remedy',
        isClosed: false,
      ),
      caseDefinition: caseDefinition,
    );

    expect(absent.judicialResult, isNull);
    expect(absent.judicialDecisionInstance, isNull);
    expect(future.judicialResult, JudicialResult.unknown);
    expect(
      future.judicialDecisionInstance,
      JudicialDecisionInstance.unknown,
    );
    expect(future.matterLifecycle, MatterLifecycleStatus.unknown);
  });

  test('never infers decision instance from lifecycle stage or outcome ID', () {
    final GameSnapshot appealStage = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: 'lost',
        judicialDecisionInstance: null,
        lifecycle: 'appeal',
        isClosed: false,
      ),
      caseDefinition: caseDefinition,
    );
    final GameSnapshot appellateOutcome = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: 'won',
        judicialDecisionInstance: null,
        lifecycle: 'closed',
        isClosed: true,
        outcomeId: 'appellate_success',
      ),
      caseDefinition: caseDefinition,
    );

    expect(appealStage.judicialDecisionInstance, isNull);
    expect(appealStage.caseResultStatus, CaseResultStatus.ongoing);
    expect(appellateOutcome.judicialDecisionInstance, isNull);
    expect(
      appellateOutcome.caseResultStatus,
      isNot(CaseResultStatus.wonOnAppeal),
    );
  });

  test('old snapshot may omit the additive decision-instance key', () {
    final Map<String, dynamic> source = _snapshot(
      judicialResult: 'lost',
      judicialDecisionInstance: null,
      lifecycle: 'appeal',
      isClosed: false,
    )..remove('judicial_decision_instance');

    final GameSnapshot snapshot = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: caseDefinition,
    );

    expect(snapshot.judicialResult, JudicialResult.lost);
    expect(snapshot.judicialDecisionInstance, isNull);
    expect(snapshot.matterLifecycle, MatterLifecycleStatus.appeal);
    expect(snapshot.caseResultStatus, CaseResultStatus.ongoing);
  });

  test('EN and RU mappings retain identical authoritative lifecycle state', () {
    final Map<String, dynamic> source = _snapshot(
      judicialResult: 'lost',
      judicialDecisionInstance: 'first_instance',
      lifecycle: 'post_judgment',
      isClosed: false,
      actions: const <String>['file_appeal', 'waive_appeal'],
    );
    final GameSnapshot english = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: caseDefinition,
      locale: 'en',
    );
    final GameSnapshot russian = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: caseDefinition,
      locale: 'ru',
    );

    expect(russian.seed, english.seed);
    expect(russian.judicialResult, english.judicialResult);
    expect(
      russian.judicialDecisionInstance,
      english.judicialDecisionInstance,
    );
    expect(russian.matterLifecycle, english.matterLifecycle);
    expect(russian.isClosed, english.isClosed);
    expect(russian.caseResultStatus, english.caseResultStatus);
    expect(
      russian.actions.map((GameActionView action) => action.id),
      english.actions.map((GameActionView action) => action.id),
    );
  });

  test('uses optional authoritative metric and resource projections', () {
    final GameSnapshot snapshot = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: null,
        judicialDecisionInstance: null,
        lifecycle: 'active',
        isClosed: false,
        numericMetrics: const <String, int>{
          'case_strength': 43,
          'merits': 52,
          'evidence': 28,
          'procedure': 55,
          'leverage': 35,
          'fatigue': 7,
          'cumulative_strain': 3,
          'ethics': 70,
          'client_trust': 50,
        },
        resources: const <String, int>{
          'spend_eur': 2350,
          'authorized_budget_eur': 25000,
          'billable_minutes': 540,
          'award_eur': 220800,
          'outcome_costs_eur': 18000,
        },
      ),
      caseDefinition: caseDefinition,
    );

    expect(snapshot.caseStrength, 43);
    expect(snapshot.merits, 52);
    expect(snapshot.evidenceScore, 28);
    expect(snapshot.procedure, 55);
    expect(snapshot.leverage, 35);
    expect(snapshot.fatigue, 7);
    expect(snapshot.cumulativeStrain, 3);
    expect(snapshot.ethics, 70);
    expect(snapshot.clientTrust, 50);
    expect(snapshot.spendEur, 2350);
    expect(snapshot.authorizedBudgetEur, 25000);
    expect(snapshot.billableMinutes, 540);
    expect(snapshot.numericMetrics['merits'], 52);
    expect(snapshot.resources['spend_eur'], 2350);
  });

  test('maps generic terminal award and costs resources', () {
    final GameSnapshot snapshot = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: 'won',
        judicialDecisionInstance: 'first_instance',
        lifecycle: 'closed',
        isClosed: true,
        outcomeId: 'substantially_upheld',
        resources: const <String, int>{
          'award_eur': 220800,
          'outcome_costs_eur': 18000,
        },
      ),
      caseDefinition: caseDefinition,
    );

    expect(snapshot.outcomeSummary?.awardEur, 220800);
    expect(snapshot.outcomeSummary?.costsEur, 18000);
  });

  test('projects semantic action tags and inbox resolution relationships', () {
    final Map<String, dynamic> source = _snapshot(
      judicialResult: null,
      judicialDecisionInstance: null,
      lifecycle: 'active',
      isClosed: false,
    );
    source['inbox'] = <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 'research-request',
        'sender': 'Client legal team',
        'subject': 'Research requested',
        'body': 'Prepare a focused legal review.',
        'visible': true,
        'resolved': false,
        'action_required': true,
        'resolution_action_ids': <String>['ask-ai-research'],
      },
    ];
    source['available_actions'] = <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 'ask-ai-research',
        'title': 'Research with the AI associate',
        'description': 'Prepare a focused legal review.',
        'presentation_tags': <String>['ai'],
        'time_cost_minutes': 15,
      },
    ];

    final GameSnapshot snapshot = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: caseDefinition,
    );

    expect(snapshot.inbox.single.resolutionActionIds, <String>[
      'ask-ai-research',
    ]);
    expect(snapshot.inbox.single.sender, 'Client legal team');
    expect(snapshot.actions.single.presentationTags, <String>['ai']);
  });

  test('presents an authoritative relative completion target in EN and RU', () {
    final Map<String, dynamic> source = _snapshot(
      judicialResult: null,
      judicialDecisionInstance: null,
      lifecycle: 'active',
      isClosed: false,
    );
    source['available_actions'] = <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 'rest-until-next-workday',
        'title': 'Rest until the next workday',
        'description': 'Advance to the next workday.',
        'time_cost_minutes': 0,
        'completion_at_minutes': 1440,
      },
    ];

    final GameSnapshot english = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: caseDefinition,
    );
    final GameSnapshot russian = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: caseDefinition,
      locale: 'ru',
    );

    expect(english.actions.single.timeLabel, 'Until Day 2 · 08:00');
    expect(russian.actions.single.timeLabel, 'До дня 2 · 08:00');
  });

  test('maps pressure projection with authored order and safe ID filtering',
      () {
    final Map<String, dynamic> source = _snapshot(
      judicialResult: null,
      judicialDecisionInstance: null,
      lifecycle: 'active',
      isClosed: false,
      actions: const <String>[
        'negotiate-extension',
        'file-documented-response',
      ],
    );
    source['pressure_and_countermove'] = <String, dynamic>{
      'projection_schema_version': 1,
      'active_pressures': <Map<String, dynamic>>[
        <String, dynamic>{
          'pressure_id': 'urgent-demand',
          'source_actor_id': 'northbridge_counsel',
          'due_at_minute': 120,
          'remaining_minutes': 60,
          'available_response_action_ids': <String>[
            'file-documented-response',
            'unknown-future-action',
            'negotiate-extension',
          ],
        },
      ],
    };

    final GameSnapshot mapped = ScenarioSnapshotMapper.map(
      source: source,
      caseDefinition: caseDefinition,
    );
    final pressure = mapped.pressureAndCountermove!.activePressures.single;
    expect(pressure.pressureId, 'urgent-demand');
    expect(pressure.sourceActorName, 'Counsel for Northbridge Consulting');
    expect(pressure.dueAtMinute, 120);
    expect(pressure.remainingMinutes, 60);
    expect(pressure.availableResponseActionIds, <String>[
      'file-documented-response',
      'negotiate-extension',
    ]);
  });

  test('omits unknown future pressure versions and rejects malformed v1', () {
    final Map<String, dynamic> future = _snapshot(
      judicialResult: null,
      judicialDecisionInstance: null,
      lifecycle: 'active',
      isClosed: false,
    )..['pressure_and_countermove'] = <String, dynamic>{
        'projection_schema_version': 2,
        'active_pressures': const <Map<String, dynamic>>[],
      };
    expect(
      ScenarioSnapshotMapper.map(
        source: future,
        caseDefinition: caseDefinition,
      ).pressureAndCountermove,
      isNull,
    );

    final Map<String, dynamic> malformed = _snapshot(
      judicialResult: null,
      judicialDecisionInstance: null,
      lifecycle: 'active',
      isClosed: false,
    )..['pressure_and_countermove'] = <String, dynamic>{
        'projection_schema_version': 1,
        'active_pressures': <Map<String, dynamic>>[
          <String, dynamic>{
            'pressure_id': 'urgent-demand',
            'source_actor_id': 'northbridge_counsel',
            'remaining_minutes': 60,
            'available_response_action_ids': const <String>[],
          },
        ],
      };
    expect(
      () => ScenarioSnapshotMapper.map(
        source: malformed,
        caseDefinition: caseDefinition,
      ),
      throwsFormatException,
    );
  });
}

Map<String, dynamic> _snapshot({
  required Object? judicialResult,
  required Object? judicialDecisionInstance,
  required String lifecycle,
  required bool isClosed,
  List<String> actions = const <String>[],
  String? outcomeId,
  Map<String, int>? numericMetrics,
  Map<String, int>? resources,
}) {
  return <String, dynamic>{
    'snapshot_schema_version': 1,
    'scenario_id': 'adverse_judgment_with_remedies',
    'seed': 20260729,
    'stage_id': lifecycle,
    'stage_title': lifecycle.replaceAll('_', ' '),
    'clock_minutes': 60,
    'judicial_result': judicialResult,
    'judicial_decision_instance': judicialDecisionInstance,
    'matter_lifecycle': lifecycle,
    'is_closed': isClosed,
    'resolved_outcome': outcomeId,
    'terminal': isClosed,
    if (numericMetrics != null) 'numeric_metrics': numericMetrics,
    if (resources != null) 'resources': resources,
    'flags': <String, bool>{},
    'facts': const <Map<String, dynamic>>[],
    'evidence': const <Map<String, dynamic>>[],
    'deadlines': const <Map<String, dynamic>>[],
    'inbox': const <Map<String, dynamic>>[],
    'available_actions': actions
        .map(
          (String id) => <String, dynamic>{
            'id': id,
            'title': id.replaceAll('_', ' '),
            'description': 'Execute $id.',
            'time_cost_minutes': 5,
          },
        )
        .toList(growable: false),
    'fired_event_ids': const <String>[],
    'outcome': outcomeId == null
        ? null
        : <String, dynamic>{
            'id': outcomeId,
            'title': 'Final loss',
            'summary': 'Remedies are waived or exhausted.',
          },
  };
}
