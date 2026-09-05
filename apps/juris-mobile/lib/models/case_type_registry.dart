const String caseTypeRegistryId = 'genesis-juris-case-types';
const String caseTypeVersion = '1.0.0';

enum CaseTypeId {
  generalAdvisory('general_advisory'),
  litigationStrategy('litigation_strategy'),
  contractReview('contract_review'),
  taxPlanning('tax_planning'),
  compliance('compliance'),
  taxCompliance('tax_compliance'),
  erpIncident('erp_incident'),
  investigation('investigation'),
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
    summaryEn:
        'Structure issues, evidence, options and a reasoned recommendation.',
    summaryRu:
        'Структурируйте вопросы, доказательства, варианты и обоснованную рекомендацию.',
    outcomeEn: 'Decision memorandum',
    outcomeRu: 'Меморандум по решению',
  ),
  CaseTypeDefinition(
    id: CaseTypeId.litigationStrategy,
    workflowMode: 'adaptive',
    views: <StudioCaseViewId>[
      StudioCaseViewId.evidenceMap,
      StudioCaseViewId.timeline,
      StudioCaseViewId.decisionTable,
      StudioCaseViewId.taskPlan
    ],
    requiredReview: 'evidence_governance',
    labelEn: 'Litigation strategy',
    labelRu: 'Стратегия спора',
    summaryEn:
        'Connect claims, chronology, evidence, procedure, scenarios and deadlines.',
    summaryRu:
        'Свяжите требования, хронологию, доказательства, процедуру, сценарии и сроки.',
    outcomeEn: 'Strategy and risk report',
    outcomeRu: 'Отчёт о стратегии и рисках',
  ),
  CaseTypeDefinition(
    id: CaseTypeId.contractReview,
    workflowMode: 'decision',
    views: <StudioCaseViewId>[
      StudioCaseViewId.decisionTable,
      StudioCaseViewId.evidenceMap,
      StudioCaseViewId.taskPlan,
      StudioCaseViewId.timeline
    ],
    requiredReview: 'professional',
    labelEn: 'Contract review',
    labelRu: 'Проверка договора',
    summaryEn:
        'Map clauses, obligations, deviations, negotiation positions and residual risk.',
    summaryRu:
        'Сопоставьте условия, обязательства, отклонения, переговорные позиции и остаточный риск.',
    outcomeEn: 'Redline and risk report',
    outcomeRu: 'Отчёт по правкам и рискам',
  ),
  CaseTypeDefinition(
    id: CaseTypeId.taxPlanning,
    workflowMode: 'hybrid',
    views: <StudioCaseViewId>[
      StudioCaseViewId.issueMap,
      StudioCaseViewId.decisionTable,
      StudioCaseViewId.economics,
      StudioCaseViewId.timeline
    ],
    requiredReview: 'tax_governance',
    labelEn: 'Tax planning',
    labelRu: 'Налоговое планирование',
    summaryEn:
        'Compare lawful structures, current authorities, economics, substance and reporting obligations.',
    summaryRu:
        'Сравните законные структуры, актуальные источники, экономику, substance и отчётность.',
    outcomeEn: 'Tax position memorandum',
    outcomeRu: 'Меморандум по налоговой позиции',
  ),
  CaseTypeDefinition(
    id: CaseTypeId.compliance,
    workflowMode: 'process',
    views: <StudioCaseViewId>[
      StudioCaseViewId.taskPlan,
      StudioCaseViewId.decisionTable,
      StudioCaseViewId.evidenceMap,
      StudioCaseViewId.timeline
    ],
    requiredReview: 'evidence_governance',
    labelEn: 'Compliance assessment',
    labelRu: 'Compliance-оценка',
    summaryEn:
        'Map obligations to controls, evidence, exceptions, owners and remediation.',
    summaryRu:
        'Сопоставьте обязанности с контролями, доказательствами, исключениями, ответственными и исправлениями.',
    outcomeEn: 'Gap and remediation plan',
    outcomeRu: 'План устранения пробелов',
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
    summaryEn:
        'Compare lawful positions, economics, sources and reporting obligations.',
    summaryRu:
        'Сравните законные позиции, экономику, источники и обязанности по отчётности.',
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
    summaryEn:
        'Capture the process failure, root cause, controls, solution and test evidence.',
    summaryRu:
        'Зафиксируйте сбой процесса, первопричину, контроли, решение и тестовые доказательства.',
    outcomeEn: 'Solution design & test pack',
    outcomeRu: 'Проект решения и пакет тестов',
  ),
  CaseTypeDefinition(
    id: CaseTypeId.investigation,
    workflowMode: 'adaptive',
    views: <StudioCaseViewId>[
      StudioCaseViewId.evidenceMap,
      StudioCaseViewId.timeline,
      StudioCaseViewId.taskPlan,
      StudioCaseViewId.decisionTable
    ],
    requiredReview: 'evidence_governance',
    labelEn: 'Investigation',
    labelRu: 'Расследование',
    summaryEn:
        'Preserve evidence, actors, chronology, contradictions, findings and unresolved matters.',
    summaryRu:
        'Сохраните доказательства, участников, хронологию, противоречия, выводы и открытые вопросы.',
    outcomeEn: 'Findings and chronology report',
    outcomeRu: 'Отчёт о выводах и хронологии',
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
    summaryEn:
        'Build a deterministic branching route with decisions, pressure and outcomes.',
    summaryRu:
        'Создайте детерминированный ветвящийся маршрут с решениями, давлением и исходами.',
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
