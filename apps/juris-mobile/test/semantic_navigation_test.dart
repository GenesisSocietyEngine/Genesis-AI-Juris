import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/juris_app.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/models/game_snapshot.dart';

void main() {
  testWidgets('AI action selection uses semantic tags, not an English title', (
    WidgetTester tester,
  ) async {
    final _SemanticRepository repository = _SemanticRepository(
      _snapshot(
        actions: const <GameActionView>[
          GameActionView(
            id: 'localized-ai-research',
            title: 'Подготовить правовой обзор',
            description: 'Исследовать применимое право.',
            timeLabel: '45 min',
            costEur: 300,
            tone: ActionTone.primary,
            presentationTags: <String>['ai'],
          ),
          GameActionView(
            id: 'ordinary-client-call',
            title: 'Позвонить клиенту',
            description: 'Уточнить коммерческую позицию.',
            timeLabel: '20 min',
            costEur: 100,
            tone: ActionTone.neutral,
          ),
        ],
      ),
    );

    await tester.pumpWidget(JurisApp(repository: repository));
    await tester.tap(find.text('AI'));
    await tester.pumpAndSettle();

    final Finder showAiActions = find.text('Show AI actions');
    await tester.scrollUntilVisible(
      showAiActions,
      300,
      scrollable: find.byType(Scrollable).last,
      maxScrolls: 10,
    );
    await tester.tap(showAiActions);
    await tester.pumpAndSettle();

    expect(find.text('Подготовить правовой обзор'), findsOneWidget);
    expect(find.text('Позвонить клиенту'), findsNothing);
  });

  testWidgets('inbox responses use projected resolution action IDs', (
    WidgetTester tester,
  ) async {
    final _SemanticRepository repository = _SemanticRepository(
      _snapshot(
        inbox: const <InboxItemView>[
          InboxItemView(
            id: 'scenario-defined-request',
            sender: 'Клиент',
            subject: 'Нужен ответ по новому вопросу',
            body: 'Выберите сценарное действие.',
            receivedAt: 'Day 1 · 08:05',
            status: InboxStatus.actionRequired,
            resolutionActionIds: <String>['scenario-defined-response'],
          ),
        ],
        actions: const <GameActionView>[
          GameActionView(
            id: 'scenario-defined-response',
            title: 'Отправить сценарный ответ',
            description: 'Ответить в рамках текущей стратегии.',
            timeLabel: '15 min',
            costEur: 80,
            tone: ActionTone.primary,
          ),
          GameActionView(
            id: 'unrelated-action',
            title: 'Несвязанное действие',
            description: 'Не относится к этому сообщению.',
            timeLabel: '10 min',
            costEur: 50,
            tone: ActionTone.neutral,
          ),
        ],
      ),
    );

    await tester.pumpWidget(JurisApp(repository: repository));
    await tester.tap(
      find.byKey(
        const ValueKey<String>('inbox-item-scenario-defined-request'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Отправить сценарный ответ'), findsOneWidget);
    expect(find.text('Несвязанное действие'), findsNothing);

    await tester.tap(find.text('Отправить сценарный ответ'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yes'));
    await tester.pumpAndSettle();

    expect(repository.lastAppliedActionId, 'scenario-defined-response');
  });
}

GameSnapshot _snapshot({
  List<InboxItemView> inbox = const <InboxItemView>[],
  List<GameActionView> actions = const <GameActionView>[],
}) {
  return GameSnapshot(
    version: 'semantic-navigation-test-v1',
    seed: 20260804,
    mode: 'Authoritative Rust',
    dayLabel: 'Day 1',
    timeLabel: '08:00',
    stage: 'Intake',
    caseResultStatus: CaseResultStatus.ongoing,
    engagementStatus: EngagementStatus.active,
    matterTitle: 'Semantic projection fixture',
    caseStrength: 50,
    merits: 50,
    evidenceScore: 50,
    procedure: 50,
    leverage: 50,
    spendEur: 0,
    authorizedBudgetEur: 10000,
    billableMinutes: 0,
    fatigue: 0,
    cumulativeStrain: 0,
    ethics: 100,
    clientTrust: 75,
    inactivityMinutes: 0,
    clientWarningLevel: 0,
    aiRequestsUsed: 0,
    aiRequestLimit: 5,
    knownFactsRevision: 0,
    aiLegalResearchRevision: 0,
    aiDamagesModelRevision: 0,
    expertReviewStatus: ExpertReviewStatus.notCommissioned,
    expertReportDueDay: 0,
    juniorReviewStatus: JuniorReviewStatus.notDelegated,
    juniorReviewDueDay: 0,
    juniorReviewDueMinute: 0,
    inbox: inbox,
    deadlines: const <DeadlineView>[],
    evidence: const <EvidenceView>[],
    actions: actions,
    latestAiNote: null,
  );
}

final class _SemanticRepository extends GameRuntimeRepository {
  _SemanticRepository(this._snapshot);

  GameSnapshot _snapshot;
  String? lastAppliedActionId;

  @override
  GameSnapshot get snapshot => _snapshot;

  @override
  bool get isTerminal => false;

  @override
  bool get supportsLiveClock => false;

  @override
  String? get clockErrorMessage => null;

  @override
  void advanceTimeByMinutes(int minutes) {}

  @override
  ActionExecutionResult applyAction(String actionId) {
    lastAppliedActionId = actionId;
    return const ActionExecutionResult(
      title: 'Action complete',
      message: 'The projected action was dispatched.',
      isRisky: false,
    );
  }

  @override
  void markInboxItemRead(String itemId) {
    _snapshot = _snapshot.copyWith(
      inbox: _snapshot.inbox
          .map(
            (InboxItemView item) =>
                item.id == itemId && item.status == InboxStatus.unread
                    ? item.copyWith(status: InboxStatus.read)
                    : item,
          )
          .toList(growable: false),
    );
    notifyListeners();
  }

  @override
  void reset() {}
}
