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
        lifecycle: 'post_judgment',
        isClosed: false,
        actions: const <String>['file_appeal', 'waive_appeal'],
      ),
      caseDefinition: caseDefinition,
    );

    expect(snapshot.judicialResult, JudicialResult.lost);
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
        lifecycle: 'enforcement',
        isClosed: false,
        actions: const <String>['complete_enforcement'],
      ),
      caseDefinition: caseDefinition,
    );

    expect(snapshot.judicialResult, JudicialResult.won);
    expect(snapshot.matterLifecycle, MatterLifecycleStatus.enforcement);
    expect(snapshot.isClosed, isFalse);
    expect(snapshot.actions.single.id, 'complete_enforcement');
  });

  test('nullable and future judicial-result values parse safely', () {
    final GameSnapshot absent = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: null,
        lifecycle: 'active',
        isClosed: false,
      ),
      caseDefinition: caseDefinition,
    );
    final GameSnapshot future = ScenarioSnapshotMapper.map(
      source: _snapshot(
        judicialResult: 'vacated_for_retrial',
        lifecycle: 'future_remedy',
        isClosed: false,
      ),
      caseDefinition: caseDefinition,
    );

    expect(absent.judicialResult, isNull);
    expect(future.judicialResult, JudicialResult.unknown);
    expect(future.matterLifecycle, MatterLifecycleStatus.unknown);
  });
}

Map<String, dynamic> _snapshot({
  required Object? judicialResult,
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
