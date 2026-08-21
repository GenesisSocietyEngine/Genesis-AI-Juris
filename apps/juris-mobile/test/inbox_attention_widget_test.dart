import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/app/gameplay_locale.dart';
import 'package:juris_mobile/app/home_shell.dart';
import 'package:juris_mobile/app/juris_app.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/design/juris_design.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/presentation/inbox_presentation.dart';
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

      final JurisVisualModeController visualModeController =
          JurisVisualModeController.fixed(JurisVisualMode.office);
      addTearDown(visualModeController.dispose);
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
      final InboxPresentation presentation = InboxPresentation.from(
        repository.snapshot.inbox,
      );
      expect(
        presentation.displayedEntries.map(
          (DisplayedInboxEntry entry) => entry.item.id,
        ),
        <String>[
          'required-3',
          'required-2',
          'required-1',
          'required-0',
        ],
      );

      await tester.pumpWidget(
        JurisApp(
          repository: repository,
          visualModeController: visualModeController,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('4 responses require attention'), findsOneWidget);
      for (final String itemId in <String>[
        'required-3',
        'required-2',
        'required-1',
        'required-0',
      ]) {
        final Finder row = await _revealInboxRow(tester, itemId);
        expect(row.hitTestable(), findsOneWidget);
        expect(
          find.descendant(
            of: row,
            matching: find.byKey(
              ValueKey<String>('inbox-attention-status-$itemId'),
            ),
          ),
          findsOneWidget,
        );
        expect(
          find.descendant(
            of: row,
            matching: find.text('ACTION REQUIRED'),
          ),
          findsOneWidget,
        );
      }
      expect(
        find.byWidgetPredicate(
          (Widget widget) =>
              widget is Badge &&
              widget.label is Text &&
              (widget.label! as Text).data == '4',
        ),
        findsOneWidget,
      );
      expect(find.text('Review available decisions'), findsOneWidget);
      expect(find.textContaining('Actions ·'), findsNothing);
      expect(repository.markReadCallCount, 0);
      expect(repository.applyActionCallCount, 0);
      expect(repository.advanceCallCount, 0);
      expect(repository.resetCallCount, 0);

      await tester.tap(find.byKey(
        const ValueKey<String>('available-decisions-control'),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(ActionPickerSheet), findsOneWidget);
      expect(find.text('One projected decision'), findsOneWidget);
      expect(repository.markReadCallCount, 0);
      expect(repository.applyActionCallCount, 0);
      expect(repository.advanceCallCount, 0);
      expect(repository.resetCallCount, 0);
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
    for (final String itemId in <String>[
      'required-3',
      'required-2',
      'required-1',
      'required-0',
    ]) {
      final Finder row = await _revealInboxRow(tester, itemId);
      expect(row.hitTestable(), findsOneWidget);
      expect(
        find.descendant(
          of: row,
          matching: find.byKey(
            ValueKey<String>('inbox-attention-status-$itemId'),
          ),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: row,
          matching: find.text('ТРЕБУЕТСЯ ДЕЙСТВИЕ'),
        ),
        findsOneWidget,
      );
    }
  });

  testWidgets(
    'mixed statuses remain explicit and rows preserve callback identity and focus',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final SemanticsHandle semantics = tester.ensureSemantics();

      final List<InboxItemView> items = <InboxItemView>[
        _item('required', InboxStatus.actionRequired, 1),
        _item('unread', InboxStatus.unread, 2),
        _item('read', InboxStatus.read, 3),
        _item('resolved', InboxStatus.resolved, 4),
        _item('archived', InboxStatus.archived, 5),
      ];
      InboxItemView? tapped;
      await _pumpInbox(
        tester,
        locale: 'en',
        snapshot: _snapshot(inbox: items),
        onMessageTap: (InboxItemView item) => tapped = item,
      );

      for (final String label in <String>[
        'ACTION REQUIRED',
        'UNREAD',
        'READ',
        'RESOLVED',
        'ARCHIVED',
      ]) {
        expect(find.text(label), findsOneWidget);
      }

      final Finder archived = find.byKey(
        const ValueKey<String>('inbox-item-archived'),
      );
      expect(archived.hitTestable(), findsOneWidget);
      expect(tester.getSize(archived).height, greaterThanOrEqualTo(48));
      final SemanticsNode archivedSemantics = tester.getSemantics(
        find.byKey(
          const ValueKey<String>('inbox-item-semantics-archived'),
        ),
      );
      expect(archivedSemantics.label, contains('Sender archived'));
      expect(archivedSemantics.label, contains('Day 1 · 08:05'));
      expect(archivedSemantics.label, contains('ARCHIVED'));
      expect(archivedSemantics.label, contains('Subject archived'));

      await _tabTo(tester, archived);
      _expectFocusOutlineVisible(
        tester,
        find.byKey(
          const ValueKey<String>('inbox-item-focus-archived'),
        ),
      );

      await tester.tap(archived);
      await tester.pump();
      expect(tapped, same(items.last));
      expect(tester.takeException(), isNull);
      semantics.dispose();
    },
  );

  testWidgets(
    'RU 360x800 at 200 percent keeps the ledger and message actions reachable',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final SemanticsHandle semantics = tester.ensureSemantics();
      final JurisVisualModeController visualModeController =
          JurisVisualModeController.fixed(JurisVisualMode.afterHours);
      addTearDown(visualModeController.dispose);

      const String messageId = 'ru-required';
      const String actionId = 'scenario-defined-response';
      const String subject = 'Необходимо подготовить полный ответ доверителю';
      const InboxItemView message = InboxItemView(
        id: messageId,
        sender: 'Руководитель юридического отдела доверителя',
        subject: subject,
        body: 'Доверитель просит внимательно проверить процессуальные риски, '
            'сроки и стоимость ответа. Полный текст намеренно длинный, чтобы '
            'проверить обычную прокрутку при крупном системном шрифте.\n\n'
            'Все сведения в этом сообщении являются проекцией сценария и не '
            'должны изменяться или дополняться интерфейсом.',
        receivedAt: 'День 1 · 08:05',
        status: InboxStatus.actionRequired,
        resolutionActionIds: <String>[actionId],
      );
      final _StaticRepository repository = _StaticRepository(
        _snapshot(
          inbox: const <InboxItemView>[message],
          actions: const <GameActionView>[
            GameActionView(
              id: actionId,
              title: 'Отправить подтверждённый сценарный ответ',
              description:
                  'Подтвердить точный вариант ответа, уже спроецированный '
                  'сценарием, без добавления новой рекомендации.',
              timeLabel: '15 минут',
              costEur: 80,
              tone: ActionTone.primary,
              riskNote: 'Известный риск остаётся ровно таким, как его передал '
                  'сценарий.',
            ),
          ],
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: JurisTheme.afterHours(),
          builder: (BuildContext context, Widget? child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: const TextScaler.linear(2),
            ),
            child: child!,
          ),
          home: HomeShell(
            repository: repository,
            locale: 'ru',
            visualModeController: visualModeController,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final Finder inboxHeading = find.descendant(
        of: find.byKey(const ValueKey<String>('inbox-attention-ledger')),
        matching: find.text('Входящие'),
      );
      final Text headingText = tester.widget<Text>(inboxHeading);
      final JurisTypography typography = Theme.of(
        tester.element(inboxHeading),
      ).extension<JurisTypography>()!;
      expect(headingText.style, typography.documentTitle);

      final Finder row = find.byKey(
        const ValueKey<String>('inbox-item-$messageId'),
      );
      await _revealInboxRow(tester, messageId);
      expect(row.hitTestable(), findsOneWidget);
      expect(find.text(subject), findsOneWidget);
      expect(find.text('ТРЕБУЕТСЯ ДЕЙСТВИЕ'), findsOneWidget);
      expect(tester.getSize(row).height, greaterThanOrEqualTo(48));
      expect(
        MediaQuery.textScalerOf(tester.element(row)).scale(16),
        32,
      );
      expect(
        Theme.of(tester.element(row)).extension<JurisSurfaces>()!.canvas,
        JurisSurfaces.afterHours.canvas,
      );
      expect(tester.takeException(), isNull);

      await _tabTo(tester, row);
      _expectFocusOutlineVisible(
        tester,
        find.byKey(
          const ValueKey<String>('inbox-item-focus-$messageId'),
        ),
      );
      await tester.tap(row);
      await tester.pumpAndSettle();

      expect(repository.markReadCallCount, 1);
      expect(repository.lastMarkedItemId, messageId);
      expect(repository.applyActionCallCount, 0);
      expect(
        find.byKey(const ValueKey<String>('inbox-message-sheet')),
        findsOneWidget,
      );
      expect(
        tester
            .widget<Semantics>(
              find.byKey(
                const ValueKey<String>('inbox-message-subject'),
              ),
            )
            .properties
            .header,
        isTrue,
      );

      final Finder response = find.byKey(
        const ValueKey<String>('inbox-response-$actionId'),
      );
      await _revealMessageControl(tester, response);
      expect(response.hitTestable(), findsOneWidget);
      expect(tester.getSize(response).height, greaterThanOrEqualTo(48));
      expect(tester.takeException(), isNull);

      await tester.tap(response);
      await tester.pumpAndSettle();
      final AlertDialog confirmation = tester.widget<AlertDialog>(
        find.byKey(
          const ValueKey<String>('inbox-confirmation-$actionId'),
        ),
      );
      expect(confirmation.scrollable, isTrue);
      final Finder rejectConfirmation = find.byKey(
        const ValueKey<String>('inbox-confirm-no-$actionId'),
      );
      expect(rejectConfirmation.hitTestable(), findsOneWidget);
      await tester.tap(rejectConfirmation);
      await tester.pumpAndSettle();
      expect(repository.applyActionCallCount, 0);

      final Finder notNow = find.byKey(
        const ValueKey<String>('inbox-message-not-now'),
      );
      await _revealMessageControl(tester, notNow);
      await tester.tap(notNow);
      await tester.pumpAndSettle();

      expect(repository.applyActionCallCount, 0);
      expect(repository.advanceCallCount, 0);
      expect(repository.resetCallCount, 0);
      expect(tester.takeException(), isNull);
      semantics.dispose();
    },
  );
}

Future<void> _pumpInbox(
  WidgetTester tester, {
  required String locale,
  required GameSnapshot snapshot,
  ValueChanged<InboxItemView>? onMessageTap,
}) {
  return tester.pumpWidget(
    MaterialApp(
      theme: JurisTheme.dark(),
      home: GameplayLocale(
        locale: locale,
        child: Scaffold(
          body: InboxScreen(
            snapshot: snapshot,
            onMessageTap: onMessageTap ?? (_) {},
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

  GameSnapshot _snapshot;
  int markReadCallCount = 0;
  int applyActionCallCount = 0;
  int advanceCallCount = 0;
  int resetCallCount = 0;
  String? lastMarkedItemId;
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
  void advanceTimeByMinutes(int minutes) {
    advanceCallCount += 1;
  }

  @override
  void markInboxItemRead(String itemId) {
    markReadCallCount += 1;
    lastMarkedItemId = itemId;
    final List<InboxItemView> updated = _snapshot.inbox
        .map(
          (InboxItemView item) =>
              item.id == itemId && item.status == InboxStatus.unread
                  ? item.copyWith(status: InboxStatus.read)
                  : item,
        )
        .toList(growable: false);
    if (!_sameInbox(_snapshot.inbox, updated)) {
      _snapshot = _snapshot.copyWith(inbox: updated);
      notifyListeners();
    }
  }

  @override
  void reset() {
    resetCallCount += 1;
  }

  @override
  ActionExecutionResult applyAction(String actionId) {
    applyActionCallCount += 1;
    lastAppliedActionId = actionId;
    return const ActionExecutionResult(
      title: 'Applied',
      message: 'Applied',
      isRisky: false,
    );
  }
}

bool _sameInbox(List<InboxItemView> before, List<InboxItemView> after) {
  if (before.length != after.length) {
    return false;
  }
  for (int index = 0; index < before.length; index += 1) {
    if (!identical(before[index], after[index])) {
      return false;
    }
  }
  return true;
}

Future<Finder> _revealInboxRow(
  WidgetTester tester,
  String itemId, {
  int maximumSteps = 24,
}) async {
  final Finder row = find.byKey(ValueKey<String>('inbox-item-$itemId'));
  final Finder viewport = find.byKey(
    const PageStorageKey<String>('inbox-scroll'),
  );
  expect(viewport, findsOneWidget);
  final Finder scrollableFinder = find.descendant(
    of: viewport,
    matching: find.byType(Scrollable),
  );
  expect(scrollableFinder, findsOneWidget);
  final ScrollableState scrollable = tester.state<ScrollableState>(
    scrollableFinder,
  );

  for (int step = 0; step <= maximumSteps; step += 1) {
    if (row.evaluate().length == 1 &&
        row.hitTestable().evaluate().length == 1) {
      return row;
    }
    if (step == maximumSteps) {
      break;
    }
    final double before = scrollable.position.pixels;
    await tester.drag(viewport, const Offset(0, -240));
    await tester.pumpAndSettle();
    if (scrollable.position.pixels <= before + 0.5 &&
        scrollable.position.pixels >=
            scrollable.position.maxScrollExtent - 0.5) {
      break;
    }
  }

  fail(
    'Could not reveal Inbox row $itemId through bounded public scrolling; '
    'built=${row.evaluate().length} '
    'hitTestable=${row.hitTestable().evaluate().length} '
    'pixels=${scrollable.position.pixels} '
    'max=${scrollable.position.maxScrollExtent}.',
  );
}

Future<void> _revealMessageControl(
  WidgetTester tester,
  Finder target, {
  int maximumSteps = 20,
}) async {
  final Finder viewport = find.byKey(
    const ValueKey<String>('inbox-message-scroll'),
  );
  expect(viewport, findsOneWidget);
  final Finder scrollableFinder = find.descendant(
    of: viewport,
    matching: find.byType(Scrollable),
  );
  expect(scrollableFinder, findsOneWidget);
  final ScrollableState scrollable = tester.state<ScrollableState>(
    scrollableFinder,
  );

  for (int step = 0; step <= maximumSteps; step += 1) {
    if (target.evaluate().length == 1 &&
        target.hitTestable().evaluate().length == 1) {
      return;
    }
    if (step == maximumSteps) {
      break;
    }
    final double before = scrollable.position.pixels;
    await tester.drag(viewport, const Offset(0, -240));
    await tester.pumpAndSettle();
    if (scrollable.position.pixels <= before + 0.5 &&
        scrollable.position.pixels >=
            scrollable.position.maxScrollExtent - 0.5) {
      break;
    }
  }

  fail(
    'Could not reveal message-sheet control through bounded public scrolling: '
    '$target built=${target.evaluate().length} '
    'hitTestable=${target.hitTestable().evaluate().length} '
    'pixels=${scrollable.position.pixels} '
    'max=${scrollable.position.maxScrollExtent}.',
  );
}

Future<void> _tabTo(
  WidgetTester tester,
  Finder target, {
  int maximumSteps = 32,
}) async {
  for (int step = 0; step <= maximumSteps; step += 1) {
    if (_primaryFocusIsWithin(tester, target)) {
      return;
    }
    if (step == maximumSteps) {
      break;
    }
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pumpAndSettle();
  }
  fail('Could not focus ${target.describeMatch(Plurality.one)} in '
      '$maximumSteps public Tab steps.');
}

bool _primaryFocusIsWithin(WidgetTester tester, Finder target) {
  final BuildContext? focusContext =
      FocusManager.instance.primaryFocus?.context;
  if (focusContext is! Element) {
    return false;
  }
  final Element targetElement = tester.element(target);
  if (identical(focusContext, targetElement)) {
    return true;
  }
  bool found = false;
  focusContext.visitAncestorElements((Element ancestor) {
    if (identical(ancestor, targetElement)) {
      found = true;
    }
    return !found;
  });
  return found;
}

void _expectFocusOutlineVisible(WidgetTester tester, Finder outline) {
  expect(outline, findsOneWidget);
  final Finder animated = find.descendant(
    of: outline,
    matching: find.byType(AnimatedContainer),
  );
  expect(animated, findsOneWidget);
  final AnimatedContainer widget = tester.widget<AnimatedContainer>(animated);
  final BoxDecoration decoration = widget.decoration! as BoxDecoration;
  final Border border = decoration.border! as Border;
  final JurisSurfaces surfaces =
      Theme.of(tester.element(outline)).extension<JurisSurfaces>()!;
  expect(border.top.width, JurisBorders.standardWeights.focus);
  expect(border.top.color, surfaces.focusRing);
}
