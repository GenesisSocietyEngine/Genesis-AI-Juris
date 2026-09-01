import 'case_type_registry.dart';
import 'studio_scenario_draft.dart';

const String caseTypePlaybookRegistryId = 'genesis-juris-case-playbooks';
const String caseTypePlaybookAsset =
    'assets/case_types/case_type_playbooks.v1.json';

final class LocalizedText {
  const LocalizedText({required this.en, required this.ru});

  factory LocalizedText.fromJson(Object? source) {
    if (source is! Map<String, dynamic> ||
        source['en'] is! String ||
        source['ru'] is! String) {
      throw const FormatException('Invalid localized playbook text.');
    }
    return LocalizedText(
        en: source['en'] as String, ru: source['ru'] as String);
  }

  final String en;
  final String ru;

  String forLocale(String locale) => locale == 'ru' ? ru : en;
}

final class CaseIntakeQuestion {
  const CaseIntakeQuestion({
    required this.id,
    required this.label,
    required this.hint,
  });

  factory CaseIntakeQuestion.fromJson(Object? source) {
    if (source is! Map<String, dynamic> || source['id'] is! String) {
      throw const FormatException('Invalid intake question.');
    }
    return CaseIntakeQuestion(
      id: source['id'] as String,
      label: LocalizedText.fromJson(source['label']),
      hint: LocalizedText.fromJson(source['hint']),
    );
  }

  final String id;
  final LocalizedText label;
  final LocalizedText hint;
}

final class CaseOutputProfile {
  const CaseOutputProfile({
    required this.id,
    required this.label,
    required this.description,
    required this.primary,
  });

  factory CaseOutputProfile.fromJson(Object? source) {
    if (source is! Map<String, dynamic> ||
        source['id'] is! String ||
        source['primary'] is! bool) {
      throw const FormatException('Invalid output profile.');
    }
    return CaseOutputProfile(
      id: source['id'] as String,
      label: LocalizedText.fromJson(source['label']),
      description: LocalizedText.fromJson(source['description']),
      primary: source['primary'] as bool,
    );
  }

  final String id;
  final LocalizedText label;
  final LocalizedText description;
  final bool primary;
}

final class CanonicalCaseRequirements {
  const CanonicalCaseRequirements({
    required this.minimumFacts,
    required this.minimumStages,
    required this.minimumActions,
    required this.minimumTerminalStages,
    required this.minimumActors,
    required this.requireLegalAsOfFact,
    required this.requireHttpsSourceFact,
    required this.requireComplianceFact,
  });

  factory CanonicalCaseRequirements.fromJson(Object? source) {
    if (source is! Map<String, dynamic>) {
      throw const FormatException('Missing canonical requirements.');
    }
    int count(String key) {
      final Object? value = source[key];
      if (value is! int || value < 0) {
        throw FormatException('Invalid canonical requirement: $key.');
      }
      return value;
    }

    bool flag(String key) {
      final Object? value = source[key];
      if (value is! bool) {
        throw FormatException('Invalid canonical requirement: $key.');
      }
      return value;
    }

    return CanonicalCaseRequirements(
      minimumFacts: count('minimumFacts'),
      minimumStages: count('minimumStages'),
      minimumActions: count('minimumActions'),
      minimumTerminalStages: count('minimumTerminalStages'),
      minimumActors: count('minimumActors'),
      requireLegalAsOfFact: flag('requireLegalAsOfFact'),
      requireHttpsSourceFact: flag('requireHttpsSourceFact'),
      requireComplianceFact: flag('requireComplianceFact'),
    );
  }

  final int minimumFacts;
  final int minimumStages;
  final int minimumActions;
  final int minimumTerminalStages;
  final int minimumActors;
  final bool requireLegalAsOfFact;
  final bool requireHttpsSourceFact;
  final bool requireComplianceFact;
}

final class CaseTestDefinition {
  const CaseTestDefinition({
    required this.mode,
    required this.label,
    required this.requiresPlayableRoute,
  });

  factory CaseTestDefinition.fromJson(Object? source) {
    if (source is! Map<String, dynamic> ||
        source['mode'] is! String ||
        source['requiresPlayableRoute'] is! bool) {
      throw const FormatException('Invalid test definition.');
    }
    return CaseTestDefinition(
      mode: source['mode'] as String,
      label: LocalizedText.fromJson(source['label']),
      requiresPlayableRoute: source['requiresPlayableRoute'] as bool,
    );
  }

  final String mode;
  final LocalizedText label;
  final bool requiresPlayableRoute;
}

final class CaseTypePlaybook {
  const CaseTypePlaybook({
    required this.caseType,
    required this.label,
    required this.summary,
    required this.primaryOutcome,
    required this.aiFocus,
    required this.intakeQuestions,
    required this.test,
    required this.canonicalRequirements,
    required this.outputs,
  });

  factory CaseTypePlaybook.fromJson(Object? source) {
    if (source is! Map<String, dynamic> ||
        source['caseType'] is! Map<String, dynamic> ||
        source['intakeQuestions'] is! List<dynamic> ||
        source['outputs'] is! List<dynamic>) {
      throw const FormatException('Invalid case-type playbook.');
    }
    final Map<String, dynamic> reference =
        source['caseType'] as Map<String, dynamic>;
    if (reference['id'] is! String || reference['version'] != caseTypeVersion) {
      throw const FormatException('Unsupported playbook case type.');
    }
    final List<CaseIntakeQuestion> questions =
        (source['intakeQuestions'] as List<dynamic>)
            .map(CaseIntakeQuestion.fromJson)
            .toList(growable: false);
    final List<CaseOutputProfile> outputs = (source['outputs'] as List<dynamic>)
        .map(CaseOutputProfile.fromJson)
        .toList(growable: false);
    if (questions.isEmpty ||
        outputs.isEmpty ||
        outputs.where((CaseOutputProfile item) => item.primary).length != 1) {
      throw const FormatException('Playbook content is incomplete.');
    }
    return CaseTypePlaybook(
      caseType: CaseTypeId.parse(reference['id'] as String),
      label: LocalizedText.fromJson(source['label']),
      summary: LocalizedText.fromJson(source['summary']),
      primaryOutcome: LocalizedText.fromJson(source['primaryOutcome']),
      aiFocus: LocalizedText.fromJson(source['aiFocus']),
      intakeQuestions: questions,
      test: CaseTestDefinition.fromJson(source['test']),
      canonicalRequirements:
          CanonicalCaseRequirements.fromJson(source['canonicalRequirements']),
      outputs: outputs,
    );
  }

  final CaseTypeId caseType;
  final LocalizedText label;
  final LocalizedText summary;
  final LocalizedText primaryOutcome;
  final LocalizedText aiFocus;
  final List<CaseIntakeQuestion> intakeQuestions;
  final CaseTestDefinition test;
  final CanonicalCaseRequirements canonicalRequirements;
  final List<CaseOutputProfile> outputs;
}

final class CaseTypePlaybookRegistry {
  CaseTypePlaybookRegistry._(this.playbooks);

  factory CaseTypePlaybookRegistry.fromJson(Object? source) {
    if (source is! Map<String, dynamic> ||
        source['format'] != 'genesis-juris-case-playbook-registry' ||
        source['schemaVersion'] != 1 ||
        source['registry'] != caseTypePlaybookRegistryId ||
        source['playbooks'] is! List<dynamic>) {
      throw const FormatException('Unsupported case-type playbook registry.');
    }
    final List<CaseTypePlaybook> playbooks =
        (source['playbooks'] as List<dynamic>)
            .map(CaseTypePlaybook.fromJson)
            .toList(growable: false);
    final Set<CaseTypeId> ids =
        playbooks.map((CaseTypePlaybook item) => item.caseType).toSet();
    if (playbooks.length != CaseTypeId.values.length ||
        ids.length != CaseTypeId.values.length) {
      throw const FormatException('Playbook registry coverage is incomplete.');
    }
    return CaseTypePlaybookRegistry._(playbooks);
  }

  final List<CaseTypePlaybook> playbooks;

  CaseTypePlaybook forCaseType(CaseTypeId id) =>
      playbooks.firstWhere((CaseTypePlaybook item) => item.caseType == id);
}

final class CasePackageEvaluation {
  const CasePackageEvaluation(this.missing);

  final List<String> missing;
  bool get complete => missing.isEmpty;
}

CasePackageEvaluation evaluateCanonicalCasePackage(
  CaseTypePlaybook playbook,
  StudioScenarioDraft draft,
) {
  final CanonicalCaseRequirements rules = playbook.canonicalRequirements;
  final List<String> missing = <String>[];
  final List<String> facts = draft.facts
      .map((String item) => item.trim())
      .where((String item) => item.isNotEmpty)
      .toList(growable: false);
  final String record = facts.join('\n').toLowerCase();
  if (!draft.identityReady) missing.add('identity');
  if (facts.length < rules.minimumFacts) missing.add('facts');
  if (draft.stages.length < rules.minimumStages) missing.add('stages');
  if (draft.actions.length < rules.minimumActions) missing.add('actions');
  if (draft.terminalStageCount < rules.minimumTerminalStages) {
    missing.add('terminal_stages');
  }
  if (draft.actorCount < rules.minimumActors) missing.add('actors');
  if (rules.requireLegalAsOfFact &&
      !RegExp(r'\b\d{4}-\d{2}-\d{2}\b').hasMatch(record)) {
    missing.add('legal_as_of');
  }
  if (rules.requireHttpsSourceFact && !record.contains('https://')) {
    missing.add('https_source');
  }
  final bool hasComplianceEvidence = <String>[
    'compliance',
    'reporting',
    'filing',
    'контрол',
    'отчёт',
    'отчет',
  ].any(record.contains);
  if (rules.requireComplianceFact && !hasComplianceEvidence) {
    missing.add('compliance');
  }
  return CasePackageEvaluation(List<String>.unmodifiable(missing));
}
