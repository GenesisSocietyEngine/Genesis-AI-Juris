import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/app/home_shell.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/data/game_save_store.dart';
import 'package:juris_mobile/data/native_scenario_bridge_client.dart';
import 'package:juris_mobile/data/rust_scenario_repository.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/dossier_projection.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/models/training_debrief.dart';
import 'package:juris_mobile/screens/case_catalog_screen.dart';

import 'support/historical_v1_counterexample.dart';
import 'support/matter_lifecycle_test_case.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late MobileCaseDefinition logistics;
  late MobileCaseDefinition greenfire;
  late MobileCaseDefinition goldenshell;
  late MobileCaseDefinition failedErp;
  late MobileCaseDefinition desertWater;
  late MobileCaseDefinition lifecycle;
  late MobileCaseDefinition pressureCountermove;
  late CaseCatalogBundle productionBundle;

  setUpAll(() async {
    final String encodedBundle = await rootBundle.loadString(
      'assets/case_catalog/mobile_case_bundle.json',
    );
    productionBundle = CaseCatalogBundle.fromJson(
      jsonDecode(encodedBundle) as Map<String, dynamic>,
    );
    logistics = productionBundle.cases.singleWhere(
      (MobileCaseDefinition item) =>
          item.caseId == 'be_commercial_logistics_001',
    );
    greenfire = productionBundle.cases.singleWhere(
      (MobileCaseDefinition item) => item.caseId == 'greenfire_first_72_hours',
    );
    goldenshell = productionBundle.cases.singleWhere(
      (MobileCaseDefinition item) =>
          item.caseId == 'nl_food_safety_goldenshell_001',
    );
    failedErp = productionBundle.cases.singleWhere(
      (MobileCaseDefinition item) =>
          item.caseId == 'be_commercial_failed_erp_001',
    );
    desertWater = productionBundle.cases.singleWhere(
      (MobileCaseDefinition item) =>
          item.caseId == 'us_environmental_desert_water_001',
    );
    lifecycle = matterLifecycleAndroidTestCase();
    pressureCountermove = pressureCountermoveAndroidTestCase();
  });

  testWidgets(
    'debug pressure fixture activates, restores, responds, and countermoves',
    (WidgetTester tester) async {
      final RustScenarioRepository response = _repository(
        pressureCountermove,
        locale: 'ru',
      );
      expect(response.snapshot.pressureAndCountermove, isNull);
      response.applyAction('request_judgment');
      response.applyAction('adverse_trial_judgment');
      final active = response.snapshot.pressureAndCountermove!;
      expect(active.projectionSchemaVersion, 1);
      expect(active.activePressures.single.pressureId,
          'adverse_judgment_pressure');
      expect(
        active.activePressures.single.sourceActorName,
        'Представитель противоположной стороны',
      );
      expect(
        active.activePressures.single.availableResponseActionIds,
        <String>['file_appeal', 'waive_appeal'],
      );
      final int remaining = active.activePressures.single.remainingMinutes;
      await response.saveGame();
      response.advanceTimeByMinutes(10);
      await response.loadGame();
      expect(
        response.snapshot.pressureAndCountermove!.activePressures.single
            .remainingMinutes,
        remaining,
      );
      response.applyAction('file_appeal');
      expect(response.snapshot.pressureAndCountermove, isNull);
      expect(
          _deadline(response, 'appeal_deadline').status, DeadlineStatus.done);
      response.dispose();

      final RustScenarioRepository missed = _repository(
        pressureCountermove,
        locale: 'en',
      );
      missed.applyAction('request_judgment');
      missed.applyAction('adverse_trial_judgment');
      missed.advanceTimeByMinutes(240);
      expect(missed.snapshot.pressureAndCountermove, isNull);
      expect(
          _deadline(missed, 'appeal_deadline').status, DeadlineStatus.missed);
      missed.dispose();
    },
  );

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

  testWidgets(
    'production GreenFire pressure survives native save load and UI response',
    (WidgetTester tester) async {
      const String currentFingerprint =
          '173140f010723c50f580fe9fd4e91417d3a20f51ca0b5315d94e900c1bde2438';
      final Map<String, dynamic> currentScenario = greenfire.scenario!;
      expect(
        (currentScenario['metadata']
            as Map<String, dynamic>)['content_version'],
        '0.2.0',
      );
      expect(greenfire.scenarioFingerprint, currentFingerprint);

      final _MemoryGameSaveStore store = _MemoryGameSaveStore();
      final _RecordingNativeBridge bridge = _RecordingNativeBridge();
      final RustScenarioRepository repository = RustScenarioRepository(
        caseDefinition: greenfire,
        contentInventory: productionBundle,
        locale: 'en',
        bridgeClient: bridge,
        saveStore: store,
      );

      List<Object?> mappedState(GameSnapshot snapshot) {
        final pressure = snapshot.pressureAndCountermove;
        return <Object?>[
          snapshot.stage,
          snapshot.dayLabel,
          snapshot.timeLabel,
          snapshot.actions.map(_actionState).toList(growable: false),
          snapshot.inbox.map(_inboxState).toList(growable: false),
          snapshot.deadlines.map(_deadlineState).toList(growable: false),
          pressure?.projectionSchemaVersion,
          pressure?.activePressures
              .map(
                (item) => <Object?>[
                  item.pressureId,
                  item.sourceActorId,
                  item.sourceActorName,
                  item.dueAtMinute,
                  item.remainingMinutes,
                  item.availableResponseActionIds,
                ],
              )
              .toList(growable: false),
        ];
      }

      try {
        expect(repository.snapshot.pressureAndCountermove, isNull);
        expect(
          bridge.latestSnapshot.containsKey('pressure_and_countermove'),
          isFalse,
        );

        expect(
          repository.applyAction('accept_emergency_mandate').isRisky,
          isFalse,
        );
        expect(repository.snapshot.pressureAndCountermove, isNull);
        repository.advanceTimeByMinutes(90);
        final activeAtMinute120 =
            repository.snapshot.pressureAndCountermove!.activePressures.single;
        expect(activeAtMinute120.pressureId,
            'regulator_document_request_pressure');
        expect(activeAtMinute120.availableResponseActionIds,
            <String>['release_unreviewed_documents']);
        expect(
          repository.snapshot.actions
              .where(
                (GameActionView action) =>
                    action.id == 'submit_initial_regulatory_response',
              )
              .isEmpty,
          isTrue,
        );
        expect(
          repository.snapshot.actions.map((GameActionView action) => action.id),
          contains('release_unreviewed_documents'),
        );

        expect(
          repository.applyAction('open_controlled_regulator_channel').isRisky,
          isFalse,
        );
        final activeAtMinute180 =
            repository.snapshot.pressureAndCountermove!.activePressures.single;
        expect(activeAtMinute180.sourceActorId,
            'port_haven_environment_authority');
        expect(activeAtMinute180.sourceActorName,
            'Port Haven Environmental Authority');
        expect(activeAtMinute180.dueAtMinute, 2160);
        expect(activeAtMinute180.remainingMinutes, 1980);
        expect(activeAtMinute180.availableResponseActionIds, <String>[
          'submit_initial_regulatory_response',
          'release_unreviewed_documents',
        ]);

        final String savedRawSnapshot = jsonEncode(bridge.latestSnapshot);
        final List<Object?> savedMappedState = mappedState(repository.snapshot);
        await repository.saveGame();
        final Map<String, dynamic> encodedSave =
            jsonDecode(store.encodedSave!) as Map<String, dynamic>;
        expect(encodedSave['scenario_fingerprint'], currentFingerprint);

        repository.advanceTimeByMinutes(10);
        expect(mappedState(repository.snapshot), isNot(savedMappedState));
        await repository.loadGame();
        final Map<String, dynamic> loadRequest = bridge.requests.lastWhere(
          (Map<String, dynamic> request) =>
              request['command'] == 'load_session',
        );
        final Map<String, dynamic> loadedScenario =
            loadRequest['scenario'] as Map<String, dynamic>;
        expect(
          (loadedScenario['metadata']
              as Map<String, dynamic>)['content_version'],
          '0.2.0',
        );
        expect(jsonEncode(bridge.latestSnapshot), savedRawSnapshot);
        expect(mappedState(repository.snapshot), savedMappedState);

        await tester.pumpWidget(
          MaterialApp(
            home: HomeShell(
              repository: repository,
              locale: 'en',
              enableLiveClockInTests: true,
            ),
          ),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('Matter'));
        await tester.pumpAndSettle();
        final Finder review = find.byKey(
          const ValueKey<String>(
            'review-pressure-responses-regulator_document_request_pressure',
          ),
        );
        await tester.scrollUntilVisible(
          review,
          240,
          scrollable: find.byType(Scrollable).last,
          maxScrolls: 30,
        );
        await tester.pumpAndSettle();

        final int dispatchesBeforeReview = bridge.commandCount('dispatch');
        final int advancesBeforeReview = bridge.commandCount('advance_time');
        final int requestsBeforeReview = bridge.requests.length;
        await tester.tap(review);
        await tester.pumpAndSettle();
        expect(bridge.commandCount('dispatch'), dispatchesBeforeReview);
        expect(find.text('Available actions'), findsOneWidget);
        expect(
            find.text('Submit the reviewed initial response'), findsOneWidget);
        expect(find.text('Release the requested files without review'),
            findsOneWidget);
        expect(
          tester
              .getTopLeft(find.text('Submit the reviewed initial response'))
              .dy,
          lessThan(
            tester
                .getTopLeft(
                  find.text('Release the requested files without review'),
                )
                .dy,
          ),
        );
        await tester.pump(const Duration(seconds: 8));
        expect(bridge.commandCount('advance_time'), advancesBeforeReview);
        expect(bridge.commandCount('dispatch'), dispatchesBeforeReview);
        expect(bridge.requests, hasLength(requestsBeforeReview));

        Navigator.of(tester.element(find.text('Available actions'))).pop();
        await tester.pumpAndSettle();
        expect(find.text('Available actions'), findsNothing);
        expect(bridge.commandCount('dispatch'), dispatchesBeforeReview);
        expect(bridge.requests, hasLength(requestsBeforeReview));

        await tester.tap(review);
        await tester.pumpAndSettle();
        expect(find.text('Available actions'), findsOneWidget);
        expect(bridge.commandCount('dispatch'), dispatchesBeforeReview);
        expect(bridge.requests, hasLength(requestsBeforeReview));

        await tester.tap(find.text('Submit the reviewed initial response'));
        await tester.pumpAndSettle();
        expect(find.text('Yes'), findsOneWidget);
        expect(bridge.commandCount('dispatch'), dispatchesBeforeReview);
        await tester.pump(const Duration(seconds: 8));
        expect(bridge.commandCount('advance_time'), advancesBeforeReview);
        expect(bridge.commandCount('dispatch'), dispatchesBeforeReview);

        await tester.tap(find.text('Yes'));
        await tester.pumpAndSettle();
        expect(bridge.commandCount('dispatch'), dispatchesBeforeReview + 1);
        final List<Map<String, dynamic>> dispatches = bridge.requests
            .where(
              (Map<String, dynamic> request) =>
                  request['command'] == 'dispatch',
            )
            .toList(growable: false);
        expect(
          dispatches.last['action_id'],
          'submit_initial_regulatory_response',
        );
        expect(
          _deadline(repository, 'initial_regulatory_response_deadline').status,
          DeadlineStatus.done,
        );
        expect(
          repository.snapshot.inbox
              .singleWhere(
                (InboxItemView item) => item.id == 'regulator_document_request',
              )
              .status,
          InboxStatus.resolved,
        );
        expect(repository.snapshot.pressureAndCountermove, isNull);
        expect(
          bridge.latestSnapshot.containsKey('pressure_and_countermove'),
          isFalse,
        );

        await tester.pumpWidget(const SizedBox.shrink());
        final _RecordingNativeBridge missedBridge = _RecordingNativeBridge();
        final RustScenarioRepository missed = RustScenarioRepository(
          caseDefinition: greenfire,
          contentInventory: productionBundle,
          locale: 'en',
          bridgeClient: missedBridge,
          saveStore: _MemoryGameSaveStore(),
        );
        try {
          expect(
            missed.applyAction('accept_emergency_mandate').isRisky,
            isFalse,
          );
          missed.advanceTimeByMinutes(90);
          expect(
            missed.snapshot.pressureAndCountermove!.activePressures.single
                .pressureId,
            'regulator_document_request_pressure',
          );
          missed.advanceTimeByMinutes(1440);
          missed.advanceTimeByMinutes(600);
          expect(
            _deadline(missed, 'initial_regulatory_response_deadline').status,
            DeadlineStatus.missed,
          );
          expect(missed.snapshot.pressureAndCountermove, isNull);
          expect(
            missedBridge.latestSnapshot.containsKey('pressure_and_countermove'),
            isFalse,
          );
        } finally {
          missed.dispose();
        }
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        repository.dispose();
      }
    },
  );

  testWidgets(
    'historical GreenFire routes to retained content across native resave',
    (WidgetTester tester) async {
      final _MemoryGameSaveStore store = _MemoryGameSaveStore()
        ..encodedSave = _historicalGreenFireV1Save;
      final _RecordingNativeBridge firstBridge = _RecordingNativeBridge();
      final RustScenarioRepository first = RustScenarioRepository(
        caseDefinition: greenfire,
        contentInventory: productionBundle,
        locale: 'ru',
        bridgeClient: firstBridge,
        saveStore: store,
      );

      await first.loadGame();
      final Map<String, dynamic> loadRequest = firstBridge.requests.lastWhere(
        (Map<String, dynamic> request) => request['command'] == 'load_session',
      );
      final Map<String, dynamic> retainedScenario =
          loadRequest['scenario'] as Map<String, dynamic>;
      expect(
        (retainedScenario['metadata']
            as Map<String, dynamic>)['content_version'],
        '0.1.0',
      );
      expect(retainedScenario.containsKey('pressure_windows'), isFalse);
      expect(
        first.snapshot.trainingDebrief?.resolvedOutcomeId,
        'compromised_crisis_position',
      );
      final List<Object?> historicalState = <Object?>[
        first.snapshot.timeLabel,
        first.snapshot.isClosed,
        first.snapshot.trainingDebrief?.resolvedOutcomeId,
      ];

      await first.saveGame();
      final Map<String, dynamic> resaved =
          jsonDecode(store.encodedSave!) as Map<String, dynamic>;
      expect(resaved, hasLength(8));
      expect(resaved['runtime_compatibility'], 'scenario-runtime-v2');
      expect(
        resaved['scenario_fingerprint'],
        'b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261',
      );
      first.dispose();

      final _RecordingNativeBridge secondBridge = _RecordingNativeBridge();
      final RustScenarioRepository second = RustScenarioRepository(
        caseDefinition: greenfire,
        contentInventory: productionBundle,
        locale: 'en',
        bridgeClient: secondBridge,
        saveStore: store,
      );
      await second.loadGame();
      expect(
        <Object?>[
          second.snapshot.timeLabel,
          second.snapshot.isClosed,
          second.snapshot.trainingDebrief?.resolvedOutcomeId,
        ],
        historicalState,
      );
      final GameSnapshot beforeUnknown = second.snapshot;
      final int nativeLoadCount = secondBridge.commandCount('load_session');
      resaved['scenario_fingerprint'] =
          'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      store.encodedSave = jsonEncode(resaved);
      await expectLater(
        second.loadGame(),
        throwsA(
          isA<GamePersistenceException>().having(
            (GamePersistenceException error) => error.code,
            'code',
            'scenario_fingerprint_mismatch',
          ),
        ),
      );
      expect(secondBridge.commandCount('load_session'), nativeLoadCount);
      expect(second.snapshot, same(beforeUnknown));
      second.dispose();
    },
  );

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
    'Failed ERP RU claimant state survives native save load and corruption',
    (WidgetTester tester) async {
      final ApplicationSupportGameSaveStore store =
          ApplicationSupportGameSaveStore();
      final RustScenarioRepository repository = _repository(
        failedErp,
        saveStore: store,
        locale: 'ru',
      );

      expect(failedErp.playerClientId, 'asteron_systems');
      expect(failedErp.playerRole, 'claimant');
      expect(
        failedErp.localized('ru', 'en').playerClientName,
        'Asteron Systems NV',
      );
      expect(repository.snapshot.matterTitle, 'Неудачное внедрение ERP');
      expect(repository.snapshot.authorizedBudgetEur, 25000);
      expect(repository.snapshot.spendEur, 0);
      expect(repository.snapshot.billableMinutes, 0);
      expect(repository.snapshot.resources, <String, int>{
        'authorized_budget_eur': 25000,
        'award_eur': 0,
        'billable_minutes': 0,
        'outcome_costs_eur': 0,
        'spend_eur': 0,
      });

      final GameActionView conflictCheck = repository.snapshot.actions
          .singleWhere(
              (GameActionView action) => action.id == 'run-conflict-check');
      expect(conflictCheck.title, 'Провести проверку конфликта интересов');
      expect(conflictCheck.timeLabel, '1ч');
      expect(conflictCheck.costEur, 350);

      final DossierProjectionView openingDossier = repository.snapshot.dossier!;
      expect(
        openingDossier.facts
            .map((DossierFactView fact) => <Object?>[fact.id, fact.status]),
        <List<Object?>>[
          <Object?>['claimed_loss_240000', DossierFactStatus.alleged],
          <Object?>['contract_in_force', DossierFactStatus.proven],
          <Object?>['go_live_failure', DossierFactStatus.alleged],
        ],
      );
      expect(
        openingDossier.evidence
            .map((DossierEvidenceView evidence) => evidence.id),
        <String>['erp_implementation_contract'],
      );

      expect(repository.applyAction('run-conflict-check').isRisky, isFalse);
      expect(repository.snapshot.spendEur, 350);
      expect(repository.snapshot.billableMinutes, 60);
      final GameActionView documentReview = repository.snapshot.actions
          .singleWhere(
              (GameActionView action) => action.id == 'request-documents');
      expect(documentReview.costEur, 2000);
      expect(repository.applyAction('request-documents').isRisky, isFalse);
      expect(repository.snapshot.stage, 'Досудебная стадия');
      expect(repository.snapshot.spendEur, 2350);
      expect(repository.snapshot.billableMinutes, 540);
      expect(repository.snapshot.resources, <String, int>{
        'authorized_budget_eur': 25000,
        'award_eur': 0,
        'billable_minutes': 540,
        'outcome_costs_eur': 0,
        'spend_eur': 2350,
      });

      final DossierProjectionView revealedDossier =
          repository.snapshot.dossier!;
      expect(
        revealedDossier.facts
            .map((DossierFactView fact) => <Object?>[fact.id, fact.status]),
        <List<Object?>>[
          <Object?>['acceptance_status', DossierFactStatus.disputed],
          <Object?>['claimed_loss_240000', DossierFactStatus.alleged],
          <Object?>['contract_in_force', DossierFactStatus.proven],
          <Object?>['go_live_failure', DossierFactStatus.alleged],
          <Object?>[
            'scope_change_responsibility',
            DossierFactStatus.disputed,
          ],
          <Object?>['supplier_delay_notice', DossierFactStatus.inferred],
        ],
      );
      expect(
        revealedDossier.evidence
            .map((DossierEvidenceView evidence) => evidence.id),
        <String>[
          'acceptance_record',
          'change_request_register',
          'erp_implementation_contract',
          'project_email_correspondence',
        ],
      );
      final GameActionView settlement = repository.snapshot.actions
          .singleWhere((GameActionView action) => action.id == 'future-settle');
      expect(
        settlement.title,
        'Принять текущее предложение об урегулировании',
      );
      expect(settlement.costEur, 0);

      final String savedStage = repository.snapshot.stage;
      final String savedDay = repository.snapshot.dayLabel;
      final String savedTime = repository.snapshot.timeLabel;
      final Map<String, int> savedResources =
          Map<String, int>.of(repository.snapshot.resources);
      final List<List<Object?>> savedActions =
          repository.snapshot.actions.map(_actionState).toList(growable: false);
      final List<Object?> savedDossier = _dossierState(revealedDossier);

      await repository.saveGame();
      final String encodedSave = await store.read(failedErp.caseId);
      final Map<String, dynamic> saveEnvelope =
          jsonDecode(encodedSave) as Map<String, dynamic>;
      expect(saveEnvelope, hasLength(8));
      expect(saveEnvelope['schema_id'], 'genesis.ai-juris.command-log');
      expect(saveEnvelope['schema_version'], 1);
      expect(saveEnvelope['runtime_compatibility'], 'scenario-runtime-v2');
      expect(saveEnvelope['scenario_id'], failedErp.caseId);
      expect(saveEnvelope['commands'], hasLength(2));
      repository.reset();
      expect(repository.snapshot.stage, isNot(savedStage));
      expect(repository.snapshot.spendEur, 0);
      await repository.loadGame();

      expect(repository.snapshot.stage, savedStage);
      expect(repository.snapshot.dayLabel, savedDay);
      expect(repository.snapshot.timeLabel, savedTime);
      expect(repository.snapshot.resources, savedResources);
      expect(repository.snapshot.actions.map(_actionState), savedActions);
      expect(_dossierState(repository.snapshot.dossier!), savedDossier);
      await repository.saveGame();
      expect(await store.read(failedErp.caseId), encodedSave);

      final GameSnapshot liveSnapshot = repository.snapshot;
      await store.write(failedErp.caseId, '{corrupted');
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
      expect(repository.snapshot, same(liveSnapshot));
      expect(repository.snapshot.resources, savedResources);
      expect(repository.snapshot.actions.map(_actionState), savedActions);
      expect(_dossierState(repository.snapshot.dossier!), savedDossier);

      expect(repository.applyAction('future-settle').isRisky, isFalse);
      expect(repository.snapshot.isClosed, isTrue);
      expect(repository.isTerminal, isTrue);
      expect(repository.snapshot.resources['award_eur'], 64500);
      expect(repository.snapshot.resources['spend_eur'], 2350);
      expect(
        repository.snapshot.outcomeSummary?.headline,
        'Урегулирование принято за 64 500 евро',
      );
      expect(repository.snapshot.actions, isEmpty);
      repository.dispose();
    },
  );

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

      final DossierProjectionView openingDossier = repository.snapshot.dossier!;
      expect(
        openingDossier.facts.map((DossierFactView item) => item.id),
        <String>['claim_was_filed'],
      );
      expect(
        openingDossier.evidence.map((DossierEvidenceView item) => item.id),
        <String>['client_instruction_letter'],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: HomeShell(repository: repository, locale: 'en'),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Matter'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey<String>('open-dossier-button')),
        240,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(
        find.byKey(const ValueKey<String>('open-dossier-button')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Matter dossier'), findsOneWidget);
      expect(
          find.text('The claim was filed at first instance.'), findsOneWidget);
      expect(find.textContaining('HIDDEN FACT SENTINEL'), findsNothing);
      expect(find.textContaining('HIDDEN EVIDENCE SENTINEL'), findsNothing);
      await tester.pageBack();
      await tester.pumpAndSettle();

      expect(
        repository.applyAction('review_dossier_materials').isRisky,
        isFalse,
      );
      await tester.pump();
      final DossierProjectionView revealedDossier =
          repository.snapshot.dossier!;
      expect(
        revealedDossier.facts.map((DossierFactView item) => item.id),
        <String>['claim_was_filed', 'registry_record_confirms_service'],
      );
      expect(
        revealedDossier.evidence.map((DossierEvidenceView item) => item.id),
        <String>['client_instruction_letter', 'court_registry_extract'],
      );
      await tester.tap(
        find.byKey(const ValueKey<String>('open-dossier-button')),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.textContaining('HIDDEN EVIDENCE SENTINEL'),
        240,
        scrollable: find.byType(Scrollable).last,
        maxScrolls: 30,
      );
      expect(find.textContaining('HIDDEN FACT SENTINEL'), findsOneWidget);
      expect(find.textContaining('HIDDEN EVIDENCE SENTINEL'), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();

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
      final List<Object?> savedDossier = _dossierState(
        repository.snapshot.dossier!,
      );

      expect(savedTime, '09:10');
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
      expect(_dossierState(repository.snapshot.dossier!), savedDossier);
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

      await tester.scrollUntilVisible(
        find.text('Decision: Lost'),
        -240,
        scrollable: find.byType(Scrollable).last,
        maxScrolls: 30,
      );
      await tester.pumpAndSettle();
      expect(find.text('Decision: Lost'), findsOneWidget);
      expect(find.text('Court instance: First instance'), findsOneWidget);
      expect(
        find.text('Matter status: Post-judgment — remedies available'),
        findsOneWidget,
      );

      await tester.ensureVisible(
        find.byKey(const ValueKey<String>('open-dossier-button')),
      );
      await tester.tap(
        find.byKey(const ValueKey<String>('open-dossier-button')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Recoverable — remedy available'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey<String>('dossier-remedy-file_appeal')),
        240,
        scrollable: find.byType(Scrollable).last,
        maxScrolls: 30,
      );
      expect(
        find.byKey(const ValueKey<String>('dossier-remedy-file_appeal')),
        findsOneWidget,
      );
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Decision: Lost'),
        -240,
        scrollable: find.byType(Scrollable).last,
        maxScrolls: 30,
      );
      await tester.pumpAndSettle();

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
        expect(_dossierState(repository.snapshot.dossier!), savedDossier);
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
      expect(repository.snapshot.timeLabel, '10:10');
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
      final DossierDeadlineView completedDeadline =
          repository.snapshot.dossier!.deadlines.singleWhere(
              (DossierDeadlineView item) => item.id == 'appeal_deadline');
      expect(completedDeadline.status, DossierDeadlineStatus.completed);
      expect(completedDeadline.remedies, isEmpty);
      final List<Object?> completedDossier = _dossierState(
        repository.snapshot.dossier!,
      );
      bridge.rejectHistoricalV1Loads = false;
      await repository.saveGame();
      repository.reset();
      await repository.loadGame();
      await tester.pumpAndSettle();
      expect(_dossierState(repository.snapshot.dossier!), completedDossier);
      expect(
        repository.snapshot.dossier!.deadlines
            .singleWhere(
              (DossierDeadlineView item) => item.id == 'appeal_deadline',
            )
            .status,
        DossierDeadlineStatus.completed,
      );
      await tester.pumpWidget(
        MaterialApp(
          key: const ValueKey<String>('restored-dossier-host'),
          home: HomeShell(repository: repository, locale: 'en'),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Matter'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey<String>('open-dossier-button')),
        240,
        scrollable: find.byType(Scrollable).last,
        maxScrolls: 30,
      );
      await tester.tap(
        find.byKey(const ValueKey<String>('open-dossier-button')),
      );
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey<String>('dossier-screen')),
        findsOneWidget,
      );
      final Finder dossierScroll = find.byKey(
        const PageStorageKey<String>('dossier-scroll'),
      );
      expect(dossierScroll, findsOneWidget);
      final Finder completedStatus = find.byKey(
        const ValueKey<String>('dossier-deadline-status-appeal_deadline'),
      );
      expect(completedStatus, findsOneWidget);
      expect(
        tester.widget<Text>(completedStatus).data,
        contains('Completed'),
      );
      await tester.ensureVisible(completedStatus);
      await tester.pumpAndSettle();
      expect(completedStatus, findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('dossier-remedy-file_appeal')),
        findsNothing,
      );

      await tester.pageBack();
      await tester.pumpAndSettle();
      final ActionExecutionResult closure =
          repository.applyAction('abandon_appeal');
      await tester.pumpAndSettle();
      expect(closure.isRisky, isFalse);
      expect(repository.snapshot.timeLabel, '10:15');
      expect(repository.snapshot.isClosed, isTrue);
      expect(
        repository.snapshot.matterLifecycle,
        MatterLifecycleStatus.closed,
      );
      expect(repository.snapshot.outcomeSummary?.finalStatus, 'final_loss');
      expect(repository.snapshot.actions, isEmpty);
      expect(
        repository.snapshot.dossier!.procedure.matterStatus,
        DossierMatterStatus.closed,
      );
      expect(repository.snapshot.dossier!.outcome?.id, 'final_loss');

      final GameSnapshot closedSnapshot = repository.snapshot;
      final List<Object?> closedDossier = _dossierState(
        repository.snapshot.dossier!,
      );
      final ActionExecutionResult rejectedDispatch =
          repository.applyAction('abandon_appeal');
      expect(rejectedDispatch.isRisky, isTrue);
      expect(repository.snapshot, same(closedSnapshot));
      expect(
        () => repository.advanceTimeByMinutes(1),
        throwsA(
          isA<ScenarioClockAdvanceException>().having(
            (ScenarioClockAdvanceException error) => error.code,
            'code',
            'scenario_resolved',
          ),
        ),
      );
      expect(repository.snapshot, same(closedSnapshot));
      expect(_dossierState(repository.snapshot.dossier!), closedDossier);

      await tester.scrollUntilVisible(
        find.byKey(const ValueKey<String>('open-dossier-button')),
        240,
        scrollable: find.byType(Scrollable).last,
        maxScrolls: 30,
      );
      await tester.tap(
        find.byKey(const ValueKey<String>('open-dossier-button')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Closed matter'), findsOneWidget);
      expect(find.text('Final loss'), findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('dossier-remedy-file_appeal')),
        findsNothing,
      );

      repository.dispose();
    },
  );

  testWidgets(
    'native Training Debrief appears only after resolution and restores exactly',
    (WidgetTester tester) async {
      final ApplicationSupportGameSaveStore store =
          ApplicationSupportGameSaveStore();
      final _RecordingNativeBridge bridge = _RecordingNativeBridge();
      final RustScenarioRepository repository = _repository(
        lifecycle,
        saveStore: store,
        bridgeClient: bridge,
        locale: 'en',
      );

      try {
        expect(
          bridge.latestSnapshotResponseJson,
          isNot(contains('"training_debrief"')),
        );
        expect(
          bridge.latestSnapshot.containsKey('training_debrief'),
          isFalse,
        );
        expect(repository.snapshot.trainingDebrief, isNull);

        await tester.pumpWidget(
          MaterialApp(
            home: HomeShell(repository: repository, locale: 'en'),
          ),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('Matter'));
        await tester.pumpAndSettle();
        expect(
          find.byKey(
            const ValueKey<String>('open-training-debrief-button'),
          ),
          findsNothing,
        );

        expect(repository.applyAction('request_judgment').isRisky, isFalse);
        expect(
          repository.applyAction('adverse_trial_judgment').isRisky,
          isFalse,
        );
        await tester.pumpAndSettle();
        expect(repository.snapshot.judicialResult, JudicialResult.lost);
        expect(
          repository.snapshot.dossier!.procedure.matterStatus,
          DossierMatterStatus.recoverable,
        );
        expect(repository.snapshot.isClosed, isFalse);
        expect(repository.snapshot.trainingDebrief, isNull);
        expect(
          bridge.latestSnapshotResponseJson,
          isNot(contains('"training_debrief"')),
        );
        expect(
          bridge.latestSnapshot.containsKey('training_debrief'),
          isFalse,
        );
        expect(
          find.byKey(
            const ValueKey<String>('open-training-debrief-button'),
          ),
          findsNothing,
        );

        expect(repository.applyAction('waive_appeal').isRisky, isFalse);
        await tester.pumpAndSettle();
        expect(repository.snapshot.isClosed, isTrue);
        expect(repository.snapshot.outcomeSummary?.finalStatus, 'final_loss');

        final Map<String, dynamic> resolvedRawSnapshot = bridge.latestSnapshot;
        final Map<String, dynamic> resolvedRawDebrief =
            resolvedRawSnapshot['training_debrief'] as Map<String, dynamic>;
        final TrainingDebriefView resolvedDebrief =
            repository.snapshot.trainingDebrief!;
        _expectRawTrainingDebriefMatches(
          raw: resolvedRawDebrief,
          mapped: resolvedDebrief,
        );
        expect(resolvedDebrief.projectionSchemaVersion, 1);
        expect(
          resolvedDebrief.scenarioId,
          'integration_adverse_judgment_with_remedies',
        );
        expect(resolvedDebrief.resolvedOutcomeId, 'final_loss');
        expect(resolvedDebrief.finalScenarioMinute, 65);
        expect(
          resolvedDebrief.matterLifecycle,
          TrainingDebriefMatterLifecycle.closed,
        );
        expect(
          resolvedDebrief.matterStatus,
          TrainingDebriefMatterStatus.closed,
        );
        expect(
          resolvedDebrief.executedActions.map(
            (TrainingDebriefActionView action) => <Object?>[
              action.actionId,
              action.sequence,
              action.completionMinute,
              action.timeCostMinutes,
              action.costEur,
              action.billableMinutes,
            ],
          ),
          <List<Object?>>[
            <Object?>['request_judgment', 1, 15, 15, 250, 0],
            <Object?>['adverse_trial_judgment', 2, 60, 45, 500, 0],
            <Object?>['waive_appeal', 3, 65, 5, 200, 0],
          ],
        );
        expect(resolvedDebrief.resources, isEmpty);
        expect(
          resolvedDebrief.reflectionPromptIds,
          <String>[
            'decisive_fact_or_evidence',
            'deadline_or_procedural_pressure',
            'time_or_budget_tradeoff',
            'alternative_replay_strategy',
          ],
        );

        final String resolvedRawDebriefJson = jsonEncode(resolvedRawDebrief);
        final List<Object?> resolvedMappedState = _trainingDebriefState(
          resolvedDebrief,
        );
        await repository.saveGame();
        repository.reset();
        await tester.pumpAndSettle();
        expect(repository.snapshot.trainingDebrief, isNull);
        expect(
          find.byKey(
            const ValueKey<String>('open-training-debrief-button'),
          ),
          findsNothing,
        );

        await repository.loadGame();
        await tester.pumpAndSettle();
        final Map<String, dynamic> restoredRawDebrief =
            bridge.latestSnapshot['training_debrief'] as Map<String, dynamic>;
        final TrainingDebriefView restoredDebrief =
            repository.snapshot.trainingDebrief!;
        expect(jsonEncode(restoredRawDebrief), resolvedRawDebriefJson);
        expect(_trainingDebriefState(restoredDebrief), resolvedMappedState);
        _expectRawTrainingDebriefMatches(
          raw: restoredRawDebrief,
          mapped: restoredDebrief,
        );

        final Finder openDebrief = find.byKey(
          const ValueKey<String>('open-training-debrief-button'),
        );
        await tester.scrollUntilVisible(
          openDebrief,
          240,
          scrollable: find.byType(Scrollable).last,
          maxScrolls: 30,
        );
        // On the API 37 phone viewport, scrollUntilVisible can stop while the
        // button's center is still behind HomeShell's bottom navigation bar.
        // Center this exact element in its nearest scrollable and require a
        // real hit-test target before asserting command-free navigation.
        await Scrollable.ensureVisible(
          tester.element(openDebrief),
          alignment: 0.5,
          duration: Duration.zero,
        );
        await tester.pumpAndSettle();
        expect(openDebrief.hitTestable(), findsOneWidget);
        final int dispatchesBeforeNavigation = bridge.commandCount('dispatch');
        final int requestsBeforeNavigation = bridge.requests.length;
        await tester.tap(openDebrief.hitTestable());
        await tester.pumpAndSettle();

        expect(
          find.byKey(const ValueKey<String>('training-debrief-screen')),
          findsOneWidget,
        );
        expect(find.text('Training debrief'), findsOneWidget);
        expect(find.text('Final loss'), findsOneWidget);
        expect(
          find.text('3 executed actions in authoritative order'),
          findsOneWidget,
        );
        for (final TrainingDebriefActionView action
            in restoredDebrief.executedActions) {
          expect(
            find.byKey(
              ValueKey<String>(
                'training-debrief-action-${action.sequence}-${action.actionId}',
              ),
            ),
            findsOneWidget,
          );
        }
        expect(
          find.byKey(
            const ValueKey<String>(
              'training-debrief-reflection-decisive_fact_or_evidence',
            ),
          ),
          findsOneWidget,
        );
        expect(bridge.commandCount('dispatch'), dispatchesBeforeNavigation);
        expect(bridge.requests, hasLength(requestsBeforeNavigation));

        await tester.pageBack();
        await tester.pumpAndSettle();
        expect(
          find.byKey(const ValueKey<String>('training-debrief-screen')),
          findsNothing,
        );
        expect(bridge.commandCount('dispatch'), dispatchesBeforeNavigation);
        expect(bridge.requests, hasLength(requestsBeforeNavigation));
      } finally {
        repository.dispose();
      }
    },
  );

  testWidgets(
    'native raw snapshot visibility survives Desert Water save restart load',
    (WidgetTester tester) async {
      const String hiddenFactId = 'chromium_detected_in_residential_wells';
      const String hiddenFactText =
          'Testing detected hexavalent chromium in identified residential wells.';
      final Map<String, dynamic> scenario = desertWater.scenario!;
      final NativeScenarioBridgeClient bridge = NativeScenarioBridgeClient();
      int? activeSessionId;

      ScenarioBridgeResponse execute(String request) {
        return ScenarioBridgeResponse.parse(bridge.execute(request));
      }

      void expectHidden(String raw, ScenarioBridgeResponse response) {
        expect(response.isError, isFalse);
        expect(raw, isNot(contains(hiddenFactId)));
        expect(raw, isNot(contains(hiddenFactText)));
        expect(
          response.snapshot!['facts'] as List<dynamic>,
          isNot(
            contains(
              isA<Map<String, dynamic>>().having(
                (Map<String, dynamic> item) => item['id'],
                'id',
                hiddenFactId,
              ),
            ),
          ),
        );
      }

      void expectRevealed(String raw, ScenarioBridgeResponse response) {
        expect(response.isError, isFalse);
        expect(raw, contains(hiddenFactId));
        expect(raw, contains(hiddenFactText));
        final Map<String, dynamic> snapshot = response.snapshot!;
        final List<dynamic> facts = snapshot['facts'] as List<dynamic>;
        expect(
          facts.where(
            (dynamic item) =>
                (item as Map<String, dynamic>)['id'] == hiddenFactId,
          ),
          hasLength(1),
        );
        final Map<String, dynamic> dossier =
            snapshot['dossier'] as Map<String, dynamic>;
        final List<dynamic> dossierFacts = dossier['facts'] as List<dynamic>;
        expect(
          dossierFacts.where(
            (dynamic item) =>
                (item as Map<String, dynamic>)['id'] == hiddenFactId,
          ),
          hasLength(1),
        );
      }

      try {
        final String createdRaw = bridge.execute(
          ScenarioBridgeCommand.createSession(
            scenario: scenario,
            seed: desertWater.seed,
          ),
        );
        final ScenarioBridgeResponse created =
            ScenarioBridgeResponse.parse(createdRaw);
        final int createdSessionId = created.sessionId!;
        activeSessionId = createdSessionId;
        expectHidden(createdRaw, created);

        final String acceptedRaw = bridge.execute(
          ScenarioBridgeCommand.dispatch(
            sessionId: createdSessionId,
            actionId: 'accept_residents_mandate',
          ),
        );
        final ScenarioBridgeResponse accepted =
            ScenarioBridgeResponse.parse(acceptedRaw);
        expectHidden(acceptedRaw, accepted);

        final String revealedRaw = bridge.execute(
          ScenarioBridgeCommand.dispatch(
            sessionId: createdSessionId,
            actionId: 'commission_defensible_sampling',
          ),
        );
        final ScenarioBridgeResponse revealed =
            ScenarioBridgeResponse.parse(revealedRaw);
        expectRevealed(revealedRaw, revealed);
        final String revealedSnapshot = jsonEncode(revealed.snapshot);

        final ScenarioBridgeResponse saved = execute(
          ScenarioBridgeCommand.saveSession(createdSessionId),
        );
        expect(saved.isError, isFalse);
        expect(saved.encodedSave, isNotNull);

        final ScenarioBridgeResponse disposed = execute(
          ScenarioBridgeCommand.disposeSession(createdSessionId),
        );
        expect(disposed.isError, isFalse);
        activeSessionId = null;

        // Restart only the isolated native session. This test never clears or
        // writes application storage, so the ordinary app session is intact.
        final String loadedRaw = bridge.execute(
          ScenarioBridgeCommand.loadSession(
            scenario: scenario,
            encodedSave: saved.encodedSave!,
          ),
        );
        final ScenarioBridgeResponse loaded =
            ScenarioBridgeResponse.parse(loadedRaw);
        activeSessionId = loaded.sessionId;
        expect(activeSessionId, isNotNull);
        expectRevealed(loadedRaw, loaded);
        expect(jsonEncode(loaded.snapshot), revealedSnapshot);
      } finally {
        if (activeSessionId case final int sessionId) {
          final ScenarioBridgeResponse disposed = execute(
            ScenarioBridgeCommand.disposeSession(sessionId),
          );
          expect(disposed.isError, isFalse);
        }
      }
    },
  );

  testWidgets(
    'production Desert Water reveals, restores, appeals, and closes natively',
    (WidgetTester tester) async {
      MobileCaseDefinition? selectedCase;
      String? selectedLocale;
      await tester.pumpWidget(
        MaterialApp(
          theme: JurisTheme.dark(),
          home: CaseCatalogScreen(
            bundle: productionBundle,
            onStartCase: (
              MobileCaseDefinition definition,
              String locale,
              CaseCatalogBundle _,
            ) {
              selectedCase = definition;
              selectedLocale = locale;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      final Finder desertIndexItem = find.byKey(
        const ValueKey<String>(
          'case-index-item-us_environmental_desert_water_001',
        ),
      );
      await tester.ensureVisible(desertIndexItem);
      await tester.pumpAndSettle();
      await tester.tap(desertIndexItem);
      await tester.pumpAndSettle();

      expect(
        find.text(
          'Sundial Mesa Residents Association v. Caldera Compression & Cooling Inc.',
        ),
        findsOneWidget,
      );
      final Finder start = find.byKey(
        const ValueKey<String>('start-case-action'),
      );
      expect(start, findsOneWidget);
      await tester.ensureVisible(start);
      await tester.pumpAndSettle();
      await tester.tap(start);
      await tester.pump();

      expect(selectedCase?.caseId, desertWater.caseId);
      expect(selectedCase?.scenarioId, 'desert_water_groundwater_claim');
      expect(selectedCase?.seed, 20260804);
      expect(selectedLocale, 'en');

      final RustScenarioRepository repository = _repository(
        selectedCase!,
        locale: 'en',
      );
      expect(repository.supportsLiveClock, isTrue);
      expect(repository.snapshot.stage, 'Community intake');
      expect(repository.snapshot.timeLabel, '08:00');
      expect(
        repository.snapshot.dossier!.facts
            .map((DossierFactView item) => item.id),
        <String>[
          'community_reports_shared_exposure',
          'medical_causation_requires_individual_proof',
        ],
      );
      expect(
        repository.snapshot.dossier!.evidence
            .map((DossierEvidenceView item) => item.id),
        <String>['community_well_register', 'public_facility_permit'],
      );

      await tester.pumpWidget(
        MaterialApp(home: HomeShell(repository: repository, locale: 'en')),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Matter'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey<String>('open-dossier-button')),
        240,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(
        find.byKey(const ValueKey<String>('open-dossier-button')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Matter dossier'), findsOneWidget);
      expect(
        find.text(
          'The groundwater plume links the Caldera facility to the affected wells.',
        ),
        findsNothing,
      );
      expect(find.text('Hydrogeological source assessment'), findsNothing);
      await tester.pageBack();
      await tester.pumpAndSettle();

      expect(
        repository.applyAction('accept_residents_mandate').isRisky,
        isFalse,
      );
      expect(
        repository.applyAction('commission_defensible_sampling').isRisky,
        isFalse,
      );
      await tester.pump();
      expect(
        repository.snapshot.dossier!.facts
            .map((DossierFactView item) => item.id),
        containsAll(<String>[
          'chromium_detected_in_residential_wells',
          'sampling_chain_is_defensible',
        ]),
      );
      expect(
        repository.snapshot.dossier!.evidence
            .map((DossierEvidenceView item) => item.id),
        containsAll(<String>[
          'independent_lab_results',
          'sampling_chain_record',
        ]),
      );

      // The reveal checkpoint uses the defensible branch. Reset before the
      // canonical compromised trace so its exact minute-3180 remedy boundary
      // remains stable and independently reproducible.
      repository.reset();
      for (final String actionId in <String>[
        'accept_residents_mandate',
        'rely_on_unverified_samples',
        'interview_affected_residents',
      ]) {
        expect(repository.applyAction(actionId).isRisky, isFalse);
      }
      repository.advanceTimeByMinutes(511);
      expect(
        _deadline(repository, 'plant_record_preservation_deadline').status,
        DeadlineStatus.missed,
      );
      repository.advanceTimeByMinutes(720);
      expect(
        _deadline(repository, 'limitation_protection_deadline').status,
        DeadlineStatus.missed,
      );
      repository.advanceTimeByMinutes(1439);
      for (final String actionId in <String>[
        'prepare_incomplete_claim',
        'file_underdeveloped_claim',
        'receive_adverse_first_instance_judgment',
      ]) {
        expect(repository.applyAction(actionId).isRisky, isFalse);
      }

      expect(repository.snapshot.dayLabel, 'Day 3');
      expect(repository.snapshot.timeLabel, '13:00');
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
      expect(repository.snapshot.outcomeSummary, isNull);
      expect(
        _deadline(repository, 'appeal_deadline').status,
        DeadlineStatus.open,
      );
      final DossierProjectionView recoverable = repository.snapshot.dossier!;
      expect(
        recoverable.procedure.matterStatus,
        DossierMatterStatus.recoverable,
      );
      expect(
        recoverable.deadlines
            .singleWhere(
              (DossierDeadlineView item) => item.id == 'appeal_deadline',
            )
            .remedies
            .map((DossierRemedyView item) => item.actionId),
        <String>['file_appeal'],
      );

      final String savedStage = repository.snapshot.stage;
      final String savedTime = repository.snapshot.timeLabel;
      final List<List<Object?>> savedInbox =
          repository.snapshot.inbox.map(_inboxState).toList(growable: false);
      final List<List<Object?>> savedDeadlines = repository.snapshot.deadlines
          .map(_deadlineState)
          .toList(growable: false);
      final List<Object?> savedDossier = _dossierState(recoverable);
      await repository.saveGame();
      repository.reset();
      await repository.loadGame();
      expect(repository.snapshot.stage, savedStage);
      expect(repository.snapshot.timeLabel, savedTime);
      expect(repository.snapshot.inbox.map(_inboxState), savedInbox);
      expect(repository.snapshot.deadlines.map(_deadlineState), savedDeadlines);
      expect(_dossierState(repository.snapshot.dossier!), savedDossier);
      await repository.loadGame();
      expect(_dossierState(repository.snapshot.dossier!), savedDossier);
      expect(
        repository.snapshot.dossier!.facts
            .map((DossierFactView item) => item.id)
            .toSet()
            .length,
        repository.snapshot.dossier!.facts.length,
      );
      expect(
        repository.snapshot.dossier!.evidence
            .map((DossierEvidenceView item) => item.id)
            .toSet()
            .length,
        repository.snapshot.dossier!.evidence.length,
      );

      for (final String actionId in <String>[
        'file_appeal',
        'receive_adverse_appeal_judgment',
      ]) {
        expect(repository.applyAction(actionId).isRisky, isFalse);
      }
      expect(repository.snapshot.timeLabel, '18:00');
      expect(
        repository.snapshot.judicialDecisionInstance,
        JudicialDecisionInstance.appeal,
      );
      expect(repository.snapshot.matterLifecycle, MatterLifecycleStatus.appeal);
      expect(repository.snapshot.isClosed, isFalse);
      expect(repository.snapshot.outcomeSummary, isNull);

      expect(
        repository.applyAction('close_after_adverse_appeal').isRisky,
        isFalse,
      );
      expect(repository.snapshot.timeLabel, '18:30');
      expect(repository.snapshot.isClosed, isTrue);
      expect(
        repository.snapshot.outcomeSummary?.finalStatus,
        'compromised_claim_closed',
      );
      final GameSnapshot closed = repository.snapshot;
      final List<Object?> closedDossier = _dossierState(closed.dossier!);
      expect(
        repository.applyAction('close_after_adverse_appeal').isRisky,
        isTrue,
      );
      expect(repository.snapshot, same(closed));
      expect(
        () => repository.advanceTimeByMinutes(1),
        throwsA(
          isA<ScenarioClockAdvanceException>().having(
            (ScenarioClockAdvanceException error) => error.code,
            'code',
            'scenario_resolved',
          ),
        ),
      );
      expect(repository.snapshot, same(closed));
      expect(_dossierState(repository.snapshot.dossier!), closedDossier);
      repository.dispose();
    },
  );
}

List<Object?> _dossierState(DossierProjectionView dossier) {
  return <Object?>[
    dossier.projectionSchemaVersion,
    dossier.procedure.stageId,
    dossier.procedure.stageTitle,
    dossier.procedure.clockMinutes,
    dossier.procedure.matterLifecycle.name,
    dossier.procedure.isClosed,
    dossier.procedure.matterStatus.name,
    dossier.judicialResult?.name,
    dossier.judicialDecisionInstance?.name,
    dossier.facts
        .map(
          (DossierFactView item) => <Object?>[
            item.id,
            item.statement,
            item.status.name,
          ],
        )
        .toList(growable: false),
    dossier.evidence
        .map(
          (DossierEvidenceView item) => <Object?>[
            item.id,
            item.title,
            item.kind,
            item.description,
            item.supportsFactIds,
            item.contradictsFactIds,
          ],
        )
        .toList(growable: false),
    dossier.deadlines
        .map(
          (DossierDeadlineView item) => <Object?>[
            item.id,
            item.title,
            item.dueAtMinutes,
            item.status.name,
            item.remedies
                .map(
                  (DossierRemedyView remedy) => <Object?>[
                    remedy.actionId,
                    remedy.title,
                    remedy.description,
                    remedy.timeCostMinutes,
                    remedy.costEur,
                  ],
                )
                .toList(growable: false),
          ],
        )
        .toList(growable: false),
    if (dossier.outcome case final DossierOutcomeView outcome)
      <Object?>[outcome.id, outcome.title, outcome.summary]
    else
      null,
  ];
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

final class _MemoryGameSaveStore implements GameSaveStore {
  String? encodedSave;

  @override
  Future<bool> exists(String slotId) async => encodedSave != null;

  @override
  Future<String> read(String slotId) async => encodedSave!;

  @override
  Future<void> write(String slotId, String encodedSave) async {
    this.encodedSave = encodedSave;
  }
}

const String _historicalGreenFireV1Save =
    '{"schema_id":"genesis.ai-juris.command-log","schema_version":1,'
    '"runtime_compatibility":"scenario-runtime-v1",'
    '"scenario_id":"greenfire_first_72_hours",'
    '"scenario_fingerprint":"b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261",'
    '"seed":20260729,"commands":['
    '{"command":"dispatch","action_id":"accept_emergency_mandate"},'
    '{"command":"advance_time","minutes":360},'
    '{"command":"dispatch","action_id":"release_unreviewed_documents"},'
    '{"command":"advance_time","minutes":360},'
    '{"command":"advance_time","minutes":360},'
    '{"command":"advance_time","minutes":360},'
    '{"command":"advance_time","minutes":360},'
    '{"command":"advance_time","minutes":360},'
    '{"command":"advance_time","minutes":360},'
    '{"command":"advance_time","minutes":360},'
    '{"command":"advance_time","minutes":360},'
    '{"command":"advance_time","minutes":360},'
    '{"command":"advance_time","minutes":360},'
    '{"command":"advance_time","minutes":360},'
    '{"command":"dispatch","action_id":"complete_compromised_handoff"}],'
    '"final_state_digest":"f048a70b6abe0cfc67682c2ac4968ce03e27dee9f647bcefc19e26b77ec7ab04"}';

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

List<Object?> _trainingDebriefState(TrainingDebriefView debrief) => <Object?>[
      debrief.projectionSchemaVersion,
      debrief.scenarioId,
      debrief.scenarioTitle,
      debrief.resolvedOutcomeId,
      debrief.resolvedOutcomeTitle,
      debrief.finalScenarioMinute,
      debrief.matterLifecycle,
      debrief.matterStatus,
      debrief.executedActions
          .map(
            (TrainingDebriefActionView action) => <Object?>[
              action.actionId,
              action.title,
              action.sequence,
              action.completionMinute,
              action.timeCostMinutes,
              action.costEur,
              action.billableMinutes,
            ],
          )
          .toList(growable: false),
      debrief.resources
          .map(
            (TrainingDebriefResourceView resource) => <Object?>[
              resource.resourceId,
              resource.label,
              resource.initialValue,
              resource.currentValue,
            ],
          )
          .toList(growable: false),
      debrief.reflectionPromptIds,
    ];

void _expectRawTrainingDebriefMatches({
  required Map<String, dynamic> raw,
  required TrainingDebriefView mapped,
}) {
  expect(raw['projection_schema_version'], mapped.projectionSchemaVersion);
  expect(raw['scenario_id'], mapped.scenarioId);
  expect(raw['resolved_outcome_id'], mapped.resolvedOutcomeId);
  expect(raw['final_scenario_minute'], mapped.finalScenarioMinute);
  expect(raw['matter_lifecycle'], mapped.matterLifecycle.name);
  expect(raw['matter_status'], mapped.matterStatus.name);
  expect(
    (raw['executed_actions'] as List<dynamic>).map(
      (dynamic item) {
        final Map<String, dynamic> action = item as Map<String, dynamic>;
        return <Object?>[
          action['action_id'],
          action['sequence'],
          action['completion_minute'],
          action['time_cost_minutes'],
          action['cost_eur'],
          action['billable_minutes'],
        ];
      },
    ),
    mapped.executedActions.map(
      (TrainingDebriefActionView action) => <Object?>[
        action.actionId,
        action.sequence,
        action.completionMinute,
        action.timeCostMinutes,
        action.costEur,
        action.billableMinutes,
      ],
    ),
  );
  expect(
    (raw['resources'] as List<dynamic>).map(
      (dynamic item) {
        final Map<String, dynamic> resource = item as Map<String, dynamic>;
        return <Object?>[
          resource['resource_id'],
          resource['initial_value'],
          resource['current_value'],
        ];
      },
    ),
    mapped.resources.map(
      (TrainingDebriefResourceView resource) => <Object?>[
        resource.resourceId,
        resource.initialValue,
        resource.currentValue,
      ],
    ),
  );
  expect(raw['reflection_prompt_ids'], mapped.reflectionPromptIds);
}

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

/// Records the exact native JSON boundary while delegating every command to
/// the production Android FFI transport.
final class _RecordingNativeBridge implements ScenarioBridgeClient {
  final NativeScenarioBridgeClient _delegate = NativeScenarioBridgeClient();
  final List<Map<String, dynamic>> requests = <Map<String, dynamic>>[];
  final List<Map<String, dynamic>> _snapshotResponses =
      <Map<String, dynamic>>[];
  final List<String> _snapshotResponseJson = <String>[];

  Map<String, dynamic> get latestSnapshot => _snapshotResponses.last;
  String get latestSnapshotResponseJson => _snapshotResponseJson.last;

  int commandCount(String command) => requests
      .where((Map<String, dynamic> request) => request['command'] == command)
      .length;

  @override
  String execute(String encodedRequest) {
    requests.add(jsonDecode(encodedRequest) as Map<String, dynamic>);
    final String encodedResponse = _delegate.execute(encodedRequest);
    final Map<String, dynamic> response =
        jsonDecode(encodedResponse) as Map<String, dynamic>;
    if (response['snapshot'] case final Map<String, dynamic> snapshot) {
      _snapshotResponses.add(snapshot);
      _snapshotResponseJson.add(encodedResponse);
    }
    return encodedResponse;
  }
}
