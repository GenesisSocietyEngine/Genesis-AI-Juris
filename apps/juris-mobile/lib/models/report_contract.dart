import 'case_type_playbook.dart';
import 'case_type_registry.dart';

const String reportProfileRegistryId = 'genesis-juris-report-profiles';
const String reportManifestId = 'genesis-juris-report-manifest';
const String reportProfileAsset = 'assets/case_types/report-profiles.v1.json';
const String reportManifestAsset = 'assets/case_types/report-manifest.v1.json';
const int reportProfileSchemaVersion = 1;
const int reportManifestSchemaVersion = 1;
const int reportModelSchemaVersion = 1;
const String reportSemanticRendererVersion = '1.0.0';
const int reportLayoutSchemaVersion = 1;
const String reportLayoutAlgorithmVersion = '1.1.0';
const String reportLayoutRendererVersion = '2.1.0';

const Set<String> reportProfileIds = <String>{
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
};

const Map<String, Set<CaseTypeId>> _profileCaseTypes =
    <String, Set<CaseTypeId>>{
  'decision_memorandum': <CaseTypeId>{CaseTypeId.generalAdvisory},
  'evidence_schedule': <CaseTypeId>{
    CaseTypeId.generalAdvisory,
    CaseTypeId.litigationStrategy,
  },
  'option_comparison': <CaseTypeId>{CaseTypeId.generalAdvisory},
  'strategy_risk_report': <CaseTypeId>{CaseTypeId.litigationStrategy},
  'redline_risk_report': <CaseTypeId>{CaseTypeId.contractReview},
  'obligation_matrix': <CaseTypeId>{CaseTypeId.contractReview},
  'tax_position_memorandum': <CaseTypeId>{
    CaseTypeId.taxPlanning,
    CaseTypeId.taxCompliance,
  },
  'economic_assessment': <CaseTypeId>{
    CaseTypeId.taxPlanning,
    CaseTypeId.taxCompliance,
  },
  'gap_remediation_plan': <CaseTypeId>{CaseTypeId.compliance},
  'control_matrix': <CaseTypeId>{CaseTypeId.compliance},
  'compliance_schedule': <CaseTypeId>{CaseTypeId.taxCompliance},
  'solution_design': <CaseTypeId>{CaseTypeId.erpIncident},
  'root_cause_brief': <CaseTypeId>{CaseTypeId.erpIncident},
  'test_pack': <CaseTypeId>{CaseTypeId.erpIncident},
  'findings_chronology_report': <CaseTypeId>{CaseTypeId.investigation},
  'evidence_inventory': <CaseTypeId>{CaseTypeId.investigation},
  'playable_scenario': <CaseTypeId>{CaseTypeId.trainingSimulation},
  'facilitator_guide': <CaseTypeId>{CaseTypeId.trainingSimulation},
  'route_coverage': <CaseTypeId>{CaseTypeId.trainingSimulation},
};

const Map<String, String> _profileKinds = <String, String>{
  'decision_memorandum': 'legal_advisory',
  'evidence_schedule': 'evidence_schedule',
  'option_comparison': 'option_comparison',
  'strategy_risk_report': 'litigation_strategy',
  'redline_risk_report': 'contract_review',
  'obligation_matrix': 'obligation_matrix',
  'tax_position_memorandum': 'tax_planning',
  'economic_assessment': 'economic_assessment',
  'gap_remediation_plan': 'compliance',
  'control_matrix': 'control_matrix',
  'compliance_schedule': 'compliance_schedule',
  'solution_design': 'erp_incident',
  'root_cause_brief': 'root_cause',
  'test_pack': 'test_pack',
  'findings_chronology_report': 'investigation',
  'evidence_inventory': 'evidence_inventory',
  'playable_scenario': 'training_simulation',
  'facilitator_guide': 'facilitator_debrief',
  'route_coverage': 'route_coverage',
};

const Map<String, List<String>> _profileSections = <String, List<String>>{
  'decision_memorandum': <String>[
    'executive_summary',
    'issues',
    'facts_evidence',
    'authorities',
    'options',
    'recommendation',
    'sources',
    'approval',
  ],
  'evidence_schedule': <String>[
    'executive_summary',
    'facts_evidence',
    'chronology',
    'sources',
    'custody',
    'approval',
  ],
  'option_comparison': <String>[
    'executive_summary',
    'issues',
    'options',
    'economics',
    'recommendation',
    'approval',
  ],
  'strategy_risk_report': <String>[
    'executive_summary',
    'issues',
    'chronology',
    'facts_evidence',
    'authorities',
    'options',
    'risk_scenarios',
    'recommendation',
    'approval',
  ],
  'redline_risk_report': <String>[
    'executive_summary',
    'issues',
    'obligations',
    'risk_scenarios',
    'options',
    'recommendation',
    'approval',
  ],
  'obligation_matrix': <String>[
    'executive_summary',
    'obligations',
    'deadlines',
    'risk_scenarios',
    'approval',
  ],
  'tax_position_memorandum': <String>[
    'executive_summary',
    'facts_evidence',
    'authorities',
    'economics',
    'options',
    'tax_position',
    'sources',
    'approval',
  ],
  'economic_assessment': <String>[
    'executive_summary',
    'economics',
    'risk_scenarios',
    'options',
    'approval',
  ],
  'gap_remediation_plan': <String>[
    'executive_summary',
    'controls',
    'gaps',
    'remediation',
    'deadlines',
    'approval',
  ],
  'control_matrix': <String>[
    'executive_summary',
    'controls',
    'gaps',
    'facts_evidence',
    'approval',
  ],
  'compliance_schedule': <String>[
    'executive_summary',
    'authorities',
    'controls',
    'deadlines',
    'sources',
    'approval',
  ],
  'solution_design': <String>[
    'executive_summary',
    'chronology',
    'root_cause',
    'process_design',
    'controls',
    'test_plan',
    'approval',
  ],
  'root_cause_brief': <String>[
    'executive_summary',
    'chronology',
    'facts_evidence',
    'root_cause',
    'remediation',
    'approval',
  ],
  'test_pack': <String>[
    'executive_summary',
    'process_design',
    'test_plan',
    'expected_results',
    'approval',
  ],
  'findings_chronology_report': <String>[
    'executive_summary',
    'chronology',
    'actors',
    'facts_evidence',
    'findings',
    'custody',
    'approval',
  ],
  'evidence_inventory': <String>[
    'executive_summary',
    'facts_evidence',
    'chronology',
    'custody',
    'redactions',
    'approval',
  ],
  'playable_scenario': <String>[
    'executive_summary',
    'scenario_map',
    'routes',
    'expected_results',
    'approval',
  ],
  'facilitator_guide': <String>[
    'executive_summary',
    'learning_objectives',
    'scenario_map',
    'facilitation',
    'debrief',
    'routes',
    'approval',
  ],
  'route_coverage': <String>[
    'executive_summary',
    'routes',
    'expected_results',
    'approval',
  ],
};

Map<String, dynamic> _jsonObject(Object? source, String message) {
  if (source is! Map<String, dynamic>) {
    throw FormatException(message);
  }
  return source;
}

List<String> _stringList(Object? source, String message) {
  if (source is! List<dynamic> ||
      source.any((Object? item) => item is! String)) {
    throw FormatException(message);
  }
  return List<String>.unmodifiable(source.cast<String>());
}

bool _sameSet<T>(Iterable<T> left, Iterable<T> right) {
  final Set<T> leftSet = left.toSet();
  final Set<T> rightSet = right.toSet();
  return leftSet.length == rightSet.length && leftSet.containsAll(rightSet);
}

bool _sameList<T>(List<T> left, List<T> right) {
  if (left.length != right.length) {
    return false;
  }
  for (int index = 0; index < left.length; index += 1) {
    if (left[index] != right[index]) {
      return false;
    }
  }
  return true;
}

final class ReportProfile {
  const ReportProfile._({
    required this.id,
    required this.kind,
    required this.caseTypes,
    required this.sections,
  });

  factory ReportProfile.fromJson(Object? source) {
    final Map<String, dynamic> root = _jsonObject(
      source,
      'Invalid report profile.',
    );
    final Object? idSource = root['id'];
    final Object? kindSource = root['kind'];
    if (idSource is! String ||
        !reportProfileIds.contains(idSource) ||
        kindSource is! String ||
        kindSource != _profileKinds[idSource]) {
      throw const FormatException('Unknown report profile.');
    }
    final List<String> caseTypeIds = _stringList(
      root['caseTypes'],
      'Invalid report-profile case types.',
    );
    final List<CaseTypeId> caseTypes =
        caseTypeIds.map(CaseTypeId.parse).toList(growable: false);
    final Set<CaseTypeId> expectedCaseTypes = _profileCaseTypes[idSource]!;
    if (caseTypes.isEmpty ||
        caseTypes.toSet().length != caseTypes.length ||
        !_sameSet(caseTypes, expectedCaseTypes)) {
      throw const FormatException('Unsupported report-profile binding.');
    }
    final List<String> sections = _stringList(
      root['sections'],
      'Invalid report-profile sections.',
    );
    if (!_sameList(sections, _profileSections[idSource]!)) {
      throw const FormatException('Unsupported report-profile sections.');
    }
    return ReportProfile._(
      id: idSource,
      kind: kindSource,
      caseTypes: List<CaseTypeId>.unmodifiable(caseTypes),
      sections: sections,
    );
  }

  final String id;
  final String kind;
  final List<CaseTypeId> caseTypes;
  final List<String> sections;
}

final class ReportProfileRegistry {
  const ReportProfileRegistry._(this.profiles);

  factory ReportProfileRegistry.fromJson(Object? source) {
    final Map<String, dynamic> root = _jsonObject(
      source,
      'Missing report-profile registry.',
    );
    if (root['format'] != 'genesis-juris-report-profile-registry' ||
        root['schemaVersion'] != reportProfileSchemaVersion ||
        root['registry'] != reportProfileRegistryId ||
        root['rendererVersion'] != reportSemanticRendererVersion ||
        root['profiles'] is! List<dynamic>) {
      throw const FormatException('Unsupported report-profile registry.');
    }
    final List<ReportProfile> profiles = (root['profiles'] as List<dynamic>)
        .map(ReportProfile.fromJson)
        .toList(growable: false);
    final Set<String> ids =
        profiles.map((ReportProfile profile) => profile.id).toSet();
    if (profiles.length != reportProfileIds.length ||
        ids.length != profiles.length ||
        !_sameSet(ids, reportProfileIds)) {
      throw const FormatException('Report-profile coverage is incomplete.');
    }
    return ReportProfileRegistry._(List<ReportProfile>.unmodifiable(profiles));
  }

  final List<ReportProfile> profiles;

  ReportProfile forId(String id) {
    if (!reportProfileIds.contains(id)) {
      throw const FormatException('Unknown report profile.');
    }
    return profiles.firstWhere((ReportProfile profile) => profile.id == id);
  }
}

final class ReportManifestOutput {
  const ReportManifestOutput._({
    required this.caseType,
    required this.profileId,
    required this.primary,
  });

  factory ReportManifestOutput.fromJson(Object? source) {
    final Map<String, dynamic> root = _jsonObject(
      source,
      'Invalid report-manifest output.',
    );
    final Object? profileId = root['profileId'];
    if (profileId is! String ||
        !reportProfileIds.contains(profileId) ||
        root['primary'] is! bool) {
      throw const FormatException('Unsupported report-manifest output.');
    }
    return ReportManifestOutput._(
      caseType: CaseTypeReference.fromJson(root['caseType']),
      profileId: profileId,
      primary: root['primary'] as bool,
    );
  }

  final CaseTypeReference caseType;
  final String profileId;
  final bool primary;

  String get bindingKey => '${caseType.id.wireName}:$profileId';
}

final class ReportManifest {
  const ReportManifest._(this.outputs);

  factory ReportManifest.fromJson(
    Object? source, {
    required ReportProfileRegistry profiles,
    required CaseTypePlaybookRegistry playbooks,
  }) {
    final Map<String, dynamic> root = _jsonObject(
      source,
      'Missing report manifest.',
    );
    if (root['format'] != reportManifestId ||
        root['schemaVersion'] != reportManifestSchemaVersion ||
        root['manifest'] != reportManifestId ||
        root['outputs'] is! List<dynamic>) {
      throw const FormatException('Unsupported report manifest.');
    }
    final Map<String, dynamic> reportModel = _jsonObject(
      root['reportModel'],
      'Missing ReportModel reference.',
    );
    if (reportModel['schemaVersion'] != reportModelSchemaVersion) {
      throw const FormatException('Unsupported ReportModel schema.');
    }
    final Map<String, dynamic> semanticRenderer = _jsonObject(
      root['semanticRenderer'],
      'Missing semantic renderer reference.',
    );
    if (semanticRenderer['profileRegistry'] != reportProfileRegistryId ||
        semanticRenderer['profileSchemaVersion'] !=
            reportProfileSchemaVersion ||
        semanticRenderer['rendererVersion'] != reportSemanticRendererVersion) {
      throw const FormatException('Unsupported semantic renderer.');
    }
    final Map<String, dynamic> layout = _jsonObject(
      root['layout'],
      'Missing layout renderer reference.',
    );
    if (layout['scope'] != 'presentation_only' ||
        layout['layoutSchemaVersion'] != reportLayoutSchemaVersion ||
        layout['layoutAlgorithmVersion'] != reportLayoutAlgorithmVersion ||
        layout['layoutRendererVersion'] != reportLayoutRendererVersion) {
      throw const FormatException('Unsupported report layout contract.');
    }

    final List<ReportManifestOutput> outputs =
        (root['outputs'] as List<dynamic>)
            .map(ReportManifestOutput.fromJson)
            .toList(growable: false);
    final Map<String, bool> declared = <String, bool>{};
    for (final ReportManifestOutput output in outputs) {
      if (declared.containsKey(output.bindingKey)) {
        throw const FormatException('Duplicate report-manifest output.');
      }
      final ReportProfile profile = profiles.forId(output.profileId);
      if (!profile.caseTypes.contains(output.caseType.id)) {
        throw const FormatException('Invalid report-profile binding.');
      }
      declared[output.bindingKey] = output.primary;
    }

    final Map<String, bool> expected = <String, bool>{};
    for (final CaseTypePlaybook playbook in playbooks.playbooks) {
      for (final CaseOutputProfile output in playbook.outputs) {
        final String key = '${playbook.caseType.wireName}:${output.id}';
        if (expected.containsKey(key)) {
          throw const FormatException('Duplicate playbook output.');
        }
        expected[key] = output.primary;
      }
    }
    if (declared.length != expected.length ||
        expected.entries.any(
          (MapEntry<String, bool> entry) => declared[entry.key] != entry.value,
        )) {
      throw const FormatException('Report-manifest coverage is incomplete.');
    }
    return ReportManifest._(List<ReportManifestOutput>.unmodifiable(outputs));
  }

  final List<ReportManifestOutput> outputs;

  ReportManifestOutput outputFor(CaseTypeId caseType, String profileId) {
    final String key = '${caseType.wireName}:$profileId';
    return outputs.firstWhere(
      (ReportManifestOutput output) => output.bindingKey == key,
      orElse: () =>
          throw const FormatException('Unknown report-manifest output.'),
    );
  }
}

final class ReportContract {
  const ReportContract._({required this.profiles, required this.manifest});

  factory ReportContract.fromJson({
    required Object? profileRegistry,
    required Object? manifest,
    required Object? playbookRegistry,
  }) {
    final ReportProfileRegistry profiles = ReportProfileRegistry.fromJson(
      profileRegistry,
    );
    final CaseTypePlaybookRegistry playbooks =
        CaseTypePlaybookRegistry.fromJson(playbookRegistry);
    return ReportContract._(
      profiles: profiles,
      manifest: ReportManifest.fromJson(
        manifest,
        profiles: profiles,
        playbooks: playbooks,
      ),
    );
  }

  final ReportProfileRegistry profiles;
  final ReportManifest manifest;
}
