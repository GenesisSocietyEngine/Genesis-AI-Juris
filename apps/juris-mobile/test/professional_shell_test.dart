import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/app/home_shell.dart';
import 'package:juris_mobile/app/juris_app.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/design/juris_design.dart';
import 'package:juris_mobile/models/game_snapshot.dart';

void main() {
  testWidgets(
    'public visual modes are transient and presentation-only',
    (WidgetTester tester) async {
      _configureView(tester, const Size(1024, 900));
      final _TrackingRepository repository = _TrackingRepository();
      final GameSnapshot initialSnapshot = repository.snapshot;
      final JurisVisualModeController controller = JurisVisualModeController();
      addTearDown(controller.dispose);

      await tester.pumpWidget(
        JurisApp(
          repository: repository,
          visualModeController: controller,
        ),
      );
      await tester.pumpAndSettle();

      expect(controller.selection, JurisVisualModeSelection.automatic);
      _expectVisualMode(tester, JurisVisualMode.office);
      expect(
        tester.widget<HomeShell>(find.byType(HomeShell)).repository,
        same(repository),
      );

      final Finder wideNavigation = find.byKey(
        const ValueKey<String>('professional-wide-navigation'),
      );
      await tester.tap(
        find.descendant(
          of: wideNavigation,
          matching: find.byIcon(Icons.gavel_outlined),
        ),
      );
      await tester.pumpAndSettle();
      _expectSelectedHeader(tester, 'Matter');

      await _selectVisualMode(
        tester,
        JurisVisualModeSelection.afterHours,
      );
      expect(controller.selection, JurisVisualModeSelection.afterHours);
      _expectVisualMode(tester, JurisVisualMode.afterHours);
      _expectSelectedHeader(tester, 'Matter');

      await _selectVisualMode(tester, JurisVisualModeSelection.office);
      expect(controller.selection, JurisVisualModeSelection.office);
      _expectVisualMode(tester, JurisVisualMode.office);
      _expectSelectedHeader(tester, 'Matter');

      await _selectVisualMode(tester, JurisVisualModeSelection.automatic);
      expect(controller.selection, JurisVisualModeSelection.automatic);
      _expectVisualMode(tester, JurisVisualMode.office);
      _expectSelectedHeader(tester, 'Matter');

      expect(
        tester.widget<HomeShell>(find.byType(HomeShell)).repository,
        same(repository),
      );
      expect(repository.snapshot, same(initialSnapshot));
      expect(repository.actionCalls, 0);
      expect(repository.resetCalls, 0);
      expect(repository.advanceCalls, 0);
      expect(repository.disposeCalls, 0);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    '699 compact to 700 wide preserves stable Matter selection',
    (WidgetTester tester) async {
      _configureView(tester, const Size(699, 900));
      final SemanticsHandle semantics = tester.ensureSemantics();
      final _TrackingRepository repository = _TrackingRepository();

      await tester.pumpWidget(JurisApp(repository: repository));
      await tester.pumpAndSettle();

      final Finder compactNavigation = find.byKey(
        const ValueKey<String>('professional-compact-navigation'),
      );
      final Finder compactMatter = find.byKey(
        const ValueKey<String>('compact-destination-matter'),
      );
      expect(compactNavigation, findsOneWidget);
      expect(
        find.byKey(
          const ValueKey<String>('professional-wide-navigation'),
        ),
        findsNothing,
      );

      await tester.tap(compactMatter);
      await tester.pumpAndSettle();

      _expectSelectedHeader(tester, 'Matter');
      expect(
        tester.getSemantics(compactMatter),
        matchesSemantics(
          label: 'Matter',
          hasSelectedState: true,
          isSelected: true,
          hasEnabledState: true,
          isEnabled: true,
          isButton: true,
          isFocusable: true,
          hasTapAction: true,
          hasFocusAction: true,
        ),
      );

      tester.view.physicalSize = const Size(700, 900);
      await tester.pumpAndSettle();

      final Finder wideNavigation = find.byKey(
        const ValueKey<String>('professional-wide-navigation'),
      );
      expect(compactNavigation, findsNothing);
      expect(wideNavigation, findsOneWidget);
      expect(
        tester.widget<NavigationRail>(wideNavigation).selectedIndex,
        1,
      );
      _expectSelectedHeader(tester, 'Matter');

      final Finder wideMatterLabel = find.descendant(
        of: wideNavigation,
        matching: find.text('Matter'),
      );
      expect(wideMatterLabel, findsOneWidget);
      expect(
        tester.getSemantics(wideMatterLabel),
        matchesSemantics(
          label: 'Matter',
          hasSelectedState: true,
          isSelected: true,
          isFocusable: true,
          hasTapAction: true,
          hasFocusAction: true,
        ),
      );
      semantics.dispose();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    '360x800 Russian at 200 percent keeps public shell controls reachable',
    (WidgetTester tester) async {
      _configureView(tester, const Size(360, 800));
      final SemanticsHandle semantics = tester.ensureSemantics();
      final _TrackingRepository repository = _TrackingRepository();
      final JurisVisualModeController controller = JurisVisualModeController();
      addTearDown(controller.dispose);

      await tester.pumpWidget(
        MaterialApp(
          theme: JurisTheme.afterHours(),
          locale: const Locale('ru'),
          supportedLocales: const <Locale>[
            Locale('en'),
            Locale('ru'),
          ],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          builder: (BuildContext context, Widget? child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: const TextScaler.linear(2),
            ),
            child: child!,
          ),
          home: HomeShell(
            repository: repository,
            locale: 'ru',
            visualModeController: controller,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      final Finder compactNavigation = find.byKey(
        const ValueKey<String>('professional-compact-navigation'),
      );
      expect(compactNavigation, findsOneWidget);
      final Finder compactScroll = find.descendant(
        of: compactNavigation,
        matching: find.byType(Scrollable),
      );
      expect(compactScroll, findsOneWidget);

      const Map<String, String> russianLabels = <String, String>{
        'inbox': '\u0412\u0445\u043e\u0434\u044f\u0449\u0438\u0435',
        'matter': '\u0414\u0435\u043b\u043e',
        'calendar': '\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c',
        'ai': 'AI',
        'career': '\u041a\u0430\u0440\u044c\u0435\u0440\u0430',
      };

      for (final MapEntry<String, String> destination
          in russianLabels.entries) {
        final Finder target = find.byKey(
          ValueKey<String>('compact-destination-${destination.key}'),
        );
        await tester.scrollUntilVisible(
          target,
          96,
          scrollable: compactScroll,
          maxScrolls: 20,
        );
        await tester.pump();

        expect(target.hitTestable(), findsOneWidget);
        _expectMinimumTarget(tester, target);
        final Finder label = find.descendant(
          of: target,
          matching: find.text(destination.value),
        );
        expect(label, findsOneWidget);
        expect(
          MediaQuery.textScalerOf(tester.element(label)).scale(14),
          closeTo(28, 0.001),
        );

        await tester.tap(target);
        await tester.pumpAndSettle();
        expect(
          tester.getSemantics(target),
          matchesSemantics(
            label: destination.value,
            hasSelectedState: true,
            isSelected: true,
            hasEnabledState: true,
            isEnabled: true,
            isButton: true,
            isFocusable: true,
            hasTapAction: true,
            hasFocusAction: true,
          ),
        );
        expect(
          tester.takeException(),
          isNull,
          reason: 'destination=${destination.key}',
        );
      }

      final Finder sessionButton = find.byKey(
        const ValueKey<String>('session-controls-button'),
      );
      expect(sessionButton.hitTestable(), findsOneWidget);
      _expectMinimumTarget(tester, sessionButton);
      await tester.tap(sessionButton);
      await tester.pumpAndSettle();

      final Finder sessionSurface = find.byKey(
        const ValueKey<String>('session-controls-surface'),
      );
      expect(sessionSurface, findsOneWidget);
      final Finder sessionScroll = find.descendant(
        of: sessionSurface,
        matching: find.byType(Scrollable),
      );
      expect(sessionScroll, findsOneWidget);
      final Finder afterHours = find.byKey(
        const ValueKey<String>('visual-mode-afterHours'),
      );
      await tester.scrollUntilVisible(
        afterHours,
        140,
        scrollable: sessionScroll,
        maxScrolls: 20,
      );
      await tester.pump();
      expect(afterHours.hitTestable(), findsOneWidget);
      _expectMinimumTarget(tester, afterHours);
      expect(
        tester.getSemantics(afterHours),
        matchesSemantics(
          label: 'AFTER HOURS',
          hasSelectedState: true,
          isSelected: false,
          isButton: true,
          hasTapAction: true,
        ),
      );

      final Finder reset = find.byKey(
        const ValueKey<String>('reset-demo-action'),
      );
      await tester.scrollUntilVisible(
        reset,
        140,
        scrollable: sessionScroll,
        maxScrolls: 20,
      );
      await tester.pump();
      expect(reset.hitTestable(), findsOneWidget);
      _expectMinimumTarget(tester, reset);

      final Finder close = find.byKey(
        const ValueKey<String>('session-controls-close'),
      );
      await tester.scrollUntilVisible(
        close,
        -140,
        scrollable: sessionScroll,
        maxScrolls: 20,
      );
      await tester.pump();
      expect(close.hitTestable(), findsOneWidget);
      _expectMinimumTarget(tester, close);
      await tester.tap(close);
      await tester.pumpAndSettle();
      expect(sessionSurface, findsNothing);
      semantics.dispose();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'keyboard activation is scoped to the focused shell control',
    (WidgetTester tester) async {
      _configureView(tester, const Size(699, 900));
      final _TrackingRepository repository = _TrackingRepository(
        withAction: true,
      );

      await tester.pumpWidget(JurisApp(repository: repository));
      await tester.pumpAndSettle();

      final Finder matter = find.byKey(
        const ValueKey<String>('compact-destination-matter'),
      );
      await _focusTarget(tester, matter);
      await tester.pumpAndSettle();
      _expectVisibleFocusOutline(
        tester,
        find.byKey(
          const ValueKey<String>('compact-destination-focus-matter'),
        ),
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      _expectSelectedHeader(tester, 'Matter');

      final Finder decisions = find.byKey(
        const ValueKey<String>('available-decisions-control'),
      );
      await _focusTarget(tester, decisions);
      await _sendArrowKeys(tester);
      _expectSelectedHeader(tester, 'Matter');

      final Finder sessionButton = find.byKey(
        const ValueKey<String>('session-controls-button'),
      );
      await _focusTarget(tester, sessionButton);
      await _sendArrowKeys(tester);
      _expectSelectedHeader(tester, 'Matter');

      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pump();
      await _focusTarget(tester, sessionButton);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();

      expect(
        find.byKey(const ValueKey<String>('session-controls-surface')),
        findsOneWidget,
      );
      _expectSelectedHeader(tester, 'Matter');
      expect(repository.actionCalls, 0);
      expect(repository.resetCalls, 0);
      expect(repository.advanceCalls, 0);

      await tester.tap(
        find.byKey(const ValueKey<String>('session-controls-close')),
      );
      await tester.pumpAndSettle();
      tester.view.physicalSize = const Size(700, 900);
      await tester.pumpAndSettle();
      final Finder wideMatterFocus = find.byKey(
        const ValueKey<String>('wide-destination-focus-matter'),
      );
      await _focusUntilOutlineIsVisible(tester, wideMatterFocus);
      _expectVisibleFocusOutline(tester, wideMatterFocus);
      _expectSelectedHeader(tester, 'Matter');
      expect(tester.takeException(), isNull);
    },
  );
}

void _configureView(WidgetTester tester, Size size) {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Future<void> _selectVisualMode(
  WidgetTester tester,
  JurisVisualModeSelection selection,
) async {
  await tester.tap(
    find.byKey(const ValueKey<String>('session-controls-button')),
  );
  await tester.pumpAndSettle();
  final Finder sessionSurface = find.byKey(
    const ValueKey<String>('session-controls-surface'),
  );
  final Finder scrollable = find.descendant(
    of: sessionSurface,
    matching: find.byType(Scrollable),
  );
  final Finder option = find.byKey(
    ValueKey<String>('visual-mode-${selection.name}'),
  );
  await tester.scrollUntilVisible(
    option,
    140,
    scrollable: scrollable,
    maxScrolls: 20,
  );
  await tester.pump();
  await tester.tap(option);
  await tester.pumpAndSettle();
  expect(sessionSurface, findsNothing);
}

void _expectVisualMode(WidgetTester tester, JurisVisualMode mode) {
  final ThemeData theme = Theme.of(
    tester.element(
      find.byKey(const ValueKey<String>('professional-session-header')),
    ),
  );
  final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
  final JurisSurfaces expected = JurisSurfaces.forMode(mode);
  expect(theme.brightness,
      mode == JurisVisualMode.office ? Brightness.light : Brightness.dark);
  expect(surfaces.canvas, expected.canvas);
  expect(surfaces.ink, expected.ink);
}

void _expectSelectedHeader(WidgetTester tester, String label) {
  final Finder header = find.byKey(
    const ValueKey<String>('professional-session-header'),
  );
  expect(
    find.descendant(of: header, matching: find.text(label)),
    findsOneWidget,
  );
}

void _expectMinimumTarget(WidgetTester tester, Finder finder) {
  final Size size = tester.getSize(finder);
  expect(size.width, greaterThanOrEqualTo(48));
  expect(size.height, greaterThanOrEqualTo(48));
}

void _expectVisibleFocusOutline(WidgetTester tester, Finder outline) {
  expect(outline, findsOneWidget);
  final Finder animatedContainer = find.descendant(
    of: outline,
    matching: find.byType(AnimatedContainer),
  );
  expect(animatedContainer, findsOneWidget);
  final AnimatedContainer widget = tester.widget<AnimatedContainer>(
    animatedContainer,
  );
  final BoxDecoration decoration = widget.decoration! as BoxDecoration;
  final Border border = decoration.border! as Border;
  final JurisSurfaces surfaces =
      Theme.of(tester.element(outline)).extension<JurisSurfaces>()!;
  expect(border.top.color, surfaces.focusRing);
  expect(border.top.width, JurisBorders.standardWeights.focus);
}

Future<void> _focusUntilOutlineIsVisible(
  WidgetTester tester,
  Finder outline,
) async {
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pump();
  for (int index = 0; index < 40; index++) {
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pumpAndSettle();
    final Finder animatedContainer = find.descendant(
      of: outline,
      matching: find.byType(AnimatedContainer),
    );
    if (animatedContainer.evaluate().length != 1) {
      continue;
    }
    final AnimatedContainer widget = tester.widget<AnimatedContainer>(
      animatedContainer,
    );
    final BoxDecoration? decoration = widget.decoration as BoxDecoration?;
    final Border? border = decoration?.border as Border?;
    if (border != null && border.top.color.a == 1) {
      return;
    }
  }
  fail(
    'Could not focus requested outline; outlineCount=${outline.evaluate().length}; '
    'primaryFocus=${FocusManager.instance.primaryFocus?.debugLabel}',
  );
}

Future<void> _focusTarget(WidgetTester tester, Finder target) async {
  if (_focusIsWithin(tester, target)) {
    return;
  }
  for (int index = 0; index < 40; index++) {
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    if (_focusIsWithin(tester, target)) {
      return;
    }
  }
  fail(
    'Could not focus requested target; targetCount=${target.evaluate().length}; '
    'primaryFocus=${FocusManager.instance.primaryFocus?.debugLabel}',
  );
}

bool _focusIsWithin(WidgetTester tester, Finder target) {
  final BuildContext? focusContext =
      FocusManager.instance.primaryFocus?.context;
  if (focusContext == null || target.evaluate().isEmpty) {
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
      return false;
    }
    return true;
  });
  return found;
}

Future<void> _sendArrowKeys(WidgetTester tester) async {
  for (final LogicalKeyboardKey key in <LogicalKeyboardKey>[
    LogicalKeyboardKey.arrowLeft,
    LogicalKeyboardKey.arrowRight,
    LogicalKeyboardKey.arrowUp,
    LogicalKeyboardKey.arrowDown,
  ]) {
    await tester.sendKeyEvent(key);
    await tester.pump();
  }
}

final class _TrackingRepository extends GameRuntimeRepository {
  _TrackingRepository({bool withAction = false})
      : _snapshot = _fixtureSnapshot(withAction: withAction);

  final GameSnapshot _snapshot;
  int actionCalls = 0;
  int resetCalls = 0;
  int advanceCalls = 0;
  int disposeCalls = 0;

  @override
  GameSnapshot get snapshot => _snapshot;

  @override
  bool get isTerminal => false;

  @override
  bool get supportsLiveClock => false;

  @override
  String? get clockErrorMessage => null;

  @override
  ActionExecutionResult applyAction(String actionId) {
    actionCalls += 1;
    return const ActionExecutionResult(
      title: 'Unexpected fixture action',
      message: 'The shell acceptance fixture recorded an action.',
      isRisky: false,
    );
  }

  @override
  void advanceTimeByMinutes(int minutes) {
    advanceCalls += 1;
  }

  @override
  void markInboxItemRead(String itemId) {}

  @override
  void reset() {
    resetCalls += 1;
  }

  @override
  void dispose() {
    disposeCalls += 1;
    super.dispose();
  }
}

GameSnapshot _fixtureSnapshot({required bool withAction}) {
  return GameSnapshot(
    version: 'professional-shell-test-v1',
    seed: 20260819,
    mode: 'Presentation fixture',
    dayLabel: 'Day 1',
    timeLabel: '08:00',
    stage: 'Intake',
    caseResultStatus: CaseResultStatus.ongoing,
    engagementStatus: EngagementStatus.active,
    matterTitle: 'Professional shell fixture',
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
    inbox: const <InboxItemView>[],
    deadlines: const <DeadlineView>[],
    evidence: const <EvidenceView>[],
    actions: withAction
        ? const <GameActionView>[
            GameActionView(
              id: 'presentation-only-action',
              title: 'Review projected material',
              description: 'Fixture action used only to expose the control.',
              timeLabel: '15 min',
              costEur: 0,
              tone: ActionTone.neutral,
            ),
          ]
        : const <GameActionView>[],
    latestAiNote: null,
  );
}
