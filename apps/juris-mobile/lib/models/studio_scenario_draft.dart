import 'dart:convert';

import 'case_type_registry.dart';

/// The six workflow stage IDs are shared with the web Guided Studio.
enum StudioWorkflowStage {
  describe('describe'),
  reviewAiDraft('review_ai_draft'),
  factsAssumptions('facts_assumptions'),
  caseMap('case_map'),
  runCompare('run_compare'),
  reportSave('report_save');

  const StudioWorkflowStage(this.wireName);

  final String wireName;

  static StudioWorkflowStage parse(String? value) {
    return values.firstWhere(
      (StudioWorkflowStage stage) => stage.wireName == value,
      orElse: () => StudioWorkflowStage.describe,
    );
  }
}

/// Flutter editing facade over the canonical Rust [ScenarioDefinition] JSON.
///
/// The mobile Studio never persists a second authoring format. Every edit is
/// applied directly to this scenario document, which is then parsed and
/// validated by Rust before it can be tested or exported.
final class StudioScenarioDraft {
  StudioScenarioDraft._(this._scenario);

  factory StudioScenarioDraft.blank() {
    return StudioScenarioDraft._(
      _starterScenario(
        caseTypeId: CaseTypeId.generalAdvisory,
        caseId: 'mobile_studio_case',
        title: '',
        jurisdiction: 'BE',
        role: 'Lead counsel',
        premise: '',
        facts: const <String>[],
      ),
    );
  }

  factory StudioScenarioDraft.guidedExample() {
    return StudioScenarioDraft._(
      _starterScenario(
        caseTypeId: CaseTypeId.trainingSimulation,
        caseId: 'supplier_transition_dispute',
        title: 'Supplier transition dispute',
        jurisdiction: 'BE',
        role: 'Lead commercial counsel',
        premise:
            'A client must respond to a critical supplier termination while '
            'preserving service continuity and its contractual remedies.',
        facts: const <String>[
          'The supplier sent a termination notice with immediate effect.',
          'The client depends on the service for daily operations.',
          'The contract contains notice and transition-assistance clauses.',
        ],
      ),
    );
  }

  factory StudioScenarioDraft.fromJson(Map<String, dynamic> source) {
    if (source['schema_version'] != '1.0' ||
        source['metadata'] is! Map<String, dynamic> ||
        source['jurisdiction'] is! Map<String, dynamic> ||
        source['stages'] is! List<dynamic> ||
        source['actions'] is! List<dynamic> ||
        source['outcomes'] is! List<dynamic>) {
      throw const FormatException(
        'Import must be a canonical ScenarioDefinition v1 document.',
      );
    }
    final Map<String, dynamic> metadata =
        source['metadata'] as Map<String, dynamic>;
    final Object? caseTypeSource = metadata['case_type'];
    if (caseTypeSource != null) {
      // Reject an unsupported package before the draft can be rendered or
      // persisted. Getters must never become the first import-validation gate.
      CaseTypeReference.fromJson(caseTypeSource);
    }
    return StudioScenarioDraft._(_cloneMap(source));
  }

  final Map<String, dynamic> _scenario;

  Map<String, dynamic> toJson() => _cloneMap(_scenario);

  String get caseId => _metadataString('id');
  CaseTypeReference get caseType {
    final Object? source =
        (_scenario['metadata'] as Map<String, dynamic>?)?['case_type'];
    return source == null
        ? const CaseTypeReference(CaseTypeId.generalAdvisory)
        : CaseTypeReference.fromJson(source);
  }

  String get title => _metadataString('title');
  String get premise => _metadataString('summary');
  String get version => _metadataString('content_version');
  String get jurisdiction =>
      (_scenario['jurisdiction'] as Map<String, dynamic>?)?['code']
          as String? ??
      '';
  String get role {
    final List<Map<String, dynamic>> actors = _objectList('actors');
    final Map<String, dynamic>? player = actors
        .where((Map<String, dynamic> actor) => actor['role'] == 'player')
        .firstOrNull;
    return player?['name'] as String? ?? '';
  }

  List<String> get facts => _objectList('facts')
      .map((Map<String, dynamic> fact) => fact['statement'] as String? ?? '')
      .toList(growable: false);

  List<Map<String, dynamic>> get stages => _objectList('stages');
  List<Map<String, dynamic>> get actions => _objectList('actions');
  int get actorCount => _objectList('actors').length;
  int get terminalStageCount => stages
      .where((Map<String, dynamic> stage) => stage['terminal'] == true)
      .length;

  bool get identityReady =>
      title.trim().isNotEmpty &&
      premise.trim().isNotEmpty &&
      jurisdiction.trim().isNotEmpty &&
      role.trim().isNotEmpty;
  bool get factsReady => facts.any((String fact) => fact.trim().isNotEmpty);
  bool get mapReady =>
      stages.length >= 2 &&
      actions.isNotEmpty &&
      stages.any((Map<String, dynamic> stage) => stage['terminal'] == true);

  StudioScenarioDraft updateIdentity({
    required String title,
    required String jurisdiction,
    required String role,
    required String premise,
  }) {
    final Map<String, dynamic> next = toJson();
    final Map<String, dynamic> metadata =
        next['metadata'] as Map<String, dynamic>;
    metadata['title'] = title;
    metadata['summary'] = premise;
    if (caseId == 'mobile_studio_case' || caseId.trim().isEmpty) {
      metadata['id'] = _slugify(title);
    }
    (next['jurisdiction'] as Map<String, dynamic>)['code'] =
        jurisdiction.trim().toUpperCase();
    final List<dynamic> actors = next['actors'] as List<dynamic>;
    for (final dynamic actor in actors) {
      if (actor is Map<String, dynamic> && actor['role'] == 'player') {
        actor['name'] = role;
      }
    }
    return StudioScenarioDraft._(next);
  }

  StudioScenarioDraft updateCaseType(CaseTypeId id) {
    final Map<String, dynamic> next = toJson();
    final Map<String, dynamic> metadata =
        next['metadata'] as Map<String, dynamic>;
    metadata['case_type'] = CaseTypeReference(id).toJson();
    return StudioScenarioDraft._(next);
  }

  StudioScenarioDraft updateFacts(List<String> values) {
    final Map<String, dynamic> next = toJson();
    next['facts'] = values.indexed
        .where(((int, String) item) => item.$2.trim().isNotEmpty)
        .map(((int, String) item) => <String, dynamic>{
              'id': 'fact_${item.$1 + 1}',
              'statement': item.$2.trim(),
              'initial_status': 'alleged',
              'related_actors': <String>['player'],
            })
        .toList(growable: false);
    return StudioScenarioDraft._(next);
  }

  StudioScenarioDraft updateStageTitle(int index, String title) {
    final Map<String, dynamic> next = toJson();
    final List<dynamic> items = next['stages'] as List<dynamic>;
    (items[index] as Map<String, dynamic>)['title'] = title;
    return StudioScenarioDraft._(next);
  }

  StudioScenarioDraft updateActionTitle(int index, String title) {
    final Map<String, dynamic> next = toJson();
    final List<dynamic> items = next['actions'] as List<dynamic>;
    (items[index] as Map<String, dynamic>)['title'] = title;
    return StudioScenarioDraft._(next);
  }

  String _metadataString(String key) {
    return (_scenario['metadata'] as Map<String, dynamic>?)?[key] as String? ??
        '';
  }

  List<Map<String, dynamic>> _objectList(String key) {
    final dynamic value = _scenario[key];
    if (value is! List<dynamic>) {
      return const <Map<String, dynamic>>[];
    }
    return value.whereType<Map<String, dynamic>>().toList(growable: false);
  }
}

Map<String, dynamic> _starterScenario({
  required CaseTypeId caseTypeId,
  required String caseId,
  required String title,
  required String jurisdiction,
  required String role,
  required String premise,
  required List<String> facts,
}) {
  return <String, dynamic>{
    'schema_version': '1.0',
    'metadata': <String, dynamic>{
      'id': caseId,
      'title': title,
      'summary': premise,
      'content_version': '1',
      'case_type': CaseTypeReference(caseTypeId).toJson(),
      'author': 'Mobile Guided Studio',
      'tags': <String>['guided_studio', 'mobile_parity'],
    },
    'jurisdiction': <String, dynamic>{
      'code': jurisdiction,
      'pack_version': 'studio-1',
    },
    'initial_stage': 'intake',
    'actors': <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 'player',
        'name': role,
        'role': 'player',
        'description': 'The professional responsible for this matter.',
      },
    ],
    'facts': facts.indexed
        .map(((int, String) item) => <String, dynamic>{
              'id': 'fact_${item.$1 + 1}',
              'statement': item.$2,
              'initial_status': 'alleged',
              'related_actors': <String>['player'],
            })
        .toList(growable: false),
    'stages': <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 'intake',
        'title': 'Understand the matter',
        'kind': 'standard',
        'exit_actions': <String>['assess_case'],
      },
      <String, dynamic>{
        'id': 'strategy',
        'title': 'Choose the response',
        'kind': 'standard',
        'exit_actions': <String>['close_case'],
      },
      <String, dynamic>{
        'id': 'resolved',
        'title': 'Matter resolved',
        'kind': 'resolved',
        'terminal': true,
      },
    ],
    'actions': <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 'assess_case',
        'title': 'Assess facts and options',
        'description':
            'Review the known facts and select a proportionate path.',
        'available_when': <String, dynamic>{
          'type': 'stage_is',
          'stage': 'intake',
        },
        'effects': <Map<String, dynamic>>[
          <String, dynamic>{'type': 'set_stage', 'stage': 'strategy'},
        ],
        'time_cost_minutes': 60,
        'billable_minutes': 60,
      },
      <String, dynamic>{
        'id': 'close_case',
        'title': 'Execute the selected response',
        'description': 'Carry out the response and record the result.',
        'available_when': <String, dynamic>{
          'type': 'stage_is',
          'stage': 'strategy',
        },
        'effects': <Map<String, dynamic>>[
          <String, dynamic>{'type': 'set_stage', 'stage': 'resolved'},
          <String, dynamic>{
            'type': 'trigger_event',
            'event': 'matter_closed',
          },
        ],
        'time_cost_minutes': 90,
        'billable_minutes': 90,
      },
    ],
    'events': <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 'matter_closed',
        'title': 'Matter closed',
        'kind': 'matter_closed',
        'trigger': <String, dynamic>{'type': 'by_effect'},
        'condition': <String, dynamic>{
          'type': 'stage_is',
          'stage': 'resolved',
        },
        'effects': <Map<String, dynamic>>[
          <String, dynamic>{
            'type': 'resolve_outcome',
            'outcome': 'guided_resolution',
          },
        ],
      },
    ],
    'outcomes': <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 'guided_resolution',
        'title': 'Reasoned resolution',
        'summary': 'The learner completed the authored legal route.',
        'terminal_stage': 'resolved',
        'condition': <String, dynamic>{
          'type': 'stage_is',
          'stage': 'resolved',
        },
      },
    ],
  };
}

Map<String, dynamic> _cloneMap(Map<String, dynamic> source) {
  return jsonDecode(jsonEncode(source)) as Map<String, dynamic>;
}

String _slugify(String value) {
  final String slug = value
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
      .replaceAll(RegExp(r'^_+|_+$'), '');
  return slug.isEmpty
      ? 'mobile_studio_case'
      : slug.substring(0, slug.length > 64 ? 64 : slug.length);
}
