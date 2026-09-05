import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/home_shell.dart';
import 'package:juris_mobile/data/demo_game_repository.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/models/dossier_projection.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/screens/dossier_screen.dart';

void main() {
  testWidgets('dossier is readable and scrollable at 360x640 with large text', (
    WidgetTester tester,
  ) async {
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
        home: DossierScreen(dossier: _dossier(), locale: 'en'),
      ),
    );
    await tester.pumpAndSettle();

    expect(
        find.byKey(const ValueKey<String>('dossier-screen')), findsOneWidget);
    expect(find.text('Matter dossier'), findsOneWidget);
    expect(find.text('Procedure'), findsOneWidget);
    expect(find.text('Recoverable — remedy available'), findsOneWidget);
    expect(find.text('Lost'), findsOneWidget);
    expect(find.text('First instance'), findsOneWidget);
    expect(find.text('HIDDEN FACT SENTINEL'), findsNothing);
    expect(find.text('HIDDEN EVIDENCE SENTINEL'), findsNothing);

    for (final String section in <String>[
      'Facts',
      'Evidence',
      'Deadlines and remedies',
    ]) {
      await tester.scrollUntilVisible(
        find.text(section),
        240,
        scrollable: find.byType(Scrollable).last,
        maxScrolls: 30,
      );
      await tester.pumpAndSettle();
      expect(find.text(section), findsOneWidget);
    }
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey<String>('dossier-remedy-file_appeal')),
      240,
      scrollable: find.byType(Scrollable).last,
      maxScrolls: 30,
    );
    await tester.pumpAndSettle();
    expect(find.text('File appeal'), findsWidgets);
    expect(find.text('1 h · EUR 1500'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Russian dossier labels retain the authoritative projection', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: DossierScreen(dossier: _dossier(), locale: 'ru'),
      ),
    );

    expect(find.text('Досье дела'), findsOneWidget);
    expect(find.text('Процедура'), findsOneWidget);
    expect(
      find.text('Можно исправить — средство защиты доступно'),
      findsOneWidget,
    );
    expect(find.text('Поражение'), findsOneWidget);
    expect(find.text('Первая инстанция'), findsOneWidget);
  });

  testWidgets('closed dossier presents explicit closure and terminal outcome', (
    WidgetTester tester,
  ) async {
    const DossierProjectionView closed = DossierProjectionView(
      projectionSchemaVersion: 1,
      procedure: DossierProcedureView(
        stageId: 'resolved',
        stageTitle: 'Resolved',
        clockMinutes: 425,
        matterLifecycle: DossierLifecycleStatus.closed,
        isClosed: true,
        matterStatus: DossierMatterStatus.closed,
      ),
      judicialResult: DossierJudicialResult.lost,
      judicialDecisionInstance: DossierJudicialDecisionInstance.firstInstance,
      facts: <DossierFactView>[],
      evidence: <DossierEvidenceView>[],
      deadlines: <DossierDeadlineView>[],
      outcome: DossierOutcomeView(
        id: 'final_loss',
        title: 'Final loss',
        summary: 'All remedies were waived and the matter was closed.',
      ),
    );
    await tester.pumpWidget(
      const MaterialApp(
        home: DossierScreen(dossier: closed, locale: 'en'),
      ),
    );

    expect(find.text('Closed matter'), findsOneWidget);
    expect(find.text('Closure'), findsOneWidget);
    expect(find.text('Final loss'), findsOneWidget);
    expect(
      find.text('All remedies were waived and the matter was closed.'),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('dossier-remedy-file_appeal')),
      findsNothing,
    );
  });

  testWidgets('HomeShell suspends clock and hands a remedy to action picker', (
    WidgetTester tester,
  ) async {
    final _DossierRepository repository = _DossierRepository();
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
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey<String>('open-dossier-button')),
      200,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(find.byKey(const ValueKey<String>('open-dossier-button')));
    await tester.pumpAndSettle();
    expect(find.text('Matter dossier'), findsOneWidget);

    await tester.pump(const Duration(seconds: 8));
    expect(repository.advanceCount, 0);

    await tester.drag(
      find.byKey(const PageStorageKey<String>('dossier-scroll')),
      const Offset(0, -900),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(
      find.byKey(const ValueKey<String>('dossier-remedy-file_appeal')),
    );
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey<String>('dossier-remedy-file_appeal')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Available actions'), findsOneWidget);
    expect(find.text('File appeal'), findsOneWidget);
    await tester.pump(const Duration(seconds: 8));
    expect(repository.advanceCount, 0);

    await tester.tap(find.text('File appeal'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yes'));
    await tester.pumpAndSettle();
    expect(repository.lastActionId, 'file_appeal');
    repository.dispose();
  });
}

DossierProjectionView _dossier() {
  return const DossierProjectionView(
    projectionSchemaVersion: 1,
    procedure: DossierProcedureView(
      stageId: 'post_judgment_remedies',
      stageTitle: 'Post-judgment remedies',
      clockMinutes: 60,
      matterLifecycle: DossierLifecycleStatus.postJudgment,
      isClosed: false,
      matterStatus: DossierMatterStatus.recoverable,
    ),
    judicialResult: DossierJudicialResult.lost,
    judicialDecisionInstance: DossierJudicialDecisionInstance.firstInstance,
    facts: <DossierFactView>[
      DossierFactView(
        id: 'known_fact',
        statement: 'The judgment rejected the first-instance claim.',
        status: DossierFactStatus.proven,
      ),
    ],
    evidence: <DossierEvidenceView>[
      DossierEvidenceView(
        id: 'judgment_copy',
        title: 'First-instance judgment',
        kind: 'document',
        description: 'Certified copy received from the court.',
        supportsFactIds: <String>['known_fact'],
        contradictsFactIds: <String>[],
      ),
    ],
    deadlines: <DossierDeadlineView>[
      DossierDeadlineView(
        id: 'appeal_deadline',
        title: 'Appeal deadline',
        dueAtMinutes: 300,
        status: DossierDeadlineStatus.open,
        remedies: <DossierRemedyView>[
          DossierRemedyView(
            actionId: 'file_appeal',
            title: 'File appeal',
            description: 'Use the available appellate remedy.',
            timeCostMinutes: 60,
            costEur: 1500,
          ),
        ],
      ),
    ],
  );
}

final class _DossierRepository extends GameRuntimeRepository {
  _DossierRepository()
      : _snapshot = DemoGameRepository(seed: 20260803).snapshot.copyWith(
          dossier: _dossier(),
          actions: const <GameActionView>[
            GameActionView(
              id: 'file_appeal',
              title: 'File appeal',
              description: 'Use the available appellate remedy.',
              timeLabel: '1h',
              costEur: 1500,
              tone: ActionTone.primary,
            ),
          ],
        );

  GameSnapshot _snapshot;
  int advanceCount = 0;
  String? lastActionId;

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
    lastActionId = actionId;
    return const ActionExecutionResult(
      title: 'File appeal',
      message: 'Filed.',
      isRisky: false,
    );
  }

  @override
  void markInboxItemRead(String itemId) {}

  @override
  void reset() {
    _snapshot = _snapshot.copyWith();
    notifyListeners();
  }
}
