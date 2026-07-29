import '../models/case_catalog.dart';
import '../models/game_snapshot.dart';

/// Converts the stable Rust mobile snapshot into the current Flutter read
/// model. All values are presentation projections; scenario mutation remains
/// exclusively inside Rust.
abstract final class ScenarioSnapshotMapper {
  static GameSnapshot map({
    required Map<String, dynamic> source,
    required MobileCaseDefinition caseDefinition,
    Set<String> locallyReadInboxIds = const <String>{},
  }) {
    final int clockMinutes = _int(source, 'clock_minutes');
    final bool isClosed =
        _optionalBool(source, 'is_closed') ?? _bool(source, 'terminal');
    final JudicialResult? judicialResult =
        _judicialResult(source['judicial_result']);
    final MatterLifecycleStatus matterLifecycle = _matterLifecycle(
      source['matter_lifecycle'],
      isClosed: isClosed,
    );
    final List<Map<String, dynamic>> facts = _objectList(source, 'facts');
    final List<Map<String, dynamic>> evidence = _objectList(source, 'evidence');
    final List<Map<String, dynamic>> availableEvidence = evidence
        .where((Map<String, dynamic> item) => _bool(item, 'available'))
        .toList(growable: false);
    final int factScore = facts.isEmpty
        ? 0
        : facts
                .map((Map<String, dynamic> fact) =>
                    _factStatusScore(_string(fact, 'status')))
                .reduce((int left, int right) => left + right) ~/
            facts.length;
    final int evidenceScore = evidence.isEmpty
        ? 0
        : ((availableEvidence.length / evidence.length) * 100).round();
    final Map<String, dynamic>? outcome = _nullableObject(source['outcome']);

    return GameSnapshot(
      version: '0.5.1 native scenario runtime',
      seed: _int(source, 'seed'),
      mode: 'Authoritative Rust',
      dayLabel: _dayLabel(clockMinutes),
      timeLabel: _timeLabel(clockMinutes),
      stage: _string(source, 'stage_title'),
      caseResultStatus: _caseResult(judicialResult, outcome),
      engagementStatus:
          isClosed ? EngagementStatus.completed : EngagementStatus.active,
      matterTitle: _scenarioTitle(caseDefinition),
      caseStrength: ((factScore + evidenceScore) / 2).round(),
      merits: factScore,
      evidenceScore: evidenceScore,
      procedure: _stageProgress(source, caseDefinition),
      leverage: factScore,
      spendEur: 0,
      authorizedBudgetEur: 0,
      billableMinutes: clockMinutes,
      fatigue: 0,
      cumulativeStrain: 0,
      ethics: 100,
      clientTrust: 100,
      inactivityMinutes: 0,
      clientWarningLevel: 0,
      aiRequestsUsed: 0,
      aiRequestLimit: 0,
      knownFactsRevision: facts.length,
      aiLegalResearchRevision: 0,
      aiDamagesModelRevision: 0,
      expertReviewStatus: ExpertReviewStatus.notCommissioned,
      expertReportDueDay: 0,
      juniorReviewStatus: JuniorReviewStatus.notDelegated,
      juniorReviewDueDay: 0,
      juniorReviewDueMinute: 0,
      inbox: _objectList(source, 'inbox')
          .where((Map<String, dynamic> item) => _bool(item, 'visible'))
          .map(
            (Map<String, dynamic> item) => InboxItemView(
              id: _string(item, 'id'),
              sender: 'Scenario update',
              subject: _string(item, 'subject'),
              body: _string(item, 'body'),
              receivedAt: '${_dayLabel(clockMinutes)} · '
                  '${_timeLabel(clockMinutes)}',
              status: _inboxStatus(item, locallyReadInboxIds),
            ),
          )
          .toList(growable: false),
      deadlines: _objectList(source, 'deadlines')
          .where((Map<String, dynamic> item) => item['status'] != null)
          .map(
            (Map<String, dynamic> item) => DeadlineView(
              id: _string(item, 'id'),
              title: _string(item, 'title'),
              dueAt: _absoluteMoment(_int(item, 'due_at_minutes')),
              status: _deadlineStatus(_string(item, 'status')),
              detail: 'Authoritative scenario deadline.',
            ),
          )
          .toList(growable: false),
      evidence: availableEvidence
          .map(
            (Map<String, dynamic> item) => EvidenceView(
              id: _string(item, 'id'),
              title: _string(item, 'title'),
              detail: '${_string(item, 'kind')} · available',
              reliability: 100,
              isAdverse: false,
            ),
          )
          .toList(growable: false),
      actions: _objectList(source, 'available_actions')
          .map(
            (Map<String, dynamic> item) => GameActionView(
              id: _string(item, 'id'),
              title: _string(item, 'title'),
              description: item['description'] as String? ??
                  'Execute this authoritative scenario action.',
              timeLabel: _durationLabel(_int(item, 'time_cost_minutes')),
              costEur: 0,
              tone: ActionTone.primary,
            ),
          )
          .toList(growable: false),
      latestAiNote: null,
      judicialResult: judicialResult,
      matterLifecycle: matterLifecycle,
      isClosed: isClosed,
      outcomeSummary: !isClosed || outcome == null
          ? null
          : CaseOutcomeSummaryView(
              headline: _string(outcome, 'title'),
              finalStatus: _string(outcome, 'id'),
              detail: _string(outcome, 'summary'),
              closedAt: '${_dayLabel(clockMinutes)} · '
                  '${_timeLabel(clockMinutes)}',
              awardEur: 0,
              costsEur: 0,
              keySuccesses: const <String>[
                'Completed an authoritative deterministic scenario path.',
              ],
              missedOpportunities: const <String>[],
            ),
    );
  }

  static String _scenarioTitle(MobileCaseDefinition definition) {
    final Map<String, dynamic>? metadata =
        _nullableObject(definition.scenario?['metadata']);
    final dynamic title = metadata?['title'];
    if (title is String && title.isNotEmpty) {
      return title;
    }
    return definition.localized('en', 'en').caption;
  }

  static int _stageProgress(
    Map<String, dynamic> snapshot,
    MobileCaseDefinition definition,
  ) {
    final dynamic rawStages = definition.scenario?['stages'];
    if (rawStages is! List<dynamic> || rawStages.isEmpty) {
      return 0;
    }
    final String stageId = _string(snapshot, 'stage_id');
    final int index = rawStages.indexWhere(
      (dynamic item) => item is Map<String, dynamic> && item['id'] == stageId,
    );
    if (index < 0) {
      return 0;
    }
    return (((index + 1) / rawStages.length) * 100).round();
  }

  static InboxStatus _inboxStatus(
    Map<String, dynamic> item,
    Set<String> locallyReadInboxIds,
  ) {
    if (_bool(item, 'resolved')) {
      return InboxStatus.resolved;
    }
    if (_bool(item, 'action_required')) {
      return InboxStatus.actionRequired;
    }
    if (locallyReadInboxIds.contains(_string(item, 'id'))) {
      return InboxStatus.read;
    }
    return InboxStatus.unread;
  }

  static DeadlineStatus _deadlineStatus(String status) {
    return switch (status) {
      'open' => DeadlineStatus.open,
      'completed' => DeadlineStatus.done,
      'missed' => DeadlineStatus.missed,
      _ => throw FormatException('Unsupported deadline status: $status'),
    };
  }

  static CaseResultStatus _caseResult(
    JudicialResult? judicialResult,
    Map<String, dynamic>? outcome,
  ) {
    final CaseResultStatus? fromDecision = switch (judicialResult) {
      JudicialResult.won => CaseResultStatus.wonAtFirstInstance,
      JudicialResult.lost ||
      JudicialResult.dismissed =>
        CaseResultStatus.lostAtFirstInstance,
      JudicialResult.partiallyWon => CaseResultStatus.mixedAtFirstInstance,
      JudicialResult.unknown || null => null,
    };
    if (fromDecision != null) {
      return fromDecision;
    }
    if (outcome == null) {
      return CaseResultStatus.ongoing;
    }
    final String id = _string(outcome, 'id');
    if (id.contains('judgment')) {
      return CaseResultStatus.wonAtFirstInstance;
    }
    return CaseResultStatus.settled;
  }

  static JudicialResult? _judicialResult(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is! String) {
      return JudicialResult.unknown;
    }
    return switch (value) {
      'won' => JudicialResult.won,
      'lost' => JudicialResult.lost,
      'partially_won' => JudicialResult.partiallyWon,
      'dismissed' => JudicialResult.dismissed,
      _ => JudicialResult.unknown,
    };
  }

  static MatterLifecycleStatus _matterLifecycle(
    dynamic value, {
    required bool isClosed,
  }) {
    if (value is! String) {
      return isClosed
          ? MatterLifecycleStatus.closed
          : MatterLifecycleStatus.active;
    }
    return switch (value) {
      'active' => MatterLifecycleStatus.active,
      'post_judgment' => MatterLifecycleStatus.postJudgment,
      'appeal' => MatterLifecycleStatus.appeal,
      'cassation' => MatterLifecycleStatus.cassation,
      'enforcement' => MatterLifecycleStatus.enforcement,
      'closed' => MatterLifecycleStatus.closed,
      _ => MatterLifecycleStatus.unknown,
    };
  }

  static int _factStatusScore(String status) {
    return switch (status) {
      'proven' => 100,
      'admitted' => 80,
      'inferred' => 65,
      'alleged' => 45,
      'disputed' => 25,
      'unknown' => 0,
      _ => throw FormatException('Unsupported fact status: $status'),
    };
  }

  static String _durationLabel(int minutes) {
    if (minutes == 0) {
      return 'Immediate';
    }
    final int hours = minutes ~/ 60;
    final int remainder = minutes % 60;
    if (hours == 0) {
      return '${remainder}m';
    }
    if (remainder == 0) {
      return '${hours}h';
    }
    return '${hours}h ${remainder}m';
  }

  static String _dayLabel(int elapsedMinutes) {
    final int absoluteMinutes = 8 * 60 + elapsedMinutes;
    return 'Day ${absoluteMinutes ~/ 1440 + 1}';
  }

  static String _timeLabel(int elapsedMinutes) {
    final int minuteOfDay = (8 * 60 + elapsedMinutes) % 1440;
    final String hour = (minuteOfDay ~/ 60).toString().padLeft(2, '0');
    final String minute = (minuteOfDay % 60).toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  static String _absoluteMoment(int minutes) {
    final int day = minutes ~/ 1440 + 1;
    final int minuteOfDay = minutes % 1440;
    final String hour = (minuteOfDay ~/ 60).toString().padLeft(2, '0');
    final String minute = (minuteOfDay % 60).toString().padLeft(2, '0');
    return 'Day $day · $hour:$minute';
  }

  static List<Map<String, dynamic>> _objectList(
    Map<String, dynamic> source,
    String field,
  ) {
    final dynamic value = source[field];
    if (value is! List<dynamic>) {
      throw FormatException('$field must be an array');
    }
    return value.map((dynamic item) {
      if (item is! Map<String, dynamic>) {
        throw FormatException('$field entries must be objects');
      }
      return item;
    }).toList(growable: false);
  }

  static Map<String, dynamic>? _nullableObject(dynamic value) {
    return value is Map<String, dynamic> ? value : null;
  }

  static String _string(Map<String, dynamic> source, String field) {
    final dynamic value = source[field];
    if (value is String) {
      return value;
    }
    throw FormatException('$field must be a string');
  }

  static int _int(Map<String, dynamic> source, String field) {
    final dynamic value = source[field];
    if (value is int) {
      return value;
    }
    throw FormatException('$field must be an integer');
  }

  static bool _bool(Map<String, dynamic> source, String field) {
    final dynamic value = source[field];
    if (value is bool) {
      return value;
    }
    throw FormatException('$field must be a Boolean');
  }

  static bool? _optionalBool(Map<String, dynamic> source, String field) {
    final dynamic value = source[field];
    return value is bool ? value : null;
  }
}
