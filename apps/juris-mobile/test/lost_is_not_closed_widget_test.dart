import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/gameplay_locale.dart';
import 'package:juris_mobile/data/demo_game_repository.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/screens/matter_screen.dart';
import 'package:juris_mobile/widgets/case_report_sheet.dart';

void main() {
  testWidgets('lost decision keeps remedies visible while matter is open', (
    WidgetTester tester,
  ) async {
    final GameSnapshot snapshot =
        DemoGameRepository(seed: 20260724).snapshot.copyWith(
              stage: 'Post-judgment remedies',
              judicialResult: JudicialResult.lost,
              judicialDecisionInstance: JudicialDecisionInstance.firstInstance,
              matterLifecycle: MatterLifecycleStatus.postJudgment,
              isClosed: false,
              actions: const <GameActionView>[
                GameActionView(
                  id: 'file_appeal',
                  title: 'File appeal',
                  description: 'Pursue the available appellate remedy.',
                  timeLabel: '1h',
                  costEur: 0,
                  tone: ActionTone.primary,
                ),
              ],
              clearOutcomeSummary: true,
            );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MatterScreen(
            snapshot: snapshot,
            onShowActions: () {},
            onShowDossier: () {},
          ),
        ),
      ),
    );

    expect(find.text('Decision: Lost'), findsOneWidget);
    expect(find.text('Court instance: First instance'), findsOneWidget);
    expect(
      find.text('Matter status: Post-judgment — remedies available'),
      findsOneWidget,
    );
    await tester.scrollUntilVisible(
      find.text('Review 1 available actions'),
      300,
      scrollable: find.byType(Scrollable).last,
      maxScrolls: 20,
    );
    await tester.pumpAndSettle();
    expect(find.text('Review 1 available actions'), findsOneWidget);
    expect(find.text('Final outcome'), findsNothing);
    expect(find.text('Case report'), findsNothing);
  });

  testWidgets('case report presents decision only after explicit closure', (
    WidgetTester tester,
  ) async {
    final GameSnapshot snapshot =
        DemoGameRepository(seed: 20260724).snapshot.copyWith(
              stage: 'Resolved',
              judicialResult: JudicialResult.won,
              judicialDecisionInstance: JudicialDecisionInstance.appeal,
              matterLifecycle: MatterLifecycleStatus.closed,
              isClosed: true,
              outcomeSummary: const CaseOutcomeSummaryView(
                headline: 'Appellate success enforced',
                finalStatus: 'appellate_success',
                detail: 'Enforcement completed and the matter was closed.',
                closedAt: 'Day 1 · 14:00',
                awardEur: 0,
                costsEur: 0,
                keySuccesses: <String>[],
                missedOpportunities: <String>[],
              ),
            );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CaseReportSheet(
            snapshot: snapshot,
            summary: snapshot.outcomeSummary!,
          ),
        ),
      ),
    );

    expect(find.text('Case report'), findsOneWidget);
    expect(find.text('Won'), findsOneWidget);
    expect(find.text('Court instance'), findsOneWidget);
    expect(find.text('Appeal'), findsOneWidget);
    expect(find.text('Closed'), findsOneWidget);
    expect(find.text('Appellate success enforced'), findsOneWidget);
  });

  testWidgets('lifecycle decision and status remain localized in Russian', (
    WidgetTester tester,
  ) async {
    final GameSnapshot snapshot =
        DemoGameRepository(seed: 20260724).snapshot.copyWith(
              stage: 'Средства обжалования после решения',
              judicialResult: JudicialResult.lost,
              judicialDecisionInstance: JudicialDecisionInstance.firstInstance,
              matterLifecycle: MatterLifecycleStatus.postJudgment,
              isClosed: false,
              clearOutcomeSummary: true,
            );

    await tester.pumpWidget(
      GameplayLocale(
        locale: 'en',
        child: MaterialApp(
          home: Scaffold(
            body: MatterScreen(
              snapshot: snapshot,
              onShowActions: () {},
              onShowDossier: () {},
            ),
          ),
        ),
      ),
    );
    expect(find.text('Decision: Lost'), findsOneWidget);
    expect(find.text('Court instance: First instance'), findsOneWidget);
    expect(
      find.text('Matter status: Post-judgment — remedies available'),
      findsOneWidget,
    );

    await tester.pumpWidget(
      GameplayLocale(
        locale: 'ru',
        child: MaterialApp(
          home: Scaffold(
            body: MatterScreen(
              snapshot: snapshot,
              onShowActions: () {},
              onShowDossier: () {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Решение: Поражение'), findsOneWidget);
    expect(
      find.text('Судебная инстанция: Первая инстанция'),
      findsOneWidget,
    );
    expect(
      find.text(
        'Статус дела: После решения — доступны средства обжалования',
      ),
      findsOneWidget,
    );
    expect(find.text('Поражение в первой инстанции'), findsNothing);
  });
}
