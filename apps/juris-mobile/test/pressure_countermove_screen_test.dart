import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/gameplay_locale.dart';
import 'package:juris_mobile/app/home_shell.dart';
import 'package:juris_mobile/data/demo_game_repository.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/models/pressure_countermove.dart';
import 'package:juris_mobile/screens/matter_screen.dart';

void main() {
  testWidgets('Matter renders a neutral zero-response pressure state', (
    WidgetTester tester,
  ) async {
    final GameSnapshot snapshot =
        DemoGameRepository(seed: 41).snapshot.copyWith(
              pressureAndCountermove: const PressureAndCountermoveView(
                projectionSchemaVersion: 1,
                activePressures: <ActivePressureView>[
                  ActivePressureView(
                    pressureId: 'urgent-demand',
                    sourceActorId: 'opposing-counsel',
                    sourceActorName: 'Opposing Counsel',
                    dueAtMinute: 60,
                    remainingMinutes: 12,
                    availableResponseActionIds: <String>[],
                  ),
                ],
              ),
            );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MatterScreen(
            snapshot: snapshot,
            onShowActions: () {},
            onShowDossier: () {},
            onShowTrainingDebrief: () {},
            onShowPressureResponses: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('Active pressure'), findsOneWidget);
    expect(find.text('Source: Opposing Counsel'), findsOneWidget);
    expect(find.text('Due at game minute 60'), findsOneWidget);
    expect(find.text('12 game minutes remaining'), findsOneWidget);
    expect(
      find.text('No response action is currently available.'),
      findsOneWidget,
    );
    expect(find.text('Review responses'), findsNothing);
  });

  testWidgets(
    'generic Matter pressure renders GreenFire accessibly in EN and RU',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final SemanticsHandle semantics = tester.ensureSemantics();
      final List<List<String>> reviewed = <List<String>>[];

      Future<void> pumpLocale(String locale, String actorName) async {
        final GameSnapshot snapshot =
            DemoGameRepository(seed: 20260729).snapshot.copyWith(
                  pressureAndCountermove: PressureAndCountermoveView(
                    projectionSchemaVersion: 1,
                    activePressures: <ActivePressureView>[
                      ActivePressureView(
                        pressureId: 'regulator_document_request_pressure',
                        sourceActorId: 'port_haven_environment_authority',
                        sourceActorName: actorName,
                        dueAtMinute: 2160,
                        remainingMinutes: 1980,
                        availableResponseActionIds: const <String>[
                          'submit_initial_regulatory_response',
                          'release_unreviewed_documents',
                        ],
                      ),
                    ],
                  ),
                );
        await tester.pumpWidget(
          MaterialApp(
            builder: (BuildContext context, Widget? child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                accessibleNavigation: true,
                disableAnimations: true,
                textScaler: const TextScaler.linear(1.35),
              ),
              child: GameplayLocale(locale: locale, child: child!),
            ),
            home: Scaffold(
              body: MatterScreen(
                snapshot: snapshot,
                onShowActions: () {},
                onShowDossier: () {},
                onShowTrainingDebrief: () {},
                onShowPressureResponses: (List<String> actionIds) {
                  reviewed.add(actionIds);
                },
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        final Finder review = find.byKey(
          const ValueKey<String>(
            'review-pressure-responses-regulator_document_request_pressure',
          ),
        );
        await tester.scrollUntilVisible(
          review,
          200,
          scrollable: find.byType(Scrollable).last,
          maxScrolls: 30,
        );
        await tester.pumpAndSettle();
        expect(find.textContaining(actorName), findsOneWidget);
        expect(find.textContaining('2160'), findsOneWidget);
        expect(find.textContaining('1980'), findsOneWidget);
        expect(review, findsOneWidget);
        await tester.tap(review);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      }

      await pumpLocale('en', 'Port Haven Environmental Authority');
      expect(find.text('Active pressure'), findsOneWidget);
      expect(
        find.text('Source: Port Haven Environmental Authority'),
        findsOneWidget,
      );
      expect(find.text('Due at game minute 2160'), findsOneWidget);
      expect(find.text('1980 game minutes remaining'), findsOneWidget);
      expect(find.text('2 response actions available'), findsOneWidget);
      expect(
        find.bySemanticsLabel(
          RegExp('Review available pressure responses'),
        ),
        findsOneWidget,
      );
      expect(reviewed.single, <String>[
        'submit_initial_regulatory_response',
        'release_unreviewed_documents',
      ]);

      reviewed.clear();
      await pumpLocale('ru', 'Экологический орган Порт-Хейвена');
      expect(find.text('Активное давление'), findsOneWidget);
      expect(
        find.text('Источник: Экологический орган Порт-Хейвена'),
        findsOneWidget,
      );
      expect(find.text('Срок на игровой минуте 2160'), findsOneWidget);
      expect(find.text('1980 игровых минут осталось'), findsOneWidget);
      expect(find.text('2 ответных действий доступно'), findsOneWidget);
      expect(
        find.bySemanticsLabel(
          RegExp('Просмотреть доступные ответы на давление'),
        ),
        findsOneWidget,
      );
      expect(reviewed.single, <String>[
        'submit_initial_regulatory_response',
        'release_unreviewed_documents',
      ]);
      semantics.dispose();
    },
  );

  testWidgets('HomeShell suspends clock and dispatches one selected response', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final _PressureRepository repository = _PressureRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: HomeShell(
          repository: repository,
          locale: 'en',
          enableLiveClockInTests: true,
        ),
      ),
    );

    await tester.tap(find.text('Matter'));
    await tester.pumpAndSettle();
    final Finder review = find.byKey(
      const ValueKey<String>('review-pressure-responses-urgent-demand'),
    );
    await tester.scrollUntilVisible(
      review,
      200,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(review);
    await tester.pumpAndSettle();

    expect(repository.appliedActionIds, isEmpty);
    expect(find.text('Available actions'), findsOneWidget);
    expect(find.text('File documented response'), findsOneWidget);
    expect(find.text('Negotiate extension'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('File documented response')).dy,
      lessThan(tester.getTopLeft(find.text('Negotiate extension')).dy),
    );
    await tester.pump(const Duration(seconds: 8));
    expect(repository.advanceCount, 0);
    expect(repository.appliedActionIds, isEmpty);

    await tester.tap(find.text('File documented response'));
    await tester.pumpAndSettle();
    expect(repository.appliedActionIds, isEmpty);
    expect(repository.advanceCount, 0);
    expect(find.textContaining('incorrect', findRichText: true), findsNothing);
    expect(find.textContaining('wrong', findRichText: true), findsNothing);
    await tester.tap(find.text('Yes'));
    await tester.pumpAndSettle();
    expect(repository.appliedActionIds, <String>['file-documented-response']);
    repository.dispose();
  });
}

final class _PressureRepository extends GameRuntimeRepository {
  _PressureRepository()
      : _snapshot = DemoGameRepository(seed: 41).snapshot.copyWith(
          pressureAndCountermove: const PressureAndCountermoveView(
            projectionSchemaVersion: 1,
            activePressures: <ActivePressureView>[
              ActivePressureView(
                pressureId: 'urgent-demand',
                sourceActorId: 'opposing-counsel',
                sourceActorName: 'Opposing Counsel',
                dueAtMinute: 60,
                remainingMinutes: 60,
                availableResponseActionIds: <String>[
                  'file-documented-response',
                  'negotiate-extension',
                ],
              ),
            ],
          ),
          actions: const <GameActionView>[
            GameActionView(
              id: 'negotiate-extension',
              title: 'Negotiate extension',
              description: 'Seek a short agreed extension.',
              timeLabel: '15 min',
              costEur: 0,
              tone: ActionTone.primary,
            ),
            GameActionView(
              id: 'file-documented-response',
              title: 'File documented response',
              description: 'File the supported response.',
              timeLabel: '30 min',
              costEur: 0,
              tone: ActionTone.primary,
            ),
          ],
        );

  final GameSnapshot _snapshot;
  int advanceCount = 0;
  final List<String> appliedActionIds = <String>[];

  @override
  GameSnapshot get snapshot => _snapshot;

  @override
  bool get isTerminal => false;

  @override
  bool get supportsLiveClock => true;

  @override
  String? get clockErrorMessage => null;

  @override
  void advanceTimeByMinutes(int minutes) {
    advanceCount += 1;
  }

  @override
  ActionExecutionResult applyAction(String actionId) {
    appliedActionIds.add(actionId);
    return const ActionExecutionResult(
      title: 'Response filed',
      message: 'The authoritative response was dispatched.',
      isRisky: false,
    );
  }

  @override
  void markInboxItemRead(String itemId) {}

  @override
  void reset() {}
}
