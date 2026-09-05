import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/models/case_type_playbook.dart';
import 'package:juris_mobile/models/report_contract.dart';

void main() {
  late Map<String, dynamic> profileSource;
  late Map<String, dynamic> manifestSource;
  late Map<String, dynamic> playbookSource;

  setUpAll(() {
    profileSource = _readJson('../../contracts/report-profiles.v1.json');
    manifestSource = _readJson('../../contracts/report-manifest.v1.json');
    playbookSource = _readJson('../../contracts/case-type-playbooks.v1.json');
  });

  test('report contracts and Flutter assets are byte-identical', () {
    for (final String name in <String>[
      'report-profiles.v1.json',
      'report-manifest.v1.json',
    ]) {
      expect(
        File('assets/case_types/$name').readAsBytesSync(),
        File('../../contracts/$name').readAsBytesSync(),
        reason: name,
      );
    }
  });

  test('manifest covers all nine packages and 22 outputs exactly once', () {
    final ReportContract contract = _parse(
      profileSource,
      manifestSource,
      playbookSource,
    );
    final CaseTypePlaybookRegistry playbooks =
        CaseTypePlaybookRegistry.fromJson(playbookSource);
    expect(playbooks.playbooks, hasLength(9));
    expect(contract.profiles.profiles, hasLength(19));
    expect(contract.manifest.outputs, hasLength(22));
    expect(
      contract.manifest.outputs
          .map((ReportManifestOutput output) => output.bindingKey)
          .toSet(),
      hasLength(22),
    );
    for (final CaseTypePlaybook playbook in playbooks.playbooks) {
      for (final CaseOutputProfile output in playbook.outputs) {
        expect(
          contract.manifest.outputFor(playbook.caseType, output.id).primary,
          output.primary,
          reason: '${playbook.caseType.wireName}:${output.id}',
        );
      }
    }
  });

  test('report IDs, schema versions, and renderer versions are immutable', () {
    expect(reportProfileIds, <String>{
      'decision_memorandum',
      'evidence_schedule',
      'option_comparison',
      'strategy_risk_report',
      'redline_risk_report',
      'obligation_matrix',
      'tax_position_memorandum',
      'economic_assessment',
      'gap_remediation_plan',
      'control_matrix',
      'compliance_schedule',
      'solution_design',
      'root_cause_brief',
      'test_pack',
      'findings_chronology_report',
      'evidence_inventory',
      'playable_scenario',
      'facilitator_guide',
      'route_coverage',
    });
    expect(reportProfileSchemaVersion, 1);
    expect(reportManifestSchemaVersion, 1);
    expect(reportModelSchemaVersion, 1);
    expect(reportSemanticRendererVersion, '1.0.0');
    expect(reportLayoutSchemaVersion, 1);
    expect(reportLayoutAlgorithmVersion, '1.1.0');
    expect(reportLayoutRendererVersion, '2.1.0');

    final ReportContract contract = _parse(
      profileSource,
      manifestSource,
      playbookSource,
    );
    expect(
      () => contract.profiles.profiles.add(contract.profiles.profiles.first),
      throwsUnsupportedError,
    );
    expect(
      () => contract.manifest.outputs.add(contract.manifest.outputs.first),
      throwsUnsupportedError,
    );
  });

  test('unknown report IDs and versions are rejected', () {
    final Map<String, dynamic> unknownId = _copy(profileSource);
    ((unknownId['profiles'] as List<dynamic>).first
        as Map<String, dynamic>)['id'] = 'unknown_report';
    expect(
      () => ReportProfileRegistry.fromJson(unknownId),
      throwsFormatException,
    );

    final Map<String, dynamic> semanticVersion = _copy(profileSource);
    semanticVersion['rendererVersion'] = '2.0.0';
    expect(
      () => ReportProfileRegistry.fromJson(semanticVersion),
      throwsFormatException,
    );

    final List<Map<String, dynamic>> invalidManifests = <Map<String, dynamic>>[
      _changed(manifestSource, 'schemaVersion', 2),
      _nestedChanged(manifestSource, 'reportModel', 'schemaVersion', 2),
      _nestedChanged(
        manifestSource,
        'semanticRenderer',
        'rendererVersion',
        '2.0.0',
      ),
      _nestedChanged(manifestSource, 'layout', 'layoutSchemaVersion', 2),
      _nestedChanged(
        manifestSource,
        'layout',
        'layoutAlgorithmVersion',
        '2.0.0',
      ),
      _nestedChanged(
        manifestSource,
        'layout',
        'layoutRendererVersion',
        '3.0.0',
      ),
    ];
    for (final Map<String, dynamic> invalid in invalidManifests) {
      expect(
        () => _parse(profileSource, invalid, playbookSource),
        throwsFormatException,
      );
    }

    final Map<String, dynamic> caseVersion = _copy(manifestSource);
    final Map<String, dynamic> output =
        (caseVersion['outputs'] as List<dynamic>).first as Map<String, dynamic>;
    (output['caseType'] as Map<String, dynamic>)['version'] = '2.0.0';
    expect(
      () => _parse(profileSource, caseVersion, playbookSource),
      throwsFormatException,
    );
  });

  test('profile kinds and ordered sections fail closed', () {
    final Map<String, dynamic> changedKind = _copy(profileSource);
    ((changedKind['profiles'] as List<dynamic>).first
        as Map<String, dynamic>)['kind'] = 'evidence_schedule';

    final Map<String, dynamic> missingSection = _copy(profileSource);
    final List<dynamic> missingSections =
        ((missingSection['profiles'] as List<dynamic>).first
            as Map<String, dynamic>)['sections'] as List<dynamic>;
    missingSections.removeLast();

    final Map<String, dynamic> reorderedSections = _copy(profileSource);
    final List<dynamic> reordered =
        ((reorderedSections['profiles'] as List<dynamic>).first
            as Map<String, dynamic>)['sections'] as List<dynamic>;
    final Object? first = reordered.removeAt(0);
    reordered.insert(1, first);

    for (final Map<String, dynamic> invalid in <Map<String, dynamic>>[
      changedKind,
      missingSection,
      reorderedSections,
    ]) {
      expect(
        () => ReportProfileRegistry.fromJson(invalid),
        throwsFormatException,
      );
    }
  });

  test('duplicates and incomplete output coverage are rejected', () {
    final Map<String, dynamic> duplicateProfile = _copy(profileSource);
    final List<dynamic> profiles =
        duplicateProfile['profiles'] as List<dynamic>;
    profiles.add(_copy(profiles.first as Map<String, dynamic>));
    expect(
      () => ReportProfileRegistry.fromJson(duplicateProfile),
      throwsFormatException,
    );

    final Map<String, dynamic> duplicateOutput = _copy(manifestSource);
    final List<dynamic> duplicated =
        duplicateOutput['outputs'] as List<dynamic>;
    duplicated.add(_copy(duplicated.first as Map<String, dynamic>));
    expect(
      () => _parse(profileSource, duplicateOutput, playbookSource),
      throwsFormatException,
    );

    final Map<String, dynamic> missingOutput = _copy(manifestSource);
    (missingOutput['outputs'] as List<dynamic>).removeLast();
    expect(
      () => _parse(profileSource, missingOutput, playbookSource),
      throwsFormatException,
    );
  });
}

ReportContract _parse(
  Map<String, dynamic> profiles,
  Map<String, dynamic> manifest,
  Map<String, dynamic> playbooks,
) {
  return ReportContract.fromJson(
    profileRegistry: profiles,
    manifest: manifest,
    playbookRegistry: playbooks,
  );
}

Map<String, dynamic> _readJson(String path) =>
    jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

Map<String, dynamic> _copy(Map<String, dynamic> source) =>
    jsonDecode(jsonEncode(source)) as Map<String, dynamic>;

Map<String, dynamic> _changed(
  Map<String, dynamic> source,
  String key,
  Object value,
) {
  final Map<String, dynamic> changed = _copy(source);
  changed[key] = value;
  return changed;
}

Map<String, dynamic> _nestedChanged(
  Map<String, dynamic> source,
  String objectKey,
  String key,
  Object value,
) {
  final Map<String, dynamic> changed = _copy(source);
  (changed[objectKey] as Map<String, dynamic>)[key] = value;
  return changed;
}
