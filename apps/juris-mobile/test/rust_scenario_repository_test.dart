import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/home_shell.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/data/game_save_store.dart';
import 'package:juris_mobile/data/rust_scenario_repository.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/game_snapshot.dart';

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
    // The legacy Logistics content does not emit an authoritative judicial
    // result/instance pair, so Flutter must not infer a court level from its
    // outcome ID.
    expect(repository.snapshot.caseResultStatus.name, 'settled');
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
    expect(client.lastActionCount, 13);
    expect(repository.supportsLiveClock, isTrue);
    final String before = repository.snapshot.timeLabel;
    repository.advanceTimeByMinutes(1);
    expect(repository.snapshot.timeLabel, isNot(before));
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
    expect(client.lastActionCount, 17);
    expect(repository.supportsLiveClock, isTrue);
    expect(repository.snapshot.matterTitle, contains('GoldenShell'));
    expect(repository.snapshot.stage, 'Emergency cooperative intake');
    expect(
      repository.snapshot.actions.single.id,
      'accept_cooperative_mandate',
    );
    repository.dispose();
  });

  test('GoldenShell exposes assigned action costs and Russian scenario text',
      () {
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: goldenshell,
      locale: 'ru',
      bridgeClient: _FakeScenarioBridgeClient(),
    );

    expect(repository.snapshot.matterTitle, 'GoldenShell — Отзыв на рассвете');
    expect(repository.snapshot.stage, 'Экстренный приём кооператива');
    expect(repository.snapshot.actions.single.title,
        'Принять поручение кооператива');
    expect(repository.snapshot.actions.single.costEur, 750);
    repository.dispose();
  });

  test('rest advances a foreground scenario to the next 08:00 work period', () {
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: goldenshell,
      bridgeClient: _FakeScenarioBridgeClient(),
    );

    repository.advanceTimeByMinutes(1205);
    expect(repository.snapshot.timeLabel, '04:05');
    repository.restUntilNextWorkday();

    expect(repository.snapshot.dayLabel, 'Day 2');
    expect(repository.snapshot.timeLabel, '08:00');
    repository.dispose();
  });

  test('save and load restore an authoritative repository snapshot', () async {
    final _MemoryGameSaveStore store = _MemoryGameSaveStore();
    final _FakeScenarioBridgeClient client = _FakeScenarioBridgeClient();
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: logistics,
      bridgeClient: client,
      saveStore: store,
    );

    repository.applyAction('audit_claim_file');
    final String savedStage = repository.snapshot.stage;
    await repository.saveGame();
    repository.applyAction('issue_formal_demand');
    expect(repository.snapshot.stage, isNot(savedStage));

    await repository.loadGame();
    expect(repository.snapshot.stage, savedStage);
    expect(client.loadCount, 1);
    expect(client.disposeCount, 1);
    repository.dispose();
  });

  test('failed load preserves the existing active snapshot', () async {
    final _MemoryGameSaveStore store = _MemoryGameSaveStore()
      ..encodedSave = '{corrupted';
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: logistics,
      bridgeClient: _FakeScenarioBridgeClient(),
      saveStore: store,
    );
    repository.applyAction('audit_claim_file');
    final String stage = repository.snapshot.stage;
    final String time = repository.snapshot.timeLabel;

    await expectLater(
      repository.loadGame(),
      throwsA(
        isA<GamePersistenceException>().having(
          (GamePersistenceException error) => error.code,
          'code',
          'invalid_save_json',
        ),
      ),
    );
    expect(repository.snapshot.stage, stage);
    expect(repository.snapshot.timeLabel, time);
    repository.dispose();
  });

  for (final ({
    String code,
    String encodedSave,
    String? bridgeRejection
  }) failure in <({String code, String encodedSave, String? bridgeRejection})>[
    (
      code: 'invalid_save_json',
      encodedSave: '{corrupted',
      bridgeRejection: null,
    ),
    (
      code: 'incompatible_runtime',
      encodedSave: '{"historical":true}',
      bridgeRejection: 'incompatible_runtime',
    ),
    (
      code: 'save_integrity_mismatch',
      encodedSave: '{"tampered":true}',
      bridgeRejection: 'save_integrity_mismatch',
    ),
    for (final String code in <String>[
      'unknown_save_schema',
      'unknown_save_schema_version',
      'unknown_save_scenario',
      'scenario_fingerprint_mismatch',
      'unknown_save_command',
      'unknown_save_action',
      'invalid_save_time_advance',
      'illegal_save_command_sequence',
      'save_serialization_failure',
    ])
      (
        code: code,
        encodedSave: '{"rejected_by_native_runtime":true}',
        bridgeRejection: code,
      ),
  ]) {
    test('${failure.code} repeatedly preserves snapshot and native session ID',
        () async {
      final _MemoryGameSaveStore store = _MemoryGameSaveStore()
        ..encodedSave = failure.encodedSave;
      final _FakeScenarioBridgeClient client = _FakeScenarioBridgeClient(
        judicialResult: 'lost',
        judicialDecisionInstance: 'first_instance',
        rejectLoadCode: failure.bridgeRejection,
      );
      final RustScenarioRepository repository = RustScenarioRepository(
        caseDefinition: logistics,
        bridgeClient: client,
        saveStore: store,
      );
      expect(repository.applyAction('audit_claim_file').isRisky, isFalse);
      final int originalSessionId = client.dispatchSessionIds.single;
      final GameSnapshot before = repository.snapshot;
      expect(before.judicialResult, JudicialResult.lost);
      expect(
        before.judicialDecisionInstance,
        JudicialDecisionInstance.firstInstance,
      );

      for (int attempt = 0; attempt < 2; attempt += 1) {
        await expectLater(
          repository.loadGame(),
          throwsA(
            isA<GamePersistenceException>().having(
              (GamePersistenceException error) => error.code,
              'code',
              failure.code,
            ),
          ),
        );
        expect(repository.snapshot, same(before));
        expect(client.disposeCount, 0);
      }

      expect(client.loadAttemptCount, 2);
      expect(repository.applyAction('issue_formal_demand').isRisky, isFalse);
      repository.advanceTimeByMinutes(1);
      expect(
        client.dispatchSessionIds,
        <int>[originalSessionId, originalSessionId],
      );
      expect(client.advanceSessionIds, <int>[originalSessionId]);
      expect(client.disposeCount, 0);
      expect(repository.snapshot.judicialResult, JudicialResult.lost);
      expect(
        repository.snapshot.judicialDecisionInstance,
        JudicialDecisionInstance.firstInstance,
      );

      repository.dispose();
      expect(client.disposeSessionIds, <int>[originalSessionId]);
    });
  }

  for (final ({
    _LoadResponseMode mode,
    String expectedCode,
  }) failure in <({
    _LoadResponseMode mode,
    String expectedCode,
  })>[
    (
      mode: _LoadResponseMode.incompleteSuccess,
      expectedCode: 'invalid_load_response',
    ),
    (
      mode: _LoadResponseMode.invalidSnapshot,
      expectedCode: 'invalid_loaded_snapshot',
    ),
    (
      mode: _LoadResponseMode.malformedDossier,
      expectedCode: 'invalid_loaded_snapshot',
    ),
  ]) {
    test('${failure.mode.name} disposes only the temporary loaded session',
        () async {
      final _MemoryGameSaveStore store = _MemoryGameSaveStore();
      final _FakeScenarioBridgeClient client = _FakeScenarioBridgeClient(
        loadResponseMode: failure.mode,
      );
      final RustScenarioRepository repository = RustScenarioRepository(
        caseDefinition: logistics,
        bridgeClient: client,
        saveStore: store,
      );
      expect(repository.applyAction('audit_claim_file').isRisky, isFalse);
      await repository.saveGame();
      final GameSnapshot before = repository.snapshot;
      final int activeSessionId = client.dispatchSessionIds.single;

      await expectLater(
        repository.loadGame(),
        throwsA(
          isA<GamePersistenceException>().having(
            (GamePersistenceException error) => error.code,
            'code',
            failure.expectedCode,
          ),
        ),
      );

      expect(repository.snapshot, same(before));
      expect(client.disposeSessionIds, <int>[activeSessionId + 1]);
      expect(repository.applyAction('issue_formal_demand').isRisky, isFalse);
      expect(
        client.dispatchSessionIds,
        <int>[activeSessionId, activeSessionId],
      );

      repository.dispose();
      expect(
        client.disposeSessionIds,
        <int>[activeSessionId + 1, activeSessionId],
      );
    });
  }

  test('EN and RU presentation produce identical authoritative saves',
      () async {
    final _MemoryGameSaveStore englishStore = _MemoryGameSaveStore();
    final _MemoryGameSaveStore russianStore = _MemoryGameSaveStore();
    final RustScenarioRepository english = RustScenarioRepository(
      caseDefinition: goldenshell,
      locale: 'en',
      bridgeClient: _FakeScenarioBridgeClient(),
      saveStore: englishStore,
    );
    final RustScenarioRepository russian = RustScenarioRepository(
      caseDefinition: goldenshell,
      locale: 'ru',
      bridgeClient: _FakeScenarioBridgeClient(),
      saveStore: russianStore,
    );
    english.applyAction('accept_cooperative_mandate');
    russian.applyAction('accept_cooperative_mandate');

    await english.saveGame();
    await russian.saveGame();
    expect(russianStore.encodedSave, englishStore.encodedSave);
    expect(russianStore.encodedSave, isNot(contains('locale')));
    english.dispose();
    russian.dispose();
  });

  test('terminal scenario save loads without replaying the final command',
      () async {
    final _MemoryGameSaveStore store = _MemoryGameSaveStore();
    final _FakeScenarioBridgeClient client = _FakeScenarioBridgeClient();
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: logistics,
      bridgeClient: client,
      saveStore: store,
    );
    for (final String action in <String>[
      'audit_claim_file',
      'issue_formal_demand',
      'accept_negotiated_payment',
    ]) {
      repository.applyAction(action);
    }
    expect(repository.isTerminal, isTrue);
    await repository.saveGame();
    repository.reset();
    expect(repository.isTerminal, isFalse);

    await repository.loadGame();
    expect(repository.isTerminal, isTrue);
    expect(
      repository.snapshot.outcomeSummary?.headline,
      'Negotiated recovery',
    );
    expect(client.loadCount, 1);
    repository.dispose();
  });

  test('GreenFire deadline uses civil-time offset and opens its action', () {
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: greenfire,
      locale: 'ru',
      bridgeClient: _FakeScenarioBridgeClient(),
    );

    expect(repository.snapshot.matterTitle, 'GreenFire — Первые 72 часа');
    expect(repository.snapshot.stage, 'Экстренный приём');
    expect(repository.snapshot.actions.single.title,
        'Принять экстренное поручение');
    repository.applyAction('accept_emergency_mandate');
    final deadline = repository.snapshot.deadlines.singleWhere(
      (item) => item.id == 'legal_hold_deadline',
    );
    expect(deadline.title, 'Ввести режим сохранения доказательств');
    expect(deadline.dueAt, 'День 1 · 11:00');
    expect(deadline.relatedActionId, 'issue_legal_hold');
    repository.dispose();
  });

  testWidgets('Russian GoldenShell launch localizes shell and action sheet', (
    WidgetTester tester,
  ) async {
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: goldenshell,
      locale: 'ru',
      bridgeClient: _FakeScenarioBridgeClient(),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: HomeShell(repository: repository, locale: 'ru'),
      ),
    );

    expect(find.text('Входящие'), findsWidgets);
    expect(find.text('Дело'), findsOneWidget);
    expect(find.textContaining('Экстренный приём кооператива'), findsOneWidget);
    await tester.tap(find.text('Действия · 1'));
    await tester.pumpAndSettle();

    expect(find.text('Доступные действия'), findsOneWidget);
    expect(find.text('Принять поручение кооператива'), findsOneWidget);
    expect(find.text('EUR 750'), findsOneWidget);
    repository.dispose();
  });

  testWidgets('save/load controls confirm, cancel, and restore gameplay', (
    WidgetTester tester,
  ) async {
    final _MemoryGameSaveStore store = _MemoryGameSaveStore();
    final _FakeScenarioBridgeClient client = _FakeScenarioBridgeClient();
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: goldenshell,
      locale: 'ru',
      bridgeClient: client,
      saveStore: store,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: HomeShell(repository: repository, locale: 'ru'),
      ),
    );

    await tester.tap(find.byKey(const ValueKey<String>('save-load-menu')));
    await tester.pumpAndSettle();
    expect(find.text('Сохранить игру'), findsOneWidget);
    expect(find.text('Загрузить игру'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey<String>('save-game-action')));
    await tester.pumpAndSettle();
    expect(find.text('Игра успешно сохранена.'), findsOneWidget);
    final String savedStage = repository.snapshot.stage;
    repository.applyAction('accept_cooperative_mandate');
    await tester.pump();
    expect(repository.snapshot.stage, isNot(savedStage));

    await tester.tap(find.byKey(const ValueKey<String>('save-load-menu')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey<String>('load-game-action')));
    await tester.pumpAndSettle();
    expect(find.text('Загрузить сохранённую игру?'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey<String>('cancel-load-game')));
    await tester.pumpAndSettle();
    expect(client.loadCount, 0);
    expect(repository.snapshot.stage, isNot(savedStage));

    await tester.tap(find.byKey(const ValueKey<String>('save-load-menu')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey<String>('load-game-action')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey<String>('confirm-load-game')));
    await tester.pumpAndSettle();
    expect(client.loadCount, 1);
    expect(repository.snapshot.stage, savedStage);
    expect(find.textContaining(savedStage), findsOneWidget);
    expect(find.text('Сохранённая игра загружена.'), findsOneWidget);
    repository.dispose();
  });

  testWidgets('save suspension resumes one foreground timer without duplicates',
      (WidgetTester tester) async {
    final _DelayedGameSaveStore store = _DelayedGameSaveStore();
    final _FakeScenarioBridgeClient client = _FakeScenarioBridgeClient();
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: greenfire,
      bridgeClient: client,
      saveStore: store,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: HomeShell(
          repository: repository,
          enableLiveClockInTests: true,
        ),
      ),
    );

    await tester.tap(find.byKey(const ValueKey<String>('save-load-menu')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey<String>('save-game-action')));
    await tester.pump();
    await tester.pump(const Duration(seconds: 8));
    expect(client.advanceCount, 0);

    store.completeWrite();
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 4));
    expect(client.advanceCount, 1);
    await tester.pump(const Duration(seconds: 4));
    expect(client.advanceCount, 2);
    repository.dispose();
  });

  testWidgets('corrupted save shows a controlled load error', (
    WidgetTester tester,
  ) async {
    final _MemoryGameSaveStore store = _MemoryGameSaveStore()
      ..encodedSave = '{corrupted';
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: logistics,
      bridgeClient: _FakeScenarioBridgeClient(),
      saveStore: store,
    );
    await tester.pumpWidget(
      MaterialApp(home: HomeShell(repository: repository)),
    );

    await tester.tap(find.byKey(const ValueKey<String>('save-load-menu')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey<String>('load-game-action')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey<String>('confirm-load-game')));
    await tester.pumpAndSettle();

    expect(
      find.text('The save is corrupted and was not loaded.'),
      findsOneWidget,
    );
    repository.dispose();
  });

  test('clock failure preserves snapshot and disables repeated ticking', () {
    final RustScenarioRepository repository = RustScenarioRepository(
      caseDefinition: greenfire,
      bridgeClient: _FakeScenarioBridgeClient(rejectAdvance: true),
    );
    final String before = repository.snapshot.timeLabel;

    expect(
      () => repository.advanceTimeByMinutes(1),
      throwsA(isA<ScenarioClockAdvanceException>()),
    );

    expect(repository.snapshot.timeLabel, before);
    expect(repository.clockErrorMessage, 'Clock unavailable');
    expect(repository.supportsLiveClock, isFalse);
    repository.dispose();
  });

  test('maps both GoldenShell terminal outcomes through the shared repository',
      () {
    for (final ({List<Object> commands, String outcome}) path in <({
      List<Object> commands,
      String outcome,
    })>[
      (
        commands: _goldenshellCoordinatedPath,
        outcome: 'Coordinated claim position',
      ),
      (
        commands: _goldenshellFragmentedPath,
        outcome: 'Fragmented claim position',
      ),
    ]) {
      final RustScenarioRepository repository = RustScenarioRepository(
        caseDefinition: goldenshell,
        bridgeClient: _FakeScenarioBridgeClient(),
      );

      for (final Object command in path.commands) {
        switch (command) {
          case final String actionId:
            expect(repository.applyAction(actionId).isRisky, isFalse);
          case final int minutes:
            repository.advanceTimeByMinutes(minutes);
        }
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

const List<Object> _goldenshellCoordinatedPath = <Object>[
  'accept_cooperative_mandate',
  'issue_coordinated_legal_hold',
  'preserve_reference_samples',
  'obtain_blocking_decisions',
  'notify_cleaning_contractor',
  'notify_farm_insurers',
  'coordinate_recall_response',
  'request_product_composition_records',
  'retain_independent_residue_expert',
  360,
  360,
  'review_preliminary_residue_assessment',
  'map_common_and_individual_losses',
  'prepare_protective_attachment_strategy',
  'establish_coordinated_claim_protocol',
  360,
  360,
  360,
  360,
  360,
  360,
  360,
  'complete_coordinated_handoff',
];

const List<Object> _goldenshellFragmentedPath = <Object>[
  'accept_cooperative_mandate',
  'authorise_recall_without_reference_samples',
  'prioritise_regulator_claim',
  360,
  360,
  360,
  360,
  360,
  360,
  360,
  360,
  360,
  360,
  360,
  360,
  'complete_fragmented_handoff',
];

enum _LoadResponseMode {
  normal,
  incompleteSuccess,
  invalidSnapshot,
  malformedDossier,
}

final class _FakeScenarioBridgeClient implements ScenarioBridgeClient {
  _FakeScenarioBridgeClient({
    this.rejectAdvance = false,
    this.judicialResult,
    this.judicialDecisionInstance,
    this.rejectLoadCode,
    this.loadResponseMode = _LoadResponseMode.normal,
  });

  final bool rejectAdvance;
  final String? judicialResult;
  final String? judicialDecisionInstance;
  final String? rejectLoadCode;
  final _LoadResponseMode loadResponseMode;
  int createCount = 0;
  int disposeCount = 0;
  int loadCount = 0;
  int loadAttemptCount = 0;
  int advanceCount = 0;
  final List<int> dispatchSessionIds = <int>[];
  final List<int> advanceSessionIds = <int>[];
  final List<int> disposeSessionIds = <int>[];
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
      'dispatch' => _dispatch(
          request['session_id'] as int,
          request['action_id'] as String,
        ),
      'advance_time' => _advance(
          request['session_id'] as int,
          request['minutes'] as int,
        ),
      'save_session' => _save(),
      'load_session' => _load(request),
      'snapshot' => _response('snapshot'),
      'dispose_session' => _dispose(request['session_id'] as int),
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

  String _dispatch(int sessionId, String actionId) {
    dispatchSessionIds.add(sessionId);
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

  String _advance(int sessionId, int minutes) {
    if (rejectAdvance) {
      return jsonEncode(<String, dynamic>{
        'type': 'error',
        'code': 'clock_advance_failed',
        'message': 'Clock unavailable',
      });
    }
    advanceSessionIds.add(sessionId);
    advanceCount += 1;
    _clockMinutes += minutes;
    return _response('snapshot');
  }

  String _save() {
    return jsonEncode(<String, dynamic>{
      'type': 'session_saved',
      'session_id': _sessionId,
      'encoded_save': jsonEncode(<String, dynamic>{
        'scenario_id': _scenarioId,
        'seed': _seed,
        'stage': _stage,
        'clock_minutes': _clockMinutes,
        'outcome': _outcome,
      }),
    });
  }

  String _load(Map<String, dynamic> request) {
    loadAttemptCount += 1;
    if (rejectLoadCode case final String code) {
      return jsonEncode(<String, dynamic>{
        'type': 'error',
        'code': code,
        'message': 'The save runtime is incompatible.',
      });
    }
    final Map<String, dynamic> save;
    try {
      save =
          jsonDecode(request['encoded_save'] as String) as Map<String, dynamic>;
    } on Object {
      return jsonEncode(<String, dynamic>{
        'type': 'error',
        'code': 'invalid_save_json',
        'message': 'The save is corrupted.',
      });
    }
    final Map<String, dynamic> scenario =
        request['scenario'] as Map<String, dynamic>;
    final Map<String, dynamic> metadata =
        scenario['metadata'] as Map<String, dynamic>;
    if (save['scenario_id'] != metadata['id']) {
      return jsonEncode(<String, dynamic>{
        'type': 'error',
        'code': 'scenario_fingerprint_mismatch',
        'message': 'The save targets different content.',
      });
    }
    loadCount += 1;
    _sessionId += 1;
    _scenario = scenario;
    _scenarioId = save['scenario_id'] as String;
    _seed = save['seed'] as int;
    _stage = save['stage'] as String;
    _clockMinutes = save['clock_minutes'] as int;
    _outcome = save['outcome'] as String?;
    if (loadResponseMode == _LoadResponseMode.incompleteSuccess) {
      return jsonEncode(<String, dynamic>{
        'type': 'session_loaded',
        'session_id': _sessionId,
      });
    }
    if (loadResponseMode == _LoadResponseMode.invalidSnapshot) {
      return jsonEncode(<String, dynamic>{
        'type': 'session_loaded',
        'session_id': _sessionId,
        'snapshot': <String, dynamic>{
          'snapshot_schema_version': 1,
          'scenario_id': _scenarioId,
        },
      });
    }
    if (loadResponseMode == _LoadResponseMode.malformedDossier) {
      final Map<String, dynamic> response =
          jsonDecode(_response('session_loaded')) as Map<String, dynamic>;
      final Map<String, dynamic> snapshot =
          response['snapshot'] as Map<String, dynamic>;
      snapshot['dossier'] = <String, dynamic>{
        'projection_schema_version': 1,
      };
      return jsonEncode(response);
    }
    return _response('session_loaded');
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

  String _dispose(int sessionId) {
    disposeCount += 1;
    disposeSessionIds.add(sessionId);
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
        'clock_mode': ((_scenario['clock'] as Map<String, dynamic>?)?['mode']
                as String?) ??
            'action_driven',
        'judicial_result': judicialResult,
        'judicial_decision_instance': judicialDecisionInstance,
        'matter_lifecycle': _outcome != null
            ? 'closed'
            : _stage == 'post_judgment'
                ? 'post_judgment'
                : 'active',
        'is_closed': _outcome != null,
        'resolved_outcome': _outcome,
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
        'deadlines': (_scenario['deadlines'] as List<dynamic>)
            .map(
              (dynamic value) => <String, dynamic>{
                'id': (value as Map<String, dynamic>)['id'],
                'title': value['title'],
                'due_at_minutes':
                    ((value['due_at'] as Map<String, dynamic>)['day'] as int) *
                            1440 +
                        ((value['due_at']
                            as Map<String, dynamic>)['minute_of_day'] as int),
                'status': value['activation_event'] == null ? 'open' : null,
                'completion_action_ids': value['completion_actions'],
              },
            )
            .toList(growable: false),
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
          'cost_eur': action['cost_eur'] ?? 0,
        };
      },
    ).toList(growable: false);
  }
}

class _MemoryGameSaveStore implements GameSaveStore {
  String? encodedSave;

  @override
  Future<bool> exists(String slotId) async => encodedSave != null;

  @override
  Future<String> read(String slotId) async {
    final String? value = encodedSave;
    if (value == null) {
      throw const GameSaveStorageException(
        code: 'save_not_found',
        message: 'No save.',
      );
    }
    return value;
  }

  @override
  Future<void> write(String slotId, String encodedSave) async {
    this.encodedSave = encodedSave;
  }
}

final class _DelayedGameSaveStore extends _MemoryGameSaveStore {
  final Completer<void> _writeGate = Completer<void>();

  @override
  Future<void> write(String slotId, String encodedSave) async {
    await _writeGate.future;
    await super.write(slotId, encodedSave);
  }

  void completeWrite() => _writeGate.complete();
}
