import 'package:flutter/foundation.dart';

import 'dossier_projection.dart';

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

/// Foreground simulation speed selected by the player.
///
/// Every tick advances exactly one deterministic game minute. The speed only
/// changes the real-time interval between ticks, so replay remains based on
/// explicit `advanceTimeByMinutes(1)` commands rather than wall-clock time.
enum SimulationClockSpeed { standard, x2, x4 }

extension SimulationClockSpeedView on SimulationClockSpeed {
  int get multiplier => switch (this) {
        SimulationClockSpeed.standard => 1,
        SimulationClockSpeed.x2 => 2,
        SimulationClockSpeed.x4 => 4,
      };

  String get label => switch (this) {
        SimulationClockSpeed.standard => '1×',
        SimulationClockSpeed.x2 => '2×',
        SimulationClockSpeed.x4 => '4×',
      };

  int get gameMinutesPerRealMinute => 15 * multiplier;

  Duration get tickInterval => switch (this) {
        SimulationClockSpeed.standard => const Duration(seconds: 4),
        SimulationClockSpeed.x2 => const Duration(seconds: 2),
        SimulationClockSpeed.x4 => const Duration(seconds: 1),
      };
}

/// Substantive result of the matter, independent from its procedural stage.
enum CaseResultStatus {
  ongoing,
  wonAtFirstInstance,
  mixedAtFirstInstance,
  lostAtFirstInstance,
  wonOnAppeal,
  lostOnAppeal,
  remittedAfterCassation,
  settled,
  withdrawn,
}

/// Latest authoritative judicial decision, independent from matter closure.
enum JudicialResult { won, lost, partiallyWon, dismissed, unknown }

extension JudicialResultView on JudicialResult {
  String get label => switch (this) {
        JudicialResult.won => 'Won',
        JudicialResult.lost => 'Lost',
        JudicialResult.partiallyWon => 'Partially won',
        JudicialResult.dismissed => 'Dismissed',
        JudicialResult.unknown => 'Unknown decision',
      };

  bool get isAdverse =>
      this == JudicialResult.lost || this == JudicialResult.dismissed;
}

/// Court instance that produced the latest authoritative judicial result.
///
/// This value is owned by Rust. Flutter keeps an explicit `unknown` value for
/// forward-compatible snapshots and never reconstructs the instance from
/// stage IDs, outcome IDs, or translated presentation text.
enum JudicialDecisionInstance { firstInstance, appeal, cassation, unknown }

extension JudicialDecisionInstanceView on JudicialDecisionInstance {
  String get label => switch (this) {
        JudicialDecisionInstance.firstInstance => 'First instance',
        JudicialDecisionInstance.appeal => 'Appeal',
        JudicialDecisionInstance.cassation => 'Cassation',
        JudicialDecisionInstance.unknown => 'Unknown court instance',
      };
}

/// Procedural lifecycle derived by Rust from the authoritative current stage.
enum MatterLifecycleStatus {
  active,
  postJudgment,
  appeal,
  cassation,
  enforcement,
  closed,
  unknown,
}

extension MatterLifecycleStatusView on MatterLifecycleStatus {
  String get label => switch (this) {
        MatterLifecycleStatus.active => 'Active',
        MatterLifecycleStatus.postJudgment =>
          'Post-judgment — remedies available',
        MatterLifecycleStatus.appeal => 'Appeal',
        MatterLifecycleStatus.cassation => 'Cassation',
        MatterLifecycleStatus.enforcement => 'Enforcement',
        MatterLifecycleStatus.closed => 'Closed',
        MatterLifecycleStatus.unknown => 'Unknown status',
      };
}

extension CaseResultStatusView on CaseResultStatus {
  String get label => switch (this) {
        CaseResultStatus.ongoing => 'Ongoing',
        CaseResultStatus.wonAtFirstInstance => 'Won at first instance',
        CaseResultStatus.mixedAtFirstInstance => 'Mixed at first instance',
        CaseResultStatus.lostAtFirstInstance => 'Lost at first instance',
        CaseResultStatus.wonOnAppeal => 'Won on appeal',
        CaseResultStatus.lostOnAppeal => 'Lost on appeal',
        CaseResultStatus.remittedAfterCassation => 'Remitted after cassation',
        CaseResultStatus.settled => 'Settled',
        CaseResultStatus.withdrawn => 'Withdrawn',
      };

  bool get isAdverse =>
      this == CaseResultStatus.lostAtFirstInstance ||
      this == CaseResultStatus.lostOnAppeal ||
      this == CaseResultStatus.withdrawn;
}

/// Status of the professional engagement, independent from the court result.
enum EngagementStatus {
  active,
  awaitingClientInstructions,
  terminatedByClient,
  completed,
}

extension EngagementStatusView on EngagementStatus {
  String get label => switch (this) {
        EngagementStatus.active => 'Engagement active',
        EngagementStatus.awaitingClientInstructions =>
          'Awaiting client instructions',
        EngagementStatus.terminatedByClient => 'Terminated by client',
        EngagementStatus.completed => 'Engagement completed',
      };
}

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
    required this.caseResultStatus,
    required this.engagementStatus,
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
    required this.inactivityMinutes,
    required this.clientWarningLevel,
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
    this.judicialResult,
    this.judicialDecisionInstance,
    this.matterLifecycle = MatterLifecycleStatus.active,
    bool? isClosed,
    this.settlementOffer,
    this.outcomeSummary,
    this.dossier,
  }) : _authoritativeIsClosed = isClosed;

  final String version;
  final int seed;
  final String mode;
  final String dayLabel;
  final String timeLabel;
  final String stage;
  final CaseResultStatus caseResultStatus;
  final EngagementStatus engagementStatus;
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

  /// Minutes elapsed without a substantive player action.
  ///
  /// The mobile demo uses this counter to issue client warnings and eventually
  /// terminate the engagement. Passive clock movement and rest increase it; a
  /// genuine case action resets it.
  final int inactivityMinutes;

  /// Highest client-escalation tier already emitted for the current inactivity
  /// streak: 0 = none, 1 = warning, 2 = final warning.
  final int clientWarningLevel;

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
  final JudicialResult? judicialResult;
  final JudicialDecisionInstance? judicialDecisionInstance;
  final MatterLifecycleStatus matterLifecycle;
  final bool? _authoritativeIsClosed;
  final SettlementOfferView? settlementOffer;
  final CaseOutcomeSummaryView? outcomeSummary;

  /// Read-only player dossier projected from authoritative Rust state.
  ///
  /// Legacy snapshots may omit this additive field. Flutter does not build a
  /// substitute projection from its older presentation metrics.
  final DossierProjectionView? dossier;

  /// Authoritative for native scenarios; legacy demo snapshots derive closure
  /// from their existing terminal summary until that runtime is migrated.
  bool get isClosed => _authoritativeIsClosed ?? outcomeSummary != null;

  int get unhandledRequiredMessages => inbox
      .where((InboxItemView item) => item.status == InboxStatus.actionRequired)
      .length;

  int get remainingBudgetEur => authorizedBudgetEur - spendEur;

  double get billableHours => billableMinutes / 60;

  GameSnapshot copyWith({
    String? dayLabel,
    String? timeLabel,
    String? stage,
    CaseResultStatus? caseResultStatus,
    EngagementStatus? engagementStatus,
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
    int? inactivityMinutes,
    int? clientWarningLevel,
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
    JudicialResult? judicialResult,
    bool clearJudicialResult = false,
    JudicialDecisionInstance? judicialDecisionInstance,
    bool clearJudicialDecisionInstance = false,
    MatterLifecycleStatus? matterLifecycle,
    bool? isClosed,
    SettlementOfferView? settlementOffer,
    bool clearSettlementOffer = false,
    CaseOutcomeSummaryView? outcomeSummary,
    bool clearOutcomeSummary = false,
    DossierProjectionView? dossier,
    bool clearDossier = false,
  }) {
    return GameSnapshot(
      version: version,
      seed: seed,
      mode: mode,
      dayLabel: dayLabel ?? this.dayLabel,
      timeLabel: timeLabel ?? this.timeLabel,
      stage: stage ?? this.stage,
      caseResultStatus: caseResultStatus ?? this.caseResultStatus,
      engagementStatus: engagementStatus ?? this.engagementStatus,
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
      inactivityMinutes: inactivityMinutes ?? this.inactivityMinutes,
      clientWarningLevel: clientWarningLevel ?? this.clientWarningLevel,
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
      judicialResult:
          clearJudicialResult ? null : judicialResult ?? this.judicialResult,
      judicialDecisionInstance: clearJudicialDecisionInstance
          ? null
          : judicialDecisionInstance ?? this.judicialDecisionInstance,
      matterLifecycle: matterLifecycle ?? this.matterLifecycle,
      isClosed: isClosed ?? _authoritativeIsClosed,
      settlementOffer:
          clearSettlementOffer ? null : settlementOffer ?? this.settlementOffer,
      outcomeSummary:
          clearOutcomeSummary ? null : outcomeSummary ?? this.outcomeSummary,
      dossier: clearDossier ? null : dossier ?? this.dossier,
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
