import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/home_shell.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/models/training_debrief.dart';
import 'package:juris_mobile/screens/training_debrief_screen.dart';

void main() {
  testWidgets(
    'debrief is ordered and scrollable at 360x640 with scaled long text',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          builder: (BuildContext context, Widget? child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: const TextScaler.linear(1.35),
            ),
            child: child!,
          ),
          home: TrainingDebriefScreen(
            debrief: _debrief(longActionTitle: true),
            locale: 'en',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.byKey(const ValueKey<String>('training-debrief-screen')),
        findsOneWidget,
      );
      expect(find.text('Result'), findsOneWidget);
      expect(find.text('Decision trail'), findsOneWidget);
      expect(
        find.text('2 executed actions in authoritative order'),
        findsOneWidget,
      );
      expect(
        find.byKey(
          const ValueKey<String>(
            'training-debrief-action-1-z_first_decision',
          ),
        ),
        findsOneWidget,
      );
      expect(
        find.byKey(
          const ValueKey<String>(
            'training-debrief-action-2-a_second_decision',
          ),
        ),
        findsOneWidget,
      );

      await tester.scrollUntilVisible(
        find.byKey(
          const ValueKey<String>('training-debrief-reflection-section'),
        ),
        280,
        scrollable: find.byType(Scrollable).last,
        maxScrolls: 30,
      );
      await tester.pumpAndSettle();
      expect(find.text('Time and resources'), findsOneWidget);
      expect(find.text('Reflection'), findsOneWidget);
      expect(
        find.text(
          'Which revealed fact or item of evidence most changed your strategy?',
        ),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Russian screen localizes stable IDs without changing order', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: TrainingDebriefScreen(
          debrief: _debrief(russian: true),
          locale: 'ru',
        ),
      ),
    );

    expect(find.text('Разбор прохождения'), findsOneWidget);
    expect(find.text('Результат'), findsOneWidget);
    expect(find.text('Позиция защищена'), findsOneWidget);
    expect(find.text('Первое решение'), findsOneWidget);
    expect(find.text('Второе решение'), findsOneWidget);
    expect(
      find.text(
        'Какой срок или процессуальное ограничение создали наибольшее давление?',
      ),
      findsOneWidget,
    );
  });

  testWidgets('active and recoverable snapshots do not expose an entry point', (
    WidgetTester tester,
  ) async {
    for (final MatterLifecycleStatus lifecycle in <MatterLifecycleStatus>[
      MatterLifecycleStatus.active,
      MatterLifecycleStatus.postJudgment,
    ]) {
      final _DebriefRepository repository = _DebriefRepository(
        snapshot: _snapshot(
          lifecycle: lifecycle,
          isClosed: false,
          debrief: null,
        ),
      );
      await tester.pumpWidget(
        MaterialApp(
          key: ValueKey<MatterLifecycleStatus>(lifecycle),
          home: HomeShell(repository: repository),
        ),
      );
      await tester.tap(find.text('Matter'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(
          const ValueKey<String>('open-training-debrief-button'),
        ),
        findsNothing,
      );
      repository.dispose();
    }
  });

  testWidgets('open and close suspend clock without dispatching a command', (
    WidgetTester tester,
  ) async {
    final _DebriefRepository repository = _DebriefRepository(
      snapshot: _snapshot(debrief: _debrief()),
      supportsLiveClock: true,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: HomeShell(
          repository: repository,
          enableLiveClockInTests: true,
        ),
      ),
    );
    await tester.tap(find.text('Matter'));
    await tester.pumpAndSettle();
    final Finder entry = find.byKey(
      const ValueKey<String>('open-training-debrief-button'),
    );
    await tester.scrollUntilVisible(
      entry,
      240,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(entry);
    await tester.pumpAndSettle();

    expect(find.text('Training debrief'), findsOneWidget);
    await tester.pump(const Duration(seconds: 8));
    expect(repository.advanceCount, 0);
    expect(repository.applyActionCount, 0);
    expect(repository.resetCount, 0);

    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(repository.advanceCount, 0);
    expect(repository.applyActionCount, 0);
    expect(repository.resetCount, 0);

    await tester.pump(const Duration(seconds: 4));
    expect(repository.advanceCount, 1);
    repository.dispose();
  });

  testWidgets('replay returns to the existing confirmed reset flow', (
    WidgetTester tester,
  ) async {
    final _DebriefRepository repository = _DebriefRepository(
      snapshot: _snapshot(
        lifecycle: MatterLifecycleStatus.closed,
        isClosed: true,
        debrief: _debrief(),
      ),
    );
    await tester.pumpWidget(
      MaterialApp(home: HomeShell(repository: repository)),
    );
    await tester.tap(find.text('Matter'));
    await tester.pumpAndSettle();

    Future<void> openAndRequestReplay() async {
      final Finder entry = find.byKey(
        const ValueKey<String>('open-training-debrief-button'),
      );
      await tester.scrollUntilVisible(
        entry,
        240,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(entry);
      await tester.pumpAndSettle();
      final Finder replay = find.byKey(
        const ValueKey<String>('training-debrief-replay-button'),
      );
      await tester.scrollUntilVisible(
        replay,
        280,
        scrollable: find.byType(Scrollable).last,
        maxScrolls: 30,
      );
      await tester.tap(replay);
      await tester.pumpAndSettle();
    }

    await openAndRequestReplay();
    expect(find.text('Reset playtest?'), findsOneWidget);
    expect(repository.resetCount, 0);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(repository.resetCount, 0);

    await openAndRequestReplay();
    await tester.tap(find.text('Reset'));
    await tester.pumpAndSettle();
    expect(repository.resetCount, 1);
    expect(repository.applyActionCount, 0);
    expect(repository.snapshot.trainingDebrief, isNull);
    expect(
      find.byKey(const ValueKey<String>('open-training-debrief-button')),
      findsNothing,
    );
    repository.dispose();
  });
}

TrainingDebriefView _debrief({
  bool russian = false,
  bool longActionTitle = false,
}) {
  return TrainingDebriefView(
    projectionSchemaVersion: 1,
    scenarioId: 'training_debrief_fixture',
    scenarioTitle:
        russian ? 'Тест разбора прохождения' : 'Training Debrief fixture',
    resolvedOutcomeId: 'protected_position',
    resolvedOutcomeTitle: russian ? 'Позиция защищена' : 'Protected position',
    finalScenarioMinute: 195,
    matterLifecycle: TrainingDebriefMatterLifecycle.closed,
    matterStatus: TrainingDebriefMatterStatus.closed,
    executedActions: <TrainingDebriefActionView>[
      TrainingDebriefActionView(
        actionId: 'z_first_decision',
        title: russian
            ? 'Первое решение'
            : longActionTitle
                ? 'Preserve the exceptionally long cross-border evidentiary record before the procedural deadline expires'
                : 'First decision',
        sequence: 1,
        completionMinute: 75,
        timeCostMinutes: 75,
        costEur: 900,
        billableMinutes: 60,
      ),
      TrainingDebriefActionView(
        actionId: 'a_second_decision',
        title: russian ? 'Второе решение' : 'Second decision',
        sequence: 2,
        completionMinute: 195,
        timeCostMinutes: 120,
        costEur: 1500,
        billableMinutes: 105,
      ),
    ],
    resources: <TrainingDebriefResourceView>[
      TrainingDebriefResourceView(
        resourceId: 'authorized_budget_eur',
        label: russian ? 'Утверждённый бюджет' : 'Authorized budget',
        initialValue: 10000,
        currentValue: 10000,
      ),
      TrainingDebriefResourceView(
        resourceId: 'spend_eur',
        label: russian ? 'Расходы' : 'Spend',
        initialValue: 0,
        currentValue: 2400,
      ),
    ],
    reflectionPromptIds: <String>[
      'decisive_fact_or_evidence',
      'deadline_or_procedural_pressure',
      'time_or_budget_tradeoff',
      'alternative_replay_strategy',
    ],
  );
}

GameSnapshot _snapshot({
  MatterLifecycleStatus lifecycle = MatterLifecycleStatus.active,
  bool isClosed = false,
  TrainingDebriefView? debrief,
}) {
  return GameSnapshot(
    version: 'training-debrief-test-v1',
    seed: 23,
    mode: 'Authoritative Rust',
    dayLabel: 'Day 1',
    timeLabel: '11:15',
    stage: isClosed ? 'Resolved' : 'Active review',
    caseResultStatus:
        isClosed ? CaseResultStatus.settled : CaseResultStatus.ongoing,
    engagementStatus:
        isClosed ? EngagementStatus.completed : EngagementStatus.active,
    matterTitle: 'Training Debrief fixture',
    caseStrength: 50,
    merits: 50,
    evidenceScore: 50,
    procedure: 50,
    leverage: 50,
    spendEur: 2400,
    authorizedBudgetEur: 10000,
    billableMinutes: 165,
    fatigue: 0,
    cumulativeStrain: 0,
    ethics: 100,
    clientTrust: 75,
    inactivityMinutes: 0,
    clientWarningLevel: 0,
    aiRequestsUsed: 0,
    aiRequestLimit: 0,
    knownFactsRevision: 0,
    aiLegalResearchRevision: 0,
    aiDamagesModelRevision: 0,
    expertReviewStatus: ExpertReviewStatus.notCommissioned,
    expertReportDueDay: 0,
    juniorReviewStatus: JuniorReviewStatus.notDelegated,
    juniorReviewDueDay: 0,
    juniorReviewDueMinute: 0,
    inbox: const <InboxItemView>[],
    deadlines: const <DeadlineView>[],
    evidence: const <EvidenceView>[],
    actions: const <GameActionView>[],
    latestAiNote: null,
    matterLifecycle: lifecycle,
    isClosed: isClosed,
    trainingDebrief: debrief,
  );
}

final class _DebriefRepository extends GameRuntimeRepository {
  _DebriefRepository({
    required GameSnapshot snapshot,
    this.supportsLiveClock = false,
  }) : _snapshot = snapshot;

  GameSnapshot _snapshot;
  @override
  final bool supportsLiveClock;
  int advanceCount = 0;
  int applyActionCount = 0;
  int resetCount = 0;

  @override
  GameSnapshot get snapshot => _snapshot;

  @override
  bool get isTerminal => _snapshot.isClosed;

  @override
  String? get clockErrorMessage => null;

  @override
  void advanceTimeByMinutes(int minutes) {
    advanceCount += 1;
  }

  @override
  ActionExecutionResult applyAction(String actionId) {
    applyActionCount += 1;
    return const ActionExecutionResult(
      title: 'Unexpected action',
      message: 'No action should be dispatched by the debrief.',
      isRisky: true,
    );
  }

  @override
  void markInboxItemRead(String itemId) {}

  @override
  void reset() {
    resetCount += 1;
    _snapshot = _snapshot.copyWith(
      matterLifecycle: MatterLifecycleStatus.active,
      isClosed: false,
      clearTrainingDebrief: true,
      clearOutcomeSummary: true,
    );
    notifyListeners();
  }
}
