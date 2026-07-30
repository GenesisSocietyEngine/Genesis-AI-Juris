import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/home_shell.dart';
import 'package:juris_mobile/app/juris_app.dart';
import 'package:juris_mobile/data/demo_game_repository.dart';
import 'package:juris_mobile/models/game_snapshot.dart';

void main() {
  test('clock speeds map to 15, 30, and 60 game minutes per real minute', () {
    expect(
      SimulationClockSpeed.standard.gameMinutesPerRealMinute,
      15,
    );
    expect(
      SimulationClockSpeed.standard.tickInterval,
      const Duration(seconds: 4),
    );
    expect(SimulationClockSpeed.x2.gameMinutesPerRealMinute, 30);
    expect(
      SimulationClockSpeed.x2.tickInterval,
      const Duration(seconds: 2),
    );
    expect(SimulationClockSpeed.x4.gameMinutesPerRealMinute, 60);
    expect(
      SimulationClockSpeed.x4.tickInterval,
      const Duration(seconds: 1),
    );
  });

  testWidgets('pausing the clock does not block inbox cards', (
    WidgetTester tester,
  ) async {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    await tester.pumpWidget(JurisApp(repository: repository));

    await tester.tap(
      find.byKey(const ValueKey<String>('simulation-pause-toggle')),
    );
    await tester.pumpAndSettle();

    expect(find.byTooltip('Resume simulation clock'), findsOneWidget);

    await tester.tap(find.text('Urgent: ERP supplier termination notice'));
    await tester.pumpAndSettle();

    expect(find.text('Run conflict check'), findsOneWidget);
    expect(find.text('Accept matter immediately'), findsOneWidget);
  });

  testWidgets('speed selector exposes standard, 2x, and 4x choices', (
    WidgetTester tester,
  ) async {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    await tester.pumpWidget(JurisApp(repository: repository));

    await tester.tap(
      find.byKey(const ValueKey<String>('simulation-speed-menu')),
    );
    await tester.pumpAndSettle();

    expect(find.text('15 game min / real min'), findsOneWidget);
    expect(find.text('30 game min / real min'), findsOneWidget);
    expect(find.text('60 game min / real min'), findsOneWidget);
  });

  testWidgets('open gameplay sheets suspend foreground clock ticks', (
    WidgetTester tester,
  ) async {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    await tester.pumpWidget(
      MaterialApp(
        home: HomeShell(
          repository: repository,
          enableLiveClockInTests: true,
        ),
      ),
    );
    final String before = repository.snapshot.timeLabel;

    await tester.tap(find.text('Urgent: ERP supplier termination notice'));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 8));

    expect(repository.snapshot.timeLabel, before);
    Navigator.of(tester.element(find.byType(HomeShell))).pop();
    await tester.pumpAndSettle();
  });

  testWidgets('calendar offers rest until the next 08:00 work period', (
    WidgetTester tester,
  ) async {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    await tester.pumpWidget(JurisApp(repository: repository));

    await tester.tap(find.byIcon(Icons.event_outlined));
    await tester.pumpAndSettle();
    final Finder restButton =
        find.byKey(const ValueKey<String>('rest-until-next-workday'));
    await tester.ensureVisible(restButton);
    await tester.pumpAndSettle();
    await tester.tap(restButton);
    await tester.pumpAndSettle();

    expect(repository.snapshot.dayLabel, 'Day 2');
    expect(repository.snapshot.timeLabel, '08:00');
  });

  testWidgets('automatic clock error pauses subsequent commands', (
    WidgetTester tester,
  ) async {
    final _FailingClockRepository repository = _FailingClockRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: HomeShell(
          repository: repository,
          enableLiveClockInTests: true,
        ),
      ),
    );

    await tester.pump(const Duration(seconds: 4));
    expect(repository.advanceCalls, 1);
    expect(find.text('Controlled clock failure'), findsOneWidget);
    expect(find.byTooltip('Resume simulation clock'), findsOneWidget);

    await tester.pump(const Duration(seconds: 12));
    expect(repository.advanceCalls, 1);
  });

  test('dismissed judgment records loss without closing review routes', () {
    final DemoGameRepository repository = _buildLosingHearingMatter();

    expect(repository.snapshot.stage, 'Post-judgment');
    expect(
      repository.snapshot.caseResultStatus,
      CaseResultStatus.lostAtFirstInstance,
    );
    expect(
      repository.snapshot.engagementStatus,
      EngagementStatus.awaitingClientInstructions,
    );
    expect(repository.snapshot.outcomeSummary, isNull);
  });

  test('client can accept first-instance loss and close the matter', () {
    final DemoGameRepository repository = _buildLosingHearingMatter();

    repository.applyAction('inform-client-judgment');
    repository.applyAction('accept-judgment-and-close');

    expect(repository.snapshot.stage, 'Resolved');
    expect(
      repository.snapshot.caseResultStatus,
      CaseResultStatus.lostAtFirstInstance,
    );
    expect(
      repository.snapshot.engagementStatus,
      EngagementStatus.completed,
    );
    expect(repository.snapshot.actions, isEmpty);
    expect(repository.snapshot.outcomeSummary?.headline, 'Claim dismissed');
  });

  test('authorized appeal can progress to claimant cassation and remittal', () {
    final DemoGameRepository repository = _buildLosingHearingMatter();

    repository.applyAction('inform-client-judgment');
    repository.applyAction('prepare-appeal-advice');
    repository.applyAction('seek-client-appeal-authorization');

    expect(repository.snapshot.stage, 'Appeal preparation');
    expect(
      repository.snapshot.inbox.any(
        (InboxItemView item) => item.id == 'client-authorized-appeal',
      ),
      isTrue,
    );

    repository.applyAction('file-appeal');
    expect(repository.snapshot.stage, 'Appeal pending');
    repository.applyAction('await-appeal-decision');

    expect(repository.snapshot.stage, 'Cassation assessment');
    expect(
      repository.snapshot.caseResultStatus,
      CaseResultStatus.lostOnAppeal,
    );

    repository.applyAction('assess-cassation-grounds');
    repository.applyAction('seek-client-cassation-authorization');

    expect(repository.snapshot.stage, 'Cassation preparation');
    expect(
      repository.snapshot.inbox.any(
        (InboxItemView item) => item.id == 'client-authorized-cassation',
      ),
      isTrue,
    );

    repository.applyAction('file-cassation-appeal');
    expect(repository.snapshot.stage, 'Cassation pending');
    repository.applyAction('await-cassation-decision');

    expect(repository.snapshot.stage, 'Resolved');
    expect(
      repository.snapshot.caseResultStatus,
      CaseResultStatus.remittedAfterCassation,
    );
    expect(
      repository.snapshot.outcomeSummary?.headline,
      'Decision quashed and remitted',
    );
  });

  testWidgets('matter dashboard displays lost-at-first-instance status', (
    WidgetTester tester,
  ) async {
    final DemoGameRepository repository = _buildLosingHearingMatter();
    await tester.pumpWidget(JurisApp(repository: repository));

    await tester.tap(find.byIcon(Icons.gavel_outlined));
    await tester.pumpAndSettle();

    expect(find.text('Lost at first instance'), findsOneWidget);
    expect(find.text('Awaiting client instructions'), findsOneWidget);
  });
}

DemoGameRepository _buildLosingHearingMatter() {
  final DemoGameRepository repository = DemoGameRepository(seed: 20260701);
  repository.applyAction('run-conflict-check');
  repository.applyAction('prepare-partner-brief');
  repository.applyAction('issue-preservation-notice');
  repository.applyAction('request-documents');
  repository.applyAction('reject-settlement');
  repository.applyAction('commence-proceedings');
  repository.applyAction('prepare-statement-of-claim');
  repository.applyAction('prepare-evidence-bundle');
  repository.applyAction('wait-until-hearing');
  repository.applyAction('attend-hearing');
  repository.applyAction('rest');
  return repository;
}

final class _FailingClockRepository extends DemoGameRepository {
  _FailingClockRepository() : super(seed: 20260724);

  int advanceCalls = 0;

  @override
  String? get clockErrorMessage => 'Controlled clock failure';

  @override
  void advanceTimeByMinutes(int minutes) {
    advanceCalls += 1;
    throw StateError('controlled test error');
  }
}
