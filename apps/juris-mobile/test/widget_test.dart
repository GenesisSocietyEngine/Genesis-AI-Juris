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
    await tester.ensureVisible(find.text('Evidence-preservation notice'));
    await tester.pumpAndSettle();
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

  test('judgment requires client briefing before post-judgment branch', () {
    final DemoGameRepository repository = _buildMatterWithScheduledHearing();

    final ActionExecutionResult advance =
        repository.applyAction('wait-until-hearing');
    expect(advance.title, 'Hearing time reached');
    expect(repository.snapshot.dayLabel, 'Day 5');
    expect(repository.snapshot.timeLabel, '10:00');

    repository.applyAction('attend-hearing');
    expect(repository.snapshot.stage, 'Judgment pending');

    repository.applyAction('rest');
    expect(repository.snapshot.stage, 'Post-judgment');
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'inform-client-judgment',
      ),
      isTrue,
    );

    final InboxItemView judgment = repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id.startsWith('judgment-day-'),
    );
    expect(judgment.status, InboxStatus.actionRequired);

    repository.applyAction('inform-client-judgment');

    final InboxItemView resolvedJudgment =
        repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id == judgment.id,
    );
    expect(resolvedJudgment.status, InboxStatus.resolved);
    expect(
      repository.snapshot.inbox.any(
        (InboxItemView item) => item.id == 'client-judgment-briefed',
      ),
      isTrue,
    );

    // Seed 20260724 deterministically selects the optional counterparty
    // cassation branch in the demo scenario.
    repository.applyAction('rest');
    expect(repository.snapshot.stage, 'Cassation response');
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'prepare-cassation-response',
      ),
      isTrue,
    );
    expect(
      repository.snapshot.inbox.any(
        (InboxItemView item) =>
            item.id.startsWith('counterparty-cassation-') &&
            item.status == InboxStatus.actionRequired,
      ),
      isTrue,
    );
  });

  test(
      'rescheduled hearing immediately exposes extension work and clock advance',
      () {
    final DemoGameRepository repository = _buildMatterWithScheduledHearing();

    repository.applyAction('request-hearing-reschedule');
    repository.applyAction('rest');

    expect(repository.snapshot.dayLabel, 'Day 2');
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'wait-until-hearing',
      ),
      isTrue,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'prepare-hearing-strategy',
      ),
      isTrue,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'prepare-key-witness',
      ),
      isTrue,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'reconcile-damages-schedule',
      ),
      isTrue,
    );

    final int strengthBefore = repository.snapshot.caseStrength;
    repository.applyAction('prepare-hearing-strategy');
    expect(repository.snapshot.caseStrength, greaterThan(strengthBefore));
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'prepare-hearing-strategy',
      ),
      isFalse,
    );

    repository.applyAction('wait-until-hearing');
    expect(repository.snapshot.dayLabel, 'Day 9');
    expect(repository.snapshot.timeLabel, '14:00');
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'attend-hearing',
      ),
      isTrue,
    );
  });

  testWidgets('opening an informational message clears its unread badge', (
    WidgetTester tester,
  ) async {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');
    repository.applyAction('delegate-review');

    await tester.pumpWidget(JurisApp(repository: repository));

    final Finder message = find.text('Document review in progress');
    await tester.ensureVisible(message);
    await tester.tap(message);
    await tester.pumpAndSettle();

    final InboxItemView opened = repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id == 'junior-report',
    );
    expect(opened.status, InboxStatus.read);
    expect(find.text('UNREAD'), findsNothing);
  });

  test('cassation response resolves the required event and reaches an outcome',
      () {
    final DemoGameRepository repository = _buildMatterWithScheduledHearing();
    repository.applyAction('wait-until-hearing');
    repository.applyAction('attend-hearing');
    repository.applyAction('rest');
    repository.applyAction('inform-client-judgment');
    repository.applyAction('rest');

    final InboxItemView challenge = repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id.startsWith('counterparty-cassation-'),
    );
    expect(challenge.status, InboxStatus.actionRequired);

    repository.applyAction('prepare-cassation-response');

    final InboxItemView resolvedChallenge =
        repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id == challenge.id,
    );
    expect(resolvedChallenge.status, InboxStatus.resolved);
    expect(repository.snapshot.stage, 'Cassation pending');
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'await-cassation-decision',
      ),
      isTrue,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'rest',
      ),
      isFalse,
    );

    repository.applyAction('await-cassation-decision');
    expect(repository.snapshot.stage, 'Resolved');
    expect(repository.snapshot.actions, isEmpty);
    expect(
      repository.snapshot.inbox.any(
        (InboxItemView item) => item.id.startsWith('cassation-outcome-'),
      ),
      isTrue,
    );
  });

  test(
      'unreviewed expert report no longer remains action-required after hearing',
      () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');
    // Resolve the unrelated CFO response first so this regression test
    // measures only the lifecycle of the expert-report notification.
    repository.applyAction('reply-cfo');
    repository.applyAction('request-documents');
    repository.applyAction('future-expert');
    repository.applyAction('reject-settlement');
    repository.applyAction('commence-proceedings');
    repository.applyAction('prepare-statement-of-claim');
    repository.applyAction('prepare-evidence-bundle');
    repository.applyAction('wait-until-hearing');

    final InboxItemView readyReport = repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id.startsWith('expert-report-ready'),
    );
    expect(readyReport.status, InboxStatus.actionRequired);

    repository.applyAction('attend-hearing');

    final InboxItemView archivedReport = repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id == readyReport.id,
    );
    expect(archivedReport.status, InboxStatus.resolved);
    expect(
      repository.snapshot.inbox.where(
        (InboxItemView item) =>
            item.id.startsWith('expert-report-ready') &&
            item.status == InboxStatus.actionRequired,
      ),
      isEmpty,
    );
    expect(
      repository.snapshot.inbox.any(
        (InboxItemView item) =>
            item.id == 'expert-report-not-reviewed-before-hearing',
      ),
      isTrue,
    );
    expect(repository.snapshot.unhandledRequiredMessages, 0);
  });

  testWidgets('judgment action informs client and clears required status', (
    WidgetTester tester,
  ) async {
    final DemoGameRepository repository = _buildMatterWithScheduledHearing();
    repository.applyAction('wait-until-hearing');
    repository.applyAction('attend-hearing');
    repository.applyAction('rest');

    final InboxItemView judgment = repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id.startsWith('judgment-day-'),
    );
    expect(judgment.status, InboxStatus.actionRequired);
    final int requiredBefore = repository.snapshot.unhandledRequiredMessages;

    await tester.pumpWidget(JurisApp(repository: repository));
    final Finder judgmentSubject = find.text(judgment.subject);
    await tester.ensureVisible(judgmentSubject);
    await tester.tap(judgmentSubject);
    await tester.pumpAndSettle();

    expect(find.text('Inform client and explain judgment'), findsOneWidget);
    await tester.tap(find.text('Inform client and explain judgment'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yes'));
    await tester.pumpAndSettle();

    final InboxItemView resolved = repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id == judgment.id,
    );
    expect(resolved.status, InboxStatus.resolved);
    expect(
      repository.snapshot.unhandledRequiredMessages,
      requiredBefore - 1,
    );
  });

  test('attended hearing can end in a full loss on a weak record', () {
    final DemoGameRepository repository =
        _buildMatterWithScheduledHearing(seed: 20260701);

    repository.applyAction('wait-until-hearing');
    final DeadlineView hearing = repository.snapshot.deadlines.singleWhere(
      (DeadlineView item) => item.id == 'enterprise-court-hearing-1',
    );
    expect(hearing.status, DeadlineStatus.scheduled);

    repository.applyAction('attend-hearing');
    final DeadlineView completedHearing =
        repository.snapshot.deadlines.singleWhere(
      (DeadlineView item) => item.id == 'enterprise-court-hearing-1',
    );
    expect(completedHearing.status, DeadlineStatus.done);

    repository.applyAction('rest');

    expect(repository.snapshot.stage, 'Post-judgment');
    final InboxItemView judgment = repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id.startsWith('judgment-day-'),
    );
    expect(judgment.subject, 'Judgment: claim dismissed');
    expect(judgment.body, contains('despite recorded attendance'));
    expect(judgment.status, InboxStatus.actionRequired);
  });

  test('losing judgment opens appeal advice and client authorization', () {
    final DemoGameRepository repository =
        _buildMatterWithScheduledHearing(seed: 20260701);

    repository.applyAction('wait-until-hearing');
    repository.applyAction('attend-hearing');
    repository.applyAction('rest');

    expect(
      repository.snapshot.caseResultStatus,
      CaseResultStatus.lostAtFirstInstance,
    );
    expect(
      repository.snapshot.engagementStatus,
      EngagementStatus.awaitingClientInstructions,
    );

    repository.applyAction('inform-client-judgment');

    expect(repository.snapshot.stage, 'Appeal assessment');
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'prepare-appeal-advice',
      ),
      isTrue,
    );
    expect(
      repository.snapshot.deadlines.any(
        (DeadlineView item) =>
            item.id == 'appeal-deadline' && item.status == DeadlineStatus.open,
      ),
      isTrue,
    );

    repository.applyAction('prepare-appeal-advice');
    expect(repository.snapshot.stage, 'Awaiting appeal instructions');
    expect(
      repository.snapshot.inbox
          .singleWhere(
            (InboxItemView item) => item.id == 'appeal-client-instructions',
          )
          .status,
      InboxStatus.actionRequired,
    );

    repository.applyAction('seek-client-appeal-authorization');
    expect(repository.snapshot.stage, 'Appeal preparation');
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'file-appeal',
      ),
      isTrue,
    );
  });

  test('delegated junior review becomes ready and can be validated', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');
    repository.applyAction('delegate-review');
    repository.applyAction('request-documents');

    expect(
      repository.snapshot.juniorReviewStatus,
      JuniorReviewStatus.findingsReady,
    );
    expect(
      repository.snapshot.inbox
          .singleWhere((InboxItemView item) => item.id == 'junior-report')
          .status,
      InboxStatus.resolved,
    );
    expect(
      repository.snapshot.inbox
          .singleWhere(
            (InboxItemView item) => item.id == 'junior-findings-ready',
          )
          .status,
      InboxStatus.actionRequired,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'review-junior-findings',
      ),
      isTrue,
    );

    repository.applyAction('review-junior-findings');

    expect(
      repository.snapshot.juniorReviewStatus,
      JuniorReviewStatus.reviewed,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'review-junior-findings',
      ),
      isFalse,
    );
  });

  test('unvalidated junior review expires when the hearing opens', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');
    repository.applyAction('reply-cfo');
    repository.applyAction('delegate-review');
    repository.applyAction('request-documents');
    repository.applyAction('reject-settlement');
    repository.applyAction('commence-proceedings');
    repository.applyAction('prepare-statement-of-claim');
    repository.applyAction('prepare-evidence-bundle');
    repository.applyAction('wait-until-hearing');

    expect(
      repository.snapshot.juniorReviewStatus,
      JuniorReviewStatus.expired,
    );
    expect(
      repository.snapshot.actions.any(
        (GameActionView action) => action.id == 'review-junior-findings',
      ),
      isFalse,
    );
    expect(
      repository.snapshot.inbox.any(
        (InboxItemView item) =>
            item.id == 'junior-review-not-used-before-hearing',
      ),
      isTrue,
    );
    expect(
      repository.snapshot.inbox.where(
        (InboxItemView item) =>
            (item.id == 'junior-report' ||
                item.id == 'junior-findings-ready') &&
            item.status == InboxStatus.actionRequired,
      ),
      isEmpty,
    );
  });

  test('resolved matter has a terminal summary and no active work', () {
    final DemoGameRepository repository = _buildMatterWithScheduledHearing();
    repository.applyAction('wait-until-hearing');
    repository.applyAction('attend-hearing');
    repository.applyAction('rest');
    repository.applyAction('inform-client-judgment');
    repository.applyAction('rest');
    repository.applyAction('prepare-cassation-response');
    repository.applyAction('await-cassation-decision');

    expect(repository.snapshot.stage, 'Resolved');
    expect(repository.snapshot.outcomeSummary, isNotNull);
    expect(repository.snapshot.actions, isEmpty);
    expect(repository.snapshot.unhandledRequiredMessages, 0);
    expect(
      repository.snapshot.inbox.any(
        (InboxItemView item) => item.id == 'matter-closed',
      ),
      isTrue,
    );
    expect(
      repository.snapshot.deadlines.any(
        (DeadlineView item) =>
            item.status == DeadlineStatus.open ||
            item.status == DeadlineStatus.scheduled,
      ),
      isFalse,
    );
  });

  testWidgets('inbox displays newer events above older messages', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');
    repository.applyAction('request-documents');

    await tester.pumpWidget(JurisApp(repository: repository));
    await tester.pumpAndSettle();

    final Finder newer = find.byKey(
      const ValueKey<String>('inbox-item-settlement-offer'),
    );
    final Finder older = find.byKey(
      const ValueKey<String>('inbox-item-cfo-pressure'),
    );

    expect(newer, findsOneWidget);
    expect(older, findsOneWidget);
    expect(
      tester.getTopLeft(newer).dy,
      lessThan(tester.getTopLeft(older).dy),
    );
  });

  testWidgets('case closed card opens the final case report', (
    WidgetTester tester,
  ) async {
    final DemoGameRepository repository = _buildMatterWithScheduledHearing();
    repository.applyAction('wait-until-hearing');
    repository.applyAction('attend-hearing');
    repository.applyAction('rest');
    repository.applyAction('inform-client-judgment');
    repository.applyAction('rest');
    repository.applyAction('prepare-cassation-response');
    repository.applyAction('await-cassation-decision');

    await tester.pumpWidget(JurisApp(repository: repository));
    await tester.pumpAndSettle();

    final Finder closedCard = find.byKey(
      const ValueKey<String>('case-closed-card'),
    );
    expect(closedCard, findsOneWidget);

    await tester.tap(closedCard);
    await tester.pumpAndSettle();

    expect(find.text('Case report'), findsOneWidget);
    expect(find.text('Financial result'), findsOneWidget);
    expect(find.text('Performance'), findsOneWidget);
  });
}

DemoGameRepository _buildMatterWithScheduledHearing({int seed = 20260724}) {
  final DemoGameRepository repository = DemoGameRepository(seed: seed);
  repository.applyAction('run-conflict-check');
  repository.applyAction('prepare-partner-brief');
  repository.applyAction('issue-preservation-notice');
  repository.applyAction('request-documents');
  repository.applyAction('reject-settlement');
  repository.applyAction('commence-proceedings');
  repository.applyAction('prepare-statement-of-claim');
  repository.applyAction('prepare-evidence-bundle');
  return repository;
}
