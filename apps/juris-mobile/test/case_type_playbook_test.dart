import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/models/case_type_playbook.dart';
import 'package:juris_mobile/models/case_type_registry.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';

void main() {
  test('mobile asset is byte-identical to the v59 playbook contract', () {
    final File contract = File('../../contracts/case-type-playbooks.v1.json');
    final File asset =
        File('assets/case_types/case_type_playbooks.v1.json');
    expect(asset.readAsBytesSync(), contract.readAsBytesSync());

    final CaseTypePlaybookRegistry registry =
        CaseTypePlaybookRegistry.fromJson(
      jsonDecode(contract.readAsStringSync()),
    );
    expect(registry.playbooks.length, CaseTypeId.values.length);
    expect(
      registry
          .forCaseType(CaseTypeId.trainingSimulation)
          .test
          .requiresPlayableRoute,
      isTrue,
    );
    expect(
      registry
          .forCaseType(CaseTypeId.generalAdvisory)
          .test
          .requiresPlayableRoute,
      isFalse,
    );
  });

  test('tax package fails closed until dated sources and duties are recorded', () {
    final CaseTypePlaybookRegistry registry =
        CaseTypePlaybookRegistry.fromJson(
      jsonDecode(
        File('../../contracts/case-type-playbooks.v1.json').readAsStringSync(),
      ),
    );
    final CaseTypePlaybook playbook =
        registry.forCaseType(CaseTypeId.taxCompliance);
    final StudioScenarioDraft incomplete = StudioScenarioDraft.guidedExample()
        .updateCaseType(CaseTypeId.taxCompliance);
    expect(
      evaluateCanonicalCasePackage(playbook, incomplete).missing,
      containsAll(<String>['legal_as_of', 'https_source', 'compliance']),
    );

    final StudioScenarioDraft complete = incomplete.updateFacts(<String>[
      'Legal as-of date: 2026-08-31.',
      'Authority: https://example.gov/tax/rule.',
      'Применяется обязанность по отчётности и compliance.',
    ]);
    expect(evaluateCanonicalCasePackage(playbook, complete).complete, isTrue);
  });
}
