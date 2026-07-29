import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/rust_scenario_repository.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/models/case_catalog.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MobileCaseDefinition logistics;
  late MobileCaseDefinition greenfire;
  late MobileCaseDefinition goldenshell;

  setUpAll(() async {
    final String encoded = await rootBundle.loadString(
      'assets/case_catalog/mobile_case_bundle.json',
    );
    final CaseCatalogBundle bundle = CaseCatalogBundle.fromJson(
      jsonDecode(encoded) as Map<String, dynamic>,
    );
    logistics = bundle.cases.singleWhere(
      (MobileCaseDefinition item) =>
          item.caseId == 'be_commercial_logistics_001',
    );
    greenfire = bundle.cases.singleWhere(
      (MobileCaseDefinition item) => item.caseId == 'greenfire_first_72_hours',
    );
    goldenshell = bundle.cases.singleWhere(
      (MobileCaseDefinition item) =>
          item.caseId == 'nl_food_safety_goldenshell_001',
    );
  });

  test('maps and completes the negotiated Rust scenario path', () {
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: logistics,
      bridgeClient: _FakeScenarioBridgeClient(),
    );

    expect(repository.supportsLiveClock, isFalse);
    expect(repository.snapshot.stage, 'Claim intake');
    expect(repository.snapshot.matterTitle, contains('Velmont Logistics'));
    expect(repository.snapshot.evidence, hasLength(5));
    expect(repository.snapshot.actions.single.id, 'audit_claim_file');

    repository.applyAction('audit_claim_file');
    repository.applyAction('issue_formal_demand');
    repository.applyAction('accept_negotiated_payment');

    expect(repository.isTerminal, isTrue);
    expect(repository.snapshot.stage, 'Matter resolved');
    expect(
      repository.snapshot.outcomeSummary?.headline,
      'Negotiated recovery',
    );
    expect(repository.snapshot.actions, isEmpty);
    repository.dispose();
  });

  test('reset creates a new isolated session and judgment path completes', () {
    final _FakeScenarioBridgeClient client = _FakeScenarioBridgeClient();
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: logistics,
      bridgeClient: client,
    );

    repository.applyAction('audit_claim_file');
    repository.reset();
    expect(client.createCount, 2);
    expect(client.disposeCount, 1);
    expect(repository.snapshot.stage, 'Claim intake');

    repository.applyAction('audit_claim_file');
    repository.applyAction('issue_formal_demand');
    repository.applyAction('request_judgment');
    expect(repository.snapshot.stage, 'Post-judgment enforcement');
    repository.applyAction('enforce_judgment');

    expect(repository.isTerminal, isTrue);
    expect(
      repository.snapshot.outcomeSummary?.headline,
      'Judgment recovered and enforced',
    );
    expect(repository.snapshot.caseResultStatus.name, 'wonAtFirstInstance');
    repository.dispose();
    expect(client.disposeCount, 2);
  });

  test('creates GreenFire from its canonical bundled scenario and seed', () {
    final _FakeScenarioBridgeClient client = _FakeScenarioBridgeClient();
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: greenfire,
      bridgeClient: client,
    );

    expect(client.lastScenarioId, 'greenfire_first_72_hours');
    expect(client.lastSeed, 20260729);
    expect(client.lastActionCount, 14);
    expect(repository.snapshot.matterTitle, contains('GreenFire'));
    repository.dispose();
  });

  test('creates GoldenShell with its canonical opening action', () {
    final _FakeScenarioBridgeClient client = _FakeScenarioBridgeClient();
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: goldenshell,
      bridgeClient: client,
    );

    expect(client.lastScenarioId, 'goldenshell_recall_at_dawn');
    expect(client.lastSeed, 20260730);
    expect(client.lastActionCount, 18);
    expect(repository.snapshot.matterTitle, contains('GoldenShell'));
    expect(repository.snapshot.stage, 'Emergency cooperative intake');
    expect(
      repository.snapshot.actions.single.id,
      'accept_cooperative_mandate',
    );
    repository.dispose();
  });

  test('maps both GoldenShell terminal outcomes through the shared repository',
      () {
    for (final ({List<String> actions, String outcome}) path in <({
      List<String> actions,
      String outcome,
    })>[
      (
        actions: _goldenshellCoordinatedPath,
        outcome: 'Coordinated claim position',
      ),
      (
        actions: _goldenshellFragmentedPath,
        outcome: 'Fragmented claim position',
      ),
    ]) {
      final RustScenarioRepository repository = RustScenarioRepository(
        caseDefinition: goldenshell,
        bridgeClient: _FakeScenarioBridgeClient(),
      );

      for (final String action in path.actions) {
        expect(repository.applyAction(action).isRisky, isFalse);
      }

      expect(repository.isTerminal, isTrue);
      expect(
          repository.snapshot.stage, 'Seventy-two-hour claim handoff complete');
      expect(repository.snapshot.outcomeSummary?.headline, path.outcome);
      expect(repository.snapshot.actions, isEmpty);
      repository.dispose();
    }
  });
}

const List<String> _goldenshellCoordinatedPath = <String>[
  'accept_cooperative_mandate',
  'issue_coordinated_legal_hold',
  'preserve_reference_samples',
  'obtain_blocking_decisions',
  'notify_cleaning_contractor',
  'notify_farm_insurers',
  'coordinate_recall_response',
  'request_product_composition_records',
  'retain_independent_residue_expert',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'review_preliminary_residue_assessment',
  'map_common_and_individual_losses',
  'prepare_protective_attachment_strategy',
  'establish_coordinated_claim_protocol',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'complete_coordinated_handoff',
];

const List<String> _goldenshellFragmentedPath = <String>[
  'accept_cooperative_mandate',
  'authorise_recall_without_reference_samples',
  'prioritise_regulator_claim',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'coordinate_operational_period',
  'complete_fragmented_handoff',
];

final class _FakeScenarioBridgeClient implements ScenarioBridgeClient {
  int createCount = 0;
  int disposeCount = 0;
  int _sessionId = 0;
  int _clockMinutes = 0;
  String _stage = 'intake';
  String? _outcome;
  String _scenarioId = '';
  int _seed = 0;
  Map<String, dynamic> _scenario = <String, dynamic>{};
  Map<String, Map<String, dynamic>> _actionDefinitions =
      <String, Map<String, dynamic>>{};
  Map<String, Map<String, dynamic>> _stageDefinitions =
      <String, Map<String, dynamic>>{};
  Map<String, Map<String, dynamic>> _eventDefinitions =
      <String, Map<String, dynamic>>{};
  Map<String, Map<String, dynamic>> _outcomeDefinitions =
      <String, Map<String, dynamic>>{};
  String? lastScenarioId;
  int? lastSeed;
  int? lastActionCount;

  @override
  String execute(String encodedRequest) {
    final Map<String, dynamic> request =
        jsonDecode(encodedRequest) as Map<String, dynamic>;
    return switch (request['command']) {
      'create_session' => _create(request),
      'dispatch' => _dispatch(request['action_id'] as String),
      'snapshot' => _response('snapshot'),
      'dispose_session' => _dispose(),
      _ => jsonEncode(<String, dynamic>{
          'type': 'error',
          'code': 'invalid_request',
          'message': 'Unknown command',
        }),
    };
  }

  String _create(Map<String, dynamic> request) {
    final Map<String, dynamic> scenario =
        request['scenario'] as Map<String, dynamic>;
    final Map<String, dynamic> metadata =
        scenario['metadata'] as Map<String, dynamic>;
    _scenario = scenario;
    _scenarioId = metadata['id'] as String;
    _seed = request['seed'] as int;
    _actionDefinitions = <String, Map<String, dynamic>>{
      for (final Map<String, dynamic> value
          in (scenario['actions'] as List<dynamic>)
              .cast<Map<String, dynamic>>())
        value['id'] as String: value,
    };
    _stageDefinitions = <String, Map<String, dynamic>>{
      for (final Map<String, dynamic> value
          in (scenario['stages'] as List<dynamic>).cast<Map<String, dynamic>>())
        value['id'] as String: value,
    };
    _eventDefinitions = <String, Map<String, dynamic>>{
      for (final Map<String, dynamic> value
          in (scenario['events'] as List<dynamic>).cast<Map<String, dynamic>>())
        value['id'] as String: value,
    };
    _outcomeDefinitions = <String, Map<String, dynamic>>{
      for (final Map<String, dynamic> value
          in (scenario['outcomes'] as List<dynamic>)
              .cast<Map<String, dynamic>>())
        value['id'] as String: value,
    };
    lastScenarioId = _scenarioId;
    lastSeed = _seed;
    lastActionCount = (scenario['actions'] as List<dynamic>).length;
    createCount += 1;
    _sessionId += 1;
    _clockMinutes = 0;
    _stage = scenario['initial_stage'] as String;
    _outcome = null;
    return _response('session_created');
  }

  String _dispatch(String actionId) {
    final Map<String, dynamic>? action = _actionDefinitions[actionId];
    if (action == null || _outcome != null) {
      return jsonEncode(<String, dynamic>{
        'type': 'error',
        'code': 'action_unavailable',
        'message': 'Unavailable action',
      });
    }

    _clockMinutes += action['time_cost_minutes'] as int;
    _applyEffects(action['effects'] as List<dynamic>);
    return _response('snapshot');
  }

  void _applyEffects(List<dynamic> effects) {
    for (final dynamic value in effects) {
      final Map<String, dynamic> effect = value as Map<String, dynamic>;
      switch (effect['type']) {
        case 'set_stage':
          _stage = effect['stage'] as String;
          break;
        case 'resolve_outcome':
          _outcome = effect['outcome'] as String;
          break;
        case 'trigger_event':
          final Map<String, dynamic>? event =
              _eventDefinitions[effect['event'] as String];
          if (event != null) {
            _applyEffects(event['effects'] as List<dynamic>);
          }
          break;
      }
    }
  }

  String _dispose() {
    disposeCount += 1;
    return jsonEncode(<String, dynamic>{
      'type': 'session_disposed',
      'session_id': _sessionId,
      'disposed': true,
    });
  }

  String _response(String type) {
    final Map<String, dynamic> stage = _stageDefinitions[_stage]!;
    final Map<String, dynamic>? outcome = _outcomeDefinitions[_outcome];
    return jsonEncode(<String, dynamic>{
      'type': type,
      'session_id': _sessionId,
      'snapshot': <String, dynamic>{
        'snapshot_schema_version': 1,
        'scenario_id': _scenarioId,
        'seed': _seed,
        'stage_id': _stage,
        'stage_title': stage['title'] as String,
        'clock_minutes': _clockMinutes,
        'terminal': _outcome != null,
        'flags': <String, bool>{},
        'facts': (_scenario['facts'] as List<dynamic>)
            .map(
              (dynamic value) => <String, dynamic>{
                'id': (value as Map<String, dynamic>)['id'],
                'statement': value['statement'],
                'status': value['initial_status'],
              },
            )
            .toList(growable: false),
        'evidence': (_scenario['evidence'] as List<dynamic>)
            .map(
              (dynamic value) => <String, dynamic>{
                'id': (value as Map<String, dynamic>)['id'],
                'title': value['title'],
                'kind': value['kind'],
                'available': value['initially_available'] ?? false,
              },
            )
            .toList(growable: false),
        'deadlines': const <Map<String, dynamic>>[],
        'inbox': const <Map<String, dynamic>>[],
        'available_actions': _actions(),
        'fired_event_ids': <String>[
          if (_stage == 'post_judgment' || _outcome == 'judgment_recovery')
            'judgment_for_velmont',
        ],
        'outcome': _outcome == null
            ? null
            : <String, dynamic>{
                'id': _outcome,
                'title': outcome!['title'],
                'summary': outcome['summary'],
              },
      },
    });
  }

  List<Map<String, dynamic>> _actions() {
    if (_outcome != null) {
      return const <Map<String, dynamic>>[];
    }
    final List<String> ids =
        (_stageDefinitions[_stage]!['exit_actions'] as List<dynamic>)
            .cast<String>();
    return ids.map(
      (String id) {
        final Map<String, dynamic> action = _actionDefinitions[id]!;
        return <String, dynamic>{
          'id': id,
          'title': action['title'],
          'description': action['description'],
          'time_cost_minutes': action['time_cost_minutes'],
        };
      },
    ).toList(growable: false);
  }
}
