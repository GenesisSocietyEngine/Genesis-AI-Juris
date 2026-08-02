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
}

Map<String, dynamic> _snapshot({
  required Object? judicialResult,
  required Object? judicialDecisionInstance,
  required String lifecycle,
  required bool isClosed,
  List<String> actions = const <String>[],
  String? outcomeId,
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
