import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/app/gameplay_locale.dart';
import 'package:juris_mobile/app/juris_app.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/screens/inbox_screen.dart';
import 'package:juris_mobile/widgets/action_picker_sheet.dart';

void main() {
  testWidgets(
    'summary badge and rendered red notes share the four-entry adapter count',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(412, 915);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final _StaticRepository repository = _StaticRepository(
        _snapshot(
          inbox: <InboxItemView>[
            for (int index = 0; index < 4; index += 1)
              _item('required-$index', InboxStatus.actionRequired, index),
          ],
          actions: const <GameActionView>[
            GameActionView(
              id: 'one-decision',
              title: 'One projected decision',
              description: 'The only currently available decision.',
              timeLabel: '10 minutes',
              costEur: 0,
              tone: ActionTone.neutral,
            ),
          ],
        ),
      );

      await tester.pumpWidget(JurisApp(repository: repository));
      await tester.pump();

      expect(find.text('4 responses require attention'), findsOneWidget);
      expect(find.text('ACTION REQUIRED'), findsNWidgets(4));
      expect(
        find.byWidgetPredicate(
          (Widget widget) =>
              widget is Badge &&
              widget.label is Text &&
              (widget.label! as Text).data == '4',
        ),
        findsOneWidget,
      );
      expect(find.text('Decisions · 1'), findsOneWidget);
      expect(find.textContaining('Actions ·'), findsNothing);

      await tester.tap(find.byKey(
        const ValueKey<String>('available-decisions-control'),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(ActionPickerSheet), findsOneWidget);
      expect(find.text('One projected decision'), findsOneWidget);
    },
  );

  testWidgets('zero attention uses a calm state and no count badge', (
    WidgetTester tester,
  ) async {
    await _pumpInbox(
      tester,
      locale: 'en',
      snapshot: _snapshot(),
    );

    expect(find.text('No responses require attention'), findsOneWidget);
    expect(find.byIcon(Icons.check_outlined), findsOneWidget);
    expect(find.text('ACTION REQUIRED'), findsNothing);
  });

  testWidgets('English singular and Russian plural wording are explicit', (
    WidgetTester tester,
  ) async {
    await _pumpInbox(
      tester,
      locale: 'en',
      snapshot: _snapshot(
        inbox: <InboxItemView>[
          _item('required', InboxStatus.actionRequired, 1),
        ],
      ),
    );
    expect(find.text('1 response requires attention'), findsOneWidget);

    await _pumpInbox(
      tester,
      locale: 'ru',
      snapshot: _snapshot(
        inbox: <InboxItemView>[
          for (int index = 0; index < 4; index += 1)
            _item('required-$index', InboxStatus.actionRequired, index),
        ],
      ),
    );
    expect(find.text('4 ответа требуют внимания'), findsOneWidget);
    expect(find.text('ТРЕБУЕТСЯ ДЕЙСТВИЕ'), findsNWidgets(4));
  });
}

Future<void> _pumpInbox(
  WidgetTester tester, {
  required String locale,
  required GameSnapshot snapshot,
}) {
  return tester.pumpWidget(
    MaterialApp(
      theme: JurisTheme.dark(),
      home: GameplayLocale(
        locale: locale,
        child: Scaffold(
          body: InboxScreen(
            snapshot: snapshot,
            onMessageTap: (_) {},
            onCaseReportTap: () {},
          ),
        ),
      ),
    ),
  );
}

InboxItemView _item(String id, InboxStatus status, int minute) {
  return InboxItemView(
    id: id,
    sender: 'Sender $id',
    subject: 'Subject $id',
    body: 'Body $id',
    receivedAt: 'Day 1 · 08:${minute.toString().padLeft(2, '0')}',
    status: status,
  );
}

GameSnapshot _snapshot({
  List<InboxItemView> inbox = const <InboxItemView>[],
  List<GameActionView> actions = const <GameActionView>[],
}) {
  return GameSnapshot(
    version: 'inbox-presentation-test-v1',
    seed: 20260811,
    mode: 'Authoritative Rust',
    dayLabel: 'Day 1',
    timeLabel: '08:00',
    stage: 'Emergency intake',
    caseResultStatus: CaseResultStatus.ongoing,
    engagementStatus: EngagementStatus.active,
    matterTitle: 'GreenFire — The First 72 Hours',
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

final class _StaticRepository extends GameRuntimeRepository {
  _StaticRepository(this._snapshot);

  final GameSnapshot _snapshot;

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
  void markInboxItemRead(String itemId) {}

  @override
  void reset() {}

  @override
  ActionExecutionResult applyAction(String actionId) {
    return const ActionExecutionResult(
      title: 'Applied',
      message: 'Applied',
      isRisky: false,
    );
  }
}
