import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
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

    expect(find.text('Available actions'), findsOneWidget);
    expect(find.text('File documented response'), findsOneWidget);
    expect(find.text('Negotiate extension'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('File documented response')).dy,
      lessThan(tester.getTopLeft(find.text('Negotiate extension')).dy),
    );
    await tester.pump(const Duration(seconds: 8));
    expect(repository.advanceCount, 0);

    await tester.tap(find.text('File documented response'));
    await tester.pumpAndSettle();
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
