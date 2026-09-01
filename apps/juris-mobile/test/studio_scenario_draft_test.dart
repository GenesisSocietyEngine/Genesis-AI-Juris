import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/models/case_type_registry.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';

void main() {
  test('guided Studio edits the canonical ScenarioDefinition directly', () {
    final StudioScenarioDraft draft = StudioScenarioDraft.guidedExample();
    final Map<String, dynamic> scenario = draft.toJson();

    expect(scenario['schema_version'], '1.0');
    expect(scenario['metadata']['id'], 'supplier_transition_dispute');
    expect(scenario['initial_stage'], 'intake');
    expect(draft.caseType.id, CaseTypeId.trainingSimulation);
    expect(draft.identityReady, isTrue);
    expect(draft.factsReady, isTrue);
    expect(draft.mapReady, isTrue);
    expect(
      (scenario['stages'] as List<dynamic>).last['terminal'],
      isTrue,
    );
  });

  test('Flutter starter output matches the Rust-owned cross-layer fixture', () {
    final Map<String, dynamic> fixture = jsonDecode(
      File('test/fixtures/guided_studio_scenario.json').readAsStringSync(),
    ) as Map<String, dynamic>;
    expect(StudioScenarioDraft.guidedExample().toJson(), fixture);
  });

  test('identity and facts preserve executable graph IDs', () {
    final StudioScenarioDraft original = StudioScenarioDraft.blank();
    final StudioScenarioDraft edited = original
        .updateIdentity(
      title: 'Emergency lease dispute',
      jurisdiction: 'nl',
      role: 'Tenant counsel',
      premise: 'The tenant needs urgent relief.',
    )
        .updateFacts(<String>['Notice was served.', '  ', 'Rent is current.']);

    expect(edited.caseId, 'emergency_lease_dispute');
    expect(edited.jurisdiction, 'NL');
    expect(edited.facts, <String>['Notice was served.', 'Rent is current.']);
    expect(edited.toJson()['initial_stage'], 'intake');
    expect(
      (edited.toJson()['actions'] as List<dynamic>).first['id'],
      'assess_case',
    );
  });

  test('case type is versioned and survives canonical JSON round-trip', () {
    final StudioScenarioDraft typed =
        StudioScenarioDraft.blank().updateCaseType(CaseTypeId.erpIncident);
    final StudioScenarioDraft restored =
        StudioScenarioDraft.fromJson(typed.toJson());
    expect(restored.caseType.id, CaseTypeId.erpIncident);
    expect(restored.caseType.registry, caseTypeRegistryId);
    expect(restored.caseType.version, caseTypeVersion);
  });

  test('import rejects unsupported case types before a draft is created', () {
    final Map<String, dynamic> source =
        StudioScenarioDraft.guidedExample().toJson();
    (source['metadata'] as Map<String, dynamic>)['case_type'] =
        <String, dynamic>{
      'registry': caseTypeRegistryId,
      'id': 'erp_incident',
      'version': '2.0.0',
    };
    expect(() => StudioScenarioDraft.fromJson(source), throwsFormatException);
  });

  test('import accepts only canonical ScenarioDefinition v1 JSON', () {
    expect(
      () => StudioScenarioDraft.fromJson(<String, dynamic>{'title': 'No'}),
      throwsFormatException,
    );
    expect(
      StudioScenarioDraft.fromJson(
        StudioScenarioDraft.guidedExample().toJson(),
      ).title,
      'Supplier transition dispute',
    );
  });

  test('workflow stage IDs match the web six-stage contract', () {
    expect(
      StudioWorkflowStage.values
          .map((StudioWorkflowStage stage) => stage.wireName),
      <String>[
        'describe',
        'review_ai_draft',
        'facts_assumptions',
        'case_map',
        'run_compare',
        'report_save',
      ],
    );
  });
}
