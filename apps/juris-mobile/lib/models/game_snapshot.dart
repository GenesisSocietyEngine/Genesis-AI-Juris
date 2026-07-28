import 'package:flutter/foundation.dart';

/// Lifecycle states used by the mobile Inbox.
///
/// The distinction matters because an unread court notice is not the same as
/// an unanswered client request. The Rust engine already models this semantic
/// difference; the UI keeps it explicit rather than reducing everything to a
/// single Boolean flag.
enum InboxStatus { unread, read, actionRequired, resolved, archived }

/// Calendar item type used by the mobile shell.
///
/// The v0.5.0 UI still renders both categories in the same Calendar card, but
/// the semantic distinction prevents a court hearing from behaving like an
/// ordinary filing deadline.
enum CalendarItemKind { deadline, mandatoryEvent }

/// State of a professional deadline or mandatory court event.
enum DeadlineStatus { open, scheduled, rescheduled, done, missed, cancelled }

/// Lifecycle of a request to move a scheduled hearing.
///
/// A pending request never suspends the original hearing. The original date
/// remains binding until the court grants the request and creates a replacement
/// hearing event.
enum RescheduleRequestStatus { none, pending, granted, denied, withdrawn }

/// Lifecycle of the asynchronous independent-expert engagement.
///
/// The distinction prevents a commissioned assignment from remaining pending
/// forever and makes the report arrival an explicit world event.
enum ExpertReviewStatus {
  notCommissioned,
  pending,
  reportReady,
  reviewed,
  expired,
}

/// Lifecycle of delegated first-pass document review.
///
/// The explicit terminal states prevent an asynchronous preparation task from
/// remaining visually active after the hearing or after the matter closes.
enum JuniorReviewStatus {
  notDelegated,
  inProgress,
  findingsReady,
  reviewed,
  expired,
}

/// Visual severity for a player action.
///
/// This is presentation metadata only. It never determines simulation effects.
enum ActionTone { primary, neutral, warning, danger }

@immutable
class InboxItemView {
  const InboxItemView({
    required this.id,
    required this.sender,
    required this.subject,
    required this.body,
    required this.receivedAt,
    required this.status,
  });

  final String id;
  final String sender;
  final String subject;
  final String body;
  final String receivedAt;
  final InboxStatus status;

  InboxItemView copyWith({InboxStatus? status}) {
    return InboxItemView(
      id: id,
      sender: sender,
      subject: subject,
      body: body,
      receivedAt: receivedAt,
      status: status ?? this.status,
    );
  }
}

@immutable
class DeadlineView {
  const DeadlineView({
    required this.id,
    required this.title,
    required this.dueAt,
    required this.status,
    required this.detail,
    this.kind = CalendarItemKind.deadline,
    this.relatedActionId,
    this.rescheduleActionId,
    this.rescheduleStatus = RescheduleRequestStatus.none,
    this.rescheduleRequestedDay = 0,
    this.rescheduleDecisionDay = 0,
    this.rescheduleRequestCount = 0,
    this.replacementItemId,
    this.missedConsequence,
  });

  final String id;
  final String title;
  final String dueAt;
  final DeadlineStatus status;
  final String detail;
  final CalendarItemKind kind;

  /// Action that completes this item while it remains actionable.
  final String? relatedActionId;

  /// Action that submits a postponement request for a scheduled hearing.
  final String? rescheduleActionId;

  /// Current court-request lifecycle.
  final RescheduleRequestStatus rescheduleStatus;

  /// Simulation day on which the player submitted the request.
  final int rescheduleRequestedDay;

  /// Simulation day on which the registry will issue its decision.
  final int rescheduleDecisionDay;

  /// Number of postponement requests made for this hearing lineage.
  final int rescheduleRequestCount;

  /// Replacement hearing created when this item is rescheduled.
  final String? replacementItemId;

  /// Explainable consequence shown after the item is missed.
  final String? missedConsequence;

  bool get isHearing => kind == CalendarItemKind.mandatoryEvent;

  DeadlineView copyWith({
    String? dueAt,
    DeadlineStatus? status,
    String? detail,
    CalendarItemKind? kind,
    String? relatedActionId,
    bool clearRelatedActionId = false,
    String? rescheduleActionId,
    bool clearRescheduleActionId = false,
    RescheduleRequestStatus? rescheduleStatus,
    int? rescheduleRequestedDay,
    int? rescheduleDecisionDay,
    int? rescheduleRequestCount,
    String? replacementItemId,
    bool clearReplacementItemId = false,
    String? missedConsequence,
  }) {
    return DeadlineView(
      id: id,
      title: title,
      dueAt: dueAt ?? this.dueAt,
      status: status ?? this.status,
      detail: detail ?? this.detail,
      kind: kind ?? this.kind,
      relatedActionId:
          clearRelatedActionId ? null : relatedActionId ?? this.relatedActionId,
      rescheduleActionId: clearRescheduleActionId
          ? null
          : rescheduleActionId ?? this.rescheduleActionId,
      rescheduleStatus: rescheduleStatus ?? this.rescheduleStatus,
      rescheduleRequestedDay:
          rescheduleRequestedDay ?? this.rescheduleRequestedDay,
      rescheduleDecisionDay:
          rescheduleDecisionDay ?? this.rescheduleDecisionDay,
      rescheduleRequestCount:
          rescheduleRequestCount ?? this.rescheduleRequestCount,
      replacementItemId: clearReplacementItemId
          ? null
          : replacementItemId ?? this.replacementItemId,
      missedConsequence: missedConsequence ?? this.missedConsequence,
    );
  }
}

@immutable
class EvidenceView {
  const EvidenceView({
    required this.id,
    required this.title,
    required this.detail,
    required this.reliability,
    required this.isAdverse,
  });

  final String id;
  final String title;
  final String detail;
  final int reliability;
  final bool isAdverse;
}

@immutable
class GameActionView {
  const GameActionView({
    required this.id,
    required this.title,
    required this.description,
    required this.timeLabel,
    required this.costEur,
    required this.tone,
    this.riskNote,
  });

  final String id;
  final String title;
  final String description;
  final String timeLabel;
  final int costEur;
  final ActionTone tone;
  final String? riskNote;
}

@immutable
class SettlementOfferView {
  const SettlementOfferView({
    required this.amountEur,
    required this.expiresAt,
    required this.revision,
  });

  final int amountEur;
  final String expiresAt;
  final int revision;
}

@immutable
class CaseOutcomeSummaryView {
  const CaseOutcomeSummaryView({
    required this.headline,
    required this.finalStatus,
    required this.detail,
    required this.closedAt,
    required this.awardEur,
    required this.costsEur,
    required this.keySuccesses,
    required this.missedOpportunities,
  });

  final String headline;
  final String finalStatus;
  final String detail;
  final String closedAt;
  final int awardEur;
  final int costsEur;
  final List<String> keySuccesses;
  final List<String> missedOpportunities;
}

/// Immutable read model consumed by Flutter screens.
///
/// v0.5.1 will populate the same conceptual snapshot from Rust. Keeping the UI
/// on an immutable projection prevents widgets from mutating authoritative
/// game state and mirrors the engine's existing authority boundary.
@immutable
class GameSnapshot {
  const GameSnapshot({
    required this.version,
    required this.seed,
    required this.mode,
    required this.dayLabel,
    required this.timeLabel,
    required this.stage,
    required this.matterTitle,
    required this.caseStrength,
    required this.merits,
    required this.evidenceScore,
    required this.procedure,
    required this.leverage,
    required this.spendEur,
    required this.authorizedBudgetEur,
    required this.billableMinutes,
    required this.fatigue,
    required this.cumulativeStrain,
    required this.ethics,
    required this.clientTrust,
    required this.aiRequestsUsed,
    required this.aiRequestLimit,
    required this.knownFactsRevision,
    required this.aiLegalResearchRevision,
    required this.aiDamagesModelRevision,
    required this.expertReviewStatus,
    required this.expertReportDueDay,
    required this.juniorReviewStatus,
    required this.juniorReviewDueDay,
    required this.juniorReviewDueMinute,
    required this.inbox,
    required this.deadlines,
    required this.evidence,
    required this.actions,
    required this.latestAiNote,
    this.settlementOffer,
    this.outcomeSummary,
  });

  final String version;
  final int seed;
  final String mode;
  final String dayLabel;
  final String timeLabel;
  final String stage;
  final String matterTitle;
  final int caseStrength;
  final int merits;
  final int evidenceScore;
  final int procedure;
  final int leverage;
  final int spendEur;
  final int authorizedBudgetEur;
  final int billableMinutes;
  final int fatigue;
  final int cumulativeStrain;
  final int ethics;
  final int clientTrust;
  final int aiRequestsUsed;
  final int aiRequestLimit;

  /// Monotonic revision of the facts currently authorized for analysis.
  ///
  /// An AI work product records the revision it analyzed. The same assignment
  /// is unavailable until this revision increases, preventing repeated farming
  /// of identical advice from an unchanged evidentiary record.
  final int knownFactsRevision;

  /// Facts revision used by the latest general legal-research assignment.
  final int aiLegalResearchRevision;

  /// Facts revision used by the latest AI damages model.
  final int aiDamagesModelRevision;

  /// Current lifecycle of the independent expert engagement.
  final ExpertReviewStatus expertReviewStatus;

  /// Simulation day on which the expert report becomes ready.
  ///
  /// Zero means that no report has been scheduled.
  final int expertReportDueDay;

  /// Current lifecycle of delegated junior document review.
  final JuniorReviewStatus juniorReviewStatus;

  /// Scheduled completion moment for the delegated review.
  final int juniorReviewDueDay;
  final int juniorReviewDueMinute;

  bool get independentExpertCommissioned =>
      expertReviewStatus != ExpertReviewStatus.notCommissioned;

  bool get independentExpertCompleted =>
      expertReviewStatus == ExpertReviewStatus.reviewed;

  final List<InboxItemView> inbox;
  final List<DeadlineView> deadlines;
  final List<EvidenceView> evidence;
  final List<GameActionView> actions;
  final String? latestAiNote;
  final SettlementOfferView? settlementOffer;
  final CaseOutcomeSummaryView? outcomeSummary;

  int get unhandledRequiredMessages => inbox
      .where((InboxItemView item) => item.status == InboxStatus.actionRequired)
      .length;

  int get remainingBudgetEur => authorizedBudgetEur - spendEur;

  double get billableHours => billableMinutes / 60;

  GameSnapshot copyWith({
    String? dayLabel,
    String? timeLabel,
    String? stage,
    int? caseStrength,
    int? merits,
    int? evidenceScore,
    int? procedure,
    int? leverage,
    int? spendEur,
    int? authorizedBudgetEur,
    int? billableMinutes,
    int? fatigue,
    int? cumulativeStrain,
    int? ethics,
    int? clientTrust,
    int? aiRequestsUsed,
    int? knownFactsRevision,
    int? aiLegalResearchRevision,
    int? aiDamagesModelRevision,
    ExpertReviewStatus? expertReviewStatus,
    int? expertReportDueDay,
    JuniorReviewStatus? juniorReviewStatus,
    int? juniorReviewDueDay,
    int? juniorReviewDueMinute,
    List<InboxItemView>? inbox,
    List<DeadlineView>? deadlines,
    List<EvidenceView>? evidence,
    List<GameActionView>? actions,
    String? latestAiNote,
    bool clearLatestAiNote = false,
    SettlementOfferView? settlementOffer,
    bool clearSettlementOffer = false,
    CaseOutcomeSummaryView? outcomeSummary,
    bool clearOutcomeSummary = false,
  }) {
    return GameSnapshot(
      version: version,
      seed: seed,
      mode: mode,
      dayLabel: dayLabel ?? this.dayLabel,
      timeLabel: timeLabel ?? this.timeLabel,
      stage: stage ?? this.stage,
      matterTitle: matterTitle,
      caseStrength: caseStrength ?? this.caseStrength,
      merits: merits ?? this.merits,
      evidenceScore: evidenceScore ?? this.evidenceScore,
      procedure: procedure ?? this.procedure,
      leverage: leverage ?? this.leverage,
      spendEur: spendEur ?? this.spendEur,
      authorizedBudgetEur: authorizedBudgetEur ?? this.authorizedBudgetEur,
      billableMinutes: billableMinutes ?? this.billableMinutes,
      fatigue: fatigue ?? this.fatigue,
      cumulativeStrain: cumulativeStrain ?? this.cumulativeStrain,
      ethics: ethics ?? this.ethics,
      clientTrust: clientTrust ?? this.clientTrust,
      aiRequestsUsed: aiRequestsUsed ?? this.aiRequestsUsed,
      aiRequestLimit: aiRequestLimit,
      knownFactsRevision: knownFactsRevision ?? this.knownFactsRevision,
      aiLegalResearchRevision:
          aiLegalResearchRevision ?? this.aiLegalResearchRevision,
      aiDamagesModelRevision:
          aiDamagesModelRevision ?? this.aiDamagesModelRevision,
      expertReviewStatus: expertReviewStatus ?? this.expertReviewStatus,
      expertReportDueDay: expertReportDueDay ?? this.expertReportDueDay,
      juniorReviewStatus: juniorReviewStatus ?? this.juniorReviewStatus,
      juniorReviewDueDay: juniorReviewDueDay ?? this.juniorReviewDueDay,
      juniorReviewDueMinute:
          juniorReviewDueMinute ?? this.juniorReviewDueMinute,
      inbox: inbox ?? this.inbox,
      deadlines: deadlines ?? this.deadlines,
      evidence: evidence ?? this.evidence,
      actions: actions ?? this.actions,
      latestAiNote:
          clearLatestAiNote ? null : latestAiNote ?? this.latestAiNote,
      settlementOffer:
          clearSettlementOffer ? null : settlementOffer ?? this.settlementOffer,
      outcomeSummary:
          clearOutcomeSummary ? null : outcomeSummary ?? this.outcomeSummary,
    );
  }
}

@immutable
class ActionExecutionResult {
  const ActionExecutionResult({
    required this.title,
    required this.message,
    required this.isRisky,
  });

  final String title;
  final String message;
  final bool isRisky;
}
