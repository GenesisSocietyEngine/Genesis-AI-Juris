import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/juris_app.dart';
import 'package:juris_mobile/data/demo_game_repository.dart';
import 'package:juris_mobile/models/game_snapshot.dart';

void main() {
  testWidgets('mobile shell opens on the actionable inbox', (
    WidgetTester tester,
  ) async {
    // This proves the app boots from a deterministic repository and exposes
    // the first professional decision without requiring the Rust bridge.
    await tester.pumpWidget(
      JurisApp(repository: DemoGameRepository(seed: 20260724)),
    );

    expect(find.text('Inbox'), findsWidgets);
    expect(
        find.text('Urgent: ERP supplier termination notice'), findsOneWidget);
    expect(find.text('ACTION REQUIRED'), findsOneWidget);
  });

  testWidgets('action confirmation provides explicit No and Yes choices', (
    WidgetTester tester,
  ) async {
    // This proves a player can explicitly decline a proposed action instead of
    // relying on an ambiguous Cancel button.
    await tester.pumpWidget(
      JurisApp(repository: DemoGameRepository(seed: 20260724)),
    );

    await tester.tap(find.textContaining('Actions ·'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Run conflict check'));
    await tester.pumpAndSettle();

    expect(find.text('No'), findsOneWidget);
    expect(find.text('Yes'), findsOneWidget);

    await tester.tap(find.text('Yes'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Investigation'), findsWidgets);
    expect(find.text('Board expects visible action'), findsOneWidget);
  });

  testWidgets('tapping settlement tile allows an explicit No response', (
    WidgetTester tester,
  ) async {
    // The setup resolves the earlier CFO request so that the settlement offer
    // is the only action-required inbox item. This keeps the test focused on
    // the contextual Yes/No settlement interaction.
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);

    repository.applyAction('run-conflict-check');
    repository.applyAction('reply-cfo');
    repository.applyAction('request-documents');

    await tester.pumpWidget(JurisApp(repository: repository));

    await tester.tap(find.text('Without-prejudice settlement offer'));
    await tester.pumpAndSettle();

    expect(find.text('Yes — accept EUR 64,500'), findsOneWidget);
    expect(find.text('No — reject the offer'), findsOneWidget);

    await tester.tap(find.text('No — reject the offer'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Yes'));
    await tester.pumpAndSettle();

    expect(repository.snapshot.settlementOffer, isNull);

    final InboxItemView settlementMessage =
        repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id == 'settlement-offer',
    );

    expect(settlementMessage.status, InboxStatus.resolved);
    expect(repository.snapshot.unhandledRequiredMessages, 0);
  });

  testWidgets('bottom navigation opens the matter dashboard', (
    WidgetTester tester,
  ) async {
    // The evidence section lives below the initial viewport in a lazily built
    // scroll view, so the test must scroll before asserting its presence.
    await tester.pumpWidget(
      JurisApp(repository: DemoGameRepository(seed: 20260724)),
    );

    await tester.tap(find.byIcon(Icons.gavel_outlined));
    await tester.pumpAndSettle();

    expect(find.text('Case strength'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Known evidence'),
      300,
      scrollable: find.byType(Scrollable).last,
      maxScrolls: 20,
    );
    await tester.pumpAndSettle();

    expect(find.text('Known evidence'), findsOneWidget);
  });
  test('independent ERP expert cannot be commissioned twice', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');
    repository.applyAction('request-documents');

    repository.applyAction('future-expert');

    final int spendAfterFirstExecution = repository.snapshot.spendEur;
    final int minutesAfterFirstExecution = repository.snapshot.billableMinutes;

    expect(repository.snapshot.independentExpertCommissioned, isTrue);
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'future-expert',
      ),
      isFalse,
    );

    final ActionExecutionResult secondResult =
        repository.applyAction('future-expert');

    expect(secondResult.title, 'Action unavailable');
    expect(repository.snapshot.spendEur, spendAfterFirstExecution);
    expect(repository.snapshot.billableMinutes, minutesAfterFirstExecution);
    expect(
      repository.snapshot.inbox
          .where((InboxItemView item) => item.id == 'expert-assignment')
          .length,
      1,
    );
  });

  test('identical AI damages task cannot repeat for unchanged facts', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');
    repository.applyAction('request-documents');

    repository.applyAction('future-damages');

    final int spendAfterFirstExecution = repository.snapshot.spendEur;
    final int requestsAfterFirstExecution = repository.snapshot.aiRequestsUsed;

    expect(
      repository.snapshot.aiDamagesModelRevision,
      repository.snapshot.knownFactsRevision,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'future-damages',
      ),
      isFalse,
    );

    final ActionExecutionResult secondResult =
        repository.applyAction('future-damages');

    expect(secondResult.title, 'Action unavailable');
    expect(repository.snapshot.spendEur, spendAfterFirstExecution);
    expect(repository.snapshot.aiRequestsUsed, requestsAfterFirstExecution);
  });

  test('completed AI legal research is not regenerated without new facts', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);

    repository.applyAction('ask-ai-research');
    repository.applyAction('run-conflict-check');

    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'ask-ai-research',
      ),
      isFalse,
    );
  });

  test('rest advances to the next workday every time', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);

    // Rest is intentionally unavailable during Intake. Completing the conflict
    // check opens the workday loop and the first professional deadlines.
    final ActionExecutionResult setup =
        repository.applyAction('run-conflict-check');
    expect(setup.title, 'Conflict check complete');

    final ActionExecutionResult firstRest = repository.applyAction('rest');
    expect(firstRest.title, 'New workday');
    expect(repository.snapshot.dayLabel, 'Day 2');
    expect(repository.snapshot.timeLabel, '08:00');

    final ActionExecutionResult secondRest = repository.applyAction('rest');
    expect(secondRest.title, 'New workday');
    expect(repository.snapshot.dayLabel, 'Day 3');
    expect(repository.snapshot.timeLabel, '08:00');
  });

  test('deadline actions complete or miss their own deadline', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');

    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'prepare-partner-brief',
      ),
      isTrue,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'issue-preservation-notice',
      ),
      isTrue,
    );

    repository.applyAction('prepare-partner-brief');
    expect(
      repository.snapshot.deadlines
          .singleWhere((DeadlineView item) => item.id == 'partner-brief')
          .status,
      DeadlineStatus.done,
    );

    repository.applyAction('rest');
    expect(
      repository.snapshot.deadlines
          .singleWhere((DeadlineView item) => item.id == 'preservation')
          .status,
      DeadlineStatus.open,
    );

    repository.applyAction('rest');
    expect(
      repository.snapshot.deadlines
          .singleWhere((DeadlineView item) => item.id == 'preservation')
          .status,
      DeadlineStatus.missed,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'issue-preservation-notice',
      ),
      isFalse,
    );
  });

  test('preservation notice has an executable action and can be completed', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');
    repository.applyAction('rest');

    final ActionExecutionResult result =
        repository.applyAction('issue-preservation-notice');

    expect(result.title, 'Preservation notice issued');
    expect(
      repository.snapshot.deadlines
          .singleWhere((DeadlineView item) => item.id == 'preservation')
          .status,
      DeadlineStatus.done,
    );
    expect(
      repository.snapshot.inbox.any(
        (InboxItemView item) => item.id == 'preservation-confirmed',
      ),
      isTrue,
    );
  });

  test('expert assignment produces a report and review action on schedule', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');
    repository.applyAction('request-documents');
    repository.applyAction('future-expert');

    expect(
      repository.snapshot.expertReviewStatus,
      ExpertReviewStatus.pending,
    );

    repository.applyAction('rest');
    expect(
      repository.snapshot.expertReviewStatus,
      ExpertReviewStatus.pending,
    );

    repository.applyAction('rest');
    expect(
      repository.snapshot.expertReviewStatus,
      ExpertReviewStatus.reportReady,
    );
    expect(
      repository.snapshot.inbox
          .singleWhere((InboxItemView item) => item.id == 'expert-assignment')
          .status,
      InboxStatus.resolved,
    );
    expect(
      repository.snapshot.inbox
          .singleWhere(
            (InboxItemView item) => item.id == 'expert-report-ready',
          )
          .status,
      InboxStatus.actionRequired,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'review-expert-report',
      ),
      isTrue,
    );

    final int factsBeforeReview = repository.snapshot.knownFactsRevision;
    repository.applyAction('review-expert-report');

    expect(
      repository.snapshot.expertReviewStatus,
      ExpertReviewStatus.reviewed,
    );
    expect(repository.snapshot.knownFactsRevision, factsBeforeReview + 1);
    expect(
      repository.snapshot.evidence.any(
        (EvidenceView item) => item.id == 'independent-expert-report',
      ),
      isTrue,
    );
  });

  testWidgets('tapping an open deadline exposes its related action', (
    WidgetTester tester,
  ) async {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');

    await tester.pumpWidget(JurisApp(repository: repository));

    await tester.tap(find.byIcon(Icons.event_outlined));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Evidence-preservation notice'),
      250,
      scrollable: find.byType(Scrollable).last,
      maxScrolls: 10,
    );
    await tester.tap(find.text('Evidence-preservation notice'));
    await tester.pumpAndSettle();

    expect(find.text('Deadline details'), findsOneWidget);
    expect(find.text('Due Day 2 · 17:00'), findsOneWidget);
    expect(find.text('Open related action'), findsOneWidget);

    // Opening the detail sheet alone must not complete the deadline.
    expect(
      repository.snapshot.deadlines
          .singleWhere((DeadlineView item) => item.id == 'preservation')
          .status,
      DeadlineStatus.open,
    );
  });

  test('settlement exit exposes formal proceedings instead of endless rest',
      () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');
    repository.applyAction('request-documents');

    final ActionExecutionResult rejection =
        repository.applyAction('reject-settlement');

    expect(rejection.title, 'Settlement rejected');
    expect(repository.snapshot.stage, 'Pre-litigation');
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'commence-proceedings',
      ),
      isTrue,
    );

    repository.applyAction('commence-proceedings');

    expect(repository.snapshot.stage, 'Pleadings');
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'prepare-statement-of-claim',
      ),
      isTrue,
    );
  });

  test('expired settlement offer also unlocks formal proceedings', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');
    repository.applyAction('request-documents');

    repository.applyAction('rest');
    repository.applyAction('rest');

    expect(repository.snapshot.dayLabel, 'Day 3');
    expect(repository.snapshot.settlementOffer, isNull);
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'commence-proceedings',
      ),
      isTrue,
    );
  });

  test('evidence filing schedules a hearing without premature attendance', () {
    final DemoGameRepository repository = _buildMatterWithScheduledHearing();

    final DeadlineView hearing = repository.snapshot.deadlines.singleWhere(
      (DeadlineView item) => item.id == 'enterprise-court-hearing-1',
    );

    expect(hearing.kind, CalendarItemKind.mandatoryEvent);
    expect(hearing.status, DeadlineStatus.scheduled);
    expect(hearing.dueAt, 'Day 5 · 10:00');
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'attend-hearing',
      ),
      isFalse,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'request-hearing-reschedule',
      ),
      isTrue,
    );

    final ActionExecutionResult premature =
        repository.applyAction('attend-hearing');
    expect(premature.title, 'Action unavailable');
    expect(repository.snapshot.stage, 'Hearing preparation');
  });

  test('rescheduling request keeps original hearing active until granted', () {
    final DemoGameRepository repository = _buildMatterWithScheduledHearing();

    final ActionExecutionResult request =
        repository.applyAction('request-hearing-reschedule');
    expect(request.title, 'Rescheduling request submitted');

    final DeadlineView pending = repository.snapshot.deadlines.singleWhere(
      (DeadlineView item) => item.id == 'enterprise-court-hearing-1',
    );
    expect(pending.status, DeadlineStatus.scheduled);
    expect(pending.dueAt, 'Day 5 · 10:00');
    expect(
      pending.rescheduleStatus,
      RescheduleRequestStatus.pending,
    );

    repository.applyAction('rest');

    final DeadlineView original = repository.snapshot.deadlines.singleWhere(
      (DeadlineView item) => item.id == 'enterprise-court-hearing-1',
    );
    final DeadlineView replacement = repository.snapshot.deadlines.singleWhere(
      (DeadlineView item) => item.id == 'enterprise-court-hearing-2',
    );

    expect(original.status, DeadlineStatus.rescheduled);
    expect(
      original.rescheduleStatus,
      RescheduleRequestStatus.granted,
    );
    expect(original.replacementItemId, replacement.id);
    expect(replacement.status, DeadlineStatus.scheduled);
    expect(replacement.dueAt, 'Day 9 · 14:00');
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'attend-hearing',
      ),
      isFalse,
    );
  });

  testWidgets('scheduled hearing exposes rescheduling from Calendar', (
    WidgetTester tester,
  ) async {
    final DemoGameRepository repository = _buildMatterWithScheduledHearing();

    await tester.pumpWidget(JurisApp(repository: repository));
    await tester.tap(find.byIcon(Icons.event_outlined));
    await tester.pumpAndSettle();
    final Finder hearingRow = find.byKey(
      const ValueKey<String>(
        'calendar-item-enterprise-court-hearing-1',
      ),
    );

    expect(hearingRow, findsOneWidget);
    await tester.ensureVisible(hearingRow);
    await tester.pumpAndSettle();
    await tester.tap(hearingRow);
    await tester.pumpAndSettle();

    expect(find.text('Hearing details'), findsOneWidget);
    expect(find.text('Scheduled Day 5 · 10:00'), findsOneWidget);
    expect(find.text('Request rescheduling'), findsOneWidget);
    expect(find.text('Open related action'), findsNothing);
  });

  test('matter can advance through scheduled hearing and judgment', () {
    final DemoGameRepository repository = _buildMatterWithScheduledHearing();

    while (repository.snapshot.dayLabel != 'Day 5') {
      final ActionExecutionResult rest = repository.applyAction('rest');
      expect(rest.title, 'New workday');
    }

    expect(repository.snapshot.timeLabel, '08:00');
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'attend-hearing',
      ),
      isFalse,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'wait-until-hearing',
      ),
      isTrue,
    );

    repository.applyAction('wait-until-hearing');
    expect(repository.snapshot.timeLabel, '10:00');
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'attend-hearing',
      ),
      isTrue,
    );

    repository.applyAction('attend-hearing');
    expect(repository.snapshot.stage, 'Judgment pending');
    expect(
      repository.snapshot.deadlines
          .singleWhere(
            (DeadlineView item) => item.id == 'enterprise-court-hearing-1',
          )
          .status,
      DeadlineStatus.done,
    );

    repository.applyAction('rest');
    expect(repository.snapshot.stage, 'Resolved');
    expect(repository.snapshot.actions, isEmpty);
    expect(
      repository.snapshot.inbox.any(
        (InboxItemView item) => item.id.startsWith('judgment-day-'),
      ),
      isTrue,
    );
  });
}

DemoGameRepository _buildMatterWithScheduledHearing() {
  final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
  repository.applyAction('run-conflict-check');
  repository.applyAction('request-documents');
  repository.applyAction('reject-settlement');
  repository.applyAction('commence-proceedings');
  repository.applyAction('prepare-statement-of-claim');
  repository.applyAction('prepare-evidence-bundle');
  return repository;
}
