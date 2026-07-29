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
}

final class _FakeScenarioBridgeClient implements ScenarioBridgeClient {
  int createCount = 0;
  int disposeCount = 0;
  int _sessionId = 0;
  int _clockMinutes = 0;
  String _stage = 'intake';
  String? _outcome;
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
    lastScenarioId = metadata['id'] as String;
    lastSeed = request['seed'] as int;
    lastActionCount = (scenario['actions'] as List<dynamic>).length;
    createCount += 1;
    _sessionId += 1;
    _clockMinutes = 0;
    _stage = 'intake';
    _outcome = null;
    return _response('session_created');
  }

  String _dispatch(String actionId) {
    switch (actionId) {
      case 'audit_claim_file':
        _stage = 'pre_action';
        _clockMinutes += 120;
      case 'issue_formal_demand':
        _stage = 'proceedings';
        _clockMinutes += 60;
      case 'accept_negotiated_payment':
        _stage = 'resolved';
        _outcome = 'negotiated_recovery';
        _clockMinutes += 90;
      case 'request_judgment':
        _stage = 'post_judgment';
        _clockMinutes += 240;
      case 'enforce_judgment':
        _stage = 'resolved';
        _outcome = 'judgment_recovery';
        _clockMinutes += 60;
      default:
        return jsonEncode(<String, dynamic>{
          'type': 'error',
          'code': 'action_unavailable',
          'message': 'Unavailable action',
        });
    }
    return _response('snapshot');
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
    return jsonEncode(<String, dynamic>{
      'type': type,
      'session_id': _sessionId,
      'snapshot': <String, dynamic>{
        'snapshot_schema_version': 1,
        'scenario_id': 'be_commercial_logistics_001',
        'seed': 20260725,
        'stage_id': _stage,
        'stage_title': switch (_stage) {
          'intake' => 'Claim intake',
          'pre_action' => 'Pre-action recovery',
          'proceedings' => 'Recovery proceedings',
          'post_judgment' => 'Post-judgment enforcement',
          _ => 'Matter resolved',
        },
        'clock_minutes': _clockMinutes,
        'judicial_result': null,
        'matter_lifecycle': _outcome != null
            ? 'closed'
            : _stage == 'post_judgment'
                ? 'post_judgment'
                : 'active',
        'is_closed': _outcome != null,
        'resolved_outcome': _outcome,
        'terminal': _outcome != null,
        'flags': <String, bool>{},
        'facts': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'invoices_unpaid',
            'statement': 'Invoices remain unpaid.',
            'status': 'admitted',
          },
        ],
        'evidence': List<Map<String, dynamic>>.generate(
          5,
          (int index) => <String, dynamic>{
            'id': 'evidence_$index',
            'title': 'Evidence $index',
            'kind': 'document',
            'available': true,
          },
        ),
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
                'title': _outcome == 'negotiated_recovery'
                    ? 'Negotiated recovery'
                    : 'Judgment recovered and enforced',
                'summary': 'The logistics matter was resolved.',
              },
      },
    });
  }

  List<Map<String, dynamic>> _actions() {
    final List<String> ids = switch (_stage) {
      'intake' => <String>['audit_claim_file'],
      'pre_action' => <String>['issue_formal_demand'],
      'proceedings' => <String>[
          'accept_negotiated_payment',
          'request_judgment',
        ],
      'post_judgment' => <String>['enforce_judgment'],
      _ => const <String>[],
    };
    return ids
        .map(
          (String id) => <String, dynamic>{
            'id': id,
            'title': id.replaceAll('_', ' '),
            'description': 'Execute $id.',
            'time_cost_minutes': 60,
          },
        )
        .toList(growable: false);
  }
}
