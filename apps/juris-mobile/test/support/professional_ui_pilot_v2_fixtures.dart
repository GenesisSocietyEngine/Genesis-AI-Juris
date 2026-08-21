import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/data/scenario_snapshot_mapper.dart';
import 'package:juris_mobile/living_case/living_case_visual_manifest.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest.dart';

const String professionalUiPilotV2GreenFireCaseId = 'greenfire_first_72_hours';
const String professionalUiPilotV2GoldenShellCaseId =
    'nl_food_safety_goldenshell_001';
const String professionalUiPilotV2RegulatorMessageId =
    'regulator_document_request';
const String professionalUiPilotV2SelectedEvidenceId = 'site_cctv';

/// Canonical content inputs shared by the V2 render matrix.
final class ProfessionalUiPilotV2Content {
  const ProfessionalUiPilotV2Content._({
    required this.bundle,
    required this.catalogueManifest,
    required this.livingCaseManifest,
    required this.greenFire,
  });

  static Future<ProfessionalUiPilotV2Content> load() async {
    final CaseCatalogBundle bundle = CaseCatalogBundle.fromJson(
      jsonDecode(
        await rootBundle.loadString(
          'assets/case_catalog/mobile_case_bundle.json',
        ),
      ) as Map<String, dynamic>,
    );
    final CaseVisualManifest catalogueManifest = CaseVisualManifest.fromJson(
      jsonDecode(
        await rootBundle.loadString(
          'assets/visual_identity/case_visual_manifest.v1.json',
        ),
      ) as Map<String, dynamic>,
    );
    final LivingCaseVisualManifest livingCaseManifest =
        LivingCaseVisualManifest.fromJson(
      jsonDecode(
        await rootBundle.loadString(
          'assets/visual_identity/living_case_visual_manifest.v1.json',
        ),
      ) as Map<String, dynamic>,
    );
    final MobileCaseDefinition greenFire = bundle.cases.singleWhere(
      (MobileCaseDefinition item) =>
          item.caseId == professionalUiPilotV2GreenFireCaseId,
    );
    return ProfessionalUiPilotV2Content._(
      bundle: bundle,
      catalogueManifest: catalogueManifest,
      livingCaseManifest: livingCaseManifest,
      greenFire: greenFire,
    );
  }

  final CaseCatalogBundle bundle;
  final CaseVisualManifest catalogueManifest;
  final LivingCaseVisualManifest livingCaseManifest;
  final MobileCaseDefinition greenFire;
}

/// Builds immutable Flutter snapshots from authoritative-shaped Rust maps.
///
/// Text and projection entities are read from the bundled GreenFire 0.2.0
/// definition and pass through the production [ScenarioSnapshotMapper]. The
/// active state corresponds to this genuine route:
///
/// 1. `accept_emergency_mandate` (minute 30);
/// 2. `run_conflict_assessment` (minute 90);
/// 3. `open_controlled_regulator_channel` (minute 150).
///
/// The regulator event fires at minute 120 during that route. At minute 150
/// the projection truthfully contains four unresolved required messages, six
/// global decisions, and two regulator-response decisions.
final class ProfessionalUiPilotV2Fixtures {
  const ProfessionalUiPilotV2Fixtures(this.definition);

  final MobileCaseDefinition definition;

  GameSnapshot inactive({required String locale}) => ScenarioSnapshotMapper.map(
        source: _inactiveProjection(),
        caseDefinition: definition,
        locale: locale,
      );

  GameSnapshot active({required String locale}) => ScenarioSnapshotMapper.map(
        source: _activeProjection(),
        caseDefinition: definition,
        locale: locale,
      );

  Map<String, dynamic> _inactiveProjection() {
    const List<String> inboxIds = <String>[
      'managing_director_emergency_call',
      'legal_hold_required',
      'insurance_notice_required',
    ];
    const List<String> actionIds = <String>['accept_emergency_mandate'];
    const List<String> deadlineIds = <String>[
      'legal_hold_deadline',
      'insurance_notice_deadline',
    ];
    return _projection(
      stageId: 'emergency_intake',
      clockMinutes: 0,
      inbox: inboxIds
          .map((String id) => _inboxProjection(id, resolved: false))
          .toList(growable: false),
      actionIds: actionIds,
      deadlineIds: deadlineIds,
    );
  }

  Map<String, dynamic> _activeProjection() {
    const List<String> actionIds = <String>[
      'issue_legal_hold',
      'appoint_separate_director_counsel',
      'notify_insurers',
      'retain_independent_fire_expert',
      'submit_initial_regulatory_response',
      'release_unreviewed_documents',
    ];
    const List<String> deadlineIds = <String>[
      'legal_hold_deadline',
      'insurance_notice_deadline',
      'initial_regulatory_response_deadline',
    ];
    return _projection(
      stageId: 'immediate_response',
      clockMinutes: 150,
      inbox: <Map<String, dynamic>>[
        _inboxProjection('managing_director_emergency_call', resolved: true),
        _inboxProjection('legal_hold_required', resolved: false),
        _inboxProjection('insurance_notice_required', resolved: false),
        _inboxProjection('separate_counsel_decision', resolved: false),
        _inboxProjection(
          professionalUiPilotV2RegulatorMessageId,
          resolved: false,
        ),
      ],
      actionIds: actionIds,
      deadlineIds: deadlineIds,
      pressureAndCountermove: const <String, dynamic>{
        'projection_schema_version': 1,
        'active_pressures': <Map<String, dynamic>>[
          <String, dynamic>{
            'pressure_id': 'regulator_document_request_pressure',
            'source_actor_id': 'port_haven_environment_authority',
            'due_at_minute': 2160,
            'remaining_minutes': 2010,
            'available_response_action_ids': <String>[
              'submit_initial_regulatory_response',
              'release_unreviewed_documents',
            ],
          },
        ],
      },
    );
  }

  Map<String, dynamic> _projection({
    required String stageId,
    required int clockMinutes,
    required List<Map<String, dynamic>> inbox,
    required List<String> actionIds,
    required List<String> deadlineIds,
    Map<String, dynamic>? pressureAndCountermove,
  }) {
    final List<Map<String, dynamic>> availableActions =
        actionIds.map(_actionProjection).toList(growable: false);
    final Set<String> availableActionIds = actionIds.toSet();
    const List<Map<String, dynamic>> facts = <Map<String, dynamic>>[];
    final List<Map<String, dynamic>> evidence = _initialEvidence();
    final List<Map<String, dynamic>> dossierEvidence = _initialEvidence()
      ..sort(
        (Map<String, dynamic> left, Map<String, dynamic> right) =>
            (left['id'] as String).compareTo(right['id'] as String),
      );
    final List<Map<String, dynamic>> deadlines = deadlineIds
        .map(
          (String id) => _deadlineProjection(
            id,
            availableActionIds: availableActionIds,
          ),
        )
        .toList(growable: false);
    final Map<String, dynamic> stage = _entry('stages', stageId);
    return <String, dynamic>{
      'snapshot_schema_version': 1,
      'scenario_id': definition.scenarioId,
      'seed': definition.seed,
      'stage_id': stageId,
      'stage_title': stage['title'] as String,
      'clock_minutes': clockMinutes,
      'clock_mode': 'foreground',
      'judicial_result': null,
      'judicial_decision_instance': null,
      'matter_lifecycle': 'active',
      'is_closed': false,
      'resolved_outcome': null,
      'terminal': false,
      'flags': const <String, bool>{},
      'facts': facts,
      'evidence': evidence,
      'deadlines': deadlines,
      'inbox': inbox,
      'available_actions': availableActions,
      // Rust keeps fired-event identifiers diagnostic-only and always emits
      // an empty player projection for this stable response field.
      'fired_event_ids': const <String>[],
      'outcome': null,
      if (pressureAndCountermove != null)
        'pressure_and_countermove': pressureAndCountermove,
      'dossier': <String, dynamic>{
        'projection_schema_version': 1,
        'procedure': <String, dynamic>{
          'stage_id': stageId,
          'stage_title': stage['title'] as String,
          'clock_minutes': clockMinutes,
          'matter_lifecycle': 'active',
          'is_closed': false,
          'matter_status': 'open',
        },
        'judicial_result': null,
        'judicial_decision_instance': null,
        'facts': facts,
        'evidence': dossierEvidence,
        'deadlines': deadlines,
        'outcome': null,
      },
    };
  }

  Map<String, dynamic> _actionProjection(String id) {
    final Map<String, dynamic> action = _entry('actions', id);
    return <String, dynamic>{
      'id': id,
      'title': action['title'] as String,
      if (action['description'] case final String description)
        'description': description,
      'time_cost_minutes': action['time_cost_minutes'] as int,
      'cost_eur': action['cost_eur'] is int ? action['cost_eur'] as int : 0,
      if (action['presentation_tags'] case final List<dynamic> tags)
        'presentation_tags': List<String>.unmodifiable(tags.cast<String>()),
    };
  }

  Map<String, dynamic> _inboxProjection(
    String id, {
    required bool resolved,
  }) {
    final Map<String, dynamic> item = _entry('inbox_items', id);
    return <String, dynamic>{
      'id': id,
      if (item['sender'] case final String sender) 'sender': sender,
      'subject': item['subject'] as String,
      'body': item['body'] as String,
      'visible': true,
      'resolved': resolved,
      'action_required': item['action_required'] as bool,
      'resolution_action_ids': _stringList(item['resolution_actions']),
    };
  }

  List<Map<String, dynamic>> _initialEvidence() {
    const List<String> evidenceIds = <String>[
      'site_cctv',
      'dangerous_goods_manifest',
      'permit_site_plan',
      'safety_coordinator_email',
      'insurance_policy_bundle',
      'fire_service_runoff_map',
    ];
    return evidenceIds.map(_evidenceProjection).toList(growable: false);
  }

  Map<String, dynamic> _evidenceProjection(String id) {
    final Map<String, dynamic> item = _entry('evidence', id);
    return <String, dynamic>{
      'id': id,
      'title': item['title'] as String,
      'kind': item['kind'] as String,
      if (item['description'] case final String description)
        'description': description,
      'available': true,
      // The genuine minute-150 route has not reviewed the expert assessment,
      // so every authored fact remains unknown. Rust hides unknown facts and
      // filters their IDs out of the player-visible Dossier projection.
      'supports_fact_ids': const <String>[],
      'contradicts_fact_ids': const <String>[],
    };
  }

  Map<String, dynamic> _deadlineProjection(
    String id, {
    required Set<String> availableActionIds,
  }) {
    final Map<String, dynamic> item = _entry('deadlines', id);
    final Map<String, dynamic> dueAt = item['due_at'] as Map<String, dynamic>;
    final List<String> completionActionIds = _stringList(
      item['completion_actions'],
    );
    return <String, dynamic>{
      'id': id,
      'title': item['title'] as String,
      'due_at_minutes':
          (dueAt['day'] as int) * 24 * 60 + (dueAt['minute_of_day'] as int),
      'status': 'open',
      'completion_action_ids': completionActionIds,
      'remedies': completionActionIds
          .where(availableActionIds.contains)
          .map(_remedyProjection)
          .toList(growable: false),
    };
  }

  Map<String, dynamic> _remedyProjection(String actionId) {
    final Map<String, dynamic> action = _entry('actions', actionId);
    return <String, dynamic>{
      'action_id': actionId,
      'title': action['title'] as String,
      if (action['description'] case final String description)
        'description': description,
      'time_cost_minutes': action['time_cost_minutes'] as int,
      'cost_eur': action['cost_eur'] is int ? action['cost_eur'] as int : 0,
    };
  }

  Map<String, dynamic> _entry(String section, String id) {
    final Map<String, dynamic>? scenario = definition.scenario;
    if (scenario == null) {
      throw StateError('${definition.caseId} has no bundled scenario');
    }
    final Object? rawSection = scenario[section];
    if (rawSection is! List<dynamic>) {
      throw StateError('${definition.caseId} has no `$section` list');
    }
    for (final Object? rawItem in rawSection) {
      if (rawItem is Map<String, dynamic> && rawItem['id'] == id) {
        return rawItem;
      }
    }
    throw StateError('${definition.caseId}.$section has no `$id`');
  }
}

List<String> _stringList(Object? value) {
  if (value == null) {
    return const <String>[];
  }
  if (value is! List<dynamic>) {
    throw FormatException('Expected a string list, got ${value.runtimeType}');
  }
  return List<String>.unmodifiable(value.cast<String>());
}

/// Non-mutating repository boundary used only by deterministic V2 renders.
final class ProfessionalUiPilotV2Repository extends GameRuntimeRepository {
  ProfessionalUiPilotV2Repository(this._snapshot);

  final GameSnapshot _snapshot;

  @override
  GameSnapshot get snapshot => _snapshot;

  @override
  bool get isTerminal => _snapshot.isClosed;

  @override
  bool get supportsLiveClock => true;

  @override
  String? get clockErrorMessage => null;

  @override
  void advanceTimeByMinutes(int minutes) {
    throw StateError('A V2 golden attempted to advance authoritative time.');
  }

  @override
  ActionExecutionResult applyAction(String actionId) {
    throw StateError('A V2 golden attempted to dispatch `$actionId`.');
  }

  @override
  void markInboxItemRead(String itemId) {
    if (!_snapshot.inbox.any((InboxItemView item) => item.id == itemId)) {
      throw ArgumentError.value(itemId, 'itemId', 'Unknown projected message');
    }
    // Every message opened by the V2 interaction states is action-required.
    // Rust keeps that status until its mapped response is completed.
  }

  @override
  void reset() {
    throw StateError('A V2 golden attempted to reset authoritative state.');
  }
}
