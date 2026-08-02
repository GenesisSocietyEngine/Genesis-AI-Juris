import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:juris_mobile/app/home_shell.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/data/game_save_store.dart';
import 'package:juris_mobile/data/native_scenario_bridge_client.dart';
import 'package:juris_mobile/data/rust_scenario_repository.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/game_snapshot.dart';

import 'support/historical_v1_counterexample.dart';
import 'support/matter_lifecycle_test_case.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late MobileCaseDefinition logistics;
  late MobileCaseDefinition greenfire;
  late MobileCaseDefinition goldenshell;
  late MobileCaseDefinition lifecycle;

  setUpAll(() async {
    final String encodedBundle = await rootBundle.loadString(
      'assets/case_catalog/mobile_case_bundle.json',
    );
    final CaseCatalogBundle bundle = CaseCatalogBundle.fromJson(
      jsonDecode(encodedBundle) as Map<String, dynamic>,
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
    lifecycle = matterLifecycleAndroidTestCase();
  });

  testWidgets('GreenFire RU saves actions and foreground time', (
    WidgetTester tester,
  ) async {
    final RustScenarioRepository repository = _repository(greenfire);
    expect(repository.snapshot.matterTitle, 'GreenFire — Первые 72 часа');
    expect(
      repository.applyAction('accept_emergency_mandate').isRisky,
      isFalse,
    );
    repository.advanceTimeByMinutes(30);
    expect(repository.applyAction('issue_legal_hold').isRisky, isFalse);
    final String savedDay = repository.snapshot.dayLabel;
    final String savedTime = repository.snapshot.timeLabel;
    final String savedStage = repository.snapshot.stage;
    final int savedInboxCount = repository.snapshot.inbox.length;
    expect(
      _deadline(repository, 'legal_hold_deadline').status,
      DeadlineStatus.done,
    );

    await repository.saveGame();
    repository.advanceTimeByMinutes(120);
    await repository.loadGame();

    expect(repository.snapshot.dayLabel, savedDay);
    expect(repository.snapshot.timeLabel, savedTime);
    expect(repository.snapshot.stage, savedStage);
    expect(repository.snapshot.inbox, hasLength(savedInboxCount));
    expect(
      _deadline(repository, 'legal_hold_deadline').status,
      DeadlineStatus.done,
    );
    repository.dispose();
  });

  testWidgets('GoldenShell RU replays either side of a deadline boundary', (
    WidgetTester tester,
  ) async {
    final RustScenarioRepository repository = _repository(goldenshell);
    expect(repository.snapshot.matterTitle, 'GoldenShell — Отзыв на рассвете');
    expect(repository.snapshot.actions.single.costEur, 750);
    expect(
      repository.applyAction('accept_cooperative_mandate').isRisky,
      isFalse,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.costEur > 0,
      ),
      isTrue,
    );
    repository.advanceTimeByMinutes(320);
    expect(
      _deadline(repository, 'sample_preservation_deadline').status,
      DeadlineStatus.open,
    );
    final String savedTime = repository.snapshot.timeLabel;
    await repository.saveGame();

    repository.advanceTimeByMinutes(20);
    expect(
      _deadline(repository, 'sample_preservation_deadline').status,
      DeadlineStatus.missed,
    );
    await repository.loadGame();
    expect(repository.snapshot.timeLabel, savedTime);
    expect(
      _deadline(repository, 'sample_preservation_deadline').status,
      DeadlineStatus.open,
    );
    repository.advanceTimeByMinutes(20);
    expect(
      _deadline(repository, 'sample_preservation_deadline').status,
      DeadlineStatus.missed,
    );
    repository.dispose();
  });

  testWidgets('terminal Logistics outcome survives save and load', (
    WidgetTester tester,
  ) async {
    final RustScenarioRepository repository = _repository(logistics);
    for (final String actionId in <String>[
      'audit_claim_file',
      'issue_formal_demand',
      'accept_negotiated_payment',
    ]) {
      expect(repository.applyAction(actionId).isRisky, isFalse);
    }
    expect(repository.isTerminal, isTrue);
    final String? savedOutcome = repository.snapshot.outcomeSummary?.headline;
    final String savedTime = repository.snapshot.timeLabel;
    await repository.saveGame();

    repository.reset();
    expect(repository.isTerminal, isFalse);
    await repository.loadGame();

    expect(repository.isTerminal, isTrue);
    expect(repository.snapshot.outcomeSummary?.headline, savedOutcome);
    expect(repository.snapshot.timeLabel, savedTime);
    expect(repository.snapshot.actions, isEmpty);
    repository.dispose();
  });

  testWidgets('corrupted platform save leaves the live session intact', (
    WidgetTester tester,
  ) async {
    final ApplicationSupportGameSaveStore store =
        ApplicationSupportGameSaveStore();
    final RustScenarioRepository repository = _repository(
      logistics,
      saveStore: store,
    );
    expect(repository.applyAction('audit_claim_file').isRisky, isFalse);
    final String activeStage = repository.snapshot.stage;
    final String activeTime = repository.snapshot.timeLabel;
    await store.write(logistics.caseId, '{corrupted');

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

    expect(repository.snapshot.stage, activeStage);
    expect(repository.snapshot.timeLabel, activeTime);
    expect(repository.isTerminal, isFalse);
    repository.dispose();
  });

  testWidgets(
    'debug-only lost-but-open lifecycle restores authoritative mobile state',
    (WidgetTester tester) async {
      final ApplicationSupportGameSaveStore store =
          ApplicationSupportGameSaveStore();
      final _HistoricalV1RejectingNativeBridge bridge =
          _HistoricalV1RejectingNativeBridge();
      final RustScenarioRepository repository = _repository(
        lifecycle,
        saveStore: store,
        bridgeClient: bridge,
        locale: 'en',
      );

      final List<int> historicalScenarioBytes = utf8.encode(
        historicalV1NonterminalOutcomeScenarioJson,
      );
      final List<int> historicalSaveBytes = utf8.encode(
        historicalV1NonterminalOutcomeSaveJson,
      );
      expect(
        historicalScenarioBytes,
        hasLength(historicalV1NonterminalOutcomeScenarioByteLength),
      );
      expect(
        sha256.convert(historicalScenarioBytes).toString(),
        historicalV1NonterminalOutcomeScenarioSha256,
      );
      expect(
        historicalSaveBytes,
        hasLength(historicalV1NonterminalOutcomeSaveByteLength),
      );
      expect(
        sha256.convert(historicalSaveBytes).toString(),
        historicalV1NonterminalOutcomeSaveSha256,
      );

      expect(repository.applyAction('request_judgment').isRisky, isFalse);
      expect(
        repository.applyAction('adverse_trial_judgment').isRisky,
        isFalse,
      );
      expect(repository.snapshot.judicialResult, JudicialResult.lost);
      expect(
        repository.snapshot.judicialDecisionInstance,
        JudicialDecisionInstance.firstInstance,
      );
      expect(
        repository.snapshot.matterLifecycle,
        MatterLifecycleStatus.postJudgment,
      );
      expect(repository.snapshot.isClosed, isFalse);

      final DeadlineView savedDeadline =
          _deadline(repository, 'appeal_deadline');
      final List<String> savedInboxIds = repository.snapshot.inbox
          .map((InboxItemView item) => item.id)
          .toList(growable: false);
      final List<InboxStatus> savedInboxStatuses = repository.snapshot.inbox
          .map((InboxItemView item) => item.status)
          .toList(growable: false);
      final List<String> savedActionIds = repository.snapshot.actions
          .map((GameActionView action) => action.id)
          .toList(growable: false);
      final String savedStage = repository.snapshot.stage;
      final String savedTime = repository.snapshot.timeLabel;

      expect(savedTime, '09:00');
      expect(savedDeadline.status, DeadlineStatus.open);
      expect(savedInboxIds, <String>['adverse_judgment_notice']);
      expect(savedInboxStatuses, <InboxStatus>[InboxStatus.actionRequired]);
      expect(savedActionIds, <String>['file_appeal', 'waive_appeal']);

      await repository.saveGame();
      repository.reset();
      expect(repository.snapshot.judicialResult, isNull);
      expect(repository.snapshot.stage, isNot(savedStage));

      await repository.loadGame();
      expect(repository.snapshot.stage, savedStage);
      expect(repository.snapshot.timeLabel, savedTime);
      expect(repository.snapshot.judicialResult, JudicialResult.lost);
      expect(
        repository.snapshot.judicialDecisionInstance,
        JudicialDecisionInstance.firstInstance,
      );
      expect(
        repository.snapshot.matterLifecycle,
        MatterLifecycleStatus.postJudgment,
      );
      expect(repository.snapshot.isClosed, isFalse);
      expect(
        _deadline(repository, 'appeal_deadline').status,
        savedDeadline.status,
      );
      expect(
        repository.snapshot.inbox.map((InboxItemView item) => item.id),
        savedInboxIds,
      );
      expect(
        repository.snapshot.inbox.map((InboxItemView item) => item.status),
        savedInboxStatuses,
      );
      expect(
        repository.snapshot.actions.map((GameActionView action) => action.id),
        savedActionIds,
      );
      final int? activeSessionId = bridge.lastSuccessfulLoadSessionId;
      expect(activeSessionId, isNotNull);
      final GameSnapshot liveSnapshot = repository.snapshot;
      final List<Object?> liveDeadline = _deadlineState(
        _deadline(repository, 'appeal_deadline'),
      );
      final List<List<Object?>> liveInbox =
          repository.snapshot.inbox.map(_inboxState).toList(growable: false);
      final List<List<Object?>> liveActions =
          repository.snapshot.actions.map(_actionState).toList(growable: false);

      await tester.pumpWidget(
        MaterialApp(
          home: HomeShell(repository: repository, locale: 'en'),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Matter'));
      await tester.pumpAndSettle();
      expect(find.text('Decision: Lost'), findsOneWidget);
      expect(find.text('Court instance: First instance'), findsOneWidget);
      expect(
        find.text('Matter status: Post-judgment — remedies available'),
        findsOneWidget,
      );

      bridge.rejectHistoricalV1Loads = true;
      for (int attempt = 0; attempt < 2; attempt += 1) {
        await expectLater(
          repository.loadGame(),
          throwsA(
            isA<GamePersistenceException>().having(
              (GamePersistenceException error) => error.code,
              'code',
              'incompatible_runtime',
            ),
          ),
        );

        // The real native error traverses RustScenarioRepository.loadGame.
        // A repeated compatibility failure must retain the exact mapped object
        // and every observable lifecycle projection owned by that session.
        expect(repository.snapshot, same(liveSnapshot));
        expect(repository.snapshot.stage, savedStage);
        expect(repository.snapshot.timeLabel, savedTime);
        expect(repository.snapshot.judicialResult, JudicialResult.lost);
        expect(
          repository.snapshot.judicialDecisionInstance,
          JudicialDecisionInstance.firstInstance,
        );
        expect(
          repository.snapshot.matterLifecycle,
          MatterLifecycleStatus.postJudgment,
        );
        expect(repository.snapshot.isClosed, isFalse);
        expect(
          _deadlineState(_deadline(repository, 'appeal_deadline')),
          liveDeadline,
        );
        expect(repository.snapshot.inbox.map(_inboxState), liveInbox);
        expect(repository.snapshot.actions.map(_actionState), liveActions);
        expect(find.text('Decision: Lost'), findsOneWidget);
        expect(find.text('Court instance: First instance'), findsOneWidget);
        expect(
          find.text('Matter status: Post-judgment — remedies available'),
          findsOneWidget,
        );
      }

      final ActionExecutionResult appeal =
          repository.applyAction('file_appeal');
      await tester.pump();
      expect(appeal.isRisky, isFalse);
      expect(bridge.dispatchSessionIds.last, activeSessionId);
      expect(repository.snapshot.timeLabel, '10:00');
      expect(
        repository.snapshot.matterLifecycle,
        MatterLifecycleStatus.appeal,
      );
      expect(repository.snapshot.isClosed, isFalse);
      expect(repository.snapshot.outcomeSummary, isNull);
      expect(
          _deadline(repository, 'appeal_deadline').status, DeadlineStatus.done);
      expect(repository.snapshot.inbox.single.status, InboxStatus.resolved);
      expect(repository.snapshot.actions.single.id, 'abandon_appeal');

      repository.dispose();
    },
  );
}

RustScenarioRepository _repository(
  MobileCaseDefinition definition, {
  GameSaveStore? saveStore,
  ScenarioBridgeClient? bridgeClient,
  String? locale,
}) {
  return RustScenarioRepository(
    caseDefinition: definition,
    locale: locale ??
        (definition.caseId == 'be_commercial_logistics_001' ? 'en' : 'ru'),
    bridgeClient: bridgeClient ?? NativeScenarioBridgeClient(),
    saveStore: saveStore ?? ApplicationSupportGameSaveStore(),
  );
}

DeadlineView _deadline(
  RustScenarioRepository repository,
  String deadlineId,
) {
  return repository.snapshot.deadlines.singleWhere(
    (DeadlineView item) => item.id == deadlineId,
  );
}

List<Object?> _deadlineState(DeadlineView deadline) => <Object?>[
      deadline.id,
      deadline.title,
      deadline.dueAt,
      deadline.status,
      deadline.detail,
      deadline.kind,
      deadline.relatedActionId,
      deadline.rescheduleActionId,
      deadline.rescheduleStatus,
      deadline.rescheduleRequestedDay,
      deadline.rescheduleDecisionDay,
      deadline.rescheduleRequestCount,
      deadline.replacementItemId,
      deadline.missedConsequence,
    ];

List<Object?> _inboxState(InboxItemView item) => <Object?>[
      item.id,
      item.sender,
      item.subject,
      item.body,
      item.receivedAt,
      item.status,
    ];

List<Object?> _actionState(GameActionView action) => <Object?>[
      action.id,
      action.title,
      action.description,
      action.timeLabel,
      action.costEur,
      action.tone,
      action.riskNote,
    ];

/// Routes the repository's normal commands to the native bridge, but can
/// replace only a load request with the immutable historical counterexample.
/// This lets Android exercise the real Flutter load boundary and real Rust
/// compatibility error while keeping the lifecycle case mounted.
final class _HistoricalV1RejectingNativeBridge implements ScenarioBridgeClient {
  final NativeScenarioBridgeClient _delegate = NativeScenarioBridgeClient();

  bool rejectHistoricalV1Loads = false;
  int? lastSuccessfulLoadSessionId;
  final List<int> dispatchSessionIds = <int>[];

  @override
  String execute(String encodedRequest) {
    final Map<String, dynamic> request =
        jsonDecode(encodedRequest) as Map<String, dynamic>;
    final String command = request['command'] as String;
    if (command == 'dispatch') {
      dispatchSessionIds.add(request['session_id'] as int);
    }

    final bool injectCounterexample =
        command == 'load_session' && rejectHistoricalV1Loads;
    final String nativeRequest = injectCounterexample
        ? ScenarioBridgeCommand.loadSession(
            scenario: jsonDecode(historicalV1NonterminalOutcomeScenarioJson)
                as Map<String, dynamic>,
            encodedSave: historicalV1NonterminalOutcomeSaveJson,
          )
        : encodedRequest;
    final String encodedResponse = _delegate.execute(nativeRequest);

    if (command == 'load_session' && !injectCounterexample) {
      final ScenarioBridgeResponse response =
          ScenarioBridgeResponse.parse(encodedResponse);
      if (!response.isError) {
        lastSuccessfulLoadSessionId = response.sessionId;
      }
    }
    return encodedResponse;
  }
}
