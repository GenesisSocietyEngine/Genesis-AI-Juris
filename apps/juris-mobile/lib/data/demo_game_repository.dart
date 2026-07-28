import 'package:flutter/foundation.dart';

import '../models/game_snapshot.dart';

/// Local deterministic demonstration used by the v0.5.0 UI shell.
///
/// This repository intentionally implements only a small intake/investigation
/// slice. It exists to make every screen interactive before native Rust FFI is
/// introduced. It must not become a second authoritative simulation engine.
/// v0.5.1 will replace its transition code with calls to the Rust snapshot API.
class DemoGameRepository extends ChangeNotifier {
  DemoGameRepository({required this.seed}) : _snapshot = _initial(seed);

  /// Standard foreground clock contract used by the Flutter shell.
  ///
  /// The shell always submits explicit one-minute commands. At standard speed
  /// it submits one command every four real seconds: 15 game minutes per real
  /// minute. The optional 2× and 4× controls shorten only the timer interval.
  static const int standardClockGameMinutesPerRealMinute = 15;

  static const int _workdayEndMinute = 18 * 60;
  static const int _hearingAttendanceGraceMinutes = 6 * 60;
  static const int _firstClientWarningMinutes = 180;
  static const int _finalClientWarningMinutes = 300;
  static const int _clientTerminationMinutes = 480;
  static const int _restInactivityMinutes = 120;

  final int seed;
  GameSnapshot _snapshot;

  GameSnapshot get snapshot => _snapshot;

  bool get isTerminal =>
      _snapshot.stage == 'Resolved' || _snapshot.outcomeSummary != null;

  /// Resets the mobile playtest to the same seed and opening state.
  void reset() {
    _snapshot = _initial(seed);
    notifyListeners();
  }

  /// Marks an informational message as read when the player opens it.
  ///
  /// Action-required messages deliberately remain action-required until their
  /// mapped gameplay response is completed. This keeps visual attention state
  /// aligned with actual unresolved work instead of merely tracking views.
  void markInboxItemRead(String itemId) {
    final bool canMarkRead = _snapshot.inbox.any(
      (InboxItemView item) =>
          item.id == itemId && item.status == InboxStatus.unread,
    );
    if (!canMarkRead) {
      return;
    }

    _snapshot = _snapshot.copyWith(
      inbox: _snapshot.inbox
          .map(
            (InboxItemView item) =>
                item.id == itemId && item.status == InboxStatus.unread
                    ? item.copyWith(status: InboxStatus.read)
                    : item,
          )
          .toList(growable: false),
    );
    notifyListeners();
  }

  /// Advances the foreground workday clock without executing a player action.
  ///
  /// Flutter calls this with explicit one-minute commands at the selected
  /// 1×, 2×, or 4× timer interval. The method is deterministic: wall-clock
  /// time never enters the repository, and every
  /// deadline, warning, and loss branch is derived from the supplied minute
  /// count plus the current snapshot.
  void advanceTimeByMinutes(int minutes) {
    if (minutes <= 0 || isTerminal) {
      return;
    }

    int remaining = minutes;
    while (remaining > 0 && !isTerminal) {
      final int currentMinute = _minuteOfDay(_snapshot.timeLabel);

      // The demo models a workday clock. Reaching 18:00 advances to the next
      // workday through the same event pipeline as the explicit Rest action.
      if (currentMinute >= _workdayEndMinute) {
        _rest();
        return;
      }

      final int availableToday = _workdayEndMinute - currentMinute;
      final int step = remaining < availableToday ? remaining : availableToday;
      _advanceWithinWorkday(step);
      remaining -= step;

      if (remaining > 0 &&
          _minuteOfDay(_snapshot.timeLabel) >= _workdayEndMinute &&
          !isTerminal) {
        _rest();
        return;
      }
    }

    notifyListeners();
  }

  void _advanceWithinWorkday(int minutes) {
    if (minutes <= 0 || isTerminal) {
      return;
    }

    final int day = _currentDayNumber();
    final int targetMinute = _minuteOfDay(_snapshot.timeLabel) + minutes;
    final List<DeadlineView> previousDeadlines = _snapshot.deadlines;
    final List<DeadlineView> updatedDeadlines = _markOverdueDeadlines(
      previousDeadlines,
      day: day,
      minuteOfDay: targetMinute,
    );
    final Set<String> newlyMissed = _newlyMissedDeadlineIds(
      before: previousDeadlines,
      after: updatedDeadlines,
    );

    int procedure = _snapshot.procedure;
    int evidenceScore = _snapshot.evidenceScore;
    int ethics = _snapshot.ethics;
    int clientTrust = _snapshot.clientTrust;
    String stage = _snapshot.stage;
    List<InboxItemView> inbox = <InboxItemView>[..._snapshot.inbox];
    List<GameActionView> actions = <GameActionView>[..._snapshot.actions];

    if (newlyMissed.contains('partner-brief')) {
      procedure -= 6;
      clientTrust -= 5;
      inbox.add(
        InboxItemView(
          id: 'partner-brief-missed-live-$day-$targetMinute',
          sender: 'Matter partner',
          subject: 'Partner risk brief missed',
          body:
              'The internal risk assessment was not delivered on time. Partner oversight, settlement planning, and confidence in the matter team have deteriorated.',
          receivedAt: 'Day $day · ${_formatMinuteOfDay(targetMinute)}',
          status: InboxStatus.unread,
        ),
      );
    }

    if (newlyMissed.contains('preservation')) {
      procedure -= 12;
      evidenceScore -= 10;
      ethics -= 6;
      clientTrust -= 10;
      inbox.add(
        InboxItemView(
          id: 'preservation-missed-live-$day-$targetMinute',
          sender: 'Matter risk system',
          subject: 'Evidence-preservation deadline missed',
          body:
              'No legal hold was issued before the deadline. Relevant records may be incomplete, the evidentiary ceiling is reduced, and an adverse inference risk now applies.',
          receivedAt: 'Day $day · ${_formatMinuteOfDay(targetMinute)}',
          status: InboxStatus.unread,
        ),
      );
    }

    actions = _withDeadlineActions(
      actions.where((GameActionView action) {
        if (newlyMissed.contains('partner-brief') &&
            action.id == 'prepare-partner-brief') {
          return false;
        }
        if (newlyMissed.contains('preservation') &&
            action.id == 'issue-preservation-notice') {
          return false;
        }
        if (newlyMissed.contains('statement-of-claim') &&
            action.id == 'prepare-statement-of-claim') {
          return false;
        }
        return true;
      }).toList(growable: false),
      updatedDeadlines,
    );

    final bool settlementExpired = _isSettlementExpired(
      day: day,
      minuteOfDay: targetMinute,
    );
    if (settlementExpired && _snapshot.settlementOffer != null) {
      inbox = inbox
          .map(
            (InboxItemView item) => item.id == 'settlement-offer'
                ? item.copyWith(status: InboxStatus.resolved)
                : item,
          )
          .toList(growable: true)
        ..add(
          InboxItemView(
            id: 'settlement-expired-live-$day-$targetMinute',
            sender: 'Opposing counsel',
            subject: 'Settlement offer expired',
            body:
                'The without-prejudice offer expired without acceptance. Formal proceedings remain available, but the commercial exit has been lost.',
            receivedAt: 'Day $day · ${_formatMinuteOfDay(targetMinute)}',
            status: InboxStatus.unread,
          ),
        );
      actions = actions
          .where(
            (GameActionView action) =>
                action.id != 'future-settle' &&
                action.id != 'reject-settlement',
          )
          .toList(growable: false);
      if (stage == 'Pre-litigation') {
        actions = _ensureAction(actions, _commenceProceedingsAction());
      }
    }

    final (
      List<InboxItemView>,
      List<GameActionView>,
      JuniorReviewStatus
    ) juniorCompletion = _completeJuniorReviewIfDue(
      inbox: inbox,
      actions: actions,
      status: _snapshot.juniorReviewStatus,
      day: day,
      minuteOfDay: targetMinute,
    );
    inbox = juniorCompletion.$1;
    actions = juniorCompletion.$2;

    final DeadlineView? hearing = _activeScheduledHearingFrom(updatedDeadlines);
    if (hearing != null && stage == 'Hearing preparation') {
      final (int hearingDay, int hearingMinute) = _calendarMoment(hearing);
      final bool attendanceWindowOpen = day == hearingDay &&
          targetMinute >= hearingMinute &&
          targetMinute <= hearingMinute + _hearingAttendanceGraceMinutes;
      if (attendanceWindowOpen) {
        actions = actions
            .where(
              (GameActionView action) =>
                  action.id != 'wait-until-hearing' &&
                  action.id != 'request-hearing-reschedule',
            )
            .toList(growable: false);
        actions = _ensureAction(actions, _attendHearingAction());
        if (!inbox.any(
          (InboxItemView item) =>
              item.id == 'hearing-window-open-${hearing.id}',
        )) {
          inbox.add(
            InboxItemView(
              id: 'hearing-window-open-${hearing.id}',
              sender: 'Enterprise Court Registry',
              subject: 'Enterprise court hearing now in session',
              body:
                  'The attendance window is open. Attend before the six-hour grace window closes or the court will proceed on an adverse record.',
              receivedAt: 'Day $day · ${_formatMinuteOfDay(targetMinute)}',
              status: InboxStatus.actionRequired,
            ),
          );
        }
      }
    }

    String? missedHearingId;
    for (final String id in newlyMissed) {
      if (id.startsWith('enterprise-court-hearing-')) {
        missedHearingId = id;
        break;
      }
    }
    if (missedHearingId != null) {
      procedure -= 30;
      clientTrust -= 25;
      ethics -= 5;
      stage = 'Judgment pending';
      actions = const <GameActionView>[
        GameActionView(
          id: 'rest',
          title: 'Rest until next workday',
          description:
              'Advance to the court decision after the mandatory hearing was missed.',
          timeLabel: 'Until 08:00',
          costEur: 0,
          tone: ActionTone.danger,
        ),
      ];
      inbox = inbox
          .map(
            (InboxItemView item) => item.id.startsWith('hearing-notice-') ||
                    item.id.startsWith('hearing-window-open-')
                ? item.copyWith(status: InboxStatus.resolved)
                : item,
          )
          .toList(growable: true)
        ..add(
          InboxItemView(
            id: 'hearing-missed-$missedHearingId',
            sender: 'Enterprise Court Registry',
            subject: 'Mandatory hearing missed',
            body:
                'No attendance was recorded within the mandatory window. The claim is now exposed to procedural default and cannot be rescued by the deterministic court variance.',
            receivedAt: 'Day $day · ${_formatMinuteOfDay(targetMinute)}',
            status: InboxStatus.unread,
          ),
        );
    }

    _snapshot = _snapshot.copyWith(
      timeLabel: _formatMinuteOfDay(targetMinute),
      stage: stage,
      procedure: procedure.clamp(0, 100).toInt(),
      evidenceScore: evidenceScore.clamp(0, 100).toInt(),
      ethics: ethics.clamp(0, 100).toInt(),
      clientTrust: clientTrust.clamp(0, 100).toInt(),
      inactivityMinutes: _snapshot.inactivityMinutes + minutes,
      deadlines: updatedDeadlines,
      inbox: inbox,
      actions: actions,
      juniorReviewStatus: juniorCompletion.$3,
      clearSettlementOffer: settlementExpired,
    );

    if (newlyMissed.contains('statement-of-claim')) {
      _resolveProceduralDefault(
        detail:
            'The statement of claim was not filed before the mandatory deadline. The court dismissed the matter without reaching the merits.',
      );
      return;
    }

    if (newlyMissed.contains('appeal-deadline')) {
      _closeCurrentLoss(
        subject: 'Appeal deadline expired',
        detail:
            'No authorized appeal was filed before the deadline. The first-instance loss became final.',
      );
      return;
    }

    if (newlyMissed.contains('cassation-deadline')) {
      _closeCurrentLoss(
        subject: 'Cassation deadline expired',
        detail:
            'No authorized cassation appeal was filed before the deadline. The appellate loss became final.',
      );
      return;
    }

    _applyInactivityConsequences();
  }

  bool _isInactivityRiskStage(String stage) {
    return stage == 'Intake' ||
        stage == 'Investigation' ||
        stage == 'Pre-litigation' ||
        stage == 'Pleadings' ||
        stage == 'Evidence';
  }

  void _applyInactivityConsequences() {
    if (isTerminal || !_isInactivityRiskStage(_snapshot.stage)) {
      return;
    }

    int warningLevel = _snapshot.clientWarningLevel;
    int clientTrust = _snapshot.clientTrust;
    int ethics = _snapshot.ethics;
    final List<InboxItemView> inbox = <InboxItemView>[..._snapshot.inbox];

    if (_snapshot.inactivityMinutes >= _firstClientWarningMinutes &&
        warningLevel < 1) {
      warningLevel = 1;
      clientTrust -= 8;
      ethics -= 2;
      inbox.add(
        InboxItemView(
          id: 'client-inactivity-warning-${_snapshot.dayLabel}-${_snapshot.timeLabel}',
          sender: 'Client CEO',
          subject: 'Urgent engagement warning',
          body:
              'The client has seen no substantive progress for three simulated hours. Immediate action and a credible plan are required to preserve the engagement.',
          receivedAt: '${_snapshot.dayLabel} · ${_snapshot.timeLabel}',
          status: InboxStatus.unread,
        ),
      );
    }

    if (_snapshot.inactivityMinutes >= _finalClientWarningMinutes &&
        warningLevel < 2) {
      warningLevel = 2;
      clientTrust -= 12;
      ethics -= 4;
      inbox.add(
        InboxItemView(
          id: 'client-final-warning-${_snapshot.dayLabel}-${_snapshot.timeLabel}',
          sender: 'Client CEO',
          subject: 'Final warning before termination',
          body:
              'The client considers the continuing inactivity a material service failure. The engagement will be terminated unless substantive work resumes immediately.',
          receivedAt: '${_snapshot.dayLabel} · ${_snapshot.timeLabel}',
          status: InboxStatus.unread,
        ),
      );
    }

    _snapshot = _snapshot.copyWith(
      clientWarningLevel: warningLevel,
      clientTrust: clientTrust.clamp(0, 100).toInt(),
      ethics: ethics.clamp(0, 100).toInt(),
      inbox: inbox,
    );

    if (_snapshot.inactivityMinutes >= _clientTerminationMinutes) {
      _terminateEngagement();
    }
  }

  void _terminateEngagement() {
    if (isTerminal) {
      return;
    }

    final String closedAt = '${_snapshot.dayLabel} · ${_snapshot.timeLabel}';
    final ExpertReviewStatus expertStatus =
        _snapshot.expertReviewStatus == ExpertReviewStatus.pending ||
                _snapshot.expertReviewStatus == ExpertReviewStatus.reportReady
            ? ExpertReviewStatus.expired
            : _snapshot.expertReviewStatus;
    final JuniorReviewStatus juniorStatus =
        _snapshot.juniorReviewStatus == JuniorReviewStatus.inProgress ||
                _snapshot.juniorReviewStatus == JuniorReviewStatus.findingsReady
            ? JuniorReviewStatus.expired
            : _snapshot.juniorReviewStatus;
    final List<DeadlineView> deadlines =
        _finalizeDeadlinesForClosure(_snapshot.deadlines);
    final List<InboxItemView> inbox = _finalizeInboxForClosure(
      inbox: <InboxItemView>[
        ..._snapshot.inbox,
        InboxItemView(
          id: 'client-terminated-engagement',
          sender: 'Client CEO',
          subject: 'Engagement terminated for inactivity',
          body:
              'The client terminated the mandate after repeated warnings and sustained lack of substantive progress. The firm must write off part of the fees and record the service failure internally.',
          receivedAt: closedAt,
          status: InboxStatus.unread,
        ),
      ],
      closedAt: closedAt,
    );
    final List<String> missed = <String>[
      'Client engagement lost through inactivity',
      ...deadlines
          .where((DeadlineView item) => item.status == DeadlineStatus.missed)
          .map((DeadlineView item) => item.title),
    ];

    _snapshot = _snapshot.copyWith(
      stage: 'Resolved',
      caseResultStatus: CaseResultStatus.withdrawn,
      engagementStatus: EngagementStatus.terminatedByClient,
      caseStrength: (_snapshot.caseStrength - 15).clamp(0, 100).toInt(),
      procedure: (_snapshot.procedure - 15).clamp(0, 100).toInt(),
      ethics: (_snapshot.ethics - 15).clamp(0, 100).toInt(),
      clientTrust: 0,
      expertReviewStatus: expertStatus,
      juniorReviewStatus: juniorStatus,
      deadlines: deadlines,
      inbox: inbox,
      actions: const <GameActionView>[],
      clearSettlementOffer: true,
      outcomeSummary: CaseOutcomeSummaryView(
        headline: 'Client terminated engagement',
        finalStatus: 'Mandate withdrawn for sustained inactivity',
        detail:
            'Repeated warnings were ignored and the client ended the engagement. No recovery was achieved; professional standing and client trust were materially reduced.',
        closedAt: closedAt,
        awardEur: 0,
        costsEur: 0,
        keySuccesses: const <String>[],
        missedOpportunities: List<String>.unmodifiable(missed),
      ),
    );
  }

  void _resolveProceduralDefault({required String detail}) {
    final String closedAt = '${_snapshot.dayLabel} · ${_snapshot.timeLabel}';
    final List<DeadlineView> deadlines =
        _finalizeDeadlinesForClosure(_snapshot.deadlines);
    final List<InboxItemView> inbox = _finalizeInboxForClosure(
      inbox: <InboxItemView>[
        ..._snapshot.inbox,
        InboxItemView(
          id: 'procedural-default-${_snapshot.dayLabel}-${_snapshot.timeLabel}',
          sender: 'Enterprise Court Registry',
          subject: 'Claim dismissed by procedural default',
          body: detail,
          receivedAt: closedAt,
          status: InboxStatus.unread,
        ),
      ],
      closedAt: closedAt,
    );

    _snapshot = _snapshot.copyWith(
      stage: 'Resolved',
      caseResultStatus: CaseResultStatus.lostAtFirstInstance,
      engagementStatus: EngagementStatus.completed,
      caseStrength: (_snapshot.caseStrength - 20).clamp(0, 100).toInt(),
      procedure: (_snapshot.procedure - 30).clamp(0, 100).toInt(),
      ethics: (_snapshot.ethics - 8).clamp(0, 100).toInt(),
      clientTrust: (_snapshot.clientTrust - 30).clamp(0, 100).toInt(),
      deadlines: deadlines,
      inbox: inbox,
      actions: const <GameActionView>[],
      clearSettlementOffer: true,
      outcomeSummary: CaseOutcomeSummaryView(
        headline: 'Claim dismissed by procedural default',
        finalStatus: 'Mandatory filing or attendance requirement missed',
        detail: detail,
        closedAt: closedAt,
        awardEur: 0,
        costsEur: 12000,
        keySuccesses: const <String>[],
        missedOpportunities: const <String>[
          'Mandatory procedural requirement was not completed',
          'The merits were never determined',
        ],
      ),
    );
  }

  static bool _isPassiveAction(String actionId) {
    return actionId == 'rest' ||
        actionId == 'wait-until-hearing' ||
        actionId == 'await-appeal-decision' ||
        actionId == 'await-cassation-decision';
  }

  /// Applies one UI action from the deterministic mock script.
  ///
  /// Unknown action IDs are rejected defensively. This mirrors the Rust
  /// engine's rule that the client may submit only actions present in the
  /// current snapshot.
  ActionExecutionResult applyAction(String actionId) {
    final bool available =
        _snapshot.actions.any((GameActionView action) => action.id == actionId);
    if (!available) {
      return const ActionExecutionResult(
        title: 'Action unavailable',
        message: 'The world changed before this action could be applied.',
        isRisky: true,
      );
    }

    if (!_isPassiveAction(actionId)) {
      _snapshot = _snapshot.copyWith(
        inactivityMinutes: 0,
        clientWarningLevel: 0,
      );
    }

    try {
      switch (actionId) {
        case 'run-conflict-check':
          _runConflictCheck();
          return const ActionExecutionResult(
            title: 'Conflict check complete',
            message:
                'No conflict was found. The matter can proceed to investigation.',
            isRisky: false,
          );
        case 'accept-immediately':
          _acceptImmediately();
          return const ActionExecutionResult(
            title: 'Matter accepted',
            message: 'You moved quickly, but skipped a professional safeguard.',
            isRisky: true,
          );
        case 'ask-ai-research':
          _askAiResearch();
          return const ActionExecutionResult(
            title: 'AI work product received',
            message:
                'The associate identified issues to verify before reliance.',
            isRisky: false,
          );
        case 'reply-cfo':
          _replyToCfo();
          return const ActionExecutionResult(
            title: 'CFO updated',
            message:
                'The board has a visible response and an evidence-first plan.',
            isRisky: false,
          );
        case 'request-documents':
          _requestDocuments();
          return const ActionExecutionResult(
            title: 'Document review completed',
            message:
                'New evidence improved the record but weakened the merits narrative.',
            isRisky: false,
          );
        case 'delegate-review':
          _delegateReview();
          return const ActionExecutionResult(
            title: 'Review delegated',
            message:
                'The junior will report asynchronously while you retain review responsibility.',
            isRisky: false,
          );
        case 'review-junior-findings':
          _reviewJuniorFindings();
          return const ActionExecutionResult(
            title: 'Junior findings validated',
            message:
                'The first-pass review was checked and incorporated into the matter record.',
            isRisky: false,
          );
        case 'prepare-partner-brief':
          _preparePartnerRiskBrief();
          return const ActionExecutionResult(
            title: 'Partner brief filed',
            message:
                'The partner received a documented risk, budget, and settlement assessment.',
            isRisky: false,
          );
        case 'issue-preservation-notice':
          _issuePreservationNotice();
          return const ActionExecutionResult(
            title: 'Preservation notice issued',
            message:
                'Relevant mailboxes, tickets, and acceptance records are now preserved.',
            isRisky: false,
          );
        case 'request-budget':
          _requestBudgetApproval();
          return const ActionExecutionResult(
            title: 'Budget authority increased',
            message:
                'The client approved another EUR 25,000 with a small trust cost.',
            isRisky: false,
          );
        case 'future-expert':
          _commissionIndependentExpert();
          return const ActionExecutionResult(
            title: 'Independent expert commissioned',
            message:
                'The ERP expert started an asynchronous technical assessment.',
            isRisky: false,
          );
        case 'future-damages':
          _askAiForDamagesModel();
          return const ActionExecutionResult(
            title: 'AI damages model completed',
            message:
                'The model is now tied to the current known-facts revision.',
            isRisky: false,
          );
        case 'review-expert-report':
          _reviewExpertReport();
          return const ActionExecutionResult(
            title: 'Expert report reviewed',
            message:
                'The technical findings entered the evidentiary record and changed the known facts.',
            isRisky: false,
          );
        case 'future-settle':
          _acceptSettlement();
          return const ActionExecutionResult(
            title: 'Settlement accepted',
            message:
                'The matter resolved for EUR 64,500 without admission of liability.',
            isRisky: false,
          );
        case 'reject-settlement':
          _rejectSettlement();
          return const ActionExecutionResult(
            title: 'Settlement rejected',
            message:
                'The offer was declined. The matter remains open for further preparation.',
            isRisky: false,
          );
        case 'commence-proceedings':
          _commenceProceedings();
          return const ActionExecutionResult(
            title: 'Proceedings commenced',
            message:
                'The matter has moved from pre-litigation into formal pleadings.',
            isRisky: false,
          );
        case 'prepare-statement-of-claim':
          _prepareStatementOfClaim();
          return const ActionExecutionResult(
            title: 'Statement of claim filed',
            message:
                'The pleaded case has been filed and the matter advances to evidence.',
            isRisky: false,
          );
        case 'prepare-evidence-bundle':
          _prepareEvidenceBundle();
          return const ActionExecutionResult(
            title: 'Evidence bundle filed',
            message:
                'The evidentiary record is ready and the court has scheduled a formal hearing.',
            isRisky: false,
          );
        case 'request-hearing-reschedule':
          return _requestHearingReschedule();
        case 'wait-until-hearing':
          if (!_waitUntilHearing()) {
            return const ActionExecutionResult(
              title: 'Action unavailable',
              message:
                  'No scheduled hearing can be reached from the current calendar state.',
              isRisky: true,
            );
          }
          return const ActionExecutionResult(
            title: 'Hearing time reached',
            message:
                'The simulation clock advanced to the formal hearing attendance window.',
            isRisky: false,
          );
        case 'attend-hearing':
          if (!_isHearingAttendanceWindowOpen()) {
            return const ActionExecutionResult(
              title: 'Action unavailable',
              message:
                  'The hearing has not started, has been moved, or is no longer attendable.',
              isRisky: true,
            );
          }
          _attendHearing();
          return const ActionExecutionResult(
            title: 'Hearing concluded',
            message:
                'The court has taken the matter under advisement. Judgment is expected next workday.',
            isRisky: false,
          );
        case 'prepare-hearing-strategy':
          _prepareHearingStrategy();
          return const ActionExecutionResult(
            title: 'Hearing strategy completed',
            message:
                'The oral theory, likely judicial questions, and fallback positions are now documented.',
            isRisky: false,
          );
        case 'prepare-key-witness':
          _prepareKeyWitness();
          return const ActionExecutionResult(
            title: 'Witness preparation completed',
            message:
                'The client witness understands the record, likely challenges, and limits of proper preparation.',
            isRisky: false,
          );
        case 'reconcile-damages-schedule':
          _reconcileDamagesSchedule();
          return const ActionExecutionResult(
            title: 'Damages schedule reconciled',
            message:
                'The pleaded quantum now reconciles with invoices, mitigation, and the expert findings.',
            isRisky: false,
          );
        case 'inform-client-judgment':
          _informClientOfJudgment();
          return const ActionExecutionResult(
            title: 'Client informed',
            message:
                'The client received an explainable judgment briefing and a post-judgment risk plan.',
            isRisky: false,
          );
        case 'assess-claimant-review-options':
        case 'prepare-appeal-advice':
          _prepareAppealAdvice();
          return const ActionExecutionResult(
            title: 'Appeal advice prepared',
            message:
                'The client received a reasoned assessment of appeal grounds, cost, timing, and prospects.',
            isRisky: false,
          );
        case 'seek-client-appeal-authorization':
          _seekClientAppealAuthorization();
          return const ActionExecutionResult(
            title: 'Appeal instructions requested',
            message:
                'The client decision now depends on the assessed grounds, trust, cost, and prospects.',
            isRisky: false,
          );
        case 'file-appeal':
          _fileAppeal();
          return const ActionExecutionResult(
            title: 'Appeal filed',
            message:
                'The appellate challenge was filed within the deterministic review window.',
            isRisky: false,
          );
        case 'await-appeal-decision':
          _rest();
          return const ActionExecutionResult(
            title: 'Appeal decision received',
            message:
                'The simulation advanced to the appellate decision update.',
            isRisky: false,
          );
        case 'accept-judgment-and-close':
          _closeCurrentLoss(
            subject: 'First-instance judgment accepted',
            detail:
                'The client accepted the first-instance judgment and instructed the firm not to pursue an appeal.',
          );
          return const ActionExecutionResult(
            title: 'Judgment accepted',
            message: 'The matter closed as lost at first instance.',
            isRisky: false,
          );
        case 'assess-cassation-grounds':
          _assessCassationGrounds();
          return const ActionExecutionResult(
            title: 'Cassation grounds assessed',
            message:
                'The team separated legal and procedural grounds from disagreement with the factual record.',
            isRisky: false,
          );
        case 'seek-client-cassation-authorization':
          _seekClientCassationAuthorization();
          return const ActionExecutionResult(
            title: 'Cassation instructions requested',
            message:
                'The client decision now depends on viable legal grounds, cost, trust, and timing.',
            isRisky: false,
          );
        case 'file-cassation-appeal':
          _fileCassationAppeal();
          return const ActionExecutionResult(
            title: 'Cassation appeal filed',
            message:
                'A claimant-side cassation challenge was filed on the assessed legal grounds.',
            isRisky: false,
          );
        case 'accept-appellate-judgment':
          _closeCurrentLoss(
            subject: 'Appellate judgment accepted',
            detail:
                'The client accepted the appellate loss and instructed the firm not to pursue cassation.',
          );
          return const ActionExecutionResult(
            title: 'Appellate judgment accepted',
            message: 'The matter closed as lost on appeal.',
            isRisky: false,
          );
        case 'prepare-cassation-response':
          _prepareCassationResponse();
          return const ActionExecutionResult(
            title: 'Cassation response filed',
            message:
                'The response addresses the legal grounds raised by the counterparty and preserves the judgment.',
            isRisky: false,
          );
        case 'await-cassation-decision':
          _rest();
          return const ActionExecutionResult(
            title: 'Cassation update received',
            message:
                'The simulation advanced to the Court of Cassation decision update.',
            isRisky: false,
          );
        case 'rest':
          _rest();
          return const ActionExecutionResult(
            title: 'New workday',
            message:
                'Acute fatigue recovered while cumulative strain declined slowly.',
            isRisky: false,
          );
        default:
          return const ActionExecutionResult(
            title: 'Not implemented in v0.5.0',
            message:
                'This action will be executed by the Rust engine in v0.5.1.',
            isRisky: false,
          );
      }
    } finally {
      _refreshJuniorReviewAtCurrentClock();
    }
  }

  void _runConflictCheck() {
    _snapshot = _snapshot.copyWith(
      timeLabel: '09:00',
      stage: 'Investigation',
      spendEur: 350,
      billableMinutes: 60,
      ethics: 72,
      fatigue: 2,
      inbox: <InboxItemView>[
        _snapshot.inbox.first.copyWith(status: InboxStatus.resolved),
        const InboxItemView(
          id: 'cfo-pressure',
          sender: 'Client CFO',
          subject: 'Board expects visible action',
          body: 'We need a response today. The board is losing patience.',
          receivedAt: 'Day 1 · 09:05',
          status: InboxStatus.actionRequired,
        ),
      ],
      deadlines: _openedDeadlines(),
      actions: _investigationActions(
        includeAiResearch:
            _snapshot.aiLegalResearchRevision < _snapshot.knownFactsRevision,
        includePartnerBrief: true,
        includePreservationNotice: true,
      ),
    );
    notifyListeners();
  }

  void _acceptImmediately() {
    _snapshot = _snapshot.copyWith(
      timeLabel: '08:15',
      stage: 'Investigation',
      procedure: 49,
      ethics: 66,
      clientTrust: 55,
      fatigue: 1,
      inbox: <InboxItemView>[
        _snapshot.inbox.first.copyWith(status: InboxStatus.resolved),
      ],
      deadlines: _openedDeadlines(),
      actions: _investigationActions(
        includeAiResearch:
            _snapshot.aiLegalResearchRevision < _snapshot.knownFactsRevision,
        includePartnerBrief: true,
        includePreservationNotice: true,
      ),
    );
    notifyListeners();
  }

  void _askAiResearch() {
    _snapshot = _snapshot.copyWith(
      timeLabel: '09:30',
      spendEur: _snapshot.spendEur + 750,
      billableMinutes: _snapshot.billableMinutes + 90,
      fatigue: _snapshot.fatigue + 2,
      aiRequestsUsed: _snapshot.aiRequestsUsed + 1,
      aiLegalResearchRevision: _snapshot.knownFactsRevision,
      procedure: _snapshot.procedure + 2,
      latestAiNote:
          'Issues to verify: scope variation, acceptance wording, limitation of liability, causation, and recoverable implementation losses. Confidence: medium. Confirm Belgian authorities before reliance.',
      actions: _snapshot.actions
          .where((GameActionView action) => action.id != 'ask-ai-research')
          .toList(growable: false),
    );
    notifyListeners();
  }

  void _replyToCfo() {
    _snapshot = _snapshot.copyWith(
      timeLabel: '09:30',
      billableMinutes: _snapshot.billableMinutes + 30,
      fatigue: _snapshot.fatigue + 1,
      clientTrust: _snapshot.clientTrust + 3,
      inbox: _snapshot.inbox
          .map(
            (InboxItemView item) => item.id == 'cfo-pressure'
                ? item.copyWith(status: InboxStatus.resolved)
                : item,
          )
          .toList(growable: false),
      actions: _snapshot.actions
          .where((GameActionView action) => action.id != 'reply-cfo')
          .toList(growable: false),
    );
    notifyListeners();
  }

  void _requestDocuments() {
    final int revisedKnownFacts = _snapshot.knownFactsRevision + 1;
    final List<DeadlineView> updatedDeadlines = _markOverdueDeadlines(
      _snapshot.deadlines,
      day: _currentDayNumber(),
      minuteOfDay: (17 * 60) + 30,
    );
    final bool partnerBriefNewlyMissed = _deadlineBecameMissed(
      before: _snapshot.deadlines,
      after: updatedDeadlines,
      deadlineId: 'partner-brief',
    );

    List<InboxItemView> updatedInbox = <InboxItemView>[
      ..._snapshot.inbox,
      if (partnerBriefNewlyMissed)
        const InboxItemView(
          id: 'partner-brief-missed',
          sender: 'Matter partner',
          subject: 'Partner risk brief overdue',
          body:
              'The 15:00 risk brief was not delivered before the document review consumed the remaining workday.',
          receivedAt: 'Day 1 · 17:30',
          status: InboxStatus.unread,
        ),
      const InboxItemView(
        id: 'settlement-offer',
        sender: 'Opposing counsel',
        subject: 'Without-prejudice settlement offer',
        body:
            'EUR 64,500 without admission of liability. Offer expires tomorrow.',
        receivedAt: 'Day 1 · 17:30',
        status: InboxStatus.actionRequired,
      ),
    ];

    List<GameActionView> preLitigationActions = _withDeadlineActions(
      _preLitigationActions(
        includeExpert: !_snapshot.independentExpertCommissioned,
        includeAiDamages: _snapshot.aiDamagesModelRevision < revisedKnownFacts,
      ),
      updatedDeadlines,
    );

    final (
      List<InboxItemView>,
      List<GameActionView>,
      JuniorReviewStatus
    ) juniorCompletion = _completeJuniorReviewIfDue(
      inbox: updatedInbox,
      actions: preLitigationActions,
      status: _snapshot.juniorReviewStatus,
      day: _currentDayNumber(),
      minuteOfDay: (17 * 60) + 30,
    );
    updatedInbox = juniorCompletion.$1;
    preLitigationActions = juniorCompletion.$2;

    _snapshot = _snapshot.copyWith(
      timeLabel: '17:30',
      stage: 'Pre-litigation',
      spendEur: _snapshot.spendEur + 2000,
      billableMinutes: _snapshot.billableMinutes + 480,
      fatigue: _snapshot.fatigue + 9,
      cumulativeStrain: _snapshot.cumulativeStrain + 3,
      merits: 49,
      evidenceScore: 44,
      procedure: _snapshot.procedure - (partnerBriefNewlyMissed ? 6 : 0),
      clientTrust: _snapshot.clientTrust - (partnerBriefNewlyMissed ? 5 : 0),
      caseStrength: 48,
      knownFactsRevision: revisedKnownFacts,
      juniorReviewStatus: juniorCompletion.$3,
      deadlines: updatedDeadlines,
      evidence: const <EvidenceView>[
        EvidenceView(
          id: 'contract',
          title: 'Signed implementation agreement',
          detail: 'Scope, milestones, acceptance, and liability framework.',
          reliability: 90,
          isAdverse: false,
        ),
        EvidenceView(
          id: 'changes',
          title: 'Informal change requests',
          detail: 'Supports the supplier on scope drift and causation.',
          reliability: 70,
          isAdverse: true,
        ),
        EvidenceView(
          id: 'emails',
          title: 'Project correspondence',
          detail: 'Shows unresolved defects and inconsistent escalation.',
          reliability: 80,
          isAdverse: false,
        ),
        EvidenceView(
          id: 'acceptance',
          title: 'Conditional delivery acceptance',
          detail: 'May limit the client narrative if read without context.',
          reliability: 75,
          isAdverse: true,
        ),
      ],
      settlementOffer: const SettlementOfferView(
        amountEur: 64500,
        expiresAt: 'Day 2 · 17:30',
        revision: 1,
      ),
      inbox: updatedInbox,
      actions: preLitigationActions,
    );
    notifyListeners();
  }

  void _delegateReview() {
    _snapshot = _snapshot.copyWith(
      timeLabel: '10:00',
      juniorReviewStatus: JuniorReviewStatus.inProgress,
      juniorReviewDueDay: _currentDayNumber(),
      juniorReviewDueMinute: (13 * 60) + 30,
      spendEur: _snapshot.spendEur + 1800,
      billableMinutes: _snapshot.billableMinutes + 60,
      fatigue: _snapshot.fatigue + 1,
      inbox: <InboxItemView>[
        ..._snapshot.inbox,
        const InboxItemView(
          id: 'junior-report',
          sender: 'Junior associate',
          subject: 'Document review in progress',
          body:
              'Initial findings are expected at 13:30 and require your validation.',
          receivedAt: 'Day 1 · 10:00',
          status: InboxStatus.unread,
        ),
      ],
      actions: _snapshot.actions
          .where((GameActionView action) => action.id != 'delegate-review')
          .toList(growable: false),
    );
    notifyListeners();
  }

  void _refreshJuniorReviewAtCurrentClock() {
    if (_snapshot.juniorReviewStatus != JuniorReviewStatus.inProgress) {
      return;
    }

    final (
      List<InboxItemView>,
      List<GameActionView>,
      JuniorReviewStatus
    ) completion = _completeJuniorReviewIfDue(
      inbox: _snapshot.inbox,
      actions: _snapshot.actions,
      status: _snapshot.juniorReviewStatus,
      day: _currentDayNumber(),
      minuteOfDay: _minuteOfDay(_snapshot.timeLabel),
    );
    if (completion.$3 == _snapshot.juniorReviewStatus) {
      return;
    }

    _snapshot = _snapshot.copyWith(
      inbox: completion.$1,
      actions: completion.$2,
      juniorReviewStatus: completion.$3,
    );
    notifyListeners();
  }

  void _reviewJuniorFindings() {
    if (_snapshot.juniorReviewStatus != JuniorReviewStatus.findingsReady) {
      return;
    }

    final String completionTime = _timeAfter(minutes: 90);
    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      juniorReviewStatus: JuniorReviewStatus.reviewed,
      billableMinutes: _snapshot.billableMinutes + 90,
      fatigue: (_snapshot.fatigue + 2).clamp(0, 100).toInt(),
      evidenceScore: (_snapshot.evidenceScore + 4).clamp(0, 100).toInt(),
      procedure: (_snapshot.procedure + 2).clamp(0, 100).toInt(),
      caseStrength: (_snapshot.caseStrength + 3).clamp(0, 100).toInt(),
      inbox: <InboxItemView>[
        ..._snapshot.inbox.map(
          (InboxItemView item) => item.id == 'junior-findings-ready'
              ? item.copyWith(status: InboxStatus.resolved)
              : item,
        ),
        InboxItemView(
          id: 'junior-findings-validated',
          sender: 'Junior associate',
          subject: 'Document review findings validated',
          body:
              'The first-pass findings were checked against the source record and incorporated into the matter analysis.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
      ],
      actions: _snapshot.actions
          .where(
            (GameActionView action) => action.id != 'review-junior-findings',
          )
          .toList(growable: false),
    );
    notifyListeners();
  }

  (List<InboxItemView>, List<GameActionView>, JuniorReviewStatus)
      _completeJuniorReviewIfDue({
    required List<InboxItemView> inbox,
    required List<GameActionView> actions,
    required JuniorReviewStatus status,
    required int day,
    required int minuteOfDay,
  }) {
    if (status != JuniorReviewStatus.inProgress ||
        !_hasReachedMoment(
          day: day,
          minuteOfDay: minuteOfDay,
          targetDay: _snapshot.juniorReviewDueDay,
          targetMinute: _snapshot.juniorReviewDueMinute,
        )) {
      return (inbox, actions, status);
    }

    final List<InboxItemView> updatedInbox = inbox
        .map(
          (InboxItemView item) => item.id == 'junior-report'
              ? item.copyWith(status: InboxStatus.resolved)
              : item,
        )
        .toList(growable: true);

    if (!updatedInbox.any(
      (InboxItemView item) => item.id == 'junior-findings-ready',
    )) {
      updatedInbox.add(
        InboxItemView(
          id: 'junior-findings-ready',
          sender: 'Junior associate',
          subject: 'Document review findings ready for validation',
          body:
              'The junior identified chronology gaps, acceptance-language risks, and correspondence requiring senior validation before use.',
          receivedAt: 'Day $day · ${_formatMinuteOfDay(minuteOfDay)}',
          status: InboxStatus.actionRequired,
        ),
      );
    }

    return (
      updatedInbox,
      _ensureAction(actions, _reviewJuniorFindingsAction()),
      JuniorReviewStatus.findingsReady,
    );
  }

  (List<InboxItemView>, List<GameActionView>, JuniorReviewStatus)
      _expireJuniorReviewForHearing({
    required List<InboxItemView> inbox,
    required List<GameActionView> actions,
    required JuniorReviewStatus status,
    required int day,
    required int minuteOfDay,
  }) {
    if (status != JuniorReviewStatus.inProgress &&
        status != JuniorReviewStatus.findingsReady) {
      return (inbox, actions, status);
    }

    final List<InboxItemView> updatedInbox = inbox
        .map(
          (InboxItemView item) =>
              item.id == 'junior-report' || item.id == 'junior-findings-ready'
                  ? item.copyWith(status: InboxStatus.resolved)
                  : item,
        )
        .toList(growable: true);

    if (!updatedInbox.any(
      (InboxItemView item) =>
          item.id == 'junior-review-not-used-before-hearing',
    )) {
      updatedInbox.add(
        InboxItemView(
          id: 'junior-review-not-used-before-hearing',
          sender: 'Matter risk system',
          subject: 'Junior review not used before hearing',
          body:
              'The delegated review was not validated before the hearing window opened. Its findings were not incorporated into the hearing record.',
          receivedAt: 'Day $day · ${_formatMinuteOfDay(minuteOfDay)}',
          status: InboxStatus.unread,
        ),
      );
    }

    return (
      updatedInbox,
      actions
          .where(
            (GameActionView action) => action.id != 'review-junior-findings',
          )
          .toList(growable: false),
      JuniorReviewStatus.expired,
    );
  }

  bool _hasReachedMoment({
    required int day,
    required int minuteOfDay,
    required int targetDay,
    required int targetMinute,
  }) {
    return day > targetDay || (day == targetDay && minuteOfDay >= targetMinute);
  }

  void _preparePartnerRiskBrief() {
    if (!_isDeadlineOpen('partner-brief')) {
      return;
    }

    final String completionTime = _timeAfter(minutes: 120);
    final int completionMinute = _minuteOfDay(completionTime);
    final int currentDay = _currentDayNumber();
    if (_isAfterDeadline(
      deadlineId: 'partner-brief',
      day: currentDay,
      minuteOfDay: completionMinute,
    )) {
      _markDeadlineMissed('partner-brief');
      return;
    }

    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      billableMinutes: _snapshot.billableMinutes + 120,
      fatigue: _snapshot.fatigue + 2,
      procedure: _snapshot.procedure + 4,
      leverage: _snapshot.leverage + 2,
      deadlines: _setDeadlineStatus('partner-brief', DeadlineStatus.done),
      actions: _snapshot.actions
          .where(
            (GameActionView action) => action.id != 'prepare-partner-brief',
          )
          .toList(growable: false),
    );
    notifyListeners();
  }

  void _issuePreservationNotice() {
    if (!_isDeadlineOpen('preservation')) {
      return;
    }

    final String completionTime = _timeAfter(minutes: 60);
    final int completionMinute = _minuteOfDay(completionTime);
    final int currentDay = _currentDayNumber();
    if (_isAfterDeadline(
      deadlineId: 'preservation',
      day: currentDay,
      minuteOfDay: completionMinute,
    )) {
      _markDeadlineMissed('preservation');
      return;
    }

    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      spendEur: _snapshot.spendEur + 250,
      billableMinutes: _snapshot.billableMinutes + 60,
      fatigue: _snapshot.fatigue + 1,
      evidenceScore: _snapshot.evidenceScore + 4,
      procedure: _snapshot.procedure + 6,
      ethics: _snapshot.ethics + 2,
      deadlines: _setDeadlineStatus('preservation', DeadlineStatus.done),
      inbox: <InboxItemView>[
        ..._snapshot.inbox,
        InboxItemView(
          id: 'preservation-confirmed',
          sender: 'Client IT director',
          subject: 'Evidence hold confirmed',
          body:
              'Project mailboxes, tickets, acceptance records, and escalation logs have been placed on legal hold.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
      ],
      actions: _snapshot.actions
          .where(
            (GameActionView action) => action.id != 'issue-preservation-notice',
          )
          .toList(growable: false),
    );
    notifyListeners();
  }

  void _commissionIndependentExpert() {
    // This state precondition protects the repository even if a stale UI tries
    // to submit an action that has already disappeared from the snapshot.
    if (_snapshot.independentExpertCommissioned) {
      return;
    }

    final String completionTime = _timeAfter(minutes: 60);
    final int dueDay = _currentDayNumber() + 2;

    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      spendEur: _snapshot.spendEur + 12000,
      billableMinutes: _snapshot.billableMinutes + 60,
      fatigue: _snapshot.fatigue + 1,
      expertReviewStatus: ExpertReviewStatus.pending,
      expertReportDueDay: dueDay,
      inbox: <InboxItemView>[
        ..._snapshot.inbox,
        InboxItemView(
          id: 'expert-assignment',
          sender: 'Independent ERP expert',
          subject: 'Technical assessment commissioned',
          body:
              'The expert started an asynchronous review. The technical report is expected on Day $dueDay at 08:00.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
      ],
      actions: _snapshot.actions
          .where((GameActionView action) => action.id != 'future-expert')
          .toList(growable: false),
    );
    notifyListeners();
  }

  void _askAiForDamagesModel() {
    // The same damages assignment cannot run twice against the same facts.
    // A future evidence event may increment knownFactsRevision and regenerate
    // this action, at which point a materially updated model is justified.
    if (_snapshot.aiDamagesModelRevision >= _snapshot.knownFactsRevision) {
      return;
    }

    _snapshot = _snapshot.copyWith(
      timeLabel: _timeAfter(minutes: 90),
      spendEur: _snapshot.spendEur + 750,
      billableMinutes: _snapshot.billableMinutes + 90,
      fatigue: _snapshot.fatigue + 2,
      aiRequestsUsed: _snapshot.aiRequestsUsed + 1,
      aiDamagesModelRevision: _snapshot.knownFactsRevision,
      latestAiNote:
          'Damages model for facts revision ${_snapshot.knownFactsRevision}: base loss EUR 240,000; key sensitivities are scope variation, conditional acceptance, mitigation, and causation. Human verification required before reliance.',
      actions: _snapshot.actions
          .where((GameActionView action) => action.id != 'future-damages')
          .toList(growable: false),
    );
    notifyListeners();
  }

  void _reviewExpertReport() {
    if (_snapshot.expertReviewStatus != ExpertReviewStatus.reportReady) {
      return;
    }

    final int revisedKnownFacts = _snapshot.knownFactsRevision + 1;
    final List<GameActionView> actionsWithoutReview = _snapshot.actions
        .where((GameActionView action) => action.id != 'review-expert-report')
        .toList(growable: false);
    final List<GameActionView> refreshedActions =
        _ensureAiDamagesAction(actionsWithoutReview, revisedKnownFacts);

    _snapshot = _snapshot.copyWith(
      timeLabel: _timeAfter(minutes: 120),
      billableMinutes: _snapshot.billableMinutes + 120,
      fatigue: _snapshot.fatigue + 2,
      knownFactsRevision: revisedKnownFacts,
      expertReviewStatus: ExpertReviewStatus.reviewed,
      evidenceScore: (_snapshot.evidenceScore + 12).clamp(0, 100).toInt(),
      merits: (_snapshot.merits + 5).clamp(0, 100).toInt(),
      leverage: (_snapshot.leverage + 7).clamp(0, 100).toInt(),
      caseStrength: (_snapshot.caseStrength + 8).clamp(0, 100).toInt(),
      inbox: _snapshot.inbox
          .map(
            (InboxItemView item) => item.id.startsWith('expert-report-ready')
                ? item.copyWith(status: InboxStatus.resolved)
                : item,
          )
          .toList(growable: false),
      evidence: <EvidenceView>[
        ..._snapshot.evidence,
        const EvidenceView(
          id: 'independent-expert-report',
          title: 'Independent ERP expert report',
          detail:
              'Finds material supplier-side architecture and delivery-control failures, while allocating part of the delay to informal scope changes.',
          reliability: 88,
          isAdverse: false,
        ),
      ],
      actions: refreshedActions,
    );
    notifyListeners();
  }

  String _timeAfter({required int minutes}) {
    final List<String> parts = _snapshot.timeLabel.split(':');
    if (parts.length != 2) {
      return _snapshot.timeLabel;
    }

    final int? hour = int.tryParse(parts[0]);
    final int? minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) {
      return _snapshot.timeLabel;
    }

    final int totalMinutes = (hour * 60) + minute + minutes;
    final int nextHour = (totalMinutes ~/ 60) % 24;
    final int nextMinute = totalMinutes % 60;
    return '${nextHour.toString().padLeft(2, '0')}:'
        '${nextMinute.toString().padLeft(2, '0')}';
  }

  void _requestBudgetApproval() {
    _snapshot = _snapshot.copyWith(
      timeLabel: '10:30',
      spendEur: _snapshot.spendEur + 250,
      authorizedBudgetEur: _snapshot.authorizedBudgetEur + 25000,
      billableMinutes: _snapshot.billableMinutes + 30,
      clientTrust: _snapshot.clientTrust - 1,
      actions: _snapshot.actions
          .where((GameActionView action) => action.id != 'request-budget')
          .toList(growable: false),
    );
    notifyListeners();
  }

  void _acceptSettlement() {
    final String closedAt = '${_snapshot.dayLabel} · ${_snapshot.timeLabel}';
    final List<DeadlineView> finalizedDeadlines =
        _finalizeDeadlinesForClosure(_snapshot.deadlines);
    final List<InboxItemView> finalizedInbox = _finalizeInboxForClosure(
      inbox: _resolveInboxItem('settlement-offer'),
      closedAt: closedAt,
    );
    final ExpertReviewStatus finalExpertStatus =
        _snapshot.expertReviewStatus == ExpertReviewStatus.pending ||
                _snapshot.expertReviewStatus == ExpertReviewStatus.reportReady
            ? ExpertReviewStatus.expired
            : _snapshot.expertReviewStatus;
    final JuniorReviewStatus finalJuniorStatus =
        _snapshot.juniorReviewStatus == JuniorReviewStatus.inProgress ||
                _snapshot.juniorReviewStatus == JuniorReviewStatus.findingsReady
            ? JuniorReviewStatus.expired
            : _snapshot.juniorReviewStatus;

    _snapshot = _snapshot.copyWith(
      stage: 'Resolved',
      caseResultStatus: CaseResultStatus.settled,
      engagementStatus: EngagementStatus.completed,
      clientTrust: _snapshot.clientTrust + 2,
      expertReviewStatus: finalExpertStatus,
      juniorReviewStatus: finalJuniorStatus,
      inbox: finalizedInbox,
      deadlines: finalizedDeadlines,
      actions: const <GameActionView>[],
      outcomeSummary: _buildOutcomeSummary(
        inbox: finalizedInbox,
        deadlines: finalizedDeadlines,
        closedAt: closedAt,
        expertStatus: finalExpertStatus,
        juniorStatus: finalJuniorStatus,
        settled: true,
      ),
      clearSettlementOffer: true,
    );
    notifyListeners();
  }

  void _rejectSettlement() {
    final List<GameActionView> actionsWithoutSettlement = _snapshot.actions
        .where(
          (GameActionView action) =>
              action.id != 'future-settle' && action.id != 'reject-settlement',
        )
        .toList(growable: false);

    _snapshot = _snapshot.copyWith(
      leverage: _snapshot.leverage + 1,
      inbox: _resolveInboxItem('settlement-offer'),
      actions: _ensureAction(
        actionsWithoutSettlement,
        _commenceProceedingsAction(),
      ),
      clearSettlementOffer: true,
    );
    notifyListeners();
  }

  void _commenceProceedings() {
    if (_snapshot.stage != 'Pre-litigation' ||
        _snapshot.settlementOffer != null) {
      return;
    }

    final String completionTime = _timeAfter(minutes: 180);
    final List<GameActionView> remainingActions = _snapshot.actions
        .where(
          (GameActionView action) =>
              action.id != 'commence-proceedings' &&
              action.id != 'future-settle' &&
              action.id != 'reject-settlement',
        )
        .toList(growable: false);

    final DeadlineView claimDeadline = DeadlineView(
      id: 'statement-of-claim',
      title: 'Statement of claim filing',
      dueAt: 'Day 4 · 17:00',
      status: DeadlineStatus.open,
      detail:
          'File the pleaded breach, causation case, damages, and requested relief.',
      relatedActionId: 'prepare-statement-of-claim',
      missedConsequence:
          'The claim is dismissed by procedural default and the client may seek a fee write-off.',
    );

    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      stage: 'Pleadings',
      spendEur: _snapshot.spendEur + 2500,
      billableMinutes: _snapshot.billableMinutes + 180,
      fatigue: (_snapshot.fatigue + 3).clamp(0, 100).toInt(),
      procedure: (_snapshot.procedure + 5).clamp(0, 100).toInt(),
      leverage: (_snapshot.leverage + 2).clamp(0, 100).toInt(),
      clientTrust: (_snapshot.clientTrust + 2).clamp(0, 100).toInt(),
      deadlines: <DeadlineView>[
        ..._snapshot.deadlines.where(
          (DeadlineView item) => item.id != claimDeadline.id,
        ),
        claimDeadline,
      ],
      inbox: <InboxItemView>[
        ..._snapshot.inbox,
        InboxItemView(
          id: 'proceedings-commenced',
          sender: 'Enterprise Court Registry',
          subject: 'Proceedings opened',
          body:
              'The originating filing has been registered. Prepare and file the statement of claim to define the pleaded case.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.actionRequired,
        ),
      ],
      actions: _ensureAction(
        remainingActions,
        _prepareStatementOfClaimAction(),
      ),
    );
    notifyListeners();
  }

  void _prepareStatementOfClaim() {
    if (_snapshot.stage != 'Pleadings' ||
        !_isDeadlineOpen('statement-of-claim')) {
      return;
    }

    final String completionTime = _timeAfter(minutes: 240);
    final List<GameActionView> remainingActions = _snapshot.actions
        .where(
          (GameActionView action) => action.id != 'prepare-statement-of-claim',
        )
        .toList(growable: false);

    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      stage: 'Evidence',
      spendEur: _snapshot.spendEur + 1250,
      billableMinutes: _snapshot.billableMinutes + 240,
      fatigue: (_snapshot.fatigue + 4).clamp(0, 100).toInt(),
      merits: (_snapshot.merits + 3).clamp(0, 100).toInt(),
      procedure: (_snapshot.procedure + 8).clamp(0, 100).toInt(),
      deadlines: _setDeadlineStatus('statement-of-claim', DeadlineStatus.done),
      inbox: <InboxItemView>[
        ..._snapshot.inbox.map(
          (InboxItemView item) => item.id == 'proceedings-commenced'
              ? item.copyWith(status: InboxStatus.resolved)
              : item,
        ),
        InboxItemView(
          id: 'statement-filed',
          sender: 'Enterprise Court Registry',
          subject: 'Statement of claim filed',
          body:
              'The pleaded allegations, legal basis, and requested relief are now on record. Prepare the evidentiary bundle.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
      ],
      actions: _ensureAction(
        remainingActions,
        _prepareEvidenceBundleAction(),
      ),
    );
    notifyListeners();
  }

  void _prepareEvidenceBundle() {
    if (_snapshot.stage != 'Evidence') {
      return;
    }

    final String completionTime = _timeAfter(minutes: 240);
    final int currentDay = _currentDayNumber();
    final int calculatedHearingDay = currentDay + 3;
    final int hearingDay = calculatedHearingDay < 5 ? 5 : calculatedHearingDay;
    const String hearingId = 'enterprise-court-hearing-1';

    final List<GameActionView> remainingActions = _snapshot.actions
        .where(
          (GameActionView action) =>
              action.id != 'prepare-evidence-bundle' &&
              action.id != 'attend-hearing' &&
              action.id != 'wait-until-hearing' &&
              action.id != 'request-hearing-reschedule',
        )
        .toList(growable: false);

    final DeadlineView hearing = DeadlineView(
      id: hearingId,
      title: 'Enterprise court hearing',
      dueAt: 'Day $hearingDay · 10:00',
      status: DeadlineStatus.scheduled,
      kind: CalendarItemKind.mandatoryEvent,
      detail:
          'Attend the enterprise court, present the pleaded case, answer judicial questions, and address the supplier defence.',
      relatedActionId: 'attend-hearing',
      rescheduleActionId: 'request-hearing-reschedule',
      missedConsequence:
          'Procedure -20 and client trust -15. The court may decide the matter on an incomplete or adverse record.',
    );

    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      stage: 'Hearing preparation',
      spendEur: _snapshot.spendEur + 1500,
      billableMinutes: _snapshot.billableMinutes + 240,
      fatigue: (_snapshot.fatigue + 4).clamp(0, 100).toInt(),
      evidenceScore: (_snapshot.evidenceScore + 8).clamp(0, 100).toInt(),
      procedure: (_snapshot.procedure + 5).clamp(0, 100).toInt(),
      caseStrength: (_snapshot.caseStrength + 5).clamp(0, 100).toInt(),
      inbox: <InboxItemView>[
        ..._snapshot.inbox,
        InboxItemView(
          id: 'evidence-bundle-filed',
          sender: 'Enterprise Court Registry',
          subject: 'Evidence bundle accepted',
          body:
              'The documentary record has been accepted. The court separately scheduled the enterprise court hearing for Day $hearingDay at 10:00.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
        InboxItemView(
          id: 'hearing-notice-1',
          sender: 'Enterprise Court Registry',
          subject: 'Enterprise court hearing scheduled',
          body:
              'The hearing is scheduled for Day $hearingDay at 10:00. Attendance is mandatory. A rescheduling request does not suspend the original date unless the court grants it.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
      ],
      deadlines: <DeadlineView>[
        ..._snapshot.deadlines.where(
          (DeadlineView item) => item.id != hearingId,
        ),
        hearing,
      ],
      actions: _hearingPreparationActions(
        remainingActions,
        hearing,
        inbox: _snapshot.inbox,
      ),
    );
    notifyListeners();
  }

  ActionExecutionResult _requestHearingReschedule() {
    final DeadlineView? hearing = _activeScheduledHearing();
    if (hearing == null ||
        hearing.rescheduleActionId == null ||
        hearing.rescheduleStatus != RescheduleRequestStatus.none ||
        !_isRescheduleRequestWindowOpen(hearing)) {
      return const ActionExecutionResult(
        title: 'Action unavailable',
        message:
            'No eligible scheduled hearing is currently open for a postponement request.',
        isRisky: true,
      );
    }

    final String completionTime = _timeAfter(minutes: 90);
    final int currentDay = _currentDayNumber();
    final int decisionDay = currentDay + 1;
    final (int dueDay, _) = _calendarMoment(hearing);
    final String proposedDate = 'Day ${dueDay + 4} · 14:00';

    final DeadlineView updatedHearing = hearing.copyWith(
      rescheduleStatus: RescheduleRequestStatus.pending,
      rescheduleRequestedDay: currentDay,
      rescheduleDecisionDay: decisionDay,
      rescheduleRequestCount: hearing.rescheduleRequestCount + 1,
      clearRescheduleActionId: true,
    );

    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      spendEur: _snapshot.spendEur + 600,
      billableMinutes: _snapshot.billableMinutes + 90,
      fatigue: (_snapshot.fatigue + 1).clamp(0, 100).toInt(),
      deadlines: _replaceCalendarItem(updatedHearing),
      inbox: <InboxItemView>[
        ..._snapshot.inbox,
        InboxItemView(
          id: 'hearing-reschedule-request-${hearing.id}',
          sender: 'Enterprise Court Registry',
          subject: 'Request for hearing postponement received',
          body:
              'The court received the request based on additional preparation time and proposed $proposedDate. The original hearing at ${hearing.dueAt} remains binding until the court decides.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
      ],
      actions: _snapshot.actions
          .where(
            (GameActionView action) =>
                action.id != 'request-hearing-reschedule',
          )
          .toList(growable: false),
    );
    notifyListeners();

    return const ActionExecutionResult(
      title: 'Rescheduling request submitted',
      message:
          'The court will decide on the next workday. The original hearing remains mandatory until approval.',
      isRisky: false,
    );
  }

  bool _waitUntilHearing() {
    final DeadlineView? hearing = _activeScheduledHearing();
    if (hearing == null || _snapshot.stage != 'Hearing preparation') {
      return false;
    }

    final (int hearingDay, int hearingMinute) = _calendarMoment(hearing);
    final int currentDay = _currentDayNumber();
    final int currentMinute = _minuteOfDay(_snapshot.timeLabel);
    final bool beforeHearing = currentDay < hearingDay ||
        (currentDay == hearingDay && currentMinute < hearingMinute);
    if (!beforeHearing) {
      return false;
    }

    // This is an explicit fast-forward. Optional hearing-preparation actions
    // left unfinished are forfeited, but mandatory deadlines and asynchronous
    // expert work are still evaluated at the destination moment.
    final List<DeadlineView> updatedDeadlines = _markOverdueDeadlines(
      _snapshot.deadlines,
      day: hearingDay,
      minuteOfDay: hearingMinute,
    );
    final Set<String> newlyMissed = _newlyMissedDeadlineIds(
      before: _snapshot.deadlines,
      after: updatedDeadlines,
    );

    int procedure = _snapshot.procedure;
    int evidenceScore = _snapshot.evidenceScore;
    int ethics = _snapshot.ethics;
    int clientTrust = _snapshot.clientTrust;
    List<InboxItemView> updatedInbox = <InboxItemView>[..._snapshot.inbox];

    if (newlyMissed.contains('partner-brief')) {
      procedure -= 6;
      clientTrust -= 5;
      updatedInbox.add(
        InboxItemView(
          id: 'partner-brief-missed-fast-forward-$hearingDay',
          sender: 'Matter partner',
          subject: 'Partner risk brief missed during clock advance',
          body:
              'The internal risk brief remained incomplete when the simulation advanced to the hearing.',
          receivedAt: 'Day $hearingDay · ${_formatMinuteOfDay(hearingMinute)}',
          status: InboxStatus.unread,
        ),
      );
    }

    if (newlyMissed.contains('preservation')) {
      procedure -= 12;
      evidenceScore -= 10;
      ethics -= 6;
      clientTrust -= 10;
      updatedInbox.add(
        InboxItemView(
          id: 'preservation-missed-fast-forward-$hearingDay',
          sender: 'Matter risk system',
          subject: 'Evidence-preservation deadline missed',
          body:
              'The preservation notice was not completed before the clock advanced to the hearing. Relevant records may be incomplete or challenged.',
          receivedAt: 'Day $hearingDay · ${_formatMinuteOfDay(hearingMinute)}',
          status: InboxStatus.unread,
        ),
      );
    }

    ExpertReviewStatus expertStatus = _snapshot.expertReviewStatus;
    List<GameActionView> remainingActions = _snapshot.actions
        .where(
          (GameActionView action) =>
              action.id != 'wait-until-hearing' &&
              action.id != 'request-hearing-reschedule' &&
              action.id != 'prepare-hearing-strategy' &&
              action.id != 'prepare-key-witness' &&
              action.id != 'reconcile-damages-schedule' &&
              action.id != 'rest',
        )
        .toList(growable: false);

    final (
      List<InboxItemView>,
      List<GameActionView>,
      JuniorReviewStatus
    ) juniorExpiry = _expireJuniorReviewForHearing(
      inbox: updatedInbox,
      actions: remainingActions,
      status: _snapshot.juniorReviewStatus,
      day: hearingDay,
      minuteOfDay: hearingMinute,
    );
    updatedInbox = juniorExpiry.$1;
    remainingActions = juniorExpiry.$2;
    final JuniorReviewStatus juniorStatus = juniorExpiry.$3;

    if (expertStatus == ExpertReviewStatus.pending &&
        hearingDay >= _snapshot.expertReportDueDay) {
      expertStatus = ExpertReviewStatus.reportReady;
      updatedInbox = updatedInbox
          .map(
            (InboxItemView item) => item.id == 'expert-assignment'
                ? item.copyWith(status: InboxStatus.resolved)
                : item,
          )
          .toList(growable: true)
        ..add(
          InboxItemView(
            id: 'expert-report-ready-at-hearing',
            sender: 'Independent ERP expert',
            subject: 'Technical assessment ready before hearing',
            body:
                'The expert report became available during the clock advance. It remains available for review, but the hearing window is now open.',
            receivedAt:
                'Day $hearingDay · ${_formatMinuteOfDay(hearingMinute)}',
            status: InboxStatus.actionRequired,
          ),
        );
      remainingActions = _ensureAction(
        remainingActions,
        _reviewExpertReportAction(),
      );
    }

    updatedInbox.add(
      InboxItemView(
        id: 'hearing-window-open-${hearing.id}',
        sender: 'Enterprise Court Registry',
        subject: 'Enterprise court hearing now in session',
        body:
            'The scheduled attendance window has opened. Attend the hearing now or risk a missed mandatory event.',
        receivedAt: 'Day $hearingDay · ${_formatMinuteOfDay(hearingMinute)}',
        status: InboxStatus.unread,
      ),
    );

    _snapshot = _snapshot.copyWith(
      dayLabel: 'Day $hearingDay',
      timeLabel: _formatMinuteOfDay(hearingMinute),
      fatigue: currentDay < hearingDay ? 0 : _snapshot.fatigue,
      cumulativeStrain: currentDay < hearingDay
          ? (_snapshot.cumulativeStrain - 2).clamp(0, 100).toInt()
          : _snapshot.cumulativeStrain,
      procedure: procedure.clamp(0, 100).toInt(),
      evidenceScore: evidenceScore.clamp(0, 100).toInt(),
      ethics: ethics.clamp(0, 100).toInt(),
      clientTrust: clientTrust.clamp(0, 100).toInt(),
      inactivityMinutes: _snapshot.inactivityMinutes + _restInactivityMinutes,
      expertReviewStatus: expertStatus,
      juniorReviewStatus: juniorStatus,
      deadlines: updatedDeadlines,
      inbox: updatedInbox,
      actions: _ensureAction(
        remainingActions,
        _attendHearingAction(),
      ),
    );
    notifyListeners();
    return true;
  }

  void _prepareHearingStrategy() {
    final String completionTime = _timeAfter(minutes: 120);
    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      spendEur: _snapshot.spendEur + 750,
      billableMinutes: _snapshot.billableMinutes + 120,
      fatigue: (_snapshot.fatigue + 2).clamp(0, 100).toInt(),
      merits: (_snapshot.merits + 3).clamp(0, 100).toInt(),
      procedure: (_snapshot.procedure + 3).clamp(0, 100).toInt(),
      caseStrength: (_snapshot.caseStrength + 3).clamp(0, 100).toInt(),
      inbox: <InboxItemView>[
        ..._snapshot.inbox,
        InboxItemView(
          id: 'hearing-strategy-prepared',
          sender: 'Matter team',
          subject: 'Hearing strategy memorandum completed',
          body:
              'The oral theory, likely judicial questions, fallback submissions, and evidentiary weak points are now documented.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
      ],
      actions: _snapshot.actions
          .where(
            (GameActionView action) => action.id != 'prepare-hearing-strategy',
          )
          .toList(growable: false),
    );
    notifyListeners();
  }

  void _prepareKeyWitness() {
    final String completionTime = _timeAfter(minutes: 120);
    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      spendEur: _snapshot.spendEur + 900,
      billableMinutes: _snapshot.billableMinutes + 120,
      fatigue: (_snapshot.fatigue + 2).clamp(0, 100).toInt(),
      evidenceScore: (_snapshot.evidenceScore + 3).clamp(0, 100).toInt(),
      clientTrust: (_snapshot.clientTrust + 2).clamp(0, 100).toInt(),
      caseStrength: (_snapshot.caseStrength + 2).clamp(0, 100).toInt(),
      inbox: <InboxItemView>[
        ..._snapshot.inbox,
        InboxItemView(
          id: 'key-witness-prepared',
          sender: 'Client IT director',
          subject: 'Witness preparation completed',
          body:
              'The witness reviewed the chronology, documentary references, likely cross-examination themes, and the limits of proper preparation.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
      ],
      actions: _snapshot.actions
          .where(
            (GameActionView action) => action.id != 'prepare-key-witness',
          )
          .toList(growable: false),
    );
    notifyListeners();
  }

  void _reconcileDamagesSchedule() {
    final String completionTime = _timeAfter(minutes: 120);
    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      spendEur: _snapshot.spendEur + 650,
      billableMinutes: _snapshot.billableMinutes + 120,
      fatigue: (_snapshot.fatigue + 2).clamp(0, 100).toInt(),
      merits: (_snapshot.merits + 2).clamp(0, 100).toInt(),
      leverage: (_snapshot.leverage + 3).clamp(0, 100).toInt(),
      caseStrength: (_snapshot.caseStrength + 2).clamp(0, 100).toInt(),
      inbox: <InboxItemView>[
        ..._snapshot.inbox,
        InboxItemView(
          id: 'damages-schedule-reconciled',
          sender: 'Matter team',
          subject: 'Damages schedule reconciled',
          body:
              'Invoices, replacement costs, mitigation, internal effort, and expert findings now reconcile to the pleaded quantum.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
      ],
      actions: _snapshot.actions
          .where(
            (GameActionView action) =>
                action.id != 'reconcile-damages-schedule',
          )
          .toList(growable: false),
    );
    notifyListeners();
  }

  void _attendHearing() {
    final DeadlineView? hearing = _activeScheduledHearing();
    if (hearing == null || _snapshot.stage != 'Hearing preparation') {
      return;
    }

    final String completionTime = _timeAfter(minutes: 360);
    final DeadlineView completedHearing = hearing.copyWith(
      status: DeadlineStatus.done,
      clearRelatedActionId: true,
      clearRescheduleActionId: true,
    );

    final (
      List<InboxItemView>,
      List<GameActionView>,
      JuniorReviewStatus
    ) juniorExpiry = _expireJuniorReviewForHearing(
      inbox: _snapshot.inbox,
      actions: _snapshot.actions,
      status: _snapshot.juniorReviewStatus,
      day: _currentDayNumber(),
      minuteOfDay: _minuteOfDay(_snapshot.timeLabel),
    );

    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      stage: 'Judgment pending',
      billableMinutes: _snapshot.billableMinutes + 360,
      fatigue: (_snapshot.fatigue + 8).clamp(0, 100).toInt(),
      cumulativeStrain: (_snapshot.cumulativeStrain + 3).clamp(0, 100).toInt(),
      juniorReviewStatus: juniorExpiry.$3,
      deadlines: _replaceCalendarItem(completedHearing),
      inbox: <InboxItemView>[
        ...juniorExpiry.$1.map(
          (InboxItemView item) => item.id.startsWith('hearing-notice-') ||
                  (item.id.startsWith('expert-report-ready') &&
                      item.status == InboxStatus.actionRequired)
              ? item.copyWith(status: InboxStatus.resolved)
              : item,
        ),
        if (_snapshot.expertReviewStatus == ExpertReviewStatus.reportReady)
          InboxItemView(
            id: 'expert-report-not-reviewed-before-hearing',
            sender: 'Matter risk system',
            subject: 'Expert report not reviewed before hearing',
            body:
                'The technical report was available before attendance but was not reviewed into the hearing record. It is archived as a missed preparation opportunity and no longer requires a response.',
            receivedAt: '${_snapshot.dayLabel} · $completionTime',
            status: InboxStatus.unread,
          ),
        InboxItemView(
          id: 'hearing-concluded',
          sender: 'Enterprise Court Registry',
          subject: 'Hearing concluded',
          body:
              'The court heard both parties and took the matter under advisement. Judgment is expected on the next workday.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
      ],
      actions: const <GameActionView>[
        GameActionView(
          id: 'rest',
          title: 'Rest until next workday',
          description:
              'Recover acute fatigue while deadlines and events continue.',
          timeLabel: 'Until 08:00',
          costEur: 0,
          tone: ActionTone.neutral,
        ),
      ],
    );
    notifyListeners();
  }

  void _informClientOfJudgment() {
    final bool dismissed = _snapshot.inbox.any(
      (InboxItemView item) =>
          item.id.startsWith('judgment-day-') &&
          item.subject.contains('claim dismissed'),
    );
    final String completionTime = _timeAfter(minutes: 60);
    final int appealDeadlineDay = _currentDayNumber() + 3;
    final List<InboxItemView> inbox = <InboxItemView>[
      ..._snapshot.inbox.map(
        (InboxItemView item) => item.id.startsWith('judgment-day-')
            ? item.copyWith(status: InboxStatus.resolved)
            : item,
      ),
      InboxItemView(
        id: 'client-judgment-briefed',
        sender: 'Client CEO',
        subject: 'Judgment briefing acknowledged',
        body:
            'The client received the outcome, damages explanation, enforcement considerations, and the available post-judgment routes.',
        receivedAt: '${_snapshot.dayLabel} · $completionTime',
        status: InboxStatus.unread,
      ),
      if (dismissed)
        InboxItemView(
          id: 'appeal-advice-request',
          sender: 'Client CEO',
          subject: 'Prepare appeal advice',
          body:
              'The client requests a candid assessment of appeal grounds, cost, timing, and prospects before deciding whether to continue the engagement.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.actionRequired,
        ),
    ];
    final List<DeadlineView> deadlines = dismissed
        ? <DeadlineView>[
            ..._snapshot.deadlines.where(
              (DeadlineView item) => item.id != 'appeal-deadline',
            ),
            DeadlineView(
              id: 'appeal-deadline',
              title: 'Appeal filing deadline',
              dueAt: 'Day $appealDeadlineDay · 17:00',
              status: DeadlineStatus.open,
              detail:
                  'Prepare advice, obtain client authorization, and file the appeal before the review window closes.',
              relatedActionId: 'prepare-appeal-advice',
              missedConsequence:
                  'The first-instance loss becomes final and the engagement closes.',
            ),
          ]
        : _snapshot.deadlines;

    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      stage: dismissed ? 'Appeal assessment' : 'Post-judgment',
      engagementStatus: EngagementStatus.awaitingClientInstructions,
      billableMinutes: _snapshot.billableMinutes + 60,
      fatigue: (_snapshot.fatigue + 1).clamp(0, 100).toInt(),
      clientTrust: (_snapshot.clientTrust + 4).clamp(0, 100).toInt(),
      inbox: inbox,
      deadlines: deadlines,
      actions: dismissed
          ? <GameActionView>[
              _prepareAppealAdviceAction(),
              _acceptJudgmentAndCloseAction(),
            ]
          : const <GameActionView>[
              GameActionView(
                id: 'rest',
                title: 'Rest until next workday',
                description:
                    'Advance to the next post-judgment update while recovering acute fatigue.',
                timeLabel: 'Until 08:00',
                costEur: 0,
                tone: ActionTone.neutral,
              ),
            ],
    );
    notifyListeners();
  }

  void _prepareAppealAdvice() {
    if (_snapshot.stage != 'Appeal assessment') {
      return;
    }

    final bool hardProceduralDefault = _snapshot.inbox.any(
      (InboxItemView item) =>
          item.id.startsWith('judgment-day-') &&
          item.subject.contains('procedural default'),
    );
    final int groundsScore = (((_snapshot.procedure * 35) +
                (_snapshot.ethics * 20) +
                (_snapshot.evidenceScore * 20) +
                (_snapshot.merits * 25)) /
            100)
        .round();
    final bool viable = !hardProceduralDefault && groundsScore >= 45;
    final String completionTime = _timeAfter(minutes: 180);

    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      stage: 'Awaiting appeal instructions',
      spendEur: _snapshot.spendEur + 1200,
      billableMinutes: _snapshot.billableMinutes + 180,
      fatigue: (_snapshot.fatigue + 3).clamp(0, 100).toInt(),
      ethics: (_snapshot.ethics + 1).clamp(0, 100).toInt(),
      inbox: <InboxItemView>[
        ..._snapshot.inbox.map(
          (InboxItemView item) => item.id == 'appeal-advice-request'
              ? item.copyWith(status: InboxStatus.resolved)
              : item,
        ),
        InboxItemView(
          id: viable ? 'appeal-advice-viable' : 'appeal-advice-weak',
          sender: 'Matter team',
          subject: viable
              ? 'Appeal grounds identified'
              : 'Appeal prospects assessed as weak',
          body: viable
              ? 'The advice identifies an arguable appellate route and records a grounds score of $groundsScore/100. Client authorization remains mandatory before filing.'
              : 'The loss primarily reflects the factual and evidentiary record, or a hard procedural failure. Grounds score $groundsScore/100. A further challenge may add cost without a proportionate prospect of success.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
        InboxItemView(
          id: 'appeal-client-instructions',
          sender: 'Client CEO',
          subject: 'Client decision required on appeal',
          body:
              'Present the recommendation and request express authority to appeal, or accept the judgment and close the matter.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.actionRequired,
        ),
      ],
      deadlines: _snapshot.deadlines
          .map(
            (DeadlineView item) => item.id == 'appeal-deadline'
                ? item.copyWith(
                    relatedActionId: 'seek-client-appeal-authorization',
                  )
                : item,
          )
          .toList(growable: false),
      actions: <GameActionView>[
        _seekClientAppealAuthorizationAction(),
        _acceptJudgmentAndCloseAction(),
      ],
    );
    notifyListeners();
  }

  void _seekClientAppealAuthorization() {
    if (_snapshot.stage != 'Awaiting appeal instructions') {
      return;
    }

    final bool viable = _snapshot.inbox.any(
      (InboxItemView item) => item.id == 'appeal-advice-viable',
    );
    final bool clientConsents = viable && _snapshot.clientTrust >= 25;
    final List<InboxItemView> inbox = <InboxItemView>[
      ..._snapshot.inbox.map(
        (InboxItemView item) => item.id == 'appeal-client-instructions'
            ? item.copyWith(status: InboxStatus.resolved)
            : item,
      ),
      InboxItemView(
        id: clientConsents
            ? 'client-authorized-appeal'
            : 'client-declined-appeal',
        sender: 'Client CEO',
        subject: clientConsents
            ? 'Client authorized appeal'
            : 'Client declined appeal',
        body: clientConsents
            ? 'The client approved the appeal budget and filing on the assessed grounds. File before the deadline.'
            : 'The client declined further proceedings after considering the grounds, cost, trust, and prospects.',
        receivedAt: '${_snapshot.dayLabel} · ${_snapshot.timeLabel}',
        status: InboxStatus.unread,
      ),
    ];

    if (!clientConsents) {
      _snapshot = _snapshot.copyWith(inbox: inbox);
      _closeCurrentLoss(
        subject: 'First-instance judgment accepted',
        detail:
            'The client declined to authorize an appeal. The first-instance dismissal became final for this simulation branch.',
      );
      return;
    }

    _snapshot = _snapshot.copyWith(
      stage: 'Appeal preparation',
      engagementStatus: EngagementStatus.active,
      clientTrust: (_snapshot.clientTrust - 1).clamp(0, 100).toInt(),
      inbox: inbox,
      deadlines: _snapshot.deadlines
          .map(
            (DeadlineView item) => item.id == 'appeal-deadline'
                ? item.copyWith(relatedActionId: 'file-appeal')
                : item,
          )
          .toList(growable: false),
      actions: <GameActionView>[
        _fileAppealAction(),
        _acceptJudgmentAndCloseAction(),
      ],
    );
    notifyListeners();
  }

  void _fileAppeal() {
    if (_snapshot.stage != 'Appeal preparation') {
      return;
    }

    final String completionTime = _timeAfter(minutes: 360);
    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      stage: 'Appeal pending',
      engagementStatus: EngagementStatus.active,
      spendEur: _snapshot.spendEur + 4000,
      billableMinutes: _snapshot.billableMinutes + 360,
      fatigue: (_snapshot.fatigue + 5).clamp(0, 100).toInt(),
      procedure: (_snapshot.procedure + 4).clamp(0, 100).toInt(),
      inbox: <InboxItemView>[
        ..._snapshot.inbox,
        InboxItemView(
          id: 'claimant-appeal-filed',
          sender: 'Court of Appeal Registry',
          subject: 'Appeal filed',
          body:
              'The appeal was filed on the authorized grounds. The first-instance result remains recorded while the appellate court reviews the matter.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
      ],
      deadlines: _snapshot.deadlines
          .map(
            (DeadlineView item) => item.id == 'appeal-deadline'
                ? item.copyWith(
                    status: DeadlineStatus.done,
                    clearRelatedActionId: true,
                  )
                : item,
          )
          .toList(growable: false),
      actions: <GameActionView>[_awaitAppealDecisionAction()],
    );
    notifyListeners();
  }

  void _assessCassationGrounds() {
    if (_snapshot.stage != 'Cassation assessment') {
      return;
    }

    final bool hardProceduralDefault = _snapshot.inbox.any(
      (InboxItemView item) =>
          item.id.startsWith('judgment-day-') &&
          item.subject.contains('procedural default'),
    );
    final int groundsScore = (((_snapshot.procedure * 55) +
                (_snapshot.ethics * 25) +
                (_snapshot.merits * 20)) /
            100)
        .round();
    final bool viable = !hardProceduralDefault && groundsScore >= 40;
    final String completionTime = _timeAfter(minutes: 240);

    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      stage: 'Awaiting cassation instructions',
      spendEur: _snapshot.spendEur + 2500,
      billableMinutes: _snapshot.billableMinutes + 240,
      fatigue: (_snapshot.fatigue + 4).clamp(0, 100).toInt(),
      inbox: <InboxItemView>[
        ..._snapshot.inbox.map(
          (InboxItemView item) => item.id == 'cassation-assessment-request'
              ? item.copyWith(status: InboxStatus.resolved)
              : item,
        ),
        InboxItemView(
          id: viable
              ? 'cassation-grounds-viable'
              : 'cassation-grounds-not-viable',
          sender: 'Cassation counsel',
          subject: viable
              ? 'Arguable cassation ground identified'
              : 'No proportionate cassation ground identified',
          body: viable
              ? 'Counsel identified an arguable legal or procedural ground, scoring $groundsScore/100. Client authorization is still required; cassation does not reopen the factual record.'
              : 'The proposed challenge concerns factual assessment rather than a sufficient legal or procedural error. Grounds score $groundsScore/100.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
        InboxItemView(
          id: 'cassation-client-instructions',
          sender: 'Client CEO',
          subject: 'Client decision required on cassation',
          body:
              'Request express authority to file on the assessed legal ground, or accept the appellate judgment and close.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.actionRequired,
        ),
      ],
      deadlines: _snapshot.deadlines
          .map(
            (DeadlineView item) => item.id == 'cassation-deadline'
                ? item.copyWith(
                    relatedActionId: 'seek-client-cassation-authorization',
                  )
                : item,
          )
          .toList(growable: false),
      actions: <GameActionView>[
        _seekClientCassationAuthorizationAction(),
        _acceptAppellateJudgmentAction(),
      ],
    );
    notifyListeners();
  }

  void _seekClientCassationAuthorization() {
    if (_snapshot.stage != 'Awaiting cassation instructions') {
      return;
    }

    final bool viable = _snapshot.inbox.any(
      (InboxItemView item) => item.id == 'cassation-grounds-viable',
    );
    final bool clientConsents = viable && _snapshot.clientTrust >= 25;
    final List<InboxItemView> inbox = <InboxItemView>[
      ..._snapshot.inbox.map(
        (InboxItemView item) => item.id == 'cassation-client-instructions'
            ? item.copyWith(status: InboxStatus.resolved)
            : item,
      ),
      InboxItemView(
        id: clientConsents
            ? 'client-authorized-cassation'
            : 'client-declined-cassation',
        sender: 'Client CEO',
        subject: clientConsents
            ? 'Client authorized cassation appeal'
            : 'Client declined cassation appeal',
        body: clientConsents
            ? 'The client approved filing on the identified legal ground. File before the cassation deadline.'
            : 'The client declined the further challenge after considering the limited ground, cost, and prospects.',
        receivedAt: '${_snapshot.dayLabel} · ${_snapshot.timeLabel}',
        status: InboxStatus.unread,
      ),
    ];

    if (!clientConsents) {
      _snapshot = _snapshot.copyWith(inbox: inbox);
      _closeCurrentLoss(
        subject: 'Appellate judgment accepted',
        detail:
            'The client declined to authorize cassation. The appellate loss became final for this simulation branch.',
      );
      return;
    }

    _snapshot = _snapshot.copyWith(
      stage: 'Cassation preparation',
      engagementStatus: EngagementStatus.active,
      clientTrust: (_snapshot.clientTrust - 1).clamp(0, 100).toInt(),
      inbox: inbox,
      deadlines: _snapshot.deadlines
          .map(
            (DeadlineView item) => item.id == 'cassation-deadline'
                ? item.copyWith(relatedActionId: 'file-cassation-appeal')
                : item,
          )
          .toList(growable: false),
      actions: <GameActionView>[
        _fileCassationAppealAction(),
        _acceptAppellateJudgmentAction(),
      ],
    );
    notifyListeners();
  }

  void _fileCassationAppeal() {
    if (_snapshot.stage != 'Cassation preparation') {
      return;
    }

    final String completionTime = _timeAfter(minutes: 300);
    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      stage: 'Cassation pending',
      engagementStatus: EngagementStatus.active,
      spendEur: _snapshot.spendEur + 6000,
      billableMinutes: _snapshot.billableMinutes + 300,
      fatigue: (_snapshot.fatigue + 5).clamp(0, 100).toInt(),
      procedure: (_snapshot.procedure + 3).clamp(0, 100).toInt(),
      inbox: <InboxItemView>[
        ..._snapshot.inbox,
        InboxItemView(
          id: 'claimant-cassation-filed',
          sender: 'Court of Cassation Registry',
          subject: 'Claimant cassation appeal filed',
          body:
              'The appeal was filed on the authorized legal ground. The court will review legality rather than retry the facts.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
      ],
      deadlines: _snapshot.deadlines
          .map(
            (DeadlineView item) => item.id == 'cassation-deadline'
                ? item.copyWith(
                    status: DeadlineStatus.done,
                    clearRelatedActionId: true,
                  )
                : item,
          )
          .toList(growable: false),
      actions: <GameActionView>[_awaitCassationDecisionAction()],
    );
    notifyListeners();
  }

  void _closeCurrentLoss({
    required String subject,
    required String detail,
  }) {
    final String closedAt = '${_snapshot.dayLabel} · ${_snapshot.timeLabel}';
    final List<DeadlineView> deadlines =
        _finalizeDeadlinesForClosure(_snapshot.deadlines);
    final List<InboxItemView> inbox = _finalizeInboxForClosure(
      inbox: <InboxItemView>[
        ..._snapshot.inbox.map(
          (InboxItemView item) => item.status == InboxStatus.actionRequired
              ? item.copyWith(status: InboxStatus.resolved)
              : item,
        ),
        InboxItemView(
          id: 'judgment-accepted-${_snapshot.dayLabel}-${_snapshot.timeLabel}',
          sender: 'Client CEO',
          subject: subject,
          body: detail,
          receivedAt: closedAt,
          status: InboxStatus.unread,
        ),
      ],
      closedAt: closedAt,
    );

    _snapshot = _snapshot.copyWith(
      stage: 'Resolved',
      engagementStatus: EngagementStatus.completed,
      deadlines: deadlines,
      inbox: inbox,
      actions: const <GameActionView>[],
      outcomeSummary: _buildOutcomeSummary(
        inbox: inbox,
        deadlines: deadlines,
        closedAt: closedAt,
        expertStatus: _snapshot.expertReviewStatus,
        juniorStatus: _snapshot.juniorReviewStatus,
      ),
      clearSettlementOffer: true,
    );
    notifyListeners();
  }

  void _prepareCassationResponse() {
    final String completionTime = _timeAfter(minutes: 240);
    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      stage: 'Cassation pending',
      spendEur: _snapshot.spendEur + 2500,
      billableMinutes: _snapshot.billableMinutes + 240,
      fatigue: (_snapshot.fatigue + 4).clamp(0, 100).toInt(),
      procedure: (_snapshot.procedure + 5).clamp(0, 100).toInt(),
      clientTrust: (_snapshot.clientTrust + 2).clamp(0, 100).toInt(),
      inbox: <InboxItemView>[
        ..._snapshot.inbox.map(
          (InboxItemView item) => item.id.startsWith('counterparty-cassation-')
              ? item.copyWith(status: InboxStatus.resolved)
              : item,
        ),
        InboxItemView(
          id: 'cassation-response-filed',
          sender: 'Court of Cassation Registry',
          subject: 'Response to cassation challenge filed',
          body:
              'The response addresses the legal grounds raised by the counterparty. The existing judgment remains effective subject to the review process.',
          receivedAt: '${_snapshot.dayLabel} · $completionTime',
          status: InboxStatus.unread,
        ),
      ],
      actions: <GameActionView>[
        _awaitCassationDecisionAction(),
      ],
    );
    notifyListeners();
  }

  List<InboxItemView> _finalizeInboxForClosure({
    required List<InboxItemView> inbox,
    required String closedAt,
  }) {
    final List<InboxItemView> finalized = inbox
        .map(
          (InboxItemView item) => item.status == InboxStatus.actionRequired ||
                  item.id == 'junior-report' ||
                  item.id == 'junior-findings-ready'
              ? item.copyWith(status: InboxStatus.resolved)
              : item,
        )
        .toList(growable: true);

    if (!finalized.any((InboxItemView item) => item.id == 'matter-closed')) {
      finalized.add(
        InboxItemView(
          id: 'matter-closed',
          sender: 'Matter team',
          subject: 'Matter closed',
          body:
              'The Failed ERP Implementation has been closed. The final outcome and performance assessment are available in the case report.',
          receivedAt: closedAt,
          status: InboxStatus.unread,
        ),
      );
    }
    return finalized;
  }

  List<DeadlineView> _finalizeDeadlinesForClosure(
    List<DeadlineView> deadlines,
  ) {
    return deadlines
        .map(
          (DeadlineView item) => item.status == DeadlineStatus.open ||
                  item.status == DeadlineStatus.scheduled
              ? item.copyWith(
                  status: DeadlineStatus.cancelled,
                  clearRelatedActionId: true,
                  clearRescheduleActionId: true,
                )
              : item,
        )
        .toList(growable: false);
  }

  InboxItemView? _lastInboxItemWhere(
    List<InboxItemView> inbox,
    bool Function(InboxItemView item) predicate,
  ) {
    for (int index = inbox.length - 1; index >= 0; index -= 1) {
      final InboxItemView item = inbox[index];
      if (predicate(item)) {
        return item;
      }
    }
    return null;
  }

  CaseOutcomeSummaryView _buildOutcomeSummary({
    required List<InboxItemView> inbox,
    required List<DeadlineView> deadlines,
    required String closedAt,
    required ExpertReviewStatus expertStatus,
    required JuniorReviewStatus juniorStatus,
    bool settled = false,
  }) {
    final InboxItemView? judgment = _lastInboxItemWhere(
      inbox,
      (InboxItemView item) => item.id.startsWith('judgment-day-'),
    );
    final InboxItemView? finalEvent = _lastInboxItemWhere(
      inbox,
      (InboxItemView item) =>
          item.id.startsWith('appeal-outcome-') ||
          item.id.startsWith('claimant-cassation-outcome-') ||
          item.id.startsWith('cassation-outcome-') ||
          item.id.startsWith('judgment-accepted-') ||
          item.id.startsWith('appeal-deadline-expired-') ||
          item.id.startsWith('cassation-deadline-expired-') ||
          item.id.startsWith('judgment-finality-'),
    );
    final InboxItemView? proceduralDefault = _lastInboxItemWhere(
      inbox,
      (InboxItemView item) => item.id.startsWith('procedural-default-'),
    );

    String headline;
    String finalStatus;
    String detail;
    int awardEur;
    int costsEur;

    if (proceduralDefault != null) {
      headline = 'Claim dismissed by procedural default';
      finalStatus = 'Mandatory filing requirement missed';
      detail = proceduralDefault.body;
      awardEur = 0;
      costsEur = 12000;
    } else if (settled) {
      headline = 'Matter settled';
      finalStatus = 'Commercial resolution accepted';
      detail =
          'The client accepted EUR 64,500 without an admission of liability and avoided further litigation cost and uncertainty.';
      awardEur = 64500;
      costsEur = 0;
    } else if (finalEvent?.subject == 'Appeal allowed') {
      headline = 'Claim allowed on appeal';
      finalStatus = 'Won on appeal';
      detail = finalEvent!.body;
      awardEur = 180000;
      costsEur = 15000;
    } else if (finalEvent?.subject == 'Decision quashed and remitted') {
      headline = 'Decision quashed and remitted';
      finalStatus = 'Remitted for rehearing';
      detail = finalEvent!.body;
      awardEur = 0;
      costsEur = 5000;
    } else if (judgment?.subject.contains('substantially upheld') ?? false) {
      headline = 'Claim substantially upheld';
      finalStatus = finalEvent?.subject == 'Cassation challenge dismissed'
          ? 'Original judgment remains effective'
          : finalEvent?.subject ?? 'No further challenge pending';
      detail = finalEvent?.body ?? judgment!.body;
      awardEur = 220800;
      costsEur = 18000;
    } else if (judgment?.subject.contains('claim dismissed') ?? false) {
      headline = 'Claim dismissed';
      finalStatus = finalEvent?.subject ?? 'Lost at first instance';
      detail = finalEvent?.body ?? judgment!.body;
      awardEur = 0;
      costsEur = 12000;
    } else {
      headline = 'Mixed outcome';
      finalStatus = finalEvent?.subject ?? 'Matter concluded';
      detail = finalEvent?.body ??
          judgment?.body ??
          'The matter concluded after a mixed procedural and substantive result.';
      awardEur = 95000;
      costsEur = 9000;
    }

    final List<String> successes = <String>[
      if (deadlines.any(
        (DeadlineView item) =>
            item.id == 'preservation' && item.status == DeadlineStatus.done,
      ))
        'Evidence-preservation notice completed',
      if (expertStatus == ExpertReviewStatus.reviewed)
        'Independent expert findings reviewed',
      if (juniorStatus == JuniorReviewStatus.reviewed)
        'Junior document findings validated',
      if (deadlines.any(
        (DeadlineView item) =>
            item.isHearing && item.status == DeadlineStatus.done,
      ))
        'Mandatory court hearing attended',
      if (inbox.any(
        (InboxItemView item) => item.id == 'hearing-strategy-prepared',
      ))
        'Hearing strategy memorandum completed',
      if (settled) 'Commercial settlement achieved',
      if (finalEvent?.subject == 'Appeal allowed')
        'First-instance dismissal reversed on appeal',
      if (finalEvent?.subject == 'Decision quashed and remitted')
        'Cassation ground accepted and matter remitted',
    ];

    final List<String> missed = <String>[
      ...deadlines
          .where((DeadlineView item) => item.status == DeadlineStatus.missed)
          .map((DeadlineView item) => item.title),
      if (juniorStatus == JuniorReviewStatus.expired ||
          inbox.any(
            (InboxItemView item) =>
                item.id == 'junior-review-not-used-before-hearing',
          ))
        'Junior review was not validated before hearing',
      if (expertStatus == ExpertReviewStatus.expired ||
          inbox.any(
            (InboxItemView item) =>
                item.id == 'expert-report-not-reviewed-before-hearing',
          ))
        'Expert report was not reviewed before hearing',
      if (judgment != null &&
          !inbox.any(
            (InboxItemView item) => item.id == 'hearing-strategy-prepared',
          ))
        'Hearing strategy memorandum was not completed',
      if (judgment != null &&
          !inbox.any(
            (InboxItemView item) => item.id == 'key-witness-prepared',
          ))
        'Client key witness was not prepared',
      if (judgment != null &&
          !inbox.any(
            (InboxItemView item) => item.id == 'damages-schedule-reconciled',
          ))
        'Damages schedule was not reconciled',
    ];

    return CaseOutcomeSummaryView(
      headline: headline,
      finalStatus: finalStatus,
      detail: detail,
      closedAt: closedAt,
      awardEur: awardEur,
      costsEur: costsEur,
      keySuccesses: List<String>.unmodifiable(successes),
      missedOpportunities: List<String>.unmodifiable(missed),
    );
  }

  List<InboxItemView> _resolveInboxItem(String itemId) {
    return _snapshot.inbox
        .map(
          (InboxItemView item) => item.id == itemId
              ? item.copyWith(status: InboxStatus.resolved)
              : item,
        )
        .toList(growable: false);
  }

  void _rest() {
    // Rest advances the authoritative demo clock by one workday. Timed world
    // events are evaluated against the new clock before the snapshot is
    // published, so hearings, deadlines, settlement offers, and asynchronous
    // assignments cannot remain in stale states indefinitely.
    final int nextDay = _currentDayNumber() + 1;

    List<DeadlineView> workingDeadlines = <DeadlineView>[
      ..._snapshot.deadlines,
    ];
    List<InboxItemView> updatedInbox = <InboxItemView>[..._snapshot.inbox];
    List<GameActionView> updatedActions = _snapshot.actions
        .where(
          (GameActionView action) =>
              action.id != 'attend-hearing' &&
              action.id != 'wait-until-hearing' &&
              action.id != 'request-hearing-reschedule',
        )
        .toList(growable: false);

    // The court decides a pending rescheduling request before the new day's
    // deadline scan. A granted request replaces the original hearing; a denied
    // request leaves the original date binding.
    final (List<DeadlineView>, List<InboxItemView>) rescheduleDecision =
        _resolvePendingHearingRequest(
      deadlines: workingDeadlines,
      inbox: updatedInbox,
      day: nextDay,
    );
    workingDeadlines = rescheduleDecision.$1;
    updatedInbox = rescheduleDecision.$2;

    List<DeadlineView> updatedDeadlines = _markOverdueDeadlines(
      workingDeadlines,
      day: nextDay,
      minuteOfDay: 8 * 60,
    );

    final Set<String> newlyMissed = _newlyMissedDeadlineIds(
      before: workingDeadlines,
      after: updatedDeadlines,
    );

    int procedure = _snapshot.procedure;
    int evidenceScore = _snapshot.evidenceScore;
    int ethics = _snapshot.ethics;
    int clientTrust = _snapshot.clientTrust;
    String nextStage = _snapshot.stage;
    CaseResultStatus caseResultStatus = _snapshot.caseResultStatus;
    EngagementStatus engagementStatus = _snapshot.engagementStatus;
    JuniorReviewStatus juniorStatus = _snapshot.juniorReviewStatus;
    CaseOutcomeSummaryView? outcomeSummary = _snapshot.outcomeSummary;

    if (newlyMissed.contains('partner-brief')) {
      procedure -= 6;
      clientTrust -= 5;
      updatedInbox.add(
        InboxItemView(
          id: 'partner-brief-missed-day-$nextDay',
          sender: 'Matter partner',
          subject: 'Partner risk brief missed',
          body:
              'The internal risk brief was not delivered by Day 1 at 15:00. Partner oversight, settlement planning, and confidence in the matter team have deteriorated.',
          receivedAt: 'Day $nextDay · 08:00',
          status: InboxStatus.unread,
        ),
      );
    }

    if (newlyMissed.contains('preservation')) {
      procedure -= 12;
      evidenceScore -= 10;
      ethics -= 6;
      clientTrust -= 10;
      updatedInbox.add(
        InboxItemView(
          id: 'preservation-missed-day-$nextDay',
          sender: 'Matter risk system',
          subject: 'Evidence-preservation deadline missed',
          body:
              'No preservation notice was issued by Day 2 at 17:00. Relevant records may now be incomplete, the evidentiary ceiling is reduced, and an adverse inference risk now applies.',
          receivedAt: 'Day $nextDay · 08:00',
          status: InboxStatus.unread,
        ),
      );
    }

    String? missedHearingId;
    for (final String id in newlyMissed) {
      if (id.startsWith('enterprise-court-hearing-')) {
        missedHearingId = id;
        break;
      }
    }
    if (missedHearingId != null) {
      procedure -= 30;
      clientTrust -= 25;
      ethics -= 5;
      nextStage = 'Judgment pending';
      updatedInbox = updatedInbox
          .map(
            (InboxItemView item) => item.id.startsWith('hearing-notice-')
                ? item.copyWith(status: InboxStatus.resolved)
                : item,
          )
          .toList(growable: true)
        ..add(
          InboxItemView(
            id: 'hearing-missed-$missedHearingId',
            sender: 'Enterprise Court Registry',
            subject: 'Mandatory hearing missed',
            body:
                'No attendance was recorded for the scheduled enterprise court hearing. The court may decide the case on the existing record with adverse procedural consequences.',
            receivedAt: 'Day $nextDay · 08:00',
            status: InboxStatus.unread,
          ),
        );

      final (
        List<InboxItemView>,
        List<GameActionView>,
        JuniorReviewStatus
      ) juniorExpiry = _expireJuniorReviewForHearing(
        inbox: updatedInbox,
        actions: updatedActions,
        status: juniorStatus,
        day: nextDay,
        minuteOfDay: 8 * 60,
      );
      updatedInbox = juniorExpiry.$1;
      updatedActions = juniorExpiry.$2;
      juniorStatus = juniorExpiry.$3;
    }

    if (newlyMissed.contains('statement-of-claim')) {
      procedure -= 30;
      clientTrust -= 30;
      ethics -= 8;
      nextStage = 'Resolved';
      caseResultStatus = CaseResultStatus.lostAtFirstInstance;
      engagementStatus = EngagementStatus.completed;
      updatedActions = const <GameActionView>[];
      updatedInbox.add(
        InboxItemView(
          id: 'procedural-default-day-$nextDay',
          sender: 'Enterprise Court Registry',
          subject: 'Claim dismissed by procedural default',
          body:
              'The statement of claim was not filed before the mandatory deadline. The court dismissed the matter without reaching the merits, and the client is considering a fee write-off request.',
          receivedAt: 'Day $nextDay · 08:00',
          status: InboxStatus.unread,
        ),
      );
    }

    if (newlyMissed.contains('appeal-deadline')) {
      nextStage = 'Resolved';
      caseResultStatus = CaseResultStatus.lostAtFirstInstance;
      engagementStatus = EngagementStatus.completed;
      updatedActions = const <GameActionView>[];
      updatedInbox.add(
        InboxItemView(
          id: 'appeal-deadline-expired-day-$nextDay',
          sender: 'Matter risk system',
          subject: 'Appeal deadline expired',
          body:
              'No authorized appeal was filed before the deadline. The first-instance loss is final and the engagement is closed.',
          receivedAt: 'Day $nextDay · 08:00',
          status: InboxStatus.unread,
        ),
      );
    }

    if (newlyMissed.contains('cassation-deadline')) {
      nextStage = 'Resolved';
      caseResultStatus = CaseResultStatus.lostOnAppeal;
      engagementStatus = EngagementStatus.completed;
      updatedActions = const <GameActionView>[];
      updatedInbox.add(
        InboxItemView(
          id: 'cassation-deadline-expired-day-$nextDay',
          sender: 'Matter risk system',
          subject: 'Cassation deadline expired',
          body:
              'No authorized cassation appeal was filed before the deadline. The appellate loss is final and the engagement is closed.',
          receivedAt: 'Day $nextDay · 08:00',
          status: InboxStatus.unread,
        ),
      );
    }

    final bool settlementExpired = _isSettlementExpired(
      day: nextDay,
      minuteOfDay: 8 * 60,
    );

    updatedActions = _withDeadlineActions(
      updatedActions
          .where(
            (GameActionView action) =>
                action.id != 'prepare-partner-brief' &&
                action.id != 'issue-preservation-notice' &&
                (!settlementExpired ||
                    (action.id != 'future-settle' &&
                        action.id != 'reject-settlement')),
          )
          .toList(growable: false),
      updatedDeadlines,
    );

    if (settlementExpired) {
      updatedInbox = updatedInbox
          .map(
            (InboxItemView item) => item.id == 'settlement-offer'
                ? item.copyWith(status: InboxStatus.resolved)
                : item,
          )
          .toList(growable: true)
        ..add(
          InboxItemView(
            id: 'settlement-expired-day-$nextDay',
            sender: 'Opposing counsel',
            subject: 'Settlement offer expired',
            body:
                'The without-prejudice offer expired without acceptance. Decide whether to commence formal proceedings.',
            receivedAt: 'Day $nextDay · 08:00',
            status: InboxStatus.unread,
          ),
        );
    }

    if (_snapshot.stage == 'Pre-litigation' &&
        (_snapshot.settlementOffer == null || settlementExpired)) {
      updatedActions = _ensureAction(
        updatedActions,
        _commenceProceedingsAction(),
      );
    }

    ExpertReviewStatus expertStatus = _snapshot.expertReviewStatus;
    if (expertStatus == ExpertReviewStatus.pending &&
        nextDay >= _snapshot.expertReportDueDay) {
      expertStatus = ExpertReviewStatus.reportReady;
      updatedInbox = updatedInbox
          .map(
            (InboxItemView item) => item.id == 'expert-assignment'
                ? item.copyWith(status: InboxStatus.resolved)
                : item,
          )
          .toList(growable: true)
        ..add(
          InboxItemView(
            id: 'expert-report-ready',
            sender: 'Independent ERP expert',
            subject: 'Technical assessment ready for review',
            body:
                'The report identifies supplier-side architecture and delivery-control failures, but also attributes part of the delay to informal scope changes. Review it before relying on the findings.',
            receivedAt: 'Day $nextDay · 08:00',
            status: InboxStatus.actionRequired,
          ),
        );
      updatedActions = _ensureAction(
        updatedActions,
        _reviewExpertReportAction(),
      );
    }

    final (
      List<InboxItemView>,
      List<GameActionView>,
      JuniorReviewStatus
    ) juniorCompletion = _completeJuniorReviewIfDue(
      inbox: updatedInbox,
      actions: updatedActions,
      status: juniorStatus,
      day: nextDay,
      minuteOfDay: 8 * 60,
    );
    updatedInbox = juniorCompletion.$1;
    updatedActions = juniorCompletion.$2;
    juniorStatus = juniorCompletion.$3;

    if (nextStage == 'Hearing preparation') {
      final DeadlineView? activeHearing = _activeScheduledHearingFrom(
        updatedDeadlines,
      );
      if (activeHearing != null) {
        final (int hearingDay, int hearingMinute) =
            _calendarMoment(activeHearing);
        final bool beforeHearing = nextDay < hearingDay ||
            (nextDay == hearingDay && (8 * 60) < hearingMinute);
        final bool requestAvailable = activeHearing.rescheduleActionId !=
                null &&
            activeHearing.rescheduleStatus == RescheduleRequestStatus.none &&
            _isRescheduleRequestWindowOpenAt(
              activeHearing,
              day: nextDay,
              minuteOfDay: 8 * 60,
            );

        updatedActions = _hearingPreparationActions(
          updatedActions,
          activeHearing,
          inbox: updatedInbox,
          includeWait: beforeHearing,
          includeReschedule: requestAvailable,
        );
      }
    }

    final bool clearSettlementOffer = settlementExpired;
    if (_snapshot.stage == 'Judgment pending') {
      // Hard procedural failures always defeat the claim. Otherwise, the
      // court evaluates a weighted record plus a deterministic seed variance.
      // Preparation matters materially, but cannot rescue a missed filing or
      // mandatory hearing.
      final bool hearingMissed = updatedDeadlines.any(
            (DeadlineView item) =>
                item.isHearing && item.status == DeadlineStatus.missed,
          ) ||
          updatedInbox.any(
            (InboxItemView item) => item.id.startsWith('hearing-missed-'),
          );
      final bool claimFilingMissed = updatedDeadlines.any(
        (DeadlineView item) =>
            item.id == 'statement-of-claim' &&
            item.status == DeadlineStatus.missed,
      );
      final bool hardProceduralDefault = hearingMissed || claimFilingMissed;

      final int preparationScore = (updatedDeadlines.any(
            (DeadlineView item) =>
                item.isHearing && item.status == DeadlineStatus.done,
          )
              ? 20
              : 0) +
          (expertStatus == ExpertReviewStatus.reviewed ? 20 : 0) +
          (juniorStatus == JuniorReviewStatus.reviewed ? 10 : 0) +
          (updatedInbox.any(
            (InboxItemView item) => item.id == 'hearing-strategy-prepared',
          )
              ? 20
              : 0) +
          (updatedInbox.any(
            (InboxItemView item) => item.id == 'key-witness-prepared',
          )
              ? 15
              : 0) +
          (updatedInbox.any(
            (InboxItemView item) => item.id == 'damages-schedule-reconciled',
          )
              ? 15
              : 0);

      final bool preservationMissed = updatedDeadlines.any(
        (DeadlineView item) =>
            item.id == 'preservation' && item.status == DeadlineStatus.missed,
      );
      final int effectiveEvidenceScore = preservationMissed
          ? evidenceScore.clamp(0, 55).toInt()
          : evidenceScore;
      final int criticalMissPenalty = (updatedDeadlines.any(
            (DeadlineView item) =>
                item.id == 'partner-brief' &&
                item.status == DeadlineStatus.missed,
          )
              ? 8
              : 0) +
          (updatedDeadlines.any(
            (DeadlineView item) =>
                item.id == 'preservation' &&
                item.status == DeadlineStatus.missed,
          )
              ? 18
              : 0);
      final int courtVariance = (seed % 31) - 15;
      final int weightedRecord = (((_snapshot.caseStrength * 20) +
                  (_snapshot.merits * 20) +
                  (effectiveEvidenceScore * 20) +
                  (procedure * 20) +
                  (preparationScore * 10) +
                  (clientTrust * 5) +
                  (ethics * 5)) /
              100)
          .round();
      final int outcomeScore =
          weightedRecord - criticalMissPenalty + courtVariance;
      final bool favorable = !hardProceduralDefault && outcomeScore >= 60;
      final bool dismissed = hardProceduralDefault || outcomeScore < 50;

      nextStage = 'Post-judgment';
      caseResultStatus = favorable
          ? CaseResultStatus.wonAtFirstInstance
          : dismissed
              ? CaseResultStatus.lostAtFirstInstance
              : CaseResultStatus.mixedAtFirstInstance;
      engagementStatus = EngagementStatus.awaitingClientInstructions;
      updatedActions = <GameActionView>[_informClientOfJudgmentAction()];
      if (dismissed) {
        clientTrust -= hardProceduralDefault ? 20 : 10;
        ethics -= hardProceduralDefault ? 5 : 0;
      }
      updatedInbox.add(
        InboxItemView(
          id: 'judgment-day-$nextDay',
          sender: 'Enterprise Court Registry',
          subject: favorable
              ? 'Judgment: claim substantially upheld'
              : dismissed
                  ? hardProceduralDefault
                      ? 'Judgment: claim dismissed by procedural default'
                      : 'Judgment: claim dismissed'
                  : 'Judgment: mixed outcome',
          body: favorable
              ? 'The court found material supplier breach and awarded substantial damages. The result reflects a sufficiently strong combined record despite the remaining scope-change and mitigation uncertainty. Decision score $outcomeScore: record $weightedRecord, critical-miss penalty -$criticalMissPenalty, court variance ${courtVariance >= 0 ? '+' : ''}$courtVariance.'
              : dismissed
                  ? hardProceduralDefault
                      ? 'The court dismissed the claim because a mandatory procedural requirement was missed. Hard failures cannot be overridden by the deterministic seed. Decision score $outcomeScore: record $weightedRecord, critical-miss penalty -$criticalMissPenalty, court variance ${courtVariance >= 0 ? '+' : ''}$courtVariance.'
                      : 'The court dismissed the claim despite recorded attendance. Weak evidence, procedure, and hearing preparation did not establish a sufficiently reliable causal and quantum case. Decision score $outcomeScore: record $weightedRecord, preparation $preparationScore, critical-miss penalty -$criticalMissPenalty, court variance ${courtVariance >= 0 ? '+' : ''}$courtVariance.'
                  : 'The court accepted part of the breach case but reduced recovery because causation, scope variation, and proof of loss remained incomplete. Decision score $outcomeScore: record $weightedRecord, preparation $preparationScore, critical-miss penalty -$criticalMissPenalty, court variance ${courtVariance >= 0 ? '+' : ''}$courtVariance.',
          receivedAt: 'Day $nextDay · 08:00',
          status: InboxStatus.actionRequired,
        ),
      );
    } else if (_snapshot.stage == 'Appeal pending') {
      final int appealRecord = (((procedure * 35) +
                  (evidenceScore * 25) +
                  (_snapshot.merits * 20) +
                  (ethics * 10) +
                  (clientTrust * 10)) /
              100)
          .round();
      final int appealRoll = seed % 100;
      final bool appealAllowed = appealRecord >= 50 && appealRoll >= 70;

      if (appealAllowed) {
        nextStage = 'Resolved';
        caseResultStatus = CaseResultStatus.wonOnAppeal;
        engagementStatus = EngagementStatus.completed;
        updatedActions = const <GameActionView>[];
        updatedInbox.add(
          InboxItemView(
            id: 'appeal-outcome-day-$nextDay',
            sender: 'Court of Appeal Registry',
            subject: 'Appeal allowed',
            body:
                'The appellate court set aside the dismissal and granted substantial relief. Appellate record $appealRecord/100; deterministic decision roll $appealRoll/100.',
            receivedAt: 'Day $nextDay · 08:00',
            status: InboxStatus.unread,
          ),
        );
      } else {
        final int cassationDeadlineDay = nextDay + 3;
        nextStage = 'Cassation assessment';
        caseResultStatus = CaseResultStatus.lostOnAppeal;
        engagementStatus = EngagementStatus.awaitingClientInstructions;
        clientTrust -= 5;
        updatedActions = <GameActionView>[
          _assessCassationGroundsAction(),
          _acceptAppellateJudgmentAction(),
        ];
        updatedDeadlines = <DeadlineView>[
          ...updatedDeadlines.where(
            (DeadlineView item) => item.id != 'cassation-deadline',
          ),
          DeadlineView(
            id: 'cassation-deadline',
            title: 'Cassation filing deadline',
            dueAt: 'Day $cassationDeadlineDay · 17:00',
            status: DeadlineStatus.open,
            detail:
                'Assess legal grounds, obtain client authority, and file before the cassation deadline.',
            relatedActionId: 'assess-cassation-grounds',
            missedConsequence:
                'The appellate loss becomes final and the engagement closes.',
          ),
        ];
        updatedInbox.add(
          InboxItemView(
            id: 'appeal-outcome-day-$nextDay',
            sender: 'Court of Appeal Registry',
            subject: 'Appeal dismissed',
            body:
                'The appellate court upheld the first-instance dismissal. Appellate record $appealRecord/100; deterministic decision roll $appealRoll/100.',
            receivedAt: 'Day $nextDay · 08:00',
            status: InboxStatus.unread,
          ),
        );
        updatedInbox.add(
          InboxItemView(
            id: 'cassation-assessment-request',
            sender: 'Client CEO',
            subject: 'Assess cassation options',
            body:
                'The client requests specialist advice on any legal or procedural ground for cassation. Factual disagreement alone is insufficient.',
            receivedAt: 'Day $nextDay · 08:00',
            status: InboxStatus.actionRequired,
          ),
        );
      }
    } else if (_snapshot.stage == 'Post-judgment' &&
        _snapshot.inbox.any(
          (InboxItemView item) => item.id == 'client-judgment-briefed',
        )) {
      final bool favorable = _snapshot.inbox.any(
        (InboxItemView item) =>
            item.id.startsWith('judgment-day-') &&
            item.subject.contains('substantially upheld'),
      );
      final bool dismissed = _snapshot.inbox.any(
        (InboxItemView item) =>
            item.id.startsWith('judgment-day-') &&
            item.subject.contains('claim dismissed'),
      );
      final int cassationRoll = seed % 100;
      final bool counterpartySeeksCassation = favorable && cassationRoll < 35;

      if (counterpartySeeksCassation) {
        nextStage = 'Cassation response';
        updatedActions = <GameActionView>[_prepareCassationResponseAction()];
        updatedInbox.add(
          InboxItemView(
            id: 'counterparty-cassation-day-$nextDay',
            sender: 'Court of Cassation Registry',
            subject: 'Counterparty filed a cassation challenge',
            body:
                'The supplier challenges alleged legal errors in the judgment. Prepare a focused response on the legal grounds; the review does not reopen the factual record in this simplified scenario.',
            receivedAt: 'Day $nextDay · 08:00',
            status: InboxStatus.actionRequired,
          ),
        );
      } else if (dismissed) {
        final int appealDeadlineDay = nextDay + 3;
        nextStage = 'Appeal assessment';
        caseResultStatus = CaseResultStatus.lostAtFirstInstance;
        engagementStatus = EngagementStatus.awaitingClientInstructions;
        updatedActions = <GameActionView>[
          _prepareAppealAdviceAction(),
          _acceptJudgmentAndCloseAction(),
        ];
        updatedDeadlines = <DeadlineView>[
          ...updatedDeadlines.where(
            (DeadlineView item) => item.id != 'appeal-deadline',
          ),
          DeadlineView(
            id: 'appeal-deadline',
            title: 'Appeal filing deadline',
            dueAt: 'Day $appealDeadlineDay · 17:00',
            status: DeadlineStatus.open,
            detail:
                'Prepare advice, obtain client authority, and file before the appellate deadline.',
            relatedActionId: 'prepare-appeal-advice',
            missedConsequence:
                'The first-instance loss becomes final and the engagement closes.',
          ),
        ];
        updatedInbox.add(
          InboxItemView(
            id: 'appeal-advice-request',
            sender: 'Client CEO',
            subject: 'Prepare appeal advice',
            body:
                'The client requests a candid assessment of appellate grounds, cost, timing, and prospects before deciding whether to continue.',
            receivedAt: 'Day $nextDay · 08:00',
            status: InboxStatus.actionRequired,
          ),
        );
      } else {
        nextStage = 'Resolved';
        updatedActions = const <GameActionView>[];
        updatedInbox.add(
          InboxItemView(
            id: 'judgment-finality-day-$nextDay',
            sender: 'Matter team',
            subject: 'No further challenge received',
            body:
                'No counterparty review challenge was received in the demo decision window. The matter is treated as resolved.',
            receivedAt: 'Day $nextDay · 08:00',
            status: InboxStatus.unread,
          ),
        );
      }
    } else if (_snapshot.stage == 'Cassation pending') {
      final bool claimantCassation = updatedInbox.any(
        (InboxItemView item) => item.id == 'claimant-cassation-filed',
      );

      if (claimantCassation) {
        final int decisionRoll = seed % 100;
        final bool quashedAndRemitted = procedure >= 40 && decisionRoll < 30;
        nextStage = 'Resolved';
        caseResultStatus = quashedAndRemitted
            ? CaseResultStatus.remittedAfterCassation
            : CaseResultStatus.lostOnAppeal;
        engagementStatus = EngagementStatus.completed;
        updatedActions = const <GameActionView>[];
        updatedInbox.add(
          InboxItemView(
            id: 'claimant-cassation-outcome-day-$nextDay',
            sender: 'Court of Cassation Registry',
            subject: quashedAndRemitted
                ? 'Decision quashed and remitted'
                : 'Cassation appeal dismissed',
            body: quashedAndRemitted
                ? 'The court accepted the legal ground, quashed the appellate decision, and remitted the matter for rehearing. The factual merits were not finally determined. Deterministic decision roll $decisionRoll/100.'
                : 'The court rejected the asserted legal ground. The appellate loss remains final. Deterministic decision roll $decisionRoll/100.',
            receivedAt: 'Day $nextDay · 08:00',
            status: InboxStatus.unread,
          ),
        );
      } else {
        final int decisionRoll = (seed + (nextDay * 29) + procedure) % 100;
        final bool challengeDismissed = decisionRoll < 75;
        nextStage = 'Resolved';
        engagementStatus = EngagementStatus.completed;
        updatedActions = const <GameActionView>[];
        updatedInbox.add(
          InboxItemView(
            id: 'cassation-outcome-day-$nextDay',
            sender: 'Court of Cassation Registry',
            subject: challengeDismissed
                ? 'Cassation challenge dismissed'
                : 'Limited cassation review admitted',
            body: challengeDismissed
                ? 'The counterparty challenge was dismissed in this deterministic demo branch. The enterprise-court judgment remains in place.'
                : 'A limited legal issue was admitted for review in this deterministic demo branch. The mobile vertical slice closes here with the matter flagged for specialist follow-up.',
            receivedAt: 'Day $nextDay · 08:00',
            status: InboxStatus.unread,
          ),
        );
      }
    }

    if (nextStage == 'Resolved') {
      if (engagementStatus != EngagementStatus.terminatedByClient) {
        engagementStatus = EngagementStatus.completed;
      }
      if (juniorStatus == JuniorReviewStatus.inProgress ||
          juniorStatus == JuniorReviewStatus.findingsReady) {
        juniorStatus = JuniorReviewStatus.expired;
      }
      if (expertStatus == ExpertReviewStatus.pending ||
          expertStatus == ExpertReviewStatus.reportReady) {
        expertStatus = ExpertReviewStatus.expired;
      }

      updatedDeadlines = _finalizeDeadlinesForClosure(updatedDeadlines);
      updatedInbox = _finalizeInboxForClosure(
        inbox: updatedInbox,
        closedAt: 'Day $nextDay · 08:00',
      );
      updatedActions = const <GameActionView>[];
      outcomeSummary = _buildOutcomeSummary(
        inbox: updatedInbox,
        deadlines: updatedDeadlines,
        closedAt: 'Day $nextDay · 08:00',
        expertStatus: expertStatus,
        juniorStatus: juniorStatus,
      );
    }

    _snapshot = _snapshot.copyWith(
      dayLabel: 'Day $nextDay',
      timeLabel: '08:00',
      stage: nextStage,
      caseResultStatus: caseResultStatus,
      engagementStatus: engagementStatus,
      fatigue: 0,
      cumulativeStrain: (_snapshot.cumulativeStrain - 2).clamp(0, 100).toInt(),
      procedure: procedure.clamp(0, 100).toInt(),
      evidenceScore: evidenceScore.clamp(0, 100).toInt(),
      ethics: ethics.clamp(0, 100).toInt(),
      clientTrust: clientTrust.clamp(0, 100).toInt(),
      inactivityMinutes: _snapshot.inactivityMinutes + _restInactivityMinutes,
      expertReviewStatus: expertStatus,
      juniorReviewStatus: juniorStatus,
      deadlines: updatedDeadlines,
      inbox: updatedInbox,
      actions: updatedActions,
      outcomeSummary: outcomeSummary,
      clearSettlementOffer: clearSettlementOffer,
    );
    _applyInactivityConsequences();
    notifyListeners();
  }

  int _currentDayNumber() {
    final RegExpMatch? match = RegExp(
      r'^Day\s+(\d+)$',
    ).firstMatch(_snapshot.dayLabel);
    return int.tryParse(match?.group(1) ?? '') ?? 1;
  }

  int _minuteOfDay(String timeLabel) {
    final List<String> parts = timeLabel.split(':');
    if (parts.length != 2) {
      return 0;
    }
    final int hour = int.tryParse(parts[0]) ?? 0;
    final int minute = int.tryParse(parts[1]) ?? 0;
    return (hour * 60) + minute;
  }

  bool _isSettlementExpired({
    required int day,
    required int minuteOfDay,
  }) {
    final SettlementOfferView? offer = _snapshot.settlementOffer;
    if (offer == null) {
      return false;
    }

    final RegExpMatch? match = RegExp(
      r'^Day\s+(\d+)\s+·\s+(\d{2}):(\d{2})$',
    ).firstMatch(offer.expiresAt);
    if (match == null) {
      return false;
    }

    final int expiryDay = int.tryParse(match.group(1) ?? '') ?? day;
    final int expiryHour = int.tryParse(match.group(2) ?? '') ?? 0;
    final int expiryMinute = int.tryParse(match.group(3) ?? '') ?? 0;
    final int expiryMinuteOfDay = (expiryHour * 60) + expiryMinute;

    return day > expiryDay ||
        (day == expiryDay && minuteOfDay > expiryMinuteOfDay);
  }

  String _formatMinuteOfDay(int minuteOfDay) {
    final int normalized = minuteOfDay % (24 * 60);
    final int hour = normalized ~/ 60;
    final int minute = normalized % 60;
    return '${hour.toString().padLeft(2, '0')}:'
        '${minute.toString().padLeft(2, '0')}';
  }

  static (int, int) _calendarMoment(DeadlineView item) {
    final RegExpMatch? match = RegExp(
      r'^Day\s+(\d+)\s+·\s+(\d{2}):(\d{2})$',
    ).firstMatch(item.dueAt);
    if (match == null) {
      return (999999, 0);
    }

    final int day = int.tryParse(match.group(1) ?? '') ?? 999999;
    final int hour = int.tryParse(match.group(2) ?? '') ?? 0;
    final int minute = int.tryParse(match.group(3) ?? '') ?? 0;
    return (day, (hour * 60) + minute);
  }

  DeadlineView? _activeScheduledHearing() {
    return _activeScheduledHearingFrom(_snapshot.deadlines);
  }

  static DeadlineView? _activeScheduledHearingFrom(
    List<DeadlineView> deadlines,
  ) {
    for (final DeadlineView item in deadlines) {
      if (item.isHearing && item.status == DeadlineStatus.scheduled) {
        return item;
      }
    }
    return null;
  }

  List<DeadlineView> _replaceCalendarItem(DeadlineView replacement) {
    return _snapshot.deadlines
        .map(
          (DeadlineView item) => item.id == replacement.id ? replacement : item,
        )
        .toList(growable: false);
  }

  bool _isRescheduleRequestWindowOpen(DeadlineView hearing) {
    return _isRescheduleRequestWindowOpenAt(
      hearing,
      day: _currentDayNumber(),
      minuteOfDay: _minuteOfDay(_snapshot.timeLabel),
    );
  }

  static bool _isRescheduleRequestWindowOpenAt(
    DeadlineView hearing, {
    required int day,
    required int minuteOfDay,
  }) {
    final (int dueDay, _) = _calendarMoment(hearing);
    final int cutoffDay = dueDay - 1;
    const int cutoffMinute = 12 * 60;
    return day < cutoffDay || (day == cutoffDay && minuteOfDay <= cutoffMinute);
  }

  bool _isHearingAttendanceWindowOpen() {
    final DeadlineView? hearing = _activeScheduledHearing();
    if (hearing == null || _snapshot.stage != 'Hearing preparation') {
      return false;
    }

    final (int dueDay, int dueMinute) = _calendarMoment(hearing);
    final int currentDay = _currentDayNumber();
    final int currentMinute = _minuteOfDay(_snapshot.timeLabel);
    return currentDay == dueDay &&
        currentMinute >= dueMinute &&
        currentMinute <= dueMinute + (6 * 60);
  }

  static (List<DeadlineView>, List<InboxItemView>)
      _resolvePendingHearingRequest({
    required List<DeadlineView> deadlines,
    required List<InboxItemView> inbox,
    required int day,
  }) {
    DeadlineView? pending;
    for (final DeadlineView item in deadlines) {
      if (item.isHearing &&
          item.status == DeadlineStatus.scheduled &&
          item.rescheduleStatus == RescheduleRequestStatus.pending &&
          item.rescheduleDecisionDay <= day) {
        pending = item;
        break;
      }
    }

    if (pending == null) {
      return (deadlines, inbox);
    }

    final (int dueDay, _) = _calendarMoment(pending);
    final bool granted = pending.rescheduleRequestCount == 1 &&
        pending.rescheduleRequestedDay <= dueDay - 1;

    if (!granted) {
      final DeadlineView denied = pending.copyWith(
        rescheduleStatus: RescheduleRequestStatus.denied,
        clearRescheduleActionId: true,
      );
      return (
        deadlines
            .map(
              (DeadlineView item) => item.id == denied.id ? denied : item,
            )
            .toList(growable: false),
        <InboxItemView>[
          ...inbox,
          InboxItemView(
            id: 'hearing-reschedule-denied-${pending.id}',
            sender: 'Enterprise Court Registry',
            subject: 'Hearing postponement request denied',
            body:
                'The court did not find sufficient grounds to move the hearing. The original date ${pending.dueAt} remains binding.',
            receivedAt: 'Day $day · 08:00',
            status: InboxStatus.unread,
          ),
        ],
      );
    }

    final String replacementId =
        'enterprise-court-hearing-${pending.rescheduleRequestCount + 1}';
    final int replacementDay = dueDay + 4;
    final String replacementDate = 'Day $replacementDay · 14:00';

    final DeadlineView original = pending.copyWith(
      status: DeadlineStatus.rescheduled,
      rescheduleStatus: RescheduleRequestStatus.granted,
      replacementItemId: replacementId,
      clearRelatedActionId: true,
      clearRescheduleActionId: true,
    );
    final DeadlineView replacement = DeadlineView(
      id: replacementId,
      title: pending.title,
      dueAt: replacementDate,
      status: DeadlineStatus.scheduled,
      kind: CalendarItemKind.mandatoryEvent,
      detail: pending.detail,
      relatedActionId: 'attend-hearing',
      rescheduleRequestCount: pending.rescheduleRequestCount,
      missedConsequence: pending.missedConsequence,
    );

    final List<DeadlineView> updatedDeadlines = <DeadlineView>[
      ...deadlines.map(
        (DeadlineView item) => item.id == original.id ? original : item,
      ),
      replacement,
    ];
    final List<InboxItemView> updatedInbox = <InboxItemView>[
      ...inbox.map(
        (InboxItemView item) => item.id.startsWith('hearing-notice-')
            ? item.copyWith(status: InboxStatus.resolved)
            : item,
      ),
      InboxItemView(
        id: 'hearing-reschedule-granted-${pending.id}',
        sender: 'Enterprise Court Registry',
        subject: 'Hearing postponement granted',
        body:
            'The hearing at ${pending.dueAt} has been vacated. The replacement enterprise court hearing is scheduled for $replacementDate.',
        receivedAt: 'Day $day · 08:00',
        status: InboxStatus.unread,
      ),
      InboxItemView(
        id: 'hearing-notice-${pending.rescheduleRequestCount + 1}',
        sender: 'Enterprise Court Registry',
        subject: 'Replacement enterprise court hearing scheduled',
        body:
            'The replacement hearing is scheduled for $replacementDate. Attendance is mandatory.',
        receivedAt: 'Day $day · 08:00',
        status: InboxStatus.unread,
      ),
    ];
    return (updatedDeadlines, updatedInbox);
  }

  bool _isDeadlineOpen(String deadlineId) {
    return _snapshot.deadlines.any(
      (DeadlineView deadline) =>
          deadline.id == deadlineId && deadline.status == DeadlineStatus.open,
    );
  }

  bool _isAfterDeadline({
    required String deadlineId,
    required int day,
    required int minuteOfDay,
  }) {
    final DeadlineView deadline = _snapshot.deadlines.firstWhere(
      (DeadlineView item) => item.id == deadlineId,
    );
    final (int dueDay, int dueMinute) = _calendarMoment(deadline);
    return day > dueDay || (day == dueDay && minuteOfDay > dueMinute);
  }

  static List<DeadlineView> _markOverdueDeadlines(
    List<DeadlineView> deadlines, {
    required int day,
    required int minuteOfDay,
  }) {
    return deadlines.map((DeadlineView deadline) {
      final bool active = deadline.status == DeadlineStatus.open ||
          deadline.status == DeadlineStatus.scheduled;
      if (!active) {
        return deadline;
      }
      final (int dueDay, int dueMinute) = _calendarMoment(deadline);
      int effectiveDueDay = dueDay;
      int effectiveDueMinute = dueMinute;
      if (deadline.isHearing) {
        effectiveDueMinute += _hearingAttendanceGraceMinutes;
        effectiveDueDay += effectiveDueMinute ~/ (24 * 60);
        effectiveDueMinute %= 24 * 60;
      }
      final bool overdue = day > effectiveDueDay ||
          (day == effectiveDueDay && minuteOfDay > effectiveDueMinute);
      return overdue
          ? deadline.copyWith(
              status: DeadlineStatus.missed,
              clearRelatedActionId: deadline.isHearing,
              clearRescheduleActionId: deadline.isHearing,
            )
          : deadline;
    }).toList(growable: false);
  }

  static bool _deadlineBecameMissed({
    required List<DeadlineView> before,
    required List<DeadlineView> after,
    required String deadlineId,
  }) {
    final DeadlineStatus beforeStatus =
        before.firstWhere((DeadlineView item) => item.id == deadlineId).status;
    final DeadlineStatus afterStatus =
        after.firstWhere((DeadlineView item) => item.id == deadlineId).status;
    final bool wasActive = beforeStatus == DeadlineStatus.open ||
        beforeStatus == DeadlineStatus.scheduled;
    return wasActive && afterStatus == DeadlineStatus.missed;
  }

  static Set<String> _newlyMissedDeadlineIds({
    required List<DeadlineView> before,
    required List<DeadlineView> after,
  }) {
    final Map<String, DeadlineStatus> beforeStatuses = <String, DeadlineStatus>{
      for (final DeadlineView deadline in before) deadline.id: deadline.status,
    };
    return after
        .where((DeadlineView deadline) {
          final DeadlineStatus? previous = beforeStatuses[deadline.id];
          final bool wasActive = previous == DeadlineStatus.open ||
              previous == DeadlineStatus.scheduled;
          return deadline.status == DeadlineStatus.missed && wasActive;
        })
        .map((DeadlineView deadline) => deadline.id)
        .toSet();
  }

  List<DeadlineView> _setDeadlineStatus(
    String deadlineId,
    DeadlineStatus status,
  ) {
    return _snapshot.deadlines
        .map(
          (DeadlineView deadline) => deadline.id == deadlineId
              ? deadline.copyWith(status: status)
              : deadline,
        )
        .toList(growable: false);
  }

  void _markDeadlineMissed(String deadlineId) {
    final bool preservation = deadlineId == 'preservation';
    _snapshot = _snapshot.copyWith(
      deadlines: _setDeadlineStatus(deadlineId, DeadlineStatus.missed),
      procedure:
          (_snapshot.procedure - (preservation ? 12 : 6)).clamp(0, 100).toInt(),
      evidenceScore: (_snapshot.evidenceScore - (preservation ? 10 : 0))
          .clamp(0, 100)
          .toInt(),
      ethics: (_snapshot.ethics - (preservation ? 6 : 0)).clamp(0, 100).toInt(),
      clientTrust: (_snapshot.clientTrust - (preservation ? 10 : 5))
          .clamp(0, 100)
          .toInt(),
      actions: _snapshot.actions
          .where(
            (GameActionView action) =>
                action.id !=
                (preservation
                    ? 'issue-preservation-notice'
                    : 'prepare-partner-brief'),
          )
          .toList(growable: false),
    );
    notifyListeners();
  }

  static List<GameActionView> _withDeadlineActions(
    List<GameActionView> base,
    List<DeadlineView> deadlines,
  ) {
    List<GameActionView> result = <GameActionView>[...base];
    for (final DeadlineView deadline in deadlines) {
      if (deadline.status != DeadlineStatus.open) {
        continue;
      }
      switch (deadline.relatedActionId) {
        case 'prepare-partner-brief':
          result = _ensureAction(result, _partnerBriefAction());
          break;
        case 'issue-preservation-notice':
          result = _ensureAction(result, _preservationNoticeAction());
          break;
        case 'prepare-statement-of-claim':
          result = _ensureAction(result, _prepareStatementOfClaimAction());
          break;
        case 'prepare-appeal-advice':
          result = _ensureAction(result, _prepareAppealAdviceAction());
          break;
        case 'seek-client-appeal-authorization':
          result = _ensureAction(
            result,
            _seekClientAppealAuthorizationAction(),
          );
          break;
        case 'file-appeal':
          result = _ensureAction(result, _fileAppealAction());
          break;
        case 'assess-cassation-grounds':
          result = _ensureAction(result, _assessCassationGroundsAction());
          break;
        case 'seek-client-cassation-authorization':
          result = _ensureAction(
            result,
            _seekClientCassationAuthorizationAction(),
          );
          break;
        case 'file-cassation-appeal':
          result = _ensureAction(result, _fileCassationAppealAction());
          break;
        case null:
          break;
        default:
          break;
      }
    }
    return result;
  }

  static List<GameActionView> _hearingPreparationActions(
    List<GameActionView> base,
    DeadlineView hearing, {
    required List<InboxItemView> inbox,
    bool includeWait = true,
    bool includeReschedule = true,
  }) {
    List<GameActionView> result = <GameActionView>[...base];

    bool hasInboxItem(String id) =>
        inbox.any((InboxItemView item) => item.id == id);

    if (!hasInboxItem('hearing-strategy-prepared')) {
      result = _ensureAction(result, _prepareHearingStrategyAction());
    }
    if (!hasInboxItem('key-witness-prepared')) {
      result = _ensureAction(result, _prepareKeyWitnessAction());
    }
    if (!hasInboxItem('damages-schedule-reconciled')) {
      result = _ensureAction(result, _reconcileDamagesScheduleAction());
    }
    if (includeWait) {
      result = _ensureAction(result, _waitUntilHearingAction(hearing.dueAt));
    }
    if (includeReschedule && hearing.rescheduleActionId != null) {
      result = _ensureAction(
        result,
        _requestHearingRescheduleAction(hearing.dueAt),
      );
    }
    return result;
  }

  static List<GameActionView> _ensureAction(
    List<GameActionView> actions,
    GameActionView candidate,
  ) {
    if (actions.any((GameActionView action) => action.id == candidate.id)) {
      return actions;
    }
    return <GameActionView>[...actions, candidate];
  }

  List<GameActionView> _ensureAiDamagesAction(
    List<GameActionView> actions,
    int knownFactsRevision,
  ) {
    if (_snapshot.aiDamagesModelRevision >= knownFactsRevision ||
        _snapshot.stage == 'Resolved') {
      return actions;
    }
    return _ensureAction(actions, _aiDamagesAction());
  }

  static GameActionView _reviewJuniorFindingsAction() {
    return const GameActionView(
      id: 'review-junior-findings',
      title: 'Review junior document findings',
      description:
          'Validate the first-pass chronology, risk flags, and source references before relying on them.',
      timeLabel: '1h 30m',
      costEur: 0,
      tone: ActionTone.neutral,
    );
  }

  static List<DeadlineView> _openedDeadlines() {
    return const <DeadlineView>[
      DeadlineView(
        id: 'partner-brief',
        title: 'Partner risk brief',
        dueAt: 'Day 1 · 15:00',
        status: DeadlineStatus.open,
        detail: 'Merits, evidence gaps, budget, and settlement range.',
        relatedActionId: 'prepare-partner-brief',
        missedConsequence:
            'Procedure -6 and client trust -5 because partner oversight was not documented in time.',
      ),
      DeadlineView(
        id: 'preservation',
        title: 'Evidence-preservation notice',
        dueAt: 'Day 2 · 17:00',
        status: DeadlineStatus.open,
        detail: 'Preserve project mailboxes, tickets, and acceptance records.',
        relatedActionId: 'issue-preservation-notice',
        missedConsequence:
            'Procedure -12, evidence -10, ethics -6, and client trust -10 because records may be incomplete or challenged.',
      ),
    ];
  }

  static GameActionView _commenceProceedingsAction() {
    return const GameActionView(
      id: 'commence-proceedings',
      title: 'Commence proceedings',
      description:
          'File the originating application and move the dispute into formal pleadings.',
      timeLabel: '3h',
      costEur: 2500,
      tone: ActionTone.primary,
    );
  }

  static GameActionView _prepareStatementOfClaimAction() {
    return const GameActionView(
      id: 'prepare-statement-of-claim',
      title: 'Prepare and file statement of claim',
      description:
          'Define the pleaded breach, causation case, damages, and requested relief.',
      timeLabel: '4h',
      costEur: 1250,
      tone: ActionTone.primary,
    );
  }

  static GameActionView _prepareEvidenceBundleAction() {
    return const GameActionView(
      id: 'prepare-evidence-bundle',
      title: 'Prepare and file evidence bundle',
      description:
          'Organize the contract, correspondence, acceptance record, and expert findings for hearing.',
      timeLabel: '4h',
      costEur: 1500,
      tone: ActionTone.primary,
    );
  }

  static GameActionView _prepareHearingStrategyAction() {
    return const GameActionView(
      id: 'prepare-hearing-strategy',
      title: 'Prepare hearing strategy memorandum',
      description:
          'Map the oral theory, likely judicial questions, weak points, and fallback submissions.',
      timeLabel: '2h',
      costEur: 750,
      tone: ActionTone.primary,
    );
  }

  static GameActionView _prepareKeyWitnessAction() {
    return const GameActionView(
      id: 'prepare-key-witness',
      title: 'Prepare client key witness',
      description:
          'Review the chronology, documents, and likely challenge themes without scripting evidence.',
      timeLabel: '2h',
      costEur: 900,
      tone: ActionTone.primary,
    );
  }

  static GameActionView _reconcileDamagesScheduleAction() {
    return const GameActionView(
      id: 'reconcile-damages-schedule',
      title: 'Reconcile damages schedule',
      description:
          'Tie invoices, replacement costs, mitigation, and expert findings to the pleaded quantum.',
      timeLabel: '2h',
      costEur: 650,
      tone: ActionTone.neutral,
    );
  }

  static GameActionView _informClientOfJudgmentAction() {
    return const GameActionView(
      id: 'inform-client-judgment',
      title: 'Inform client and explain judgment',
      description:
          'Brief the client on the outcome, damages, enforcement considerations, and further-review risk.',
      timeLabel: '1h',
      costEur: 0,
      tone: ActionTone.primary,
    );
  }

  static GameActionView _prepareAppealAdviceAction() {
    return const GameActionView(
      id: 'prepare-appeal-advice',
      title: 'Prepare appeal advice',
      description:
          'Separate appealable errors from disagreement with the evidence and quantify cost, timing, and prospects.',
      timeLabel: '3h',
      costEur: 1200,
      tone: ActionTone.warning,
    );
  }

  static GameActionView _seekClientAppealAuthorizationAction() {
    return const GameActionView(
      id: 'seek-client-appeal-authorization',
      title: 'Request client authorization to appeal',
      description:
          'Present the recommendation and obtain express authority before filing.',
      timeLabel: '30m',
      costEur: 0,
      tone: ActionTone.primary,
    );
  }

  static GameActionView _acceptJudgmentAndCloseAction() {
    return const GameActionView(
      id: 'accept-judgment-and-close',
      title: 'Accept first-instance judgment and close',
      description:
          'Recommend no appeal and close the matter with the loss recorded.',
      timeLabel: '30m',
      costEur: 0,
      tone: ActionTone.neutral,
    );
  }

  static GameActionView _fileAppealAction() {
    return const GameActionView(
      id: 'file-appeal',
      title: 'File appeal',
      description:
          'File the authorized challenge on the assessed appellate grounds.',
      timeLabel: '6h',
      costEur: 4000,
      tone: ActionTone.warning,
      riskNote:
          'An appeal adds material cost and can preserve the loss if the grounds do not overcome the record.',
    );
  }

  static GameActionView _awaitAppealDecisionAction() {
    return const GameActionView(
      id: 'await-appeal-decision',
      title: 'Await appeal decision',
      description: 'Advance the simulation to the appellate judgment update.',
      timeLabel: 'Until decision update',
      costEur: 0,
      tone: ActionTone.primary,
    );
  }

  static GameActionView _assessCassationGroundsAction() {
    return const GameActionView(
      id: 'assess-cassation-grounds',
      title: 'Assess cassation grounds',
      description:
          'Obtain specialist advice on legal and procedural errors without reopening the facts.',
      timeLabel: '4h',
      costEur: 2500,
      tone: ActionTone.warning,
    );
  }

  static GameActionView _seekClientCassationAuthorizationAction() {
    return const GameActionView(
      id: 'seek-client-cassation-authorization',
      title: 'Request client authorization for cassation',
      description:
          'Present the specialist opinion and obtain express authority before filing.',
      timeLabel: '30m',
      costEur: 0,
      tone: ActionTone.primary,
    );
  }

  static GameActionView _acceptAppellateJudgmentAction() {
    return const GameActionView(
      id: 'accept-appellate-judgment',
      title: 'Accept appellate judgment and close',
      description:
          'Recommend no cassation appeal and close the matter with the appellate loss recorded.',
      timeLabel: '30m',
      costEur: 0,
      tone: ActionTone.neutral,
    );
  }

  static GameActionView _fileCassationAppealAction() {
    return const GameActionView(
      id: 'file-cassation-appeal',
      title: 'File cassation appeal',
      description:
          'File the authorized challenge on the identified legal ground.',
      timeLabel: '5h',
      costEur: 6000,
      tone: ActionTone.danger,
      riskNote:
          'Cassation reviews legality, not the factual record, and may result only in dismissal or remittal.',
    );
  }

  static GameActionView _prepareCassationResponseAction() {
    return const GameActionView(
      id: 'prepare-cassation-response',
      title: 'Prepare response to cassation challenge',
      description:
          'Address the counterparty legal grounds and preserve the enterprise-court judgment.',
      timeLabel: '4h',
      costEur: 2500,
      tone: ActionTone.warning,
      riskNote:
          'This simplified demo branch models a legal-review challenge rather than a retrial of facts.',
    );
  }

  static GameActionView _awaitCassationDecisionAction() {
    return const GameActionView(
      id: 'await-cassation-decision',
      title: 'Await Court of Cassation decision',
      description:
          'Advance the simulation to the next cassation update after the response has been filed.',
      timeLabel: 'Until decision update',
      costEur: 0,
      tone: ActionTone.primary,
    );
  }

  static GameActionView _attendHearingAction() {
    return const GameActionView(
      id: 'attend-hearing',
      title: 'Attend enterprise court hearing',
      description:
          'Present the pleaded case, answer judicial questions, and address the supplier defence.',
      timeLabel: '6h',
      costEur: 0,
      tone: ActionTone.warning,
      riskNote:
          'The hearing outcome depends on merits, evidence, procedure, and the record created so far.',
    );
  }

  static GameActionView _requestHearingRescheduleAction(String hearingDate) {
    return GameActionView(
      id: 'request-hearing-reschedule',
      title: 'Request hearing rescheduling',
      description:
          'Ask the court to move the hearing currently scheduled for $hearingDate and propose a later date.',
      timeLabel: '1h 30m',
      costEur: 600,
      tone: ActionTone.warning,
      riskNote:
          'The original hearing remains mandatory until the court grants the request.',
    );
  }

  static GameActionView _waitUntilHearingAction(String hearingDate) {
    return GameActionView(
      id: 'wait-until-hearing',
      title: 'Advance clock to enterprise court hearing',
      description:
          'Advance directly to the scheduled attendance window at $hearingDate. Unfinished optional preparation is skipped.',
      timeLabel: 'To hearing',
      costEur: 0,
      tone: ActionTone.neutral,
    );
  }

  static GameActionView _partnerBriefAction() {
    return const GameActionView(
      id: 'prepare-partner-brief',
      title: 'Prepare partner risk brief',
      description:
          'Document merits, evidence gaps, budget exposure, and settlement range before the internal deadline.',
      timeLabel: '2h',
      costEur: 0,
      tone: ActionTone.primary,
    );
  }

  static GameActionView _preservationNoticeAction() {
    return const GameActionView(
      id: 'issue-preservation-notice',
      title: 'Issue evidence-preservation notice',
      description:
          'Place project mailboxes, tickets, acceptance records, and escalation logs on legal hold.',
      timeLabel: '1h',
      costEur: 250,
      tone: ActionTone.primary,
    );
  }

  static GameActionView _reviewExpertReportAction() {
    return const GameActionView(
      id: 'review-expert-report',
      title: 'Review independent expert report',
      description:
          'Validate the technical findings before adding them to the evidentiary record.',
      timeLabel: '2h',
      costEur: 0,
      tone: ActionTone.primary,
    );
  }

  static GameActionView _aiDamagesAction() {
    return const GameActionView(
      id: 'future-damages',
      title: 'Ask AI associate for updated damages model',
      description:
          'Recalculate risk-adjusted value using the newly reviewed expert findings.',
      timeLabel: '1h 30m',
      costEur: 750,
      tone: ActionTone.neutral,
    );
  }

  static GameSnapshot _initial(int seed) {
    return GameSnapshot(
      version: '0.5.0-alpha.4 remedies and variable live clock',
      seed: seed,
      mode: 'Assisted',
      dayLabel: 'Day 1',
      timeLabel: '08:00',
      stage: 'Intake',
      caseResultStatus: CaseResultStatus.ongoing,
      engagementStatus: EngagementStatus.active,
      matterTitle: 'The Failed ERP Implementation',
      caseStrength: 43,
      merits: 52,
      evidenceScore: 28,
      procedure: 55,
      leverage: 35,
      spendEur: 0,
      authorizedBudgetEur: 25000,
      billableMinutes: 0,
      fatigue: 0,
      cumulativeStrain: 0,
      ethics: 70,
      clientTrust: 50,
      inactivityMinutes: 0,
      clientWarningLevel: 0,
      aiRequestsUsed: 0,
      aiRequestLimit: 5,
      knownFactsRevision: 1,
      aiLegalResearchRevision: 0,
      aiDamagesModelRevision: 0,
      expertReviewStatus: ExpertReviewStatus.notCommissioned,
      expertReportDueDay: 0,
      juniorReviewStatus: JuniorReviewStatus.notDelegated,
      juniorReviewDueDay: 0,
      juniorReviewDueMinute: 0,
      inbox: const <InboxItemView>[
        InboxItemView(
          id: 'opening-request',
          sender: 'Client CEO',
          subject: 'Urgent: ERP supplier termination notice',
          body:
              'Our ERP supplier terminated the project and denies responsibility. We estimate losses of EUR 240,000. Some requirements changed, but the system still failed. Can you take the case?',
          receivedAt: 'Day 1 · 08:00',
          status: InboxStatus.actionRequired,
        ),
      ],
      deadlines: const <DeadlineView>[],
      evidence: const <EvidenceView>[
        EvidenceView(
          id: 'contract',
          title: 'Signed implementation agreement',
          detail: 'The only verified document currently available.',
          reliability: 90,
          isAdverse: false,
        ),
      ],
      actions: const <GameActionView>[
        GameActionView(
          id: 'run-conflict-check',
          title: 'Run conflict check',
          description:
              'Verify whether the firm can ethically accept the client.',
          timeLabel: '1h',
          costEur: 350,
          tone: ActionTone.primary,
        ),
        GameActionView(
          id: 'accept-immediately',
          title: 'Accept matter immediately',
          description: 'Secure the client before completing formal checks.',
          timeLabel: '15m',
          costEur: 0,
          tone: ActionTone.warning,
          riskNote: 'Skips a professional safeguard and weakens procedure.',
        ),
        GameActionView(
          id: 'ask-ai-research',
          title: 'Ask AI associate for legal research',
          description:
              'Receive a limited issue list that still requires verification.',
          timeLabel: '1h 30m',
          costEur: 750,
          tone: ActionTone.neutral,
        ),
      ],
      latestAiNote: null,
    );
  }

  static List<GameActionView> _investigationActions({
    required bool includeAiResearch,
    required bool includePartnerBrief,
    required bool includePreservationNotice,
  }) {
    return <GameActionView>[
      const GameActionView(
        id: 'reply-cfo',
        title: 'Reply to client CFO',
        description: 'Set expectations and explain the evidence-first plan.',
        timeLabel: '30m',
        costEur: 0,
        tone: ActionTone.primary,
      ),
      const GameActionView(
        id: 'request-documents',
        title: 'Request and review full document set',
        description:
            'Review the contract, changes, acceptance, and correspondence.',
        timeLabel: '8h',
        costEur: 2000,
        tone: ActionTone.primary,
      ),
      const GameActionView(
        id: 'delegate-review',
        title: 'Delegate first-pass review',
        description:
            'Use a junior associate while retaining validation responsibility.',
        timeLabel: '1h',
        costEur: 1800,
        tone: ActionTone.neutral,
      ),
      if (includeAiResearch)
        const GameActionView(
          id: 'ask-ai-research',
          title: 'Ask AI associate for legal research',
          description:
              'Identify issues and authorities that require human verification.',
          timeLabel: '1h 30m',
          costEur: 750,
          tone: ActionTone.neutral,
        ),
      if (includePartnerBrief) _partnerBriefAction(),
      if (includePreservationNotice) _preservationNoticeAction(),
      const GameActionView(
        id: 'rest',
        title: 'Rest until next workday',
        description:
            'Recover acute fatigue while deadlines and events continue.',
        timeLabel: 'Until 08:00',
        costEur: 0,
        tone: ActionTone.neutral,
      ),
    ];
  }

  static List<GameActionView> _preLitigationActions({
    required bool includeExpert,
    required bool includeAiDamages,
  }) {
    return <GameActionView>[
      const GameActionView(
        id: 'request-budget',
        title: 'Request additional budget approval',
        description: 'Ask the client to authorize another EUR 25,000.',
        timeLabel: '30m',
        costEur: 250,
        tone: ActionTone.neutral,
      ),
      if (includeExpert)
        const GameActionView(
          id: 'future-expert',
          title: 'Commission independent ERP expert',
          description:
              'Start asynchronous technical analysis by an external expert.',
          timeLabel: '1h',
          costEur: 12000,
          tone: ActionTone.primary,
        ),
      if (includeAiDamages)
        const GameActionView(
          id: 'future-damages',
          title: 'Ask AI associate for damages model',
          description: 'Estimate risk-adjusted value using only known facts.',
          timeLabel: '1h 30m',
          costEur: 750,
          tone: ActionTone.neutral,
        ),
      const GameActionView(
        id: 'future-settle',
        title: 'Accept current settlement offer',
        description: 'Resolve the matter at the currently available amount.',
        timeLabel: 'Immediate',
        costEur: 0,
        tone: ActionTone.warning,
      ),
      const GameActionView(
        id: 'reject-settlement',
        title: 'Reject current settlement offer',
        description: 'Decline the offer and continue preparing the matter.',
        timeLabel: 'Immediate',
        costEur: 0,
        tone: ActionTone.neutral,
      ),
      const GameActionView(
        id: 'rest',
        title: 'Rest until next workday',
        description:
            'Recover acute fatigue while deadlines and events continue.',
        timeLabel: 'Until 08:00',
        costEur: 0,
        tone: ActionTone.neutral,
      ),
    ];
  }
}
