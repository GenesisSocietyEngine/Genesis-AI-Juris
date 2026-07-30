import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/data/game_save_store.dart';
import 'package:juris_mobile/data/native_scenario_bridge_client.dart';
import 'package:juris_mobile/data/rust_scenario_repository.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/game_snapshot.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late MobileCaseDefinition logistics;
  late MobileCaseDefinition greenfire;
  late MobileCaseDefinition goldenshell;

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
}

RustScenarioRepository _repository(
  MobileCaseDefinition definition, {
  GameSaveStore? saveStore,
}) {
  return RustScenarioRepository(
    caseDefinition: definition,
    locale: definition.caseId == 'be_commercial_logistics_001' ? 'en' : 'ru',
    bridgeClient: NativeScenarioBridgeClient(),
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
