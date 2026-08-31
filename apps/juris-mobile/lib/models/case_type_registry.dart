const String caseTypeRegistryId = 'genesis-juris-case-types';
const String caseTypeVersion = '1.0.0';

enum CaseTypeId {
  generalAdvisory('general_advisory'),
  taxCompliance('tax_compliance'),
  erpIncident('erp_incident'),
  trainingSimulation('training_simulation');

  const CaseTypeId(this.wireName);

  final String wireName;

  static CaseTypeId parse(String value) {
    return values.firstWhere(
      (CaseTypeId item) => item.wireName == value,
      orElse: () => throw const FormatException('Unknown case type.'),
    );
  }
}

enum StudioCaseViewId {
  issueMap('issue_map'),
  evidenceMap('evidence_map'),
  decisionTable('decision_table'),
  taskPlan('task_plan'),
  timeline('timeline'),
  economics('economics'),
  simulation('simulation');

  const StudioCaseViewId(this.wireName);

  final String wireName;
}

final class CaseTypeReference {
  const CaseTypeReference(this.id);

  final CaseTypeId id;

  String get registry => caseTypeRegistryId;
  String get version => caseTypeVersion;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'registry': registry,
        'id': id.wireName,
        'version': version,
      };

  factory CaseTypeReference.fromJson(Object? source) {
    if (source is! Map<String, dynamic> ||
        source['registry'] != caseTypeRegistryId ||
        source['id'] is! String ||
        source['version'] != caseTypeVersion) {
      throw const FormatException('Unsupported case-type package.');
    }
    return CaseTypeReference(CaseTypeId.parse(source['id'] as String));
  }
}

final class CaseTypeDefinition {
  const CaseTypeDefinition({
    required this.id,
    required this.workflowMode,
    required this.views,
    required this.requiredReview,
    required this.labelEn,
    required this.labelRu,
    required this.summaryEn,
    required this.summaryRu,
    required this.outcomeEn,
    required this.outcomeRu,
  });

  final CaseTypeId id;
  final String workflowMode;
  final List<StudioCaseViewId> views;
  final String requiredReview;
  final String labelEn;
  final String labelRu;
  final String summaryEn;
  final String summaryRu;
  final String outcomeEn;
  final String outcomeRu;
}

const List<CaseTypeDefinition> caseTypeRegistry = <CaseTypeDefinition>[
  CaseTypeDefinition(
    id: CaseTypeId.generalAdvisory,
    workflowMode: 'hybrid',
    views: <StudioCaseViewId>[
      StudioCaseViewId.issueMap,
      StudioCaseViewId.evidenceMap,
      StudioCaseViewId.decisionTable,
      StudioCaseViewId.timeline,
    ],
    requiredReview: 'professional',
    labelEn: 'Advisory decision',
    labelRu: 'Консультационное решение',
    summaryEn: 'Structure issues, evidence, options and a reasoned recommendation.',
    summaryRu: 'Структурируйте вопросы, доказательства, варианты и обоснованную рекомендацию.',
    outcomeEn: 'Decision memorandum',
    outcomeRu: 'Меморандум по решению',
  ),
  CaseTypeDefinition(
    id: CaseTypeId.taxCompliance,
    workflowMode: 'hybrid',
    views: <StudioCaseViewId>[
      StudioCaseViewId.issueMap,
      StudioCaseViewId.decisionTable,
      StudioCaseViewId.economics,
      StudioCaseViewId.timeline,
    ],
    requiredReview: 'tax_governance',
    labelEn: 'Tax & compliance',
    labelRu: 'Налоги и compliance',
    summaryEn: 'Compare lawful positions, economics, sources and reporting obligations.',
    summaryRu: 'Сравните законные позиции, экономику, источники и обязанности по отчётности.',
    outcomeEn: 'Tax position memorandum',
    outcomeRu: 'Меморандум по налоговой позиции',
  ),
  CaseTypeDefinition(
    id: CaseTypeId.erpIncident,
    workflowMode: 'process',
    views: <StudioCaseViewId>[
      StudioCaseViewId.taskPlan,
      StudioCaseViewId.evidenceMap,
      StudioCaseViewId.decisionTable,
      StudioCaseViewId.timeline,
    ],
    requiredReview: 'professional',
    labelEn: 'ERP incident & solution',
    labelRu: 'ERP-инцидент и решение',
    summaryEn: 'Capture the process failure, root cause, controls, solution and test evidence.',
    summaryRu: 'Зафиксируйте сбой процесса, первопричину, контроли, решение и тестовые доказательства.',
    outcomeEn: 'Solution design & test pack',
    outcomeRu: 'Проект решения и пакет тестов',
  ),
  CaseTypeDefinition(
    id: CaseTypeId.trainingSimulation,
    workflowMode: 'simulation',
    views: <StudioCaseViewId>[
      StudioCaseViewId.simulation,
      StudioCaseViewId.timeline,
      StudioCaseViewId.evidenceMap,
    ],
    requiredReview: 'runtime_parity',
    labelEn: 'Training simulation',
    labelRu: 'Учебная симуляция',
    summaryEn: 'Build a deterministic branching route with decisions, pressure and outcomes.',
    summaryRu: 'Создайте детерминированный ветвящийся маршрут с решениями, давлением и исходами.',
    outcomeEn: 'Playable scenario',
    outcomeRu: 'Игровой сценарий',
  ),
];

CaseTypeDefinition caseTypeDefinition(CaseTypeId id) =>
    caseTypeRegistry.firstWhere((CaseTypeDefinition item) => item.id == id);

List<Map<String, dynamic>> caseTypeRegistrySignature() => caseTypeRegistry
    .map((CaseTypeDefinition item) => <String, dynamic>{
          'id': item.id.wireName,
          'version': caseTypeVersion,
          'workflowMode': item.workflowMode,
          'views': item.views
              .map((StudioCaseViewId view) => view.wireName)
              .toList(growable: false),
          'requiredReview': item.requiredReview,
        })
    .toList(growable: false);
