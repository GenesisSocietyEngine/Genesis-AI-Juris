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

  final int seed;
  GameSnapshot _snapshot;

  GameSnapshot get snapshot => _snapshot;

  /// Resets the mobile playtest to the same seed and opening state.
  void reset() {
    _snapshot = _initial(seed);
    notifyListeners();
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
          message: 'The associate identified issues to verify before reliance.',
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
          message: 'The model is now tied to the current known-facts revision.',
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
          message: 'This action will be executed by the Rust engine in v0.5.1.',
          isRisky: false,
        );
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

    final List<InboxItemView> updatedInbox = <InboxItemView>[
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

    final List<GameActionView> preLitigationActions = _withDeadlineActions(
      _preLitigationActions(
        includeExpert: !_snapshot.independentExpertCommissioned,
        includeAiDamages: _snapshot.aiDamagesModelRevision < revisedKnownFacts,
      ),
      updatedDeadlines,
    );

    _snapshot = _snapshot.copyWith(
      timeLabel: '17:30',
      stage: 'Pre-litigation',
      spendEur: _snapshot.spendEur + 2000,
      billableMinutes: _snapshot.billableMinutes + 480,
      fatigue: _snapshot.fatigue + 9,
      cumulativeStrain: _snapshot.cumulativeStrain + 3,
      merits: 49,
      evidenceScore: 44,
      procedure: _snapshot.procedure - (partnerBriefNewlyMissed ? 4 : 0),
      clientTrust: _snapshot.clientTrust - (partnerBriefNewlyMissed ? 1 : 0),
      caseStrength: 48,
      knownFactsRevision: revisedKnownFacts,
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
            (InboxItemView item) => item.id == 'expert-report-ready'
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
    _snapshot = _snapshot.copyWith(
      stage: 'Resolved',
      clientTrust: _snapshot.clientTrust + 2,
      inbox: _resolveInboxItem('settlement-offer'),
      actions: const <GameActionView>[],
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

    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      stage: 'Pleadings',
      spendEur: _snapshot.spendEur + 2500,
      billableMinutes: _snapshot.billableMinutes + 180,
      fatigue: (_snapshot.fatigue + 3).clamp(0, 100).toInt(),
      procedure: (_snapshot.procedure + 5).clamp(0, 100).toInt(),
      leverage: (_snapshot.leverage + 2).clamp(0, 100).toInt(),
      clientTrust: (_snapshot.clientTrust + 2).clamp(0, 100).toInt(),
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
    if (_snapshot.stage != 'Pleadings') {
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
          status: InboxStatus.actionRequired,
        ),
      ],
      deadlines: <DeadlineView>[
        ..._snapshot.deadlines.where(
          (DeadlineView item) => item.id != hearingId,
        ),
        hearing,
      ],
      actions: _ensureAction(
        remainingActions,
        _requestHearingRescheduleAction(hearing.dueAt),
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
    if (hearing == null) {
      return false;
    }

    final (int hearingDay, int hearingMinute) = _calendarMoment(hearing);
    final int currentDay = _currentDayNumber();
    final int currentMinute = _minuteOfDay(_snapshot.timeLabel);
    if (currentDay != hearingDay || currentMinute >= hearingMinute) {
      return false;
    }

    _snapshot = _snapshot.copyWith(
      timeLabel: _formatMinuteOfDay(hearingMinute),
      actions: _ensureAction(
        _snapshot.actions
            .where(
              (GameActionView action) =>
                  action.id != 'wait-until-hearing' &&
                  action.id != 'request-hearing-reschedule',
            )
            .toList(growable: false),
        _attendHearingAction(),
      ),
    );
    notifyListeners();
    return true;
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

    _snapshot = _snapshot.copyWith(
      timeLabel: completionTime,
      stage: 'Judgment pending',
      billableMinutes: _snapshot.billableMinutes + 360,
      fatigue: (_snapshot.fatigue + 8).clamp(0, 100).toInt(),
      cumulativeStrain: (_snapshot.cumulativeStrain + 3).clamp(0, 100).toInt(),
      deadlines: _replaceCalendarItem(completedHearing),
      inbox: <InboxItemView>[
        ..._snapshot.inbox.map(
          (InboxItemView item) => item.id.startsWith('hearing-notice-')
              ? item.copyWith(status: InboxStatus.resolved)
              : item,
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

    final List<DeadlineView> updatedDeadlines = _markOverdueDeadlines(
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

    if (newlyMissed.contains('partner-brief')) {
      procedure -= 4;
      clientTrust -= 1;
      updatedInbox.add(
        InboxItemView(
          id: 'partner-brief-missed-day-$nextDay',
          sender: 'Matter partner',
          subject: 'Partner risk brief missed',
          body:
              'The internal risk brief was not delivered by Day 1 at 15:00. Partner oversight and settlement planning are now weaker.',
          receivedAt: 'Day $nextDay · 08:00',
          status: InboxStatus.unread,
        ),
      );
    }

    if (newlyMissed.contains('preservation')) {
      procedure -= 8;
      evidenceScore -= 6;
      ethics -= 3;
      updatedInbox.add(
        InboxItemView(
          id: 'preservation-missed-day-$nextDay',
          sender: 'Matter risk system',
          subject: 'Evidence-preservation deadline missed',
          body:
              'No preservation notice was issued by Day 2 at 17:00. Relevant records may now be incomplete or challenged.',
          receivedAt: 'Day $nextDay · 08:00',
          status: InboxStatus.actionRequired,
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
      procedure -= 20;
      clientTrust -= 15;
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
            status: InboxStatus.actionRequired,
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

    if (nextStage == 'Hearing preparation') {
      final DeadlineView? activeHearing = _activeScheduledHearingFrom(
        updatedDeadlines,
      );
      if (activeHearing != null) {
        final (int hearingDay, int hearingMinute) =
            _calendarMoment(activeHearing);
        final bool requestAvailable = activeHearing.rescheduleActionId !=
                null &&
            activeHearing.rescheduleStatus == RescheduleRequestStatus.none &&
            _isRescheduleRequestWindowOpenAt(
              activeHearing,
              day: nextDay,
              minuteOfDay: 8 * 60,
            );

        if (requestAvailable) {
          updatedActions = _ensureAction(
            updatedActions,
            _requestHearingRescheduleAction(activeHearing.dueAt),
          );
        }

        if (nextDay == hearingDay && (8 * 60) < hearingMinute) {
          updatedActions = _ensureAction(
            updatedActions,
            _waitUntilHearingAction(activeHearing.dueAt),
          );
        }
      }
    }

    final bool clearSettlementOffer = settlementExpired;
    if (_snapshot.stage == 'Judgment pending') {
      final int outcomeScore =
          _snapshot.caseStrength + procedure + evidenceScore + _snapshot.merits;
      final bool favorable = outcomeScore >= 205;
      nextStage = 'Resolved';
      updatedActions = const <GameActionView>[];
      updatedInbox.add(
        InboxItemView(
          id: 'judgment-day-$nextDay',
          sender: 'Enterprise Court Registry',
          subject: favorable
              ? 'Judgment: claim substantially upheld'
              : 'Judgment: mixed outcome',
          body: favorable
              ? 'The court found material supplier breach and awarded substantial damages, with a reduction for scope changes and mitigation uncertainty.'
              : 'The court accepted part of the breach case but reduced recovery because causation, scope variation, and proof of loss remained incomplete.',
          receivedAt: 'Day $nextDay · 08:00',
          status: InboxStatus.actionRequired,
        ),
      );
    }

    _snapshot = _snapshot.copyWith(
      dayLabel: 'Day $nextDay',
      timeLabel: '08:00',
      stage: nextStage,
      fatigue: 0,
      cumulativeStrain: (_snapshot.cumulativeStrain - 2).clamp(0, 100).toInt(),
      procedure: procedure.clamp(0, 100).toInt(),
      evidenceScore: evidenceScore.clamp(0, 100).toInt(),
      ethics: ethics.clamp(0, 100).toInt(),
      clientTrust: clientTrust.clamp(0, 100).toInt(),
      expertReviewStatus: expertStatus,
      deadlines: updatedDeadlines,
      inbox: updatedInbox,
      actions: updatedActions,
      clearSettlementOffer: clearSettlementOffer,
    );
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
            status: InboxStatus.actionRequired,
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
        status: InboxStatus.actionRequired,
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
      final bool overdue =
          day > dueDay || (day == dueDay && minuteOfDay > dueMinute);
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
          (_snapshot.procedure - (preservation ? 8 : 4)).clamp(0, 100).toInt(),
      evidenceScore: (_snapshot.evidenceScore - (preservation ? 6 : 0))
          .clamp(0, 100)
          .toInt(),
      ethics: (_snapshot.ethics - (preservation ? 3 : 0)).clamp(0, 100).toInt(),
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
        case null:
          break;
        default:
          break;
      }
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
            'Procedure -4 and client trust -1 because partner oversight was not documented in time.',
      ),
      DeadlineView(
        id: 'preservation',
        title: 'Evidence-preservation notice',
        dueAt: 'Day 2 · 17:00',
        status: DeadlineStatus.open,
        detail: 'Preserve project mailboxes, tickets, and acceptance records.',
        relatedActionId: 'issue-preservation-notice',
        missedConsequence:
            'Procedure -8, evidence -6, and ethics -3 because records may be incomplete or challenged.',
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
      title: 'Wait until enterprise court hearing',
      description:
          'Advance the simulation clock to the scheduled attendance window at $hearingDate.',
      timeLabel: 'Until hearing',
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
      version: '0.5.0+7 hearing scheduling and rescheduling patch',
      seed: seed,
      mode: 'Assisted',
      dayLabel: 'Day 1',
      timeLabel: '08:00',
      stage: 'Intake',
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
      aiRequestsUsed: 0,
      aiRequestLimit: 5,
      knownFactsRevision: 1,
      aiLegalResearchRevision: 0,
      aiDamagesModelRevision: 0,
      expertReviewStatus: ExpertReviewStatus.notCommissioned,
      expertReportDueDay: 0,
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
